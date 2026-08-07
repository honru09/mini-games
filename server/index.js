// 小游戏合集在线服务：静态文件 + WebSocket 房间中继（零依赖，手写 RFC6455）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  VALID_GAMES,
  REWARD_CONFIG,
  dayKey,
  xpForLevel,
  levelFromXp,
  levelProgress,
  evaluateEligibility,
  eligibilityThreshold,
  normalizeRoomResults,
  resolveMatchReward,
} = require('./reward-engine');
const { TankAuthority } = require('./gameplay/tank-sim');
const { TetrisBattleAuthority } = require('./gameplay/tetris-battle');
const { XiangqiClockAuthority, MonopolyAuctionAuthority } = require('./gameplay/turn-protocols');
const { TournamentOrchestrator } = require('./gameplay/tournament');
const { TetrisRuleAuthority } = require('./gameplay/tetris-rule-authority');
const { XiangqiRuleAuthority } = require('./gameplay/xiangqi-rule-authority');
const { MonopolyRuleAuthority } = require('./gameplay/monopoly-rule-authority');
const { PROTOCOL_VERSIONS, protocolError, capabilities: gameplayCapabilities } = require('./gameplay/protocol');
const { increment: incrementGameplayMetric, snapshot: gameplayMetricsSnapshot } = require('./gameplay/metrics');
const { SpectatorAccessGuard, TournamentGuard } = require('./gameplay/guards');
const { AI_STRATEGY_VERSION, aiStrategyPrompt } = require('./ai-strategy-skills');
const {
  normalizeStore: normalizeAILearningStore,
  getModel: getAILearningModel,
  chooseLearnedCandidate,
  recordDecision: recordAILearningDecision,
  applyMatchLearning,
  modelDbRow: aiModelDbRow,
  experienceDbRow: aiExperienceDbRow,
  loadModelRows: loadAILearningModelRows,
} = require('./ai-learning');

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, '..', 'public');
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'leaderboard.json');
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

/* ---------------- AI 代理（DeepSeek） ---------------- */
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || '';
const AI_UPSTREAM_TIMEOUT_MS = Math.max(1500, Math.min(10000, Number(process.env.AI_UPSTREAM_TIMEOUT_MS) || 5000));
const ALLOWED_ORIGINS = new Set([
  'https://honru09.github.io',
  'https://mini-games-online.onrender.com',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  ...String(process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
]);
function corsHeaders(req){
  const origin = String((req && req.headers && req.headers.origin) || '');
  const allowed = !origin || ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    ...(allowed && origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
function originAllowed(req){
  const origin = String((req && req.headers && req.headers.origin) || '');
  return !origin || ALLOWED_ORIGINS.has(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}
const GAME_NAMES = {
  gomoku: '五子棋', ludo: '飞行棋', monopoly: '大富翁',
  tank: '坦克大战', tetris: '俄罗斯方块', xiangqi: '象棋',
};
const AI_PERSONAS = {
  tsundere: { systemPrompt: '你性格傲娇，表达简短，但仍优先选择合理走法。', temperature: 0.55 },
  gambler: { systemPrompt: '你偏爱高风险高回报，但只能从合法选项中选择。', temperature: 0.8 },
  mean: { systemPrompt: '你说话犀利，决策务实，只输出合法选项。', temperature: 0.45 },
  cute: { systemPrompt: '你友好可爱，决策稳健，只输出合法选项。', temperature: 0.5 },
  teacher: { systemPrompt: '你重视概率和局面评估，选择数学期望更高的合法走法。', temperature: 0.25 },
};
const aiRate = new Map();
const aiConcurrentUser = new Map();
const aiConcurrentIp = new Map();
let aiGlobalConcurrent = 0;
const AI_GLOBAL_DAILY_LIMIT = Math.max(200, Number(process.env.AI_GLOBAL_DAILY_LIMIT) || 5000);
function requestIp(req){
  const chain = String((req.headers && req.headers['x-forwarded-for']) || '').split(',').map(s => s.trim()).filter(Boolean);
  // Render 等受信反向代理会把实际来源追加在链尾；取链尾可避免客户端伪造首项绕过限流。
  const forwarded = chain.length ? chain[chain.length - 1] : '';
  return forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
}
function consumeAIRate(key, minuteLimit, dayLimit){
  const now = Date.now();
  const rec = aiRate.get(key) || { minute: [], day: [] };
  rec.minute = rec.minute.filter(t => now - t < 60000);
  rec.day = rec.day.filter(t => now - t < 86400000);
  if (rec.minute.length >= minuteLimit || rec.day.length >= dayLimit) return false;
  rec.minute.push(now); rec.day.push(now); aiRate.set(key, rec);
  return true;
}

function buildAIPrompt(game, state, options){
  const name = GAME_NAMES[game] || game || '棋牌游戏';
  const stateText = typeof state === 'string' ? state : JSON.stringify(state);
  const strategy = aiStrategyPrompt(game);
  if (Array.isArray(options) && options.length){
    return '游戏：' + name +
      '\n' + strategy +
      '\n当前局面：' + stateText +
      '\n合法选项（已经由本地搜索从强到弱筛选，必须尊重强制胜/防守和规则安全边界）：' +
      options.map((o, i) => (i + 1) + '. ' + o).join('；') +
      '\n比较对手最强回应后选择一个；不为角色口吻牺牲胜率。严格只返回 JSON：{"choice":"选项原文"}';
  }
  return '游戏：' + name +
    '\n' + strategy +
    '\n当前局面：' + stateText +
    '\n请决定下一步具体走法（例如落子坐标），严格只返回 JSON：{"choice":"具体走法"}';
}

async function callDeepSeek(messages, temperature){
  const deadline = Date.now() + AI_UPSTREAM_TIMEOUT_MS;
  const timeoutSignal = () => AbortSignal.timeout(Math.max(250, deadline - Date.now()));
  const payload = {
    model: 'deepseek-chat',
    messages,
    temperature: (typeof temperature === 'number' && temperature >= 0 && temperature <= 2) ? temperature : 0.4,
    max_tokens: 200,
    stream: false,
    response_format: { type: 'json_object' },
  };
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify(payload),
    signal: timeoutSignal(),
  });
  if (res.status === 400){
    // 部分模型不支持 json_object：去掉后重试一次
    delete payload.response_format;
    const res2 = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify(payload),
      signal: timeoutSignal(),
    });
    if (!res2.ok) throw new Error('deepseek ' + res2.status + ': ' + (await res2.text()).slice(0, 160));
    const data2 = await res2.json();
    return data2.choices && data2.choices[0] && data2.choices[0].message ? data2.choices[0].message.content : '';
  }
  if (!res.ok) throw new Error('deepseek ' + res.status + ': ' + (await res.text()).slice(0, 160));
  const data = await res.json();
  return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
}

async function askDeepSeek(game, state, options, persona){
  const base = '你是高强度游戏 AI 决策器。人格只影响表达和近似等价选项，不能降低战术强度。你只输出合法、可执行的动作，绝不编造不存在的选项。';
  const sys = persona && persona.systemPrompt ? (base + ' ' + persona.systemPrompt) : base;
  const messages = [
    { role: 'system', content: sys },
    { role: 'user', content: buildAIPrompt(game, state, options) },
  ];
  const content = await callDeepSeek(messages, persona ? persona.temperature : undefined);
  let choice = null;
  const m = /"choice"\s*:\s*"([^"]*)"/.exec(content);
  if (m) choice = m[1];
  if (choice === null){
    try {
      const cleaned = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.choice === 'string') choice = parsed.choice;
    } catch {}
  }
  return choice;
}

async function handleAI(req, res){
  const cors = corsHeaders(req);
  if (!originAllowed(req)){
    res.writeHead(403, { ...cors, 'Content-Type': 'application/json' });
    res.end('{"choice":null,"error":"origin_not_allowed"}');
    return;
  }
  const user = authenticateHttp(req);
  if (!user){
    res.writeHead(401, { ...cors, 'Content-Type': 'application/json' });
    res.end('{"choice":null,"error":"authentication_required"}');
    return;
  }
  const ip = requestIp(req);
  if (!consumeAIRate('user:' + user.uid, 12, 200) ||
      !consumeAIRate('ip:' + ip, 30, 500) ||
      !consumeAIRate('global', 120, AI_GLOBAL_DAILY_LIMIT)){
    res.writeHead(429, { ...cors, 'Content-Type': 'application/json', 'Retry-After': '60' });
    res.end('{"choice":null,"error":"rate_limited"}');
    return;
  }
  const activeUser = aiConcurrentUser.get(user.uid) || 0;
  const activeIp = aiConcurrentIp.get(ip) || 0;
  if (activeUser >= 2 || activeIp >= 5 || aiGlobalConcurrent >= 20){
    res.writeHead(429, { ...cors, 'Content-Type': 'application/json', 'Retry-After': '3' });
    res.end('{"choice":null,"error":"too_many_requests"}');
    return;
  }
  aiConcurrentUser.set(user.uid, activeUser + 1);
  aiConcurrentIp.set(ip, activeIp + 1);
  aiGlobalConcurrent++;
  const chunks = [];
  let size = 0;
  try {
    for await (const c of req){
      size += c.length;
      if (size > 32768){
        res.writeHead(413, { ...cors, 'Content-Type': 'application/json' });
        res.end('{"choice":null,"error":"payload_too_large"}');
        return;
      }
      chunks.push(c);
    }
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = {}; }
    const game = String(body.game || '');
    if (!Object.prototype.hasOwnProperty.call(GAME_NAMES, game)){
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' });
      res.end('{"choice":null,"error":"invalid_game"}');
      return;
    }
    const options = Array.isArray(body.options)
      ? [...new Set(body.options.slice(0, 200).map(v => String(v).slice(0, 240)).filter(Boolean))]
      : null;
    let state = body.state;
    if (typeof state === 'string') state = state.slice(0, 16000);
    else {
      try { state = JSON.stringify(state).slice(0, 16000); } catch { state = ''; }
    }
    const personaId = body.persona && typeof body.persona === 'object' ? String(body.persona.id || '') : String(body.persona || '');
    const persona = AI_PERSONAS[personaId] || null;
    // 只有携带当前服务端 solo 票据的请求才会产生可学习 decisionId。
    // 这样 DeepSeek 慢响应在客户端超时/回退时不会凭空写入 AI 经验。
    const requestedContext = body.context && typeof body.context === 'object'
      ? body.context
      : (body && typeof body === 'object' ? body : {});
    const requestedMatchId = String(requestedContext.matchId || '');
    const requestedResultId = String(requestedContext.resultId || '');
    const matchAtStart = typeof soloMatches !== 'undefined' ? soloMatches.get(user.uid) : null;
    const contextBound = !!(!user.ephemeral && matchAtStart && !matchAtStart.completed &&
      matchAtStart.game === game && matchAtStart.matchId === requestedMatchId &&
      matchAtStart.resultId === requestedResultId);
    let upstreamChoice = null;
    if (DEEPSEEK_KEY){
      try {
        upstreamChoice = await askDeepSeek(game, state, options, persona);
      } catch (e) {
        console.error('AI 请求失败:', e.message);
      }
    }
    if (options && !options.includes(upstreamChoice)) upstreamChoice = null;
    const learningStore = user.ephemeral ? normalizeAILearningStore() : db.aiLearning;
    const decision = chooseLearnedCandidate(learningStore, user.uid, game, state, options, body.candidates, upstreamChoice);
    const choice = decision && decision.choice;
    const activeMatch = typeof soloMatches !== 'undefined' ? soloMatches.get(user.uid) : null;
    let decisionId = null;
    if (contextBound && activeMatch === matchAtStart && choice){
      if (!(activeMatch.pendingAIDecisions instanceof Map)) activeMatch.pendingAIDecisions = new Map();
      const now = Date.now();
      for (const [id, pending] of activeMatch.pendingAIDecisions){
        if (!pending || now - Number(pending.createdAt || 0) > AI_DECISION_TTL_MS) activeMatch.pendingAIDecisions.delete(id);
      }
      if (activeMatch.pendingAIDecisions.size < MAX_AI_PENDING_DECISIONS){
        decisionId = 'aid_' + crypto.randomBytes(14).toString('base64url');
        activeMatch.pendingAIDecisions.set(decisionId, {
          decisionId,
          decision: { ...decision, candidateCount: options ? options.length : 0 },
          options: options || [],
          createdAt: now,
        });
        activeMatch.updatedAt = now;
      }
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choice, strategyVersion: AI_STRATEGY_VERSION,
      decisionId, matchId: decisionId ? requestedMatchId : null, resultId: decisionId ? requestedResultId : null }));
  } finally {
    const userLeft = (aiConcurrentUser.get(user.uid) || 1) - 1;
    const ipLeft = (aiConcurrentIp.get(ip) || 1) - 1;
    if (userLeft > 0) aiConcurrentUser.set(user.uid, userLeft); else aiConcurrentUser.delete(user.uid);
    if (ipLeft > 0) aiConcurrentIp.set(ip, ipLeft); else aiConcurrentIp.delete(ip);
    aiGlobalConcurrent = Math.max(0, aiGlobalConcurrent - 1);
  }
}
async function handleAIConfirm(req, res){
  const cors = corsHeaders(req);
  if (!originAllowed(req)){
    res.writeHead(403, { ...cors, 'Content-Type': 'application/json' });
    res.end('{"confirmed":false,"error":"origin_not_allowed"}');
    return;
  }
  const user = authenticateHttp(req);
  if (!user){
    res.writeHead(401, { ...cors, 'Content-Type': 'application/json' });
    res.end('{"confirmed":false,"error":"authentication_required"}');
    return;
  }
  const chunks = [];
  let size = 0;
  try {
    for await (const chunk of req){
      size += chunk.length;
      if (size > 8192){
        res.writeHead(413, { ...cors, 'Content-Type': 'application/json' });
        res.end('{"confirmed":false,"error":"payload_too_large"}');
        return;
      }
      chunks.push(chunk);
    }
    let payload = {};
    try { payload = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
    let response = null;
    const sink = { sendText(text){ try { response = JSON.parse(text); } catch {} } };
    confirmSoloAIDecision(sink, user, payload);
    if (!response){
      res.writeHead(409, { ...cors, 'Content-Type': 'application/json' });
      res.end('{"confirmed":false,"error":"decision_not_pending"}');
      return;
    }
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ confirmed: true, ...(response.payload || {}) }));
  } catch (error) {
    console.error('AI 确认请求处理失败:', error.message);
    if (!res.headersSent) res.writeHead(500, { ...cors, 'Content-Type': 'application/json' });
    if (!res.writableEnded) res.end('{"confirmed":false,"error":"internal_error"}');
  }
}

/* ---------------- 静态文件 ---------------- */
const server = http.createServer((req, res) => {
  let urlPath;
  try { urlPath = decodeURIComponent((req.url || '/').split('?')[0]); }
  catch { res.writeHead(400); res.end('Bad Request'); return; }
  if (req.method === 'OPTIONS'){
    if (!originAllowed(req)){ res.writeHead(403); res.end(); return; }
    res.writeHead(204, corsHeaders(req));
    res.end();
    return;
  }
  if (req.method === 'POST' && urlPath === '/api/ai'){
    handleAI(req, res).catch(e => {
      console.error('AI 请求处理失败:', e && e.message || String(e));
      if (!res.headersSent) res.writeHead(500, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      if (!res.writableEnded) res.end('{"choice":null,"error":"internal_error"}');
    });
    return;
  }
  if (req.method === 'POST' && urlPath === '/api/ai/confirm'){
    handleAIConfirm(req, res).catch(e => {
      console.error('AI 确认处理失败:', e && e.message || String(e));
      if (!res.headersSent) res.writeHead(500, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      if (!res.writableEnded) res.end('{"confirmed":false,"error":"internal_error"}');
    });
    return;
  }
  if (req.method === 'GET' && urlPath === '/api/ip'){
    res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: requestIp(req) }));
    return;
  }
  if (req.method === 'GET' && urlPath === '/api/metrics'){
    const activeMatches=[...rooms.values()].filter(room=>room.started).length;
    const activeSpectators=[...rooms.values()].reduce((sum,room)=>sum+(room.spectators instanceof Map?room.spectators.size:0),0);
    res.writeHead(200,{...corsHeaders(req),'Content-Type':'application/json','Cache-Control':'no-store'});
    res.end(JSON.stringify(gameplayMetricsSnapshot({activeMatches,activeSpectators,activeTournaments:tournaments.size})));return;
  }
  const requestedPath = urlPath === '/' ? 'index.html' : urlPath.replace(/^[/\\]+/, '');
  const file = path.resolve(PUBLIC, requestedPath);
  const relative = path.relative(PUBLIC, file);
  if (!relative || relative.startsWith('..' + path.sep) || relative === '..' || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
});

/* ---------------- WebSocket（RFC6455，服务端帧） ---------------- */
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const rooms = new Map(); // roomId -> { host, clients: Map<ws, player>, game }
const tournaments = new Map();
const spectatorAccessGuard = new SpectatorAccessGuard({
  maxSpectators:Math.max(1,Math.min(50,Number(process.env.MAX_SPECTATORS)||12)),
  maxConnectionsPerUid:1,
});
const tournamentGuard = new TournamentGuard({
  maxActive:Math.max(1,Math.min(500,Number(process.env.MAX_ACTIVE_TOURNAMENTS)||100)),
  maxPerOwner:Math.max(1,Math.min(20,Number(process.env.MAX_TOURNAMENTS_PER_OWNER)||3)),
  ttlMs:Math.max(60000,Math.min(24*60*60*1000,Number(process.env.TOURNAMENT_TTL_MS)||6*60*60*1000)),
});
function broadcastTournament(entry){
  if(!entry||!entry.tournament)return;
  const guardState=tournamentGuard.snapshot(entry.tournament.tournamentId);
  const payload={...entry.tournament.snapshot(),ownerUid:entry.ownerUid,
    consents:guardState&&guardState.consents||{},expiresAt:guardState&&guardState.expiresAt||null,
    guardStatus:guardState&&guardState.status||'expired'};
  const ids=new Set(entry.tournament.participants.map(item=>item.id));
  for(const session of sessions)if(session.uid&&ids.has(session.uid))session.sendText(JSON.stringify({type:'tournament_state',payload}));
}
function registerTournamentPairings(entry){
  if(!entry||!entry.tournament)return false;
  const tournamentId=entry.tournament.tournamentId;
  for(const pairing of entry.tournament.pairings||[]){
    const registered=tournamentGuard.registerPairing(tournamentId,pairing.pairingId,pairing.players);
    if(!registered.ok&&registered.reason!=='duplicate_pairing')return false;
  }
  return true;
}
function tournamentParticipantSessions(entry){
  if(!entry||!entry.tournament)return{ok:false,reason:'tournament_not_found'};
  const byUid=new Map();
  for(const participant of entry.tournament.participants){
    const candidates=[...sessions].filter(session=>session.alive&&session.uid===participant.id).sort((a,b)=>(b.lastSeen||0)-(a.lastSeen||0));
    const session=candidates[0];
    if(!session)return{ok:false,reason:'participant_offline',uid:participant.id};
    const room=session.room&&rooms.get(session.room);
    if(room&&room.started&&!room.settled&&!room.tournamentBinding)return{ok:false,reason:'participant_busy',uid:participant.id};
    byUid.set(participant.id,session);
  }
  return{ok:true,byUid};
}
function releaseTournamentSourceRooms(sessionMap){
  const affected=new Set();
  for(const session of sessionMap.values()){
    if(session.spectatorRoom)session.leaveSpectator();
    const room=session.room&&rooms.get(session.room);
    if(room&&room.clients.has(session)){
      affected.add(room);room.clients.delete(session);
      if(room.started)session.sendText(JSON.stringify({type:'end_game'}));
    }
    session.room=null;session.player=null;session.resumeUntil=0;
  }
  for(const room of affected){
    if(!room.clients.size){
      if(room.spectators)for(const spectator of room.spectators.keys()){spectatorAccessGuard.leave(spectator.sessionId);spectator.spectatorRoom=null;spectator.sendText(JSON.stringify({type:'peer_left',payload:{roomClosed:true}}));}
      stopRoomAuthorities(room);rooms.delete(room.id);continue;
    }
    if(!room.clients.has(room.host)){
      room.host=[...room.clients.entries()].sort((a,b)=>a[1]-b[1])[0][0];
      room.host.sendText(JSON.stringify({type:'host_changed',payload:{player:room.clients.get(room.host)}}));
    }
    if(room.started)resetRoomMatch(room);
    compactRoomPlayers(room);broadcastRoom(room);
  }
}
function createTournamentMatchRoom(entry,pairing,sessionMap){
  const participants=pairing.players.map(uid=>sessionMap.get(uid));
  if(participants.some(session=>!session))return{ok:false,reason:'participant_offline'};
  let roomId=genCode();while(rooms.has(roomId))roomId=genCode();
  const room={
    id:roomId,host:participants[0],clients:new Map(participants.map((session,player)=>[session,player])),game:entry.tournament.gameId,capacity:2,
    started:false,matchId:null,resultClaims:new Map(),settled:false,disputed:false,
    moveSeq:0,moveLog:[],moveLogBytes:0,moveLogTruncated:false,
    tankInputSeq:{},tankAuthoritySeq:0,tankFinalSent:false,
    startedAt:0,rewardProgress:null,resultRewards:new Map(),
    spectators:new Map(),maxSpectators:Math.max(1,Math.min(50,Number(process.env.MAX_SPECTATORS)||12)),
    spectatorDelayMs:Math.max(0,Math.min(30000,Number(process.env.SPECTATOR_DELAY_MS)||0)),gameSnapshot:null,
    tetrisPresentation:new Map(),tournamentBinding:null,finalResult:null,
  };
  rooms.set(roomId,room);
  participants.forEach((session,player)=>{session.room=roomId;session.player=player;session.resumeUntil=0;session.sendText(JSON.stringify(player===0?{type:'created',room:roomId,player,capacity:2}:{type:'joined',room:roomId,player}));});
  broadcastRoom(room);startRoomMatch(room);
  const bound=tournamentGuard.bindMatch(entry.tournament.tournamentId,pairing.pairingId,{matchId:room.matchId,gameId:room.game,players:pairing.players});
  if(!bound.ok){stopRoomAuthorities(room);rooms.delete(roomId);participants.forEach(session=>{session.room=null;session.player=null;});return bound;}
  const attached=entry.tournament.attachMatchRoom(pairing.pairingId,roomId,{source:'tournament',gameId:room.game,serverMatchId:room.matchId});
  if(!attached.ok){stopRoomAuthorities(room);rooms.delete(roomId);participants.forEach(session=>{session.room=null;session.player=null;});return attached;}
  room.tournamentBinding={tournamentId:entry.tournament.tournamentId,roundId:pairing.roundId,pairingId:pairing.pairingId,matchRoomId:roomId,source:'tournament',matchId:room.matchId,players:pairing.players.slice()};
  for(const session of participants)session.sendText(JSON.stringify({type:'tournament_match_assigned',payload:{...room.tournamentBinding,gameId:room.game,player:room.clients.get(session)}}));
  return{ok:true,room};
}
function autoCreateTournamentRound(entry,ready){
  const sessionsReady=ready&&ready.ok?ready:tournamentParticipantSessions(entry);if(!sessionsReady.ok)return sessionsReady;
  releaseTournamentSourceRooms(sessionsReady.byUid);
  const paired=new Set();
  for(const pairing of entry.tournament.pairings||[]){
    const created=createTournamentMatchRoom(entry,pairing,sessionsReady.byUid);if(!created.ok)return created;
    pairing.players.forEach(uid=>paired.add(uid));
  }
  for(const [uid,session] of sessionsReady.byUid)if(!paired.has(uid))session.sendText(JSON.stringify({type:'tournament_bye',payload:{tournamentId:entry.tournament.tournamentId,roundId:entry.tournament.round,source:'tournament'}}));
  broadcastTournament(entry);broadcastLobby();return{ok:true};
}
function scheduleTournamentNextRound(entry){
  if(!entry||entry.advanceTimer||entry.tournament.status!=='round_complete')return;
  entry.advanceTimer=setTimeout(()=>{
    entry.advanceTimer=null;if(entry.tournament.status!=='round_complete')return;
    const ready=tournamentParticipantSessions(entry);if(!ready.ok){broadcastTournament(entry);return;}
    const next=entry.tournament.advance();
    if(!next){if(typeof tournamentGuard.finish==='function')tournamentGuard.finish(entry.tournament.tournamentId,entry.ownerUid);broadcastTournament(entry);return;}
    if(!registerTournamentPairings(entry)){broadcastTournament(entry);return;}
    const created=autoCreateTournamentRound(entry,ready);
    if(!created.ok)for(const session of ready.byUid.values())session.sendText(JSON.stringify({type:'tournament_error',msg:'自动建桌失败：'+created.reason,reason:created.reason}));
  },800);
  if(entry.advanceTimer&&entry.advanceTimer.unref)entry.advanceTimer.unref();
}
function reportTournamentRoomResult(r,results,options={}){
  const binding=r&&r.tournamentBinding;
  if(!binding||!r.matchId||String(binding.matchId)!==String(r.matchId)||
      ['invalidated','disputed'].includes(String(options.cause||'')))return false;
  const entry=tournaments.get(binding.tournamentId);
  if(!entry||!entry.tournament)return false;
  const participants=[...r.clients.entries()].map(([session,slot])=>({uid:session.uid,slot})).filter(item=>item.uid);
  const playerUids=participants.map(item=>item.uid);
  const authorized=tournamentGuard.authorizeResult(binding.tournamentId,binding.pairingId,{
    matchId:r.matchId,gameId:r.game,players:playerUids,source:'room_authority',
  });
  if(!authorized.ok)return false;
  const minRank=Math.min(...results.map(item=>Number(item.rank)||Number.MAX_SAFE_INTEGER));
  const leaders=results.filter(item=>(Number(item.rank)||Number.MAX_SAFE_INTEGER)===minRank);
  let outcome={draw:true};
  if(leaders.length===1){
    const winner=participants.find(item=>item.slot===leaders[0].slot);
    if(!winner)return false;
    outcome={winnerUid:winner.uid,forfeit:String(options.cause||'')==='forfeit'};
  }
  const reported=entry.tournament.reportServerResult(r.id,outcome,{source:'server',matchRoomId:r.id});
  if(!reported.ok)return false;
  if(entry.tournament.status==='round_complete')scheduleTournamentNextRound(entry);
  else if(entry.tournament.status==='finished'&&typeof tournamentGuard.finish==='function')tournamentGuard.finish(binding.tournamentId,entry.ownerUid);
  broadcastTournament(entry);
  return true;
}
const sessions = new Set();
const pendingInvites = new Map(); // toUid -> [{fromUid, fromName, room, game}]
// 已认证且正在对局中的连接断开后，保留其玩家槽位一小段时间。
// 通过环境变量可缩短/延长，测试与部署均可按需覆盖。
const RECONNECT_GRACE_MS = Math.max(1000, Number(process.env.RECONNECT_GRACE_MS) || 60000);
const EXPIRED_RESUME_TTL_MS = Math.max(5000, Math.min(300000, RECONNECT_GRACE_MS * 2));
const HEARTBEAT_TIMEOUT_MS = Math.max(15000, Number(process.env.HEARTBEAT_TIMEOUT_MS) || 40000);
const MATCH_IDLE_TIMEOUT_MS = Math.max(60000, Number(process.env.MATCH_IDLE_TIMEOUT_MS) || 10 * 60 * 1000);
const MOVE_LOG_MAX_EVENTS = Math.max(100, Math.min(20000, Number(process.env.MOVE_LOG_MAX_EVENTS) || 5000));
const MOVE_LOG_MAX_BYTES = Math.max(262144, Math.min(16 * 1024 * 1024, Number(process.env.MOVE_LOG_MAX_BYTES) || 4 * 1024 * 1024));
const REWARD_SYNC_RETRY_MS = Math.max(1000, Math.min(5 * 60 * 1000, Number(process.env.REWARD_SYNC_RETRY_MS) || 30000));
const AI_DECISION_TTL_MS = Math.max(5000, Math.min(120000, Number(process.env.AI_DECISION_TTL_MS) || 30000));
const MAX_AI_PENDING_DECISIONS = Math.max(16, Math.min(500, Number(process.env.MAX_AI_PENDING_DECISIONS) || 300));
const expiredResumes = new Map(); // uid|tokenHash -> { room, player, expiresAt }
const soloMatches = new Map(); // uid -> 服务端签发的人机对局票据与进度
const GAME_MAX = { gomoku: 2, ludo: 4, monopoly: 5, tank: 2, tetris: 4, xiangqi: 2 };
const GAME_MIN = { gomoku: 2, ludo: 2, monopoly: 2, tank: 2, tetris: 2, xiangqi: 2 };

const PROTOCOL_VERSION = 1;
function rewardThresholdOverrides(){
  if (process.env.NODE_ENV !== 'test') return null;
  const envMap = {
    minDurationMs: 'REWARD_TEST_MIN_DURATION_MS',
    minActions: 'REWARD_TEST_MIN_ACTIONS',
    minUniqueActions: 'REWARD_TEST_MIN_UNIQUE_ACTIONS',
    minPlayerActions: 'REWARD_TEST_MIN_PLAYER_ACTIONS',
  };
  const value = {};
  for (const [key, envName] of Object.entries(envMap)){
    if (process.env[envName] === undefined) continue;
    const parsed = Number(process.env[envName]);
    if (Number.isFinite(parsed) && parsed >= 0) value[key] = Math.floor(parsed);
  }
  return Object.keys(value).length ? value : null;
}
function validCoord(value, rows, cols){
  return Array.isArray(value) && value.length === 2 && Number.isInteger(Number(value[0])) && Number.isInteger(Number(value[1])) &&
    Number(value[0]) >= 0 && Number(value[0]) < rows && Number(value[1]) >= 0 && Number(value[1]) < cols;
}
function normalizedActionKey(game, payload){
  if (game === 'gomoku'){
    const coord = validCoord(payload, 15, 15) ? payload :
      (!!payload && !Array.isArray(payload) && validCoord([payload.r, payload.c], 15, 15) ? [payload.r, payload.c] : null);
    return coord ? 'place:' + Number(coord[0]) + ',' + Number(coord[1]) : null;
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
  if (game === 'ludo'){
    if (Number.isInteger(payload.dice) && payload.dice >= 1 && payload.dice <= 6) return 'dice:' + payload.dice;
    if (Number.isInteger(payload.ti) && payload.ti >= 0 && payload.ti < 4) return 'token:' + payload.ti;
  }
  if (game === 'monopoly'){
    if (Array.isArray(payload.roll) && payload.roll.length === 2 && payload.roll.every(v => Number.isInteger(v) && v >= 1 && v <= 6)) return 'roll:' + payload.roll.join(',');
    if (['buy', 'pass', 'settle'].includes(payload.decision)) return 'decision:' + payload.decision;
  }
  if (game === 'tank'){
    if (payload.act === 'shoot') return 'shoot';
    if (payload.act === 'move' && Number.isInteger(payload.d) && payload.d >= 0 && payload.d < 4) return 'move:' + payload.d;
    if (payload.act === 'input' && payload.input && typeof payload.input === 'object' && !Array.isArray(payload.input)){
      const active = ['up', 'right', 'down', 'left', 'fire'].filter(key => payload.input[key] === true);
      if (active.length) return 'input:' + active.join('+');
    }
  }
  if (game === 'tetris' && Number.isInteger(payload.piece) && payload.piece >= 0 && payload.piece < 7 &&
      Number.isInteger(payload.x) && payload.x >= -4 && payload.x <= 14 && Number.isInteger(payload.y) && payload.y >= -6 && payload.y <= 20 &&
      Number.isInteger(payload.rot) && payload.rot >= 0 && payload.rot < 4){
    return 'place:' + [payload.piece, payload.x, payload.y, payload.rot].join(',');
  }
  if (game === 'xiangqi' && validCoord(payload.from, 10, 9) && validCoord(payload.to, 10, 9)){
    return 'move:' + [Number(payload.from[0]), Number(payload.from[1]), Number(payload.to[0]), Number(payload.to[1])].join(',');
  }
  return null;
}
function meaningfulAction(game, payload){
  return normalizedActionKey(game, payload) !== null;
}
const TANK_RELAY_PROTOCOL = 'tank-host-relay-v1';
function acceptTankRelayPayload(r, session, payload){
  if (!r || r.game !== 'tank') return true;
  const act = String(payload && payload.act || '');
  const authorityEvent = act === 'authoritative_state' || act === 'authoritative_result';
  const protocolEvent = payload && payload.protocol === TANK_RELAY_PROTOCOL;
  if (authorityEvent){
    // 服务端只确认发送者确为房主并保持序列单调；碰撞、排名仍由休闲房主客户端计算。
    const seq = Number(payload.authoritySeq);
    if (r.tankFinalSent || !protocolEvent || session !== r.host || String(payload.matchId || '') !== String(r.matchId || '') ||
        !Number.isSafeInteger(seq) || seq < 1 || seq <= (r.tankAuthoritySeq || 0)) return false;
    r.tankAuthoritySeq = seq;
    if (act === 'authoritative_result') r.tankFinalSent = true;
    return true;
  }
  if (protocolEvent){
    if (String(payload.matchId || '') !== String(r.matchId || '') || !['input','move','shoot'].includes(act)) return false;
  } else if (payload && payload.protocol) {
    return false;
  }
  const sequencedInput = protocolEvent || (act === 'input' && Object.prototype.hasOwnProperty.call(payload,'seq'));
  if (!sequencedInput) return true; // 兼容旧 act:move/shoot 以及无序列旧输入。
  const seq = Number(payload.seq);
  if (!Number.isSafeInteger(seq) || seq < 1) return false;
  if (!r.tankInputSeq || typeof r.tankInputSeq !== 'object') r.tankInputSeq = {};
  const last = Number(r.tankInputSeq[session.player]) || 0;
  if (seq <= last) return false;
  r.tankInputSeq[session.player] = seq;
  return true;
}
function compactTankRelayLog(r, payload){
  if (!r || r.game !== 'tank' || !payload || !['authoritative_state','authoritative_result'].includes(payload.act) || !Array.isArray(r.moveLog)) return;
  r.moveLog = r.moveLog.filter(event => {
    if (!event || !event.payload || event.payload.act !== 'authoritative_state') return true;
    try { r.moveLogBytes -= Buffer.byteLength(JSON.stringify(event.payload)); } catch {}
    return false;
  });
  r.moveLogBytes = Math.max(0,r.moveLogBytes || 0);
}
function actionFingerprint(game, player, payload){
  const key = normalizedActionKey(game, payload);
  return key === null ? '' : game + '|' + String(player) + '|' + key;
}
function normalizeUserRewardState(u){
  if (!u || typeof u !== 'object') return u;
  const oldLevel = Math.max(1, Number(u.level) || 1);
  u.xp = Math.max(0, Math.floor(Number(u.xp) || 0));
  // 即使数据库迁移曾把旧账号直接标记为新曲线，也绝不允许既有等级回退。
  u.xp = Math.max(u.xp, xpForLevel(oldLevel));
  if (Number(u.xpCurveVersion) !== REWARD_CONFIG.level.curveVersion){
    u.xpCurveVersion = REWARD_CONFIG.level.curveVersion;
  }
  u.level = levelFromXp(u.xp);
  u.streak = Math.max(0, Math.floor(Number(u.streak) || 0));
  u.bestStreak = Math.max(u.streak, Math.floor(Number(u.bestStreak) || 0));
  u.dailyFirstWinDate = String(u.dailyFirstWinDate || '');
  u.dailyAICurrencyKey = String(u.dailyAICurrencyKey || '');
  u.dailyAICurrencyEarned = Math.max(0, Math.floor(Number(u.dailyAICurrencyEarned) || 0));
  if (u.dailyAICurrencyKey !== dayKey()){
    u.dailyAICurrencyKey = dayKey();
    u.dailyAICurrencyEarned = 0;
  }
  if (!u.wins || typeof u.wins !== 'object' || Array.isArray(u.wins)) u.wins = {};
  u.totalWins = Math.max(0, Math.floor(Number(u.totalWins) || Object.values(u.wins).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0)));
  return u;
}

/* ---------------- Supabase 数据库（可选，配置环境变量后启用） ---------------- */
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);
const sbProfileQueues = new Map();
const sbAILearningQueues = new Map();
const sbAILearningDrains = new Map();
async function sbFetch(path, options = {}){
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    signal: options.signal || AbortSignal.timeout(15000),
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error('supabase ' + res.status + ': ' + (await res.text()).slice(0, 200));
  if (res.status === 204) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text); }
  catch { throw new Error('supabase 返回了无效 JSON（status=' + res.status + '）'); }
}
async function sbLoadProfiles(){
  if (!useSupabase) return;
  try {
    const rows = await sbFetch('profiles?select=*&order=coins.desc&limit=5000');
    const users = {};
    for (const r of (Array.isArray(rows) ? rows : [])){
      users[r.uid] = normalizeUserRewardState({
        uid: r.uid, name: r.name, avatar: r.avatar, coins: r.coins || 0, xp: r.xp || 0, level: r.level || 1, streak: r.streak || 0, bestStreak: r.best_streak || 0, played: r.played || {}, total: r.total || 0, wins: r.wins || {}, totalWins: r.total_wins || 0,
        background: r.background || 0, frame: r.frame || 0, effect: r.effect || 0,
        owned: normalizeOwned(r.owned), gameCosmetics: normalizeGameCosmetics(r.game_cosmetics),
        pin_hash: r.pin_hash || null, lang: r.lang || 'zh-CN',
        achievements: r.achievements || [], playmates: r.playmates || {}, daily: r.daily || { play: 0, win: 0, streak: 0 }, dailyKey: r.daily_key || '', nameFx: r.name_fx || 0,
        authTokens: normalizeAuthTokenRecords(r.auth_tokens),
        recentResults: Array.isArray(r.recent_results) ? r.recent_results.map(String).slice(-500) : [],
        purchaseRequests: Array.isArray(r.purchase_requests) ? r.purchase_requests.map(String).slice(-100) : [],
        soloRate: Array.isArray(r.solo_rate) ? r.solo_rate.map(Number).filter(Number.isFinite).slice(-100) : [],
        dailyFirstWinDate: r.daily_first_win_date || '',
        dailyAICurrencyKey: r.daily_ai_currency_key || '',
        dailyAICurrencyEarned: r.daily_ai_currency_earned || 0,
        xpCurveVersion: r.xp_curve_version || 0,
      });
    }
    // 已向玩家确认、但尚未成功写入远端的奖励必须优先保留本地档案；否则重启加载旧远端档案会造成回档。
    const pendingUids = new Set((db.pendingRewardSync || []).map(item => item && item.uid).filter(Boolean));
    const pendingUsers = Object.fromEntries(Object.entries(db.users).filter(([uid, u]) => pendingUids.has(uid) && u && !u.ephemeral));
    const localOnly = Object.values(db.users).filter(u => u && u.uid && !users[u.uid] && !u.ephemeral);
    db.users = { ...db.users, ...users };
    Object.assign(db.users, pendingUsers);
    if (localOnly.length) await Promise.all(localOnly.map(u => sbCreateProfile(u)));
    await sbLoadRewardHistory();
    await retryPendingRewardSync();
    await sbLoadAILearningModels();
    await retryPendingAILearningSync();
    console.log('已从 Supabase 加载 ' + Object.keys(users).length + ' 位玩家');
  } catch (e) {
    console.error('加载 Supabase 数据失败（继续使用本地数据）:', e.message);
  }
}
async function sbLoadRewardHistory(){
  if (!useSupabase) return;
  try {
    const cutoff = new Date(Date.now() - REWARD_CONFIG.repeatOpponent.windowMs).toISOString();
    const remoteRows = [];
    const pageSize = 1000;
    for (let offset = 0; offset < 50000; offset += pageSize){
      const rows = await sbFetch('reward_history?select=*&created_at=gte.' + encodeURIComponent(cutoff) +
        '&order=created_at.asc&limit=' + pageSize + '&offset=' + offset);
      const page = Array.isArray(rows) ? rows : [];
      remoteRows.push(...page);
      if (page.length < pageSize) break;
    }
    const mapped = remoteRows.map(row => {
      const reward = {
        version: row.config_version || REWARD_CONFIG.version,
        gameId: row.game,
        mode: row.mode,
        result: row.result,
        placement: row.placement,
        eligible: row.eligible !== false,
        blockedReason: row.blocked_reason || null,
        currency: row.reward_currency || 0,
        xp: row.reward_xp || 0,
        baseCurrency: row.base_currency || 0,
        baseXp: row.base_xp || 0,
        levelBefore: row.level_before || 1,
        levelAfter: row.level_after || 1,
        streakBefore: row.streak_before || 0,
        streakAfter: row.streak_after || 0,
        breakdown: Array.isArray(row.breakdown) ? row.breakdown : [],
        rewardReasons: Array.isArray(row.reward_reason) ? row.reward_reason : [],
      };
      return {
        uid: row.uid,
        game: row.game,
        mode: row.mode,
        resultId: row.result_id,
        matchId: row.match_id || null,
        result: row.result,
        placement: row.placement,
        opponentIds: Array.isArray(row.opponent_ids) ? row.opponent_ids : [],
        opponentKey: row.opponent_key || '',
        durationMs: Number(row.duration_ms) || 0,
        meaningfulActions: Number(row.meaningful_actions) || 0,
        eligible: row.eligible !== false,
        blockedReason: row.blocked_reason || null,
        coins: row.reward_currency || 0,
        xp: row.reward_xp || 0,
        baseCurrency: row.base_currency || 0,
        baseXp: row.base_xp || 0,
        rewardReasons: reward.rewardReasons,
        levelBefore: reward.levelBefore,
        levelAfter: reward.levelAfter,
        streakBefore: reward.streakBefore,
        streakAfter: reward.streakAfter,
        breakdown: reward.breakdown,
        at: Date.parse(row.created_at) || Date.now(),
        reward,
      };
    });
    const byResult = new Map();
    for (const row of [...mapped, ...db.rewardHistory]){
      const key = String(row.uid || '') + '|' + String(row.resultId || '');
      if (row.uid && row.resultId) byResult.set(key, row);
    }
    db.rewardHistory = [...byResult.values()].sort((a, b) => Number(a.at || 0) - Number(b.at || 0)).slice(-50000);
  } catch (e) {
    console.error('加载 Supabase 奖励流水失败（重复对手衰减仅使用当前进程数据）:', e.message);
  }
}
async function sbLoadAILearningModels(){
  if (!useSupabase) return;
  try {
    const rows = [];
    const pageSize = 1000;
    for (let offset = 0; offset < 50000; offset += pageSize){
      const page = await sbFetch('ai_learning_models?select=*&order=updated_at.asc&limit=' + pageSize + '&offset=' + offset);
      const list = Array.isArray(page) ? page : [];
      rows.push(...list);
      if (list.length < pageSize) break;
    }
    loadAILearningModelRows(db.aiLearning, rows);
    console.log('已从 Supabase 加载 ' + rows.length + ' 个个性化 AI 模型');
  } catch (error) {
    console.error('加载 Supabase AI 学习模型失败（继续使用本地模型）:', error.message);
  }
}
function profileDbRow(u){
  return {
    uid: u.uid, name: u.name, avatar: u.avatar, coins: u.coins, xp: u.xp || 0, level: u.level || 1,
    streak: u.streak || 0, best_streak: u.bestStreak || 0, played: u.played || {}, total: u.total || 0,
    wins: u.wins || {}, total_wins: u.totalWins || 0,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: normalizeOwned(u.owned), game_cosmetics: normalizeGameCosmetics(u.gameCosmetics), pin_hash: u.pin_hash || null, lang: u.lang || 'zh-CN',
    achievements: u.achievements || [], playmates: u.playmates || {},
    daily: u.daily || { play: 0, win: 0, streak: 0 }, daily_key: u.dailyKey || '', name_fx: u.nameFx || 0,
    auth_tokens: Array.isArray(u.authTokens) ? u.authTokens.slice(-5) : [],
    recent_results: Array.isArray(u.recentResults) ? u.recentResults.slice(-500) : [],
    purchase_requests: Array.isArray(u.purchaseRequests) ? u.purchaseRequests.slice(-100) : [],
    solo_rate: Array.isArray(u.soloRate) ? u.soloRate.slice(-100) : [],
    daily_first_win_date: u.dailyFirstWinDate || '', daily_ai_currency_key: u.dailyAICurrencyKey || '',
    daily_ai_currency_earned: u.dailyAICurrencyEarned || 0,
    xp_curve_version: u.xpCurveVersion || REWARD_CONFIG.level.curveVersion,
    updated_at: new Date().toISOString(),
  };
}
// 普通档案消息只能同步玩家可编辑字段。权威经济/成长/认证字段由各自 RPC 或
// 专用 auth patch 写入，避免一个排队中的旧全量快照覆盖购买/奖励结果。
function editableProfileDbRow(u){
  return {
    name: String(u && u.name || '').slice(0, 12),
    avatar: Number.isInteger(u && u.avatar) ? u.avatar : 0,
    background: Number.isInteger(u && u.background) ? u.background : 0,
    frame: Number.isInteger(u && u.frame) ? u.frame : 0,
    effect: Number.isInteger(u && u.effect) ? u.effect : 0,
    game_cosmetics: normalizeGameCosmetics(u && u.gameCosmetics),
    lang: ['zh-CN', 'en-US', 'uk-UA'].includes(u && u.lang) ? u.lang : 'zh-CN',
    name_fx: Number.isInteger(u && u.nameFx) ? u.nameFx : 0,
    updated_at: new Date().toISOString(),
  };
}
function authProfileDbRow(u){
  return {
    pin_hash: u && u.pin_hash || null,
    auth_tokens: Array.isArray(u && u.authTokens) ? u.authTokens.slice(-5) : [],
    updated_at: new Date().toISOString(),
  };
}
function ensureSupabaseRuntimeState(u){
  if (!u || typeof u !== 'object') return u;
  const defaults = {
    _supabaseLocalRewardCurrency: 0,
    _supabaseRemoteRewardCurrency: 0,
    _supabaseRewardAppliedIds: new Set(),
  };
  for (const [key, fallback] of Object.entries(defaults)){
    const descriptor = Object.getOwnPropertyDescriptor(u, key);
    const value = descriptor ? descriptor.value : fallback;
    if (!descriptor || descriptor.enumerable){
      Object.defineProperty(u, key, { value, writable: true, configurable: true, enumerable: false });
    }
  }
  return u;
}
function sbProfileQueue(uid, task, label){
  const previous = sbProfileQueues.get(uid) || Promise.resolve();
  // task 在真正出队时执行；不能在调用 sbSyncProfile 时预先 JSON.stringify(u)。
  const run = previous.catch(() => {}).then(task).catch(error => {
    console.error('Supabase ' + (label || '同步档案') + '失败:', error.message);
    return false;
  });
  sbProfileQueues.set(uid, run);
  // 不使用裸 finally 链，避免失败时产生未处理的 rejected promise。
  run.then(() => {
    if (sbProfileQueues.get(uid) === run) sbProfileQueues.delete(uid);
  }, () => {
    if (sbProfileQueues.get(uid) === run) sbProfileQueues.delete(uid);
  });
  return run;
}
function sbCreateProfile(u){
  if (!useSupabase || !u || u.ephemeral) return Promise.resolve(true);
  const uid = u.uid;
  return sbProfileQueue(uid, () => sbFetch('profiles?on_conflict=uid', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    // 创建账号时允许完整初始档案；后续普通 profile 更新绝不复用此路径。
    body: JSON.stringify(profileDbRow(u)),
  }).then(() => true), '创建档案');
}
function sbSyncEditableProfile(u){
  if (!useSupabase || !u || u.ephemeral) return Promise.resolve(true);
  const uid = encodeURIComponent(String(u.uid));
  return sbProfileQueue(u.uid, () => sbFetch('profiles?uid=eq.' + uid, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    // 在 queue 执行时读取 u，且只包含可编辑字段。
    body: JSON.stringify(editableProfileDbRow(u)),
  }).then(() => true), '同步可编辑档案');
}
function sbSyncAuthProfile(u){
  if (!useSupabase || !u || u.ephemeral) return Promise.resolve(true);
  const uid = encodeURIComponent(String(u.uid));
  return sbProfileQueue(u.uid, () => sbFetch('profiles?uid=eq.' + uid, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify(authProfileDbRow(u)),
  }).then(() => true), '同步认证状态');
}
// 兼容旧调用点：默认走安全的可编辑字段 patch，而不是全量 upsert。
function sbSyncProfile(u){ return sbSyncEditableProfile(u); }
async function sbInsert(table, rows, label){
  if (!useSupabase || !Array.isArray(rows) || !rows.length) return;
  try {
    await sbFetch(table, {
      method: 'POST',
      body: JSON.stringify(rows),
    });
  } catch (e) { console.error('Supabase 写入' + label + '失败:', e.message); }
}
function isoTimestamp(value){
  const input = value === undefined || value === null || value === '' ? Date.now() : value;
  const date = input instanceof Date ? input : new Date(input);
  return Number.isFinite(date.getTime()) ? date.toISOString() : new Date().toISOString();
}
function historyDbRow(row){
  return {
    uid: row.uid, game: row.game, coins: row.coins || 0, xp: row.xp || 0,
    result_id: row.resultId || null, match_id: row.matchId || null, mode: row.mode || 'online',
    result: row.result || null, placement: Number.isInteger(row.placement) ? row.placement : null,
    eligible: row.eligible !== false, blocked_reason: row.blockedReason || null, created_at: isoTimestamp(row.at),
  };
}
function rewardDbRow(row){
  return {
    uid: row.uid, game: row.game, mode: row.mode, result_id: row.resultId, match_id: row.matchId || null,
    result: row.result, placement: row.placement, opponent_ids: row.opponentIds || [], opponent_key: row.opponentKey || '',
    duration_ms: row.durationMs || 0, meaningful_actions: row.meaningfulActions || 0,
    eligible: row.eligible !== false, blocked_reason: row.blockedReason || null,
    base_currency: row.baseCurrency || 0, base_xp: row.baseXp || 0,
    reward_currency: row.coins || 0, reward_xp: row.xp || 0, reward_reason: row.rewardReasons || [],
    level_before: row.levelBefore || 1, level_after: row.levelAfter || 1,
    streak_before: row.streakBefore || 0, streak_after: row.streakAfter || 0,
    breakdown: row.breakdown || [], config_version: row.reward && row.reward.version || REWARD_CONFIG.version,
    created_at: isoTimestamp(row.at),
  };
}
function ledgerDbRow(row){
  if (!row) return null;
  return {
    uid: row.uid, kind: row.kind, amount: row.amount, balance_after: row.balanceAfter,
    ref_id: row.refId || null, metadata: row.metadata || {}, created_at: isoTimestamp(row.at),
  };
}
function sbAddHistory(row, game, coins, meta = {}){
  // 兼容旧调用签名 sbAddHistory(uid, game, coins, meta)，迁移期间统一归一为流水对象。
  if (!row || typeof row !== 'object' || Array.isArray(row)) row = { uid: row, game, coins, ...meta };
  if (!row || (db.users[row.uid] && db.users[row.uid].ephemeral)) return Promise.resolve();
  return sbInsert('history', [historyDbRow(row)], '对局历史');
}
function sbAddRewardHistory(row){
  if (!row || (db.users[row.uid] && db.users[row.uid].ephemeral)) return Promise.resolve();
  return sbInsert('reward_history', [rewardDbRow(row)], '奖励流水');
}
function sbAddEconomyLedger(row){
  if (!row || !row.amount || (db.users[row.uid] && db.users[row.uid].ephemeral)) return Promise.resolve();
  return sbInsert('economy_ledger', [ledgerDbRow(row)], '经济流水');
}
function sbAddAnalyticsEvents(rows){
  const safe = (Array.isArray(rows) ? rows : [rows]).filter(Boolean).filter(row => !row.uid || !(db.users[row.uid] && db.users[row.uid].ephemeral));
  if (!safe.length) return Promise.resolve();
  return sbInsert('analytics_events', safe.map(row => ({
    event: row.event,
    uid: row.uid || null,
    match_id: row.matchId || null,
    game: row.game || null,
    mode: row.mode || null,
    metadata: row.metadata || {},
    created_at: isoTimestamp(row.at),
  })), '埋点');
}
function sbApplyRewardTransaction(u, row){
  if (!useSupabase || !u || !row || u.ephemeral) return Promise.resolve(true);
  ensureSupabaseRuntimeState(u);
  const uid = u.uid;
  return sbProfileQueue(uid, () => {
    // 购买/档案 patch 可能在本次奖励入队后才完成；必须在真正出队时
    // 读取最新本地档案，并把账本 balance_after 对齐同一快照。
    const profile = profileDbRow(u);
    const reward = rewardDbRow(row);
    const ledger = ledgerDbRow(row.economyRow);
    if (ledger) ledger.balance_after = Number(profile.coins) || 0;
    return sbFetch('rpc/apply_reward_v1', {
      method: 'POST',
      body: JSON.stringify({ p_profile: profile, p_history: historyDbRow(row), p_reward: reward, p_ledger: ledger }),
    });
  }).then(result => {
    const resultId = result && String(result.resultId || '');
    const ok = resultId === String(row.resultId) && (result.applied === true || result.duplicate === true);
    if (ok){
      if (!(u._supabaseRewardAppliedIds instanceof Set)) u._supabaseRewardAppliedIds = new Set();
      u._supabaseRewardAppliedIds.add(String(row.resultId));
      if (u._supabaseRewardAppliedIds.size > 500) u._supabaseRewardAppliedIds = new Set([...u._supabaseRewardAppliedIds].slice(-250));
      if (row.coins) u._supabaseRemoteRewardCurrency = (Number(u._supabaseRemoteRewardCurrency) || 0) + (Number(row.coins) || 0);
    }
    return ok;
  });
}
function sbApplyPurchaseTransaction(u, category, itemId, price, requestId){
  if (!useSupabase || !u || u.ephemeral) return Promise.resolve(null);
  const uid = u.uid;
  return sbProfileQueue(uid, () => sbFetch('rpc/apply_purchase_v1', {
    method: 'POST', body: JSON.stringify({
      p_uid: uid,
      p_category: category,
      p_item_id: itemId,
      p_price: price,
      p_request_id: requestId,
    }),
  })).then(result => {
    if (!result || String(result.resultId || '') !== String(requestId)) return null;
    if (result.applied === true || result.duplicate === true || result.insufficient === true || result.alreadyOwned === true) return result;
    return null;
  });
}
function sbApplyAILearningTransaction(uid, resultId, model, experiences){
  if (!useSupabase || !uid || !model || !Array.isArray(experiences) || !experiences.length) return Promise.resolve(true);
  const body = JSON.stringify({
    p_model: aiModelDbRow(model),
    p_result_id: resultId,
    p_experiences: experiences.map(aiExperienceDbRow),
  });
  const queueKey = uid + '|' + model.game;
  const previous = sbAILearningQueues.get(queueKey) || Promise.resolve();
  const run = previous.catch(() => {}).then(() => sbFetch('rpc/apply_ai_learning_v1', {
    method: 'POST', body,
  })).then(result => ({
    ok: String(result && result.resultId || '') === String(resultId) &&
      (result.applied === true || result.duplicate === true),
    duplicate: !!(result && result.duplicate === true), conflict: false,
  })).catch(error => {
    const message = String(error && error.message || error || '');
    const conflict = /stale_ai_learning_revision|revision[_ -]?conflict|current_revision/i.test(message);
    if (!conflict) console.error('Supabase AI 学习事务失败:', message);
    return { ok: false, duplicate: false, conflict, error: message };
  });
  sbAILearningQueues.set(queueKey, run);
  run.finally(() => { if (sbAILearningQueues.get(queueKey) === run) sbAILearningQueues.delete(queueKey); });
  return run;
}

/* ---------------- 排行榜持久化（JSON 文件） ---------------- */
function emptyDB(){
  return {
    users: {}, history: [], rewardHistory: [], economyLedger: [], events: [],
    pendingRewardSync: [], aiLearning: normalizeAILearningStore(), pendingAILearningSync: [],
  };
}
let db = emptyDB();
function loadDB(){
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    db = {
      users: parsed.users || {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
      rewardHistory: Array.isArray(parsed.rewardHistory) ? parsed.rewardHistory : [],
      economyLedger: Array.isArray(parsed.economyLedger) ? parsed.economyLedger : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      // 在 Supabase 短暂不可用或进程重启时保留正式奖励，避免已回执给玩家的奖励回档。
      pendingRewardSync: Array.isArray(parsed.pendingRewardSync) ? parsed.pendingRewardSync : [],
      aiLearning: normalizeAILearningStore(parsed.aiLearning),
      pendingAILearningSync: Array.isArray(parsed.pendingAILearningSync) ? parsed.pendingAILearningSync : [],
    };
  } catch { db = emptyDB(); }
  db.pendingRewardSync = db.pendingRewardSync.filter(item => item && item.uid && item.row && item.row.resultId).slice(-10000);
  db.pendingAILearningSync = db.pendingAILearningSync.filter(item => item && item.uid && item.resultId && item.model &&
    Array.isArray(item.experiences) && item.experiences.length).slice(-5000);
  for (const [uid, u] of Object.entries(db.users)){
    u.uid = u.uid || uid;
    if (u.coins === undefined) u.coins = u.points || 0;
    delete u.points;
    if (!u.played) u.played = {};
    if (!u.total) u.total = 0;
    u.owned = normalizeOwned(u.owned);
    u.gameCosmetics = normalizeGameCosmetics(u.gameCosmetics);
    if (!Array.isArray(u.achievements)) u.achievements = [];
    if (!u.playmates || typeof u.playmates !== 'object') u.playmates = {};
    if (!u.daily || typeof u.daily !== 'object') u.daily = { play: 0, win: 0, streak: 0 };
    u.authTokens = normalizeAuthTokenRecords(u.authTokens);
    if (!Array.isArray(u.recentResults)) u.recentResults = [];
    u.recentResults = u.recentResults.map(String).slice(-500);
    if (!Array.isArray(u.purchaseRequests)) u.purchaseRequests = [];
    u.purchaseRequests = u.purchaseRequests.map(String).slice(-100);
    if (!Array.isArray(u.soloRate)) u.soloRate = [];
    u.soloRate = u.soloRate.map(Number).filter(Number.isFinite).filter(t => Date.now() - t < 3600000).slice(-100);
    normalizeUserRewardState(u);
    if (!u.totalWins && !Object.keys(u.wins || {}).length){
      const seen = new Set();
      for (const [index, row] of db.history.entries()){
        if (!row || row.uid !== uid || row.eligible === false || !(row.result === 'win' || (!row.result && Number(row.coins) > 0))) continue;
        const key = String(row.resultId || row.matchId || ('legacy:' + index));
        if (seen.has(key)) continue;
        seen.add(key);
        const game = VALID_GAMES.includes(row.game) ? row.game : null;
        if (game) u.wins[game] = (u.wins[game] || 0) + 1;
      }
      u.totalWins = [...seen].length;
    }
  }
}
function saveDB(){
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  const users = Object.fromEntries(Object.entries(db.users).filter(([, u]) => !u.ephemeral));
  const history = db.history.filter(h => !h.ephemeral && (!db.users[h.uid] || !db.users[h.uid].ephemeral));
  const rewardHistory = db.rewardHistory.filter(h => !h.ephemeral && (!db.users[h.uid] || !db.users[h.uid].ephemeral));
  const economyLedger = db.economyLedger.filter(h => !h.ephemeral && (!db.users[h.uid] || !db.users[h.uid].ephemeral));
  const events = db.events.filter(h => !h.uid || !db.users[h.uid] || !db.users[h.uid].ephemeral);
  const pendingRewardSync = (db.pendingRewardSync || []).filter(item => item && !item.ephemeral &&
    (!db.users[item.uid] || !db.users[item.uid].ephemeral));
  const pendingAILearningSync = (db.pendingAILearningSync || []).filter(item => item && !item.ephemeral &&
    (!db.users[item.uid] || !db.users[item.uid].ephemeral));
  fs.writeFileSync(tmp, JSON.stringify({ users, history, rewardHistory, economyLedger, events,
    pendingRewardSync, aiLearning: db.aiLearning, pendingAILearningSync }, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function trimAuditData(){
  if (db.history.length > 10000) db.history = db.history.slice(-5000);
  if (db.rewardHistory.length > 50000) db.rewardHistory = db.rewardHistory.slice(-25000);
  if (db.economyLedger.length > 10000) db.economyLedger = db.economyLedger.slice(-5000);
  if (db.events.length > 20000) db.events = db.events.slice(-10000);
  db.aiLearning.experiences = db.aiLearning.experiences.slice(-20000);
  db.aiLearning.appliedResults = db.aiLearning.appliedResults.slice(-50000);
}
function recordAnalytics(event, meta = {}){
  const row = {
    event: String(event || ''),
    uid: meta.uid || null,
    matchId: meta.matchId || null,
    game: meta.game || null,
    mode: meta.mode || null,
    metadata: meta.metadata && typeof meta.metadata === 'object' ? meta.metadata : {},
    at: Number(meta.at) || Date.now(),
    ephemeral: !!(meta.uid && db.users[meta.uid] && db.users[meta.uid].ephemeral),
  };
  if (!row.event) return null;
  db.events.push(row);
  trimAuditData();
  sbAddAnalyticsEvents(row);
  return row;
}
function recordEconomyChange(u, kind, amount, refId, metadata, syncRemote = true){
  amount = Math.trunc(Number(amount) || 0);
  if (!u || !amount) return null;
  const row = {
    uid: u.uid,
    kind: String(kind || 'adjustment'),
    amount,
    balanceAfter: u.coins || 0,
    refId: refId || null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    at: Date.now(),
    ephemeral: !!u.ephemeral,
  };
  db.economyLedger.push(row);
  trimAuditData();
  if (syncRemote) sbAddEconomyLedger(row);
  recordAnalytics(amount > 0 ? 'currency_earned' : 'currency_spent', {
    uid: u.uid,
    mode: metadata && metadata.mode,
    game: metadata && metadata.game,
    matchId: metadata && metadata.matchId,
    metadata: { amount, balanceAfter: row.balanceAfter, kind: row.kind, refId: row.refId },
  });
  return row;
}
function leaderboardPayload(){
  const onlineUids = new Set();
  const now = Date.now();
  for (const s of sessions) if (s.uid && s.alive && now - s.lastSeen < HEARTBEAT_TIMEOUT_MS) onlineUids.add(s.uid);
  const list = Object.keys(db.users).filter(uid => !db.users[uid].ephemeral)
    .map(uid => {
      const u = db.users[uid];
      return {
        uid, name: u.name, avatar: u.avatar,
        background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
        coins: u.coins || 0, xp: u.xp || 0, level: u.level || 1, streak: u.streak || 0, bestStreak: u.bestStreak || 0, played: u.played || {}, total: u.total || 0, wins: u.wins || {}, totalWins: u.totalWins || 0, lang: u.lang || 'zh-CN', online: onlineUids.has(uid),
        achievements: u.achievements || [], nameFx: u.nameFx || 0,
      };
    })
    .sort((a, b) => (b.coins - a.coins) || (b.total - a.total) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 200);
  return { list, total: Object.values(db.users).filter(u => !u.ephemeral).length };
}
function broadcastLeaderboard(){
  const payload = leaderboardPayload();
  for (const s of sessions) s.sendText(JSON.stringify({ type: 'leaderboard', payload }));
}
function lobbyPayload(){
  const list = [];
  for (const r of rooms.values()){
    if ([...r.clients.keys()].some(c => !c.alive || Date.now() - c.lastSeen >= HEARTBEAT_TIMEOUT_MS)) continue;
    const joinLimit = r.game && GAME_MAX[r.game] ? Math.min(r.capacity, GAME_MAX[r.game]) : r.capacity;
    const joinable = !r.started && r.clients.size < joinLimit;
    const spectatable = !!r.started && (r.spectators ? r.spectators.size : 0) < (r.maxSpectators || 0);
    if (!joinable && !spectatable) continue;
    const hu = r.host.uid ? db.users[r.host.uid] : null;
    list.push({
      room: r.id,
      hostUid: r.host.uid || null,
      hostName: hu ? hu.name : '玩家',
      hostAvatar: hu ? hu.avatar : 0,
      hostLang: hu ? (hu.lang || 'zh-CN') : 'zh-CN',
      capacity: r.capacity,
      size: r.clients.size,
      game: r.game || null,
      started: !!r.started,
      joinable,
      spectatable,
      spectatorCount: r.spectators ? r.spectators.size : 0,
      maxSpectators: r.maxSpectators || 0,
      matchId:r.matchId || null,
    });
  }
  return list;
}
function broadcastLobby(){
  const text = JSON.stringify({ type: 'lobby', payload: lobbyPayload() });
  for (const s of sessions) s.sendText(text);
}
function roomPayload(r){
  const now = Date.now();
  const players = [...r.clients.entries()]
    .map(([c, p]) => ({ uid: c.uid || null, player: p, online: c.alive !== false && now - c.lastSeen < HEARTBEAT_TIMEOUT_MS }))
    .sort((a, b) => a.player - b.player);
  return { room: r.id, game: r.game || null, capacity: r.capacity, players, size: r.clients.size, onlineSize: players.filter(p => p.online).length, started: !!r.started, settled:!!r.settled, matchId: r.matchId || null, gameplay: gameplayMetadata(r), spectatorCount:r.spectators ? r.spectators.size : 0, maxSpectators:r.maxSpectators || 0 };
}
function tetrisPresentationPayload(r){
  if(!(r&&r.tetrisPresentation instanceof Map))return[];
  return[...r.tetrisPresentation.entries()].map(([player,entry])=>({
    player,
    matchId:r.matchId,
    seq:Number(entry&&entry.seq)||0,
    updatedAt:Number(entry&&entry.updatedAt)||0,
    state:entry&&entry.state?entry.state:entry,
  })).filter(item=>item.seq>0&&item.state);
}
function broadcastRoom(r){
  const text = JSON.stringify({ type: 'room_update', payload: roomPayload(r) });
  for (const c of r.clients.keys()) c.sendText(text);
  if (r.spectators) for (const c of r.spectators.keys()) c.sendText(text);
}
function resumeKey(uid, tokenHash){ return String(uid || '') + '|' + String(tokenHash || ''); }
function clearExpiredResumes(){
  const now = Date.now();
  for (const [key, value] of expiredResumes) if (!value || value.expiresAt <= now) expiredResumes.delete(key);
}
function cleanupEphemeralUser(uid){
  const u = uid && db.users[uid];
  if (!u || !u.ephemeral) return;
  const active = [...sessions].some(s => s.uid === uid && s.alive);
  const reserved = [...rooms.values()].some(r => [...r.clients.keys()].some(s => s.uid === uid));
  if (active || reserved) return;
  delete db.users[uid];
  db.history = db.history.filter(h => h.uid !== uid);
  db.rewardHistory = db.rewardHistory.filter(h => h.uid !== uid);
  db.economyLedger = db.economyLedger.filter(h => h.uid !== uid);
  db.events = db.events.filter(h => h.uid !== uid);
  for (const key of Object.keys(db.aiLearning.models || {})) if (key.startsWith(uid + '|')) delete db.aiLearning.models[key];
  db.aiLearning.experiences = (db.aiLearning.experiences || []).filter(row => row.uid !== uid);
  db.aiLearning.appliedResults = (db.aiLearning.appliedResults || []).filter(key => !String(key).startsWith(uid + '|'));
  db.pendingAILearningSync = (db.pendingAILearningSync || []).filter(item => item.uid !== uid);
  saveDB();
}
function resetRoomMatch(r){
  stopRoomAuthorities(r);
  r.started = false;
  r.matchId = null;
  r.resultClaims = new Map();
  r.settled = false;
  r.disputed = false;
  r.moveSeq = 0;
  r.moveLog = [];
  r.moveLogBytes = 0;
  r.moveLogTruncated = false;
  r.tankInputSeq = {};
  r.tankAuthoritySeq = 0;
  r.tankFinalSent = false;
  r.startedAt = 0;
  r.rewardProgress = null;
  r.resultRewards = new Map();
  r.gameplay = null;
  r.gameSnapshot = null;
  r.tetrisPresentation = new Map();
  r.tournamentBinding = null;
  r.finalResult = null;
  r.tetrisRuleAuthority = null;
  r.xiangqiRuleAuthority = null;
  r.monopolyRuleAuthority = null;
}
function compactRoomPlayers(r){
  if (!r || !r.clients) return;
  const entries = [...r.clients.entries()].sort((a, b) => a[1] - b[1]);
  entries.forEach(([session, oldPlayer], player) => {
    r.clients.set(session, player);
    session.player = player;
    if (oldPlayer !== player) session.sendText(JSON.stringify({ type: 'player_reassigned', payload: { player } }));
  });
}
function allRoomClientsOnline(r){
  const now = Date.now();
  return !!r && [...r.clients.keys()].every(c => c.alive && now - c.lastSeen < HEARTBEAT_TIMEOUT_MS);
}
function expireDetachedSession(r, oldSession){
  if (!r || !r.clients.has(oldSession) || oldSession.alive !== false) return;
  const player = r.clients.get(oldSession);
  const uid = oldSession.uid;
  if (r.tankAuthority && typeof r.tankAuthority.clearDisconnectedInput === 'function') {
    r.tankAuthority.clearDisconnectedInput(player);
  }
  const wasHost = r.host === oldSession;
  if (r.started && !r.settled) settleRoomForfeit(r, oldSession, 'afk');
  r.clients.delete(oldSession);
  oldSession.room = null;
  oldSession.player = null;
  oldSession.resumeUntil = 0;
  oldSession.reconnectTimer = null;
  expiredResumes.set(resumeKey(uid, oldSession.tokenHash), {
    room: r.id, player, expiresAt: Date.now() + EXPIRED_RESUME_TTL_MS,
  });
  if (!r.clients.size){
    stopRoomAuthorities(r);
    if(r.spectators)for(const spectator of r.spectators.keys()){spectatorAccessGuard.leave(spectator.sessionId);spectator.spectatorRoom=null;spectator.sendText(JSON.stringify({type:'peer_left',payload:{roomClosed:true}}));}
    rooms.delete(r.id); cleanupEphemeralUser(uid); broadcastLobby(); return;
  }
  let hostChanged = false;
  if (wasHost){
    const next = [...r.clients.entries()].sort((a, b) => {
      const onlineDiff = Number(a[0].alive === false) - Number(b[0].alive === false);
      return onlineDiff || a[1] - b[1];
    })[0];
    r.host = next[0];
    hostChanged = true;
  }
  resetRoomMatch(r);
  compactRoomPlayers(r);
  broadcast(r, { type: 'reconnect_expired', payload: { uid, player, hostPlayer: r.clients.get(r.host), hostChanged } });
  if (hostChanged) broadcast(r, { type: 'host_changed', payload: { uid: r.host.uid, player: r.clients.get(r.host) } });
  broadcastRoom(r);
  broadcastLobby();
  cleanupEphemeralUser(uid);
}
function detachForReconnect(session){
  if (!session.room || !session.uid || !session.tokenHash) return false;
  const r = rooms.get(session.room);
  if (!r || !r.started || !r.clients.has(session)) return false;
  session.detachedAt = Date.now();
  session.resumeUntil = session.detachedAt + RECONNECT_GRACE_MS;
  // A disconnected Tank must stop receiving the last held input while the
  // reconnect grace window is open.  The authority will accept fresh input
  // only after the player has resumed with a live authenticated session.
  if (r.tankAuthority && typeof r.tankAuthority.clearDisconnectedInput === 'function') {
    r.tankAuthority.clearDisconnectedInput(session.player);
  }
  session.reconnectTimer = setTimeout(() => expireDetachedSession(r, session), RECONNECT_GRACE_MS);
  if (session.reconnectTimer && session.reconnectTimer.unref) session.reconnectTimer.unref();
  broadcast(r, { type: 'peer_status', payload: { uid: session.uid, player: session.player, online: false, resumeUntil: session.resumeUntil } }, session);
  broadcastRoom(r);
  return true;
}
function tryResumeSession(session){
  if (!session.uid || !session.tokenHash) return false;
  clearExpiredResumes();
  const now = Date.now();
  for (const r of rooms.values()){
    for (const [oldSession, player] of r.clients){
      if (oldSession.alive !== false || oldSession.uid !== session.uid || oldSession.resumeUntil <= now) continue;
      if (!secureEqual(oldSession.tokenHash, session.tokenHash)) continue;
      if (oldSession.reconnectTimer) clearTimeout(oldSession.reconnectTimer);
      oldSession.reconnectTimer = null;
      r.clients.delete(oldSession);
      r.clients.set(session, player);
      if (r.host === oldSession) r.host = session;
      session.room = r.id;
      session.player = player;
      session.resumeUntil = 0;
      const hasAuthoritySnapshot = !!(r.tankAuthority || r.tetrisAuthority || r.tetrisRuleAuthority || r.xiangqiRuleAuthority || r.monopolyRuleAuthority);
      const replayUnavailable = !!(r.started && r.moveLogTruncated && !hasAuthoritySnapshot);
      if (replayUnavailable) resetRoomMatch(r);
      const payload = {
        ...roomPayload(r),
        player,
        isHost: r.host === session,
        moveSeq: r.moveSeq || 0,
        moveLog: (r.moveLog || []).map(e => ({ seq: e.seq, player: e.player, payload: e.payload })),
        gameplay: gameplayMetadata(r),
        presentation:gameplayPresentation(r),
        tankSnapshot: r.tankAuthority ? r.tankAuthority.snapshot(now) : null,
        tetrisSnapshot: r.tetrisAuthority ? r.tetrisAuthority.snapshot() : null,
        tetrisRuleSnapshot: r.tetrisRuleAuthority ? r.tetrisRuleAuthority.snapshot(now) : null,
        tetrisPresentation:tetrisPresentationPayload(r),
        xiangqiRuleSnapshot:r.xiangqiRuleAuthority ? r.xiangqiRuleAuthority.snapshot(now) : null,
        monopolyRuleSnapshot:r.monopolyRuleAuthority ? r.monopolyRuleAuthority.snapshot(now) : null,
        finalResult:r.finalResult || null,
      };
      session.sendText(JSON.stringify({ type: 'rejoined', payload }));
      if (replayUnavailable){
        broadcast(r, { type: 'reconnect_expired', payload: { uid: session.uid, player, reason: 'history_unavailable' } });
      } else {
        broadcast(r, { type: 'peer_status', payload: { uid: session.uid, player, online: true } }, session);
      }
      broadcastRoom(r);
      return true;
    }
  }
  const expired = expiredResumes.get(resumeKey(session.uid, session.tokenHash));
  if (expired){
    expiredResumes.delete(resumeKey(session.uid, session.tokenHash));
    session.sendText(JSON.stringify({ type: 'resume_expired', payload: { room: expired.room, player: expired.player } }));
  }
  return false;
}
function maybeAutoStart(r){
  if (r.game && !r.started && r.clients.size === r.capacity && allRoomClientsOnline(r)){
    startRoomMatch(r);
  }
}
function genCode(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function genUid(){
  return 'u_' + crypto.randomBytes(6).toString('hex');
}
function normalizedPin(pin){ return String(pin).trim().toLowerCase(); }
function hashPin(pin){
  const digest = crypto.scryptSync(normalizedPin(pin), 'mini-games-pin-v2', 32);
  return 's2$' + digest.toString('base64url');
}
function legacyPinHash(pin){
  return crypto.createHash('sha256').update('mg-pin:' + normalizedPin(pin)).digest('hex');
}
function validPin(pin){
  return /^[A-Za-z0-9]{4,20}$/.test(String(pin).trim());
}
function secureEqual(a, b){
  const aa = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}
function pinMatches(u, pin, currentHash, oldHash){
  const stored = String((u && u.pin_hash) || '');
  return secureEqual(stored, currentHash || hashPin(pin)) || secureEqual(stored, oldHash || legacyPinHash(pin));
}
function hashToken(token){
  return crypto.createHash('sha256').update('mg-auth:' + String(token || '')).digest('base64url');
}
const AUTH_TOKEN_TTL_MS = Math.max(3600000, Math.min(365 * 86400000, Number(process.env.AUTH_TOKEN_TTL_MS) || 30 * 86400000));
function authTokenRecord(tokenHash, issuedAt){ return 't2$' + (issuedAt || Date.now()) + '$' + tokenHash; }
function parseAuthTokenRecord(value){
  const text = String(value || '');
  const match = /^t2\$(\d{10,16})\$([A-Za-z0-9_-]{40,100})$/.exec(text);
  if (match) return { issuedAt: Number(match[1]), hash: match[2] };
  return /^[A-Za-z0-9_-]{40,100}$/.test(text) ? { issuedAt: 0, hash: text } : null;
}
function normalizeAuthTokenRecords(values){
  const now = Date.now();
  const out = [];
  for (const value of (Array.isArray(values) ? values : [])){
    const parsed = parseAuthTokenRecord(value);
    if (!parsed) continue;
    const issuedAt = parsed.issuedAt || now; // 旧格式在首次迁移时获得一个完整有效期，随后持久化时间戳。
    if (now - issuedAt <= AUTH_TOKEN_TTL_MS) out.push(authTokenRecord(parsed.hash, issuedAt));
  }
  return out.slice(-5);
}
function issueAuthToken(u){
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  u.authTokens = normalizeAuthTokenRecords(u.authTokens)
    .filter(record => {
      const parsed = parseAuthTokenRecord(record);
      return !parsed || !secureEqual(parsed.hash, tokenHash);
    })
    .concat(authTokenRecord(tokenHash)).slice(-5);
  return { token, tokenHash };
}
function userHasToken(u, token){
  if (!u || !token || !Array.isArray(u.authTokens)) return false;
  const h = hashToken(token);
  u.authTokens = normalizeAuthTokenRecords(u.authTokens);
  return u.authTokens.some(v => {
    const parsed = parseAuthTokenRecord(v);
    return !!parsed && secureEqual(parsed.hash, h);
  });
}
function userHasTokenHash(u, tokenHash){
  if (!u || !tokenHash || !Array.isArray(u.authTokens)) return false;
  u.authTokens = normalizeAuthTokenRecords(u.authTokens);
  return u.authTokens.some(v => {
    const parsed = parseAuthTokenRecord(v);
    return !!parsed && secureEqual(parsed.hash, tokenHash);
  });
}
function userForToken(token){
  if (!token) return null;
  for (const u of Object.values(db.users)) if (userHasToken(u, token)) return u;
  return null;
}
function authenticateHttp(req){
  const value = String((req.headers && req.headers.authorization) || '');
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,200})$/i.exec(value);
  return m ? userForToken(m[1]) : null;
}

const SHOP_PRICES = {
  // 入门装扮从 10💵 起，避免一场首胜立刻清空商城消耗；价格仅由服务端决定。
  avatars: { 30:10,31:12,32:12,33:15,34:18,35:18,36:10,37:10,38:12,39:12,40:15,41:18,42:12,43:12,44:15,45:15,46:18,47:18,48:12,49:15,50:15,51:18,52:22,53:22,54:12,55:30 },
  frames: { 1:10,2:12,3:16,4:20,5:24,6:28,7:32,8:36 },
  effects: { 1:10,2:12,3:12,4:20 },
  backgrounds: { 1:10,2:10,3:10,4:12,5:12,6:15,7:18,8:18,9:22,10:20 },
};
function validOwnedId(kind, id){
  if (!Number.isInteger(id)) return false;
  if (kind === 'avatars' && id >= 0 && id < 30) return true;
  if (id === 0 && kind !== 'avatars') return true;
  return !!(SHOP_PRICES[kind] && Object.prototype.hasOwnProperty.call(SHOP_PRICES[kind], id));
}
function ownsItem(u, kind, id){
  if (kind === 'avatars' && id >= 0 && id < 30) return true;
  if (id === 0 && kind !== 'avatars') return true;
  return !!(u && u.owned && Array.isArray(u.owned[kind]) && u.owned[kind].includes(id));
}
function profileObj(u){
  normalizeUserRewardState(u);
  return {
    uid: u.uid, name: u.name, avatar: u.avatar,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: u.owned || { avatars: [], frames: [], effects: [], backgrounds: [] },
    cosmeticSchemaVersion: 1, gameCosmetics: normalizeGameCosmetics(u.gameCosmetics),
    coins: u.coins || 0, xp: u.xp || 0, level: u.level || 1, streak: u.streak || 0, bestStreak: u.bestStreak || 0,
    played: u.played || {}, total: u.total || 0, wins: u.wins || {}, totalWins: u.totalWins || 0, lang: u.lang || 'zh-CN',
    achievements: u.achievements || [], playmates: u.playmates || {}, daily: u.daily || { play: 0, win: 0, streak: 0 }, nameFx: u.nameFx || 0,
    dailyFirstWinDate: u.dailyFirstWinDate || '',
    dailyAICurrencyKey: u.dailyAICurrencyKey || '',
    dailyAICurrencyEarned: u.dailyAICurrencyEarned || 0,
    xpProgress: levelProgress(u.xp || 0),
  };
}
function publicProfileObj(u){
  const p = profileObj(u);
  delete p.owned;
  delete p.playmates;
  delete p.daily;
  delete p.dailyFirstWinDate;
  delete p.dailyAICurrencyKey;
  delete p.dailyAICurrencyEarned;
  return p;
}
function normalizeOwned(o){
  const base = { avatars: Array.from({ length: 30 }, (_, i) => i), frames: [0], effects: [0], backgrounds: [0] };
  if (o && typeof o === 'object'){
    for (const k of Object.keys(base)){
      if (Array.isArray(o[k])){
        const merged = base[k].concat(o[k].map(Number).filter(id => validOwnedId(k, id)));
        base[k] = [...new Set(merged)].slice(0, 100);
      }
    }
  }
  return base;
}
function normalizeGameCosmetics(value){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const choose=(input,allowed,fallback)=>allowed.includes(input)?input:fallback;
  return{
    gomoku:{pieceSkin:choose(source.gomoku&&source.gomoku.pieceSkin,['classic','glow'],'classic')},
    ludo:{baseSkin:choose(source.ludo&&source.ludo.baseSkin,['classic','cyber'],'classic'),pieceSkin:choose(source.ludo&&source.ludo.pieceSkin,['classic','jet'],'classic'),diceSkin:choose(source.ludo&&source.ludo.diceSkin,['classic','cyber'],'classic')},
    monopoly:{tokenSkin:choose(source.monopoly&&source.monopoly.tokenSkin,['character','car'],'character')},
    tank:{tankSkin:choose(source.tank&&source.tank.tankSkin,['classic','cyber'],'classic')},
    tetris:{blockSkin:choose(source.tetris&&source.tetris.blockSkin,['classic','neon'],'classic'),backgroundSkin:choose(source.tetris&&source.tetris.backgroundSkin,['classic','grid'],'classic')},
    xiangqi:{pieceSkin:choose(source.xiangqi&&source.xiangqi.pieceSkin,['classic','jade'],'classic')},
  };
}
loadDB();

const authFailures = new Map();
const registrationRate = new Map();
let authHashTimes = [];
const AUTH_HASHES_PER_MINUTE = Math.max(30, Number(process.env.AUTH_HASHES_PER_MINUTE) || 180);
function allowAuthHash(){
  const now = Date.now();
  authHashTimes = authHashTimes.filter(t => now - t < 60000);
  if (authHashTimes.length >= AUTH_HASHES_PER_MINUTE) return false;
  authHashTimes.push(now);
  return true;
}
function authRetryAfter(ip){
  const now = Date.now();
  const rec = authFailures.get(ip);
  if (!rec) return 0;
  if (rec.resetAt <= now){ authFailures.delete(ip); return 0; }
  return rec.blockedUntil > now ? Math.ceil((rec.blockedUntil - now) / 1000) : 0;
}
function noteAuthFailure(ip){
  const now = Date.now();
  const rec = authFailures.get(ip) || { count: 0, resetAt: now + 10 * 60000, blockedUntil: 0 };
  if (rec.resetAt <= now){ rec.count = 0; rec.resetAt = now + 10 * 60000; }
  rec.count++;
  if (rec.count >= 5) rec.blockedUntil = now + Math.min(60000, 1000 * Math.pow(2, Math.min(6, rec.count - 5)));
  authFailures.set(ip, rec);
}
function clearAuthFailures(ip){ authFailures.delete(ip); }
function allowRegistration(ip){
  const now = Date.now();
  const list = (registrationRate.get(ip) || []).filter(t => now - t < 3600000);
  if (list.length >= 30) return false;
  list.push(now); registrationRate.set(ip, list); return true;
}
function updateEditableProfile(u, payload){
  if (!u || !payload || typeof payload !== 'object') return;
  if (payload.name !== undefined){
    const name = String(payload.name || '').trim().slice(0, 12);
    if (name) u.name = name;
  }
  if (payload.lang && ['zh-CN','en-US','uk-UA'].includes(payload.lang)) u.lang = payload.lang;
  if (Number.isInteger(payload.avatar) && validOwnedId('avatars', payload.avatar) && ownsItem(u, 'avatars', payload.avatar)) u.avatar = payload.avatar;
  if (Number.isInteger(payload.background) && validOwnedId('backgrounds', payload.background) && ownsItem(u, 'backgrounds', payload.background)) u.background = payload.background;
  if (Number.isInteger(payload.frame) && validOwnedId('frames', payload.frame) && ownsItem(u, 'frames', payload.frame)) u.frame = payload.frame;
  if (Number.isInteger(payload.effect) && validOwnedId('effects', payload.effect) && ownsItem(u, 'effects', payload.effect)) u.effect = payload.effect;
  if (Number.isInteger(payload.nameFx) && payload.nameFx >= 0 && payload.nameFx <= 4) u.nameFx = payload.nameFx;
  if (payload.gameCosmetics !== undefined) u.gameCosmetics = normalizeGameCosmetics(payload.gameCosmetics);
}
function addServerAchievement(u, id){
  if (!Array.isArray(u.achievements)) u.achievements = [];
  if (!u.achievements.includes(id)) u.achievements.push(id);
}
function updateServerAchievements(u){
  if ((u.totalWins || 0) >= 1) addServerAchievement(u, 'first_win');
  if ((u.totalWins || 0) >= 10) addServerAchievement(u, 'win_10');
  if ((u.totalWins || 0) >= 50) addServerAchievement(u, 'win_50');
  if ((u.bestStreak || 0) >= 3) addServerAchievement(u, 'streak_3');
  if ((u.bestStreak || 0) >= 5) addServerAchievement(u, 'streak_5');
  if ((u.level || 1) >= 5) addServerAchievement(u, 'level_5');
  if (Object.keys(u.played || {}).filter(k => u.played[k] > 0).length >= 5) addServerAchievement(u, 'all_games');
  if (Object.keys(u.playmates || {}).length >= 3) addServerAchievement(u, 'social');
}
function updateServerDaily(u, won){
  const key = new Date().toISOString().slice(0, 10);
  if (u.dailyKey !== key){ u.dailyKey = key; u.daily = { play: 0, win: 0, streak: 0 }; }
  if (!u.daily || typeof u.daily !== 'object') u.daily = { play: 0, win: 0, streak: 0 };
  u.daily.play = (u.daily.play || 0) + 1;
  if (won) u.daily.win = (u.daily.win || 0) + 1;
  u.daily.streak = Math.max(u.daily.streak || 0, u.streak || 0);
}
function recordServerPlaymate(u, other, game){
  if (!u || !other || !other.uid || other.uid === u.uid) return;
  if (!u.playmates || typeof u.playmates !== 'object') u.playmates = {};
  const pm = u.playmates[other.uid] || { name: other.name || '玩家', count: 0, lastAt: 0, games: {} };
  pm.name = other.name || pm.name;
  pm.count = (pm.count || 0) + 1;
  pm.lastAt = Date.now();
  if (!pm.games || typeof pm.games !== 'object') pm.games = {};
  pm.games[game] = (pm.games[game] || 0) + 1;
  u.playmates[other.uid] = pm;
}
function opponentGroupKey(uids){
  return [...new Set((Array.isArray(uids) ? uids : []).map(String).filter(Boolean))].sort().join('|');
}
function repeatOpponentCount(uid, opponentKey, now){
  if (!uid || !opponentKey) return 0;
  const cutoff = now - REWARD_CONFIG.repeatOpponent.windowMs;
  return db.rewardHistory.filter(row => row && row.uid === uid && row.mode === 'online' && row.eligible !== false &&
    row.opponentKey === opponentKey && Number(row.at || 0) >= cutoff).length;
}
function roomProgress(r){
  if (!r.rewardProgress){
    const startedAt = r.startedAt || Date.now();
    r.rewardProgress = { startedAt, lastActionAt: startedAt, meaningfulActions: 0, byPlayer: {}, uniqueActions: new Set() };
  }
  if (!(r.rewardProgress.uniqueActions instanceof Set)){
    r.rewardProgress.uniqueActions = new Set(Array.isArray(r.rewardProgress.uniqueActions) ? r.rewardProgress.uniqueActions : []);
  }
  if (!r.rewardProgress.byPlayer || typeof r.rewardProgress.byPlayer !== 'object') r.rewardProgress.byPlayer = {};
  return r.rewardProgress;
}
function recordRoomAction(r, player, payload){
  if (!r || !meaningfulAction(r.game, payload)) return false;
  const progress = roomProgress(r);
  progress.meaningfulActions++;
  progress.lastActionAt = Date.now();
  progress.byPlayer[player] = (progress.byPlayer[player] || 0) + 1;
  const fingerprint = actionFingerprint(r.game, player, payload);
  if (fingerprint) progress.uniqueActions.add(fingerprint);
  return true;
}
function roomRewardEligibility(r, now){
  const progress = roomProgress(r);
  return evaluateEligibility({
    gameId: r.game,
    mode: 'online',
    matchId: r.matchId,
    resultId: r.matchId + ':room',
    identitiesValid: [...r.clients.keys()].every(session => !!(session.uid && db.users[session.uid])),
    consensusValid: !r.disputed,
    durationMs: Math.max(0, now - Number(progress.startedAt || r.startedAt || now)),
    meaningfulActions: progress.meaningfulActions || 0,
    uniqueActions: progress.uniqueActions.size,
    distinctActors: Object.values(progress.byPlayer).filter(count => Number(count) > 0).length,
    thresholdOverrides: rewardThresholdOverrides(),
  });
}
function playerResult(results, mine, participantCount){
  if (!mine) return 'loss';
  if (participantCount <= 2){
    const winners = results.filter(item => item.coins === 1 || (item.result === 'win'));
    const draw = winners.length === 0 && results.every(item => item.rank === results[0].rank);
    if (draw) return 'draw';
    return mine.coins === 1 || mine.result === 'win' || (mine.rank === 1 && winners.length === 0) ? 'win' : 'loss';
  }
  return mine.rank === 1 || mine.coins === 1 || mine.result === 'win' ? 'win' : 'loss';
}
function rewardRowFrom(u, reward, meta){
  return {
    uid: u.uid,
    game: reward.gameId,
    coins: reward.currency || 0,
    xp: reward.xp || 0,
    at: Number(meta.at) || Date.now(),
    resultId: meta.resultId || null,
    matchId: meta.matchId || null,
    mode: reward.mode,
    result: reward.result,
    placement: reward.placement,
    opponentIds: meta.opponentIds || [],
    opponentKey: meta.opponentKey || '',
    durationMs: meta.durationMs || 0,
    meaningfulActions: meta.meaningfulActions || 0,
    eligible: reward.eligible,
    blockedReason: reward.blockedReason || null,
    baseCurrency: reward.baseCurrency || 0,
    baseXp: reward.baseXp || 0,
    rewardReasons: reward.rewardReasons || [],
    levelBefore: reward.levelBefore,
    levelAfter: reward.levelAfter,
    streakBefore: reward.streakBefore,
    streakAfter: reward.streakAfter,
    breakdown: reward.breakdown || [],
    reward,
    ephemeral: !!u.ephemeral,
  };
}
function applyResolvedProgress(u, reward, meta){
  normalizeUserRewardState(u);
  if (useSupabase && u && !u.ephemeral) ensureSupabaseRuntimeState(u);
  if (reward.eligible){
    u.coins = (u.coins || 0) + (reward.currency || 0);
    if (useSupabase && !u.ephemeral && reward.currency){
      // 记录本进程已向玩家确认的奖励增量；购买 RPC 回调合并时可避免
      // 用数据库旧余额覆盖一笔正在排队的奖励。
      u._supabaseLocalRewardCurrency = (Number(u._supabaseLocalRewardCurrency) || 0) + (Number(reward.currency) || 0);
    }
    u.xp = reward.xpAfter;
    u.level = reward.levelAfter;
    u.streak = reward.streakAfter;
    u.bestStreak = reward.bestStreakAfter;
    u.dailyFirstWinDate = reward.dailyFirstWinDateAfter;
    u.dailyAICurrencyKey = reward.dailyAICurrencyKeyAfter;
    u.dailyAICurrencyEarned = reward.dailyAICurrencyEarnedAfter;
    u.xpCurveVersion = REWARD_CONFIG.level.curveVersion;
    if (!u.played) u.played = {};
    u.played[reward.gameId] = (u.played[reward.gameId] || 0) + 1;
    u.total = (u.total || 0) + 1;
    if (reward.result === 'win'){
      if (!u.wins || typeof u.wins !== 'object') u.wins = {};
      u.wins[reward.gameId] = (u.wins[reward.gameId] || 0) + 1;
      u.totalWins = (u.totalWins || 0) + 1;
    }
    updateServerDaily(u, reward.result === 'win');
    updateServerAchievements(u);
  } else if (reward.blockedReason === 'afk') {
    u.streak = reward.streakAfter;
  }
  if (meta.resultId){
    u.recentResults = Array.isArray(u.recentResults) ? u.recentResults : [];
    if (!u.recentResults.includes(meta.resultId)) u.recentResults = u.recentResults.concat(meta.resultId).slice(-500);
  }
  const row = rewardRowFrom(u, reward, meta);
  db.history.push(row);
  db.rewardHistory.push(row);
  if (reward.currency) row.economyRow = recordEconomyChange(u, 'match_reward', reward.currency, meta.resultId, {
    game: reward.gameId, mode: reward.mode, matchId: meta.matchId || null, result: reward.result,
    rewardReasons: reward.rewardReasons,
  }, false);
  recordAnalytics(reward.eligible ? 'reward_granted' : 'reward_blocked', {
    uid: u.uid,
    matchId: meta.matchId,
    game: reward.gameId,
    mode: reward.mode,
    metadata: { resultId: meta.resultId, currency: reward.currency, xp: reward.xp, reason: reward.blockedReason || null },
  });
  if (reward.repeatTier === 'reduced' || reward.repeatTier === 'exhausted' || reward.breakdown.some(item => item.code === 'ai_daily_cap')){
    recordAnalytics('reward_reduced', {
      uid: u.uid, matchId: meta.matchId, game: reward.gameId, mode: reward.mode,
      metadata: { resultId: meta.resultId, repeatTier: reward.repeatTier },
    });
  }
  if (reward.dailyFirstWinGranted){
    recordAnalytics('daily_first_win', { uid: u.uid, matchId: meta.matchId, game: reward.gameId, mode: reward.mode });
  }
  if (reward.levelAfter > reward.levelBefore){
    recordAnalytics('level_up', {
      uid: u.uid, matchId: meta.matchId, game: reward.gameId, mode: reward.mode,
      metadata: { from: reward.levelBefore, to: reward.levelAfter },
    });
  }
  trimAuditData();
  return row;
}
function syncRewardRow(u, row){
  if (!useSupabase || !u || !row || u.ephemeral) return Promise.resolve(true);
  // 先写入本地 outbox，再发起远端事务；进程在网络回调前终止也可于下次启动续传。
  const key = String(u.uid) + '|' + String(row.resultId);
  if (!(db.pendingRewardSync || []).some(item => String(item.uid) + '|' + String(item.row && item.row.resultId) === key)){
    db.pendingRewardSync.push({ uid: u.uid, row, queuedAt: Date.now(), ephemeral: !!u.ephemeral });
    saveDB();
  }
  return sbApplyRewardTransaction(u, row).then(ok => {
    if (ok){
      db.pendingRewardSync = (db.pendingRewardSync || []).filter(item =>
        !(String(item.uid) === String(u.uid) && String(item.row && item.row.resultId) === String(row.resultId)));
      saveDB();
    }
    return ok;
  });
}
function retryPendingRewardSync(){
  if (!useSupabase) return Promise.resolve([]);
  const pending = (db.pendingRewardSync || []).slice();
  return Promise.all(pending.map(item => {
    const user = item && db.users[item.uid];
    return user && item.row ? syncRewardRow(user, item.row) : Promise.resolve(false);
  }));
}
async function sbFetchAILearningModel(uid, game){
  if (!useSupabase || !uid || !game) return null;
  const rows = await sbFetch('ai_learning_models?select=*&uid=eq.' + encodeURIComponent(uid) +
    '&game=eq.' + encodeURIComponent(game) + '&limit=1');
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}
/*
 * 多实例/人工补写会让 outbox 携带的 revision 变旧。冲突时从远端模型开始，
 * 按原始“已确认决策”重放当前玩家的待同步结果，重新生成连续 revision；
 * 原始局面不会被写入 outbox 或数据库。旧 outbox 没有 replay 时保守停留，
 * 等人工清理/新版本迁移，避免用旧全量权重覆盖远端较新模型。
 */
async function rebasePendingAILearningGroup(uid, game){
  const remoteRow = await sbFetchAILearningModel(uid, game);
  const remoteStore = normalizeAILearningStore();
  if (remoteRow) loadAILearningModelRows(remoteStore, [remoteRow]);
  const remoteModel = getAILearningModel(remoteStore, uid, game);
  const pending = (db.pendingAILearningSync || []).filter(item => item && item.uid === uid &&
    item.model && item.model.game === game).sort((a, b) =>
    Number(a.queuedAt || 0) - Number(b.queuedAt || 0) || Number(a.model.revision || 0) - Number(b.model.revision || 0));
  if (!pending.length) return true;
  if (!pending.every(item => item.replay && Array.isArray(item.replay.decisions))){
    console.error('Supabase AI 学习 revision 冲突：旧 outbox 缺少 replay，暂不覆盖远端模型');
    return false;
  }
  const rebasedStore = normalizeAILearningStore({
    models: { [uid + '|' + game]: remoteModel }, experiences: [], appliedResults: [],
  });
  const replacements = [];
  for (const item of pending){
    const replay = { ...item.replay, uid, game, resultId: item.resultId,
      decisions: item.replay.decisions.slice(0, 300) };
    const result = applyMatchLearning(rebasedStore, replay);
    if (!result || result.duplicate || !result.model || !Array.isArray(result.experiences)) return false;
    replacements.push({ item, model: JSON.parse(JSON.stringify(result.model)),
      experiences: JSON.parse(JSON.stringify(result.experiences)),
      baseRevision: Number(result.baseRevision) || Math.max(0, Number(result.model.revision || 0) - 1) });
  }
  for (const replacement of replacements){
    replacement.item.model = replacement.model;
    replacement.item.experiences = replacement.experiences;
    replacement.item.baseRevision = replacement.baseRevision;
  }
  const latest = rebasedStore.models[uid + '|' + game];
  const local = db.aiLearning && db.aiLearning.models && db.aiLearning.models[uid + '|' + game];
  if (!local || Number(local.revision || 0) <= Number(latest && latest.revision || 0)){
    db.aiLearning.models[uid + '|' + game] = latest;
  }
  saveDB();
  return true;
}
function drainAILearningGroup(uid, game){
  if (!useSupabase || !uid || !game) return Promise.resolve(false);
  const queueKey = uid + '|' + game;
  if (sbAILearningDrains.has(queueKey)) return sbAILearningDrains.get(queueKey);
  const run = (async () => {
    let allSynced = true;
    let rebased = false;
    while (true){
      const pending = (db.pendingAILearningSync || []).filter(item => item.uid === uid && item.model && item.model.game === game)
        .sort((a, b) => Number(a.model.revision || 0) - Number(b.model.revision || 0));
      const item = pending[0];
      if (!item) break;
      const outcome = await sbApplyAILearningTransaction(item.uid, item.resultId, item.model, item.experiences);
      const ok = outcome === true || !!(outcome && outcome.ok);
      if (!ok){
        if (outcome && outcome.conflict && !rebased){
          rebased = true;
          try {
            if (await rebasePendingAILearningGroup(uid, game)) continue;
          } catch (error) {
            console.error('Supabase AI 学习 revision 重基失败:', error.message);
          }
        }
        allSynced = false;
        break;
      }
      rebased = false;
      db.pendingAILearningSync = db.pendingAILearningSync.filter(entry =>
        !(entry.uid === item.uid && entry.resultId === item.resultId));
      saveDB();
    }
    return allSynced;
  })().finally(() => { if (sbAILearningDrains.get(queueKey) === run) sbAILearningDrains.delete(queueKey); });
  sbAILearningDrains.set(queueKey, run);
  return run;
}
function syncAILearningResult(user, resultId, learning){
  if (!useSupabase || !user || user.ephemeral || !learning || learning.duplicate ||
      !learning.model || !Array.isArray(learning.experiences) || !learning.experiences.length) return Promise.resolve(true);
  const key = user.uid + '|' + resultId;
  if (!(db.pendingAILearningSync || []).some(item => item.uid + '|' + item.resultId === key)){
    db.pendingAILearningSync.push({
      uid: user.uid,
      resultId,
      model: JSON.parse(JSON.stringify(learning.model)),
      experiences: JSON.parse(JSON.stringify(learning.experiences)),
      replay: learning.replay ? JSON.parse(JSON.stringify(learning.replay)) : null,
      baseRevision: Number(learning.baseRevision) || Math.max(0, Number(learning.model.revision || 0) - 1),
      queuedAt: Date.now(),
    });
    db.pendingAILearningSync = db.pendingAILearningSync.slice(-5000);
    saveDB();
  }
  return drainAILearningGroup(user.uid, learning.model.game);
}
function retryPendingAILearningSync(){
  if (!useSupabase) return Promise.resolve([]);
  const groups = new Map();
  for (const item of (db.pendingAILearningSync || [])){
    if (!item || !item.uid || !item.model || !item.model.game) continue;
    groups.set(item.uid + '|' + item.model.game, [item.uid, item.model.game]);
  }
  return Promise.all([...groups.values()].map(([uid, game]) => drainAILearningGroup(uid, game)));
}
function stopRoomAuthorities(r){
  if (!r) return;
  stopRoomGameplayTimer(r);
  r.tankAuthority = null;
  r.tetrisAuthority = null;
  r.xiangqiClock = null;
  r.monopolyAuction = null;
  r.tetrisRuleAuthority = null;
  r.xiangqiRuleAuthority = null;
  r.monopolyRuleAuthority = null;
}
function stopRoomGameplayTimer(r){
  if (!r) return;
  if (r.gameplayTimer) clearInterval(r.gameplayTimer);
  r.gameplayTimer = null;
}
function authoritativeResults(order){
  return order.map((slot, index) => ({ slot, rank:index + 1, coins:index === 0 ? 1 : 0 }));
}
function sessionSupports(session, protocol){
  const values=session&&session.capabilities instanceof Set?[...session.capabilities]:[];
  return values.includes(protocol)||values.includes(String(protocol).replace(/-/g,'_'));
}
const RULE_AUTHORITY_V2_ENABLED=String(process.env.ENABLE_RULE_AUTHORITY_V2||'1')!=='0';
function roomSupports(r, protocol){return RULE_AUTHORITY_V2_ENABLED&&!!r&&[...r.clients.keys()].every(session=>sessionSupports(session,protocol));}
function gameplayMetadata(r){
  if (!r || !r.started) return null;
  if (r.tankAuthority){
    const state = r.tankAuthority.snapshot();
    return { protocol:'tank-authority-v1', serverTick:state.serverTick, startedAt:state.startedAt, endAt:state.endAt, season:state.season };
  }
  if (r.tetrisRuleAuthority){
    const state=r.tetrisRuleAuthority.snapshot();
    return { protocol:PROTOCOL_VERSIONS.tetrisRules,startAt:state.startAt,matchEndAt:state.matchEndAt,matchSeed:state.matchSeed,rulesetVersion:state.rulesetVersion,revision:state.revision };
  }
  if (r.tetrisAuthority){
    const state = r.tetrisAuthority.snapshot();
    return { protocol:'tetris-battle-authority-v1', startAt:state.startAt, matchEndAt:state.matchEndAt, matchSeed:state.matchSeed, rulesetVersion:state.rulesetVersion };
  }
  if (r.xiangqiRuleAuthority) return { protocol:PROTOCOL_VERSIONS.xiangqiRules, rule:r.xiangqiRuleAuthority.snapshot(), clock:r.xiangqiRuleAuthority.snapshot().clock };
  if (r.xiangqiClock) return { protocol:'xiangqi-clock-v1', clock:r.xiangqiClock.snapshot() };
  if (r.monopolyRuleAuthority) return { protocol:PROTOCOL_VERSIONS.monopolyRules, state:r.monopolyRuleAuthority.snapshot() };
  if (r.monopolyAuction) return { protocol:'monopoly-auction-v1', auction:r.monopolyAuction.snapshot() };
  return null;
}
function gameplayPresentation(r){
  if(!r||!r.game)return null;
  const defaults={
    gomoku:{default:'classic'},ludo:{base:'classic',piece:'classic',dice:'classic'},monopoly:{default:'character'},
    tank:{default:'classic'},tetris:{block:'classic',background:'classic'},xiangqi:{default:'classic'},
  };
  const playerDefault={gomoku:'classic',ludo:{base:'classic',piece:'classic',dice:'classic'},monopoly:'character',tank:'classic',tetris:{block:'classic',background:'classic'},xiangqi:'classic'};
  const cosmetic={...(defaults[r.game]||{default:'classic'}),players:{}};
  const players=[...r.clients.entries()].map(([session,player])=>{
    const profile=session.uid&&db.users[session.uid],equipped=normalizeGameCosmetics(profile&&profile.gameCosmetics)[r.game];let value;
    if(r.game==='gomoku')value=equipped.pieceSkin;
    else if(r.game==='ludo')value={base:equipped.baseSkin,piece:equipped.pieceSkin,dice:equipped.diceSkin};
    else if(r.game==='monopoly')value=equipped.tokenSkin;
    else if(r.game==='tank')value=equipped.tankSkin;
    else if(r.game==='tetris')value={block:equipped.blockSkin,background:equipped.backgroundSkin};
    else if(r.game==='xiangqi')value=equipped.pieceSkin;
    else value=playerDefault[r.game]&&typeof playerDefault[r.game]==='object'?{...playerDefault[r.game]}:(playerDefault[r.game]||'classic');
    cosmetic.players[player]=value;return{player,uid:session.uid||null,gameId:r.game,cosmetic:value};
  });
  return{protocol:'game-cosmetic-presentation-v1',cosmeticSchemaVersion:1,gameId:r.game,cosmetic,players};
}
function settleAuthoritativeRoom(r, order, cause){
  if (!r || r.settled || !Array.isArray(order) || order.length !== r.clients.size) return;
  const results = authoritativeResults(order);
  settleRoomResult(r, results, { cause:cause || 'authoritative_gameplay' });
}
function startRoomAuthorities(r){
  stopRoomAuthorities(r);
  if (!r || !r.started || !r.matchId) return;
  if (r.game === 'tank'){
    r.tankAuthority = new TankAuthority({
      matchId:r.matchId, playerCount:r.clients.size, startedAt:r.startedAt,
      durationMs:Math.max(10000, Number(process.env.TANK_MATCH_DURATION_MS) || 180000),
    });
    r.gameplayTimer = setInterval(() => {
      if (!r.started || !r.tankAuthority) return;
      const state = r.tankAuthority.advance(Date.now());
       if (state.serverTick % 2 === 0){incrementGameplayMetric('tankSnapshots');broadcast(r, { type:'tank_snapshot', payload:state });}
      if (state.finished && !r.gameplayResultSent){
        r.gameplayResultSent = true;
        broadcast(r, { type:'tank_result', payload:{ matchId:r.matchId, order:state.order, stats:state.players } });
        settleAuthoritativeRoom(r, state.order, 'tank_authority');
        stopRoomGameplayTimer(r);
      }
    }, 50);
  } else if (r.game === 'tetris'){
    const startAt = Date.now() + 3000;
    const matchEndAt=startAt+Math.max(15000,Number(process.env.TETRIS_MATCH_DURATION_MS)||300000);
    if(roomSupports(r,PROTOCOL_VERSIONS.tetrisRules)){
      r.tetrisRuleAuthority=new TetrisRuleAuthority({matchId:r.matchId,playerCount:r.clients.size,startAt,matchEndAt,matchSeed:r.matchId});
      r.gameplayTimer=setInterval(()=>{
        if(!r.started||!r.tetrisRuleAuthority)return;const advanced=r.tetrisRuleAuthority.advance(Date.now());
        if(advanced.changed){incrementGameplayMetric('tetrisSnapshots');broadcast(r,advanced.stateEvent||r.tetrisRuleAuthority.stateEvent());}
        if(advanced.result&&!r.gameplayResultSent){r.gameplayResultSent=true;broadcast(r,advanced.result);settleAuthoritativeRoom(r,advanced.result.order,'tetris_rule_authority');stopRoomGameplayTimer(r);}
      },50);
    }else{
      r.tetrisAuthority = new TetrisBattleAuthority({matchId:r.matchId,playerCount:r.clients.size,startAt,matchEndAt,matchSeed:r.matchId});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.tetrisAuthority)return;const due=r.tetrisAuthority.advance(Date.now());due.forEach(item=>broadcast(r,{type:'tetris_garbage_due',payload:{matchId:r.matchId,revision:r.tetrisAuthority.revision,...item}}));if(r.tetrisAuthority.finished&&!r.gameplayResultSent){r.gameplayResultSent=true;const result=r.tetrisAuthority.result();broadcast(r,result);settleAuthoritativeRoom(r,result.order,'tetris_authority');stopRoomGameplayTimer(r);}},100);
    }
  } else if (r.game === 'xiangqi'){
    const initialMs=Math.max(1000,Number(process.env.XIANGQI_CLOCK_MS)||10*60*1000);
    if(roomSupports(r,PROTOCOL_VERSIONS.xiangqiRules)){
      r.xiangqiRuleAuthority=new XiangqiRuleAuthority({matchId:r.matchId,startedAt:r.startedAt,initialMs});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.xiangqiRuleAuthority||r.gameplayResultSent)return;const advanced=r.xiangqiRuleAuthority.advance(Date.now());if(advanced.event){r.gameplayResultSent=true;broadcast(r,advanced.event);if(advanced.result)settleAuthoritativeRoom(r,advanced.result.order,'xiangqi_rule_timeout');stopRoomGameplayTimer(r);}},250);
    }else{
      r.xiangqiClock=new XiangqiClockAuthority({matchId:r.matchId,startedAt:r.startedAt,initialMs});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.xiangqiClock||r.gameplayResultSent)return;const timeout=r.xiangqiClock.timeout(Date.now());if(!timeout)return;r.gameplayResultSent=true;broadcast(r,timeout);settleAuthoritativeRoom(r,[timeout.payload.winner,timeout.payload.loser],'xiangqi_clock_timeout');stopRoomGameplayTimer(r);},250);
    }
  } else if (r.game === 'monopoly'){
    if(roomSupports(r,PROTOCOL_VERSIONS.monopolyRules)){
      r.monopolyRuleAuthority=new MonopolyRuleAuthority({matchId:r.matchId,playerCount:r.clients.size,matchSeed:r.matchId,auctionDurationMs:Math.max(1000,Number(process.env.MONOPOLY_AUCTION_MS)||5000)});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.monopolyRuleAuthority)return;const advanced=r.monopolyRuleAuthority.advance(Date.now());if(advanced.event)broadcast(r,advanced.event);if(advanced.result&&!r.gameplayResultSent){r.gameplayResultSent=true;broadcast(r,advanced.result);settleAuthoritativeRoom(r,advanced.result.order,'monopoly_rule_authority');stopRoomGameplayTimer(r);}},100);
    }else{
      r.monopolyAuction=new MonopolyAuctionAuthority({matchId:r.matchId,playerCount:r.clients.size,durationMs:Math.max(1000,Number(process.env.MONOPOLY_AUCTION_MS)||5000)});r.monopolyTurn=0;
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.monopolyAuction)return;const closed=r.monopolyAuction.close(Date.now());if(closed)broadcast(r,closed);},100);
    }
  }
  if (r.gameplayTimer && r.gameplayTimer.unref) r.gameplayTimer.unref();
}
function startRoomMatch(r){
  compactRoomPlayers(r);
  r.started = true;
  r.matchId = crypto.randomBytes(12).toString('base64url');
  r.resultClaims = new Map();
  r.settled = false;
  r.disputed = false;
  r.moveSeq = 0;
  r.moveLog = [];
  r.moveLogBytes = 0;
  r.moveLogTruncated = false;
  r.tankInputSeq = {};
  r.tankAuthoritySeq = 0;
  r.tankFinalSent = false;
  r.startedAt = Date.now();
  r.rewardProgress = { startedAt: r.startedAt, lastActionAt: r.startedAt, meaningfulActions: 0, byPlayer: {}, uniqueActions: new Set() };
  r.resultRewards = new Map();
  r.gameplayResultSent = false;
  r.gameSnapshot = null;
  r.tetrisPresentation = new Map();
  r.tournamentBinding = null;
  r.finalResult = null;
  startRoomAuthorities(r);
  recordAnalytics('match_started', {
    matchId: r.matchId,
    game: r.game,
    mode: 'online',
    metadata: { participantCount: r.clients.size },
  });
  broadcast(r, { type: 'started', game: r.game, size: r.clients.size, players: [...r.clients.values()].sort((a, b) => a - b), matchId: r.matchId, gameplay:gameplayMetadata(r), presentation:gameplayPresentation(r) });
  broadcastLobby();
}
function roomResultError(r, msg, reason){
  for (const c of r.clients.keys()) c.sendText(JSON.stringify({ type: 'result_error', msg, reason, matchId: r.matchId }));
}
function settleRoomResult(r, results, options = {}){
  if (r.settled) return;
  r.settled = true;
  stopRoomGameplayTimer(r);
  const now = Date.now();
  const progress = roomProgress(r);
  const globalEligibility = options.eligibility || roomRewardEligibility(r, now);
  const participants = [...r.clients.entries()].map(([session, slot]) => ({ session, slot, user: session.uid && db.users[session.uid] })).filter(x => x.user);
  const participantUids = participants.map(p => p.user.uid);
  const opponentKey = opponentGroupKey(participantUids);
  const durationMs = Math.max(0, now - Number(progress.startedAt || r.startedAt || now));
  r.resultRewards = r.resultRewards instanceof Map ? r.resultRewards : new Map();
  for (const p of participants){
    const mine = results.find(x => x.slot === p.slot);
    const others = participants.filter(x => x !== p).map(x => x.user);
    let eligibility = { eligible: globalEligibility.eligible === true, blockedReason: globalEligibility.blockedReason || null };
    const forcedReason = options.blockedSlots && options.blockedSlots.get(p.slot);
    const threshold = eligibilityThreshold(r.game, 'online', rewardThresholdOverrides());
    if (eligibility.eligible && threshold && (progress.byPlayer[p.slot] || 0) < (threshold.minPlayerActions || 0)){
      eligibility = { eligible: false, blockedReason: 'afk' };
    }
    if (forcedReason) eligibility = { eligible: false, blockedReason: forcedReason };
    if (globalEligibility.eligible){
      for (const other of others) recordServerPlaymate(p.user, other, r.game);
    }
    const resultMeta = { matchId: r.matchId, resultId: r.matchId + ':' + p.slot, mode: 'online' };
    const result = options.forceResult || playerResult(results, mine, participants.length);
    const repeatCount24h = repeatOpponentCount(p.user.uid, opponentKey, now);
    const reward = resolveMatchReward({
      userId: p.user.uid,
      matchId: r.matchId,
      resultId: resultMeta.resultId,
      gameId: r.game,
      mode: 'online',
      placement: mine && mine.rank || (result === 'win' ? 1 : participants.length),
      result,
      participantCount: participants.length,
      durationMs,
      meaningfulActions: progress.meaningfulActions || 0,
      opponentIds: others.map(user => user.uid),
      repeatCount24h,
      eligibility,
      now,
    }, p.user);
    const row = applyResolvedProgress(p.user, reward, {
      ...resultMeta,
      at: now,
      opponentIds: others.map(user => user.uid),
      opponentKey,
      durationMs,
      meaningfulActions: progress.meaningfulActions || 0,
    });
    p.resultMeta = resultMeta;
    p.reward = reward;
    p.row = row;
    r.resultRewards.set(p.slot, reward);
  }
  recordAnalytics(globalEligibility.eligible ? 'match_completed' : 'match_invalidated', {
    matchId: r.matchId,
    game: r.game,
    mode: 'online',
    metadata: {
      reason: globalEligibility.blockedReason || null,
      cause: options.cause || 'completed',
      durationMs,
      meaningfulActions: progress.meaningfulActions || 0,
      participantCount: participants.length,
    },
  });
  if (options.cause === 'forfeit') recordAnalytics('match_forfeit', { matchId: r.matchId, game: r.game, mode: 'online', metadata: { offenderSlot: options.offenderSlot } });
  if (options.cause === 'afk') recordAnalytics('match_afk', { matchId: r.matchId, game: r.game, mode: 'online', metadata: { offenderSlot: options.offenderSlot } });
  trimAuditData();
  saveDB();
  for (const p of participants){
    syncRewardRow(p.user, p.row);
    if (options.sendResult !== false) p.session.sendText(JSON.stringify({
      type: 'result_ok',
      matchId: r.matchId,
      payload: { profile: profileObj(p.user), reward: p.reward, resultId: p.resultMeta.resultId },
    }));
  }
  r.finalResult={matchId:r.matchId,game:r.game,results:results.map(item=>({slot:item.slot,rank:item.rank})),cause:options.cause||'consensus'};
  broadcast(r,{type:'match_result',payload:r.finalResult});
  reportTournamentRoomResult(r,results,options);
  broadcastLeaderboard();
}
function settleRoomNoContest(r, reason){
  if (!r || !r.started || r.settled || !r.matchId) return;
  const results = [...r.clients.values()].sort((a, b) => a - b).map((slot, index) => ({ slot, coins: 0, rank: index + 1 }));
  settleRoomResult(r, results, {
    cause: 'invalidated',
    forceResult: 'draw',
    eligibility: { eligible: false, blockedReason: reason || 'no_contest' },
  });
}
function settleRoomForfeit(r, offenderSession, cause){
  if (!r || !r.started || r.settled || !r.matchId || !r.clients.has(offenderSession)) return;
  const offenderSlot = r.clients.get(offenderSession);
  const size = r.clients.size;
  if (size > 2){
    settleRoomNoContest(r, 'multiplayer_forfeit_unranked');
    recordAnalytics(cause === 'afk' ? 'match_afk' : 'match_forfeit', {
      matchId: r.matchId, game: r.game, mode: 'online', metadata: { offenderSlot, noContest: true },
    });
    return;
  }
  const results = [...r.clients.values()].map(slot => ({
    slot,
    coins: slot === offenderSlot ? 0 : 1,
    rank: slot === offenderSlot ? size : 1,
  }));
  const blockedSlots = new Map();
  if (cause === 'afk') blockedSlots.set(offenderSlot, 'afk');
  settleRoomResult(r, results, { cause: cause || 'forfeit', offenderSlot, blockedSlots });
}
function submitRoomResult(session, payload, r){
  if (!r.started || !r.matchId || r.disputed){ session.sendText(JSON.stringify({ type: 'result_error', msg: '当前没有可结算的对局', reason: 'no_settleable_match' })); return; }
  // Authority-backed matches never accept a client-consensus `result` claim.
  // Otherwise a malicious/early client could settle Tank/Tetris/Xiangqi or a
  // fully authoritative Monopoly room before the server simulation reaches
  // its terminal state.  Administrative forfeit/no-contest paths call
  // settleRoomResult directly and remain available for disconnect handling.
  const authorityProtocol = r.tankAuthority ? 'tank-authority-v1' :
    (r.tetrisRuleAuthority ? PROTOCOL_VERSIONS.tetrisRules :
      (r.tetrisAuthority ? 'tetris-battle-authority-v1' :
        (r.xiangqiRuleAuthority ? PROTOCOL_VERSIONS.xiangqiRules :
          (r.xiangqiClock ? 'xiangqi-clock-v1' : (r.monopolyRuleAuthority ? PROTOCOL_VERSIONS.monopolyRules : '')))));
  if (authorityProtocol){
    incrementGameplayMetric('clientResultRejected');
    session.sendText(JSON.stringify({
      type: 'result_error',
      code: 'authoritative_result_required',
      reason: 'authoritative_result_required',
      msg: '该对局由服务器规则裁决，不能提交客户端结算',
      matchId: r.matchId,
      protocol: authorityProtocol,
    }));
    return;
  }
  const matchId = String(payload && payload.matchId || '');
  if (matchId !== r.matchId){ session.sendText(JSON.stringify({ type: 'result_error', msg: '对局标识已失效', reason: 'match_id_expired' })); return; }
  const game = String(payload && payload.game || '');
  if (game !== r.game){ session.sendText(JSON.stringify({ type: 'result_error', msg: '游戏标识不匹配', reason: 'game_mismatch' })); return; }
  const normalized = normalizeRoomResults(payload && payload.results, r.clients.size);
  if (!normalized){ session.sendText(JSON.stringify({ type: 'result_error', msg: '结算数据无效', reason: 'invalid_result' })); return; }
  const digest = JSON.stringify(normalized.map(x => ({ slot: x.slot, coins: x.coins, rank: x.rank })));
  const previous = r.resultClaims.get(session.player);
  if (previous){
    if (previous.digest !== digest) session.sendText(JSON.stringify({ type: 'result_error', msg: '同一玩家重复提交了冲突结果', reason: 'conflicting_result_claim' }));
    else if (r.settled) session.sendText(JSON.stringify({
      type: 'result_ok', matchId: r.matchId,
      payload: { profile: profileObj(db.users[session.uid]), reward: r.resultRewards && r.resultRewards.get(session.player), resultId: r.matchId + ':' + session.player },
    }));
    else session.sendText(JSON.stringify({ type: 'result_pending', matchId: r.matchId }));
    return;
  }
  r.resultClaims.set(session.player, { digest, results: normalized });
  if (r.resultClaims.size < r.clients.size){ session.sendText(JSON.stringify({ type: 'result_pending', matchId: r.matchId })); return; }
  const claims = [...r.resultClaims.values()];
  if (new Set(claims.map(c => c.digest)).size !== 1){
    r.disputed = true;
    settleRoomResult(r, claims[0].results, {
      cause: 'disputed',
      eligibility: { eligible: false, blockedReason: 'result_disputed' },
      sendResult: false,
    });
    roomResultError(r, '双方结算结果不一致，本局未计入排行榜', 'result_consensus_mismatch');
    return;
  }
  settleRoomResult(r, claims[0].results);
}
function cleanupSoloMatches(){
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [uid, match] of soloMatches){
    if (!match || Number(match.updatedAt || match.startedAt || 0) < cutoff) soloMatches.delete(uid);
  }
}
function unwrapSoloAction(value){
  // v2 客户端为每个真实操作附带不可重复 actionId，断线补发不会重复计入有效操作。
  if (value && typeof value === 'object' && !Array.isArray(value) &&
      typeof value.actionId === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value.actionId) &&
      Object.prototype.hasOwnProperty.call(value, 'payload')){
    return { actionId: value.actionId, payload: value.payload };
  }
  // 兼容仍在缓存中的旧版客户端；其操作只能获得基础结构校验，不承诺重放幂等。
  return { actionId: null, payload: value };
}
function sendSoloStarted(session, match){
  session.sendText(JSON.stringify({
    type: 'solo_started',
    payload: {
      matchId: match.matchId,
      resultId: match.resultId,
      clientRunId: match.clientRunId,
      game: match.game,
      mode: 'ai',
      startedAt: match.startedAt,
    },
  }));
}
function beginSoloMatch(session, user, payload){
  if (session.room){ session.sendText(JSON.stringify({ type: 'result_error', msg: '房间对局中不能开始人机结算', reason: 'solo_in_room' })); return; }
  cleanupSoloMatches();
  const game = String(payload && payload.game || '');
  const clientRunId = String(payload && payload.clientRunId || '');
  if (!VALID_GAMES.includes(game) || !/^run_[A-Za-z0-9_-]{8,120}$/.test(clientRunId)){
    session.sendText(JSON.stringify({ type: 'result_error', msg: '人机对局启动参数无效', reason: 'invalid_solo_start' }));
    return;
  }
  const existing = soloMatches.get(user.uid);
  if (existing && existing.clientRunId === clientRunId && existing.game === game && !existing.completed){
    existing.updatedAt = Date.now();
    sendSoloStarted(session, existing);
    return;
  }
  if (existing && !existing.completed){
    recordAnalytics('match_invalidated', {
      uid: user.uid, matchId: existing.matchId, game: existing.game, mode: 'ai',
      metadata: { reason: 'ai_match_restarted' },
    });
  }
  const now = Date.now();
  const match = {
    uid: user.uid,
    game,
    clientRunId,
    matchId: 'ai_' + crypto.randomBytes(12).toString('base64url'),
    resultId: 'ai_result_' + crypto.randomBytes(14).toString('base64url'),
    startedAt: now,
    updatedAt: now,
    meaningfulActions: 0,
    uniqueActions: new Set(),
    actionIds: new Set(),
    aiDecisions: [],
    pendingAIDecisions: new Map(),
    confirmedAIDecisionIds: new Set(),
    completed: false,
  };
  soloMatches.set(user.uid, match);
  recordAnalytics('match_started', { uid: user.uid, matchId: match.matchId, game, mode: 'ai' });
  sendSoloStarted(session, match);
}
function recordSoloProgress(session, user, payload){
  const match = soloMatches.get(user.uid);
  const matchId = String(payload && payload.matchId || '');
  const game = String(payload && payload.game || '');
  const event = unwrapSoloAction(payload && payload.action);
  const action = event.payload;
  if (!match || match.completed || match.matchId !== matchId || match.game !== game) return;
  if (event.actionId && match.actionIds instanceof Set && match.actionIds.has(event.actionId)) return;
  if (match.meaningfulActions >= 5000 || !meaningfulAction(game, action)) return;
  if (!(match.actionIds instanceof Set)) match.actionIds = new Set();
  if (event.actionId) match.actionIds.add(event.actionId);
  match.meaningfulActions++;
  const fingerprint = actionFingerprint(game, user.uid, action);
  if (fingerprint) match.uniqueActions.add(fingerprint);
  match.updatedAt = Date.now();
}
function confirmSoloAIDecision(session, user, payload){
  const match = soloMatches.get(user.uid);
  const game = String(payload && payload.game || '');
  const matchId = String(payload && payload.matchId || '');
  const resultId = String(payload && payload.resultId || '');
  const decisionId = String(payload && payload.decisionId || '');
  const choice = String(payload && payload.choice || '').slice(0, 240);
  if (!match || match.completed || match.game !== game || match.matchId !== matchId || match.resultId !== resultId ||
      !/^aid_[A-Za-z0-9_-]{12,120}$/.test(decisionId) || !choice) return;
  if (!(match.confirmedAIDecisionIds instanceof Set)) match.confirmedAIDecisionIds = new Set();
  if (match.confirmedAIDecisionIds.has(decisionId)){
    session.sendText(JSON.stringify({ type: 'ai_decision_confirmed', payload: {
      decisionId, matchId, resultId, duplicate: true,
    } }));
    return;
  }
  if (!(match.pendingAIDecisions instanceof Map)) match.pendingAIDecisions = new Map();
  const pending = match.pendingAIDecisions.get(decisionId);
  if (!pending || Date.now() - Number(pending.createdAt || 0) > AI_DECISION_TTL_MS){
    match.pendingAIDecisions.delete(decisionId);
    return;
  }
  // actualChoice 必须仍属于当时服务端给出的合法集合；客户端不能借确认接口投毒。
  if (!Array.isArray(pending.options) || !pending.options.includes(choice)) return;
  const candidates = pending.decision && Array.isArray(pending.decision.candidates)
    ? pending.decision.candidates : [];
  if (!candidates.some(item => item && String(item.choice) === choice)) return;
  const row = recordAILearningDecision(match, {
    ...pending.decision,
    decisionId,
    choice,
    candidateCount: pending.options.length,
    source: String(pending.decision.source || '') + ':confirmed',
  });
  if (!row) return;
  match.pendingAIDecisions.delete(decisionId);
  match.updatedAt = Date.now();
  session.sendText(JSON.stringify({ type: 'ai_decision_confirmed', payload: {
    decisionId, matchId, resultId, duplicate: false,
  } }));
}
function previousReward(uid, resultId){
  for (let i = db.rewardHistory.length - 1; i >= 0; i--){
    const row = db.rewardHistory[i];
    if (row && row.uid === uid && row.resultId === resultId) return row.reward || null;
  }
  return null;
}
function soloResultError(session, message, matchId, resultId, reason){
  session.sendText(JSON.stringify({
    type: 'result_error', msg: message, reason,
    matchId: matchId || null,
    resultId: resultId || null,
    payload: { matchId: matchId || null, resultId: resultId || null, reason },
  }));
}
function settleSoloMatch(session, user, payload){
  const mode = String(payload && payload.mode || '');
  const game = String(payload && payload.game || '');
  const matchId = String(payload && payload.matchId || '');
  const resultId = String(payload && payload.resultId || '');
  const result = String(payload && payload.result || '');
  if (mode !== 'ai' || !VALID_GAMES.includes(game) || !['win', 'draw', 'loss'].includes(result) ||
      !/^ai_[A-Za-z0-9_-]{10,120}$/.test(matchId) || !/^ai_result_[A-Za-z0-9_-]{10,120}$/.test(resultId)){
    soloResultError(session, '人机结算必须使用服务端签发的有效对局票据', matchId, resultId, 'invalid_solo_ticket');
    return;
  }
  user.recentResults = Array.isArray(user.recentResults) ? user.recentResults : [];
  if (user.recentResults.includes(resultId)){
    session.sendText(JSON.stringify({
      type: 'result_ok',
      payload: { profile: profileObj(user), resultId, matchId, reward: previousReward(user.uid, resultId), replayed: true },
    }));
    return;
  }
  const match = soloMatches.get(user.uid);
  if (!match || match.completed || match.game !== game || match.matchId !== matchId || match.resultId !== resultId){
    soloResultError(session, '人机对局票据不存在、已完成或已过期', matchId, resultId, 'solo_ticket_unavailable');
    return;
  }
  const now = Date.now();
  user.soloRate = (Array.isArray(user.soloRate) ? user.soloRate : [])
    .map(Number).filter(Number.isFinite).filter(time => now - time < 3600000);
  if (user.soloRate.length >= 60){
    soloResultError(session, '人机结算已达到每小时上限，请稍后再试', matchId, resultId, 'solo_rate_limited');
    return;
  }
  const eligibility = evaluateEligibility({
    gameId: game,
    mode: 'ai',
    matchId,
    resultId,
    identitiesValid: true,
    consensusValid: true,
    durationMs: Math.max(0, now - match.startedAt),
    meaningfulActions: match.meaningfulActions,
    uniqueActions: match.uniqueActions.size,
    thresholdOverrides: rewardThresholdOverrides(),
  });
  const reward = resolveMatchReward({
    userId: user.uid,
    matchId,
    resultId,
    gameId: game,
    mode: 'ai',
    placement: result === 'win' ? 1 : 2,
    result,
    participantCount: 2,
    durationMs: Math.max(0, now - match.startedAt),
    meaningfulActions: match.meaningfulActions,
    opponentIds: ['ai'],
    eligibility,
    now,
  }, user);
  const row = applyResolvedProgress(user, reward, {
    matchId,
    resultId,
    mode: 'ai',
    at: now,
    opponentIds: ['ai'],
    opponentKey: 'ai',
    durationMs: Math.max(0, now - match.startedAt),
    meaningfulActions: match.meaningfulActions,
  });
  // 未被客户端确认的 AI 建议全部丢弃；慢请求/超时回退不会进入学习样本。
  if (match.pendingAIDecisions instanceof Map) match.pendingAIDecisions.clear();
  const learning = user.ephemeral ? null : applyMatchLearning(db.aiLearning, {
    uid: user.uid,
    game,
    resultId,
    matchId,
    humanResult: result,
    eligible: eligibility.eligible === true,
    decisions: match.aiDecisions,
  });
  user.soloRate.push(now);
  match.completed = true;
  match.updatedAt = now;
  recordAnalytics(eligibility.eligible ? 'match_completed' : 'match_invalidated', {
    uid: user.uid, matchId, game, mode: 'ai',
    metadata: {
      reason: eligibility.blockedReason || null,
      durationMs: now - match.startedAt,
      meaningfulActions: match.meaningfulActions,
      aiLearningRevision: learning && learning.model ? learning.model.revision : null,
      aiDecisions: Array.isArray(match.aiDecisions) ? match.aiDecisions.length : 0,
    },
  });
  trimAuditData();
  saveDB();
  syncRewardRow(user, row);
  if (learning && learning.experiences.length) syncAILearningResult(user, resultId, learning);
  session.sendText(JSON.stringify({ type: 'result_ok', payload: { profile: profileObj(user), resultId, matchId, reward } }));
  broadcastLeaderboard();
}
function sendFrame(socket, opcode, payload){
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload || '');
  let header;
  if (data.length < 126){
    header = Buffer.from([0x80 | opcode, data.length]);
  } else if (data.length < 65536){
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(data.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(data.length), 2);
  }
  socket.write(Buffer.concat([header, data]));
}
function broadcast(room, msg, except){
  const text = JSON.stringify(msg);
  for (const c of room.clients.keys()){
    if (c !== except) c.sendText(text);
  }
  if (room.spectators){
    const delay = Math.max(0, Number(room.spectatorDelayMs) || 0);
    for (const c of room.spectators.keys()){
      if (c === except) continue;
      if (!delay) c.sendText(text);
      else {
        const timer = setTimeout(() => { if (c.alive && room.spectators && room.spectators.has(c)) c.sendText(text); }, delay);
        if (timer && timer.unref) timer.unref();
      }
    }
  }
}

function spectatorSnapshot(r){
  const cosmetics = [...r.clients.entries()].map(([session, player]) => {
    const user = session.uid && db.users[session.uid];
    return { player, uid:session.uid || null, avatar:user ? user.avatar : 0, frame:user ? user.frame : 0, effect:user ? user.effect : 0, background:user ? user.background : 0, nameFx:user ? user.nameFx : 0 };
  });
  return {
    ...roomPayload(r), role:'spectator', spectatorDelayMs:Math.max(0, Number(r.spectatorDelayMs) || 0), presentation:gameplayPresentation(r),
    cosmetics, gameSnapshot:r.gameSnapshot || null,
    moveLog:(r.moveLog || []).map(event=>({seq:event.seq,player:event.player,payload:event.payload})),
    moveLogTruncated:!!r.moveLogTruncated,
    tankSnapshot:r.tankAuthority ? r.tankAuthority.snapshot() : null,
    tetrisSnapshot:r.tetrisAuthority ? r.tetrisAuthority.snapshot() : null,
    tetrisRuleSnapshot:r.tetrisRuleAuthority ? r.tetrisRuleAuthority.snapshot() : null,
    tetrisPresentation:tetrisPresentationPayload(r),
    clockSnapshot:r.xiangqiClock ? r.xiangqiClock.snapshot() : null,
    xiangqiRuleSnapshot:r.xiangqiRuleAuthority ? r.xiangqiRuleAuthority.snapshot() : null,
    auctionSnapshot:r.monopolyAuction ? r.monopolyAuction.snapshot() : null,
    monopolyRuleSnapshot:r.monopolyRuleAuthority ? r.monopolyRuleAuthority.snapshot() : null,
    finalResult:r.finalResult || null,
  };
}

class Session {
  constructor(socket, req){
    this.sessionId = 'ws_' + crypto.randomBytes(12).toString('base64url');
    this.socket = socket;
    this.ip = requestIp(req || { headers: {}, socket });
    this.room = null;
    this.player = null;
    this.spectatorRoom = null;
    this.uid = null;
    this.tokenHash = null;
    this.capabilities = new Set();
    this.detachedAt = 0;
    this.resumeUntil = 0;
    this.reconnectTimer = null;
    this.lastSeen = Date.now();
    this.messageTimes = [];
    this.buffer = Buffer.alloc(0);
    this.alive = true;
  }
  sendText(text){
    if (!this.alive || !this.socket || this.socket.destroyed) return;
    try { sendFrame(this.socket, 0x1, text); } catch {}
  }
  sendPong(){ sendFrame(this.socket, 0xA, ''); }
  authError(msg, extra){
    this.sendText(JSON.stringify({ type: 'auth_error', msg: msg || '请先登录', reason: 'login_required', ...(extra || {}) }));
  }
  requireUser(){
    const u = this.uid && db.users[this.uid];
    if (!u || !userHasTokenHash(u, this.tokenHash)){
      this.authError('登录状态已失效，请重新登录', { reason: 'session_expired' });
      return null;
    }
    return u;
  }
  handleData(chunk){
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true){
      if (this.buffer.length < 2) return;
      const fin = (this.buffer[0] & 0x80) !== 0;
      const opcode = this.buffer[0] & 0x0f;
      const masked = (this.buffer[1] & 0x80) !== 0;
      let len = this.buffer[1] & 0x7f;
      let offset = 2;
      if (len === 126){
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127){
        if (this.buffer.length < 10) return;
        const big = this.buffer.readBigUInt64BE(2);
        if (big > 0x10000) { this.close(); return; }
        len = Number(big);
        offset = 10;
      }
      if (!masked){ this.close(); return; } // 客户端帧必须掩码
      if (this.buffer.length < offset + 4 + len) return;
      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.alloc(len);
      for (let i = 0; i < len; i++) payload[i] = this.buffer[offset + 4 + i] ^ mask[i % 4];
      this.buffer = this.buffer.subarray(offset + 4 + len);
      if (opcode === 0x8){ this.close(true); return; }
      if (opcode === 0x9){ this.sendPong(); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 && fin) this.handleMessage(payload.toString('utf8'));
    }
  }
  handleMessage(text){
    const now = Date.now();
    this.messageTimes = this.messageTimes.filter(t => now - t < 10000);
    if (this.messageTimes.length >= 200){ this.close(); return; }
    this.messageTimes.push(now);
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    const type = msg && msg.type;
    const payload = msg && msg.payload;
    this.lastSeen = Date.now();
    if (type === 'ping') return;
    if (type === 'debug_disconnect' && process.env.NODE_ENV === 'test'){
      try { this.socket.destroy(); } catch {}
      return;
    }
    if (type === 'hello'){
      this.capabilities = new Set(Array.isArray(payload && payload.capabilities) ? payload.capabilities.map(String).slice(0,100) : []);
      const uid = String(payload && payload.uid || '');
      const token = String(payload && payload.token || '');
      const u = uid && db.users[uid];
      const tokenHash = token ? hashToken(token) : null;
      if (this.uid && (uid !== this.uid || !u || !userHasToken(u, token) || !secureEqual(this.tokenHash, tokenHash))){
        this.authError('请先退出当前账号再切换身份', { reason: 'identity_switch_requires_logout' });
        return;
      }
      if (u && userHasToken(u, token)){
        this.uid = uid;
        this.tokenHash = tokenHash;
      } else {
        this.uid = null;
        this.tokenHash = null;
      }
      this.sendText(JSON.stringify({
        type: 'hello_ack', proto: PROTOCOL_VERSION, authenticated: !!this.uid,
        rewardVersion: REWARD_CONFIG.version,
        capabilities: ['reward_breakdown','ai_reward_ticket','local_no_economy',...gameplayCapabilities(),
          'tank_authority_v1','tetris_battle_authority_v1','spectator_room_v1','tournament_orchestrator_v1','xiangqi_clock_v1','monopoly_auction_v1','game_cosmetic_presentation_v1',
          'ai_decision_confirm_v1'],
      }));
      if (this.uid) tryResumeSession(this);
      broadcastLeaderboard();
      broadcastLobby();
      if (this.uid){
        const pend = pendingInvites.get(this.uid);
        if (pend && pend.length){
          const now = Date.now();
          for (const inv of pend.splice(0)){
            if (!inv.expiresAt || inv.expiresAt > now) this.sendText(JSON.stringify({ type: 'invite', payload: inv }));
          }
          pendingInvites.delete(this.uid);
        }
      }
      return;
    }
    if (type === 'register'){
      if (this.uid){ this.authError('请先退出当前账号再注册新账号', { reason: 'registration_requires_logout' }); return; }
      const pin = String((payload && payload.pin) || '').trim();
      if (!validPin(pin)){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 只能使用字母和数字，长度 4-20 位', reason: 'pin_format_invalid' }));
        return;
      }
      if (!allowRegistration(this.ip)){
        this.authError('该网络注册过于频繁，请稍后再试', { reason: 'registration_rate_limited', retryAfter: 3600 });
        return;
      }
      if (!allowAuthHash()){
        this.authError('登录服务繁忙，请稍后再试', { reason: 'auth_service_busy', retryAfter: 30 });
        return;
      }
      const ph = hashPin(pin);
      const oldPh = legacyPinHash(pin);
      if (Object.values(db.users).some(u => secureEqual(u.pin_hash, ph) || secureEqual(u.pin_hash, oldPh))){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: '该 PIN 已被其他玩家使用，请换一个', reason: 'pin_in_use' }));
        return;
      }
      const proposed = String((payload && payload.uid) || '');
      const uid = /^u_[a-z0-9]{6,32}$/.test(proposed) && !db.users[proposed] ? proposed : genUid();
      const name = String((payload && payload.name) || '').trim().slice(0, 12) || '玩家';
      const avatar = Number.isInteger(payload && payload.avatar) ? Math.max(0, Math.min(29, payload.avatar)) : 0;
      const starterBackground = Number.isInteger(payload && payload.background) && payload.background >= 0 && payload.background <= 10 ? payload.background : 0;
      const starterOwned = normalizeOwned({ backgrounds: [starterBackground] });
      const u = {
        uid, name, avatar,
        ephemeral: !!(payload && payload.ephemeral === true && /^u_live[a-z0-9]{4,40}$/.test(uid)),
        background: starterBackground,
        frame: 0,
        effect: 0,
        achievements: [], playmates: {}, daily: { play: 0, win: 0, streak: 0 }, nameFx: 0,
        owned: starterOwned, gameCosmetics: normalizeGameCosmetics(payload && payload.gameCosmetics),
        xp: 0, level: 1, streak: 0, bestStreak: 0, coins: 0, played: {}, total: 0, wins: {}, totalWins: 0,
        recentResults: [], purchaseRequests: [], soloRate: [], pin_hash: ph,
        dailyFirstWinDate: '', dailyAICurrencyKey: '', dailyAICurrencyEarned: 0,
        xpCurveVersion: REWARD_CONFIG.level.curveVersion,
        lang: (payload && ['zh-CN','en-US','uk-UA'].includes(payload.lang) ? payload.lang : 'zh-CN'), created_at: Date.now(),
      };
      const auth = issueAuthToken(u);
      db.users[uid] = u;
      saveDB();
      sbCreateProfile(u);
      this.uid = uid;
      this.tokenHash = auth.tokenHash;
      this.sendText(JSON.stringify({ type: 'registered', token: auth.token, payload: { uid, token: auth.token, profile: profileObj(u) } }));
      broadcastLeaderboard();
      broadcastLobby();
      return;
    }
    if (type === 'login'){
      if (this.uid){ this.authError('请先退出当前账号再登录其他账号', { reason: 'login_requires_logout' }); return; }
      const retryAfter = authRetryAfter(this.ip);
      if (retryAfter){ this.authError('尝试次数过多，请稍后再试', { reason: 'login_rate_limited', retryAfter }); return; }
      const pin = String((payload && payload.pin) || '').trim();
      if (!validPin(pin)){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 只能使用字母和数字，长度 4-20 位', reason: 'pin_format_invalid' }));
        return;
      }
      if (!allowAuthHash()){
        this.authError('登录服务繁忙，请稍后再试', { reason: 'auth_service_busy', retryAfter: 30 });
        return;
      }
      const ph = hashPin(pin);
      const oldPh = legacyPinHash(pin);
      const u = Object.values(db.users).find(x => pinMatches(x, pin, ph, oldPh));
      if (!u){
        noteAuthFailure(this.ip);
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 不存在，请检查后重试', reason: 'pin_not_found' }));
        return;
      }
      clearAuthFailures(this.ip);
      if (!String(u.pin_hash || '').startsWith('s2$')) u.pin_hash = ph;
      const auth = issueAuthToken(u);
      this.uid = u.uid;
      this.tokenHash = auth.tokenHash;
      saveDB();
      sbSyncAuthProfile(u);
      this.sendText(JSON.stringify({ type: 'logged_in', token: auth.token, payload: { uid: u.uid, token: auth.token, profile: profileObj(u) } }));
      broadcastLeaderboard();
      broadcastLobby();
      return;
    }
    if (type === 'profile_get'){
      const uid = String((payload && payload.uid) || '');
      const u = uid && db.users[uid];
      const canReadPrivate = !!(u && uid === this.uid && userHasTokenHash(u, this.tokenHash));
      this.sendText(JSON.stringify({ type: 'profile_data', payload: u ? (canReadPrivate ? profileObj(u) : publicProfileObj(u)) : null }));
      return;
    }
    if (type === 'profile'){
      const u = this.requireUser();
      if (!u) return;
      const requestedUid = String(payload && payload.uid || this.uid);
      if (requestedUid !== this.uid){ this.authError('不能修改其他玩家的档案', { reason: 'profile_forbidden' }); return; }
      updateEditableProfile(u, payload);
      saveDB();
      sbSyncEditableProfile(u);
      this.sendText(JSON.stringify({ type: 'profile_ok', payload: profileObj(u) }));
      broadcastLeaderboard();
      return;
    }
    if (type === 'purchase'){
      const u = this.requireUser();
      if (!u) return;
      const category = String(payload && payload.category || '');
      const id = Number(payload && payload.id);
      const requestId = String(payload && payload.requestId || '');
      if (requestId && !/^[A-Za-z][A-Za-z0-9_-]{7,120}$/.test(requestId)){
        this.sendText(JSON.stringify({ type: 'purchase_error', msg: '购买请求标识无效', reason: 'invalid_purchase_id' }));
        return;
      }
      u.purchaseRequests = Array.isArray(u.purchaseRequests) ? u.purchaseRequests : [];
      const price = SHOP_PRICES[category] && SHOP_PRICES[category][id];
      if (!Number.isInteger(id) || !Number.isInteger(price)){
        this.sendText(JSON.stringify({ type: 'purchase_error', msg: '商品不存在', reason: 'product_not_found' }));
        return;
      }
      u.owned = normalizeOwned(u.owned);
      if (useSupabase && !u.ephemeral){
        ensureSupabaseRuntimeState(u);
        const purchaseRef = requestId || ('purchase_' + crypto.randomBytes(12).toString('base64url'));
        const purchaseRequestsAtStart = Array.isArray(u.purchaseRequests) ? u.purchaseRequests.slice() : [];
        sbApplyPurchaseTransaction(u, category, id, price, purchaseRef).then(result => {
          if (!result){
            this.sendText(JSON.stringify({ type: 'purchase_error', msg: '购买同步失败，请稍后重试', reason: 'purchase_sync_failed' }));
            return;
          }
          // 奖励可能在购买 RPC 排队期间先在本地确认、但尚未进入远端；
          // 只把这部分“本地奖励债务”叠回 RPC 余额，避免购买回调回档奖励。
          const rewardDebt = Math.max(0,
            (Number(u._supabaseLocalRewardCurrency) || 0) - (Number(u._supabaseRemoteRewardCurrency) || 0));
          const remoteOwned = normalizeOwned(result.owned);
          const mergedOwned = normalizeOwned(remoteOwned);
          const localOwned = normalizeOwned(u.owned);
          for (const key of Object.keys(mergedOwned)){
            const values = new Set([...(mergedOwned[key] || []), ...(localOwned[key] || [])]);
            mergedOwned[key] = [...values].filter(Number.isInteger).sort((a, b) => a - b);
          }
          const remoteRequests = Array.isArray(result.purchaseRequests) ? result.purchaseRequests.map(String) : [];
          const localRequests = Array.isArray(u.purchaseRequests) ? u.purchaseRequests.map(String) : purchaseRequestsAtStart;
          const mergedRequests = [...new Set([...remoteRequests, ...localRequests, purchaseRef])].slice(-100);
          if (result.insufficient === true){
            u.coins = Math.max(0, Number(result.coins) || 0) + rewardDebt;
            u.owned = mergedOwned;
            u.purchaseRequests = mergedRequests;
            saveDB();
            this.sendText(JSON.stringify({ type: 'purchase_error', msg: '余额不足，请完成有效对局获取 💵', reason: 'insufficient_balance' }));
            return;
          }
          u.coins = Math.max(0, Number(result.coins) || 0) + rewardDebt;
          u.owned = mergedOwned;
          u.purchaseRequests = mergedRequests;
          if (result.applied === true){
            recordEconomyChange(u, 'purchase', -price, purchaseRef, { category, itemId: id, price }, false);
          }
          saveDB();
          this.sendText(JSON.stringify({
            type: 'purchase_ok',
            payload: { category, id, replayed: result.duplicate === true, alreadyOwned: result.alreadyOwned === true, profile: profileObj(u) },
          }));
          broadcastLeaderboard();
        });
        return;
      }
      if (requestId && u.purchaseRequests.includes(requestId)){
        this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, replayed: true, profile: profileObj(u) } }));
        return;
      }
      if (ownsItem(u, category, id)){
        if (requestId) u.purchaseRequests = u.purchaseRequests.concat(requestId).slice(-100);
        saveDB(); sbSyncProfile(u);
        this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, alreadyOwned: true, profile: profileObj(u) } }));
        return;
      }
      if ((u.coins || 0) < price){
        this.sendText(JSON.stringify({ type: 'purchase_error', msg: '余额不足，先去赢几局吧', reason: 'insufficient_balance' }));
        return;
      }
      u.coins -= price;
      u.owned[category].push(id);
      u.owned = normalizeOwned(u.owned);
      if (requestId) u.purchaseRequests = u.purchaseRequests.concat(requestId).slice(-100);
      recordEconomyChange(u, 'purchase', -price, requestId || ('purchase:' + category + ':' + id + ':' + Date.now()), {
        category, itemId: id, price,
      });
      saveDB();
      sbSyncProfile(u);
      this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, profile: profileObj(u) } }));
      broadcastLeaderboard();
      return;
    }
    if (type === 'logout'){
      const u = this.requireUser();
      if (!u) return;
      if (this.tokenHash && Array.isArray(u.authTokens)){
        u.authTokens = u.authTokens.filter(record => {
          const parsed = parseAuthTokenRecord(record);
          return !parsed || !secureEqual(parsed.hash, this.tokenHash);
        });
      }
      if (this.spectatorRoom) this.leaveSpectator();
      if (this.room) this.leaveRoom();
      this.uid = null; this.tokenHash = null;
      saveDB(); sbSyncAuthProfile(u);
      this.sendText(JSON.stringify({ type: 'logged_out' }));
      broadcastLeaderboard(); broadcastLobby();
      cleanupEphemeralUser(u.uid);
      return;
    }
    if (type === 'solo_start'){
      const user = this.requireUser();
      if (!user) return;
      beginSoloMatch(this, user, payload);
      return;
    }
    if (type === 'ai_decision_confirm'){
      const user = this.requireUser();
      if (!user) return;
      if (!this.room) confirmSoloAIDecision(this, user, payload);
      return;
    }
    if (type === 'solo_progress'){
      const user = this.requireUser();
      if (!user) return;
      if (!this.room) recordSoloProgress(this, user, payload);
      return;
    }
    if (type === 'result'){
      const user = this.requireUser();
      if (!user) return;
      if (!this.room){
        settleSoloMatch(this, user, payload);
        return;
      }
      const r = rooms.get(this.room);
      if (!r || !r.clients.has(this)){ this.sendText(JSON.stringify({ type: 'result_error', msg: '房间状态无效', reason: 'invalid_room_state' })); return; }
      submitRoomResult(this, payload, r);
      return;
    }
    if (type === 'leaderboard'){
      this.sendText(JSON.stringify({ type: 'leaderboard', payload: leaderboardPayload() }));
      return;
    }
    if (type === 'lobby'){
      this.sendText(JSON.stringify({ type: 'lobby', payload: lobbyPayload() }));
      return;
    }
    if (type === 'invite_accept'){
      if (!this.requireUser()) return;
      const roomId = String((payload && payload.room) || '').trim().toUpperCase();
      this.joinRoom(roomId, true);
      return;
    }
    if (type === 'invite_decline'){
      if (!this.requireUser()) return;
      const roomId = String((payload && payload.room) || '').trim().toUpperCase();
      const r = rooms.get(roomId);
      if (r) r.host.sendText(JSON.stringify({ type: 'invite_result', payload: { accepted: false } }));
      return;
    }
    if (type === 'create'){
      if (!this.requireUser()) return;
      if (this.room || this.spectatorRoom) return;
      let roomId = genCode();
      while (rooms.has(roomId)) roomId = genCode();
      const cap = Math.min(5, Math.max(2, parseInt(payload && payload.capacity, 10) || 2));
      const r = {
        id: roomId, host: this, clients: new Map([[this, 0]]), game: null, capacity: cap,
        started: false, matchId: null, resultClaims: new Map(), settled: false, disputed: false,
        moveSeq: 0, moveLog: [], moveLogBytes: 0, moveLogTruncated: false,
        tankInputSeq: {}, tankAuthoritySeq: 0, tankFinalSent: false,
        startedAt: 0, rewardProgress: null, resultRewards: new Map(),
        spectators:new Map(), maxSpectators:Math.max(1,Math.min(50,Number(process.env.MAX_SPECTATORS)||12)),
        spectatorDelayMs:Math.max(0,Math.min(30000,Number(process.env.SPECTATOR_DELAY_MS)||0)), gameSnapshot:null,
        tetrisPresentation:new Map(),
      };
      rooms.set(roomId, r);
      this.room = roomId;
      this.player = 0;
      this.sendText(JSON.stringify({ type: 'created', room: roomId, player: 0, capacity: cap }));
      broadcastRoom(r);
      broadcastLobby();
      return;
    }
    if (type === 'join'){
      if (!this.requireUser()) return;
      this.joinRoom(String((payload && payload.room) || '').trim().toUpperCase(), false);
      return;
    }
    if (type === 'spectate_join'){
      if (!this.requireUser()) return;
      if (this.room){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'已占用玩家席位，不能同时观战', reason:'account_is_player' })); return; }
      if (this.spectatorRoom){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'请先退出当前观战房间', reason:'already_spectating' })); return; }
      const roomId = String(payload && (payload.roomId || payload.room) || '').trim().toUpperCase();
      const target = rooms.get(roomId);
      if (!target){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'房间不存在', reason:'room_not_found' })); return; }
      if (!target.started || !target.matchId){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'对局尚未开始', reason:'match_not_started' })); return; }
      const requestedMatchId=String(payload && payload.matchId || '');
      if (!requestedMatchId || requestedMatchId !== String(target.matchId || '')){
        this.sendText(JSON.stringify({ type:'spectator_error', msg:'对局标识已失效', reason:'match_id_expired' })); return;
      }
      target.spectators = target.spectators instanceof Map ? target.spectators : new Map();
      const accepted=spectatorAccessGuard.join({
        sessionId:this.sessionId,
        uid:this.uid,
        roomId:target.id,
        started:target.started===true,
        matchId:String(target.matchId),
        requestedMatchId,
        currentSpectatorRoomId:this.spectatorRoom,
        currentPlayerRoomIds:[...sessions].filter(session=>session.uid===this.uid&&session.room).map(session=>session.room),
        targetPlayerUids:[...target.clients.keys()].map(session=>session.uid).filter(Boolean),
        targetSpectatorUids:[...target.spectators.keys()].map(session=>session.uid).filter(Boolean),
        maxSpectators:target.maxSpectators,
      });
      if(!accepted.ok){
        const messages={spectator_capacity:'观众席已满',account_is_player:'参赛账号不能重复进入观众席',duplicate_spectator_identity:'同一账号已有观战连接',cross_room_join:'请先退出当前观战房间'};
        this.sendText(JSON.stringify({type:'spectator_error',msg:messages[accepted.reason]||'当前无法加入观众席',reason:accepted.reason}));
        return;
      }
      target.spectators.set(this, { uid:this.uid, joinedAt:Date.now() });
      this.spectatorRoom = target.id;
      this.sendText(JSON.stringify({ type:'spectate_joined', payload:spectatorSnapshot(target) }));
      broadcastRoom(target); broadcastLobby();
      return;
    }
    if (type === 'spectate_leave'){
      if (!this.requireUser()) return;
      this.leaveSpectator();
      return;
    }
    if (type === 'tournament_create'){
      if (!this.requireUser()) return;
      const ids = Array.isArray(payload && payload.participants) ? payload.participants.map(String) : [];
      const gameId=String(payload && payload.gameId || '');
      if (!ids.includes(this.uid) || ids.length < 3 || ids.some(uid=>!db.users[uid])){ this.sendText(JSON.stringify({ type:'tournament_error', msg:'赛事参与者无效', reason:'invalid_participants' })); return; }
      try {
        const tournamentId='tour_'+crypto.randomBytes(9).toString('base64url');
        const guarded=tournamentGuard.create({tournamentId,ownerUid:this.uid,gameId,participants:ids});
        if(!guarded.ok){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事创建受限：'+guarded.reason,reason:guarded.reason}));return;}
        const tournament=new TournamentOrchestrator({ tournamentId, gameId, participants:ids, rounds:3 });
        const entry={ ownerUid:this.uid, tournament };tournaments.set(tournamentId,entry);broadcastTournament(entry);
      } catch (error){ this.sendText(JSON.stringify({ type:'tournament_error', msg:String(error && error.message || '赛事创建失败'), reason:'tournament_create_failed' })); }
      return;
    }
    if(type==='tournament_consent'){
      if (!this.requireUser()) return;
      const tournamentId=String(payload && payload.tournamentId || '');
      const entry=tournaments.get(tournamentId);
      if (!entry || !entry.tournament.participants.some(item=>item.id===this.uid)){ this.sendText(JSON.stringify({ type:'tournament_error', msg:'赛事不存在或无权访问', reason:'tournament_access_denied' })); return; }
      const result=tournamentGuard.consent(tournamentId,this.uid,payload&&payload.accepted===true);
      if(!result.ok&&result.reason!=='participant_declined'){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事确认失败：'+result.reason,reason:result.reason}));return;}
      broadcastTournament(entry);
      return;
    }
    if(type==='tournament_bind'){
      if(!this.requireUser())return;
      const tournamentId=String(payload&&payload.tournamentId||''),pairingId=String(payload&&payload.pairingId||'');
      const entry=tournaments.get(tournamentId),pairing=entry&&entry.tournament.pairings.find(item=>item.pairingId===pairingId);
      const roomId=String(payload&&payload.roomId||this.room||'').trim().toUpperCase(),matchRoom=rooms.get(roomId);
      if(!entry||!pairing||!pairing.players.includes(this.uid)){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事桌位不存在或无权绑定',reason:'pairing_access_denied'}));return;}
      if(!matchRoom||!matchRoom.started||!matchRoom.matchId||matchRoom.game!==entry.tournament.gameId||this.room!==matchRoom.id){this.sendText(JSON.stringify({type:'tournament_error',msg:'只能绑定当前已开始且游戏一致的真实房间',reason:'invalid_binding_room'}));return;}
      const roomPlayers=[...matchRoom.clients.keys()].map(session=>session.uid).filter(Boolean);
      if(roomPlayers.length!==pairing.players.length||roomPlayers.some(uid=>!pairing.players.includes(uid))){this.sendText(JSON.stringify({type:'tournament_error',msg:'当前房间玩家与赛事桌位不一致',reason:'players_mismatch'}));return;}
      if(matchRoom.tournamentBinding){
        const same=matchRoom.tournamentBinding.tournamentId===tournamentId&&matchRoom.tournamentBinding.pairingId===pairingId&&matchRoom.tournamentBinding.matchId===matchRoom.matchId;
        if(!same){this.sendText(JSON.stringify({type:'tournament_error',msg:'该房间已绑定其他赛事桌位',reason:'match_already_bound'}));return;}
        broadcastTournament(entry);return;
      }
      const bound=tournamentGuard.bindMatch(tournamentId,pairingId,{matchId:matchRoom.matchId,gameId:matchRoom.game,players:roomPlayers});
      if(!bound.ok){this.sendText(JSON.stringify({type:'tournament_error',msg:'绑定失败：'+bound.reason,reason:bound.reason}));return;}
      const attached=entry.tournament.attachMatchRoom(pairingId,matchRoom.id,{source:'tournament',gameId:matchRoom.game,serverMatchId:matchRoom.matchId});
      if(!attached.ok){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事桌位绑定失败',reason:'pairing_bind_failed'}));return;}
      matchRoom.tournamentBinding={tournamentId,pairingId,matchId:matchRoom.matchId,players:roomPlayers.slice()};
      broadcastTournament(entry);
      return;
    }
    if (['tournament_start','tournament_result','tournament_next','tournament_get'].includes(type)){
      if (!this.requireUser()) return;
      const tournamentId=String(payload && payload.tournamentId || '');
      const entry=tournaments.get(tournamentId);
      const guardState=entry&&tournamentGuard.snapshot(tournamentId);
      if (!entry || !guardState || ['expired','declined','cancelled'].includes(guardState.status) || !entry.tournament.participants.some(item=>item.id===this.uid)){ this.sendText(JSON.stringify({ type:'tournament_error', msg:'赛事不存在、已过期或无权访问', reason:'tournament_unavailable' })); return; }
      if(type==='tournament_result'){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事结果只能由已绑定的真实房间自动回传',reason:'server_result_required'}));return;}
      if (type!=='tournament_get' && entry.ownerUid!==this.uid){ this.sendText(JSON.stringify({ type:'tournament_error', msg:'只有赛事创建者可以推进赛事', reason:'owner_only' })); return; }
      let result={ok:true};
      if(type==='tournament_start'){
        const ready=tournamentParticipantSessions(entry);
        if(!ready.ok){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事无法自动建桌：'+ready.reason,reason:ready.reason}));return;}
        result=tournamentGuard.start(tournamentId,this.uid);
        if(result.ok&&entry.tournament.start()===false)result={ok:false,reason:'invalid_status'};
        if(result.ok&&!registerTournamentPairings(entry))result={ok:false,reason:'pairing_registration_failed'};
        if(result.ok){const created=autoCreateTournamentRound(entry,ready);if(!created.ok)result=created;}
      }
      else if(type==='tournament_next'){
        const ready=tournamentParticipantSessions(entry);
        if(!ready.ok){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事无法自动建桌：'+ready.reason,reason:ready.reason}));return;}
        const next=entry.tournament.advance();
        if(!next)result={ok:false,reason:'round_not_complete'};
        else if(!registerTournamentPairings(entry))result={ok:false,reason:'pairing_registration_failed'};
        else{const created=autoCreateTournamentRound(entry,ready);if(!created.ok)result=created;}
      }
      if(result&&result.ok===false){this.sendText(JSON.stringify({type:'tournament_error',msg:result.reason,reason:result.reason}));return;}
      broadcastTournament(entry);
      return;
    }
    if (type === 'leave'){
      if (!this.requireUser()) return;
      if (this.spectatorRoom) this.leaveSpectator(); else this.leaveRoom();
      return;
    }
    if (!this.requireUser()) return;
    if (this.spectatorRoom){
      if (['move','tank_input','tetris_lock_claim','tetris_attack_claim','tetris_ko_claim','tetris_action','xiangqi_action','monopoly_action','monopoly_auction_open','monopoly_bid','game_state','start','restart','end_game','select_game'].includes(type)){
        this.sendText(JSON.stringify({ type:'spectator_error', msg:'观战模式为只读，不能发送游戏输入', reason:'spectator_readonly' }));
      }
      return;
    }
    if (!this.room) return;
    const r = rooms.get(this.room);
    if (!r) return;
    if (type === 'tetris_action'){
      const authority=r.tetrisRuleAuthority;
      if(!authority){incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.tetrisRules,'ERR_PROTOCOL_VERSION')}));return;}
      if(!payload||String(payload.matchId||'')!==String(r.matchId||'')){incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.tetrisRules,'ERR_INVALID_STATE',{reason:'invalid_match'})}));return;}
      const accepted=authority.acceptAction(this.player,payload,Date.now());
      if(!accepted.ok){incrementGameplayMetric('invalidTetrisActions');incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.tetrisRules,accepted.reason,{reason:accepted.reason})}));return;}
      incrementGameplayMetric('tetrisInputs');if(accepted.battle)incrementGameplayMetric('garbageEvents');
      recordRoomAction(r,this.player,{protocol:PROTOCOL_VERSIONS.tetrisRules,action:payload&&payload.action});if(accepted.battle)broadcast(r,{type:'tetris_rule_battle',payload:{matchId:r.matchId,revision:authority.revision,...accepted.battle}});broadcast(r,accepted.stateEvent||authority.stateEvent());
      if(accepted.result&&!r.gameplayResultSent){r.gameplayResultSent=true;broadcast(r,accepted.result);settleAuthoritativeRoom(r,accepted.result.order,'tetris_rule_authority');stopRoomGameplayTimer(r);}return;
    }
    if (type === 'xiangqi_action'){
      const authority=r.xiangqiRuleAuthority;
      if(!authority){incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.xiangqiRules,'ERR_PROTOCOL_VERSION')}));return;}
      if(!payload||String(payload.matchId||'')!==String(r.matchId||'')){incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.xiangqiRules,'ERR_INVALID_STATE',{reason:'invalid_match'})}));return;}
      const accepted=authority.acceptMove(this.player,payload,Date.now());
      if(!accepted.ok){incrementGameplayMetric('invalidXiangqiMoves');incrementGameplayMetric('protocolErrors');if(accepted.timeout){incrementGameplayMetric('clockTimeouts');r.gameplayResultSent=true;broadcast(r,accepted.timeout);settleAuthoritativeRoom(r,[accepted.timeout.payload.winner,accepted.timeout.payload.loser],'xiangqi_rule_timeout');stopRoomGameplayTimer(r);}else this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.xiangqiRules,accepted.reason,{reason:accepted.reason})}));return;}
      incrementGameplayMetric('xiangqiMoves');
      recordRoomAction(r,this.player,{protocol:PROTOCOL_VERSIONS.xiangqiRules,from:payload&&payload.from,to:payload&&payload.to});broadcast(r,accepted.event);if(accepted.result&&!r.gameplayResultSent){r.gameplayResultSent=true;broadcast(r,accepted.result);settleAuthoritativeRoom(r,accepted.result.order,'xiangqi_rule_authority');stopRoomGameplayTimer(r);}return;
    }
    if (type === 'monopoly_action'){
      const authority=r.monopolyRuleAuthority;
      if(!authority){incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.monopolyRules,'ERR_PROTOCOL_VERSION')}));return;}
      if(!payload||String(payload.matchId||'')!==String(r.matchId||'')){incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.monopolyRules,'ERR_INVALID_STATE',{reason:'invalid_match'})}));return;}
      const accepted=authority.acceptAction(this.player,payload,Date.now());
      if(!accepted.ok){incrementGameplayMetric('protocolErrors');this.sendText(JSON.stringify({type:'gameplay_error',payload:protocolError(PROTOCOL_VERSIONS.monopolyRules,accepted.reason,{reason:accepted.reason})}));return;}
      incrementGameplayMetric('monopolyActions');if(payload&&payload.action&&payload.action.type==='pass')incrementGameplayMetric('auctionCount');
      r.monopolyTurn=authority.state.current;recordRoomAction(r,this.player,{protocol:PROTOCOL_VERSIONS.monopolyRules,action:payload&&payload.action});broadcast(r,accepted.event);if(accepted.result&&!r.gameplayResultSent){r.gameplayResultSent=true;broadcast(r,accepted.result);settleAuthoritativeRoom(r,accepted.result.order,'monopoly_rule_authority');stopRoomGameplayTimer(r);}return;
    }
    if (type === 'invite'){
      if (this !== r.host) return;
      const toUid = payload && payload.toUid;
      if (!toUid) return;
      if (!db.users[toUid] || db.users[toUid].ephemeral){
        this.sendText(JSON.stringify({ type: 'error', msg: '受邀玩家不存在', reason: 'invitee_missing' }));
        return;
      }
      const joinLimit = r.game && GAME_MAX[r.game] ? Math.min(r.capacity, GAME_MAX[r.game]) : r.capacity;
      if (r.started || r.clients.size >= joinLimit) return;
      if ([...r.clients.keys()].some(c => c.uid === toUid)) return;
      const fromU = this.uid ? db.users[this.uid] : null;
      const inv = { fromUid: this.uid, fromName: fromU ? fromU.name : '玩家', room: r.id, game: r.game || null, expiresAt: Date.now() + 10 * 60000 };
      let target = null;
      for (const s of sessions){ if (s.uid === toUid && s !== this){ target = s; break; } }
      if (target){
        target.sendText(JSON.stringify({ type: 'invite', payload: inv }));
      } else {
        if (!pendingInvites.has(toUid)) pendingInvites.set(toUid, []);
        const pending = pendingInvites.get(toUid).filter(x => x && x.expiresAt > Date.now() && !(x.fromUid === inv.fromUid && x.room === inv.room));
        pending.push(inv);
        pendingInvites.set(toUid, pending.slice(-20));
      }
      return;
    }
    if (type === 'select_game'){
      if (this !== r.host) return;
      const g = payload && payload.game;
      if (!g) return;
      const curSize = r.clients.size;
      if (!GAME_MAX[g] || curSize > GAME_MAX[g]){
        this.sendText(JSON.stringify({ type: 'error', msg: '该游戏最多支持 ' + (GAME_MAX[g] || 0) + ' 人，当前已加入 ' + curSize + ' 人', reason: 'game_capacity' }));
        return;
      }
      r.game = g;
      broadcastRoom(r);
      broadcastLobby();
      maybeAutoStart(r);
      return;
    }
    if (type === 'end_game'){
      if (this !== r.host) return;
      if (r.started && !r.settled){
        if (r.clients.size === 2) settleRoomForfeit(r, this, 'forfeit');
        else settleRoomNoContest(r, 'host_cancelled');
      }
      resetRoomMatch(r);
      r.game = null;
      broadcast(r, { type: 'end_game' });
      broadcastRoom(r);
      broadcastLobby();
      return;
    }
    if (type === 'start'){
      if (this !== r.host) return;
      if (!r.game || r.started) return;
      if (r.clients.size < GAME_MIN[r.game] || r.clients.size > GAME_MAX[r.game]) return;
      if (!allRoomClientsOnline(r)){
        this.sendText(JSON.stringify({ type: 'error', msg: '请等待掉线玩家恢复连接后再开始', reason: 'wait_reconnect_start' }));
        return;
      }
      startRoomMatch(r);
      return;
    }
    if (type === 'tank_input'){
      if (!r.started || r.game !== 'tank' || !r.tankAuthority){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:'not_active' } }));
        return;
      }
      const accepted = r.tankAuthority.acceptInput(this.player, payload, Date.now());
      if (!accepted.ok){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:accepted.reason } }));
        return;
      }
      recordRoomAction(r, this.player, { act:'input', input:payload && payload.input });
      incrementGameplayMetric('tankInputs');
      return;
    }
    if (type === 'game_state'){
      if(r.tankAuthority||r.tetrisAuthority||r.tetrisRuleAuthority||r.xiangqiRuleAuthority||r.monopolyRuleAuthority){
        this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:gameplayMetadata(r)&&gameplayMetadata(r).protocol||'server-authority',reason:'client_snapshot_rejected'}}));
        return;
      }
      if (!r.started || this !== r.host || !payload || String(payload.matchId || '') !== String(r.matchId || '')) return;
      let bytes=0;try{bytes=Buffer.byteLength(JSON.stringify(payload.snapshot));}catch{return;}
      if(bytes>131072)return;
      if(r.game==='monopoly'){
        const state=payload.snapshot&&payload.snapshot.state?payload.snapshot.state:payload.snapshot,next=Number(state&&state.cur);
        if(r.monopolyAuction&&typeof r.monopolyAuction.syncClientState==='function'){
          const synced=r.monopolyAuction.syncClientState(payload.snapshot);
          if(!synced.ok){
            this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'monopoly-auction-v1',reason:synced.reason||'invalid_state'}}));
            return;
          }
          r.monopolyTurn=r.monopolyAuction.currentPlayer;
        }else if(Number.isInteger(next)&&next>=0&&next<r.clients.size)r.monopolyTurn=next;
      }
      r.gameSnapshot={matchId:r.matchId,revision:(r.gameSnapshot&&r.gameSnapshot.revision||0)+1,updatedAt:Date.now(),snapshot:payload.snapshot};
      broadcast(r,{type:'game_state',payload:r.gameSnapshot},this);
      return;
    }
    if (type === 'tetris_state'){
      if(!r.started||r.game!=='tetris'||!r.tetrisAuthority){
        this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'tetris-battle-authority-v1',reason:'not_active'}}));
        return;
      }
      let bytes=0;try{bytes=Buffer.byteLength(JSON.stringify(payload));}catch{return;}
      if(bytes>65536){
        this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'tetris-battle-authority-v1',reason:'invalid_payload'}}));
        return;
      }
      const accepted=r.tetrisAuthority.acceptPresentation(this.player,payload,Date.now());
      if(!accepted.ok){
        incrementGameplayMetric('invalidTetrisPresentations');
        this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'tetris-battle-authority-v1',reason:accepted.reason}}));
        return;
      }
      r.tetrisPresentation=r.tetrisPresentation instanceof Map?r.tetrisPresentation:new Map();
      r.tetrisPresentation.set(this.player,{
        seq:accepted.payload.seq,
        updatedAt:accepted.payload.updatedAt,
        state:accepted.payload.state,
      });
      broadcast(r,{type:'tetris_state',payload:accepted.payload},this);
      return;
    }
    if (type === 'monopoly_auction_open'){
      if (!r.started || r.game!=='monopoly' || !r.monopolyAuction || this.player!==r.monopolyTurn){
        this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'monopoly-auction-v1',reason:'not_current_player'}}));return;
      }
      const accepted=r.monopolyAuction.open(this.player,payload,Date.now());
      if(!accepted.ok){this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'monopoly-auction-v1',reason:accepted.reason}}));return;}
      broadcast(r,accepted.event);return;
    }
    if (type === 'monopoly_bid'){
      if(!r.started||r.game!=='monopoly'||!r.monopolyAuction){this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'monopoly-auction-v1',reason:'not_active'}}));return;}
      const accepted=r.monopolyAuction.bid(this.player,payload,Date.now());
      if(!accepted.ok){if(accepted.closed)broadcast(r,accepted.closed);this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'monopoly-auction-v1',reason:accepted.reason}}));return;}
      broadcast(r,accepted.event);return;
    }
    if (type === 'monopoly_turn_end'){
      if(!r.started||r.game!=='monopoly'||this.player!==r.monopolyTurn)return;
      const next=Number(payload&&payload.nextPlayer);
      if(r.monopolyAuction&&((r.monopolyAuction.phase&&r.monopolyAuction.phase!=='turn_complete')||r.monopolyAuction.lastCompletedPlayer!==this.player))return;
      const accepted=typeof r.monopolyAuction.confirmTurn==='function'?r.monopolyAuction.confirmTurn(this.player,{...(payload||{}),matchId:r.matchId}):{ok:true};
      if(!accepted.ok){this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'monopoly-auction-v1',reason:accepted.reason}}));return;}
      r.monopolyTurn=Number.isInteger(next)&&next>=0&&next<r.clients.size&&next!==this.player?next:(r.monopolyTurn+1)%r.clients.size;
      return;
    }
    if (type === 'tetris_lock_claim' || type === 'tetris_attack_claim'){
      if (!r.started || r.game !== 'tetris' || !r.tetrisAuthority){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tetris-battle-authority-v1', reason:'not_active' } }));
        return;
      }
      if (!payload || String(payload.matchId || '') !== String(r.matchId || '')){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tetris-battle-authority-v1', reason:'invalid_match' } }));
        return;
      }
      const accepted = r.tetrisAuthority.claimLock(this.player, payload, Date.now());
      if (!accepted.ok){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tetris-battle-authority-v1', reason:accepted.reason } }));
        return;
      }
      recordRoomAction(r, this.player, { piece:payload.piece, x:payload.x, y:payload.y, rot:payload.rot });
      broadcast(r, accepted.event);
      return;
    }
    if (type === 'tetris_ko_claim'){
      if (!r.started || r.game !== 'tetris' || !r.tetrisAuthority || !payload || String(payload.matchId || '') !== String(r.matchId || '')){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tetris-battle-authority-v1', reason:'not_active' } }));
        return;
      }
      const accepted = r.tetrisAuthority.claimKO(this.player, payload, Date.now());
      if (!accepted.ok){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tetris-battle-authority-v1', reason:accepted.reason } }));
        return;
      }
      recordRoomAction(r, this.player, { piece:payload.piece, x:payload.x, y:payload.y, rot:payload.rot });
      broadcast(r, accepted.event);
      if (accepted.result && !r.gameplayResultSent){
        r.gameplayResultSent = true;
        broadcast(r, accepted.result);
        settleAuthoritativeRoom(r, accepted.result.order, 'tetris_authority');
        stopRoomGameplayTimer(r);
      }
      return;
    }
    if (type === 'move'){
      if (!r.started) return;
      if (!payload || typeof payload !== 'object') return;
      const ruleProtocol=r.tankAuthority?'tank-authority-v1':r.tetrisRuleAuthority?PROTOCOL_VERSIONS.tetrisRules:
        r.tetrisAuthority?'tetris-battle-authority-v1':r.xiangqiRuleAuthority?PROTOCOL_VERSIONS.xiangqiRules:
          r.monopolyRuleAuthority?PROTOCOL_VERSIONS.monopolyRules:'';
      if (ruleProtocol){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:ruleProtocol, reason:'legacy_move_rejected' } }));
        return;
      }
      if (r.game === 'xiangqi' && r.xiangqiClock){
        if (!validCoord(payload.from,10,9) || !validCoord(payload.to,10,9)) return;
        const clockResult=r.xiangqiClock.acceptMove(this.player,{...payload,matchId:r.matchId},Date.now());
        if(!clockResult.ok){
          if(clockResult.timeout){r.gameplayResultSent=true;broadcast(r,clockResult.timeout);settleAuthoritativeRoom(r,[clockResult.timeout.payload.winner,clockResult.timeout.payload.loser],'xiangqi_clock_timeout');stopRoomGameplayTimer(r);}
          else this.sendText(JSON.stringify({type:'gameplay_error',payload:{protocol:'xiangqi-clock-v1',reason:clockResult.reason}}));
          return;
        }
        broadcast(r,{type:'clock_state',payload:clockResult.state});
      }
      if (r.game === 'monopoly' && payload.decision === 'settle' && this !== r.host){
        this.sendText(JSON.stringify({ type: 'error', msg: '只有房主可以提前结算', reason: 'host_only_settle' }));
        return;
      }
      let payloadBytes = 0;
      try { payloadBytes = Buffer.byteLength(JSON.stringify(payload)); } catch { return; }
      if (payloadBytes > 16384){
        this.sendText(JSON.stringify({ type: 'error', msg: '走子消息过大', reason: 'move_too_large' }));
        return;
      }
      if (!acceptTankRelayPayload(r, this, payload)) return;
      compactTankRelayLog(r,payload);
      r.moveSeq = (r.moveSeq || 0) + 1;
      const event = { seq: r.moveSeq, player: this.player, payload };
      if (!Array.isArray(r.moveLog)) r.moveLog = [];
      r.moveLog.push(event);
      r.moveLogBytes = (r.moveLogBytes || 0) + payloadBytes;
      while (r.moveLog.length > MOVE_LOG_MAX_EVENTS || r.moveLogBytes > MOVE_LOG_MAX_BYTES){
        const removed = r.moveLog.shift();
        try { r.moveLogBytes -= Buffer.byteLength(JSON.stringify(removed && removed.payload)); } catch {}
        r.moveLogTruncated = true;
      }
      recordRoomAction(r, this.player, payload);
      broadcast(r, { type: 'move', payload, seq: event.seq, player: event.player }, this);
      return;
    }
    if (type === 'restart'){
      if (this !== r.host) return;
      if (!r.game || !r.started) return;
      if (!r.settled){
        if (r.clients.size === 2) settleRoomForfeit(r, this, 'forfeit');
        else settleRoomNoContest(r, 'host_restarted_early');
      }
      stopRoomAuthorities(r);
      r.matchId = crypto.randomBytes(12).toString('base64url');
      r.resultClaims = new Map();
      r.settled = false;
      r.disputed = false;
      r.moveSeq = 0;
      r.moveLog = [];
      r.moveLogBytes = 0;
      r.moveLogTruncated = false;
      r.tankInputSeq = {};
      r.tankAuthoritySeq = 0;
      r.tankFinalSent = false;
      r.startedAt = Date.now();
      r.rewardProgress = { startedAt: r.startedAt, lastActionAt: r.startedAt, meaningfulActions: 0, byPlayer: {}, uniqueActions: new Set() };
      r.resultRewards = new Map();
      r.gameplayResultSent = false;
      r.gameSnapshot = null;
      r.tetrisPresentation = new Map();
      r.tournamentBinding = null;
      r.finalResult = null;
      startRoomAuthorities(r);
      recordAnalytics('match_started', {
        matchId: r.matchId, game: r.game, mode: 'online',
        metadata: { participantCount: r.clients.size, restarted: true },
      });
      broadcast(r, { type: 'restart', matchId: r.matchId, gameplay:gameplayMetadata(r), presentation:gameplayPresentation(r) });
    }
  }
  joinRoom(roomId, fromInvite){
    const r = rooms.get(roomId);
    if (!r){
      this.sendText(JSON.stringify({ type: 'error', msg: '房间不存在', reason: 'room_not_found' }));
      return;
    }
    if (r.started){
      this.sendText(JSON.stringify({ type: 'error', msg: '对局已开始', reason: 'match_started' }));
      return;
    }
    if (r.clients.size >= r.capacity){
      this.sendText(JSON.stringify({ type: 'error', msg: '房间已满', reason: 'room_full' }));
      return;
    }
    if (r.game && GAME_MAX[r.game] && r.clients.size + 1 > GAME_MAX[r.game]){
      this.sendText(JSON.stringify({ type: 'error', msg: '当前已选择的游戏最多支持 ' + GAME_MAX[r.game] + ' 人', reason: 'selected_game_capacity' }));
      return;
    }
    if (this.uid && [...r.clients.keys()].some(c => c.uid === this.uid)){
      this.sendText(JSON.stringify({ type: 'error', msg: '同一账号不能重复加入同一房间', reason: 'duplicate_room_account' }));
      return;
    }
    if (this.room){
      this.sendText(JSON.stringify({ type: 'error', msg: '你已在房间中', reason: 'already_in_room' }));
      return;
    }
    let idx = 0;
    const taken = new Set(r.clients.values());
    while (taken.has(idx)) idx++;
    r.clients.set(this, idx);
    this.room = roomId;
    this.player = idx;
    this.sendText(JSON.stringify({ type: 'joined', room: roomId, player: idx }));
    broadcastRoom(r);
    if (fromInvite) r.host.sendText(JSON.stringify({ type: 'invite_result', payload: { accepted: true } }));
    broadcastLobby();
    maybeAutoStart(r);
  }
  leaveRoom(){
    if (!this.room) return;
    const r = rooms.get(this.room);
    if (!r){ this.room = null; this.player = null; return; }
    const wasHost = this === r.host;
    const departedPlayer = r.clients.get(this);
    if (r.started && !r.settled) settleRoomForfeit(r, this, 'forfeit');
    r.clients.delete(this);
    this.room = null;
    this.player = null;
    if (wasHost){
      const remaining = [...r.clients.keys()];
      const spectators = r.spectators ? [...r.spectators.keys()] : [];
      for (const c of remaining){
        if (c.reconnectTimer) clearTimeout(c.reconnectTimer);
        c.reconnectTimer = null;
        c.room = null;
        c.player = null;
        c.resumeUntil = 0;
        c.sendText(JSON.stringify({ type: 'peer_left', payload: { roomClosed: true, player: departedPlayer } }));
      }
      for(const spectator of spectators){
        spectatorAccessGuard.leave(spectator.sessionId);
        spectator.spectatorRoom=null;
        spectator.sendText(JSON.stringify({type:'peer_left',payload:{roomClosed:true,player:departedPlayer}}));
      }
      stopRoomAuthorities(r);
      rooms.delete(r.id);
      broadcastLobby();
      for (const c of remaining) cleanupEphemeralUser(c.uid);
    } else {
      if (r.clients.size === 0){ rooms.delete(r.id); return; }
      resetRoomMatch(r);
      compactRoomPlayers(r);
      broadcast(r, { type: 'peer_left', payload: { roomClosed: false, player: departedPlayer } });
      broadcastRoom(r);
      broadcastLobby();
    }
  }
  leaveSpectator(){
    if(!this.spectatorRoom)return;
    const r=rooms.get(this.spectatorRoom);this.spectatorRoom=null;
    spectatorAccessGuard.leave(this.sessionId);
    if(!r||!r.spectators)return;
    r.spectators.delete(this);broadcastRoom(r);broadcastLobby();
  }
  close(intentional){
    if (!this.alive) return;
    const uid = this.uid;
    this.alive = false;
    sessions.delete(this);
    if(this.spectatorRoom)this.leaveSpectator();
    const retained = !intentional && detachForReconnect(this);
    if (!retained) this.leaveRoom();
    try { this.socket.destroy(); } catch {}
    if (!retained) cleanupEphemeralUser(uid);
  }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  let upgradePath = '';
  try { upgradePath = decodeURIComponent((req.url || '').split('?')[0]); } catch {}
  if (upgradePath !== '/ws' || !originAllowed(req) || !key || req.headers['sec-websocket-version'] !== '13'){
    try { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); } catch {}
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  const session = new Session(socket, req);
  sessions.add(session);
  socket.on('data', d => session.handleData(d));
  socket.on('close', () => session.close());
  socket.on('error', () => session.close());
});

const heartbeatSweep = setInterval(() => {
  const now = Date.now();
  for (const session of [...sessions]){
    if (session.alive && now - session.lastSeen >= HEARTBEAT_TIMEOUT_MS) session.close();
  }
  for (const room of rooms.values()){
    if (!room.started || room.settled) continue;
    const progress = roomProgress(room);
    if (now - Number(progress.lastActionAt || progress.startedAt || now) >= MATCH_IDLE_TIMEOUT_MS){
      settleRoomNoContest(room, 'afk_timeout');
      recordAnalytics('match_afk', { matchId: room.matchId, game: room.game, mode: 'online', metadata: { roomWide: true } });
    }
  }
  tournamentGuard.cleanup(now);
  for(const [tournamentId,entry] of tournaments){
    const state=tournamentGuard.snapshot(tournamentId,now);
    if(!state||['expired','declined','cancelled'].includes(state.status)||
        (state.status==='finished'&&now-Number(state.lastActivityAt||0)>60*60*1000)){
      if(state)broadcastTournament(entry);
      tournaments.delete(tournamentId);
    }
  }
  clearExpiredResumes();
}, Math.min(10000, Math.max(1000, Math.floor(HEARTBEAT_TIMEOUT_MS / 4))));
if (heartbeatSweep.unref) heartbeatSweep.unref();

sbLoadProfiles().finally(() => {
  server.listen(PORT, () => {
    console.log('小游戏合集在线服务已启动: http://localhost:' + PORT + (useSupabase ? '（Supabase 数据库已连接）' : '（本地 JSON 存储）'));
  });
});
// outbox 失败后不依赖下一次重启；同一 resultId 的 RPC 是幂等的，可安全重试。
if (useSupabase){
  const rewardSyncSweep = setInterval(() => { retryPendingRewardSync(); }, REWARD_SYNC_RETRY_MS);
  if (rewardSyncSweep.unref) rewardSyncSweep.unref();
  const aiLearningSyncSweep = setInterval(() => { retryPendingAILearningSync(); }, REWARD_SYNC_RETRY_MS);
  if (aiLearningSyncSweep.unref) aiLearningSyncSweep.unref();
}
