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
  if (Array.isArray(options) && options.length){
    return '游戏：' + name +
      '\n当前局面：' + stateText +
      '\n合法选项：' + options.map((o, i) => (i + 1) + '. ' + o).join('；') +
      '\n请从合法选项中选出最合理的一个，严格只返回 JSON：{"choice":"选项原文"}';
  }
  return '游戏：' + name +
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
  const base = '你是一个棋牌游戏 AI 助手。你只会输出合法、可执行的棋步，绝不编造不存在的选项。'
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
    const options = Array.isArray(body.options) ? body.options.slice(0, 200).map(v => String(v).slice(0, 240)) : null;
    let state = body.state;
    if (typeof state === 'string') state = state.slice(0, 16000);
    else {
      try { state = JSON.stringify(state).slice(0, 16000); } catch { state = ''; }
    }
    const personaId = body.persona && typeof body.persona === 'object' ? String(body.persona.id || '') : String(body.persona || '');
    const persona = AI_PERSONAS[personaId] || null;
    let choice = null;
    if (DEEPSEEK_KEY){
      try {
        choice = await askDeepSeek(game, state, options, persona);
      } catch (e) {
        console.error('AI 请求失败:', e.message);
      }
    }
    if (options && !options.includes(choice)) choice = null;
    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choice }));
  } finally {
    const userLeft = (aiConcurrentUser.get(user.uid) || 1) - 1;
    const ipLeft = (aiConcurrentIp.get(ip) || 1) - 1;
    if (userLeft > 0) aiConcurrentUser.set(user.uid, userLeft); else aiConcurrentUser.delete(user.uid);
    if (ipLeft > 0) aiConcurrentIp.set(ip, ipLeft); else aiConcurrentIp.delete(ip);
    aiGlobalConcurrent = Math.max(0, aiGlobalConcurrent - 1);
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
  if (req.method === 'GET' && urlPath === '/api/ip'){
    res.writeHead(200, { ...corsHeaders(req), 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ip: requestIp(req) }));
    return;
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
const expiredResumes = new Map(); // uid|tokenHash -> { room, player, expiresAt }
const soloMatches = new Map(); // uid -> 服务端签发的人机对局票据与进度
const GAME_MAX = { gomoku: 2, ludo: 4, monopoly: 5, tank: 2, tetris: 4, xiangqi: 2 };
const GAME_MIN = { gomoku: 2, ludo: 2, monopoly: 2, tank: 2, tetris: 2, xiangqi: 2 };
const AI_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const AI_PERSONA_IDS = new Set(Object.keys(AI_PERSONAS));

function normalizeRoomVisibility(value){ return value === 'private' ? 'private' : 'public'; }
function normalizeAIDifficulty(value){ return AI_DIFFICULTIES.has(value) ? value : 'normal'; }
function normalizeAIPersona(value){ return AI_PERSONA_IDS.has(value) ? value : 'teacher'; }
function emptySeat(seatId){
  return { seatId, type:'empty', userId:null, nickname:'', avatar:0, ready:false, host:false, online:false, aiDifficulty:null, aiPersona:null, controllerUid:null };
}
function humanSeatFromSession(session, seatId, host){
  const user = session && session.uid && db.users[session.uid];
  return {
    seatId, type:'human', userId:session && session.uid || null,
    nickname:user && user.name || '玩家' + (seatId + 1), avatar:user && user.avatar || 0,
    ready:!!host, host:!!host, online:!!(session && session.alive),
    aiDifficulty:null, aiPersona:null, controllerUid:null,
  };
}
function ensureRoomSeats(room){
  if (!room) return [];
  if (!Array.isArray(room.seats) || room.seats.length !== room.capacity){
    room.seats = Array.from({length:room.capacity}, (_, seatId) => emptySeat(seatId));
    for (const [session, seatId] of room.clients || []){
      if (seatId >= 0 && seatId < room.capacity) room.seats[seatId] = humanSeatFromSession(session, seatId, session === room.host);
    }
  }
  for (const [session, seatId] of room.clients || []){
    const seat = room.seats[seatId];
    if (!seat || seat.type !== 'human' || seat.userId !== session.uid){
      room.seats[seatId] = humanSeatFromSession(session, seatId, session === room.host);
    } else {
      const user = session.uid && db.users[session.uid];
      seat.nickname = user && user.name || seat.nickname;
      seat.avatar = user && user.avatar || seat.avatar || 0;
      seat.host = session === room.host;
      seat.online = !!session.alive;
    }
  }
  return room.seats;
}
function activeRoomSeats(room){ return ensureRoomSeats(room).filter(seat => seat.type !== 'empty'); }
function humanRoomSeats(room){ return activeRoomSeats(room).filter(seat => seat.type === 'human'); }
function aiRoomSeats(room){ return activeRoomSeats(room).filter(seat => seat.type === 'ai'); }
function activeSeatCount(room){ return activeRoomSeats(room).length; }
function firstEmptySeat(room){ return ensureRoomSeats(room).find(seat => seat.type === 'empty') || null; }
function seatForSession(room, session){
  const seatId = room && room.clients && room.clients.get(session);
  return Number.isInteger(seatId) ? ensureRoomSeats(room)[seatId] : null;
}
function publicSeat(seat){
  return {
    seatId:seat.seatId, type:seat.type, userId:seat.userId || null, nickname:seat.nickname || '', avatar:Number(seat.avatar)||0,
    ready:seat.type === 'ai' ? true : !!seat.ready, host:!!seat.host, online:seat.type === 'ai' ? true : !!seat.online,
    aiDifficulty:seat.type === 'ai' ? normalizeAIDifficulty(seat.aiDifficulty) : null,
    aiPersona:seat.type === 'ai' ? normalizeAIPersona(seat.aiPersona) : null,
    controllerUid:seat.type === 'ai' ? seat.controllerUid || null : null,
  };
}
function roomHostPayload(room){
  const seat = room && room.host ? seatForSession(room, room.host) : null;
  return { uid:room && room.host && room.host.uid || null, seatId:seat ? seat.seatId : null };
}
function updateAIControllers(room){
  const controllerUid = room && room.host && room.host.uid || null;
  for (const seat of aiRoomSeats(room)) seat.controllerUid = controllerUid;
}
function compactRoomSeats(room){
  if (!room) return;
  const oldSeats = activeRoomSeats(room).sort((a, b) => a.seatId - b.seatId);
  const sessionByUid = new Map([...(room.clients || new Map()).keys()].map(session => [session.uid, session]));
  room.clients = new Map();
  room.seats = Array.from({length:room.capacity}, (_, seatId) => emptySeat(seatId));
  oldSeats.forEach((oldSeat, seatId) => {
    const seat = { ...oldSeat, seatId, host:false };
    if (seat.type === 'human'){
      const session = sessionByUid.get(seat.userId);
      if (!session) return;
      const previous = session.player;
      session.player = seatId;
      room.clients.set(session, seatId);
      seat.host = session === room.host;
      seat.online = !!session.alive;
      if (previous !== seatId) session.sendText(JSON.stringify({ type:'player_reassigned', payload:{ player:seatId } }));
    }
    room.seats[seatId] = seat;
  });
  updateAIControllers(room);
}
function roomCanStart(room){
  if (!room || !room.game || room.started) return false;
  const count = activeSeatCount(room);
  if (count < GAME_MIN[room.game] || count > GAME_MAX[room.game]) return false;
  return humanRoomSeats(room).length > 0 && humanRoomSeats(room).every(seat => seat.online && seat.ready);
}

const PROTOCOL_VERSION = 2;
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
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);
const sbProfileQueues = new Map();
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
async function sbLoadSocial(){
  if (!useSupabase) return;
  try {
    const [requests, friendships, blocks, reports] = await Promise.all([
      sbFetch('friend_requests?select=*&status=eq.pending&limit=50000'),
      sbFetch('friendships?select=*&limit=50000'),
      sbFetch('blocks?select=*&limit=50000'),
      sbFetch('reports?select=*&limit=50000'),
    ]);
    db.friendRequests = (Array.isArray(requests) ? requests : []).map(r => ({ id:r.id, fromUid:r.from_uid, toUid:r.to_uid, status:r.status || 'pending', createdAt:Date.parse(r.created_at) || Date.now(), updatedAt:Date.parse(r.updated_at) || Date.now() }));
    db.friendships = (Array.isArray(friendships) ? friendships : []).map(r => ({ id:r.id || socialPair(r.a_uid, r.b_uid).id, aUid:r.a_uid, bUid:r.b_uid, createdAt:Date.parse(r.created_at) || Date.now() }));
    db.blocks = (Array.isArray(blocks) ? blocks : []).map(r => ({ id:r.id, blockerUid:r.blocker_uid, blockedUid:r.blocked_uid, targetSnapshot:r.target_snapshot || {}, createdAt:Date.parse(r.created_at) || Date.now() }));
    db.reports = (Array.isArray(reports) ? reports : []).map(r => ({ id:r.id, reporterUid:r.reporter_uid, targetUid:r.target_uid, reason:r.reason, contextType:r.context_type || 'profile', contextId:r.context_id || '', matchId:r.match_id || '', recentEventIds:r.recent_event_ids || [], targetSnapshot:r.target_snapshot || {}, status:r.status || 'open', createdAt:Date.parse(r.created_at) || Date.now() }));
    saveDB();
  } catch (e) { console.error('加载 Supabase 社交关系失败（继续使用本地数据）:', e.message); }
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
        owned: normalizeOwned(r.owned),
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
        signature:r.signature || '', countryRegion:r.country_region || '', genderTag:r.gender_tag || 'hidden', presencePreference:r.presence_preference || 'joinable', presenceVisibility:r.presence_visibility || 'everyone', showcase:r.showcase || null,
      });
    }
    // 已向玩家确认、但尚未成功写入远端的奖励必须优先保留本地档案；否则重启加载旧远端档案会造成回档。
    const pendingUids = new Set((db.pendingRewardSync || []).map(item => item && item.uid).filter(Boolean));
    const pendingUsers = Object.fromEntries(Object.entries(db.users).filter(([uid, u]) => pendingUids.has(uid) && u && !u.ephemeral));
    const localOnly = Object.values(db.users).filter(u => u && u.uid && !users[u.uid] && !u.ephemeral);
    db.users = { ...db.users, ...users };
    Object.assign(db.users, pendingUsers);
    if (localOnly.length) await Promise.all(localOnly.map(u => sbSyncProfile(u)));
    await sbLoadRewardHistory();
    await sbLoadSocial();
    await retryPendingRewardSync();
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
function profileDbRow(u){
  return {
    uid: u.uid, name: u.name, avatar: u.avatar, coins: u.coins, xp: u.xp || 0, level: u.level || 1,
    streak: u.streak || 0, best_streak: u.bestStreak || 0, played: u.played || {}, total: u.total || 0,
    wins: u.wins || {}, total_wins: u.totalWins || 0,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: normalizeOwned(u.owned), pin_hash: u.pin_hash || null, lang: u.lang || 'zh-CN',
    achievements: u.achievements || [], playmates: u.playmates || {},
    daily: u.daily || { play: 0, win: 0, streak: 0 }, daily_key: u.dailyKey || '', name_fx: u.nameFx || 0,
    auth_tokens: Array.isArray(u.authTokens) ? u.authTokens.slice(-5) : [],
    recent_results: Array.isArray(u.recentResults) ? u.recentResults.slice(-500) : [],
    purchase_requests: Array.isArray(u.purchaseRequests) ? u.purchaseRequests.slice(-100) : [],
    solo_rate: Array.isArray(u.soloRate) ? u.soloRate.slice(-100) : [],
    daily_first_win_date: u.dailyFirstWinDate || '', daily_ai_currency_key: u.dailyAICurrencyKey || '',
    daily_ai_currency_earned: u.dailyAICurrencyEarned || 0,
    xp_curve_version: u.xpCurveVersion || REWARD_CONFIG.level.curveVersion,
    signature:u.signature || '', country_region:u.countryRegion || '', gender_tag:u.genderTag || 'hidden', presence_preference:u.presencePreference || 'joinable', presence_visibility:u.presenceVisibility || 'everyone', showcase:u.showcase || null,
    updated_at: new Date().toISOString(),
  };
}
function sbSyncProfile(u){
  if (!useSupabase || !u || u.ephemeral) return Promise.resolve();
  const uid = u.uid;
  const body = JSON.stringify(profileDbRow(u));
  const previous = sbProfileQueues.get(uid) || Promise.resolve();
  const run = previous.catch(() => {}).then(() => sbFetch('profiles?on_conflict=uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body,
    }).then(() => true)).catch(e => { console.error('Supabase 同步档案失败:', e.message); return false; });
  sbProfileQueues.set(uid, run);
  run.finally(() => { if (sbProfileQueues.get(uid) === run) sbProfileQueues.delete(uid); });
  return run;
}
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
  const uid = u.uid;
  const body = JSON.stringify({
    p_profile: profileDbRow(u),
    p_history: historyDbRow(row),
    p_reward: rewardDbRow(row),
    p_ledger: ledgerDbRow(row.economyRow),
  });
  const previous = sbProfileQueues.get(uid) || Promise.resolve();
  const run = previous.catch(() => {}).then(() => sbFetch('rpc/apply_reward_v1', {
    method: 'POST', body,
  })).then(result => {
    const resultId = result && String(result.resultId || '');
    return resultId === String(row.resultId) && (result.applied === true || result.duplicate === true);
  }).catch(error => {
    console.error('Supabase 奖励事务失败:', error.message);
    return false;
  });
  sbProfileQueues.set(uid, run);
  run.finally(() => { if (sbProfileQueues.get(uid) === run) sbProfileQueues.delete(uid); });
  return run;
}
function sbApplyPurchaseTransaction(u, category, itemId, price, requestId){
  if (!useSupabase || !u || u.ephemeral) return Promise.resolve(null);
  const uid = u.uid;
  const body = JSON.stringify({
    p_uid: uid,
    p_category: category,
    p_item_id: itemId,
    p_price: price,
    p_request_id: requestId,
  });
  const previous = sbProfileQueues.get(uid) || Promise.resolve();
  const run = previous.catch(() => {}).then(() => sbFetch('rpc/apply_purchase_v1', {
    method: 'POST', body,
  })).then(result => {
    if (!result || String(result.resultId || '') !== String(requestId)) return null;
    if (result.applied === true || result.duplicate === true || result.alreadyOwned === true || result.insufficient === true) return result;
    return null;
  }).catch(error => {
    console.error('Supabase 购买事务失败:', error.message);
    return null;
  });
  sbProfileQueues.set(uid, run);
  run.finally(() => { if (sbProfileQueues.get(uid) === run) sbProfileQueues.delete(uid); });
  return run;
}

/* ---------------- 排行榜持久化（JSON 文件） ---------------- */
let db = {
  users: {}, history: [], rewardHistory: [], economyLedger: [], events: [], pendingRewardSync: [],
  friendRequests: [], friendships: [], blocks: [], reports: [],
};
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
      friendRequests: Array.isArray(parsed.friendRequests) ? parsed.friendRequests : [],
      friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    };
  } catch { db = { users: {}, history: [], rewardHistory: [], economyLedger: [], events: [], pendingRewardSync: [], friendRequests: [], friendships: [], blocks: [], reports: [] }; }
  db.pendingRewardSync = db.pendingRewardSync.filter(item => item && item.uid && item.row && item.row.resultId).slice(-10000);
  db.friendRequests = db.friendRequests.filter(row => row && row.id && row.fromUid && row.toUid && row.status === 'pending').slice(-50000);
  db.friendships = db.friendships.filter(row => row && row.id && row.aUid && row.bUid && row.aUid !== row.bUid).slice(-50000);
  db.blocks = db.blocks.filter(row => row && row.id && row.blockerUid && row.blockedUid && row.blockerUid !== row.blockedUid).slice(-50000);
  db.reports = db.reports.filter(row => row && row.id && row.reporterUid && row.targetUid && row.reason).slice(-50000);
  for (const [uid, u] of Object.entries(db.users)){
    u.uid = u.uid || uid;
    if (u.coins === undefined) u.coins = u.points || 0;
    delete u.points;
    if (!u.played) u.played = {};
    if (!u.total) u.total = 0;
    u.owned = normalizeOwned(u.owned);
    if (!Array.isArray(u.achievements)) u.achievements = [];
    if (!u.playmates || typeof u.playmates !== 'object') u.playmates = {};
    if (!['everyone','friends','nobody'].includes(u.presenceVisibility)) u.presenceVisibility = 'everyone';
    if (!u.showcase || typeof u.showcase !== 'object') u.showcase = null;
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
  fs.writeFileSync(tmp, JSON.stringify({ users, history, rewardHistory, economyLedger, events, pendingRewardSync,
    friendRequests: db.friendRequests || [], friendships: db.friendships || [], blocks: db.blocks || [], reports: db.reports || [],
  }, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function trimAuditData(){
  if (db.history.length > 10000) db.history = db.history.slice(-5000);
  if (db.rewardHistory.length > 50000) db.rewardHistory = db.rewardHistory.slice(-25000);
  if (db.economyLedger.length > 10000) db.economyLedger = db.economyLedger.slice(-5000);
  if (db.events.length > 20000) db.events = db.events.slice(-10000);
  if (db.friendRequests.length > 50000) db.friendRequests = db.friendRequests.slice(-25000);
  if (db.friendships.length > 50000) db.friendships = db.friendships.slice(-25000);
  if (db.blocks.length > 50000) db.blocks = db.blocks.slice(-25000);
  if (db.reports.length > 50000) db.reports = db.reports.slice(-25000);
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
function sanitizePlainText(value, maxLength){
  return String(value == null ? '' : value).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}
function publicPresence(uid, user){
  const preference = user && user.presencePreference || 'joinable';
  if (preference === 'invisible') return 'offline';
  const active = [...sessions].some(session => session.uid === uid && session.alive && Date.now() - session.lastSeen < HEARTBEAT_TIMEOUT_MS);
  if (!active) return 'offline';
  const playing = [...rooms.values()].some(room => room.started && [...room.clients.keys()].some(session => session.uid === uid));
  if (playing) return 'playing';
  return preference;
}
function leaderboardPayload(){
  const onlineUids = new Set();
  const now = Date.now();
  for (const s of sessions){
    const user = s.uid && db.users[s.uid];
    if (s.uid && s.alive && now - s.lastSeen < HEARTBEAT_TIMEOUT_MS && (!user || user.presencePreference !== 'invisible')) onlineUids.add(s.uid);
  }
  const list = Object.keys(db.users).filter(uid => !db.users[uid].ephemeral)
    .map(uid => {
      const u = db.users[uid];
      return {
        uid, name: u.name, avatar: u.avatar,
        background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
        coins: u.coins || 0, xp: u.xp || 0, level: u.level || 1, streak: u.streak || 0, bestStreak: u.bestStreak || 0, played: u.played || {}, total: u.total || 0, wins: u.wins || {}, totalWins: u.totalWins || 0, lang: u.lang || 'zh-CN', online: onlineUids.has(uid),
        achievements: u.achievements || [], nameFx: u.nameFx || 0,
        signature:u.signature || '', countryRegion:u.countryRegion || '', genderTag:u.genderTag || 'hidden', presence:publicPresence(uid, u),
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
function lobbyPayload(viewerUid){
  const list = [];
  for (const r of rooms.values()){
    if ([...r.clients.keys()].some(c => !c.alive || Date.now() - c.lastSeen >= HEARTBEAT_TIMEOUT_MS)) continue;
    if (normalizeRoomVisibility(r.visibility) !== 'public') continue;
    const size = activeSeatCount(r);
    const joinLimit = r.game && GAME_MAX[r.game] ? Math.min(r.capacity, GAME_MAX[r.game]) : r.capacity;
    const canJoin = !r.started && size < joinLimit && !!firstEmptySeat(r);
    const canSpectate = !!r.allowSpectators;
    if (!canJoin && !canSpectate) continue;
    const hu = r.host.uid ? db.users[r.host.uid] : null;
    if (hu && hu.presencePreference === 'invisible') continue;
    if (viewerUid && [...r.clients.keys()].some(c => c.uid && c.uid !== viewerUid && !socialAllowedBetween(viewerUid, c.uid))) continue;
    list.push({
      room: r.id,
      hostUid: r.host.uid || null,
      hostName: hu ? hu.name : '玩家',
      hostAvatar: hu ? hu.avatar : 0,
      hostLang: hu ? (hu.lang || 'zh-CN') : 'zh-CN',
      capacity: r.capacity,
      size,
      humanCount: humanRoomSeats(r).length,
      aiCount: aiRoomSeats(r).length,
      spectatorCount: r.spectators instanceof Set ? r.spectators.size : 0,
      game: r.game || null,
      status: r.started ? 'playing' : 'waiting',
      visibility:'public', allowSpectators:!!r.allowSpectators, canJoin, canSpectate,
      seats:ensureRoomSeats(r).map(publicSeat),
    });
  }
  return list;
}
function broadcastLobby(){
  for (const s of sessions) s.sendText(JSON.stringify({ type: 'lobby', payload: lobbyPayload(s.uid) }));
}
function roomPayload(r){
  const now = Date.now();
  ensureRoomSeats(r);
  const players = [...r.clients.entries()]
    .map(([c, p]) => ({ uid: c.uid || null, player: p, online: c.alive !== false && now - c.lastSeen < HEARTBEAT_TIMEOUT_MS }))
    .sort((a, b) => a.player - b.player);
  return {
    room:r.id, game:r.game || null, capacity:r.capacity, players, seats:r.seats.map(publicSeat),
    size:activeSeatCount(r), activePlayerCount:activeSeatCount(r), humanCount:humanRoomSeats(r).length, aiCount:aiRoomSeats(r).length,
    onlineSize:players.filter(p => p.online).length, spectatorCount:r.spectators instanceof Set ? r.spectators.size : 0,
    started:!!r.started, matchId:r.matchId || null, visibility:normalizeRoomVisibility(r.visibility),
    allowSpectators:!!r.allowSpectators, canStart:roomCanStart(r), host:roomHostPayload(r), gameplay:gameplayMetadata(r),
  };
}
function broadcastRoom(r){
  const text = JSON.stringify({ type: 'room_update', payload: roomPayload(r) });
  for (const c of r.clients.keys()) c.sendText(text);
  for (const c of (r.spectators instanceof Set ? r.spectators : [])) c.sendText(text);
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
  const reserved = [...rooms.values()].some(r => [...r.clients.keys()].some(s => s.uid === uid) ||
    [...(r.spectators instanceof Set ? r.spectators : [])].some(s => s.uid === uid));
  if (active || reserved) return;
  delete db.users[uid];
  db.history = db.history.filter(h => h.uid !== uid);
  db.rewardHistory = db.rewardHistory.filter(h => h.uid !== uid);
  db.economyLedger = db.economyLedger.filter(h => h.uid !== uid);
  db.events = db.events.filter(h => h.uid !== uid);
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
  for (const seat of humanRoomSeats(r)) seat.ready = !!seat.host;
}

function removeSpectator(session, notify){
  const roomId = session && session.spectatorRoom;
  const room = roomId && rooms.get(roomId);
  if (room && room.spectators instanceof Set){
    room.spectators.delete(session);
    if (notify !== false) session.sendText(JSON.stringify({ type:'spectator_left', payload:{ room:roomId } }));
    broadcastRoom(room);
    broadcastLobby();
  }
  if (session) session.spectatorRoom = null;
}
function compactRoomPlayers(r){
  compactRoomSeats(r);
}
function allRoomClientsOnline(r){
  const now = Date.now();
  return !!r && [...r.clients.keys()].every(c => c.alive && now - c.lastSeen < HEARTBEAT_TIMEOUT_MS);
}
function expireDetachedSession(r, oldSession){
  if (!r || !r.clients.has(oldSession) || oldSession.alive !== false) return;
  const player = r.clients.get(oldSession);
  const uid = oldSession.uid;
  const wasHost = r.host === oldSession;
  if (r.started && !r.settled) settleRoomForfeit(r, oldSession, 'afk');
  r.clients.delete(oldSession);
  if (Number.isInteger(player) && ensureRoomSeats(r)[player]) r.seats[player] = emptySeat(player);
  oldSession.room = null;
  oldSession.player = null;
  oldSession.resumeUntil = 0;
  oldSession.reconnectTimer = null;
  expiredResumes.set(resumeKey(uid, oldSession.tokenHash), {
    room: r.id, player, expiresAt: Date.now() + EXPIRED_RESUME_TTL_MS,
  });
  if (!r.clients.size){
    for (const spectator of (r.spectators instanceof Set ? r.spectators : [])){
      spectator.spectatorRoom = null;
      spectator.sendText(JSON.stringify({ type:'peer_left', payload:{ roomClosed:true, player } }));
    }
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
  updateAIControllers(r);
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
  session.reconnectTimer = setTimeout(() => expireDetachedSession(r, session), RECONNECT_GRACE_MS);
  if (session.reconnectTimer && session.reconnectTimer.unref) session.reconnectTimer.unref();
  const seat = seatForSession(r, session);
  if (seat) seat.online = false;
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
      const seat = ensureRoomSeats(r)[player];
      if (seat){ seat.online = true; seat.userId = session.uid; seat.host = r.host === session; }
      session.resumeUntil = 0;
      const hasAuthoritySnapshot = !!(r.tankAuthority || r.tetrisAuthority);
      const replayUnavailable = !!(r.started && r.moveLogTruncated && !hasAuthoritySnapshot);
      if (replayUnavailable) resetRoomMatch(r);
      const payload = {
        ...roomPayload(r),
        player,
        isHost: r.host === session,
        moveSeq: r.moveSeq || 0,
        moveLog: (r.moveLog || []).map(e => ({ seq: e.seq, player: e.player, payload: e.payload })),
        gameplay: gameplayMetadata(r),
        tankSnapshot: r.tankAuthority ? r.tankAuthority.snapshot(now) : null,
        tetrisSnapshot: r.tetrisAuthority ? r.tetrisAuthority.snapshot() : null,
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
  // Seat v1 使用显式 READY + 房主开始；不再因房间填满而突然自动开局。
  return roomCanStart(r);
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
  avatars: Object.fromEntries([
    [30,10],[31,12],[32,12],[33,15],[34,18],[35,18],[36,10],[37,10],[38,12],[39,12],[40,15],[41,18],[42,12],[43,12],[44,15],[45,15],[46,18],[47,18],[48,12],[49,15],[50,15],[51,18],[52,22],[53,22],[54,12],[55,30],
    ...Array.from({length:6}, (_, theme) => Array.from({length:6}, (_, offset) => [100 + theme * 8 + offset + 2, [10,12,14,16,18,18][offset]])).flat(),
  ]),
  frames: { 1:10,2:12,3:16,4:20,5:24,6:28,7:32,8:36 },
  effects: { 1:10,2:12,3:12,4:20 },
  backgrounds: { 7:18,8:18,9:22,10:20,20:24,21:32,22:24,23:32,24:24,25:32,26:24,27:32,28:24,29:32,30:24,31:32 },
};
function validOwnedId(kind, id){
  if (!Number.isInteger(id)) return false;
  if (kind === 'avatars' && id >= 0 && id < 30) return true;
  if (kind === 'avatars' && id >= 100 && id <= 147 && (id - 100) % 8 < 2) return true;
  if (kind === 'backgrounds' && id >= 0 && id <= 6) return true;
  if (id === 0 && kind !== 'avatars') return true;
  return !!(SHOP_PRICES[kind] && Object.prototype.hasOwnProperty.call(SHOP_PRICES[kind], id));
}
function ownsItem(u, kind, id){
  if (kind === 'avatars' && id >= 0 && id < 30) return true;
  if (kind === 'avatars' && id >= 100 && id <= 147 && (id - 100) % 8 < 2) return true;
  if (kind === 'backgrounds' && id >= 0 && id <= 6) return true;
  if (id === 0 && kind !== 'avatars') return true;
  return !!(u && u.owned && Array.isArray(u.owned[kind]) && u.owned[kind].includes(id));
}
function trackLegacyAvatarUsage(u){
  const avatar = Number(u && u.avatar);
  if (!u || !Number.isInteger(avatar) || avatar < 0 || avatar > 55) return;
  const now = Date.now();
  if (now - Number(u.legacyAvatarSeenAt || 0) < 86400000) return;
  u.legacyAvatarSeenAt = now;
  recordAnalytics('legacy_avatar_active', { uid:u.uid, metadata:{ avatarId:avatar, policy:'read_and_historical_equip_only' }, at:now });
}
function profileObj(u){
  normalizeUserRewardState(u);
  return {
    uid: u.uid, name: u.name, avatar: u.avatar,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: u.owned || { avatars: [], frames: [], effects: [], backgrounds: [] },
    coins: u.coins || 0, xp: u.xp || 0, level: u.level || 1, streak: u.streak || 0, bestStreak: u.bestStreak || 0,
    played: u.played || {}, total: u.total || 0, wins: u.wins || {}, totalWins: u.totalWins || 0, lang: u.lang || 'zh-CN',
    achievements: u.achievements || [], playmates: u.playmates || {}, daily: u.daily || { play: 0, win: 0, streak: 0 }, nameFx: u.nameFx || 0,
    dailyFirstWinDate: u.dailyFirstWinDate || '',
    dailyAICurrencyKey: u.dailyAICurrencyKey || '',
    dailyAICurrencyEarned: u.dailyAICurrencyEarned || 0,
    xpProgress: levelProgress(u.xp || 0),
    signature:u.signature || '', countryRegion:u.countryRegion || '', genderTag:u.genderTag || 'hidden', showcase:u.showcase || null,
    presencePreference:u.presencePreference || 'joinable', presenceVisibility:u.presenceVisibility || 'everyone', presence:publicPresence(u.uid, u),
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
  delete p.presencePreference;
  delete p.presenceVisibility;
  return p;
}

/* ---------------- Social Graph v1（好友 / 屏蔽 / 举报） ---------------- */
const SOCIAL_REQUEST_MAX_PER_DAY = 100;
const SOCIAL_REPORT_MAX_PER_DAY = 30;
const SOCIAL_REASONS = new Set(['harassment', 'inappropriate_name', 'cheating', 'spam', 'other']);
function socialId(prefix){ return prefix + '_' + crypto.randomBytes(10).toString('base64url'); }
function socialPair(aUid, bUid){
  const pair = [String(aUid || ''), String(bUid || '')].sort();
  return { aUid: pair[0], bUid: pair[1], id: pair[0] + '|' + pair[1] };
}
function socialBlockedBetween(aUid, bUid){
  return (db.blocks || []).some(row => row && ((row.blockerUid === aUid && row.blockedUid === bUid) || (row.blockerUid === bUid && row.blockedUid === aUid)));
}
function socialFriendship(aUid, bUid){
  const pair = socialPair(aUid, bUid);
  return (db.friendships || []).find(row => row && row.id === pair.id) || null;
}
function socialPendingRequest(fromUid, toUid){
  return (db.friendRequests || []).find(row => row && row.status === 'pending' && row.fromUid === fromUid && row.toUid === toUid) || null;
}
function socialRelationship(viewerUid, targetUid){
  if (!viewerUid || !targetUid || viewerUid === targetUid) return 'self';
  if (socialBlockedBetween(viewerUid, targetUid)) return 'blocked';
  if (socialFriendship(viewerUid, targetUid)) return 'friends';
  if (socialPendingRequest(viewerUid, targetUid)) return 'outgoing';
  if (socialPendingRequest(targetUid, viewerUid)) return 'incoming';
  return 'none';
}
function socialPublicEntry(viewerUid, targetUid){
  const target = db.users[targetUid];
  if (!target || target.ephemeral) return null;
  const profile = publicProfileObj(target);
  return { ...profile, relationship: socialRelationship(viewerUid, targetUid), blocked: socialBlockedBetween(viewerUid, targetUid) };
}
function socialState(uid){
  const friends = (db.friendships || []).filter(row => row && (row.aUid === uid || row.bUid === uid))
    .map(row => socialPublicEntry(uid, row.aUid === uid ? row.bUid : row.aUid)).filter(Boolean);
  const incoming = (db.friendRequests || []).filter(row => row && row.status === 'pending' && row.toUid === uid)
    .map(row => ({ id: row.id, createdAt: row.createdAt, user: socialPublicEntry(uid, row.fromUid) })).filter(row => row.user);
  const outgoing = (db.friendRequests || []).filter(row => row && row.status === 'pending' && row.fromUid === uid)
    .map(row => ({ id: row.id, createdAt: row.createdAt, user: socialPublicEntry(uid, row.toUid) })).filter(row => row.user);
  const blocked = (db.blocks || []).filter(row => row && row.blockerUid === uid)
    .map(row => ({ uid: row.blockedUid, name: row.targetSnapshot && row.targetSnapshot.name || (db.users[row.blockedUid] && db.users[row.blockedUid].name) || '玩家', createdAt: row.createdAt }));
  return {
    version: '1.0', friends, incoming, outgoing, blocked,
    counts: { friends: friends.length, incoming: incoming.length, outgoing: outgoing.length, blocked: blocked.length },
  };
}
function socialSessions(uid, fn){
  for (const session of sessions){ if (session.uid === uid && session.alive) fn(session); }
}
function sendSocialState(uid){
  const payload = socialState(uid);
  socialSessions(uid, session => session.sendText(JSON.stringify({ type: 'social_state', payload })));
}
function socialOk(session, msg, extra){
  session.sendText(JSON.stringify({ type: 'social_ok', msg: msg || '操作成功', ...(extra || {}) }));
  if (session.uid) sendSocialState(session.uid);
}
function socialError(session, msg, reason){
  session.sendText(JSON.stringify({ type: 'social_error', msg: msg || '社交操作失败', payload: { reason: reason || 'invalid_request' } }));
}
function socialTarget(fromUid, targetUid){
  const target = String(targetUid || '').trim();
  if (!target || target === fromUid || !db.users[target] || db.users[target].ephemeral) return null;
  return db.users[target];
}
function socialDailyCount(rows, uid, field){
  const cutoff = Date.now() - 86400000;
  return rows.filter(row => row && row[field] === uid && Number(row.createdAt || 0) >= cutoff).length;
}
function syncSocialRows(kind, rows){
  if (!useSupabase || !Array.isArray(rows) || !rows.length) return;
  const table = { friendRequests: 'friend_requests', friendships: 'friendships', blocks: 'blocks', reports: 'reports' }[kind];
  if (!table) return;
  const mapped = rows.map(row => kind === 'friendRequests' ? {
    id:row.id, from_uid:row.fromUid, to_uid:row.toUid, status:row.status, created_at:isoTimestamp(row.createdAt), updated_at:isoTimestamp(row.updatedAt || row.createdAt),
  } : kind === 'friendships' ? {
    id:row.id, a_uid:row.aUid, b_uid:row.bUid, created_at:isoTimestamp(row.createdAt),
  } : kind === 'blocks' ? {
    id:row.id, blocker_uid:row.blockerUid, blocked_uid:row.blockedUid, target_snapshot:row.targetSnapshot || {}, created_at:isoTimestamp(row.createdAt),
  } : {
    id:row.id, reporter_uid:row.reporterUid, target_uid:row.targetUid, reason:row.reason, context_type:row.contextType || 'profile', context_id:row.contextId || '', match_id:row.matchId || '', recent_event_ids:row.recentEventIds || [], target_snapshot:row.targetSnapshot || {}, status:row.status || 'open', created_at:isoTimestamp(row.createdAt),
  });
  sbFetch(table + '?on_conflict=id', { method:'POST', headers:{ Prefer:'resolution=merge-duplicates' }, body:JSON.stringify(mapped) })
    .catch(error => console.error('Supabase 社交关系同步失败:', error.message));
}
function deleteSocialRemote(table, id){
  if (!useSupabase || !table || !id) return;
  sbFetch(table + '?id=eq.' + encodeURIComponent(id), { method:'DELETE' })
    .catch(error => console.error('Supabase 社交关系删除失败:', error.message));
}
function socialSendRequest(session, targetUid){
  const target = socialTarget(session.uid, targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  if (socialBlockedBetween(session.uid, target.uid)) return socialError(session, '该玩家已被屏蔽，不能建立关系', 'blocked');
  if (socialFriendship(session.uid, target.uid)) return socialOk(session, '你们已经是好友', { action: 'already_friends' });
  if (socialDailyCount(db.friendRequests || [], session.uid, 'fromUid') >= SOCIAL_REQUEST_MAX_PER_DAY) return socialError(session, '今日好友请求已达上限', 'rate_limited');
  const existing = socialPendingRequest(session.uid, target.uid);
  if (existing) return socialOk(session, '好友请求已发送', { action: 'idempotent', requestId: existing.id });
  const reverse = socialPendingRequest(target.uid, session.uid);
  if (reverse) return socialError(session, '对方已向你发送好友请求，请在请求列表中接受', 'incoming_exists');
  const row = { id: socialId('fr'), fromUid: session.uid, toUid: target.uid, status: 'pending', createdAt: Date.now(), updatedAt: Date.now() };
  db.friendRequests.push(row); syncSocialRows('friendRequests', [row]); saveDB();
  socialOk(session, '好友请求已发送', { action: 'sent', requestId: row.id });
  sendSocialState(target.uid);
}
function socialFriendRequestAction(session, payload){
  const action = String(payload && payload.action || '');
  const requestId = String(payload && payload.requestId || '');
  const row = db.friendRequests.find(item => item && item.id === requestId && item.status === 'pending');
  if (!row) return socialError(session, '好友请求不存在或已处理', 'request_not_found');
  const isIncoming = row.toUid === session.uid;
  const isOutgoing = row.fromUid === session.uid;
  if (action === 'accept' && isIncoming){
    if (socialBlockedBetween(row.fromUid, row.toUid)) return socialError(session, '该请求已被屏蔽', 'blocked');
    row.status = 'accepted'; row.updatedAt = Date.now();
    const pair = socialPair(row.fromUid, row.toUid);
    if (!socialFriendship(row.fromUid, row.toUid)) db.friendships.push({ id: pair.id, ...pair, createdAt: Date.now() });
    saveDB(); syncSocialRows('friendRequests', [row]); syncSocialRows('friendships', db.friendships.filter(item => item.id === pair.id));
    socialOk(session, '已添加好友', { action: 'accepted' }); sendSocialState(row.fromUid); return;
  }
  if (action === 'decline' && isIncoming){ row.status = 'declined'; row.updatedAt = Date.now(); saveDB(); syncSocialRows('friendRequests',[row]); socialOk(session, '已忽略好友请求', { action: 'declined' }); sendSocialState(row.fromUid); return; }
  if (action === 'cancel' && isOutgoing){ row.status = 'cancelled'; row.updatedAt = Date.now(); saveDB(); syncSocialRows('friendRequests',[row]); socialOk(session, '已取消好友请求', { action: 'cancelled' }); sendSocialState(row.toUid); return; }
  socialError(session, '无权处理该好友请求', 'forbidden');
}
function socialRemoveFriend(session, targetUid){
  const target = socialTarget(session.uid, targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  const pair = socialPair(session.uid, target.uid);
  const before = db.friendships.length;
  db.friendships = db.friendships.filter(row => row.id !== pair.id);
  if (db.friendships.length === before) return socialError(session, '你们还不是好友', 'not_friends');
  saveDB(); deleteSocialRemote('friendships',pair.id); socialOk(session, '已移除好友', { action: 'removed' }); sendSocialState(target.uid);
}
function socialBlock(session, targetUid){
  const target = socialTarget(session.uid, targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  if (db.blocks.some(row => row.blockerUid === session.uid && row.blockedUid === target.uid)) return socialOk(session, '该玩家已被屏蔽', { action: 'idempotent' });
  const pair = socialPair(session.uid, target.uid);
  db.friendships = db.friendships.filter(row => row.id !== pair.id);
  const removedRequests = db.friendRequests.filter(row => (row.fromUid === session.uid && row.toUid === target.uid) || (row.fromUid === target.uid && row.toUid === session.uid));
  db.friendRequests = db.friendRequests.filter(row => !removedRequests.includes(row));
  const row = { id: socialId('blk'), blockerUid: session.uid, blockedUid: target.uid, targetSnapshot: { uid: target.uid, name: target.name, avatar: target.avatar }, createdAt: Date.now() };
  db.blocks.push(row); syncSocialRows('blocks', [row]); deleteSocialRemote('friendships',pair.id); removedRequests.forEach(request=>deleteSocialRemote('friend_requests',request.id)); saveDB();
  socialOk(session, '已屏蔽该玩家', { action: 'blocked' }); sendSocialState(target.uid);
}
function socialUnblock(session, targetUid){
  const target = String(targetUid || '').trim();
  const before = db.blocks.length;
  const removed = db.blocks.filter(row => row.blockerUid === session.uid && row.blockedUid === target);
  db.blocks = db.blocks.filter(row => !(row.blockerUid === session.uid && row.blockedUid === target));
  if (before === db.blocks.length) return socialError(session, '该玩家不在屏蔽列表', 'not_blocked');
  saveDB(); removed.forEach(row=>deleteSocialRemote('blocks',row.id)); socialOk(session, '已取消屏蔽', { action: 'unblocked' });
}
function socialReport(session, payload){
  const target = socialTarget(session.uid, payload && payload.targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  const reason = String(payload && payload.reason || '');
  if (!SOCIAL_REASONS.has(reason)) return socialError(session, '举报原因无效', 'invalid_reason');
  if (socialDailyCount(db.reports || [], session.uid, 'reporterUid') >= SOCIAL_REPORT_MAX_PER_DAY) return socialError(session, '今日举报次数已达上限', 'rate_limited');
  const contextType = sanitizePlainText(payload && payload.contextType, 24) || 'profile';
  const contextId = sanitizePlainText(payload && payload.contextId, 80);
  const recentEventIds = Array.isArray(payload && payload.recentEventIds) ? payload.recentEventIds.map(v => sanitizePlainText(v, 80)).filter(Boolean).slice(0, 20) : [];
  const duplicate = db.reports.find(row => row && row.reporterUid === session.uid && row.targetUid === target.uid && row.reason === reason && row.contextId === contextId && Date.now() - Number(row.createdAt || 0) < 600000);
  if (duplicate) return socialOk(session, '举报已记录', { action: 'idempotent', reportId: duplicate.id });
  const row = { id: socialId('rpt'), reporterUid: session.uid, targetUid: target.uid, reason, contextType, contextId, matchId: sanitizePlainText(payload && payload.matchId, 80), recentEventIds, targetSnapshot: { uid: target.uid, name: target.name, avatar: target.avatar, signature: sanitizePlainText(target.signature, 80) }, status: 'open', createdAt: Date.now() };
  db.reports.push(row); syncSocialRows('reports', [row]); saveDB();
  recordAnalytics('social_report_created', { uid: session.uid, metadata: { reportId: row.id, targetUid: target.uid, reason, contextType } });
  socialOk(session, '举报已记录，我们会核查相关信息', { action: 'reported', reportId: row.id });
}
function socialAllowedBetween(aUid, bUid){ return !!aUid && !!bUid && aUid !== bUid && !socialBlockedBetween(aUid, bUid); }
function normalizeOwned(o){
  const base = { avatars: Array.from({ length: 30 }, (_, i) => i).concat([100,101,108,109,116,117,124,125,132,133,140,141]), frames: [0], effects: [0], backgrounds: [0,1,2,3,4,5,6] };
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
  if (payload.signature !== undefined) u.signature = sanitizePlainText(payload.signature, 80);
  if (payload.countryRegion !== undefined){
    const region = String(payload.countryRegion || '').trim().toUpperCase();
    if (!region || /^[A-Z]{2}$/.test(region)) u.countryRegion = region;
  }
  if (payload.genderTag !== undefined){
    const gender = sanitizePlainText(payload.genderTag, 24);
    if (['hidden','male','female','nonbinary'].includes(gender) || /^custom:[^<>]{1,16}$/.test(gender)) u.genderTag = gender;
  }
  if (['joinable','online','busy','invisible'].includes(payload.presencePreference)) u.presencePreference = payload.presencePreference;
  if (['everyone','friends','nobody'].includes(payload.presenceVisibility)) u.presenceVisibility = payload.presenceVisibility;
  if (payload.showcase === null) u.showcase = null;
  else if (payload.showcase && typeof payload.showcase === 'object'){
    const type = String(payload.showcase.type || '');
    const value = sanitizePlainText(payload.showcase.value, 48);
    const valid = (type === 'game' && VALID_GAMES.includes(value)) ||
      (type === 'achievement' && Array.isArray(u.achievements) && u.achievements.includes(value)) ||
      (type === 'collection' && /^(pixel|anime|landscape|animal|neon|technology)_origins$/.test(value)) ||
      (type === 'record' && ['totalWins','bestStreak','total','level'].includes(value));
    if (valid) u.showcase = { type, value };
  }
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
  const mode = humanRoomSeats(r).length >= 2 ? 'online' : 'ai';
  return evaluateEligibility({
    gameId: r.game,
    mode,
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
  if (reward.eligible){
    u.coins = (u.coins || 0) + (reward.currency || 0);
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
function stopRoomAuthorities(r){
  if (!r) return;
  if (r.gameplayTimer) clearInterval(r.gameplayTimer);
  r.gameplayTimer = null;
  r.tankAuthority = null;
  r.tetrisAuthority = null;
}
function authoritativeResults(order){
  return order.map((slot, index) => ({ slot, rank:index + 1, coins:index === 0 ? 1 : 0 }));
}
function gameplayMetadata(r){
  if (!r || !r.started) return null;
  if (r.tankAuthority){
    const state = r.tankAuthority.snapshot();
    return { protocol:'tank-authority-v1', serverTick:state.serverTick, startedAt:state.startedAt, endAt:state.endAt, season:state.season };
  }
  if (r.tetrisAuthority){
    const state = r.tetrisAuthority.snapshot();
    return { protocol:'tetris-battle-authority-v1', startAt:state.startAt, matchEndAt:state.matchEndAt, matchSeed:state.matchSeed, rulesetVersion:state.rulesetVersion };
  }
  return null;
}
function settleAuthoritativeRoom(r, order, cause){
  if (!r || r.settled || !Array.isArray(order) || order.length !== activeSeatCount(r)) return;
  const results = authoritativeResults(order);
  settleRoomResult(r, results, { cause:cause || 'authoritative_gameplay' });
}
function startRoomAuthorities(r){
  stopRoomAuthorities(r);
  if (!r || !r.started || !r.matchId) return;
  if (r.game === 'tank'){
    r.tankAuthority = new TankAuthority({
      matchId:r.matchId, playerCount:activeSeatCount(r), startedAt:r.startedAt,
      durationMs:Math.max(10000, Number(process.env.TANK_MATCH_DURATION_MS) || 180000),
    });
    r.gameplayTimer = setInterval(() => {
      if (!r.started || !r.tankAuthority) return;
      const state = r.tankAuthority.advance(Date.now());
      if (state.serverTick % 10 === 0){
        for (const seat of aiRoomSeats(r)){
          const phase = Math.floor(state.serverTick / 10) + seat.seatId * 3;
          const direction = phase % 4;
          const input = { up:direction===0, right:direction===1, down:direction===2, left:direction===3, fire:phase % 3 === 0 };
          r.aiInputSeq = r.aiInputSeq || {};
          const seq = (r.aiInputSeq[seat.seatId] || 0) + 1;
          r.aiInputSeq[seat.seatId] = seq;
          const accepted = r.tankAuthority.acceptInput(seat.seatId, { matchId:r.matchId, seq, clientTick:state.serverTick, input }, Date.now());
          if (accepted.ok) recordRoomAction(r, seat.seatId, { act:'input', input });
        }
      }
      if (state.serverTick % 2 === 0) broadcast(r, { type:'tank_snapshot', payload:state });
      if (state.finished && !r.gameplayResultSent){
        r.gameplayResultSent = true;
        broadcast(r, { type:'tank_result', payload:{ matchId:r.matchId, order:state.order, stats:state.players } });
        settleAuthoritativeRoom(r, state.order, 'tank_authority');
      }
    }, 50);
  } else if (r.game === 'tetris'){
    const startAt = Date.now() + 3000;
    r.tetrisAuthority = new TetrisBattleAuthority({
      matchId:r.matchId, playerCount:activeSeatCount(r), startAt,
      matchEndAt:startAt + Math.max(15000, Number(process.env.TETRIS_MATCH_DURATION_MS) || 300000), matchSeed:r.matchId,
    });
    r.aiTetrisState = {};
    r.gameplayTimer = setInterval(() => {
      if (!r.started || !r.tetrisAuthority) return;
      const now = Date.now();
      if (now >= startAt){
        for (const seat of aiRoomSeats(r)){
          const state = r.aiTetrisState[seat.seatId] || { seq:0, placementSeq:0, nextAt:startAt + 900 + seat.seatId * 120, score:0, lines:0 };
          if (now >= state.nextAt && !r.tetrisAuthority.finished){
            state.seq++; state.placementSeq++;
            const pace = seat.aiDifficulty === 'hard' ? 650 : (seat.aiDifficulty === 'easy' ? 1250 : 900);
            const linesCleared = seat.aiDifficulty === 'hard' && state.placementSeq % 5 === 0 ? 2 : (state.placementSeq % 7 === 0 ? 1 : 0);
            state.lines += linesCleared; state.score += 80 + linesCleared * 320; state.nextAt = now + pace;
            const claim = {
              matchId:r.matchId, seq:state.seq, placementSeq:state.placementSeq,
              linesCleared, attack:[0,0,1,2,4][linesCleared], attackId:'bot:' + seat.seatId + ':' + state.placementSeq,
              score:state.score, lines:state.lines, boardHeight:Math.max(1, 7 - Math.floor(state.lines / 4)),
              piece:state.placementSeq % 7, x:(state.placementSeq * 3 + seat.seatId) % 8, y:15, rot:state.placementSeq % 4,
            };
            const accepted = r.tetrisAuthority.claimLock(seat.seatId, claim, now);
            if (accepted.ok){
              recordRoomAction(r, seat.seatId, claim); broadcast(r, accepted.event);
              relayRoomMove(r, seat.seatId, { act:'lock', piece:claim.piece, x:claim.x, y:claim.y, rot:claim.rot, placementSeq:claim.placementSeq, seq:claim.seq }, null, false);
            }
            r.aiTetrisState[seat.seatId] = state;
          }
        }
      }
      const due = r.tetrisAuthority.advance(now);
      due.forEach(item => broadcast(r, { type:'tetris_garbage_due', payload:{ matchId:r.matchId, revision:r.tetrisAuthority.revision, ...item } }));
      if (r.tetrisAuthority.finished && !r.gameplayResultSent){
        r.gameplayResultSent = true;
        const result = r.tetrisAuthority.result();
        broadcast(r, result);
        settleAuthoritativeRoom(r, result.order, 'tetris_authority');
      }
    }, 100);
  }
  if (r.gameplayTimer && r.gameplayTimer.unref) r.gameplayTimer.unref();
}
function startRoomMatch(r){
  compactRoomPlayers(r);
  const playerCount = activeSeatCount(r);
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
  r.aiInputSeq = {};
  r.startedAt = Date.now();
  r.rewardProgress = { startedAt: r.startedAt, lastActionAt: r.startedAt, meaningfulActions: 0, byPlayer: {}, uniqueActions: new Set() };
  r.resultRewards = new Map();
  r.gameplayResultSent = false;
  startRoomAuthorities(r);
  recordAnalytics('match_started', {
    matchId: r.matchId,
    game: r.game,
    mode: 'online',
    metadata: { participantCount: playerCount, humanCount:humanRoomSeats(r).length, aiCount:aiRoomSeats(r).length },
  });
  broadcast(r, { type:'started', game:r.game, size:playerCount, players:activeRoomSeats(r).map(seat => seat.seatId), seats:ensureRoomSeats(r).map(publicSeat), matchId:r.matchId, gameplay:gameplayMetadata(r) });
  broadcastLobby();
}
function roomResultError(r, msg){
  for (const c of r.clients.keys()) c.sendText(JSON.stringify({ type: 'result_error', msg, matchId: r.matchId }));
}
function settleRoomResult(r, results, options = {}){
  if (r.settled) return;
  r.settled = true;
  const now = Date.now();
  const progress = roomProgress(r);
  const globalEligibility = options.eligibility || roomRewardEligibility(r, now);
  const participants = [...r.clients.entries()].map(([session, slot]) => ({ session, slot, user: session.uid && db.users[session.uid] })).filter(x => x.user);
  const participantUids = participants.map(p => p.user.uid);
  const aiIdentities = aiRoomSeats(r).map(seat => 'ai:' + seat.aiPersona + ':' + seat.aiDifficulty);
  const settlementMode = participants.length >= 2 ? 'online' : 'ai';
  const opponentKey = opponentGroupKey(participantUids.concat(aiIdentities));
  const durationMs = Math.max(0, now - Number(progress.startedAt || r.startedAt || now));
  r.resultRewards = r.resultRewards instanceof Map ? r.resultRewards : new Map();
  for (const p of participants){
    const mine = results.find(x => x.slot === p.slot);
    const others = participants.filter(x => x !== p).map(x => x.user);
    let eligibility = { eligible: globalEligibility.eligible === true, blockedReason: globalEligibility.blockedReason || null };
    const forcedReason = options.blockedSlots && options.blockedSlots.get(p.slot);
    const threshold = eligibilityThreshold(r.game, settlementMode, rewardThresholdOverrides());
    if (eligibility.eligible && threshold && (progress.byPlayer[p.slot] || 0) < (threshold.minPlayerActions || 0)){
      eligibility = { eligible: false, blockedReason: 'afk' };
    }
    if (forcedReason) eligibility = { eligible: false, blockedReason: forcedReason };
    if (globalEligibility.eligible){
      for (const other of others) recordServerPlaymate(p.user, other, r.game);
    }
    const resultMeta = { matchId: r.matchId, resultId: r.matchId + ':' + p.slot, mode:settlementMode };
    const result = options.forceResult || playerResult(results, mine, activeSeatCount(r));
    const repeatCount24h = repeatOpponentCount(p.user.uid, opponentKey, now);
    const humanOrder = participants.slice().sort((a, b) => {
      const ar = results.find(item => item.slot === a.slot);
      const br = results.find(item => item.slot === b.slot);
      return Number(ar && ar.rank || 999) - Number(br && br.rank || 999) || a.slot - b.slot;
    });
    const placement = settlementMode === 'ai' ? (result === 'win' ? 1 : 2) : humanOrder.indexOf(p) + 1;
    const opponentIds = participants.filter(x => x !== p).map(x => x.user.uid).concat(aiIdentities);
    const reward = resolveMatchReward({
      userId: p.user.uid,
      matchId: r.matchId,
      resultId: resultMeta.resultId,
      gameId: r.game,
      mode:settlementMode,
      placement,
      result,
      participantCount:settlementMode === 'ai' ? 2 : participants.length,
      durationMs,
      meaningfulActions: progress.meaningfulActions || 0,
      opponentIds,
      repeatCount24h,
      eligibility,
      now,
    }, p.user);
    const row = applyResolvedProgress(p.user, reward, {
      ...resultMeta,
      at: now,
      opponentIds,
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
    mode:settlementMode,
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
  broadcastLeaderboard();
}
function settleRoomNoContest(r, reason){
  if (!r || !r.started || r.settled || !r.matchId) return;
  const results = activeRoomSeats(r).map((seat, index) => ({ slot:seat.seatId, coins:0, rank:index + 1 }));
  settleRoomResult(r, results, {
    cause: 'invalidated',
    forceResult: 'draw',
    eligibility: { eligible: false, blockedReason: reason || 'no_contest' },
  });
}
function settleRoomForfeit(r, offenderSession, cause){
  if (!r || !r.started || r.settled || !r.matchId || !r.clients.has(offenderSession)) return;
  const offenderSlot = r.clients.get(offenderSession);
  const size = activeSeatCount(r);
  if (size > 2){
    settleRoomNoContest(r, 'multiplayer_forfeit_unranked');
    recordAnalytics(cause === 'afk' ? 'match_afk' : 'match_forfeit', {
      matchId: r.matchId, game: r.game, mode: 'online', metadata: { offenderSlot, noContest: true },
    });
    return;
  }
  const results = activeRoomSeats(r).map(seat => ({
    slot:seat.seatId,
    coins:seat.seatId === offenderSlot ? 0 : 1,
    rank:seat.seatId === offenderSlot ? size : 1,
  }));
  const blockedSlots = new Map();
  if (cause === 'afk') blockedSlots.set(offenderSlot, 'afk');
  settleRoomResult(r, results, { cause: cause || 'forfeit', offenderSlot, blockedSlots });
}
function submitRoomResult(session, payload, r){
  if (!r.started || !r.matchId || r.disputed){ session.sendText(JSON.stringify({ type: 'result_error', msg: '当前没有可结算的对局' })); return; }
  const matchId = String(payload && payload.matchId || '');
  if (matchId !== r.matchId){ session.sendText(JSON.stringify({ type: 'result_error', msg: '对局标识已失效' })); return; }
  const game = String(payload && payload.game || '');
  if (game !== r.game){ session.sendText(JSON.stringify({ type: 'result_error', msg: '游戏标识不匹配' })); return; }
  const normalized = normalizeRoomResults(payload && payload.results, activeSeatCount(r));
  if (!normalized){ session.sendText(JSON.stringify({ type: 'result_error', msg: '结算数据无效' })); return; }
  const digest = JSON.stringify(normalized.map(x => ({ slot: x.slot, coins: x.coins, rank: x.rank })));
  const previous = r.resultClaims.get(session.player);
  if (previous){
    if (previous.digest !== digest) session.sendText(JSON.stringify({ type: 'result_error', msg: '同一玩家重复提交了冲突结果' }));
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
    roomResultError(r, '双方结算结果不一致，本局未计入排行榜');
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
  if (session.room){ session.sendText(JSON.stringify({ type: 'result_error', msg: '房间对局中不能开始人机结算' })); return; }
  cleanupSoloMatches();
  const game = String(payload && payload.game || '');
  const clientRunId = String(payload && payload.clientRunId || '');
  if (!VALID_GAMES.includes(game) || !/^run_[A-Za-z0-9_-]{8,120}$/.test(clientRunId)){
    session.sendText(JSON.stringify({ type: 'result_error', msg: '人机对局启动参数无效' }));
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
function previousReward(uid, resultId){
  for (let i = db.rewardHistory.length - 1; i >= 0; i--){
    const row = db.rewardHistory[i];
    if (row && row.uid === uid && row.resultId === resultId) return row.reward || null;
  }
  return null;
}
function soloResultError(session, message, matchId, resultId){
  session.sendText(JSON.stringify({
    type: 'result_error', msg: message,
    matchId: matchId || null,
    resultId: resultId || null,
    payload: { matchId: matchId || null, resultId: resultId || null },
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
    soloResultError(session, '人机结算必须使用服务端签发的有效对局票据', matchId, resultId);
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
    soloResultError(session, '人机对局票据不存在、已完成或已过期', matchId, resultId);
    return;
  }
  const now = Date.now();
  user.soloRate = (Array.isArray(user.soloRate) ? user.soloRate : [])
    .map(Number).filter(Number.isFinite).filter(time => now - time < 3600000);
  if (user.soloRate.length >= 60){
    soloResultError(session, '人机结算已达到每小时上限，请稍后再试', matchId, resultId);
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
  user.soloRate.push(now);
  match.completed = true;
  match.updatedAt = now;
  recordAnalytics(eligibility.eligible ? 'match_completed' : 'match_invalidated', {
    uid: user.uid, matchId, game, mode: 'ai',
    metadata: { reason: eligibility.blockedReason || null, durationMs: now - match.startedAt, meaningfulActions: match.meaningfulActions },
  });
  trimAuditData();
  saveDB();
  syncRewardRow(user, row);
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
  for (const c of (room.spectators instanceof Set ? room.spectators : [])){
    if (c !== except) c.sendText(text);
  }
}

function controlledAISeat(room, session, value){
  const seatId = Number(value);
  const seat = Number.isInteger(seatId) && ensureRoomSeats(room)[seatId];
  return seat && seat.type === 'ai' && room.host === session && seat.controllerUid === session.uid ? seat : null;
}

function relayRoomMove(room, player, payload, except, record){
  if (!room.started || !payload || typeof payload !== 'object') return false;
  let payloadBytes = 0;
  try { payloadBytes = Buffer.byteLength(JSON.stringify(payload)); } catch { return false; }
  if (payloadBytes > 16384) return false;
  compactTankRelayLog(room, payload);
  room.moveSeq = (room.moveSeq || 0) + 1;
  const event = { seq:room.moveSeq, player, payload };
  if (!Array.isArray(room.moveLog)) room.moveLog = [];
  room.moveLog.push(event);
  room.moveLogBytes = (room.moveLogBytes || 0) + payloadBytes;
  while (room.moveLog.length > MOVE_LOG_MAX_EVENTS || room.moveLogBytes > MOVE_LOG_MAX_BYTES){
    const removed = room.moveLog.shift();
    try { room.moveLogBytes -= Buffer.byteLength(JSON.stringify(removed && removed.payload)); } catch {}
    room.moveLogTruncated = true;
  }
  if (record !== false) recordRoomAction(room, player, payload);
  broadcast(room, { type:'move', payload, seq:event.seq, player:event.player }, except);
  return true;
}

class Session {
  constructor(socket, req){
    this.socket = socket;
    this.ip = requestIp(req || { headers: {}, socket });
    this.room = null;
    this.spectatorRoom = null;
    this.player = null;
    this.uid = null;
    this.tokenHash = null;
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
    this.sendText(JSON.stringify({ type: 'auth_error', msg: msg || '请先登录', ...(extra || {}) }));
  }
  requireUser(){
    const u = this.uid && db.users[this.uid];
    if (!u || !userHasTokenHash(u, this.tokenHash)){
      this.authError('登录状态已失效，请重新登录');
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
      const uid = String(payload && payload.uid || '');
      const token = String(payload && payload.token || '');
      const u = uid && db.users[uid];
      const tokenHash = token ? hashToken(token) : null;
      if (this.uid && (uid !== this.uid || !u || !userHasToken(u, token) || !secureEqual(this.tokenHash, tokenHash))){
        this.authError('请先退出当前账号再切换身份');
        return;
      }
      if (u && userHasToken(u, token)){
        this.uid = uid;
        this.tokenHash = tokenHash;
        trackLegacyAvatarUsage(u);
      } else {
        this.uid = null;
        this.tokenHash = null;
      }
      this.sendText(JSON.stringify({
        type: 'hello_ack', proto: PROTOCOL_VERSION, authenticated: !!this.uid,
        rewardVersion: REWARD_CONFIG.version,
        capabilities: ['reward_breakdown', 'ai_reward_ticket', 'seat_v1', 'ready_v1', 'spectator_v1', 'bot_controller_v1', 'social_graph_v1', 'block_report_v1'],
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
      if (this.uid){ this.authError('请先退出当前账号再注册新账号'); return; }
      const pin = String((payload && payload.pin) || '').trim();
      if (!validPin(pin)){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 只能使用字母和数字，长度 4-20 位' }));
        return;
      }
      if (!allowRegistration(this.ip)){
        this.authError('该网络注册过于频繁，请稍后再试', { retryAfter: 3600 });
        return;
      }
      if (!allowAuthHash()){
        this.authError('登录服务繁忙，请稍后再试', { retryAfter: 30 });
        return;
      }
      const ph = hashPin(pin);
      const oldPh = legacyPinHash(pin);
      if (Object.values(db.users).some(u => secureEqual(u.pin_hash, ph) || secureEqual(u.pin_hash, oldPh))){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: '该 PIN 已被其他玩家使用，请换一个' }));
        return;
      }
      const proposed = String((payload && payload.uid) || '');
      const uid = /^u_[a-z0-9]{6,32}$/.test(proposed) && !db.users[proposed] ? proposed : genUid();
      const name = String((payload && payload.name) || '').trim().slice(0, 12) || '玩家';
      const requestedAvatar = Number(payload && payload.avatar);
      const avatar = Number.isInteger(requestedAvatar) && validOwnedId('avatars', requestedAvatar) &&
        (requestedAvatar < 30 || (requestedAvatar >= 100 && (requestedAvatar - 100) % 8 < 2)) ? requestedAvatar : 100;
      const starterBackground = Number.isInteger(payload && payload.background) && payload.background >= 0 && payload.background <= 6 ? payload.background : 0;
      const starterOwned = normalizeOwned({ backgrounds: [starterBackground] });
      const u = {
        uid, name, avatar,
        ephemeral: !!(payload && payload.ephemeral === true && /^u_live[a-z0-9]{4,40}$/.test(uid)),
        background: starterBackground,
        frame: 0,
        effect: 0,
        achievements: [], playmates: {}, daily: { play: 0, win: 0, streak: 0 }, nameFx: 0,
        owned: starterOwned,
        xp: 0, level: 1, streak: 0, bestStreak: 0, coins: 0, played: {}, total: 0, wins: {}, totalWins: 0,
        recentResults: [], purchaseRequests: [], soloRate: [], pin_hash: ph,
        dailyFirstWinDate: '', dailyAICurrencyKey: '', dailyAICurrencyEarned: 0,
        signature:'', countryRegion:'', genderTag:'hidden', presencePreference:'joinable', presenceVisibility:'everyone', showcase:null,
        xpCurveVersion: REWARD_CONFIG.level.curveVersion,
        lang: (payload && ['zh-CN','en-US','uk-UA'].includes(payload.lang) ? payload.lang : 'zh-CN'), created_at: Date.now(),
      };
      const auth = issueAuthToken(u);
      db.users[uid] = u;
      saveDB();
      sbSyncProfile(u);
      this.uid = uid;
      this.tokenHash = auth.tokenHash;
      this.sendText(JSON.stringify({ type: 'registered', token: auth.token, payload: { uid, token: auth.token, profile: profileObj(u) } }));
      broadcastLeaderboard();
      broadcastLobby();
      return;
    }
    if (type === 'login'){
      if (this.uid){ this.authError('请先退出当前账号再登录其他账号'); return; }
      const retryAfter = authRetryAfter(this.ip);
      if (retryAfter){ this.authError('尝试次数过多，请稍后再试', { retryAfter }); return; }
      const pin = String((payload && payload.pin) || '').trim();
      if (!validPin(pin)){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 只能使用字母和数字，长度 4-20 位' }));
        return;
      }
      if (!allowAuthHash()){
        this.authError('登录服务繁忙，请稍后再试', { retryAfter: 30 });
        return;
      }
      const ph = hashPin(pin);
      const oldPh = legacyPinHash(pin);
      const u = Object.values(db.users).find(x => pinMatches(x, pin, ph, oldPh));
      if (!u){
        noteAuthFailure(this.ip);
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 不存在，请检查后重试' }));
        return;
      }
      clearAuthFailures(this.ip);
      if (!String(u.pin_hash || '').startsWith('s2$')) u.pin_hash = ph;
      const auth = issueAuthToken(u);
      this.uid = u.uid;
      this.tokenHash = auth.tokenHash;
      trackLegacyAvatarUsage(u);
      saveDB();
      sbSyncProfile(u);
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
      if (requestedUid !== this.uid){ this.authError('不能修改其他玩家的档案'); return; }
      updateEditableProfile(u, payload);
      trackLegacyAvatarUsage(u);
      saveDB();
      sbSyncProfile(u);
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
        this.sendText(JSON.stringify({ type: 'purchase_error', msg: '购买请求标识无效' }));
        return;
      }
      u.purchaseRequests = Array.isArray(u.purchaseRequests) ? u.purchaseRequests : [];
      if (requestId && u.purchaseRequests.includes(requestId)){
        this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, replayed: true, profile: profileObj(u) } }));
        return;
      }
      const price = SHOP_PRICES[category] && SHOP_PRICES[category][id];
      if (!Number.isInteger(id) || !Number.isInteger(price)){
        this.sendText(JSON.stringify({ type: 'purchase_error', msg: '商品不存在' }));
        return;
      }
      u.owned = normalizeOwned(u.owned);
      if (useSupabase && !u.ephemeral){
        const purchaseRef = requestId || ('purchase_' + crypto.randomBytes(12).toString('base64url'));
        sbApplyPurchaseTransaction(u, category, id, price, purchaseRef).then(result => {
          if (!result){
            this.sendText(JSON.stringify({ type: 'purchase_error', msg: '购买同步失败，请稍后重试' }));
            return;
          }
          if (result.insufficient === true){
            u.coins = Math.max(0, Number(result.coins) || 0);
            saveDB();
            this.sendText(JSON.stringify({ type: 'purchase_error', msg: '余额不足，请完成有效对局获取 💵' }));
            return;
          }
          u.coins = Math.max(0, Number(result.coins) || 0);
          u.owned = normalizeOwned(result.owned);
          u.purchaseRequests = Array.isArray(result.purchaseRequests)
            ? result.purchaseRequests.map(String).slice(-100)
            : u.purchaseRequests.concat(purchaseRef).slice(-100);
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
      if (ownsItem(u, category, id)){
        if (requestId) u.purchaseRequests = u.purchaseRequests.concat(requestId).slice(-100);
        saveDB();
        this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, alreadyOwned: true, profile: profileObj(u) } }));
        return;
      }
      if ((u.coins || 0) < price){
        this.sendText(JSON.stringify({ type: 'purchase_error', msg: '余额不足，先去赢几局吧' }));
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
      if (this.room) this.leaveRoom();
      if (this.spectatorRoom) removeSpectator(this, false);
      this.uid = null; this.tokenHash = null;
      saveDB(); sbSyncProfile(u);
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
    if (type === 'solo_progress'){
      const user = this.requireUser();
      if (!user) return;
      if (!this.room) recordSoloProgress(this, user, payload);
      return;
    }
    if (type === 'social_get'){
      if (!this.requireUser()) return;
      this.sendText(JSON.stringify({ type:'social_state', payload:socialState(this.uid) }));
      return;
    }
    if (type === 'friend_request'){
      if (!this.requireUser()) return;
      socialSendRequest(this, payload && payload.toUid);
      return;
    }
    if (type === 'friend_request_action'){
      if (!this.requireUser()) return;
      socialFriendRequestAction(this, payload || {});
      return;
    }
    if (type === 'friend_remove'){
      if (!this.requireUser()) return;
      socialRemoveFriend(this, payload && payload.uid);
      return;
    }
    if (type === 'block'){
      if (!this.requireUser()) return;
      socialBlock(this, payload && payload.uid);
      return;
    }
    if (type === 'unblock'){
      if (!this.requireUser()) return;
      socialUnblock(this, payload && payload.uid);
      return;
    }
    if (type === 'report'){
      if (!this.requireUser()) return;
      socialReport(this, payload || {});
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
      if (!r || !r.clients.has(this)){ this.sendText(JSON.stringify({ type: 'result_error', msg: '房间状态无效' })); return; }
      submitRoomResult(this, payload, r);
      return;
    }
    if (type === 'leaderboard'){
      this.sendText(JSON.stringify({ type: 'leaderboard', payload: leaderboardPayload() }));
      return;
    }
    if (type === 'lobby'){
      this.sendText(JSON.stringify({ type: 'lobby', payload: lobbyPayload(this.uid) }));
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
    if (type === 'quick_join'){
      if (!this.requireUser()) return;
      if (this.room || this.spectatorRoom){ this.sendText(JSON.stringify({ type:'error', msg:'请先离开当前房间或观战' })); return; }
      const wantedGame = String(payload && payload.game || '');
      const candidate = lobbyPayload(this.uid).filter(item => item.canJoin && (!wantedGame || item.game === wantedGame))
        .sort((a, b) => (b.humanCount - a.humanCount) || (a.aiCount - b.aiCount) || String(a.room).localeCompare(String(b.room)))[0];
      if (!candidate){ this.sendText(JSON.stringify({ type:'quick_join_empty', payload:{ game:wantedGame || null } })); return; }
      this.joinRoom(candidate.room, false);
      return;
    }
    if (type === 'spectate'){
      if (!this.requireUser()) return;
      if (this.room){ this.sendText(JSON.stringify({ type:'error', msg:'请先离开当前玩家席位' })); return; }
      const roomId = String(payload && payload.room || '').trim().toUpperCase();
      const room = rooms.get(roomId);
      if (!room || !room.allowSpectators){ this.sendText(JSON.stringify({ type:'error', msg:'该房间不存在或未开放观战' })); return; }
      if (this.spectatorRoom) removeSpectator(this, false);
      room.spectators = room.spectators instanceof Set ? room.spectators : new Set();
      room.spectators.add(this);
      this.spectatorRoom = room.id;
      this.player = null;
      this.sendText(JSON.stringify({ type:'spectating', payload:{
        ...roomPayload(room), spectator:true,
        moveSeq:room.moveSeq || 0, moveLog:(room.moveLog || []).map(event => ({seq:event.seq,player:event.player,payload:event.payload})),
        tankSnapshot:room.tankAuthority ? room.tankAuthority.snapshot() : null,
        tetrisSnapshot:room.tetrisAuthority ? room.tetrisAuthority.snapshot() : null,
      } }));
      broadcastRoom(room); broadcastLobby();
      return;
    }
    if (type === 'leave_spectator'){
      removeSpectator(this, true);
      return;
    }
    if (type === 'create'){
      if (!this.requireUser()) return;
      if (this.room) return;
      if (this.spectatorRoom) removeSpectator(this, false);
      let roomId = genCode();
      while (rooms.has(roomId)) roomId = genCode();
      const cap = Math.min(5, Math.max(2, parseInt(payload && payload.capacity, 10) || 2));
      const r = {
        id: roomId, host: this, clients: new Map([[this, 0]]), game: null, capacity: cap,
        seats:Array.from({length:cap}, (_, seatId) => seatId === 0 ? humanSeatFromSession(this, 0, true) : emptySeat(seatId)),
        spectators:new Set(), visibility:normalizeRoomVisibility(payload && payload.visibility), allowSpectators:payload && payload.allowSpectators !== false,
        started: false, matchId: null, resultClaims: new Map(), settled: false, disputed: false,
        moveSeq: 0, moveLog: [], moveLogBytes: 0, moveLogTruncated: false,
        tankInputSeq: {}, tankAuthoritySeq: 0, tankFinalSent: false,
        startedAt: 0, rewardProgress: null, resultRewards: new Map(),
      };
      rooms.set(roomId, r);
      this.room = roomId;
      this.player = 0;
      this.sendText(JSON.stringify({ type: 'created', room: roomId, player: 0, capacity: cap, payload:roomPayload(r) }));
      broadcastRoom(r);
      broadcastLobby();
      return;
    }
    if (type === 'join'){
      if (!this.requireUser()) return;
      this.joinRoom(String((payload && payload.room) || '').trim().toUpperCase(), false);
      return;
    }
    if (type === 'leave'){
      if (!this.requireUser()) return;
      this.leaveRoom();
      return;
    }
    if (!this.requireUser()) return;
    if (!this.room) return;
    const r = rooms.get(this.room);
    if (!r) return;
    if (type === 'ready'){
      if (r.started) return;
      const seat = seatForSession(r, this);
      if (!seat || seat.type !== 'human') return;
      seat.ready = seat.host ? true : payload && payload.ready !== false;
      broadcastRoom(r); broadcastLobby();
      return;
    }
    if (type === 'room_settings'){
      if (this !== r.host || r.started) return;
      if (payload && payload.visibility !== undefined) r.visibility = normalizeRoomVisibility(payload.visibility);
      if (payload && payload.allowSpectators !== undefined) r.allowSpectators = payload.allowSpectators === true;
      if (!r.allowSpectators && r.spectators instanceof Set){
        for (const spectator of r.spectators){
          spectator.spectatorRoom = null;
          spectator.sendText(JSON.stringify({ type:'spectator_left', payload:{ room:r.id, reason:'disabled' } }));
        }
        r.spectators.clear();
      }
      broadcastRoom(r); broadcastLobby();
      return;
    }
    if (type === 'add_ai'){
      if (this !== r.host || r.started) return;
      const seat = firstEmptySeat(r);
      const max = r.game && GAME_MAX[r.game] || r.capacity;
      if (!seat || activeSeatCount(r) >= Math.min(r.capacity, max)){
        this.sendText(JSON.stringify({ type:'error', msg:'没有可用的 AI 席位' })); return;
      }
      const difficulty = normalizeAIDifficulty(payload && payload.difficulty);
      const persona = normalizeAIPersona(payload && payload.persona);
      r.seats[seat.seatId] = {
        seatId:seat.seatId, type:'ai', userId:null, nickname:AI_PERSONAS[persona].name || 'AI', avatar:141,
        ready:true, host:false, online:true, aiDifficulty:difficulty, aiPersona:persona, controllerUid:this.uid,
      };
      broadcastRoom(r); broadcastLobby();
      return;
    }
    if (type === 'remove_ai'){
      if (this !== r.host || r.started) return;
      const seatId = Number(payload && payload.seatId);
      const seat = ensureRoomSeats(r)[seatId];
      if (!Number.isInteger(seatId) || !seat || seat.type !== 'ai') return;
      r.seats[seatId] = emptySeat(seatId);
      compactRoomPlayers(r);
      broadcastRoom(r); broadcastLobby();
      return;
    }
    if (type === 'invite'){
      if (this !== r.host) return;
      const toUid = payload && payload.toUid;
      if (!toUid) return;
      if (!db.users[toUid] || db.users[toUid].ephemeral){
        this.sendText(JSON.stringify({ type: 'error', msg: '受邀玩家不存在' }));
        return;
      }
      const joinLimit = r.game && GAME_MAX[r.game] ? Math.min(r.capacity, GAME_MAX[r.game]) : r.capacity;
      if (r.started || activeSeatCount(r) >= joinLimit || !firstEmptySeat(r)) return;
      if ([...r.clients.keys()].some(c => c.uid === toUid)) return;
      if (!socialAllowedBetween(this.uid, toUid)){
        this.sendText(JSON.stringify({ type:'social_error', msg:'该玩家已被屏蔽或屏蔽了你，不能邀请', payload:{ reason:'blocked' } }));
        return;
      }
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
      const curSize = activeSeatCount(r);
      if (!GAME_MAX[g] || curSize > GAME_MAX[g]){
        this.sendText(JSON.stringify({ type: 'error', msg: '该游戏最多支持 ' + (GAME_MAX[g] || 0) + ' 人，当前已加入 ' + curSize + ' 人' }));
        return;
      }
      r.game = g;
      for (const seat of humanRoomSeats(r)) seat.ready = !!seat.host;
      broadcastRoom(r);
      broadcastLobby();
      maybeAutoStart(r);
      return;
    }
    if (type === 'end_game'){
      if (this !== r.host) return;
      if (r.started && !r.settled){
        if (activeSeatCount(r) === 2) settleRoomForfeit(r, this, 'forfeit');
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
      if (!roomCanStart(r)){
        this.sendText(JSON.stringify({ type: 'error', msg: '请确认人数符合游戏规则且所有真人玩家都已 READY' }));
        return;
      }
      startRoomMatch(r);
      return;
    }
    if (type === 'bot_move'){
      const seat = controlledAISeat(r, this, payload && payload.seatId);
      const move = payload && payload.payload;
      if (!seat || !r.started || ['tank','tetris'].includes(r.game) || !move || typeof move !== 'object'){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'bot-controller-v1', reason:'unauthorized_or_inactive' } }));
        return;
      }
      if (r.game === 'monopoly' && move.decision === 'settle') return;
      if (!relayRoomMove(r, seat.seatId, move, null)) this.sendText(JSON.stringify({ type:'error', msg:'AI 走子数据无效' }));
      return;
    }
    if (type === 'bot_tank_input'){
      const seat = controlledAISeat(r, this, payload && payload.seatId);
      if (!seat || !r.started || r.game !== 'tank' || !r.tankAuthority){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:'unauthorized_bot' } })); return;
      }
      const accepted = r.tankAuthority.acceptInput(seat.seatId, payload, Date.now());
      if (!accepted.ok){ this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:accepted.reason } })); return; }
      recordRoomAction(r, seat.seatId, { act:'input', input:payload && payload.input });
      return;
    }
    if (type === 'bot_tetris_lock_claim' || type === 'bot_tetris_ko_claim'){
      const seat = controlledAISeat(r, this, payload && payload.seatId);
      if (!seat || !r.started || r.game !== 'tetris' || !r.tetrisAuthority || String(payload && payload.matchId || '') !== String(r.matchId || '')){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tetris-battle-authority-v1', reason:'unauthorized_bot' } })); return;
      }
      const accepted = type === 'bot_tetris_ko_claim'
        ? r.tetrisAuthority.claimKO(seat.seatId, payload, Date.now())
        : r.tetrisAuthority.claimLock(seat.seatId, payload, Date.now());
      if (!accepted.ok){ this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tetris-battle-authority-v1', reason:accepted.reason } })); return; }
      if (type === 'bot_tetris_lock_claim') recordRoomAction(r, seat.seatId, { piece:payload.piece, x:payload.x, y:payload.y, rot:payload.rot });
      broadcast(r, accepted.event);
      if (type === 'bot_tetris_lock_claim') relayRoomMove(r, seat.seatId, { act:'lock', piece:payload.piece, x:payload.x, y:payload.y, rot:payload.rot, placementSeq:payload.placementSeq, seq:payload.seq }, null, false);
      else relayRoomMove(r, seat.seatId, { act:'ko', reason:String(payload.reason || 'BOT TOP OUT').slice(0,40), seq:payload.seq }, null, false);
      if (accepted.result && !r.gameplayResultSent){
        r.gameplayResultSent = true; broadcast(r, accepted.result); settleAuthoritativeRoom(r, accepted.result.order, 'tetris_authority');
      }
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
      relayRoomMove(r, this.player, { act:'lock', piece:payload.piece, x:payload.x, y:payload.y, rot:payload.rot, placementSeq:payload.placementSeq, seq:payload.seq }, null, false);
      return;
    }
    if (type === 'tetris_sync'){
      if (!r.started || r.game !== 'tetris' || !r.tetrisAuthority || !payload || String(payload.matchId || '') !== String(r.matchId || '')) return;
      const sync = payload.payload;
      let bytes = 0; try { bytes = Buffer.byteLength(JSON.stringify(sync)); } catch { return; }
      if (!sync || typeof sync !== 'object' || bytes > 4096 || !['active'].includes(sync.act)) return;
      broadcast(r, { type:'move', player:this.player, payload:sync }, this);
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
      broadcast(r, accepted.event);
      relayRoomMove(r, this.player, { act:'ko', reason:String(payload.reason || 'TOP OUT').slice(0,40), seq:payload.seq }, null, false);
      if (accepted.result && !r.gameplayResultSent){
        r.gameplayResultSent = true;
        broadcast(r, accepted.result);
        settleAuthoritativeRoom(r, accepted.result.order, 'tetris_authority');
      }
      return;
    }
    if (type === 'move'){
      if (!r.started) return;
      if (!payload || typeof payload !== 'object') return;
      if ((r.game === 'tank' && r.tankAuthority) || (r.game === 'tetris' && r.tetrisAuthority)){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:r.game === 'tank' ? 'tank-authority-v1' : 'tetris-battle-authority-v1', reason:'legacy_move_rejected' } }));
        return;
      }
      if (r.game === 'monopoly' && payload.decision === 'settle' && this !== r.host){
        this.sendText(JSON.stringify({ type: 'error', msg: '只有房主可以提前结算' }));
        return;
      }
      let payloadBytes = 0;
      try { payloadBytes = Buffer.byteLength(JSON.stringify(payload)); } catch { return; }
      if (payloadBytes > 16384){
        this.sendText(JSON.stringify({ type: 'error', msg: '走子消息过大' }));
        return;
      }
      if (!acceptTankRelayPayload(r, this, payload)) return;
      relayRoomMove(r, this.player, payload, this);
      return;
    }
    if (type === 'restart'){
      if (this !== r.host) return;
      if (!r.game || !r.started) return;
      if (!r.settled){
        if (activeSeatCount(r) === 2) settleRoomForfeit(r, this, 'forfeit');
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
      startRoomAuthorities(r);
      recordAnalytics('match_started', {
        matchId: r.matchId, game: r.game, mode: 'online',
        metadata: { participantCount: activeSeatCount(r), restarted: true },
      });
      broadcast(r, { type: 'restart', matchId: r.matchId, gameplay:gameplayMetadata(r) });
    }
  }
  joinRoom(roomId, fromInvite){
    const r = rooms.get(roomId);
    if (!r){
      this.sendText(JSON.stringify({ type: 'error', msg: '房间不存在' }));
      return;
    }
    if (r.started){
      this.sendText(JSON.stringify({ type: 'error', msg: '对局已开始' }));
      return;
    }
    if (activeSeatCount(r) >= r.capacity || !firstEmptySeat(r)){
      this.sendText(JSON.stringify({ type: 'error', msg: '房间已满' }));
      return;
    }
    if (r.game && GAME_MAX[r.game] && activeSeatCount(r) + 1 > GAME_MAX[r.game]){
      this.sendText(JSON.stringify({ type: 'error', msg: '当前已选择的游戏最多支持 ' + GAME_MAX[r.game] + ' 人' }));
      return;
    }
    if (this.uid && [...r.clients.keys()].some(c => c.uid === this.uid)){
      this.sendText(JSON.stringify({ type: 'error', msg: '同一账号不能重复加入同一房间' }));
      return;
    }
    if (this.uid && [...r.clients.keys()].some(c => c.uid && !socialAllowedBetween(this.uid, c.uid))){
      this.sendText(JSON.stringify({ type: 'social_error', msg: '你与房间内成员存在屏蔽关系，无法加入该房间', payload:{ reason:'blocked' } }));
      return;
    }
    if (this.room){
      this.sendText(JSON.stringify({ type: 'error', msg: '你已在房间中' }));
      return;
    }
    if (this.spectatorRoom) removeSpectator(this, false);
    const openSeat = firstEmptySeat(r);
    const idx = openSeat.seatId;
    r.clients.set(this, idx);
    r.seats[idx] = humanSeatFromSession(this, idx, false);
    this.room = roomId;
    this.player = idx;
    this.sendText(JSON.stringify({ type: 'joined', room: roomId, player: idx, payload:roomPayload(r) }));
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
    if (Number.isInteger(departedPlayer)) r.seats[departedPlayer] = emptySeat(departedPlayer);
    this.room = null;
    this.player = null;
    if (!r.clients.size){
      for (const spectator of (r.spectators instanceof Set ? r.spectators : [])){
        spectator.spectatorRoom = null;
        spectator.sendText(JSON.stringify({ type:'peer_left', payload:{ roomClosed:true, player:departedPlayer } }));
      }
      stopRoomAuthorities(r);
      rooms.delete(r.id);
      broadcastLobby();
      cleanupEphemeralUser(this.uid);
      return;
    }
    let hostChanged = false;
    if (wasHost){
      r.host = [...r.clients.entries()].sort((a,b) => a[1] - b[1])[0][0];
      hostChanged = true;
    }
    resetRoomMatch(r);
    compactRoomPlayers(r);
    updateAIControllers(r);
    broadcast(r, { type:'peer_left', payload:{ roomClosed:false, player:departedPlayer } });
    if (hostChanged) broadcast(r, { type:'host_changed', payload:{ uid:r.host.uid, player:r.clients.get(r.host) } });
    broadcastRoom(r);
    broadcastLobby();
  }
  close(intentional){
    if (!this.alive) return;
    const uid = this.uid;
    this.alive = false;
    sessions.delete(this);
    if (this.spectatorRoom) removeSpectator(this, false);
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
}
