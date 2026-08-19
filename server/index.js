// 小游戏合集在线服务：静态文件 + WebSocket 房间中继（零依赖，手写 RFC6455）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ClusterCoordinator } = require('./cluster-coordinator');
const {
  normalizeUsername,
  validateUsername,
  validatePassword,
  hashPassword,
  verifyPassword,
} = require('./auth-credentials');
const TestAdmin = require('./test-admin');
const testAdmin = TestAdmin.createTestAdminPolicy(process.env);
if (testAdmin.fatal) throw new Error(TestAdmin.TEST_ADMIN_REASON);
const { createPlaylineModule, createJsonPlaylineStore, createSupabasePlaylineStore, PROTOCOL: PLAYLINE_PROTOCOL } = require('./playline');
const {
  normalizeStored: normalizePlayerCharacter,
  publicPresentation: publicPlayerCharacter,
} = require('./player-character');
const { deriveVictoryMastery } = require('../shared/progression/victory-mastery');
const Companion = require('./companion');
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
const EngagementIntegrityAnalyzer=(()=>{try{return require('./gameplay/engagement-integrity');}catch{return null;}})();
const { TANK_SNAPSHOT_DELTA_PROTOCOL, createTankSnapshotStream } = require('./gameplay/tank-snapshot-stream');
const { TetrisBattleAuthority } = require('./gameplay/tetris-battle');
const { XiangqiClockAuthority, MonopolyAuctionAuthority } = require('./gameplay/turn-protocols');
const { TournamentOrchestrator } = require('./gameplay/tournament');
const { TetrisRuleAuthority } = require('./gameplay/tetris-rule-authority');
const { XiangqiRuleAuthority } = require('./gameplay/xiangqi-rule-authority');
const { MonopolyRuleAuthority } = require('./gameplay/monopoly-rule-authority');
const { PROTOCOL_VERSIONS, capabilities: gameplayCapabilities } = require('./gameplay/protocol');
const {
  increment: incrementGameplayMetric,
  snapshot: gameplayMetricsSnapshot,
  safeSnapshot: safeGameplayMetricsSnapshot,
  alerts: gameplayMetricAlerts,
  historyCsv: gameplayMetricsHistoryCsv,
} = require('./gameplay/metrics');
const {
  createOperationalMetricsBoundary,
  createJsonMetricsAdapter,
} = require('./boundaries/operational-metrics');
const {
  createAuthProfileBoundary,
  createJsonRuntimeAuthProfileAdapter,
} = require('./boundaries/auth-profile');
const {
  createRoomPresenceBoundary,
  createJsonRuntimeRoomPresenceAdapter,
} = require('./boundaries/room-presence');
const {
  createMatchProtocolBoundary,
  createJsonRuntimeMatchProtocolAdapter,
} = require('./boundaries/match-protocol');
const {
  createChatPlaylineBoundary,
  createJsonRuntimeChatPlaylineAdapter,
} = require('./boundaries/chat-playline');
const {
  createRewardEconomyBoundary,
  createJsonRuntimeRewardEconomyAdapter,
} = require('./boundaries/reward-economy');
const {
  createRewardProgressionPolicy,
  createRewardProgression,
  createJsonRuntimeRewardProgressionAdapter,
} = require('./boundaries/reward-progression');
const { createServerClockTimer } = require('./boundaries/server-clock-timer');
const { createHeartbeatSweepIsolation } = require('./boundaries/heartbeat-sweep-isolation');
let operationalMetricsBoundary = null;
let authProfileBoundary = null;
let roomPresenceBoundary = null;
let matchProtocolBoundary = null;
let chatPlaylineBoundary = null;
let rewardEconomyBoundary = null;
let rewardProgression = null;
const serverClockTimer = createServerClockTimer({
  onError: (context, error) => {
    if (operationalMetricsBoundary) return operationalMetricsBoundary.recordError(context, error);
    incrementGameplayMetric('serverErrors');
    return { recorded: false, context, kind: String(error && error.name || 'Error') };
  },
});
const serverNow = () => serverClockTimer.now();
const rewardProgressionPolicy = createRewardProgressionPolicy({
  validGames: VALID_GAMES,
  dayKey,
  xpForLevel,
  levelFromXp,
  curveVersion: REWARD_CONFIG.level.curveVersion,
  normalizePlayerCharacter,
});
// Match Protocol has no player-facing persistence. The JSON runtime Adapter
// still receives an isolated runtime state callback so its commit contract is
// identical to the test Adapter without adding a schema field.
let matchProtocolRuntimeState = { journal: [] };
const METRICS_ADMIN_TOKEN = String(process.env.METRICS_ADMIN_TOKEN || '').trim();
const METRICS_HISTORY_INTERVAL_MS = Math.max(60000, Math.min(60 * 60 * 1000, Number(process.env.METRICS_HISTORY_INTERVAL_MS) || 5 * 60 * 1000));
const METRICS_HISTORY_LIMIT = Math.max(24, Math.min(10000, Number(process.env.METRICS_HISTORY_LIMIT) || 2016));
const REPLAY_TTL_MS = Math.max(60 * 60 * 1000, Math.min(30 * 24 * 60 * 60 * 1000, Number(process.env.REPLAY_TTL_MS) || 7 * 24 * 60 * 60 * 1000));
const REPLAY_PUBLIC_DELAY_MS = Math.max(0, Math.min(24 * 60 * 60 * 1000, Number(process.env.REPLAY_PUBLIC_DELAY_MS) || 5 * 60 * 1000));
const REPLAY_SHARE_TTL_MS = Math.max(10 * 60 * 1000, Math.min(7 * 24 * 60 * 60 * 1000, Number(process.env.REPLAY_SHARE_TTL_MS) || 24 * 60 * 60 * 1000));
const METRICS_THRESHOLDS = Object.freeze({
  protocolErrors: Math.max(1, Number(process.env.METRICS_PROTOCOL_ERROR_ALERT_THRESHOLD) || 20),
  clientResultRejected: Math.max(1, Number(process.env.METRICS_RESULT_REJECT_ALERT_THRESHOLD) || 20),
  serverErrors: Math.max(1, Number(process.env.METRICS_SERVER_ERROR_ALERT_THRESHOLD) || 1),
  activeMatches: Math.max(1, Number(process.env.METRICS_ACTIVE_MATCH_ALERT_THRESHOLD) || 200),
});
const TOURNAMENT_ADMIN_UIDS = new Set(String(process.env.TOURNAMENT_ADMIN_UIDS || '').split(',').map(value=>value.trim()).filter(Boolean));
function isTournamentAdmin(uid){ return !!uid && (testAdmin.hasCapability(uid, 'tournament_recover') || testAdmin.hasCapability(uid, 'tournament_create') || TOURNAMENT_ADMIN_UIDS.has(String(uid))); }
function recordOperationalError(context,error){
  if (operationalMetricsBoundary) return operationalMetricsBoundary.recordError(context,error);
  incrementGameplayMetric('serverErrors');
  return { recorded:false, context:'bootstrap', kind:'Error' };
}
function currentGameplayMetrics(){
  const snapshot=gameplayMetricsSnapshot({
    activeMatches:[...rooms.values()].filter(room=>room.started&&!room.settled).length,
    activeSpectators:[...rooms.values()].reduce((sum,room)=>sum+(room.spectators instanceof Map?room.spectators.size:0),0),
    activeTournaments:tournaments.size,
  });
  return safeGameplayMetricsSnapshot({
    ...snapshot,
    engagementIntegrityShadowEnabled:ENGAGEMENT_INTEGRITY_SHADOW_ENABLED?1:0,
    engagementIntegrityActiveAnalyzers:activeEngagementIntegrityAnalyzerCount(),
  });
}
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
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/* ---------------- AI 代理（DeepSeek） ---------------- */
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY || '';
const DEEPSEEK_MODELS = new Set(['deepseek-v4-flash','deepseek-v4-pro']);
const DEEPSEEK_MODEL = DEEPSEEK_MODELS.has(String(process.env.DEEPSEEK_MODEL || '')) ? String(process.env.DEEPSEEK_MODEL) : 'deepseek-v4-flash';
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
const companionConcurrentUser = new Set();
let companionGlobalConcurrent = 0;
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

async function callDeepSeek(messages, temperature, maxTokens){
  const deadline = Date.now() + AI_UPSTREAM_TIMEOUT_MS;
  const timeoutSignal = () => AbortSignal.timeout(Math.max(250, deadline - Date.now()));
  const payload = {
    model: DEEPSEEK_MODEL,
    messages,
    temperature: (typeof temperature === 'number' && temperature >= 0 && temperature <= 2) ? temperature : 0.4,
    max_tokens:Math.max(80,Math.min(600,Number(maxTokens)||200)),
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
    const requestedDifficulty = body.persona && typeof body.persona === 'object' &&
      ['easy','normal','hard'].includes(String(body.persona.difficulty || '').toLowerCase())
      ? String(body.persona.difficulty).toLowerCase() : null;
    // 新三档客户端只有困难档允许访问 DeepSeek。旧客户端没有 difficulty，保持既有兼容行为。
    // 简单/普通仍经过 personal-linear-v2 取得可确认学习票据，但不会产生上游费用或等待。
    const allowDeepSeek = requestedDifficulty ? requestedDifficulty === 'hard' : true;
    // 只有携带当前服务端 solo 票据的请求才会产生可学习 decisionId。
    // 这样 DeepSeek 慢响应在客户端超时/回退时不会凭空写入 AI 经验。
    const requestedContext = body.context && typeof body.context === 'object'
      ? body.context
      : (body && typeof body === 'object' ? body : {});
    const requestedMatchId = String(requestedContext.matchId || '');
    const requestedResultId = String(requestedContext.resultId || '');
    const matchAtStart = typeof soloMatches !== 'undefined' ? soloMatches.get(user.uid) : null;
    const contextBound = !!(!user.ephemeral && !testAdmin.shouldHidePublicUid(user.uid) && matchAtStart && !matchAtStart.completed &&
      matchAtStart.game === game && matchAtStart.matchId === requestedMatchId &&
      matchAtStart.resultId === requestedResultId);
    let upstreamChoice = null;
    if (DEEPSEEK_KEY && allowDeepSeek){
      try {
        upstreamChoice = await askDeepSeek(game, state, options, persona);
      } catch (e) {
        recordOperationalError('ai_upstream_request',e);console.error('AI 请求失败:', e.message);
      }
    }
    if (options && !options.includes(upstreamChoice)) upstreamChoice = null;
    const learningStore = user.ephemeral || testAdmin.shouldHidePublicUid(user.uid) ? normalizeAILearningStore() : db.aiLearning;
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
    recordOperationalError('ai_confirm_request',error);console.error('AI 确认请求处理失败:', error.message);
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
      recordOperationalError('ai_http_handler',e);console.error('AI 请求处理失败:', e && e.message || String(e));
      if (!res.headersSent) res.writeHead(500, { ...corsHeaders(req), 'Content-Type': 'application/json' });
      if (!res.writableEnded) res.end('{"choice":null,"error":"internal_error"}');
    });
    return;
  }
  if(req.method==='POST'&&urlPath==='/api/companion'){
    handleCompanion(req,res).catch(error=>{recordOperationalError('companion_http_handler',error);if(!res.headersSent)res.writeHead(500,{...corsHeaders(req),'Content-Type':'application/json','Cache-Control':'no-store'});if(!res.writableEnded)res.end('{"reply":"","mood":"neutral","animation":"idle","sourceType":"offline","error":"internal_error"}');});
    return;
  }
  if (req.method === 'POST' && urlPath === '/api/ai/confirm'){
    handleAIConfirm(req, res).catch(e => {
      recordOperationalError('ai_confirm_http_handler',e);console.error('AI 确认处理失败:', e && e.message || String(e));
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
  if (req.method === 'GET' && ['/api/metrics','/api/metrics/history','/api/metrics/export'].includes(urlPath)){
    const outcome=operationalMetricsBoundary.handle({
      method:req.method,
      path:urlPath,
      authorization:String((req.headers&&req.headers.authorization)||''),
      ip:requestIp(req),
    });
    res.writeHead(outcome.status,{...corsHeaders(req),...outcome.headers});
    res.end(outcome.body);return;
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
let tournamentTestStartFailureConsumed=false;
const tournamentTestFaults=process.env.NODE_ENV==='test'?{
  sourceResetConsumed:false,sourceResetRoomId:null,sourceResetWritesRemaining:0,
  abortReleaseFailuresRemaining:Math.max(0,Math.min(20,Number(process.env.TOURNAMENT_TEST_FAIL_ABORT_RELEASE_COUNT)||0)),
}:null;
const spectatorAccessGuard = new SpectatorAccessGuard({
  maxSpectators:Math.max(1,Math.min(50,Number(process.env.MAX_SPECTATORS)||12)),
  maxConnectionsPerUid:1,
});
const ROOM_PRESENCE_RETRY_LIMIT=Math.max(1,Math.min(8,Number(process.env.ROOM_PRESENCE_RETRY_LIMIT)||5));
const ROOM_PRESENCE_QUARANTINED_MUTATIONS=new Set([
  'match_expression','match_chat_send','move','bot_move','tank_input','bot_tank_input','tetris_lock_claim','tetris_attack_claim',
  'tetris_ko_claim','tetris_action','bot_tetris_action','tetris_state','xiangqi_action','monopoly_action','monopoly_auction_open','monopoly_bid','monopoly_turn_end',
  'game_state','result','start','restart','end_game','select_game','ready','room_settings','add_ai','remove_ai','invite',
]);
function roomPresenceRetryDelay(attempt){
  const base=Math.max(250,Math.min(5000,Number(process.env.ROOM_PRESENCE_RETRY_MS)||1000));
  return Math.min(30000,base*Math.pow(2,Math.max(0,Number(attempt)-1)));
}
const RECONNECT_TIMER_OWNER_PREFIX='reconnect-expiry:';
const ROOM_REMOVAL_RETRY_TIMER_OWNER_PREFIX='room-removal-retry:';
function cancelServerTimer(timer){
  if(!timer)return false;
  if(typeof timer.cancel==='function'){
    try{if(timer.cancel())return true;}catch(_error){}
  }
  try{clearTimeout(timer);return true;}catch(_error){return false;}
}
function cancelReconnectTimer(session){
  if(!session)return false;
  const timer=session.reconnectTimer;
  session.reconnectTimer=null;
  return cancelServerTimer(timer);
}
function scheduleReconnectTimer(session,room,delayMs){
  if(!session||!room)return null;
  cancelReconnectTimer(session);
  const lease=serverClockTimer.schedule({
    owner:RECONNECT_TIMER_OWNER_PREFIX+session.sessionId,
    delayMs,
    run:()=>{
      // Clear the owner field before entering expiry/retry logic. A failed
      // presence mutation may schedule the next lease under the same owner.
      session.reconnectTimer=null;
      return expireDetachedSession(room,session);
    },
  });
  if(lease.ok)session.reconnectTimer=lease;
  else recordOperationalError('reconnect_timer_schedule',new Error(lease.reason||'clock_timer_unavailable'));
  return lease.ok?lease:null;
}
function cancelRoomRemovalRetryTimer(session){
  if(!session)return false;
  const timer=session.roomRemovalRetryTimer;
  session.roomRemovalRetryTimer=null;
  return cancelServerTimer(timer);
}
function scheduleRoomRemovalRetryTimer(session,room,delayMs){
  if(!session||!room)return null;
  if(session.roomRemovalRetryTimer)return session.roomRemovalRetryTimer;
  const lease=serverClockTimer.schedule({
    owner:ROOM_REMOVAL_RETRY_TIMER_OWNER_PREFIX+session.sessionId,
    delayMs,
    run:()=>{
      session.roomRemovalRetryTimer=null;
      if(session.room===room.id)return session.leaveRoom();
      return true;
    },
  });
  if(lease.ok)session.roomRemovalRetryTimer=lease;
  else recordOperationalError('room_removal_retry_schedule',new Error(lease.reason||'clock_timer_unavailable'));
  return lease.ok?lease:null;
}
const ROOM_GRAPH_RECOVERY_SWEEP_MS=Math.max(1000,Math.min(5*60*1000,Number(process.env.ROOM_GRAPH_RECOVERY_SWEEP_MS)||30000));
const roomGraphRecoveryQueue=new Map();
let roomGraphRecoveryTimer=null;
const ROOM_GRAPH_RECOVERY_TIMER_OWNER='room-graph-recovery';
function cancelRoomGraphRecoveryTimer(){
  const timer=roomGraphRecoveryTimer;
  roomGraphRecoveryTimer=null;
  if(timer&&typeof timer.cancel==='function'){timer.cancel();return;}
  if(timer)clearInterval(timer);
}
function runRoomGraphRecoverySweep(){
  for(const [key,record] of roomGraphRecoveryQueue){
    let recovered=false;
    try{recovered=record&&typeof record.recover==='function'&&record.recover()===true;}catch(_error){recovered=false;}
    if(!recovered)continue;
    roomGraphRecoveryQueue.delete(key);
    try{if(typeof record.onRecovered==='function')record.onRecovered();}catch(_error){}
  }
  if(!roomGraphRecoveryQueue.size&&roomGraphRecoveryTimer)cancelRoomGraphRecoveryTimer();
}
function enqueueRoomGraphRecovery(key,record){
  const id=String(key||'');if(!id||!record||typeof record.recover!=='function')return false;
  roomGraphRecoveryQueue.set(id,record);
  if(!roomGraphRecoveryTimer){
    const lease=serverClockTimer.schedule({
      owner:ROOM_GRAPH_RECOVERY_TIMER_OWNER,
      delayMs:ROOM_GRAPH_RECOVERY_SWEEP_MS,
      repeat:true,
      run:()=>runRoomGraphRecoverySweep(),
    });
    if(!lease.ok){recordOperationalError('room_graph_recovery_schedule',new Error(lease.reason||'clock_timer_unavailable'));return false;}
    roomGraphRecoveryTimer=lease;
  }
  return true;
}
const tournamentGuard = new TournamentGuard({
  maxActive:Math.max(1,Math.min(500,Number(process.env.MAX_ACTIVE_TOURNAMENTS)||100)),
  maxPerOwner:Math.max(1,Math.min(20,Number(process.env.MAX_TOURNAMENTS_PER_OWNER)||3)),
  ttlMs:Math.max(60000,Math.min(24*60*60*1000,Number(process.env.TOURNAMENT_TTL_MS)||6*60*60*1000)),
});
function broadcastTournament(entry){
  if(!entry||!entry.tournament)return;
  const guardState=tournamentGuard.snapshot(entry.tournament.tournamentId);
  const payload={...entry.tournament.snapshot(),ownerUid:entry.ownerUid,
    participants:(entry.tournament.participants || []).map(item=>String(item && (item.id || item.uid || item))),
    consents:guardState&&guardState.consents||{},expiresAt:guardState&&guardState.expiresAt||null,
    guardStatus:guardState&&guardState.status||'expired'};
  const ids=new Set(entry.tournament.participants.map(item=>item.id));
  if (entry.ownerUid) ids.add(entry.ownerUid);
  for(const session of sessions)if(session.uid&&ids.has(session.uid))session.sendText(JSON.stringify({type:'tournament_state',payload}));
}
function registerTournamentPairings(entry){
  if(!entry||!entry.tournament)return false;
  const tournamentId=entry.tournament.tournamentId;
  const requests=(entry.tournament.pairings||[]).map(pairing=>({pairingId:pairing.pairingId,players:pairing.players}));
  return tournamentGuard.registerPairings(tournamentId,requests).ok;
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
function armTournamentSourceResetAdapterFailure(released){
  if(!tournamentTestFaults||tournamentTestFaults.sourceResetConsumed)return false;
  const forcedResetIndex=process.env.NODE_ENV==='test'&&/^\d+$/.test(String(process.env.TOURNAMENT_TEST_FAIL_SOURCE_RESET_INDEX||''))
    ?Number(process.env.TOURNAMENT_TEST_FAIL_SOURCE_RESET_INDEX):-1;
  const change=forcedResetIndex>=0&&released&&Array.isArray(released.changes)?released.changes[forcedResetIndex]:null;
  if(!change||!change.started||!change.roomId)return false;
  tournamentTestFaults.sourceResetConsumed=true;
  tournamentTestFaults.sourceResetRoomId=String(change.roomId);
  tournamentTestFaults.sourceResetWritesRemaining=1;
  return true;
}
function sendTournamentSourceTerminal(room){
  if(!room)return false;
  const text=JSON.stringify({type:'end_game'});
  for(const session of room.clients instanceof Map?room.clients.keys():[])session.sendText(text);
  // Terminal lifecycle events bypass spectatorDelay.  A delayed end_game can
  // otherwise arrive after the survivor has already entered the waiting room.
  for(const session of room.spectators instanceof Map?room.spectators.keys():[])session.sendText(text);
  return true;
}
function enqueueTournamentSourceResetRecovery(room,reason){
  if(!room||!room.id)return false;
  const expectedMatchId=String(room.matchId||'');
  room.presenceQuarantined=true;
  return enqueueRoomGraphRecovery('tournament-source-reset:'+room.id+':'+(expectedMatchId||'none'),{
    room,
    reason:reason||'room_presence_unavailable',
    recover:()=>{
      if(rooms.get(room.id)!==room)return true;
      // A later explicit lifecycle transition owns its new match.  Recovery
      // finalizes only the exact source match that lost its READY reset.
      if(!room.started||String(room.matchId||'')!==expectedMatchId)return true;
      const reset=resetRoomMatch(room);
      if(!reset.ok)return false;
      return true;
    },
    onRecovered:()=>{
      const sameCanonical=rooms.get(room.id)===room;
      const fullyRecovered=![...roomGraphRecoveryQueue.values()].some(record=>record.room===room);
      if(fullyRecovered)room.presenceQuarantined=false;
      if(sameCanonical)broadcastRoom(room);
      if(fullyRecovered)broadcastLobby();
    },
  });
}
function releaseTournamentSourceRooms(sessionMap,targetRooms=[]){
  const participants=[...sessionMap.values()];
  const sessionsById=new Map(participants.map(session=>[session.sessionId,session]));
  const sourceRooms=new Map();
  const spectatorRooms=new Map();
  for(const room of rooms.values())if(room&&room.clients instanceof Map&&participants.some(session=>room.clients.has(session)))sourceRooms.set(room.id,room);
  for(const room of rooms.values())if(room&&room.spectators instanceof Map&&participants.some(session=>room.spectators.has(session)))spectatorRooms.set(room.id,room);
  // RoomPresence commits every source membership transition as one graph
  // transaction.  No end_game, spectator or authority side effect is emitted
  // until all rooms have persisted successfully.
  const released=roomPresenceBoundary.room({action:targetRooms.length?'rehome_many':'release_many',sessions:participants,targetRooms,compactSources:true,preferOnlineHost:true,allowUnregistered:true});
  if(!released.ok)return{ok:false,reason:released.reason||'room_presence_unavailable'};
  // Arm only after rehome_many has durably committed.  The next reset_ready
  // persistence for this exact source id then fails through the real runtime
  // Adapter; its rollback write and the recovery retry remain healthy.
  armTournamentSourceResetAdapterFailure(released);
  const spectatorChangedRooms=new Set();
  const resetFailures=[];
  for(const release of released.spectatorReleases||[]){
    spectatorAccessGuard.leave(release.sessionId);
    const room=spectatorRooms.get(release.roomId),session=sessionsById.get(release.sessionId);
    if(room&&session){
      forgetTankSnapshotRecipient(room,session);spectatorChangedRooms.add(room);
    }
    if(session)session.sendText(JSON.stringify({type:'spectate_left',payload:{room:release.roomId,reason:'tournament_rehome'}}));
  }
  for(const change of released.changes||[]){
    const room=sourceRooms.get(change.roomId);
    if(!room)continue;
    spectatorChangedRooms.delete(room);
    for(const member of change.removed||[]){
      const session=sessionsById.get(member.sessionId);
      if(!session)continue;
      forgetTankSnapshotRecipient(room,session);
      if(change.started)session.sendText(JSON.stringify({type:'end_game'}));
    }
    if(change.closed || !room.clients.size){
      if(room.spectators)for(const spectator of room.spectators.keys()){spectatorAccessGuard.leave(spectator.sessionId);spectator.spectatorRoom=null;spectator.sendText(JSON.stringify({type:'peer_left',payload:{roomClosed:true}}));}
      stopRoomAuthorities(room);continue;
    }
    if(change.started){
      // rehome_many is already committed, so the old match can never resume:
      // stop every Authority and deliver the terminal edge synchronously even
      // when the Adapter-backed READY reset needs quarantine recovery.
      stopRoomAuthorities(room);
      sendTournamentSourceTerminal(room);
      const reset=resetRoomMatch(room);
      if(!reset.ok){
        const reason=reset.reason||'room_presence_unavailable';
        const queued=enqueueTournamentSourceResetRecovery(room,reason);
        resetFailures.push({roomId:room.id,reason,queued});
        broadcast(room,{type:'error',msg:'源房间状态已进入安全恢复队列',reason:'room_presence_quarantined'});
      }
    }
    notifyRoomReassignments(room,change.reassigned);
    if(change.hostChanged)broadcast(room,{type:'host_changed',payload:{uid:room.host&&room.host.uid||null,player:room.clients.get(room.host)}});
    broadcastRoom(room);
  }
  for(const room of spectatorChangedRooms)broadcastRoom(room);
  if((released.spectatorReleases||[]).length)broadcastLobby();
  if(resetFailures.length)return{
    ok:false,reason:resetFailures[0].reason,committed:true,
    sourceRecoveries:resetFailures.map(item=>({roomId:item.roomId,queued:item.queued})),
  };
  return{ok:true,targets:released.targets||[],retired:released.retired||[],spectatorReleases:released.spectatorReleases||[]};
}
function releaseTournamentAbortParticipants(sessionsToRelease){
  if(tournamentTestFaults&&tournamentTestFaults.abortReleaseFailuresRemaining>0){
    tournamentTestFaults.abortReleaseFailuresRemaining--;
    return{ok:false,reason:'tournament_test_abort_release_failed'};
  }
  return roomPresenceBoundary.room({action:'release_many',sessions:sessionsToRelease,compactSources:true,preferOnlineHost:true,allowUnregistered:true});
}
function createTournamentMatchRoom(entry,pairing,sessionMap){
  const participants=pairing.players.map(uid=>sessionMap.get(uid));
  if(participants.some(session=>!session))return{ok:false,reason:'participant_offline'};
  let roomId=genCode();while(rooms.has(roomId))roomId=genCode();
  const room={
    id:roomId,host:participants[0],clients:new Map(participants.map((session,player)=>[session,player])),game:entry.tournament.gameId,capacity:2,
    started:false,matchId:crypto.randomBytes(12).toString('base64url'),resultClaims:new Map(),settled:false,disputed:false,
    moveSeq:0,moveLog:[],moveLogBytes:0,moveLogTruncated:false,
    tankInputSeq:{},tankAuthoritySeq:0,tankFinalSent:false,
    startedAt:0,rewardProgress:null,resultRewards:new Map(),
    spectators:new Map(),maxSpectators:Math.max(1,Math.min(50,Number(process.env.MAX_SPECTATORS)||12)),
    spectatorDelayMs:Math.max(0,Math.min(30000,Number(process.env.SPECTATOR_DELAY_MS)||0)),gameSnapshot:null,
    tetrisPresentation:new Map(),tournamentBinding:null,finalResult:null,
  };
  return{ok:true,room,pairing,participants,bound:false,attached:false};
}
function rollbackTournamentMatchRooms(entry,plans,transaction){
  const state=transaction||{};
  let detachedNow=false;
  if(state.attachReceipt){
    const detached=entry.tournament.detachMatchRooms(state.attachReceipt,{source:'server_rollback'});
    if(!detached.ok)return false;
    state.attachReceipt=null;state.attached=false;detachedNow=true;
    for(const plan of plans)plan.attached=false;
  }
  if(state.bound||plans.some(plan=>plan.bound)){
    const requests=state.bindRequests||plans.map(plan=>({pairingId:plan.pairing.pairingId,matchId:plan.room.matchId,source:'server_rollback'}));
    const unbound=tournamentGuard.unbindMatches(entry.tournament.tournamentId,requests.map(request=>({pairingId:request.pairingId,matchId:request.matchId,source:'server_rollback'})));
    if(!unbound.ok){
      // A receipt-validated detach should make unbind deterministic.  If an
      // invariant nevertheless changed between the two synchronous commits,
      // restore the Orchestrator attachment so Guard and Orchestrator remain
      // consistently bound rather than exposing a split-brain half-state.
      if(detachedNow&&Array.isArray(state.attachRequests)){
        const restored=entry.tournament.attachMatchRooms(state.attachRequests,{source:'tournament'});
        if(restored.ok){state.attachReceipt=restored.rollbackReceipt;state.attached=true;for(const plan of plans)plan.attached=true;}
      }
      return false;
    }
    state.bound=false;
    for(const plan of plans)plan.bound=false;
  }
  return true;
}
function recoverQuarantinedTournamentAbort(entry,plans,sessionsReady,transaction){
  for(const plan of plans)stopRoomAuthorities(plan.room);
  const cleanup=releaseTournamentAbortParticipants([...sessionsReady.byUid.values()]);
  if(!cleanup.ok)return false;
  if(!rollbackTournamentMatchRooms(entry,plans,transaction))return false;
  entry.abortAttempts=0;entry.abortQuarantined=false;
  return true;
}
function scheduleTournamentAbortRetry(entry,plans,sessionsReady,transaction,reason){
  const attempts=Number(entry.abortAttempts)||0;
  if(attempts>=TOURNAMENT_ABORT_RETRY_LIMIT){
    entry.abortQuarantined=true;
    enqueueRoomGraphRecovery('tournament:'+entry.tournament.tournamentId,{
      recover:()=>recoverQuarantinedTournamentAbort(entry,plans,sessionsReady,transaction),
      onRecovered:()=>{broadcastTournament(entry);broadcastLobby();},
    });
    for(const session of sessionsReady.byUid.values())if(session&&session.alive)session.sendText(JSON.stringify({type:'tournament_error',msg:'赛事房间已进入安全恢复队列',reason:'tournament_room_cleanup_quarantined'}));
    broadcastTournament(entry);broadcastLobby();
    return{ok:false,reason:'tournament_room_cleanup_quarantined'};
  }
  entry.abortAttempts=attempts+1;
  if(!entry.abortTimer){
    entry.abortTimer=setTimeout(()=>{
      entry.abortTimer=null;
      const retried=abortCommittedTournamentMatchRooms(entry,plans,sessionsReady,transaction,reason);
      if(retried.recovered){broadcastTournament(entry);broadcastLobby();}
    },Math.min(30000,TOURNAMENT_ABORT_RETRY_MS*Math.pow(2,attempts)));
    if(entry.abortTimer&&entry.abortTimer.unref)entry.abortTimer.unref();
  }
  return{ok:false,reason:'tournament_room_cleanup_retry_scheduled'};
}
function abortCommittedTournamentMatchRooms(entry,plans,sessionsReady,transaction,reason){
  for(const plan of plans)stopRoomAuthorities(plan.room);
  const cleanup=releaseTournamentAbortParticipants([...sessionsReady.byUid.values()]);
  if(!cleanup.ok)return scheduleTournamentAbortRetry(entry,plans,sessionsReady,transaction,'tournament_room_cleanup_failed');
  const rolledBack=rollbackTournamentMatchRooms(entry,plans,transaction);
  if(!rolledBack)return scheduleTournamentAbortRetry(entry,plans,sessionsReady,transaction,'tournament_binding_rollback_failed');
  entry.abortAttempts=0;entry.abortQuarantined=false;
  return{ok:false,recovered:true,reason:reason||'tournament_room_prepare_failed'};
}
function autoCreateTournamentRound(entry,ready){
  const sessionsReady=ready&&ready.ok?ready:tournamentParticipantSessions(entry);if(!sessionsReady.ok)return sessionsReady;
  const plans=[];
  for(const pairing of entry.tournament.pairings||[]){const plan=createTournamentMatchRoom(entry,pairing,sessionsReady.byUid);if(!plan.ok)return plan;plans.push(plan);}
  const transaction={
    bindRequests:plans.map(plan=>({pairingId:plan.pairing.pairingId,matchId:plan.room.matchId,gameId:plan.room.game,players:plan.pairing.players.slice()})),
    attachRequests:plans.map(plan=>({pairingId:plan.pairing.pairingId,matchRoomId:plan.room.id,metadata:{gameId:plan.room.game,serverMatchId:plan.room.matchId}})),
    bound:false,attached:false,attachReceipt:null,
  };
  const bound=tournamentGuard.bindMatches(entry.tournament.tournamentId,transaction.bindRequests);
  if(!bound.ok)return bound;
  transaction.bound=true;for(const plan of plans)plan.bound=true;
  const attached=entry.tournament.attachMatchRooms(transaction.attachRequests,{source:'tournament'});
  if(!attached.ok){const rolledBack=rollbackTournamentMatchRooms(entry,plans,transaction);return rolledBack?attached:{ok:false,reason:'tournament_binding_rollback_failed'};}
  transaction.attached=true;transaction.attachReceipt=attached.rollbackReceipt;for(const plan of plans)plan.attached=true;
  const released=releaseTournamentSourceRooms(sessionsReady.byUid,plans.map(plan=>plan.room));
  if(!released.ok){
    if(released.committed)return abortCommittedTournamentMatchRooms(entry,plans,sessionsReady,transaction,released.reason||'room_presence_unavailable');
    const rolledBack=rollbackTournamentMatchRooms(entry,plans,transaction);return rolledBack?released:{ok:false,reason:'tournament_binding_rollback_failed'};
  }
  const targetsById=new Map((released.targets||[]).map(target=>[target.roomId,target]));
  for(const plan of plans){
    const target=targetsById.get(plan.room.id);
    const membersBySession=new Map((target&&target.members||[]).map(member=>[member.sessionId,member]));
    if(!target||plan.participants.some(session=>!membersBySession.has(session.sessionId)))return abortCommittedTournamentMatchRooms(entry,plans,sessionsReady,transaction,'room_registration_failed');
    plan.membersBySession=membersBySession;
  }
  try {
    const forcedStartFailureIndex=process.env.NODE_ENV==='test'&&/^\d+$/.test(String(process.env.TOURNAMENT_TEST_FAIL_START_INDEX||''))?Number(process.env.TOURNAMENT_TEST_FAIL_START_INDEX):-1;
    for(const [index,plan] of plans.entries()){
      if(index===forcedStartFailureIndex&&!tournamentTestStartFailureConsumed){tournamentTestStartFailureConsumed=true;throw new Error('room_start_failed');}
      if(!startRoomMatch(plan.room,{matchId:plan.room.matchId,skipCompact:true,deferAnnounce:true}))throw new Error('room_start_failed');
    }
  } catch (_error) {
    return abortCommittedTournamentMatchRooms(entry,plans,sessionsReady,transaction,'tournament_room_start_failed');
  }
  const paired=new Set();
  for(const plan of plans){
    for(const session of plan.participants){
      const member=plan.membersBySession.get(session.sessionId);
      session.sendText(JSON.stringify(member.player===0?{type:'created',room:plan.room.id,player:member.player,capacity:2}:{type:'joined',room:plan.room.id,player:member.player}));
    }
    plan.room.tournamentBinding={tournamentId:entry.tournament.tournamentId,roundId:plan.pairing.roundId,pairingId:plan.pairing.pairingId,matchRoomId:plan.room.id,source:'tournament',matchId:plan.room.matchId,players:plan.pairing.players.slice()};
    broadcastRoom(plan.room);
    announceRoomMatch(plan.room);
    for(const session of plan.participants)session.sendText(JSON.stringify({type:'tournament_match_assigned',payload:{...plan.room.tournamentBinding,gameId:plan.room.game,player:plan.room.clients.get(session)}}));
    plan.pairing.players.forEach(uid=>paired.add(uid));
  }
  for(const [uid,session] of sessionsReady.byUid)if(!paired.has(uid))session.sendText(JSON.stringify({type:'tournament_bye',payload:{tournamentId:entry.tournament.tournamentId,roundId:entry.tournament.round,source:'tournament'}}));
  broadcastTournament(entry);broadcastLobby();return{ok:true};
}
function tournamentRoundCanRetry(entry,guardState){
  if(!entry||!entry.tournament||!guardState||guardState.status!=='running'||entry.tournament.status!=='round_playing')return false;
  if(!Array.isArray(entry.tournament.pairings)||!entry.tournament.pairings.length||!Array.isArray(guardState.pairings)||!Array.isArray(guardState.bindings)||guardState.bindings.length)return false;
  const guardPairings=new Map(guardState.pairings.map(pairing=>[pairing.pairingId,pairing]));
  return entry.tournament.pairings.every(pairing=>{
    const guarded=guardPairings.get(pairing.pairingId);
    return pairing.status==='playing'&&!pairing.roomMetadata&&guarded&&guarded.status==='unbound'&&!guarded.matchId;
  });
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
    outcome={winnerUid:winner.uid,forfeit:/forfeit|admin_recovery/.test(String(options.cause||''))};
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
const AI_DIFFICULTIES = new Set(['easy', 'normal', 'hard']);
const AI_PERSONA_IDS = new Set(Object.keys(AI_PERSONAS));
const MATCH_EXPRESSION_PROTOCOL = 'match-expression-v1';
const MATCH_EXPRESSION_EMOJI_IDS = new Set(['emoji_wave','emoji_thumbsup','emoji_cheer','emoji_wow','emoji_oops','emoji_cry','emoji_angry','emoji_sly','emoji_heart','emoji_game']);
const MATCH_EXPRESSION_QUICK_IDS = new Set(['quick_hello','quick_good_luck','quick_nice','quick_wow','quick_thanks','quick_again']);
const MATCH_EXPRESSION_EVENT_RE = /^[A-Za-z][A-Za-z0-9_-]{7,80}$/;
const MATCH_CHAT_PROTOCOL = 'match-chat-v1';
const MATCH_CHAT_MESSAGE_RE = /^[A-Za-z][A-Za-z0-9_-]{7,80}$/;
const MATCH_CHAT_MAX_EVENTS = 50;

function normalizeRoomVisibility(value){ return value === 'private' ? 'private' : 'public'; }
function normalizeAIDifficulty(value){ return AI_DIFFICULTIES.has(value) ? value : 'normal'; }
function normalizeAIPersona(value){ return AI_PERSONA_IDS.has(value) ? value : 'teacher'; }
const roomPresenceAdapter = createJsonRuntimeRoomPresenceAdapter({
  readRooms:() => rooms,
  readSessions:() => sessions,
  readUsers:() => db && db.users || {},
  putRoom:room => {
    if(tournamentTestFaults&&tournamentTestFaults.sourceResetWritesRemaining>0&&
        String(room&&room.id||'')===tournamentTestFaults.sourceResetRoomId){
      tournamentTestFaults.sourceResetWritesRemaining--;
      if(!tournamentTestFaults.sourceResetWritesRemaining)tournamentTestFaults.sourceResetRoomId=null;
      throw new Error('tournament_test_source_reset_adapter_failure');
    }
    return rooms.set(room.id, room);
  },
  removeRoom:roomId => rooms.delete(roomId),
});
const TOURNAMENT_ABORT_RETRY_LIMIT=Math.max(1,Math.min(8,Number(process.env.TOURNAMENT_ABORT_RETRY_LIMIT)||5));
const TOURNAMENT_ABORT_RETRY_MS=Math.max(250,Math.min(30000,Number(process.env.TOURNAMENT_ABORT_RETRY_MS)||1000));
roomPresenceBoundary = createRoomPresenceBoundary({
  adapter:roomPresenceAdapter,
  now:serverNow,
  heartbeatTimeoutMs:HEARTBEAT_TIMEOUT_MS,
  gameMin:GAME_MIN,
  gameMax:GAME_MAX,
  normalizeVisibility:normalizeRoomVisibility,
  normalizeAIDifficulty,
  normalizeAIPersona,
  publicPlayerCharacter,
  isHiddenUid:uid => testAdmin.shouldHidePublicUid(uid),
  isFriend:(viewerUid, uid) => socialFriendship(viewerUid, uid),
  isAllowedBetween:(viewerUid, uid) => socialAllowedBetween(viewerUid, uid),
  gameplayMetadata:room => gameplayMetadata(room),
  secureEqual,
  cancelTimer:cancelServerTimer,
});
const matchProtocolAdapter=createJsonRuntimeMatchProtocolAdapter({
  read:()=>matchProtocolRuntimeState,
  write:next=>{matchProtocolRuntimeState=next;},
  send:(session,message)=>session&&session.sendText(JSON.stringify(message)),
  broadcast:(room,message)=>broadcast(room,message),
  incrementMetric:incrementGameplayMetric,
  recordAction:(room,player,action)=>recordRoomAction(room,player,action),
  settle:(room,order,cause)=>settleAuthoritativeRoom(room,order,cause),
  stop:room=>stopRoomGameplayTimer(room),
});
matchProtocolBoundary=createMatchProtocolBoundary({adapter:matchProtocolAdapter,now:serverNow});
function roomInspection(room, session){
  const outcome = roomPresenceBoundary.room({ action:'inspect', room, session });
  return outcome.ok ? outcome.details : { seats:[], activeSeats:[], humanSeats:[], aiSeats:[], firstEmptySeat:null, sessionSeat:null, activeCount:0, canStart:false, allOnline:false };
}
function emptySeat(seatId){
  const outcome = roomPresenceBoundary.room({ action:'seat', kind:'empty', seatId });
  return outcome.ok ? outcome.seat : { seatId, type:'empty', userId:null, nickname:'', avatar:0, frame:0, effect:0, nameFx:0, lang:'zh-CN', playerCharacter:publicPlayerCharacter(), ready:false, host:false, online:false, aiDifficulty:null, aiPersona:null, controllerUid:null };
}
function humanSeatFromSession(session, seatId, host){
  const outcome = roomPresenceBoundary.room({ action:'seat', kind:'human', session, seatId, host:!!host });
  return outcome.ok ? outcome.seat : emptySeat(seatId);
}
function ensureRoomSeats(room){
  return roomInspection(room, null).seats;
}
function activeRoomSeats(room){ return roomInspection(room, null).activeSeats; }
function humanRoomSeats(room){ return roomInspection(room, null).humanSeats; }
function aiRoomSeats(room){ return roomInspection(room, null).aiSeats; }
function activeSeatCount(room){ return roomInspection(room, null).activeCount; }
function firstEmptySeat(room){ return roomInspection(room, null).firstEmptySeat; }
function seatForSession(room, session){
  return roomInspection(room, session).sessionSeat;
}
function publicSeat(seat){
  const outcome = roomPresenceBoundary.room({ action:'seat', kind:'public', value:seat });
  return outcome.ok ? outcome.seat : emptySeat(Number(seat && seat.seatId) || 0);
}
function roomHostPayload(room){
  const seat = room && room.host ? seatForSession(room, room.host) : null;
  return { uid:room && room.host && room.host.uid || null, seatId:seat ? seat.seatId : null };
}
function updateAIControllers(room){
  roomPresenceBoundary.room({ action:'update_ai_controllers', room });
}
function notifyRoomReassignments(room,reassigned){
  for (const item of reassigned || []) {
    const session = [...(room.clients instanceof Map ? room.clients.keys() : [])].find(candidate =>
      candidate && candidate.uid === item.uid && (!item.sessionId || candidate.sessionId === item.sessionId));
    if (session) session.sendText(JSON.stringify({ type:'player_reassigned', payload:{ player:item.player } }));
  }
}
function compactRoomSeats(room){
  const outcome = roomPresenceBoundary.room({ action:'compact', room });
  if (!outcome.ok) return outcome;
  notifyRoomReassignments(room,outcome.reassigned);
  return outcome;
}
function roomCanStart(room){
  return roomInspection(room, null).canStart;
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
  return rewardProgressionPolicy.normalizeUser(u);
}

/* ---------------- Supabase 数据库（可选，配置环境变量后启用） ---------------- */
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);
const PLAYLINE_ENABLED = /^(1|true|on)$/i.test(String(process.env.ENABLE_PLAYLINE_V1 || ''));
const sbProfileQueues = new Map();
const sbAILearningQueues = new Map();
const sbAILearningDrains = new Map();
function profileRowToUser(r){
  if (!r || !r.uid) return null;
  return normalizeUserRewardState({
    uid:r.uid,name:r.name,avatar:r.avatar,coins:r.coins||0,xp:r.xp||0,level:r.level||1,streak:r.streak||0,bestStreak:r.best_streak||0,played:r.played||{},total:r.total||0,wins:r.wins||{},totalWins:r.total_wins||0,
    background:r.background||0,frame:r.frame||0,effect:r.effect||0,signature:r.signature||'',countryRegion:r.country_region||'',genderTag:r.gender_tag||'hidden',presencePreference:r.presence_preference||'joinable',presenceVisibility:r.presence_visibility||'everyone',showcase:r.showcase||null,
    owned:normalizeOwned(r.owned),gameCosmetics:normalizeGameCosmetics(r.game_cosmetics),playerCharacter:normalizePlayerCharacter(r.player_character),pin_hash:r.pin_hash||null,
    username:r.username||'',usernameKey:r.username_key||'',passwordHash:r.password_hash||null,authVersion:r.auth_version||'',companionCheckinDay:r.companion_checkin_day||'',lang:r.lang||'zh-CN',
    achievements:r.achievements||[],playmates:r.playmates||{},daily:r.daily||{play:0,win:0,streak:0},dailyKey:r.daily_key||'',dailyTaskKey:r.daily_task_key||'',dailyTasks:r.daily_tasks||null,nameFx:r.name_fx||0,
    authTokens:normalizeAuthTokenRecords(r.auth_tokens),recentResults:Array.isArray(r.recent_results)?r.recent_results.map(String).slice(-500):[],purchaseRequests:Array.isArray(r.purchase_requests)?r.purchase_requests.map(String).slice(-100):[],soloRate:Array.isArray(r.solo_rate)?r.solo_rate.map(Number).filter(Number.isFinite).slice(-100):[],dailyFirstWinDate:r.daily_first_win_date||'',dailyAICurrencyKey:r.daily_ai_currency_key||'',dailyAICurrencyEarned:r.daily_ai_currency_earned||0,xpCurveVersion:r.xp_curve_version||0,
  });
}

async function handleCompanion(req,res){
  const cors=corsHeaders(req),headers={...cors,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'};
  if(!originAllowed(req)){res.writeHead(403,headers);res.end(JSON.stringify({error:'origin_not_allowed'}));return;}
  if(!/^application\/json(?:\s*;|$)/i.test(String(req.headers['content-type']||''))){res.writeHead(415,headers);res.end(JSON.stringify({error:'content_type_required'}));return;}
  const user=authenticateHttp(req);if(!user){res.writeHead(401,headers);res.end(JSON.stringify({error:'authentication_required'}));return;}
  const ip=requestIp(req),minute=user.ephemeral?3:6,daily=user.ephemeral?20:60;
  if(!consumeAIRate('companion:user:'+user.uid,minute,daily)||!consumeAIRate('companion:ip:'+ip,20,240)||!consumeAIRate('companion:global',100,2000)){res.writeHead(429,{...headers,'Retry-After':'60'});res.end(JSON.stringify({error:'rate_limited'}));return;}
  if(companionConcurrentUser.has(user.uid)||companionGlobalConcurrent>=12){res.writeHead(429,{...headers,'Retry-After':'3'});res.end(JSON.stringify({error:'too_many_requests'}));return;}
  companionConcurrentUser.add(user.uid);companionGlobalConcurrent++;
  try{
    const chunks=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413,headers);res.end(JSON.stringify({error:'payload_too_large'}));return;}chunks.push(chunk);}
    let body=null;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{res.writeHead(400,headers);res.end(JSON.stringify({error:'invalid_json'}));return;}
    const input=Companion.normalizeRequest(body);if(!input.valid){res.writeHead(400,headers);res.end(JSON.stringify({error:input.reason}));return;}
    let result;
    if(!DEEPSEEK_KEY){result=Companion.fallback(input.locale,Companion.fallbackKind(input.message));}
    else{
      const messages=[{role:'system',content:Companion.systemPrompt(input.locale)},...input.history,{role:'user',content:input.message}];
      try{const content=await callDeepSeek(messages,.55,320);result=Companion.parseResponse(content,input.locale);}catch{result=Companion.fallback(input.locale,Companion.fallbackKind(input.message));}
    }
    res.writeHead(200,headers);res.end(JSON.stringify(result));
  }finally{companionConcurrentUser.delete(user.uid);companionGlobalConcurrent=Math.max(0,companionGlobalConcurrent-1);}
}
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
const clusterCoordinator = new ClusterCoordinator({
  enabled:useSupabase && String(process.env.ENABLE_CLUSTER_COORDINATION || '') === '1',
  rpc:(name,payload)=>sbFetch('rpc/'+name,{method:'POST',body:JSON.stringify(payload)}),
  instanceId:process.env.RENDER_INSTANCE_ID || process.env.INSTANCE_ID,
  deploymentId:process.env.RENDER_GIT_COMMIT || process.env.DEPLOYMENT_ID,
  telemetryUrl:process.env.TELEMETRY_WEBHOOK_URL,
  telemetryToken:process.env.TELEMETRY_WEBHOOK_TOKEN,
  telemetryAllowlist:process.env.TELEMETRY_WEBHOOK_ALLOWLIST,
  onEvent:handleClusterEvent,
  onError:recordOperationalError,
});
async function sbLoadProfiles(){
  if (!useSupabase) return;
  try {
    const rows = await sbFetch('profiles?select=*&order=coins.desc&limit=5000');
    const users = {};
    for (const r of (Array.isArray(rows) ? rows : [])){
      users[r.uid] = profileRowToUser(r);
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
    await sbLoadSocialGraph();
    await sbLoadDirectChat();
    console.log('已从 Supabase 加载 ' + Object.keys(users).length + ' 位玩家');
  } catch (e) {
    recordOperationalError('supabase_profile_load',e);console.error('加载 Supabase 数据失败（继续使用本地数据）:', e.message);
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
    recordOperationalError('supabase_reward_load',e);console.error('加载 Supabase 奖励流水失败（重复对手衰减仅使用当前进程数据）:', e.message);
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
    recordOperationalError('supabase_ai_model_load',error);console.error('加载 Supabase AI 学习模型失败（继续使用本地模型）:', error.message);
  }
}
function profileDbRow(u){
  return {
    uid: u.uid, name: u.name, avatar: u.avatar, coins: u.coins, xp: u.xp || 0, level: u.level || 1,
    streak: u.streak || 0, best_streak: u.bestStreak || 0, played: u.played || {}, total: u.total || 0,
    wins: u.wins || {}, total_wins: u.totalWins || 0,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: normalizeOwned(u.owned), game_cosmetics: normalizeGameCosmetics(u.gameCosmetics), pin_hash: u.pin_hash || null,
    username: u.username || null, username_key: u.usernameKey || null, password_hash: u.passwordHash || null, auth_version: u.authVersion || null, companion_checkin_day:u.companionCheckinDay || '',
    lang: u.lang || 'zh-CN',
    achievements: u.achievements || [], playmates: u.playmates || {},
    signature: u.signature || '', country_region: u.countryRegion || '', gender_tag: u.genderTag || 'hidden',
    presence_preference: u.presencePreference || 'joinable', presence_visibility: u.presenceVisibility || 'everyone', showcase: u.showcase || null,
    daily: u.daily || { play: 0, win: 0, streak: 0 }, daily_key: u.dailyKey || '', daily_task_key: u.dailyTaskKey || '', daily_tasks: u.dailyTasks || null, name_fx: u.nameFx || 0,
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
    signature: sanitizePlainText(u && u.signature, 80),
    country_region: /^[A-Z]{2}$/.test(String(u && u.countryRegion || '').toUpperCase()) ? String(u.countryRegion).toUpperCase() : '',
    gender_tag: ['hidden','male','female','nonbinary'].includes(u && u.genderTag) || /^custom:[^<>]{1,16}$/.test(String(u && u.genderTag || '')) ? u.genderTag : 'hidden',
    presence_preference: ['joinable','online','busy','invisible'].includes(u && u.presencePreference) ? u.presencePreference : 'joinable',
    presence_visibility: ['everyone','friends','nobody'].includes(u && u.presenceVisibility) ? u.presenceVisibility : 'everyone',
    showcase: u && u.showcase && typeof u.showcase === 'object' ? u.showcase : null,
    updated_at: new Date().toISOString(),
  };
}
function authProfileDbRow(u){
  return {
    pin_hash: u && u.pin_hash || null,
    username: u && u.username || null,
    username_key: u && u.usernameKey || null,
    password_hash: u && u.passwordHash || null,
    auth_version: u && u.authVersion || null,
    companion_checkin_day:u && u.companionCheckinDay || '',
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
    recordOperationalError('supabase_profile_sync',error);console.error('Supabase ' + (label || '同步档案') + '失败:', error.message);
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
  } catch (e) { recordOperationalError('supabase_row_write',e);console.error('Supabase 写入' + label + '失败:', e.message); }
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
  if (!row || testAdmin.shouldHidePublicUid(row.uid) || (db.users[row.uid] && db.users[row.uid].ephemeral)) return Promise.resolve();
  return sbInsert('history', [historyDbRow(row)], '对局历史');
}
function sbAddRewardHistory(row){
  if (!row || testAdmin.shouldHidePublicUid(row.uid) || (db.users[row.uid] && db.users[row.uid].ephemeral)) return Promise.resolve();
  return sbInsert('reward_history', [rewardDbRow(row)], '奖励流水');
}
function sbAddEconomyLedger(row){
  if (!row || testAdmin.shouldHidePublicUid(row.uid) || !row.amount || (db.users[row.uid] && db.users[row.uid].ephemeral)) return Promise.resolve();
  return sbInsert('economy_ledger', [ledgerDbRow(row)], '经济流水');
}
function sbAddAnalyticsEvents(rows){
  const safe = (Array.isArray(rows) ? rows : [rows]).filter(Boolean).filter(row => !row.uid || (!testAdmin.shouldHidePublicUid(row.uid) && !(db.users[row.uid] && db.users[row.uid].ephemeral)));
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
    if (!conflict){recordOperationalError('supabase_ai_learning_tx',error);console.error('Supabase AI 学习事务失败:', message);}
    return { ok: false, duplicate: false, conflict, error: message };
  });
  sbAILearningQueues.set(queueKey, run);
  run.finally(() => { if (sbAILearningQueues.get(queueKey) === run) sbAILearningQueues.delete(queueKey); });
  return run;
}

/* ---------------- 排行榜持久化（JSON 文件） ---------------- */
function emptyDB(){
  return {
    users: {}, history: [], rewardHistory: [], economyLedger: [], events: [], replays: [], metricsHistory: [], opsIncidents: [],
    pendingRewardSync: [], aiLearning: normalizeAILearningStore(), pendingAILearningSync: [],
    friendRequests: [], friendships: [], blocks: [], reports: [],
    chatMessages: [], chatReads: {}, nextChatSeq: '0', playlinePosts: [], nextPlaylineSeq: '0',
  };
}
let db = emptyDB();
const authProfileAdapter = createJsonRuntimeAuthProfileAdapter({
  readUser: uid => db.users && db.users[String(uid)] || null,
  readUsers: () => db.users || {},
  putUser: user => { db.users[user.uid] = user; },
  removeUser: uid => { if (db.users) delete db.users[String(uid)]; },
});
// Construct before loadDB(): token normalization is also used while legacy
// JSON records are migrated.  All policy callbacks are lazy function
// references, so constants declared later are only read after bootstrap.
authProfileBoundary = createAuthProfileBoundary({
  adapter: authProfileAdapter,
  now: serverNow,
  tokenTtlMs: Math.max(3600000, Math.min(365 * 86400000, Number(process.env.AUTH_TOKEN_TTL_MS) || 30 * 86400000)),
  tokenLimit: 5,
  normalizeUser: normalizeUserRewardState,
  normalizeOwned,
  normalizeGameCosmetics,
  publicPlayerCharacter,
  deriveMastery: deriveVictoryMastery,
  levelProgress,
  xpForLevel,
  dailyTasksPayload,
  publicPresence,
  virtualProfile: (profile, options) => testAdmin.virtualProfile(profile, options),
  isHidden: uid => testAdmin.shouldHidePublicUid(uid),
  isTestAdmin: uid => testAdmin.isTestAdminUid(uid),
  validOwnedId,
  ownsItem,
  sanitizePlainText,
  validGames: VALID_GAMES,
  getShopPrices: () => SHOP_PRICES,
  canCompare: (viewer, target) => socialFriendship(viewer.uid, target.uid) && !socialBlockedBetween(viewer.uid, target.uid),
});
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
      replays: Array.isArray(parsed.replays) ? parsed.replays : [],
      metricsHistory: Array.isArray(parsed.metricsHistory) ? parsed.metricsHistory.map(safeGameplayMetricsSnapshot) : [],
      opsIncidents: Array.isArray(parsed.opsIncidents) ? parsed.opsIncidents : [],
      // 在 Supabase 短暂不可用或进程重启时保留正式奖励，避免已回执给玩家的奖励回档。
      pendingRewardSync: Array.isArray(parsed.pendingRewardSync) ? parsed.pendingRewardSync : [],
      aiLearning: normalizeAILearningStore(parsed.aiLearning),
      pendingAILearningSync: Array.isArray(parsed.pendingAILearningSync) ? parsed.pendingAILearningSync : [],
      friendRequests: Array.isArray(parsed.friendRequests) ? parsed.friendRequests : [],
      friendships: Array.isArray(parsed.friendships) ? parsed.friendships : [],
      blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      chatMessages: Array.isArray(parsed.chatMessages) ? parsed.chatMessages : [],
      chatReads: parsed.chatReads && typeof parsed.chatReads === 'object' && !Array.isArray(parsed.chatReads) ? parsed.chatReads : {},
      nextChatSeq: String(parsed.nextChatSeq || '0'),
      playlinePosts: Array.isArray(parsed.playlinePosts) ? parsed.playlinePosts : [],
      nextPlaylineSeq: String(parsed.nextPlaylineSeq || '0'),
    };
  } catch { db = emptyDB(); }
  db.pendingRewardSync = db.pendingRewardSync.filter(item => item && item.uid && item.row && item.row.resultId).slice(-10000);
  db.pendingAILearningSync = db.pendingAILearningSync.filter(item => item && item.uid && item.resultId && item.model &&
    Array.isArray(item.experiences) && item.experiences.length).slice(-5000);
  db.friendRequests = db.friendRequests.filter(row => row && row.id && row.fromUid && row.toUid && row.status === 'pending').slice(-50000);
  db.friendships = db.friendships.filter(row => row && row.id && row.aUid && row.bUid && row.aUid !== row.bUid).slice(-50000);
  db.blocks = db.blocks.filter(row => row && row.id && row.blockerUid && row.blockedUid && row.blockerUid !== row.blockedUid).slice(-50000);
  db.reports = db.reports.filter(row => row && row.id && row.reporterUid && row.targetUid && row.reason).slice(-50000);
  normalizeChatStore();
  db.metricsHistory = (db.metricsHistory || []).map(safeGameplayMetricsSnapshot).slice(-METRICS_HISTORY_LIMIT);
  db.opsIncidents = (db.opsIncidents || []).filter(item=>item&&/^[a-f0-9]{16}$/.test(String(item.fingerprint||''))&&item.context&&item.kind).slice(-500);
  for (const [uid, u] of Object.entries(db.users)){
    u.uid = u.uid || uid;
    u.username = typeof u.username === 'string' ? u.username : '';
    u.usernameKey = u.username ? normalizeUsername(u.username) : '';
    u.passwordHash = typeof u.passwordHash === 'string' ? u.passwordHash : null;
    u.authVersion = typeof u.authVersion === 'string' ? u.authVersion : (u.passwordHash ? 'username-password-v1' : 'legacy-pin-v1');
    if (u.coins === undefined) u.coins = u.points || 0;
    delete u.points;
    if (!u.played) u.played = {};
    if (!u.total) u.total = 0;
    u.owned = normalizeOwned(u.owned);
    u.gameCosmetics = normalizeGameCosmetics(u.gameCosmetics);
    if (!Array.isArray(u.achievements)) u.achievements = [];
    if (!u.playmates || typeof u.playmates !== 'object') u.playmates = {};
    if (typeof u.signature !== 'string') u.signature = '';
    if (typeof u.countryRegion !== 'string') u.countryRegion = '';
    if (typeof u.genderTag !== 'string') u.genderTag = 'hidden';
    if (!['joinable','online','busy','invisible'].includes(u.presencePreference)) u.presencePreference = 'joinable';
    if (!['everyone','friends','nobody'].includes(u.presenceVisibility)) u.presenceVisibility = 'everyone';
    if (!u.showcase || typeof u.showcase !== 'object') u.showcase = null;
    if (!u.daily || typeof u.daily !== 'object') u.daily = { play: 0, win: 0, streak: 0 };
    ensureServerDailyTasks(u);
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
function testAdminUidCandidates(value){ return String(value || '').split('|').map(String).filter(Boolean); }
function saveDB(){
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  const users = Object.fromEntries(Object.entries(db.users).filter(([, u]) => !u.ephemeral));
  const history = db.history.filter(h => h && !testAdmin.shouldHidePublicUid(h.uid) && !h.ephemeral && (!db.users[h.uid] || !db.users[h.uid].ephemeral));
  const rewardHistory = db.rewardHistory.filter(h => h && !testAdmin.shouldHidePublicUid(h.uid) && !h.ephemeral && (!db.users[h.uid] || !db.users[h.uid].ephemeral));
  const economyLedger = db.economyLedger.filter(h => h && !testAdmin.shouldHidePublicUid(h.uid) && !h.ephemeral && (!db.users[h.uid] || !db.users[h.uid].ephemeral));
  const events = db.events.filter(h => h && !testAdmin.shouldHidePublicUid(h.uid) && (!h.uid || !db.users[h.uid] || !db.users[h.uid].ephemeral));
  const replays = (db.replays || []).filter(item => item && Number(item.expiresAt || 0) > Date.now() && (!item.uids || !item.uids.some(testAdmin.shouldHidePublicUid) && item.uids.some(uid => !db.users[uid] || !db.users[uid].ephemeral)));
  const pendingRewardSync = (db.pendingRewardSync || []).filter(item => item && !item.ephemeral &&
    !testAdmin.shouldHidePublicUid(item.uid) && (!db.users[item.uid] || !db.users[item.uid].ephemeral));
  const pendingAILearningSync = (db.pendingAILearningSync || []).filter(item => item && !item.ephemeral &&
    !testAdmin.shouldHidePublicUid(item.uid) && (!db.users[item.uid] || !db.users[item.uid].ephemeral));
  const aiLearning = {
    ...(db.aiLearning || {}),
    models:Object.fromEntries(Object.entries((db.aiLearning && db.aiLearning.models) || {}).filter(([key]) => !String(key).split('|')[0] || !testAdmin.shouldHidePublicUid(String(key).split('|')[0]))),
    experiences:((db.aiLearning && db.aiLearning.experiences) || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.uid)),
    appliedResults:((db.aiLearning && db.aiLearning.appliedResults) || []).filter(key => !testAdmin.shouldHidePublicUid(String(key).split('|')[0])),
  };
  const friendRequests=(db.friendRequests||[]).filter(row=>row&&!testAdmin.shouldHidePublicUid(row.fromUid)&&!testAdmin.shouldHidePublicUid(row.toUid));
  const friendships=(db.friendships||[]).filter(row=>row&&!testAdmin.shouldHidePublicUid(row.aUid)&&!testAdmin.shouldHidePublicUid(row.bUid));
  const blocks=(db.blocks||[]).filter(row=>row&&!testAdmin.shouldHidePublicUid(row.blockerUid)&&!testAdmin.shouldHidePublicUid(row.blockedUid));
  const reports=(db.reports||[]).filter(row=>row&&!testAdmin.shouldHidePublicUid(row.reporterUid)&&!testAdmin.shouldHidePublicUid(row.targetUid));
  const chatMessages=(db.chatMessages||[]).filter(row=>row&&!testAdmin.shouldHidePublicUid(row.senderUid)&&!testAdmin.shouldHidePublicUid(row.recipientUid));
  const chatReads=Object.fromEntries(Object.entries(db.chatReads||{}).filter(([key])=>![...testAdminUidCandidates(key)].some(testAdmin.shouldHidePublicUid)));
  const playlinePosts=(db.playlinePosts||[]).filter(row=>row&&!testAdmin.shouldHidePublicUid(row.authorUid)&&(!db.users[row.authorUid]||!db.users[row.authorUid].ephemeral));
  fs.writeFileSync(tmp, JSON.stringify({ users, history, rewardHistory, economyLedger, events, replays,
    metricsHistory:db.metricsHistory||[],opsIncidents:db.opsIncidents||[],
    pendingRewardSync, aiLearning, pendingAILearningSync,
    friendRequests, friendships, blocks, reports,
    chatMessages, chatReads, nextChatSeq: db.nextChatSeq || '0', playlinePosts, nextPlaylineSeq: db.nextPlaylineSeq || '0',
  }, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function trimAuditData(){
  db.history = db.history.filter(row => row && !testAdmin.shouldHidePublicUid(row.uid));
  db.rewardHistory = db.rewardHistory.filter(row => row && !testAdmin.shouldHidePublicUid(row.uid));
  db.economyLedger = db.economyLedger.filter(row => row && !testAdmin.shouldHidePublicUid(row.uid));
  db.events = db.events.filter(row => row && !testAdmin.shouldHidePublicUid(row.uid));
  db.replays = (db.replays || []).filter(row => row && (!Array.isArray(row.uids) || !row.uids.some(testAdmin.shouldHidePublicUid)));
  db.pendingRewardSync = (db.pendingRewardSync || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.uid));
  db.pendingAILearningSync = (db.pendingAILearningSync || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.uid));
  db.friendRequests = (db.friendRequests || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.fromUid) && !testAdmin.shouldHidePublicUid(row.toUid));
  db.friendships = (db.friendships || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.aUid) && !testAdmin.shouldHidePublicUid(row.bUid));
  db.blocks = (db.blocks || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.blockerUid) && !testAdmin.shouldHidePublicUid(row.blockedUid));
  db.reports = (db.reports || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.reporterUid) && !testAdmin.shouldHidePublicUid(row.targetUid));
  db.chatMessages = (db.chatMessages || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.senderUid) && !testAdmin.shouldHidePublicUid(row.recipientUid));
  db.playlinePosts = (db.playlinePosts || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.authorUid));
  db.aiLearning.models = Object.fromEntries(Object.entries((db.aiLearning && db.aiLearning.models) || {}).filter(([key]) => !testAdmin.shouldHidePublicUid(String(key).split('|')[0])));
  db.aiLearning.experiences = (db.aiLearning.experiences || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.uid));
  db.aiLearning.appliedResults = (db.aiLearning.appliedResults || []).filter(key => !testAdmin.shouldHidePublicUid(String(key).split('|')[0]));
  if (db.history.length > 10000) db.history = db.history.slice(-5000);
  if (db.rewardHistory.length > 50000) db.rewardHistory = db.rewardHistory.slice(-25000);
  if (db.economyLedger.length > 10000) db.economyLedger = db.economyLedger.slice(-5000);
  if (db.events.length > 20000) db.events = db.events.slice(-10000);
  db.replays = (db.replays || []).filter(item => item && Number(item.expiresAt || 0) > Date.now()).slice(-2000);
  db.metricsHistory = (db.metricsHistory || []).map(safeGameplayMetricsSnapshot).slice(-METRICS_HISTORY_LIMIT);
  db.opsIncidents = (db.opsIncidents || []).filter(item=>item&&item.fingerprint&&item.context&&item.kind).slice(-500);
  db.aiLearning.experiences = db.aiLearning.experiences.slice(-20000);
  db.aiLearning.appliedResults = db.aiLearning.appliedResults.slice(-50000);
  if (db.friendRequests.length > 50000) db.friendRequests = db.friendRequests.slice(-25000);
  if (db.friendships.length > 50000) db.friendships = db.friendships.slice(-25000);
  if (db.blocks.length > 50000) db.blocks = db.blocks.slice(-25000);
  if (db.reports.length > 50000) db.reports = db.reports.slice(-25000);
  if (db.playlinePosts.length > 20000) db.playlinePosts = db.playlinePosts.slice(-10000);
  trimChatData();
}
const operationalMetricsAdapter=createJsonMetricsAdapter({
  read:()=>({history:db.metricsHistory||[],incidents:db.opsIncidents||[]}),
  write:state=>{
    db.metricsHistory=state.history;
    db.opsIncidents=state.incidents;
    trimAuditData();
    saveDB();
  },
});
operationalMetricsBoundary=createOperationalMetricsBoundary({
  adapter:operationalMetricsAdapter,
  adminToken:METRICS_ADMIN_TOKEN,
  historyIntervalMs:METRICS_HISTORY_INTERVAL_MS,
  historyLimit:METRICS_HISTORY_LIMIT,
  thresholds:METRICS_THRESHOLDS,
  now:() => serverClockTimer.now(),
  currentMetrics:currentGameplayMetrics,
  safeSnapshot:safeGameplayMetricsSnapshot,
  alerts:gameplayMetricAlerts,
  historyCsv:gameplayMetricsHistoryCsv,
  incrementMetric:incrementGameplayMetric,
  onAccess:access=>{
    recordAnalytics('metrics_read',{metadata:{path:access.path,ipHash:access.ipHash}});
    trimAuditData();
    saveDB();
  },
});
function recordAnalytics(event, meta = {}){
  if (meta && meta.uid && testAdmin.shouldHidePublicUid(meta.uid)) return null;
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
function recordEconomyChange(u, kind, amount, refId, metadata, syncRemote = true, atOverride){
  amount = Math.trunc(Number(amount) || 0);
  if (!u || testAdmin.shouldHidePublicUid(u.uid) || !amount) return null;
  const row = {
    uid: u.uid,
    kind: String(kind || 'adjustment'),
    amount,
    balanceAfter: u.coins || 0,
    refId: refId || null,
    metadata: metadata && typeof metadata === 'object' ? metadata : {},
    at: Number.isSafeInteger(Number(atOverride)) && Number(atOverride) >= 0 ? Number(atOverride) : Date.now(),
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
    at: row.at,
    metadata: { amount, balanceAfter: row.balanceAfter, kind: row.kind, refId: row.refId },
  });
  return row;
}
function sanitizePlainText(value, maxLength){
  return String(value == null ? '' : value).replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, maxLength);
}
function publicPresence(uid, user, viewerUid){
  const outcome = roomPresenceBoundary.presence({ action:'public', uid, user, viewerUid });
  return outcome.ok ? outcome.value : 'offline';
}
function leaderboardPayload(){
  const online = roomPresenceBoundary.presence({ action:'online_uids' });
  const onlineUids = new Set(online.ok ? online.uids : []);
  const list = Object.keys(db.users).filter(uid => !db.users[uid].ephemeral && !testAdmin.shouldHidePublicUid(uid))
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
  return { list, total: Object.values(db.users).filter(u => !u.ephemeral && !testAdmin.shouldHidePublicUid(u.uid)).length };
}
function broadcastLeaderboard(){
  const payload = leaderboardPayload();
  for (const s of sessions) s.sendText(JSON.stringify({ type: 'leaderboard', payload }));
}
function lobbyPayload(viewerUid){
  const outcome = roomPresenceBoundary.room({ action:'lobby', viewerUid });
  return outcome.ok ? outcome.rooms : [];
}
function broadcastLobby(){
  for (const s of sessions) s.sendText(JSON.stringify({ type: 'lobby', payload: lobbyPayload(s.uid) }));
}
function roomPayload(r){
  const outcome = roomPresenceBoundary.room({ action:'payload', room:r });
  return outcome.ok ? outcome.payload : { room:r && r.id || null, players:[], seats:[], size:0, activePlayerCount:0, humanCount:0, aiCount:0, onlineSize:0, spectatorCount:0, maxSpectators:0, started:false, settled:false, matchId:null, visibility:'public', allowSpectators:false, testAdminSandbox:false, canStart:false, host:{uid:null,seatId:null}, gameplay:null };
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
function clearExpiredResumes(at){
  const now = Number.isFinite(Number(at)) ? Number(at) : Date.now();
  for (const [key, value] of expiredResumes) if (!value || value.expiresAt <= now) expiredResumes.delete(key);
}
const ephemeralCleanupTimers = new Map();
const EPHEMERAL_CLEANUP_TIMER_OWNER_PREFIX='ephemeral-cleanup:';
function cancelEphemeralCleanup(uid){
  const key=String(uid||''),timer=ephemeralCleanupTimers.get(key);
  if(!timer)return false;
  ephemeralCleanupTimers.delete(key);
  if(typeof timer.cancel==='function')return timer.cancel();
  clearTimeout(timer);
  return true;
}
function scheduleEphemeralCleanup(uid,delayMs){
  if(!uid||!db.users[uid]||!db.users[uid].ephemeral)return;
  cancelEphemeralCleanup(uid);
  const lease=serverClockTimer.schedule({
    owner:EPHEMERAL_CLEANUP_TIMER_OWNER_PREFIX+uid,
    delayMs:Math.max(1000,Number(delayMs)||60000),
    run:()=>{ephemeralCleanupTimers.delete(uid);cleanupEphemeralUser(uid);},
  });
  if(!lease.ok){recordOperationalError('ephemeral_cleanup_schedule',new Error(lease.reason||'clock_timer_unavailable'));return false;}
  ephemeralCleanupTimers.set(uid,lease);
  return true;
}
function cleanupEphemeralUser(uid){
  const u = uid && db.users[uid];
  if (!u || !u.ephemeral) return;
  const active = [...sessions].some(s => s.uid === uid && s.alive);
  const reserved = [...rooms.values()].some(r => [...r.clients.keys()].some(s => s.uid === uid) ||
    [...(r.spectators instanceof Map ? r.spectators.keys() : r.spectators instanceof Set ? r.spectators : [])].some(s => s.uid === uid));
  if (active || reserved) return;
  cancelEphemeralCleanup(uid);
  delete db.users[uid];
  db.history = db.history.filter(h => h.uid !== uid);
  db.rewardHistory = db.rewardHistory.filter(h => h.uid !== uid);
  db.economyLedger = db.economyLedger.filter(h => h.uid !== uid);
  db.events = db.events.filter(h => h.uid !== uid);
  for (const key of Object.keys(db.aiLearning.models || {})) if (key.startsWith(uid + '|')) delete db.aiLearning.models[key];
  db.aiLearning.experiences = (db.aiLearning.experiences || []).filter(row => row.uid !== uid);
  db.aiLearning.appliedResults = (db.aiLearning.appliedResults || []).filter(key => !String(key).startsWith(uid + '|'));
  db.pendingAILearningSync = (db.pendingAILearningSync || []).filter(item => item.uid !== uid);
  db.pendingRewardSync = (db.pendingRewardSync || []).filter(item => item.uid !== uid);
  db.friendRequests=(db.friendRequests||[]).filter(row=>row.fromUid!==uid&&row.toUid!==uid);
  db.friendships=(db.friendships||[]).filter(row=>row.aUid!==uid&&row.bUid!==uid);
  db.blocks=(db.blocks||[]).filter(row=>row.blockerUid!==uid&&row.blockedUid!==uid);
  db.reports=(db.reports||[]).filter(row=>row.reporterUid!==uid&&row.targetUid!==uid);
  db.replays=(db.replays||[]).filter(row=>!Array.isArray(row.uids)||!row.uids.includes(uid));
  pendingInvites.delete(uid);
  for(const [target,items] of pendingInvites){const next=(items||[]).filter(item=>item.fromUid!==uid&&item.toUid!==uid);if(next.length)pendingInvites.set(target,next);else pendingInvites.delete(target);}
  for(const user of Object.values(db.users)){if(user&&user.playmates&&Object.prototype.hasOwnProperty.call(user.playmates,uid))delete user.playmates[uid];}
  saveDB();
}
function resetRoomMatch(r){
  if(!r)return{ok:false,reason:'room_not_found'};
  // READY is the only fallible Adapter-backed mutation in this reset. Commit
  // it before stopping timers or clearing match state so an Adapter failure
  // leaves the canonical match wholly intact and retryable.
  const readyReset=r.host?roomPresenceBoundary.room({action:'reset_ready',room:r,session:r.host}):{ok:true};
  if(!readyReset.ok)return readyReset;
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
  r.matchExpressionSeen = new Map();
  r.matchExpressionRates = new Map();
  r.matchExpressionCounts = new Map();
  r.matchChatEvents = [];
  r.matchChatSeen = new Map();
  r.matchChatRates = new Map();
  r.matchChatCounts = new Map();
  r.tournamentBinding = null;
  r.finalResult = null;
  r.tetrisRuleAuthority = null;
  r.xiangqiRuleAuthority = null;
  r.monopolyRuleAuthority = null;
  return{ok:true};
}
function compactRoomPlayers(r){
  return compactRoomSeats(r);
}
function allRoomClientsOnline(r){
  return roomInspection(r, null).allOnline;
}
function expireDetachedSession(r, oldSession, options={}){
  if (!r || !r.clients.has(oldSession) || oldSession.alive !== false) return true;
  const player = r.clients.get(oldSession);
  const uid = oldSession.uid;
  if (r.tankAuthority && typeof r.tankAuthority.clearDisconnectedInput === 'function') {
    r.tankAuthority.clearDisconnectedInput(player);
  }
  const wasHost = r.host === oldSession;
  if (r.started && !r.settled) settleRoomForfeit(r, oldSession, 'afk');
  const membership = roomPresenceBoundary.room({action:'remove',room:r,session:oldSession,deleteWhenEmpty:true,preferOnlineHost:true,allowUnregistered:true});
  if (!membership.ok) {
    if(options.quarantineSweep===true)return false;
    // The current timer has fired already. Retry a bounded number of times;
    // a permanent Adapter failure is quarantined instead of creating an
    // unbounded timer/seat leak.
    const attempts=Number(oldSession.roomPresenceRetryAttempts)||0;
    if(attempts>=ROOM_PRESENCE_RETRY_LIMIT){
      oldSession.reconnectTimer=null;oldSession.roomPresenceQuarantined=true;r.presenceQuarantined=true;
      enqueueRoomGraphRecovery('expired:'+oldSession.sessionId,{
        room:r,
        recover:()=>expireDetachedSession(r,oldSession,{quarantineSweep:true}),
        onRecovered:()=>{oldSession.roomPresenceQuarantined=false;if(![...roomGraphRecoveryQueue.values()].some(record=>record.room===r))r.presenceQuarantined=false;},
      });
      broadcast(r,{type:'error',msg:'房间状态已进入安全恢复队列',reason:'room_presence_quarantined'});
      return false;
    }
    oldSession.roomPresenceRetryAttempts=attempts+1;
    scheduleReconnectTimer(oldSession,r,roomPresenceRetryDelay(attempts+1));
    return false;
  }
  cancelReconnectTimer(oldSession);
  oldSession.roomPresenceRetryAttempts=0;oldSession.roomPresenceQuarantined=false;
  expiredResumes.set(resumeKey(uid, oldSession.tokenHash), {
    room: r.id, player, expiresAt: Date.now() + EXPIRED_RESUME_TTL_MS,
  });
  if (membership.closed){
    stopRoomAuthorities(r);
    if(r.spectators)for(const spectator of r.spectators.keys()){spectatorAccessGuard.leave(spectator.sessionId);spectator.spectatorRoom=null;spectator.sendText(JSON.stringify({type:'peer_left',payload:{roomClosed:true}}));}
    cleanupEphemeralUser(uid); broadcastLobby(); return true;
  }
  const hostChanged = !!membership.hostChanged || wasHost;
  const reset=resetRoomMatch(r);
  if(!reset.ok)broadcast(r,{type:'error',msg:'房间状态暂不可用',reason:reset.reason||'room_presence_unavailable'});
  notifyRoomReassignments(r,membership.reassigned);
  broadcast(r, { type: 'reconnect_expired', payload: { uid, player, hostPlayer: r.clients.get(r.host), hostChanged } });
  if (hostChanged) broadcast(r, { type: 'host_changed', payload: { uid: r.host.uid, player: r.clients.get(r.host) } });
  broadcastRoom(r);
  broadcastLobby();
  cleanupEphemeralUser(uid);
  return true;
}
function detachForReconnect(session){
  if (!session.room || !session.uid || !session.tokenHash) return false;
  const r = rooms.get(session.room);
  if (!r || !r.started || !r.clients.has(session)) return false;
  forgetTankSnapshotRecipient(r,session);
  const detached = roomPresenceBoundary.room({action:'detach',room:r,session,graceMs:RECONNECT_GRACE_MS,allowUnregistered:true});
  if (!detached.ok) return false;
  // A disconnected Tank must stop receiving the last held input while the
  // reconnect grace window is open.  The authority will accept fresh input
  // only after the player has resumed with a live authenticated session.
  if (r.tankAuthority && typeof r.tankAuthority.clearDisconnectedInput === 'function') {
    r.tankAuthority.clearDisconnectedInput(session.player);
  }
  scheduleReconnectTimer(session,r,RECONNECT_GRACE_MS);
  broadcast(r, { type: 'peer_status', payload: { uid: session.uid, player: session.player, online: false, resumeUntil: session.resumeUntil } }, session);
  broadcastRoom(r);
  return true;
}
function tryResumeSession(session){
  if (!session.uid || !session.tokenHash) return false;
  clearExpiredResumes();
  const now = Date.now();
  const resumed = roomPresenceBoundary.room({action:'resume',session});
  if (resumed.ok){
      const r = rooms.get(resumed.roomId || session.room);
      if (!r) return false;
      const player = resumed.player;
      markRoomEngagementIntegrityReconnect(r,player);
      const hasAuthoritySnapshot = !!(r.tankAuthority || r.tetrisAuthority || r.tetrisRuleAuthority || r.xiangqiRuleAuthority || r.monopolyRuleAuthority);
      const replayUnavailable = !!(r.started && r.moveLogTruncated && !hasAuthoritySnapshot);
      const replayReset=replayUnavailable?resetRoomMatch(r):{ok:true};
      if(!replayReset.ok)session.sendText(JSON.stringify({type:'error',msg:'房间状态暂不可用',reason:replayReset.reason||'room_presence_unavailable'}));
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
  const result = authProfileBoundary.session({ action:'hash_token', token });
  return result.ok ? result.tokenHash : '';
}
function normalizeAuthTokenRecords(values){
  const result = authProfileBoundary.session({ action:'normalize', records:values });
  return result.ok && Array.isArray(result.records) ? result.records : [];
}
function issueAuthToken(u){
  const result = authProfileBoundary.session({ action:'issue', user:u });
  if (!result.ok) throw new Error(result.reason || 'auth_unavailable');
  return { token:result.token, tokenHash:result.tokenHash };
}
function userHasToken(u, token){
  if (!u || !token) return false;
  return !!authProfileBoundary.session({ action:'verify_token', user:u, token }).ok;
}
function userHasTokenHash(u, tokenHash){
  if (!u || !tokenHash) return false;
  return !!authProfileBoundary.session({ action:'verify_hash', user:u, tokenHash }).ok;
}
function userForToken(token){
  if (!token) return null;
  const result = authProfileBoundary.session({ action:'resolve_token', token });
  return result.ok ? result.user : null;
}
function credentialUserByKey(usernameKey){
  return Object.values(db.users).find(user => !user.ephemeral && user.usernameKey === usernameKey) || null;
}
const credentialRegistrationLocks=new Set();
async function credentialUser(usernameKey){
  const local=credentialUserByKey(usernameKey);
  if(local||!useSupabase)return local;
  const rows=await sbFetch('profiles?select=*&username_key=eq.'+encodeURIComponent(usernameKey)+'&limit=1');
  const remote=Array.isArray(rows)&&rows[0]?profileRowToUser(rows[0]):null;
  if(remote){db.users[remote.uid]=remote;saveDB();}
  return remote;
}
function starterUser(uid,name,lang){
  return {
    uid,name:String(name||'玩家').slice(0,12),avatar:100,ephemeral:false,background:0,frame:0,effect:0,
    achievements:[],playmates:{},daily:{play:0,win:0,streak:0},nameFx:0,owned:normalizeOwned({backgrounds:[0]}),gameCosmetics:normalizeGameCosmetics({}),playerCharacter:normalizePlayerCharacter(),
    xp:0,level:1,streak:0,bestStreak:0,coins:0,played:{},total:0,wins:{},totalWins:0,recentResults:[],purchaseRequests:[],soloRate:[],pin_hash:null,
    dailyFirstWinDate:'',dailyAICurrencyKey:'',dailyAICurrencyEarned:0,xpCurveVersion:REWARD_CONFIG.level.curveVersion,
    signature:'',countryRegion:'',genderTag:'hidden',presencePreference:'joinable',presenceVisibility:'everyone',showcase:null,
    lang:['zh-CN','en-US','uk-UA'].includes(lang)?lang:'zh-CN',created_at:Date.now(),authTokens:[],
  };
}
async function handleCredentialMessage(session,type,payload){
  payload=payload&&typeof payload==='object'?payload:{};
  if(type==='username_check'){
    const checked=validateUsername(payload.username),requestId=String(payload.requestId||'').slice(0,64);
    if(!consumeAIRate('username-check:'+session.ip,30,500)){session.sendText(JSON.stringify({type:'username_status',payload:{requestId,username:'',normalized:'',available:false,reason:'rate_limited'}}));return;}
    let available=false,reason=checked.reason||'username_invalid';
    if(checked.valid){available=!(await credentialUser(checked.normalized));reason=available?'available':'username_taken';}
    session.sendText(JSON.stringify({type:'username_status',payload:{requestId,username:checked.valid?String(payload.username):'',normalized:checked.valid?checked.normalized:'',available,reason}}));return;
  }
  if(type==='guest_login'){
    if(session.uid){session.authError('请先退出当前账号', {reason:'login_requires_logout'});return;}
    if(!allowRegistration('guest:'+session.ip)){session.authError('访客创建过于频繁，请稍后再试',{reason:'guest_unavailable',retryAfter:3600});return;}
    const uid='u_guest_'+crypto.randomBytes(8).toString('hex'),suffix=crypto.randomBytes(2).toString('hex').toUpperCase();
    const user=starterUser(uid,'Guest '+suffix,payload.lang);user.ephemeral=true;user.authVersion='guest-v1';user.guestExpiresAt=Date.now()+60*60000;
    const auth=issueAuthToken(user);db.users[uid]=user;session.uid=uid;session.tokenHash=auth.tokenHash;
    session.sendText(JSON.stringify({type:'guest_logged_in',token:auth.token,payload:{uid,token:auth.token,expiresAt:user.guestExpiresAt,profile:profileObj(user)}}));broadcastLobby();return;
  }
  if(!allowAuthHash()){session.authError('登录服务繁忙，请稍后再试',{reason:'auth_service_busy',retryAfter:30});return;}
  if(session.uid){session.authError('请先退出当前账号再切换身份',{reason:type==='register'?'registration_requires_logout':'login_requires_logout'});return;}
  const usernameCheck=validateUsername(payload.username),passwordCheck=validatePassword(payload.password);
  if(!usernameCheck.valid){session.authError('用户名格式不正确',{reason:'username_invalid'});return;}
  if(!passwordCheck.valid){session.authError('密码格式不正确',{reason:'password_invalid'});return;}
  const authKey='credential:'+usernameCheck.normalized;
  if(type==='register'){
    if(!allowRegistration(session.ip)){session.authError('该网络注册过于频繁，请稍后再试',{reason:'registration_rate_limited',retryAfter:3600});return;}
    if(credentialRegistrationLocks.has(usernameCheck.normalized)){session.authError('用户名已存在',{reason:'username_taken'});return;}
    credentialRegistrationLocks.add(usernameCheck.normalized);
    try{
      if(await credentialUser(usernameCheck.normalized)){session.authError('用户名已存在',{reason:'username_taken'});return;}
      const uid=genUid(),user=starterUser(uid,String(payload.username),payload.lang);user.username=String(payload.username);user.usernameKey=usernameCheck.normalized;user.passwordHash=await hashPassword(payload.password);user.authVersion='username-password-v1';
      if(credentialUserByKey(usernameCheck.normalized)){session.authError('用户名已存在',{reason:'username_taken'});return;}
      const auth=issueAuthToken(user);db.users[uid]=user;
      const remoteOk=await sbCreateProfile(user);
      if(!remoteOk){delete db.users[uid];session.authError('注册服务暂不可用',{reason:'auth_service_busy',retryAfter:30});return;}
      saveDB();session.uid=uid;session.tokenHash=auth.tokenHash;session.sendText(JSON.stringify({type:'registered',token:auth.token,authVersion:'username-password-v1',payload:{uid,token:auth.token,profile:profileObj(user)}}));broadcastLeaderboard();broadcastLobby();return;
    }finally{credentialRegistrationLocks.delete(usernameCheck.normalized);}
  }
  if(type==='login'){
    const retry=Math.max(authRetryAfter(session.ip),authRetryAfter(authKey));if(retry){session.authError('尝试次数过多，请稍后再试',{reason:'login_rate_limited',retryAfter:retry});return;}
    const user=await credentialUser(usernameCheck.normalized);
    const valid=await verifyPassword(payload.password,user&&user.passwordHash);
    if(!user){noteAuthFailure(session.ip);noteAuthFailure(authKey);session.authError('无对应用户',{reason:'user_not_found'});return;}
    if(!valid){noteAuthFailure(session.ip);noteAuthFailure(authKey);session.authError('用户名或密码错误',{reason:'invalid_credentials'});return;}
    clearAuthFailures(session.ip);clearAuthFailures(authKey);const auth=issueAuthToken(user);session.uid=user.uid;session.tokenHash=auth.tokenHash;saveDB();await sbSyncAuthProfile(user);session.sendText(JSON.stringify({type:'logged_in',token:auth.token,authVersion:'username-password-v1',payload:{uid:user.uid,token:auth.token,profile:profileObj(user)}}));broadcastLeaderboard();broadcastLobby();return;
  }
  if(type==='legacy_bind'){
    const pin=String(payload.pin||'').trim();if(!validPin(pin)){session.authError('旧 PIN 格式不正确',{reason:'legacy_pin_invalid'});return;}
    if(await credentialUser(usernameCheck.normalized)){session.authError('用户名已存在',{reason:'username_taken'});return;}
    const ph=hashPin(pin),oldPh=legacyPinHash(pin),user=Object.values(db.users).find(item=>pinMatches(item,pin,ph,oldPh));
    if(!user){noteAuthFailure(session.ip);session.authError('旧 PIN 不存在',{reason:'legacy_pin_invalid'});return;}
    user.username=String(payload.username);user.usernameKey=usernameCheck.normalized;user.passwordHash=await hashPassword(payload.password);user.authVersion='username-password-v1';const auth=issueAuthToken(user);session.uid=user.uid;session.tokenHash=auth.tokenHash;saveDB();await sbSyncAuthProfile(user);session.sendText(JSON.stringify({type:'logged_in',token:auth.token,authVersion:'username-password-v1',payload:{uid:user.uid,token:auth.token,profile:profileObj(user)}}));broadcastLeaderboard();broadcastLobby();
  }
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
  game_cosmetics: { 2001:8,2011:10,2012:10,2013:10,2021:12,2031:14,2041:12,2042:12,2051:12 },
};
const GAME_COSMETIC_CATALOG = Object.freeze([
  { id:2001, game:'gomoku', slot:'pieceSkin', value:'glow' },
  { id:2011, game:'ludo', slot:'baseSkin', value:'cyber' },
  { id:2012, game:'ludo', slot:'pieceSkin', value:'jet' },
  { id:2013, game:'ludo', slot:'diceSkin', value:'cyber' },
  { id:2021, game:'monopoly', slot:'tokenSkin', value:'car' },
  { id:2031, game:'tank', slot:'tankSkin', value:'cyber' },
  { id:2041, game:'tetris', slot:'blockSkin', value:'neon' },
  { id:2042, game:'tetris', slot:'backgroundSkin', value:'grid' },
  { id:2051, game:'xiangqi', slot:'pieceSkin', value:'jade' },
].map(item => Object.freeze(item)));
const GAME_COSMETIC_BY_ID = new Map(GAME_COSMETIC_CATALOG.map(item => [item.id, item]));
function validOwnedId(kind, id){
  if (!Number.isInteger(id)) return false;
  if (kind === 'avatars' && id >= 0 && id < 30) return true;
  if (kind === 'avatars' && id >= 100 && id <= 147 && (id - 100) % 8 < 2) return true;
  if (kind === 'backgrounds' && id >= 0 && id <= 6) return true;
  if (kind === 'game_cosmetics' && GAME_COSMETIC_BY_ID.has(id)) return true;
  if (id === 0 && kind !== 'avatars') return true;
  return !!(SHOP_PRICES[kind] && Object.prototype.hasOwnProperty.call(SHOP_PRICES[kind], id));
}
function ownsItem(u, kind, id){
  if (u && testAdmin.hasCapability(u.uid, 'test_admin_all_catalog_items') && validOwnedId(kind, id)) return true;
  if (kind === 'avatars' && id >= 0 && id < 30) return true;
  if (kind === 'avatars' && id >= 100 && id <= 147 && (id - 100) % 8 < 2) return true;
  if (kind === 'backgrounds' && id >= 0 && id <= 6) return true;
  if (kind === 'game_cosmetics' && GAME_COSMETIC_BY_ID.has(id)) return !!(u && u.owned && Array.isArray(u.owned[kind]) && u.owned[kind].includes(id));
  if (id === 0 && kind !== 'avatars') return true;
  return !!(u && u.owned && Array.isArray(u.owned[kind]) && u.owned[kind].includes(id));
}
function profileObj(u, viewerUid){
  const result = authProfileBoundary.profile({ action:'private', user:u, viewerUid });
  return result.ok ? result.profile : null;
}
function publicProfileObj(u, viewerUid){
  const result = authProfileBoundary.profile({ action:'public', user:u, viewerUid });
  return result.ok ? result.profile : null;
}
function profileCompareProjection(u){
  const result = authProfileBoundary.profile({ action:'compare_projection', user:u });
  return result.ok ? result.profile : null;
}
function profileCompareAllowed(viewer,target){
  return !!authProfileBoundary.profile({ action:'can_compare', viewer, target }).allowed;
}

/* ---------------- Social Graph v1（好友 / 屏蔽 / 举报） ---------------- */
const SOCIAL_REQUEST_MAX_PER_DAY = 100;
const SOCIAL_REPORT_MAX_PER_DAY = 30;
const SOCIAL_REASONS = new Set(['harassment', 'inappropriate_name', 'cheating', 'spam', 'other']);
const SOCIAL_CONTEXT_TYPES = new Set(['profile','room','match','social','tournament','playline']);
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
  if (!target || target.ephemeral || testAdmin.shouldHidePublicUid(targetUid) || testAdmin.shouldHidePublicUid(viewerUid)) return null;
  const profile = publicProfileObj(target, viewerUid);
  return { ...profile, relationship: socialRelationship(viewerUid, targetUid), blocked: socialBlockedBetween(viewerUid, targetUid) };
}
function socialState(uid){
  if (testAdmin.shouldHidePublicUid(uid)) return { version:'1.0', friends:[], incoming:[], outgoing:[], blocked:[], counts:{ friends:0, incoming:0, outgoing:0, blocked:0 } };
  const friends = (db.friendships || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.aUid) && !testAdmin.shouldHidePublicUid(row.bUid) && (row.aUid === uid || row.bUid === uid))
    .map(row => socialPublicEntry(uid, row.aUid === uid ? row.bUid : row.aUid)).filter(Boolean);
  const incoming = (db.friendRequests || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.fromUid) && !testAdmin.shouldHidePublicUid(row.toUid) && row.status === 'pending' && row.toUid === uid)
    .map(row => ({ id: row.id, createdAt: row.createdAt, user: socialPublicEntry(uid, row.fromUid) })).filter(row => row.user);
  const outgoing = (db.friendRequests || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.fromUid) && !testAdmin.shouldHidePublicUid(row.toUid) && row.status === 'pending' && row.fromUid === uid)
    .map(row => ({ id: row.id, createdAt: row.createdAt, user: socialPublicEntry(uid, row.toUid) })).filter(row => row.user);
  const blocked = (db.blocks || []).filter(row => row && !testAdmin.shouldHidePublicUid(row.blockerUid) && !testAdmin.shouldHidePublicUid(row.blockedUid) && row.blockerUid === uid)
    .map(row => ({ uid: row.blockedUid, name: row.targetSnapshot && row.targetSnapshot.name || (db.users[row.blockedUid] && db.users[row.blockedUid].name) || '玩家', createdAt: row.createdAt }));
  return { version:'1.0', friends, incoming, outgoing, blocked,
    counts:{ friends:friends.length, incoming:incoming.length, outgoing:outgoing.length, blocked:blocked.length } };
}
function socialSessions(uid, fn){
  const user = db.users[uid];
  for (const session of sessions){
    if (session.uid !== uid || !session.alive) continue;
    if (!user || !userHasTokenHash(user, session.tokenHash)) { session.close(); continue; }
    fn(session);
  }
}
function sendSocialState(uid){
  const payload = socialState(uid);
  socialSessions(uid, session => session.sendText(JSON.stringify({ type:'social_state', payload })));
}
function socialOk(session, msg, extra){
  session.sendText(JSON.stringify({ type:'social_ok', msg:msg || '操作成功', ...(extra || {}) }));
  if (session.uid) sendSocialState(session.uid);
}
function socialError(session, msg, reason){
  session.sendText(JSON.stringify({ type:'social_error', msg:msg || '社交操作失败', payload:{ reason:reason || 'invalid_request' } }));
}
function socialTarget(fromUid, targetUid){
  const target = String(targetUid || '').trim();
  if (!target || target === fromUid || testAdmin.shouldHidePublicUid(fromUid) || testAdmin.shouldHidePublicUid(target) || !db.users[target] || db.users[target].ephemeral) return null;
  return db.users[target];
}
function sendPlaylineInvalidated(uids,reason){
  if(!PLAYLINE_ENABLED)return;
  [...new Set((Array.isArray(uids)?uids:[uids]).map(String).filter(Boolean))].forEach(uid=>socialSessions(uid,session=>{if(session.capabilities instanceof Set&&session.capabilities.has(PLAYLINE_PROTOCOL))session.sendText(JSON.stringify({type:'playline_invalidated',payload:{reason:String(reason||'relationship_changed')}}));}));
}
function socialDailyCount(rows, uid, field){
  const cutoff = Date.now() - 86400000;
  return rows.filter(row => row && row[field] === uid && Number(row.createdAt || 0) >= cutoff).length;
}
function syncSocialRows(kind, rows){
  if (!useSupabase || !Array.isArray(rows) || !rows.length) return;
  const table = { friendRequests:'friend_requests', friendships:'friendships', blocks:'blocks', reports:'reports' }[kind];
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
    .catch(error => {recordOperationalError('supabase_social_sync',error);console.error('Supabase 社交关系同步失败:', error.message);});
}
function deleteSocialRemote(table, id){
  if (!useSupabase || !table || !id) return;
  sbFetch(table + '?id=eq.' + encodeURIComponent(id), { method:'DELETE' }).catch(error => {recordOperationalError('supabase_social_delete',error);console.error('Supabase 社交关系删除失败:', error.message);});
}
function socialSendRequest(session, targetUid){
  if (!testAdmin.socialAccess(session.uid, targetUid).ok) return socialError(session, '测试管理员与正式社交关系隔离', 'test_admin_isolated');
  const target = socialTarget(session.uid, targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  if (socialBlockedBetween(session.uid, target.uid)) return socialError(session, '该玩家已被屏蔽，不能建立关系', 'blocked');
  if (socialFriendship(session.uid, target.uid)) return socialOk(session, '你们已经是好友', { action:'already_friends' });
  if (socialDailyCount(db.friendRequests || [], session.uid, 'fromUid') >= SOCIAL_REQUEST_MAX_PER_DAY) return socialError(session, '今日好友请求已达上限', 'rate_limited');
  const existing = socialPendingRequest(session.uid, target.uid);
  if (existing) return socialOk(session, '好友请求已发送', { action:'idempotent', requestId:existing.id });
  if (socialPendingRequest(target.uid, session.uid)) return socialError(session, '对方已向你发送好友请求，请在请求列表中接受', 'incoming_exists');
  const row = { id:socialId('fr'), fromUid:session.uid, toUid:target.uid, status:'pending', createdAt:Date.now(), updatedAt:Date.now() };
  db.friendRequests.push(row); syncSocialRows('friendRequests', [row]); saveDB();
  socialOk(session, '好友请求已发送', { action:'sent', requestId:row.id }); sendSocialState(target.uid);
}
function socialFriendRequestAction(session, payload){
  const action = String(payload && payload.action || '');
  const requestId = String(payload && payload.requestId || '');
  const row = db.friendRequests.find(item => item && item.id === requestId && item.status === 'pending');
  if (!row) return socialError(session, '好友请求不存在或已处理', 'request_not_found');
  if (!testAdmin.socialAccess(row.fromUid, row.toUid).ok) return socialError(session, '测试管理员与正式社交关系隔离', 'test_admin_isolated');
  const isIncoming = row.toUid === session.uid;
  const isOutgoing = row.fromUid === session.uid;
  if (action === 'accept' && isIncoming){
    if (socialBlockedBetween(row.fromUid, row.toUid)) return socialError(session, '该请求已被屏蔽', 'blocked');
    row.status = 'accepted'; row.updatedAt = Date.now();
    const pair = socialPair(row.fromUid, row.toUid);
    if (!socialFriendship(row.fromUid, row.toUid)) db.friendships.push({ id:pair.id, ...pair, createdAt:Date.now() });
    saveDB(); syncSocialRows('friendRequests', [row]); syncSocialRows('friendships', db.friendships.filter(item => item.id === pair.id));
    socialOk(session, '已添加好友', { action:'accepted' }); sendSocialState(row.fromUid); sendChatState(row.fromUid); sendChatState(row.toUid); sendPlaylineInvalidated([row.fromUid,row.toUid],'friendship_changed'); return;
  }
  if (action === 'decline' && isIncoming){ row.status='declined'; row.updatedAt=Date.now(); saveDB(); syncSocialRows('friendRequests',[row]); socialOk(session,'已忽略好友请求',{action:'declined'}); sendSocialState(row.fromUid); return; }
  if (action === 'cancel' && isOutgoing){ row.status='cancelled'; row.updatedAt=Date.now(); saveDB(); syncSocialRows('friendRequests',[row]); socialOk(session,'已取消好友请求',{action:'cancelled'}); sendSocialState(row.toUid); return; }
  socialError(session, '无权处理该好友请求', 'forbidden');
}
function socialRemoveFriend(session, targetUid){
  if (!testAdmin.socialAccess(session.uid, targetUid).ok) return socialError(session, '测试管理员与正式社交关系隔离', 'test_admin_isolated');
  const target = socialTarget(session.uid, targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  const pair = socialPair(session.uid, target.uid);
  const before = db.friendships.length;
  db.friendships = db.friendships.filter(row => row.id !== pair.id);
  if (db.friendships.length === before) return socialError(session, '你们还不是好友', 'not_friends');
  saveDB(); deleteSocialRemote('friendships', pair.id); socialOk(session, '已移除好友', { action:'removed' }); sendSocialState(target.uid); sendChatState(session.uid); sendChatState(target.uid); sendPlaylineInvalidated([session.uid,target.uid],'friendship_changed');
}
function socialBlock(session, targetUid){
  if (!testAdmin.socialAccess(session.uid, targetUid).ok) return socialError(session, '测试管理员与正式社交关系隔离', 'test_admin_isolated');
  const target = socialTarget(session.uid, targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  if (db.blocks.some(row => row.blockerUid === session.uid && row.blockedUid === target.uid)) return socialOk(session, '该玩家已被屏蔽', { action:'idempotent' });
  const pair = socialPair(session.uid, target.uid);
  db.friendships = db.friendships.filter(row => row.id !== pair.id);
  const removedRequests = db.friendRequests.filter(row => (row.fromUid === session.uid && row.toUid === target.uid) || (row.fromUid === target.uid && row.toUid === session.uid));
  db.friendRequests = db.friendRequests.filter(row => !removedRequests.includes(row));
  const row = { id:socialId('blk'), blockerUid:session.uid, blockedUid:target.uid, targetSnapshot:{ uid:target.uid, name:target.name, avatar:target.avatar }, createdAt:Date.now() };
  db.blocks.push(row); syncSocialRows('blocks',[row]); deleteSocialRemote('friendships',pair.id); removedRequests.forEach(request => deleteSocialRemote('friend_requests',request.id)); saveDB();
  socialOk(session, '已屏蔽该玩家', { action:'blocked' }); sendSocialState(target.uid); sendChatState(session.uid); sendChatState(target.uid); sendPlaylineInvalidated([session.uid,target.uid],'block_changed');
}
function socialUnblock(session, targetUid){
  const target = String(targetUid || '').trim();
  if (!testAdmin.socialAccess(session.uid, target).ok) return socialError(session, '测试管理员与正式社交关系隔离', 'test_admin_isolated');
  const removed = db.blocks.filter(row => row.blockerUid === session.uid && row.blockedUid === target);
  db.blocks = db.blocks.filter(row => !(row.blockerUid === session.uid && row.blockedUid === target));
  if (!removed.length) return socialError(session, '该玩家不在屏蔽列表', 'not_blocked');
  saveDB(); removed.forEach(row => deleteSocialRemote('blocks',row.id)); socialOk(session, '已取消屏蔽', { action:'unblocked' }); sendChatState(session.uid); sendChatState(target); sendPlaylineInvalidated([session.uid,target],'block_changed');
}
function socialReport(session, payload){
  if (!testAdmin.socialAccess(session.uid, payload && payload.targetUid).ok) return socialError(session, '测试管理员与正式社交关系隔离', 'test_admin_isolated');
  const target = socialTarget(session.uid, payload && payload.targetUid);
  if (!target) return socialError(session, '目标玩家不存在', 'target_not_found');
  const reason = String(payload && payload.reason || '');
  if (!SOCIAL_REASONS.has(reason)) return socialError(session, '举报原因无效', 'invalid_reason');
  if (socialDailyCount(db.reports || [], session.uid, 'reporterUid') >= SOCIAL_REPORT_MAX_PER_DAY) return socialError(session, '今日举报次数已达上限', 'rate_limited');
  const requestedContextType=sanitizePlainText(payload&&payload.contextType,24)||'profile';
  const contextType=SOCIAL_CONTEXT_TYPES.has(requestedContextType)?requestedContextType:'profile';
  const contextId = sanitizePlainText(payload && payload.contextId, 80);
  const recentEventIds = Array.isArray(payload && payload.recentEventIds) ? payload.recentEventIds.map(v => sanitizePlainText(v,80)).filter(Boolean).slice(0,20) : [];
  const duplicate = db.reports.find(row => row && row.reporterUid === session.uid && row.targetUid === target.uid && row.reason === reason && row.contextId === contextId && Date.now() - Number(row.createdAt || 0) < 600000);
  if (duplicate) return socialOk(session, '举报已记录', { action:'idempotent', reportId:duplicate.id });
  const row = { id:socialId('rpt'), reporterUid:session.uid, targetUid:target.uid, reason, contextType, contextId, matchId:sanitizePlainText(payload && payload.matchId,80), recentEventIds, targetSnapshot:{ uid:target.uid, name:target.name, avatar:target.avatar, signature:sanitizePlainText(target.signature,80) }, status:'open', createdAt:Date.now() };
  db.reports.push(row); syncSocialRows('reports',[row]); saveDB();
  recordAnalytics('social_report_created', { uid:session.uid, metadata:{ reportId:row.id, targetUid:target.uid, reason, contextType } });
  socialOk(session, '举报已记录，我们会核查相关信息', { action:'reported', reportId:row.id });
}
async function socialReportPlayline(session,payload){
  const actor=playlineActorForSession(session),postId=String(payload&&payload.contextId||'');
  const resolved=await chatPlaylineBoundary.playline({action:'report',actor,postId});
  if(!resolved.ok)return socialError(session,'动态不可见或已失效','post_unavailable');
  socialReport(session,{targetUid:resolved.targetUid,reason:payload&&payload.reason,contextType:'playline',contextId:postId,recentEventIds:[]});
}
function socialAllowedBetween(aUid, bUid){ return !!aUid && !!bUid && aUid !== bUid && testAdmin.socialAccess(aUid, bUid).ok && !socialBlockedBetween(aUid, bUid); }

/* ---------------- Playline wire adapter (playline-v1) ---------------- */
function playlineError(session, action, result, clientPostId){
  const reason=String(result&&result.reason||'server_unavailable');
  const payload={action:String(action||''),reason};
  if(clientPostId)payload.clientPostId=String(clientPostId);
  if(result&&result.retryAfter)payload.retryAfter=Number(result.retryAfter);
  session.sendText(JSON.stringify({type:'playline_error',payload}));
}
function playlineStatePayload(result, filter){
  return {filter:String(filter||result&&result.filter||'all'),posts:Array.isArray(result&&result.posts)?result.posts:[],hasMore:!!(result&&result.hasMore),nextCursor:result&&result.nextCursor||null};
}
async function handlePlaylineList(session,payload){
  const actor=playlineActorForSession(session),filter=payload&&payload.filter!==undefined?payload.filter:payload&&payload.scope;
  const result=await chatPlaylineBoundary.playline({action:'list',actor,filter:filter===undefined?'all':filter,cursor:payload&&payload.cursor,limit:payload&&payload.limit});
  if(!result.ok)return playlineError(session,'playline_list',result);
  session.sendText(JSON.stringify({type:'playline_state',payload:playlineStatePayload(result,filter)}));
}
async function handlePlaylinePublish(session,payload){
  const actor=playlineActorForSession(session),intent={clientPostId:payload&&payload.clientPostId,audience:payload&&payload.audience,content:payload&&payload.content};
  const result=await chatPlaylineBoundary.playline({action:'publish',actor,...intent});
  if(!result.ok)return playlineError(session,'playline_publish',result,payload&&payload.clientPostId);
  session.sendText(JSON.stringify({type:'playline_publish_ok',payload:{clientPostId:result.clientPostId,post:result.post,duplicate:!!result.duplicate,replayed:!!result.replayed}}));
}
async function handlePlaylineRemove(session,payload){
  const actor=playlineActorForSession(session),result=await chatPlaylineBoundary.playline({action:'remove',actor,postId:payload&&payload.postId,requestId:payload&&payload.requestId});
  if(!result.ok)return playlineError(session,'playline_remove',result);
  session.sendText(JSON.stringify({type:'playline_remove_ok',payload:{postId:result.postId,deleted:true,replayed:!!result.replayed}}));
}

/* ---------------- Direct Chat v1（正式好友一对一纯文本私聊） ---------------- */
const CHAT_MAX_MESSAGES = 50000;
const CHAT_MAX_PER_CONVERSATION = 500;
const CHAT_MAX_AGE_MS = 90 * 86400000;
const CHAT_CLIENT_ID_RE = /^[A-Za-z0-9._:-]{12,80}$/;
const chatRateBuckets = new Map();
function chatSeq(value){
  const raw=String(value===undefined||value===null?'0':value);
  if(!/^\d{1,30}$/.test(raw))return'0';
  try{return BigInt(raw).toString();}catch{return'0';}
}
function chatSeqCompare(a,b){
  const aa=BigInt(chatSeq(a)),bb=BigInt(chatSeq(b));
  return aa<bb?-1:aa>bb?1:0;
}
function nextChatSeq(){
  db.nextChatSeq=(BigInt(chatSeq(db.nextChatSeq))+1n).toString();
  return db.nextChatSeq;
}
function chatConversation(aUid,bUid){
  const pair=socialPair(aUid,bUid);
  return {id:'dm:'+pair.id,aUid:pair.aUid,bUid:pair.bUid};
}
function chatPeerUid(conversationId,uid){
  const prefix='dm:';
  if(!String(conversationId||'').startsWith(prefix))return'';
  const pair=String(conversationId).slice(prefix.length).split('|');
  if(pair.length!==2)return'';
  if(pair[0]===uid)return pair[1];
  if(pair[1]===uid)return pair[0];
  return'';
}
function normalizeChatText(input){
  let text=String(input===undefined||input===null?'':input).normalize('NFC').replace(/\r\n?/g,'\n');
  text=text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g,'').trim();
  return text;
}
function validChatText(text){
  const count=[...text].length;
  if(!count)return{ok:false,reason:'empty_message'};
  if(count>500||Buffer.byteLength(text,'utf8')>2000)return{ok:false,reason:'message_too_long'};
  return{ok:true};
}
function normalizeChatMessage(row){
  if(!row||typeof row!=='object')return null;
  const senderUid=String(row.senderUid||''),recipientUid=String(row.recipientUid||'');
  if(!senderUid||!recipientUid||senderUid===recipientUid)return null;
  const conversation=chatConversation(senderUid,recipientUid);
  const seq=chatSeq(row.seq);
  const id=String(row.id||'');
  const clientMessageId=String(row.clientMessageId||'');
  const text=normalizeChatText(row.text);
  const valid=validChatText(text);
  if(!id||seq==='0'||!CHAT_CLIENT_ID_RE.test(clientMessageId)||!valid.ok)return null;
  const createdAt=Number(row.createdAt)||Date.now();
  return{id,conversationId:conversation.id,seq,senderUid,recipientUid,clientMessageId,text,createdAt};
}
function normalizeChatRead(row,key){
  if(!row||typeof row!=='object')return null;
  const conversationId=String(row.conversationId||'');
  const uid=String(row.uid||''),peerUid=String(row.peerUid||'');
  if(!uid||!peerUid||uid===peerUid||chatConversation(uid,peerUid).id!==conversationId)return null;
  return{conversationId,uid,peerUid,lastReadSeq:chatSeq(row.lastReadSeq),updatedAt:Number(row.updatedAt)||0,key:key||conversationId+'|'+uid};
}
function trimChatData(){
  const cutoff=Date.now()-CHAT_MAX_AGE_MS,byConversation=new Map(),seenIds=new Set(),seenClient=new Set();
  for(const raw of Array.isArray(db.chatMessages)?db.chatMessages:[]){
    const row=normalizeChatMessage(raw);
    if(!row||row.createdAt<cutoff||seenIds.has(row.id))continue;
    const clientKey=row.senderUid+'|'+row.clientMessageId;
    if(seenClient.has(clientKey))continue;
    seenIds.add(row.id);seenClient.add(clientKey);
    if(!byConversation.has(row.conversationId))byConversation.set(row.conversationId,[]);
    byConversation.get(row.conversationId).push(row);
  }
  const retained=[];
  for(const rows of byConversation.values()){
    rows.sort((a,b)=>chatSeqCompare(a.seq,b.seq));
    retained.push(...rows.slice(-CHAT_MAX_PER_CONVERSATION));
  }
  retained.sort((a,b)=>chatSeqCompare(a.seq,b.seq));
  db.chatMessages=retained.slice(-CHAT_MAX_MESSAGES);
  const reads={};
  for(const [key,value] of Object.entries(db.chatReads&&typeof db.chatReads==='object'?db.chatReads:{})){
    const row=normalizeChatRead(value,key);if(row)reads[row.conversationId+'|'+row.uid]=row;
  }
  db.chatReads=reads;
  const max=db.chatMessages.reduce((value,row)=>chatSeqCompare(row.seq,value)>0?row.seq:value,chatSeq(db.nextChatSeq));
  db.nextChatSeq=max;
}
function normalizeChatStore(){ trimChatData(); }
function chatReadKey(conversationId,uid){return conversationId+'|'+uid;}
function chatReadState(conversationId,uid,peerUid){
  return db.chatReads[chatReadKey(conversationId,uid)]||{conversationId,uid,peerUid,lastReadSeq:'0',updatedAt:0};
}
function chatMessagesFor(conversationId){
  return db.chatMessages.filter(row=>row.conversationId===conversationId).sort((a,b)=>chatSeqCompare(a.seq,b.seq));
}
function chatHasHistory(aUid,bUid){
  const id=chatConversation(aUid,bUid).id;
  return db.chatMessages.some(row=>row.conversationId===id);
}
function chatCanRead(aUid,bUid){
  return !socialBlockedBetween(aUid,bUid)&&(!!socialFriendship(aUid,bUid)||chatHasHistory(aUid,bUid));
}
function chatPublicPeer(viewerUid,peerUid){
  const profile=socialPublicEntry(viewerUid,peerUid);
  return profile?{uid:profile.uid,name:profile.name,avatar:profile.avatar,frame:profile.frame,effect:profile.effect,background:profile.background,nameFx:profile.nameFx,lang:profile.lang,presence:profile.presence,relationship:profile.relationship}:null;
}
function chatUnreadCount(uid,peerUid){
  const conversation=chatConversation(uid,peerUid),read=chatReadState(conversation.id,uid,peerUid).lastReadSeq;
  return db.chatMessages.filter(row=>row.conversationId===conversation.id&&row.recipientUid===uid&&chatSeqCompare(row.seq,read)>0).length;
}
function chatConversationSummary(uid,peerUid){
  if(testAdmin.shouldHidePublicUid(uid)||testAdmin.shouldHidePublicUid(peerUid)||!db.users[peerUid]||db.users[peerUid].ephemeral||socialBlockedBetween(uid,peerUid))return null;
  const conversation=chatConversation(uid,peerUid),messages=chatMessagesFor(conversation.id),last=messages[messages.length-1]||null;
  const read=chatReadState(conversation.id,uid,peerUid),peerRead=chatReadState(conversation.id,peerUid,uid);
  return{conversationId:conversation.id,peer:chatPublicPeer(uid,peerUid),lastMessage:last?chatMessagePayload(last):null,
    unreadCount:chatUnreadCount(uid,peerUid),readThroughSeq:read.lastReadSeq,peerReadThroughSeq:peerRead.lastReadSeq};
}
function chatState(uid,limit){
  if(testAdmin.shouldHidePublicUid(uid)) return {version:'1.0',conversations:[],unreadTotal:0};
  const peerIds=new Set();
  for(const row of db.friendships||[]){if(testAdmin.shouldHidePublicUid(row.aUid)||testAdmin.shouldHidePublicUid(row.bUid))continue;if(row.aUid===uid)peerIds.add(row.bUid);else if(row.bUid===uid)peerIds.add(row.aUid);}
  for(const row of db.chatMessages||[]){if(testAdmin.shouldHidePublicUid(row.senderUid)||testAdmin.shouldHidePublicUid(row.recipientUid))continue;if(row.senderUid===uid)peerIds.add(row.recipientUid);else if(row.recipientUid===uid)peerIds.add(row.senderUid);}
  const conversations=[...peerIds].map(peerUid=>chatConversationSummary(uid,peerUid)).filter(item=>item&&item.peer)
    .sort((a,b)=>Number(b.lastMessage&&b.lastMessage.createdAt||0)-Number(a.lastMessage&&a.lastMessage.createdAt||0)||String(a.peer.name||'').localeCompare(String(b.peer.name||'')))
    .slice(0,Math.max(1,Math.min(100,Number(limit)||50)));
  return{version:'1.0',conversations,unreadTotal:conversations.reduce((sum,item)=>sum+item.unreadCount,0)};
}
function chatMessagePayload(row){
  return{id:row.id,seq:chatSeq(row.seq),senderUid:row.senderUid,recipientUid:row.recipientUid,text:row.text,createdAt:row.createdAt};
}
function chatError(session,action,reason,clientMessageId,retryAfter){
  session.sendText(JSON.stringify({type:'chat_error',payload:{action:String(action||''),reason:String(reason||'server_unavailable'),
    ...(clientMessageId?{clientMessageId:String(clientMessageId)}:{}),...(retryAfter?{retryAfter:Number(retryAfter)}:{})}}));
}
function chatUser(session,action,clientMessageId){
  const user=session.uid&&db.users[session.uid];
  if(!user||!userHasTokenHash(user,session.tokenHash)){chatError(session,action,'not_authenticated',clientMessageId);return null;}
  if(user.ephemeral){chatError(session,action,'guest_forbidden',clientMessageId);return null;}
  if(testAdmin.shouldHidePublicUid(user.uid)){chatError(session,action,'test_admin_isolated',clientMessageId);return null;}
  return user;
}
function chatValidSessions(uid,fn){socialSessions(uid,fn);}
function sendChatState(uid){
  if(!useSupabase&&chatPlaylineBoundary){
    chatValidSessions(uid,session=>{
      Promise.resolve(chatPlaylineBoundary.chat({action:'state',actor:chatBoundaryActorForSession(session)})).then(result=>{
        if(!result||!result.ok)return;
        session.sendText(JSON.stringify({type:'chat_state',payload:{version:result.version,conversations:result.conversations,unreadTotal:result.unreadTotal}}));
      }).catch(error=>recordOperationalError('direct_chat_state_boundary',error));
    });
    return;
  }
  const payload=chatState(uid);
  chatValidSessions(uid,session=>session.sendText(JSON.stringify({type:'chat_state',payload})));
}
function consumeChatRate(key,limit,windowMs){
  const now=Date.now(),cutoff=now-windowMs;
  let list=chatRateBuckets.get(key)||[];list=list.filter(value=>value>cutoff);
  if(list.length>=limit){chatRateBuckets.set(key,list);return Math.max(1,Math.ceil((list[0]+windowMs-now)/1000));}
  list.push(now);chatRateBuckets.set(key,list);return 0;
}
function chatQueryAllowed(uid,action){return !consumeChatRate('query:'+uid+':'+action,60,60000);}
function chatSendRetry(uid,peerUid){
  return consumeChatRate('send10:'+uid,8,10000)||consumeChatRate('send60:'+uid,30,60000)||
    consumeChatRate('pair60:'+chatConversation(uid,peerUid).id,30,60000)||consumeChatRate('send24:'+uid,500,86400000);
}
function directMessageFromDb(row){
  if(!row||typeof row!=='object')return null;
  return normalizeChatMessage({id:row.id,conversationId:row.conversation_id,seq:row.seq,senderUid:row.sender_uid,recipientUid:row.recipient_uid,
    clientMessageId:row.client_message_id,text:row.body,createdAt:Date.parse(row.created_at)||Date.now()});
}
async function persistDirectMessage(candidate){
  const local=db.chatMessages.find(row=>row.senderUid===candidate.senderUid&&row.clientMessageId===candidate.clientMessageId);
  if(local)return{row:local,duplicate:true,conflict:local.recipientUid!==candidate.recipientUid||local.text!==candidate.text};
  if(!useSupabase){candidate.seq=nextChatSeq();db.chatMessages.push(candidate);trimChatData();saveDB();return{row:candidate,duplicate:false,conflict:false};}
  const pair=chatConversation(candidate.senderUid,candidate.recipientUid);
  const result=await sbFetch('rpc/send_direct_message_v1',{method:'POST',body:JSON.stringify({
    p_id:candidate.id,p_conversation_id:pair.id,p_a_uid:pair.aUid,p_b_uid:pair.bUid,p_sender_uid:candidate.senderUid,
    p_recipient_uid:candidate.recipientUid,p_client_message_id:candidate.clientMessageId,p_body:candidate.text,
  })});
  if(result&&result.allowed===false)return{unavailable:true,reason:String(result.reason||'conversation_unavailable')};
  const row=directMessageFromDb(result&&result.message);if(!row)throw new Error('direct_message_insert_empty');
  if(!db.chatMessages.some(item=>item.id===row.id))db.chatMessages.push(row);
  if(chatSeqCompare(row.seq,db.nextChatSeq)>0)db.nextChatSeq=row.seq;trimChatData();saveDB();
  return{row,duplicate:!!(result&&result.duplicate),conflict:!!(result&&result.conflict)};
}
async function persistChatRead(row){
  if(useSupabase){
    const result=await sbFetch('rpc/apply_direct_message_read_v1',{method:'POST',body:JSON.stringify({p_conversation_id:row.conversationId,p_uid:row.uid,p_peer_uid:row.peerUid,p_last_read_seq:row.lastReadSeq})});
    if(result&&result.lastReadSeq)row.lastReadSeq=chatSeq(result.lastReadSeq);
  }
  row.updatedAt=Date.now();db.chatReads[chatReadKey(row.conversationId,row.uid)]=row;saveDB();return row;
}
async function sbLoadDirectChat(){
  if(!useSupabase)return;
  try{
    const messages=[],pageSize=1000;
    for(let offset=0;offset<CHAT_MAX_MESSAGES;offset+=pageSize){
      const rows=await sbFetch('rpc/list_direct_messages_v1',{method:'POST',body:JSON.stringify({p_limit:pageSize,p_offset:offset})});const page=Array.isArray(rows)?rows:[];
      messages.push(...page.map(directMessageFromDb).filter(Boolean));if(page.length<pageSize)break;
    }
    const reads=[];
    for(let offset=0;offset<100000;offset+=pageSize){const rows=await sbFetch('rpc/list_direct_message_reads_v1',{method:'POST',body:JSON.stringify({p_limit:pageSize,p_offset:offset})});const page=Array.isArray(rows)?rows:[];reads.push(...page);if(page.length<pageSize)break;}
    db.chatMessages=messages.filter(row=>row&&!testAdmin.shouldHidePublicUid(row.senderUid)&&!testAdmin.shouldHidePublicUid(row.recipientUid));
    db.chatReads=Object.fromEntries((Array.isArray(reads)?reads:[]).map(row=>{const value=normalizeChatRead({conversationId:row.conversation_id,uid:row.uid,peerUid:row.peer_uid,lastReadSeq:row.last_read_seq,updatedAt:Date.parse(row.updated_at)||0});return value?[chatReadKey(value.conversationId,value.uid),value]:null;}).filter(Boolean));
    normalizeChatStore();saveDB();
  }catch(error){recordOperationalError('supabase_direct_chat_load',error);console.error('加载 Supabase 私聊数据失败（私聊保持不可用直到迁移或服务恢复）:',error.message);}
}
async function sbLoadSocialGraph(){
  if(!useSupabase)return;
  try{
    const [requests,friendships,blocks,reports]=await Promise.all([
      sbFetch('friend_requests?select=*&status=eq.pending&limit=50000'),
      sbFetch('friendships?select=*&limit=50000'),
      sbFetch('blocks?select=*&limit=50000'),
      sbFetch('reports?select=*&order=created_at.desc&limit=50000'),
    ]);
    db.friendRequests=(Array.isArray(requests)?requests:[]).map(row=>({id:row.id,fromUid:row.from_uid,toUid:row.to_uid,status:row.status,createdAt:Date.parse(row.created_at)||0,updatedAt:Date.parse(row.updated_at)||0})).filter(row=>!testAdmin.shouldHidePublicUid(row.fromUid)&&!testAdmin.shouldHidePublicUid(row.toUid));
    db.friendships=(Array.isArray(friendships)?friendships:[]).map(row=>({id:row.id,aUid:row.a_uid,bUid:row.b_uid,createdAt:Date.parse(row.created_at)||0})).filter(row=>!testAdmin.shouldHidePublicUid(row.aUid)&&!testAdmin.shouldHidePublicUid(row.bUid));
    db.blocks=(Array.isArray(blocks)?blocks:[]).map(row=>({id:row.id,blockerUid:row.blocker_uid,blockedUid:row.blocked_uid,targetSnapshot:row.target_snapshot||{},createdAt:Date.parse(row.created_at)||0})).filter(row=>!testAdmin.shouldHidePublicUid(row.blockerUid)&&!testAdmin.shouldHidePublicUid(row.blockedUid));
    db.reports=(Array.isArray(reports)?reports:[]).map(row=>({id:row.id,reporterUid:row.reporter_uid,targetUid:row.target_uid,reason:row.reason,contextType:row.context_type||'profile',contextId:row.context_id||'',matchId:row.match_id||'',recentEventIds:Array.isArray(row.recent_event_ids)?row.recent_event_ids:[],targetSnapshot:row.target_snapshot||{},status:row.status||'open',createdAt:Date.parse(row.created_at)||0})).filter(row=>!testAdmin.shouldHidePublicUid(row.reporterUid)&&!testAdmin.shouldHidePublicUid(row.targetUid));
    saveDB();
  }catch(error){recordOperationalError('supabase_social_load',error);console.error('加载 Supabase 社交图谱失败（继续使用本地缓存）:',error.message);}
}
async function handleChatList(session,payload){
  if(!useSupabase&&chatPlaylineBoundary){
    const result=await chatPlaylineBoundary.chat({action:'list',actor:chatBoundaryActorForSession(session),limit:payload&&payload.limit});
    if(!result.ok)return chatError(session,'chat_list',result.reason,'',result.retryAfter);
    session.sendText(JSON.stringify({type:'chat_state',payload:{version:result.version,conversations:result.conversations,unreadTotal:result.unreadTotal}}));
    return;
  }
  const user=chatUser(session,'chat_list');if(!user)return;
  if(!chatQueryAllowed(user.uid,'list'))return chatError(session,'chat_list','rate_limited','',5);
  session.sendText(JSON.stringify({type:'chat_state',payload:chatState(user.uid,payload&&payload.limit)}));
}
async function handleChatHistory(session,payload){
  if(!useSupabase&&chatPlaylineBoundary){
    const result=await chatPlaylineBoundary.chat({action:'history',actor:chatBoundaryActorForSession(session),peerUid:payload&&payload.peerUid,beforeSeq:payload&&payload.beforeSeq,limit:payload&&payload.limit});
    if(!result.ok)return chatError(session,'chat_history',result.reason,'',result.retryAfter);
    session.sendText(JSON.stringify({type:'chat_history',payload:{conversationId:result.conversationId,peer:result.peer,messages:result.messages,hasMore:result.hasMore,nextBeforeSeq:result.nextBeforeSeq,readThroughSeq:result.readThroughSeq,peerReadThroughSeq:result.peerReadThroughSeq}}));
    return;
  }
  const user=chatUser(session,'chat_history');if(!user)return;
  if(!chatQueryAllowed(user.uid,'history'))return chatError(session,'chat_history','rate_limited','',5);
  const peerUid=String(payload&&payload.peerUid||''),peer=db.users[peerUid];
  if(!testAdmin.socialAccess(user.uid,peerUid).ok)return chatError(session,'chat_history','test_admin_isolated');
  if(!peer||peer.ephemeral||peerUid===user.uid)return chatError(session,'chat_history','invalid_target');
  if(!chatCanRead(user.uid,peerUid))return chatError(session,'chat_history','conversation_unavailable');
  const beforeRaw=payload&&payload.beforeSeq, before=beforeRaw===undefined||beforeRaw===null||beforeRaw===''?null:chatSeq(beforeRaw);
  if(before==='0')return chatError(session,'chat_history','invalid_cursor');
  const limit=Math.max(1,Math.min(50,Number(payload&&payload.limit)||30)),conversation=chatConversation(user.uid,peerUid);
  let rows=chatMessagesFor(conversation.id);if(before)rows=rows.filter(row=>chatSeqCompare(row.seq,before)<0);
  const page=rows.slice(-limit),read=chatReadState(conversation.id,user.uid,peerUid),peerRead=chatReadState(conversation.id,peerUid,user.uid);
  session.sendText(JSON.stringify({type:'chat_history',payload:{conversationId:conversation.id,peer:chatPublicPeer(user.uid,peerUid),messages:page.map(chatMessagePayload),
    hasMore:rows.length>page.length,nextBeforeSeq:rows.length>page.length&&page.length?page[0].seq:null,readThroughSeq:read.lastReadSeq,peerReadThroughSeq:peerRead.lastReadSeq}}));
}
async function handleChatSend(session,payload){
  if(!useSupabase&&chatPlaylineBoundary){
    const clientMessageId=String(payload&&payload.clientMessageId||'');
    const result=await chatPlaylineBoundary.chat({action:'send',actor:chatBoundaryActorForSession(session),peerUid:payload&&payload.peerUid,clientMessageId,text:payload&&payload.text});
    if(!result.ok)return chatError(session,'chat_send',result.reason,clientMessageId,result.retryAfter);
    const message=result.message,peerUid=String(message&&message.senderUid===session.uid?message.recipientUid:message.senderUid),conversationId=chatConversation(session.uid,peerUid).id;
    if(!result.duplicate&&clusterCoordinator.enabled)clusterCoordinator.publishDirectMessage(message.id,session.uid,message.recipientUid)
      .catch(error=>recordOperationalError('cluster_chat_publish',error));
    session.sendText(JSON.stringify({type:'chat_send_ok',payload:{clientMessageId:result.clientMessageId||clientMessageId,messageId:result.messageId,seq:result.seq,message,duplicate:!!result.duplicate}}));
    chatValidSessions(session.uid,target=>{if(target!==session)target.sendText(JSON.stringify({type:'chat_message',payload:{conversationId,message,unreadCount:chatUnreadCount(session.uid,message.recipientUid),duplicate:!!result.duplicate}}));});
    chatValidSessions(message.recipientUid,target=>target.sendText(JSON.stringify({type:'chat_message',payload:{conversationId,message,unreadCount:chatUnreadCount(message.recipientUid,session.uid),duplicate:!!result.duplicate}})));
    sendChatState(session.uid);sendChatState(message.recipientUid);
    return;
  }
  const peerUid=String(payload&&payload.peerUid||''),clientMessageId=String(payload&&payload.clientMessageId||''),peer=db.users[peerUid];
  const user=chatUser(session,'chat_send',clientMessageId);if(!user)return;
  if(!testAdmin.socialAccess(user.uid,peerUid).ok)return chatError(session,'chat_send','test_admin_isolated',clientMessageId);
  if(!peer||peer.ephemeral||peerUid===user.uid)return chatError(session,'chat_send','invalid_target',clientMessageId);
  if(!CHAT_CLIENT_ID_RE.test(clientMessageId))return chatError(session,'chat_send','invalid_client_message_id',clientMessageId);
  const text=normalizeChatText(payload&&payload.text),valid=validChatText(text);if(!valid.ok)return chatError(session,'chat_send',valid.reason,clientMessageId);
  if(!socialFriendship(user.uid,peerUid)||socialBlockedBetween(user.uid,peerUid))return chatError(session,'chat_send','conversation_unavailable',clientMessageId);
  const retryAfter=chatSendRetry(user.uid,peerUid);if(retryAfter)return chatError(session,'chat_send','rate_limited',clientMessageId,retryAfter);
  const conversation=chatConversation(user.uid,peerUid),candidate={id:socialId('msg'),conversationId:conversation.id,seq:'0',senderUid:user.uid,recipientUid:peerUid,clientMessageId,text,createdAt:Date.now()};
  let persisted;try{persisted=await persistDirectMessage(candidate);}catch(error){recordOperationalError('direct_chat_persist',error);return chatError(session,'chat_send','server_unavailable',clientMessageId,3);}
  if(persisted.unavailable)return chatError(session,'chat_send',persisted.reason||'conversation_unavailable',clientMessageId);
  if(persisted.conflict)return chatError(session,'chat_send','idempotency_conflict',clientMessageId);
  const message=chatMessagePayload(persisted.row);
  if(!persisted.duplicate&&clusterCoordinator.enabled)clusterCoordinator.publishDirectMessage(message.id,user.uid,peerUid)
    .catch(error=>recordOperationalError('cluster_chat_publish',error));
  session.sendText(JSON.stringify({type:'chat_send_ok',payload:{clientMessageId,messageId:message.id,seq:message.seq,message,duplicate:!!persisted.duplicate}}));
  chatValidSessions(user.uid,target=>{if(target!==session)target.sendText(JSON.stringify({type:'chat_message',payload:{conversationId:conversation.id,message,
    unreadCount:chatUnreadCount(user.uid,peerUid),duplicate:!!persisted.duplicate}}));});
  chatValidSessions(peerUid,target=>target.sendText(JSON.stringify({type:'chat_message',payload:{conversationId:conversation.id,message,
    unreadCount:chatUnreadCount(peerUid,user.uid),duplicate:!!persisted.duplicate}})));
  sendChatState(user.uid);sendChatState(peerUid);
}
async function handleChatRead(session,payload){
  if(!useSupabase&&chatPlaylineBoundary){
    const result=await chatPlaylineBoundary.chat({action:'read',actor:chatBoundaryActorForSession(session),peerUid:payload&&payload.peerUid,throughSeq:payload&&payload.throughSeq});
    if(!result.ok)return chatError(session,'chat_read',result.reason,'',result.retryAfter);
    const peerUid=String(payload&&payload.peerUid||''),response={conversationId:result.conversationId,readerUid:result.readerUid,throughSeq:result.throughSeq,readAt:result.readAt};
    if(clusterCoordinator.enabled)clusterCoordinator.publishDirectMessageRead(result.conversationId,result.readerUid,peerUid,result.throughSeq)
      .catch(error=>recordOperationalError('cluster_chat_read_publish',error));
    for(const uid of [result.readerUid,peerUid])chatValidSessions(uid,target=>target.sendText(JSON.stringify({type:'chat_read_ok',payload:response})));
    sendChatState(result.readerUid);sendChatState(peerUid);
    return;
  }
  const user=chatUser(session,'chat_read');if(!user)return;
  if(!chatQueryAllowed(user.uid,'read'))return chatError(session,'chat_read','rate_limited','',5);
  const peerUid=String(payload&&payload.peerUid||''),peer=db.users[peerUid],throughSeq=chatSeq(payload&&payload.throughSeq);
  if(!testAdmin.socialAccess(user.uid,peerUid).ok)return chatError(session,'chat_read','test_admin_isolated');
  if(!peer||peer.ephemeral||peerUid===user.uid)return chatError(session,'chat_read','invalid_target');
  if(!chatCanRead(user.uid,peerUid))return chatError(session,'chat_read','conversation_unavailable');
  const conversation=chatConversation(user.uid,peerUid),received=chatMessagesFor(conversation.id).filter(row=>row.recipientUid===user.uid&&chatSeqCompare(row.seq,throughSeq)<=0);
  if(throughSeq==='0'||!received.some(row=>row.seq===throughSeq))return chatError(session,'chat_read','message_not_found');
  const current=chatReadState(conversation.id,user.uid,peerUid);if(chatSeqCompare(throughSeq,current.lastReadSeq)>0)current.lastReadSeq=throughSeq;
  try{await persistChatRead(current);}catch(error){recordOperationalError('direct_chat_read_persist',error);return chatError(session,'chat_read','server_unavailable','',3);}
  if(clusterCoordinator.enabled)clusterCoordinator.publishDirectMessageRead(conversation.id,user.uid,peerUid,current.lastReadSeq)
    .catch(error=>recordOperationalError('cluster_chat_read_publish',error));
  const response={conversationId:conversation.id,readerUid:user.uid,throughSeq:current.lastReadSeq,readAt:current.updatedAt};
  for(const uid of [user.uid,peerUid])chatValidSessions(uid,target=>target.sendText(JSON.stringify({type:'chat_read_ok',payload:response})));
  sendChatState(user.uid);sendChatState(peerUid);
}

async function handleClusterEvent(topic,payload){
  if(topic==='direct_message'){
    const messageId=String(payload&&payload.messageId||'');
    if(!/^[A-Za-z0-9._:-]{3,128}$/.test(messageId))throw new Error('cluster_direct_message_id_invalid');
    const raw=await sbFetch('rpc/get_direct_message_by_id_v1',{method:'POST',body:JSON.stringify({p_id:messageId})});
    const row=directMessageFromDb(raw);
    if(!row||row.id!==messageId||row.senderUid!==String(payload.senderUid||'')||row.recipientUid!==String(payload.recipientUid||''))
      throw new Error('cluster_direct_message_lookup_mismatch');
    const inserted=!db.chatMessages.some(item=>item.id===row.id);
    if(inserted){
      db.chatMessages.push(row);if(chatSeqCompare(row.seq,db.nextChatSeq)>0)db.nextChatSeq=row.seq;trimChatData();saveDB();
    }
    if(!inserted)return;
    const message=chatMessagePayload(row),conversation=chatConversation(row.senderUid,row.recipientUid);
    for(const uid of [row.senderUid,row.recipientUid])chatValidSessions(uid,target=>target.sendText(JSON.stringify({type:'chat_message',payload:{
      conversationId:conversation.id,message,unreadCount:chatUnreadCount(uid,uid===row.senderUid?row.recipientUid:row.senderUid),duplicate:false,
    }})));
    sendChatState(row.senderUid);sendChatState(row.recipientUid);return;
  }
  if(topic==='direct_message_read'){
    const conversationId=String(payload&&payload.conversationId||''),readerUid=String(payload&&payload.readerUid||''),peerUid=String(payload&&payload.peerUid||'');
    if(chatConversation(readerUid,peerUid).id!==conversationId)throw new Error('cluster_direct_message_read_invalid');
    const rows=await sbFetch('direct_message_reads?conversation_id=eq.'+encodeURIComponent(conversationId)+'&uid=eq.'+encodeURIComponent(readerUid)+'&select=*&limit=1');
    const raw=Array.isArray(rows)&&rows[0];
    const read=normalizeChatRead(raw&&{conversationId:raw.conversation_id,uid:raw.uid,peerUid:raw.peer_uid,lastReadSeq:raw.last_read_seq,updatedAt:Date.parse(raw.updated_at)||Date.now()});
    if(!read||read.peerUid!==peerUid||chatSeqCompare(read.lastReadSeq,payload.throughSeq)<0)throw new Error('cluster_direct_message_read_lookup_mismatch');
    const current=db.chatReads[chatReadKey(conversationId,readerUid)];if(current&&chatSeqCompare(current.lastReadSeq,read.lastReadSeq)>=0)return;
    db.chatReads[chatReadKey(conversationId,readerUid)]=read;saveDB();
    const response={conversationId,readerUid,throughSeq:read.lastReadSeq,readAt:read.updatedAt};
    for(const uid of [readerUid,peerUid])chatValidSessions(uid,target=>target.sendText(JSON.stringify({type:'chat_read_ok',payload:response})));
    sendChatState(readerUid);sendChatState(peerUid);
  }
}

function normalizeOwned(o){
  const base = { avatars: Array.from({ length: 30 }, (_, i) => i).concat([100,101,108,109,116,117,124,125,132,133,140,141]), frames: [0], effects: [0], backgrounds: [0], game_cosmetics: [] };
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
function normalizeGameCosmetics(value, user){
  const source=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
  const choose=(game,slot,input,allowed,fallback)=>allowed.includes(input) && (input === fallback || !user || ownsItem(user,'game_cosmetics',GAME_COSMETIC_CATALOG.find(item=>item.game===game&&item.slot===slot&&item.value===input)?.id)) ? input : fallback;
  return{
    gomoku:{pieceSkin:choose('gomoku','pieceSkin',source.gomoku&&source.gomoku.pieceSkin,['classic','glow'],'classic')},
    ludo:{baseSkin:choose('ludo','baseSkin',source.ludo&&source.ludo.baseSkin,['classic','cyber'],'classic'),pieceSkin:choose('ludo','pieceSkin',source.ludo&&source.ludo.pieceSkin,['classic','jet'],'classic'),diceSkin:choose('ludo','diceSkin',source.ludo&&source.ludo.diceSkin,['classic','cyber'],'classic')},
    monopoly:{tokenSkin:choose('monopoly','tokenSkin',source.monopoly&&source.monopoly.tokenSkin,['character','car'],'character')},
    tank:{tankSkin:choose('tank','tankSkin',source.tank&&source.tank.tankSkin,['classic','cyber'],'classic')},
    tetris:{blockSkin:choose('tetris','blockSkin',source.tetris&&source.tetris.blockSkin,['classic','neon'],'classic'),backgroundSkin:choose('tetris','backgroundSkin',source.tetris&&source.tetris.backgroundSkin,['classic','grid'],'classic')},
    xiangqi:{pieceSkin:choose('xiangqi','pieceSkin',source.xiangqi&&source.xiangqi.pieceSkin,['classic','jade'],'classic')},
  };
}
function testAdminStarterUser(uid, username){
  const starterBackground = 0;
  return {
    uid, username, usernameKey: normalizeUsername(username), name: 'Ghost QA Admin',
    avatar: 100, background: starterBackground, frame: 0, effect: 0, nameFx: 0,
    owned: normalizeOwned({ backgrounds: [starterBackground] }),
    gameCosmetics: normalizeGameCosmetics(), playerCharacter: normalizePlayerCharacter(),
    achievements: [], playmates: {}, daily: { play: 0, win: 0, streak: 0 },
    xp: 0, level: 1, streak: 0, bestStreak: 0, coins: 0, played: {}, total: 0, wins: {}, totalWins: 0,
    recentResults: [], purchaseRequests: [], soloRate: [], pin_hash: null,
    dailyFirstWinDate: '', dailyAICurrencyKey: '', dailyAICurrencyEarned: 0,
    xpCurveVersion: REWARD_CONFIG.level.curveVersion,
    signature: '', countryRegion: '', genderTag: 'hidden', presencePreference: 'invisible', presenceVisibility: 'nobody', showcase: null,
    lang: 'zh-CN', created_at: Date.now(), authTokens: [], authVersion: 'username-password-v1', ephemeral: false,
  };
}
loadDB();

/* ---------------- Playline Community P0 ---------------- */
function playlineActorForSession(session){
  const user=session&&session.uid&&db.users[session.uid];
  if(!user)return null;
  return {
    uid:user.uid,
    tokenHash:session.tokenHash,
    authenticated:true,
    sessionValid:!!(session.tokenHash&&userHasTokenHash(user,session.tokenHash)),
    ephemeral:!!user.ephemeral,
    testAdmin:testAdmin.shouldHidePublicUid(user.uid),
    capabilities:session.capabilities instanceof Set?[...session.capabilities]:[],
    profile:publicProfileObj(user, user.uid),
  };
}
function playlineResultResolver(actor, resultId){
  const uid=String(actor&&actor.uid||''),id=String(resultId||'');
  if(!uid||!id||testAdmin.shouldHidePublicUid(uid))return null;
  const row=[...(db.rewardHistory||[])].reverse().find(item=>item&&item.uid===uid&&String(item.resultId||'')===id&&item.mode==='online'&&item.eligible!==false&&item.blockedReason!=='afk'&&item.blockedReason!=='result_disputed');
  if(!row||!VALID_GAMES.includes(String(row.game||row.gameId||'')))return null;
  return { gameId:String(row.game||row.gameId), outcome:['win','draw','loss'].includes(String(row.result))?String(row.result):null, mode:'online', placement:Number(row.placement)||undefined, participantCount:Number(row.participantCount)||undefined, settledAt:Number(row.at||row.createdAt)||Date.now(), authority:'settled_consensus' };
}
function playlineRecordResolver(actor, recordKey){
  const uid=String(actor&&actor.uid||''),key=String(recordKey||'');
  const user=db.users[uid];
  if(!user||user.ephemeral||testAdmin.shouldHidePublicUid(uid))return null;
  const mastery=deriveVictoryMastery(user.wins||{});
  if(key==='level')return {record:key,value:Math.max(1,Number(user.level)||1),recordedAt:Date.now(),badgeKey:'profile_level'};
  if(key==='total_wins')return {record:key,value:Math.max(0,Number(user.totalWins)||0),recordedAt:Date.now(),badgeKey:'total_wins'};
  const match=/^(game_wins|mastery):(gomoku|ludo|monopoly|tank|tetris|xiangqi)$/.exec(key);
  if(!match)return null;
  const game=match[2],item=mastery&&mastery.byGame&&mastery.byGame[game];
  const value=match[1]==='game_wins'?Math.max(0,Number(user.wins&&user.wins[game])||0):Math.max(0,Number(item&&item.wins)||0);
  return {record:key,gameId:game,value,recordedAt:Date.now(),badgeKey:match[1]};
}
const playlineStore=useSupabase
  ? createSupabasePlaylineStore({rpc:(name,payload)=>sbFetch('rpc/'+name,{method:'POST',body:JSON.stringify(payload)})})
  : createJsonPlaylineStore({state:db,persist:()=>{trimAuditData();saveDB();}});
const playline=createPlaylineModule({
  enabled:PLAYLINE_ENABLED,
  store:playlineStore,
  testAdminPolicy:testAdmin,
  socialBlockedBetween,
  socialFriendship:(aUid,bUid)=>!!socialFriendship(aUid,bUid),
  publicProfileResolver:(uid,actor)=>publicProfileObj(db.users[String(uid)||''],String(actor&&actor.uid||'')),
  resultResolver:playlineResultResolver,
  recordResolver:playlineRecordResolver,
  cursorSecret:process.env.PLAYLINE_CURSOR_SECRET||process.env.SESSION_SECRET||'playline-local-development-secret',
  isFormalActor:actor=>!!(actor&&actor.uid&&db.users[actor.uid]&&!db.users[actor.uid].ephemeral&&userHasTokenHash(db.users[actor.uid],actor.tokenHash)),
});

/* ---------------- Chat/Playline boundary (local compatibility lane) ----------------
 * The WebSocket wire and cluster fan-out remain caller-owned.  On the local
 * JSON lane, Direct Chat policy/state now runs through the T7 boundary; when
 * real Supabase is configured the existing transactional RPC path remains the
 * explicit fallback until a production Chat Adapter is separately verified.
 */
function chatBoundaryActorForSession(session){
  const uid=String(session&&session.uid||''),user=db.users[uid];
  if(!user)return null;
  return {
    uid,
    tokenHash:String(session&&session.tokenHash||''),
    authenticated:true,
    sessionValid:!!(session&&session.tokenHash&&userHasTokenHash(user,session.tokenHash)),
    ephemeral:!!user.ephemeral,
    testAdmin:testAdmin.shouldHidePublicUid(uid),
    capabilities:session&&session.capabilities instanceof Set?[...session.capabilities]:[],
  };
}
const chatPlaylineRuntimeAdapter=createJsonRuntimeChatPlaylineAdapter({
  shape:'legacy',
  read:()=>({chatMessages:db.chatMessages,chatReads:db.chatReads,nextChatSeq:db.nextChatSeq}),
  commit:async(next)=>{
    db.chatMessages=Array.isArray(next&&next.chatMessages)?next.chatMessages:[];
    db.chatReads=next&&next.chatReads&&typeof next.chatReads==='object'&&!Array.isArray(next.chatReads)?next.chatReads:{};
    db.nextChatSeq=String(next&&next.nextChatSeq||'0');
    trimChatData();
    saveDB();
    return {ok:true,state:{chatMessages:db.chatMessages,chatReads:db.chatReads,nextChatSeq:db.nextChatSeq}};
  },
});
chatPlaylineBoundary=createChatPlaylineBoundary({
  adapter:chatPlaylineRuntimeAdapter,
  now:serverNow,
  users:db.users,
  listPeers:()=>Object.keys(db.users||{}),
  resolvePeer:uid=>db.users[String(uid)]||null,
  isFriend:(aUid,bUid)=>!!socialFriendship(aUid,bUid),
  isBlockedBetween:(aUid,bUid)=>socialBlockedBetween(aUid,bUid),
  publicPeer:(viewerUid,peerUid)=>chatPublicPeer(viewerUid,peerUid),
  isTestAdmin:uid=>testAdmin.shouldHidePublicUid(uid),
  authorizeActor:actor=>{
    const user=db.users[String(actor&&actor.uid||'')];
    return !!(user&&actor&&userHasTokenHash(user,String(actor.tokenHash||'')));
  },
  playline,
  playlineRequireCapability:true,
});

/* ---------------- Reward/Economy boundary (outbox ownership lane) ----------------
 * Reward numbers remain in reward-engine; profile projection is owned by
 * reward-progression-v1 while this seam owns only the remote outbox.
 * This seam owns only detached pending state, per-UID serialization and the
 * idempotent Supabase RPC retry path.  The legacy JSON field name is retained
 * so an interrupted rolling deployment can resume the same outbox safely.
 */
const rewardEconomyRuntimeAdapter=createJsonRuntimeRewardEconomyAdapter({
  shape:'legacy',
  read:()=>({pendingRewardSync:db.pendingRewardSync}),
  write:next=>{db.pendingRewardSync=Array.isArray(next&&next.pendingRewardSync)?next.pendingRewardSync:[];saveDB();},
});
rewardEconomyBoundary=createRewardEconomyBoundary({
  adapter:rewardEconomyRuntimeAdapter,
  enabled:useSupabase,
  now:serverNow,
  isExcluded:uid=>!!(testAdmin.shouldHidePublicUid(uid)||(db.users[uid]&&db.users[uid].ephemeral)),
  remoteApply:({uid,row,user})=>sbApplyRewardTransaction(user||db.users[uid],row),
});
const rewardProgressionRuntimeAdapter=createJsonRuntimeRewardProgressionAdapter({
  findResult:({uid,resultId})=>[...(db.rewardHistory||[])].reverse().find(row=>row&&row.uid===uid&&row.resultId===resultId)||null,
  commit:plan=>{
    const user=db.users[plan && plan.uid];
    if(!user||user!==plan.user||!plan.profilePatch)return{ok:false,reason:'reward_progression_state_unavailable'};
    const previousProfile={};
    for(const key of Object.keys(plan.profilePatch))previousProfile[key]=user[key];
    const previous={
      history:db.history,
      rewardHistory:db.rewardHistory,
      economyLedger:db.economyLedger,
      events:db.events,
    };
    try{
      for(const key of Object.keys(plan.profilePatch)) user[key]=plan.profilePatch[key];
      db.history.push(plan.row);
      db.rewardHistory.push(plan.row);
      if(plan.economy){
        const economyRow=recordEconomyChange(user,plan.economy.kind,plan.economy.amount,plan.economy.refId,plan.economy.metadata,false,plan.at);
        if(economyRow)plan.row.economyRow=economyRow;
      }
      for(const event of Array.isArray(plan.analytics)?plan.analytics:[]){
        recordAnalytics(event.event,{uid:event.uid,matchId:event.matchId,game:event.game,mode:event.mode,at:event.at,metadata:event.metadata});
      }
      trimAuditData();
      return{ok:true,row:plan.row};
    }catch(error){
      for(const key of Object.keys(plan.profilePatch))user[key]=previousProfile[key];
      db.history=previous.history;
      db.rewardHistory=previous.rewardHistory;
      db.economyLedger=previous.economyLedger;
      db.events=previous.events;
      recordOperationalError('reward_progression_commit',error);
      return{ok:false,reason:'reward_progression_commit_failed'};
    }
  },
});
rewardProgression=createRewardProgression({
  adapter:rewardProgressionRuntimeAdapter,
  policy:rewardProgressionPolicy,
  now:serverNow,
  isTestAdmin:uid=>testAdmin.shouldHidePublicUid(uid),
  sandboxReward:input=>testAdmin.sandboxReward(input),
  applyLocalRewardCurrency:(draft,reward)=>{
    if(useSupabase&&!draft.ephemeral&&reward.currency){
      draft._supabaseLocalRewardCurrency=(Number(draft._supabaseLocalRewardCurrency)||0)+(Number(reward.currency)||0);
    }
  },
});

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
  const result = authProfileBoundary.profile({ action:'update', user:u, payload, viewerUid:u && u.uid });
  return !!result.ok;
}
const DAILY_TASK_DEFS = rewardProgressionPolicy.dailyTaskDefs;
function updateServerAchievements(u){ return rewardProgressionPolicy.updateAchievements(u); }
function updateServerDaily(u, won, at){ return rewardProgressionPolicy.updateDaily(u, won, at); }
function ensureServerDailyTasks(u, key){ return rewardProgressionPolicy.ensureDailyTasks(u, key); }
function dailyTasksPayload(u, at){ return rewardProgressionPolicy.dailyTasksPayload(u, at); }
function recordServerPlaymate(u, other, game){
  if (!u || testAdmin.shouldHidePublicUid(u.uid) || !other || !other.uid || testAdmin.shouldHidePublicUid(other.uid) || other.uid === u.uid) return;
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
function applyResolvedProgress(u, reward, meta){
  if(!rewardProgression)return null;
  if(useSupabase&&u&&!u.ephemeral)ensureSupabaseRuntimeState(u);
  const outcome=rewardProgression.apply({user:u,reward,meta:meta||{}});
  if(!outcome.ok){recordOperationalError('reward_progression_apply',new Error(outcome.reason));return null;}
  return outcome.row||null;
}
function syncRewardRow(u, row){
  if (!rewardEconomyBoundary) return Promise.resolve(true);
  return rewardEconomyBoundary.enqueue({uid:u&&u.uid,user:u,row}).then(result => result.ok === true);
}
function retryPendingRewardSync(){
  if (!rewardEconomyBoundary) return Promise.resolve([]);
  return rewardEconomyBoundary.retry({userResolver:uid=>db.users[uid]});
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
    recordOperationalError('supabase_ai_rebase_legacy',new Error('legacy_replay_missing'));console.error('Supabase AI 学习 revision 冲突：旧 outbox 缺少 replay，暂不覆盖远端模型');
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
            recordOperationalError('supabase_ai_rebase',error);console.error('Supabase AI 学习 revision 重基失败:', error.message);
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
  if (!useSupabase || !user || user.ephemeral || testAdmin.shouldHidePublicUid(user.uid) || !learning || learning.duplicate ||
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
  clearRoomMatchSocialState(r);
  disposeRoomEngagementIntegrity(r);
  clearTankSnapshotDelayTimers(r);
  if (r.tankSnapshotStream && typeof r.tankSnapshotStream.dispose === 'function') r.tankSnapshotStream.dispose();
  r.tankSnapshotStream = null;
  r.tankLastBroadcastTick = -1;
  r.tankAuthority = null;
  r.tetrisAuthority = null;
  r.xiangqiClock = null;
  r.monopolyAuction = null;
  r.tetrisRuleAuthority = null;
  r.xiangqiRuleAuthority = null;
  r.monopolyRuleAuthority = null;
}
function clearRoomMatchSocialState(r){
  if (!r) return;
  if(r.matchExpressionDelayTimers instanceof Set){for(const timer of r.matchExpressionDelayTimers)clearTimeout(timer);r.matchExpressionDelayTimers.clear();}
  if(r.matchChatDelayTimers instanceof Set){for(const timer of r.matchChatDelayTimers)clearTimeout(timer);r.matchChatDelayTimers.clear();}
  r.matchExpressionSeen = new Map();
  r.matchExpressionRates = new Map();
  r.matchExpressionCounts = new Map();
  r.matchChatEvents = [];
  r.matchChatSeen = new Map();
  r.matchChatRates = new Map();
  r.matchChatCounts = new Map();
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
const TETRIS_ADVANCED_SCORING_ENABLED=String(process.env.TETRIS_GUIDELINE_SCORING||'1')!=='0';
// Transport-only experiment.  It never changes Tank Authority, and every
// recipient keeps the original full snapshot fallback until this is enabled.
const TANK_SNAPSHOT_DELTA_V2_ENABLED=String(process.env.ENABLE_TANK_SNAPSHOT_DELTA_V2||'0')==='1';
// Independent, server-only shadow audit. It has no protocol/capability or
// Reward effect and observes only inputs already accepted by Tank Authority.
const ENGAGEMENT_INTEGRITY_SHADOW_ENABLED=String(process.env.ENABLE_ENGAGEMENT_INTEGRITY_SHADOW||'0')==='1';
const ENGAGEMENT_INTEGRITY_COHORT_LIMIT=2;
const ENGAGEMENT_INTEGRITY_EVENT_CAPACITY=256;
const ENGAGEMENT_INTEGRITY_COHORTS=Object.freeze(['human','ai']);
// At 10 live snapshots/second, the maximum 30-second spectator delay needs
// at most 300 queued room frames. Keep one shared timer per frame (not one per
// spectator) and a small scheduling margin so memory remains deterministic.
const TANK_SNAPSHOT_DELAY_TIMER_LIMIT=320;
function roomSupports(r, protocol){return RULE_AUTHORITY_V2_ENABLED&&!!r&&[...r.clients.keys()].every(session=>sessionSupports(session,protocol));}

function noteEngagementIntegrityError(){
  incrementGameplayMetric('engagementIntegrityErrors');
}
function activeEngagementIntegrityAnalyzerCount(){
  let count=0;
  for(const room of rooms.values()){
    const state=room&&room.engagementIntegrityShadow;
    if(state&&state.analyzers instanceof Map)count+=Math.min(ENGAGEMENT_INTEGRITY_COHORT_LIMIT,state.analyzers.size);
  }
  return count;
}
function disposeRoomEngagementIntegrity(r){
  const state=r&&r.engagementIntegrityShadow;
  if(!state){if(r)r.engagementIntegrityShadow=null;return 0;}
  let disposed=0;
  if(state.analyzers instanceof Map){
    for(const analyzer of state.analyzers.values()){
      try{if(analyzer&&typeof analyzer.dispose==='function')analyzer.dispose();disposed++;}
      catch(_error){noteEngagementIntegrityError();}
    }
    state.analyzers.clear();
  }
  r.engagementIntegrityShadow=null;
  return disposed;
}
function startRoomEngagementIntegrity(r){
  disposeRoomEngagementIntegrity(r);
  if(!ENGAGEMENT_INTEGRITY_SHADOW_ENABLED||!r||r.game!=='tank'||!r.tankAuthority||r.testAdminSandbox===true)return false;
  const analyzers=new Map();
  try{
    if(humanRoomSeats(r).length)analyzers.set('human',EngagementIntegrityAnalyzer.create({enabled:true,capacity:ENGAGEMENT_INTEGRITY_EVENT_CAPACITY}));
    if(aiRoomSeats(r).length)analyzers.set('ai',EngagementIntegrityAnalyzer.create({enabled:true,capacity:ENGAGEMENT_INTEGRITY_EVENT_CAPACITY}));
    if(analyzers.size<1||analyzers.size>ENGAGEMENT_INTEGRITY_COHORT_LIMIT)throw new Error('invalid_cohort_count');
    r.engagementIntegrityShadow={
      analyzers,
      reconnectEpochs:Array.from({length:5},()=>0),
      reconnectPending:Array.from({length:5},()=>false),
    };
    return true;
  }catch(_error){
    for(const analyzer of analyzers.values()){try{if(analyzer&&typeof analyzer.dispose==='function')analyzer.dispose();}catch{}}
    analyzers.clear();
    r.engagementIntegrityShadow=null;
    noteEngagementIntegrityError();
    return false;
  }
}
function markRoomEngagementIntegrityReconnect(r,actorSlot){
  const state=r&&r.engagementIntegrityShadow;
  if(!state||!Number.isInteger(actorSlot)||actorSlot<0||actorSlot>=5)return false;
  const current=Number(state.reconnectEpochs&&state.reconnectEpochs[actorSlot])||0;
  state.reconnectEpochs[actorSlot]=Math.min(Number.MAX_SAFE_INTEGER,current+1);
  state.reconnectPending[actorSlot]=true;
  return true;
}
function tankEngagementActionClass(value){
  try{
    const input=value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    let up=input.up===true,down=input.down===true,left=input.left===true,right=input.right===true;
    const fire=input.fire===true;
    if(up&&down){up=false;down=false;}
    if(left&&right){left=false;right=false;}
    const vertical=up?'up':down?'down':'';
    const horizontal=left?'left':right?'right':'';
    const direction=vertical&&horizontal?vertical+'-'+horizontal:(vertical||horizontal||'idle');
    return fire?(direction==='idle'?'fire':direction+'-fire'):direction;
  }catch(_error){return null;}
}
function observeAcceptedTankInput(r,actorSlot,actorClass,actionClass,acceptedAt,firstSequence,excluded){
  if(!ENGAGEMENT_INTEGRITY_SHADOW_ENABLED)return false;
  if(excluded===true){incrementGameplayMetric('engagementIntegrityExcludedTestAdmin');return false;}
  const state=r&&r.engagementIntegrityShadow;
  if(!state||!(state.analyzers instanceof Map)||!ENGAGEMENT_INTEGRITY_COHORTS.includes(actorClass))return false;
  const analyzer=state.analyzers.get(actorClass);
  if(!analyzer||typeof analyzer.record!=='function')return false;
  const reconnectEpoch=Number(state.reconnectEpochs&&state.reconnectEpochs[actorSlot])||0;
  const reconnecting=state.reconnectPending&&state.reconnectPending[actorSlot]===true;
  try{
    const summary=Object.freeze({
      gameId:'tank',
      mode:humanRoomSeats(r).length>=2?'online':'ai',
      actorSlot,
      actorClass,
      sourceClass:'tank-authority',
      actionClass,
      acceptedAt,
      sequenceClass:reconnecting?'reconnect':firstSequence?'first':'monotonic',
      reconnectEpoch,
      inputModality:'unobserved',
    });
    const observed=analyzer.record(summary);
    if(!observed||observed.accepted!==true){noteEngagementIntegrityError();return false;}
    if(reconnecting)state.reconnectPending[actorSlot]=false;
    incrementGameplayMetric(actorClass==='ai'?'engagementIntegrityAiAccepted':'engagementIntegrityHumanAccepted');
    return true;
  }catch(_error){noteEngagementIntegrityError();return false;}
}
function boundedEngagementMetric(value,scale=1){
  const numeric=Number(value);
  if(!Number.isFinite(numeric)||numeric<0)return null;
  return Math.min(Number.MAX_SAFE_INTEGER,Math.round(numeric*scale));
}
function recordEngagementIntegrityAudit(cohort,snapshot){
  if(!snapshot||snapshot.auditOnly!==true)return noteEngagementIntegrityError();
  const accepted=boundedEngagementMetric(snapshot.acceptedCount);
  const observedMs=boundedEngagementMetric(snapshot.observedMs);
  const apm=boundedEngagementMetric(snapshot.APM,1000);
  const entropy=boundedEngagementMetric(snapshot.entropy,1000);
  const confidence=boundedEngagementMetric(snapshot.confidence,1000);
  if([accepted,observedMs,apm,entropy,confidence].some(value=>value===null))return noteEngagementIntegrityError();
  if(cohort==='ai'){
    incrementGameplayMetric('engagementIntegrityAiFinalized');
    incrementGameplayMetric('engagementIntegrityAiFinalizedAccepted',accepted);
    incrementGameplayMetric('engagementIntegrityAiObservedMs',observedMs);
    incrementGameplayMetric('engagementIntegrityAiApmMilliTotal',apm);
    incrementGameplayMetric('engagementIntegrityAiEntropyMilliTotal',entropy);
    incrementGameplayMetric('engagementIntegrityAiConfidenceMilliTotal',confidence);
  }else{
    incrementGameplayMetric('engagementIntegrityHumanFinalized');
    incrementGameplayMetric('engagementIntegrityHumanFinalizedAccepted',accepted);
    incrementGameplayMetric('engagementIntegrityHumanObservedMs',observedMs);
    incrementGameplayMetric('engagementIntegrityHumanApmMilliTotal',apm);
    incrementGameplayMetric('engagementIntegrityHumanEntropyMilliTotal',entropy);
    incrementGameplayMetric('engagementIntegrityHumanConfidenceMilliTotal',confidence);
  }
  if(snapshot.saturated===true)incrementGameplayMetric('engagementIntegritySaturatedAudits');
}
function finalizeRoomEngagementIntegrity(r){
  const state=r&&r.engagementIntegrityShadow;
  if(!state||!(state.analyzers instanceof Map))return false;
  for(const [cohort,analyzer] of state.analyzers){
    try{recordEngagementIntegrityAudit(cohort,analyzer.snapshot());}
    catch(_error){noteEngagementIntegrityError();}
  }
  incrementGameplayMetric('engagementIntegrityFinalizedMatches');
  disposeRoomEngagementIntegrity(r);
  return true;
}
function clearTankSnapshotDelayTimers(r){
  if(!r||!(r.tankSnapshotDelayTimers instanceof Set))return 0;
  const count=r.tankSnapshotDelayTimers.size;
  for(const timer of r.tankSnapshotDelayTimers)clearTimeout(timer);
  r.tankSnapshotDelayTimers.clear();
  return count;
}
function forgetTankSnapshotRecipient(r, session){
  if (!r || !session || !r.tankSnapshotStream || typeof r.tankSnapshotStream.forget !== 'function') return false;
  const outcome=r.tankSnapshotStream.forget(session.sessionId);
  return !!(outcome&&outcome.accepted);
}
function tankSnapshotMessageFor(r, session, state, forceKeyframe){
  if (r&&r.tankSnapshotStream&&r.tankSnapshotStream.enabled===true&&sessionSupports(session,TANK_SNAPSHOT_DELTA_PROTOCOL)){
    const encoded=r.tankSnapshotStream.encodeFor(session.sessionId,state,{forceKeyframe:forceKeyframe===true});
    if(encoded&&encoded.accepted===true&&encoded.envelope)return{type:'tank_snapshot',payload:encoded.envelope};
  }
  return{type:'tank_snapshot',payload:state};
}
function deliverTankSnapshot(r, session, state, forceKeyframe){
  if(!session||session.alive===false){forgetTankSnapshotRecipient(r,session);return false;}
  const text=JSON.stringify(tankSnapshotMessageFor(r,session,state,forceKeyframe));
  session.sendText(text);
  return true;
}
function scheduleDelayedTankSnapshot(r,state,delayMs){
  if(!r||!state||!(r.spectators instanceof Map)||!r.spectators.size)return false;
  const delay=Math.max(0,Math.min(30000,Number(delayMs)||0));
  if(!delay)return false;
  if(!(r.tankSnapshotDelayTimers instanceof Set))r.tankSnapshotDelayTimers=new Set();
  while(r.tankSnapshotDelayTimers.size>=TANK_SNAPSHOT_DELAY_TIMER_LIMIT){
    const oldest=r.tankSnapshotDelayTimers.values().next().value;
    clearTimeout(oldest);r.tankSnapshotDelayTimers.delete(oldest);
  }
  const expectedMatchId=String(state.matchId||'');
  const expectedRoomId=String(r.id||'');
  const recipients=[...r.spectators.entries()].slice(0,Math.max(1,Number(r.maxSpectators)||50)).map(([session,marker])=>({session,marker}));
  const timer=setTimeout(()=>{
    if(r.tankSnapshotDelayTimers instanceof Set)r.tankSnapshotDelayTimers.delete(timer);
    if(!expectedMatchId||String(r.matchId||'')!==expectedMatchId||String(state.matchId||'')!==expectedMatchId)return;
    for(const recipient of recipients){
      const session=recipient.session;
      if(!session||session.alive===false||String(session.spectatorRoom||'')!==expectedRoomId||
          !(r.spectators instanceof Map)||r.spectators.get(session)!==recipient.marker)continue;
      deliverTankSnapshot(r,session,state,false);
    }
  },delay);
  r.tankSnapshotDelayTimers.add(timer);
  if(timer&&timer.unref)timer.unref();
  return true;
}
function broadcastTankSnapshot(r, state){
  if(!r||!state)return;
  for(const session of r.clients.keys()){
    if(session.alive===false){forgetTankSnapshotRecipient(r,session);continue;}
    deliverTankSnapshot(r,session,state,false);
  }
  if(r.spectators){
    const delay=Math.max(0,Number(r.spectatorDelayMs)||0);
    if(delay)scheduleDelayedTankSnapshot(r,state,delay);
    else for(const session of r.spectators.keys())deliverTankSnapshot(r,session,state,false);
  }
}
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
  if (!r || r.settled || !Array.isArray(order) || order.length !== activeSeatCount(r)) return;
  const results = authoritativeResults(order);
  settleRoomResult(r, results, { cause:cause || 'authoritative_gameplay' });
}
// Rule timers use the same Match Protocol seam as client actions. The helper
// deliberately returns `null` only during bootstrap/rollback, allowing the
// legacy inline path to remain a safe compatibility fallback; a handled but
// failed boundary result stays fail-closed and is not replayed inline.
function runMatchProtocolTransition(room, game){
  if (!matchProtocolBoundary || !room) return null;
  try {
    const outcome=matchProtocolBoundary.transition({
      type:String(game || '') + '_transition', room, session:room.host || null,
      payload:{ matchId:room.matchId },
    });
    if(outcome&&outcome.handled&&outcome.ok===false)stopRoomGameplayTimer(room);
    return outcome;
  } catch (_error) { return { handled:true, ok:false, reason:'match_protocol_unavailable' }; }
}
function startRoomAuthorities(r){
  stopRoomAuthorities(r);
  if (!r || !r.started || !r.matchId) return;
  if (r.game === 'tank'){
    r.tankAuthority = new TankAuthority({
      matchId:r.matchId, playerCount:activeSeatCount(r), startedAt:r.startedAt,
      durationMs:Math.max(10000, Number(process.env.TANK_MATCH_DURATION_MS) || 180000),
    });
    startRoomEngagementIntegrity(r);
    // Delta transport is an optional receiver-specific adapter.  The
    // Authority remains the sole snapshot source and a construction failure
    // deliberately leaves the existing full JSON broadcast path intact.
    r.tankSnapshotStream = null;
    r.tankLastBroadcastTick = -1;
    if(TANK_SNAPSHOT_DELTA_V2_ENABLED){
      try{
        r.tankSnapshotStream=createTankSnapshotStream({
          enabled:true,
          keyframeEveryTicks:Number(process.env.TANK_SNAPSHOT_DELTA_KEYFRAME_TICKS),
          maxRecipients:Number(process.env.TANK_SNAPSHOT_DELTA_MAX_RECIPIENTS),
          maxFramesPerRecipient:Number(process.env.TANK_SNAPSHOT_DELTA_MAX_FRAMES),
        });
      }catch(_error){r.tankSnapshotStream=null;}
    }
    r.gameplayTimer = setInterval(() => {
      if (!r.started || !r.tankAuthority) return;
      const state = r.tankAuthority.advance(Date.now());
      if (state.serverTick % 2 === 0 && state.serverTick > r.tankLastBroadcastTick){
        r.tankLastBroadcastTick=state.serverTick;
        incrementGameplayMetric('tankSnapshots');broadcastTankSnapshot(r,state);
      }
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
    if(TETRIS_ADVANCED_SCORING_ENABLED&&roomSupports(r,PROTOCOL_VERSIONS.tetrisRules)){
      r.tetrisRuleAuthority=new TetrisRuleAuthority({matchId:r.matchId,playerCount:activeSeatCount(r),startAt,matchEndAt,matchSeed:r.matchId});
      r.gameplayTimer=setInterval(()=>{
        if(!r.started||!r.tetrisRuleAuthority)return;
        const routed=runMatchProtocolTransition(r,'tetris');
        if(routed&&routed.handled)return;
        const advanced=r.tetrisRuleAuthority.advance(Date.now());
        if(advanced.changed){incrementGameplayMetric('tetrisSnapshots');broadcast(r,advanced.stateEvent||r.tetrisRuleAuthority.stateEvent());}
        if(advanced.result&&!r.gameplayResultSent){r.gameplayResultSent=true;broadcast(r,advanced.result);settleAuthoritativeRoom(r,advanced.result.order,'tetris_rule_authority');stopRoomGameplayTimer(r);}
      },50);
    }else{
      r.tetrisAuthority = new TetrisBattleAuthority({matchId:r.matchId,playerCount:activeSeatCount(r),startAt,matchEndAt,matchSeed:r.matchId});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.tetrisAuthority)return;const due=r.tetrisAuthority.advance(Date.now());due.forEach(item=>broadcast(r,{type:'tetris_garbage_due',payload:{matchId:r.matchId,revision:r.tetrisAuthority.revision,...item}}));if(r.tetrisAuthority.finished&&!r.gameplayResultSent){r.gameplayResultSent=true;const result=r.tetrisAuthority.result();broadcast(r,result);settleAuthoritativeRoom(r,result.order,'tetris_authority');stopRoomGameplayTimer(r);}},100);
    }
  } else if (r.game === 'xiangqi'){
    const initialMs=Math.max(1000,Number(process.env.XIANGQI_CLOCK_MS)||10*60*1000);
    if(roomSupports(r,PROTOCOL_VERSIONS.xiangqiRules)){
      r.xiangqiRuleAuthority=new XiangqiRuleAuthority({matchId:r.matchId,startedAt:r.startedAt,initialMs});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.xiangqiRuleAuthority||r.gameplayResultSent)return;const routed=runMatchProtocolTransition(r,'xiangqi');if(routed&&routed.handled)return;const advanced=r.xiangqiRuleAuthority.advance(Date.now());if(advanced.event){r.gameplayResultSent=true;broadcast(r,advanced.event);if(advanced.result)settleAuthoritativeRoom(r,advanced.result.order,'xiangqi_rule_timeout');stopRoomGameplayTimer(r);}},250);
    }else{
      r.xiangqiClock=new XiangqiClockAuthority({matchId:r.matchId,startedAt:r.startedAt,initialMs});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.xiangqiClock||r.gameplayResultSent)return;const timeout=r.xiangqiClock.timeout(Date.now());if(!timeout)return;r.gameplayResultSent=true;broadcast(r,timeout);settleAuthoritativeRoom(r,[timeout.payload.winner,timeout.payload.loser],'xiangqi_clock_timeout');stopRoomGameplayTimer(r);},250);
    }
  } else if (r.game === 'monopoly'){
    if(roomSupports(r,PROTOCOL_VERSIONS.monopolyRules)){
      r.monopolyRuleAuthority=new MonopolyRuleAuthority({matchId:r.matchId,playerCount:activeSeatCount(r),matchSeed:r.matchId,auctionDurationMs:Math.max(1000,Number(process.env.MONOPOLY_AUCTION_MS)||5000)});
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.monopolyRuleAuthority)return;const routed=runMatchProtocolTransition(r,'monopoly');if(routed&&routed.handled)return;const advanced=r.monopolyRuleAuthority.advance(Date.now());if(advanced.event)broadcast(r,advanced.event);if(advanced.result&&!r.gameplayResultSent){r.gameplayResultSent=true;broadcast(r,advanced.result);settleAuthoritativeRoom(r,advanced.result.order,'monopoly_rule_authority');stopRoomGameplayTimer(r);}},100);
    }else{
      r.monopolyAuction=new MonopolyAuctionAuthority({matchId:r.matchId,playerCount:activeSeatCount(r),durationMs:Math.max(1000,Number(process.env.MONOPOLY_AUCTION_MS)||5000)});r.monopolyTurn=0;
      r.gameplayTimer=setInterval(()=>{if(!r.started||!r.monopolyAuction)return;const closed=r.monopolyAuction.close(Date.now());if(closed)broadcast(r,closed);},100);
    }
  }
  if (r.gameplayTimer && r.gameplayTimer.unref) r.gameplayTimer.unref();
}
function announceRoomMatch(r){
  const playerCount=activeSeatCount(r);
  if (!r.testAdminSandbox) recordAnalytics('match_started', {
    matchId: r.matchId,
    game: r.game,
    mode: 'online',
    metadata: { participantCount:playerCount, humanCount:humanRoomSeats(r).length, aiCount:aiRoomSeats(r).length },
  });
  broadcast(r, { type:'started', game:r.game, size:playerCount, players:activeRoomSeats(r).map(seat => seat.seatId), seats:ensureRoomSeats(r).map(publicSeat), matchId:r.matchId, gameplay:gameplayMetadata(r), presentation:gameplayPresentation(r) });
  broadcastLobby();
}
function startRoomMatch(r, options={}){
  if(options.skipCompact!==true){
    const compacted=compactRoomPlayers(r);
    if(!compacted||!compacted.ok)return false;
  }
  r.started = true;
  const reservedMatchId=String(options&&options.matchId||'');
  r.matchId = reservedMatchId || crypto.randomBytes(12).toString('base64url');
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
  r.gameSnapshot = null;
  r.tetrisPresentation = new Map();
  r.matchExpressionSeen = new Map();
  r.matchExpressionRates = new Map();
  r.matchExpressionCounts = new Map();
  r.matchChatEvents = [];
  r.matchChatSeen = new Map();
  r.matchChatRates = new Map();
  r.matchChatCounts = new Map();
  r.tournamentBinding = null;
  r.finalResult = null;
  startRoomAuthorities(r);
  if(options.deferAnnounce!==true)announceRoomMatch(r);
  return true;
}
function roomResultError(r, msg, reason){
  for (const c of r.clients.keys()) c.sendText(JSON.stringify({ type: 'result_error', msg, reason, matchId: r.matchId }));
}
function settleRoomResult(r, results, options = {}){
  if (r.settled) return;
  r.settled = true;
  stopRoomGameplayTimer(r);
  clearRoomMatchSocialState(r);
  const now = Date.now();
  if (r.testAdminSandbox === true){
    const sandboxParticipants = [...r.clients.entries()].map(([session, slot]) => ({ session, slot, user: session.uid && db.users[session.uid] })).filter(x => x.user);
    r.resultRewards = r.resultRewards instanceof Map ? r.resultRewards : new Map();
    for (const p of sandboxParticipants){
      const mine = Array.isArray(results) ? results.find(x => x.slot === p.slot) : null;
      const result = options.forceResult || playerResult(results, mine, activeSeatCount(r));
      const reward = testAdmin.sandboxReward({gameId:r.game, mode:'ai', result, placement:result === 'win' ? 1 : 2, participantCount:sandboxParticipants.length, level:p.user.level, xp:p.user.xp});
      const resultId = r.matchId + ':' + p.slot;
      r.resultRewards.set(p.slot, reward);
      p.session.sendText(JSON.stringify({type:'result_ok',matchId:r.matchId,payload:{profile:profileObj(p.user),reward,resultId,virtual:true}}));
    }
    r.finalResult={matchId:r.matchId,game:r.game,results:(Array.isArray(results)?results:[]).map(item=>({slot:item.slot,rank:item.rank})),cause:options.cause||'sandbox'};
    broadcast(r,{type:'match_result',payload:r.finalResult});
    finalizeRoomEngagementIntegrity(r);
    return;
  }
  const progress = roomProgress(r);
  const isTournamentMatch=!!r.tournamentBinding;
  const globalEligibility = isTournamentMatch?{eligible:false,blockedReason:'tournament_mode'}:(options.eligibility || roomRewardEligibility(r, now));
  const participants = [...r.clients.entries()].map(([session, slot]) => ({ session, slot, user: session.uid && db.users[session.uid] })).filter(x => x.user);
  const participantUids = participants.map(p => p.user.uid);
  const aiIdentities = aiRoomSeats(r).map(seat => 'ai:' + seat.aiPersona + ':' + seat.aiDifficulty);
  const settlementMode = participants.length >= 2 ? 'online' : 'ai';
  const rewardMode = isTournamentMatch ? 'tournament' : settlementMode;
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
    const resultMeta = { matchId:r.matchId, resultId:r.matchId + ':' + p.slot, mode:rewardMode };
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
      mode:rewardMode,
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
    mode:rewardMode,
    metadata: {
      reason: globalEligibility.blockedReason || null,
      cause: options.cause || 'completed',
      durationMs,
      meaningfulActions: progress.meaningfulActions || 0,
      participantCount: participants.length,
    },
  });
  if (/forfeit|admin_recovery/.test(String(options.cause||''))) recordAnalytics('match_forfeit', { matchId: r.matchId, game: r.game, mode:rewardMode, metadata: { offenderSlot: options.offenderSlot } });
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
  // Reward resolution and public result receipts stay first. The shadow path
  // can only take an audit snapshot after those existing effects complete.
  finalizeRoomEngagementIntegrity(r);
  r.finalResult={matchId:r.matchId,game:r.game,results:results.map(item=>({slot:item.slot,rank:item.rank})),cause:options.cause||'consensus'};
  saveReplayForRoom(r, r.finalResult);
  broadcast(r,{type:'match_result',payload:r.finalResult});
  reportTournamentRoomResult(r,results,options);
  broadcastLeaderboard();
}
function saveReplayForRoom(r, finalResult){
  if (!r || !r.matchId || !Array.isArray(r.moveLog) || !r.moveLog.length) return null;
  const uids=[...r.clients.keys()].map(session=>session.uid).filter(Boolean);
  if (uids.some(testAdmin.shouldHidePublicUid)) return null;
  const createdAt=Date.now(),visibility=normalizeRoomVisibility(r.visibility);
  const replay={version:'replay-v1.1',replayId:'rep_'+crypto.randomBytes(10).toString('base64url'),matchId:r.matchId,game:r.game,createdAt,expiresAt:createdAt+REPLAY_TTL_MS,publicAt:visibility==='public'?createdAt+REPLAY_PUBLIC_DELAY_MS:0,visibility,uids,shareTokenHash:null,shareExpiresAt:0,moveLog:r.moveLog.map(event=>({seq:event.seq,player:event.player,payload:event.payload})),moveLogTruncated:!!r.moveLogTruncated,finalResult:{...finalResult}};
  db.replays=(db.replays||[]).filter(item=>item&&item.matchId!==r.matchId);db.replays.push(replay);trimAuditData();saveDB();
  recordAnalytics('replay_created',{matchId:r.matchId,game:r.game,metadata:{replayId:replay.replayId,eventCount:replay.moveLog.length,truncated:replay.moveLogTruncated}});
  return replay;
}
function replayPublicAt(replay){return Number(replay&&replay.publicAt)||((replay&&replay.visibility)==='public'?Number(replay.createdAt||0)+REPLAY_PUBLIC_DELAY_MS:0);}
function replayParticipant(replay,uid){return !!uid&&Array.isArray(replay&&replay.uids)&&replay.uids.includes(uid);}
function replayShareValid(replay,token,now=Date.now()){
  if(!replay||!token||Number(replay.shareExpiresAt||0)<=now||!/^[A-Za-z0-9_-]{20,160}$/.test(String(token)))return false;
  const expected=String(replay.shareTokenHash||''),actual=crypto.createHash('sha256').update(String(token)).digest('hex');
  return expected.length===actual.length&&!!expected&&crypto.timingSafeEqual(Buffer.from(expected),Buffer.from(actual));
}
function replayVisibleById(replay,uid,now=Date.now()){
  return replayParticipant(replay,uid)||(replay&&replay.visibility==='public'&&replayPublicAt(replay)<=now);
}
function replayMeta(replay,viewerUid){
  const canShare=replayParticipant(replay,viewerUid),shared=canShare&&Number(replay.shareExpiresAt||0)>Date.now()&&!!replay.shareTokenHash;
  return{version:replay.version||'replay-v1',replayId:replay.replayId,matchId:replay.matchId,game:replay.game,createdAt:replay.createdAt,expiresAt:replay.expiresAt,publicAt:replayPublicAt(replay),visibility:replay.visibility,eventCount:replay.moveLog.length,moveLogTruncated:!!replay.moveLogTruncated,finalResult:replay.finalResult,canShare,shared,shareExpiresAt:shared?replay.shareExpiresAt:0};
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
  const normalized = normalizeRoomResults(payload && payload.results, activeSeatCount(r));
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
  if (r.resultClaims.size < humanRoomSeats(r).length){ session.sendText(JSON.stringify({ type: 'result_pending', matchId: r.matchId })); return; }
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
    if (!testAdmin.shouldHidePublicUid(user.uid)) recordAnalytics('match_invalidated', {
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
    testAdminSandbox:testAdmin.hasCapability(user.uid, 'test_admin_sandbox_match'),
  };
  soloMatches.set(user.uid, match);
  if (!match.testAdminSandbox) recordAnalytics('match_started', { uid: user.uid, matchId: match.matchId, game, mode: 'ai' });
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
  if (testAdmin.shouldHidePublicUid(user && user.uid)) return;
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
  if (match.testAdminSandbox || testAdmin.hasCapability(user.uid, 'test_admin_sandbox_match')){
    const reward = testAdmin.sandboxReward({gameId:game,mode:'ai',result,level:user.level,xp:user.xp,participantCount:2});
    match.completed = true; match.updatedAt = Date.now(); soloMatches.delete(user.uid);
    session.sendText(JSON.stringify({type:'result_ok',payload:{profile:profileObj(user),resultId,matchId,reward,replayed:false,virtual:true}}));
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

function matchExpressionError(session, reason, eventId, retryAfter){
  const messages={
    unsupported_capability:'当前客户端不支持局内表达',persistent_account_required:'局内表达需要正式账号',spectator_readonly:'观战模式不能发送局内表达',
    not_in_room:'当前不在对局房间',match_not_active:'对局尚未开始',invalid_match:'对局已变化，请重试',invalid_event_id:'表达请求编号无效',
    invalid_expression:'表达内容无效',invalid_target:'表达目标无效',blocked:'你与目标玩家存在屏蔽关系',rate_limited:'表达太频繁，请稍后再试',
  };
  session.sendText(JSON.stringify({type:'match_expression_error',payload:{protocol:MATCH_EXPRESSION_PROTOCOL,eventId:String(eventId||''),reason,retryAfter:Math.max(0,Number(retryAfter)||0)},msg:messages[reason]||'局内表达发送失败',reason}));
  return false;
}
function matchExpressionStores(room){
  if(!(room.matchExpressionSeen instanceof Map))room.matchExpressionSeen=new Map();
  if(!(room.matchExpressionRates instanceof Map))room.matchExpressionRates=new Map();
  if(!(room.matchExpressionCounts instanceof Map))room.matchExpressionCounts=new Map();
  if(!(room.matchExpressionDelayTimers instanceof Set))room.matchExpressionDelayTimers=new Set();
}
function matchExpressionRetryAfter(room,uid,now){
  matchExpressionStores(room);
  const recent=(room.matchExpressionRates.get(uid)||[]).map(Number).filter(at=>Number.isFinite(at)&&now-at<60000);
  room.matchExpressionRates.set(uid,recent);
  const ten=recent.filter(at=>now-at<10000);
  if(ten.length>=4)return Math.max(1,Math.ceil((ten[0]+10000-now)/1000));
  if(recent.length>=12)return Math.max(1,Math.ceil((recent[0]+60000-now)/1000));
  if((Number(room.matchExpressionCounts.get(uid))||0)>=80)return 60;
  return 0;
}
function matchExpressionRecipientAllowed(session,senderUid){
  if(!session||!session.alive||!session.uid)return false;
  const user=db.users[session.uid];
  if(!user||!userHasTokenHash(user,session.tokenHash))return false;
  return session.uid===senderUid||!socialBlockedBetween(session.uid,senderUid);
}
function deliverMatchExpression(room,event){
  const text=JSON.stringify({type:'match_expression',payload:event});
  for(const session of room.clients.keys())if(matchExpressionRecipientAllowed(session,event.senderUid))session.sendText(text);
  if(!(room.spectators instanceof Map))return;
  const delay=Math.max(0,Number(room.spectatorDelayMs)||0);
  for(const session of room.spectators.keys()){
    if(!matchExpressionRecipientAllowed(session,event.senderUid))continue;
    if(!delay)session.sendText(text);
    else{
      matchExpressionStores(room);
      const timer=setTimeout(()=>{room.matchExpressionDelayTimers.delete(timer);if(room.started&&!room.settled&&String(room.matchId)===String(event.matchId)&&room.spectators&&room.spectators.has(session)&&matchExpressionRecipientAllowed(session,event.senderUid))session.sendText(text);},delay);
      room.matchExpressionDelayTimers.add(timer);
      if(timer&&timer.unref)timer.unref();
    }
  }
}
function handleMatchExpression(session,payload){
  const user=session.uid&&db.users[session.uid],eventId=String(payload&&payload.eventId||'');
  if(!session.capabilities||!session.capabilities.has(MATCH_EXPRESSION_PROTOCOL))return matchExpressionError(session,'unsupported_capability',eventId);
  if(!user||user.ephemeral)return matchExpressionError(session,'persistent_account_required',eventId);
  if(session.spectatorRoom)return matchExpressionError(session,'spectator_readonly',eventId);
  if(!session.room)return matchExpressionError(session,'not_in_room',eventId);
  const room=rooms.get(session.room);
  if(!room||!room.clients.has(session))return matchExpressionError(session,'not_in_room',eventId);
  if(!room.started||room.settled||!room.matchId)return matchExpressionError(session,'match_not_active',eventId);
  if(String(payload&&payload.matchId||'')!==String(room.matchId))return matchExpressionError(session,'invalid_match',eventId);
  if(!MATCH_EXPRESSION_EVENT_RE.test(eventId))return matchExpressionError(session,'invalid_event_id',eventId);
  const kind=String(payload&&payload.kind||''),expressionId=String(payload&&payload.expressionId||'');
  if(!((kind==='emoji'&&MATCH_EXPRESSION_EMOJI_IDS.has(expressionId))||(kind==='quick'&&MATCH_EXPRESSION_QUICK_IDS.has(expressionId))))return matchExpressionError(session,'invalid_expression',eventId);
  const senderSeat=seatForSession(room,session);
  if(!senderSeat||senderSeat.type!=='human')return matchExpressionError(session,'not_in_room',eventId);
  let targetSeat=null,target=null;
  if(payload&&payload.targetSeat!==undefined&&payload.targetSeat!==null&&payload.targetSeat!==''){
    targetSeat=Number(payload.targetSeat);target=Number.isInteger(targetSeat)&&ensureRoomSeats(room)[targetSeat];
    if(!target||target.type==='empty')return matchExpressionError(session,'invalid_target',eventId);
    if(target.type==='human'&&target.userId&&socialBlockedBetween(user.uid,target.userId))return matchExpressionError(session,'blocked',eventId);
  }
  matchExpressionStores(room);
  const seenKey=user.uid+'|'+eventId,existing=room.matchExpressionSeen.get(seenKey);
  if(existing){session.sendText(JSON.stringify({type:'match_expression_ok',payload:{protocol:MATCH_EXPRESSION_PROTOCOL,eventId,matchId:room.matchId,replayed:true}}));return true;}
  const now=Date.now(),retryAfter=matchExpressionRetryAfter(room,user.uid,now);
  if(retryAfter)return matchExpressionError(session,'rate_limited',eventId,retryAfter);
  const event={protocol:MATCH_EXPRESSION_PROTOCOL,matchId:String(room.matchId),eventId,senderUid:user.uid,player:Number(senderSeat.seatId),targetSeat:targetSeat===null?null:targetSeat,kind,expressionId,createdAt:now};
  room.matchExpressionSeen.set(seenKey,event);
  while(room.matchExpressionSeen.size>300)room.matchExpressionSeen.delete(room.matchExpressionSeen.keys().next().value);
  const rates=room.matchExpressionRates.get(user.uid)||[];rates.push(now);room.matchExpressionRates.set(user.uid,rates.slice(-12));
  room.matchExpressionCounts.set(user.uid,(Number(room.matchExpressionCounts.get(user.uid))||0)+1);
  deliverMatchExpression(room,event);
  session.sendText(JSON.stringify({type:'match_expression_ok',payload:{protocol:MATCH_EXPRESSION_PROTOCOL,eventId,matchId:room.matchId,replayed:false}}));
  return true;
}

function matchChatError(session,reason,messageId,retryAfter){
  const messages={
    unsupported_capability:'当前客户端不支持房间聊天',persistent_account_required:'房间聊天需要正式账号',spectator_readonly:'观战模式只能阅读房间聊天',
    not_in_room:'当前不在对局房间',match_not_active:'对局尚未开始',invalid_match:'对局已变化，请重试',invalid_message_id:'消息请求编号无效',
    empty_message:'消息不能为空',message_too_long:'房间消息最多 160 个字符',idempotency_conflict:'重复消息编号与原内容冲突',rate_limited:'消息太频繁，请稍后再试',
  };
  session.sendText(JSON.stringify({type:'match_chat_error',payload:{protocol:MATCH_CHAT_PROTOCOL,messageId:String(messageId||''),reason,retryAfter:Math.max(0,Number(retryAfter)||0)},msg:messages[reason]||'房间消息发送失败',reason}));
  return false;
}
function matchChatStores(room){
  if(!Array.isArray(room.matchChatEvents))room.matchChatEvents=[];
  if(!(room.matchChatSeen instanceof Map))room.matchChatSeen=new Map();
  if(!(room.matchChatRates instanceof Map))room.matchChatRates=new Map();
  if(!(room.matchChatCounts instanceof Map))room.matchChatCounts=new Map();
  if(!(room.matchChatDelayTimers instanceof Set))room.matchChatDelayTimers=new Set();
}
function normalizeMatchChatText(input){
  return normalizeChatText(input);
}
function validMatchChatText(text){
  const count=[...text].length,lines=text.split('\n').length;
  if(!count)return{ok:false,reason:'empty_message'};
  if(count>160||Buffer.byteLength(text,'utf8')>640||lines>4)return{ok:false,reason:'message_too_long'};
  return{ok:true};
}
function matchChatRetryAfter(room,uid,now){
  matchChatStores(room);
  const recent=(room.matchChatRates.get(uid)||[]).map(Number).filter(at=>Number.isFinite(at)&&now-at<60000);
  room.matchChatRates.set(uid,recent);
  const ten=recent.filter(at=>now-at<10000);
  if(ten.length>=4)return Math.max(1,Math.ceil((ten[0]+10000-now)/1000));
  if(recent.length>=12)return Math.max(1,Math.ceil((recent[0]+60000-now)/1000));
  if((Number(room.matchChatCounts.get(uid))||0)>=80)return 60;
  return 0;
}
function matchChatRoomForSession(session){
  const playerRoom=session&&session.room&&rooms.get(session.room);
  if(playerRoom&&playerRoom.clients&&playerRoom.clients.has(session))return playerRoom;
  const spectatorRoom=session&&session.spectatorRoom&&rooms.get(session.spectatorRoom);
  if(spectatorRoom&&spectatorRoom.spectators&&spectatorRoom.spectators.has(session))return spectatorRoom;
  return null;
}
function matchChatRecipientAllowed(session,senderUid){
  return matchExpressionRecipientAllowed(session,senderUid);
}
function matchChatVisibleEvents(room,session){
  matchChatStores(room);
  const spectator=!!(session.spectatorRoom&&room.spectators&&room.spectators.has(session));
  const cutoff=spectator?Date.now()-Math.max(0,Number(room.spectatorDelayMs)||0):Infinity;
  return room.matchChatEvents.filter(event=>Number(event.createdAt)<=cutoff&&matchChatRecipientAllowed(session,event.senderUid)).slice(-MATCH_CHAT_MAX_EVENTS);
}
function deliverMatchChat(room,event){
  const text=JSON.stringify({type:'match_chat_message',payload:event});
  for(const session of room.clients.keys())if(matchChatRecipientAllowed(session,event.senderUid))session.sendText(text);
  if(!(room.spectators instanceof Map))return;
  const delay=Math.max(0,Number(room.spectatorDelayMs)||0);
  for(const session of room.spectators.keys()){
    if(!matchChatRecipientAllowed(session,event.senderUid))continue;
    if(!delay)session.sendText(text);
    else{
      matchChatStores(room);
      const timer=setTimeout(()=>{room.matchChatDelayTimers.delete(timer);if(room.started&&!room.settled&&String(room.matchId)===String(event.matchId)&&room.spectators&&room.spectators.has(session)&&matchChatRecipientAllowed(session,event.senderUid))session.sendText(text);},delay);
      room.matchChatDelayTimers.add(timer);if(timer&&timer.unref)timer.unref();
    }
  }
}
function handleMatchChatSync(session,payload){
  const messageId=String(payload&&payload.messageId||'');
  if(!session.capabilities||!session.capabilities.has(MATCH_CHAT_PROTOCOL))return matchChatError(session,'unsupported_capability',messageId);
  const user=session.uid&&db.users[session.uid];if(!user||!userHasTokenHash(user,session.tokenHash))return matchChatError(session,'persistent_account_required',messageId);
  const room=matchChatRoomForSession(session);if(!room)return matchChatError(session,'not_in_room',messageId);
  if(!room.started||room.settled||!room.matchId)return matchChatError(session,'match_not_active',messageId);
  if(String(payload&&payload.matchId||'')!==String(room.matchId))return matchChatError(session,'invalid_match',messageId);
  session.sendText(JSON.stringify({type:'match_chat_state',payload:{protocol:MATCH_CHAT_PROTOCOL,matchId:String(room.matchId),messages:matchChatVisibleEvents(room,session)}}));
  return true;
}
function handleMatchChatSend(session,payload){
  const user=session.uid&&db.users[session.uid],messageId=String(payload&&payload.messageId||'');
  if(!session.capabilities||!session.capabilities.has(MATCH_CHAT_PROTOCOL))return matchChatError(session,'unsupported_capability',messageId);
  if(!user||user.ephemeral)return matchChatError(session,'persistent_account_required',messageId);
  if(session.spectatorRoom)return matchChatError(session,'spectator_readonly',messageId);
  if(!session.room)return matchChatError(session,'not_in_room',messageId);
  const room=rooms.get(session.room);if(!room||!room.clients.has(session))return matchChatError(session,'not_in_room',messageId);
  if(!room.started||room.settled||!room.matchId)return matchChatError(session,'match_not_active',messageId);
  if(String(payload&&payload.matchId||'')!==String(room.matchId))return matchChatError(session,'invalid_match',messageId);
  if(!MATCH_CHAT_MESSAGE_RE.test(messageId))return matchChatError(session,'invalid_message_id',messageId);
  const text=normalizeMatchChatText(payload&&payload.text),valid=validMatchChatText(text);if(!valid.ok)return matchChatError(session,valid.reason,messageId);
  const senderSeat=seatForSession(room,session);if(!senderSeat||senderSeat.type!=='human')return matchChatError(session,'not_in_room',messageId);
  matchChatStores(room);
  const seenKey=user.uid+'|'+messageId,existing=room.matchChatSeen.get(seenKey);
  if(existing){if(existing.text!==text)return matchChatError(session,'idempotency_conflict',messageId);session.sendText(JSON.stringify({type:'match_chat_ok',payload:{protocol:MATCH_CHAT_PROTOCOL,messageId,matchId:room.matchId,replayed:true}}));return true;}
  const now=Date.now(),retryAfter=matchChatRetryAfter(room,user.uid,now);if(retryAfter)return matchChatError(session,'rate_limited',messageId,retryAfter);
  const event={protocol:MATCH_CHAT_PROTOCOL,matchId:String(room.matchId),messageId,senderUid:user.uid,player:Number(senderSeat.seatId),text,createdAt:now};
  room.matchChatSeen.set(seenKey,event);while(room.matchChatSeen.size>300)room.matchChatSeen.delete(room.matchChatSeen.keys().next().value);
  room.matchChatEvents.push(event);room.matchChatEvents=room.matchChatEvents.slice(-MATCH_CHAT_MAX_EVENTS);
  const rates=room.matchChatRates.get(user.uid)||[];rates.push(now);room.matchChatRates.set(user.uid,rates.slice(-12));room.matchChatCounts.set(user.uid,(Number(room.matchChatCounts.get(user.uid))||0)+1);
  deliverMatchChat(room,event);
  session.sendText(JSON.stringify({type:'match_chat_ok',payload:{protocol:MATCH_CHAT_PROTOCOL,messageId,matchId:room.matchId,replayed:false}}));
  return true;
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
    this.roomRemovalRetryTimer = null;
    this.lastSeen = Date.now();
    this.messageTimes = [];
    this.authBusy = false;
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
  requirePersistentUser(){
    const u=this.requireUser();
    if(u&&u.ephemeral){this.sendText(JSON.stringify({type:'auth_error',msg:'访客数据不会永久保存，此功能需要正式账号',reason:'guest_persistence_disabled'}));return null;}
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
    if(type==='test_room_graph_recovery_status'&&process.env.NODE_ENV==='test'){
      this.sendText(JSON.stringify({
        type:'test_room_graph_recovery_status',
        payload:{
          queueSize:roomGraphRecoveryQueue.size,timerActive:roomGraphRecoveryTimer!==null,
          sourceResetFaultArmed:!!(tournamentTestFaults&&tournamentTestFaults.sourceResetWritesRemaining),
          abortReleaseFailuresRemaining:tournamentTestFaults?tournamentTestFaults.abortReleaseFailuresRemaining:0,
        },
      }));
      return;
    }
    const recoveryGuardRoom=this.room&&rooms.get(this.room);
    if(recoveryGuardRoom&&recoveryGuardRoom.presenceQuarantined&&ROOM_PRESENCE_QUARANTINED_MUTATIONS.has(type)){
      this.sendText(JSON.stringify({type:'error',msg:'房间状态正在安全恢复，请稍后重试',reason:'room_presence_quarantined'}));
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
        cancelEphemeralCleanup(uid);
      } else {
        this.uid = null;
        this.tokenHash = null;
      }
      this.sendText(JSON.stringify({
        type: 'hello_ack', proto: PROTOCOL_VERSION, authenticated: !!this.uid,
        admin: isTournamentAdmin(this.uid),
        rewardVersion: REWARD_CONFIG.version,
        capabilities: ['reward_breakdown','ai_reward_ticket','replay-v1.1','tournament-orchestrator-v1.1',...gameplayCapabilities(),
          'tank_authority_v1','tetris_battle_authority_v1','spectator_room_v1','tournament_orchestrator_v1','xiangqi_clock_v1','monopoly_auction_v1','game_cosmetic_presentation_v1',
          'ai_decision_confirm_v1','seat_protocol_v2','ready_v1','ai_seat_v1','room_visibility_v1','social_graph_v1','direct-chat-v1',MATCH_EXPRESSION_PROTOCOL,MATCH_CHAT_PROTOCOL,...(PLAYLINE_ENABLED?[PLAYLINE_PROTOCOL]:[])],
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
    const credentialV2=(type==='register'||type==='login')&&Number(payload&&payload.authVersion)===2;
    if(credentialV2||type==='username_check'||type==='guest_login'||type==='legacy_bind'){
      if(this.authBusy){this.authError('登录请求处理中，请稍候',{reason:'auth_service_busy',retryAfter:1});return;}
      this.authBusy=true;
      handleCredentialMessage(this,type,payload).catch(error=>{recordOperationalError('credential_auth',error);this.authError('登录服务繁忙，请稍后再试',{reason:'auth_service_busy',retryAfter:30});}).finally(()=>{this.authBusy=false;});
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
        owned: starterOwned, gameCosmetics: normalizeGameCosmetics(payload && payload.gameCosmetics), playerCharacter: normalizePlayerCharacter(),
        xp: 0, level: 1, streak: 0, bestStreak: 0, coins: 0, played: {}, total: 0, wins: {}, totalWins: 0,
        recentResults: [], purchaseRequests: [], soloRate: [], pin_hash: ph,
        dailyFirstWinDate: '', dailyAICurrencyKey: '', dailyAICurrencyEarned: 0,
        xpCurveVersion: REWARD_CONFIG.level.curveVersion,
        signature:'', countryRegion:'', genderTag:'hidden', presencePreference:'joinable', presenceVisibility:'everyone', showcase:null,
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
      const view = authProfileBoundary.profile({ action:'read', targetUid:uid, viewerUid:this.uid, viewerTokenHash:this.tokenHash });
      this.sendText(JSON.stringify({ type: 'profile_data', payload: view.ok ? view.profile : null }));
      return;
    }
    if (type === 'profile_compare'){
      const viewer = this.requirePersistentUser();
      if (!viewer) return;
      const targetUid = String(payload && (payload.uid || payload.targetUid) || ''), requestId = String(payload && payload.requestId || '').slice(0,96), target = db.users[targetUid];
      const comparison = /^[A-Za-z0-9_-]{8,96}$/.test(requestId)
        ? authProfileBoundary.profile({ action:'compare', viewer, target, requestId, targetUid })
        : { ok:false, reason:'profile_compare_forbidden' };
      if (!comparison.ok){
        this.sendText(JSON.stringify({type:'profile_compare_error',payload:{requestId,targetUid,reason:'profile_compare_forbidden'}}));
        return;
      }
      this.sendText(JSON.stringify({type:'profile_compare_data',payload:{requestId:comparison.requestId,targetUid:comparison.targetUid,self:comparison.self,friend:comparison.friend}}));
      return;
    }
    if (type === 'daily_tasks_get'){
      const u = this.requireUser();
      if (!u) return;
      this.sendText(JSON.stringify({ type:'daily_tasks', payload:dailyTasksPayload(u) }));
      return;
    }
    if (type === 'daily_task_claim'){
      const u = this.requirePersistentUser();
      if (!u) return;
      const taskId = String(payload && payload.taskId || '');
      const claimId = String(payload && payload.claimId || '');
      if (!/^[a-z0-9_]{3,40}$/.test(taskId) || !/^[A-Za-z][A-Za-z0-9_-]{7,120}$/.test(claimId)){
        this.sendText(JSON.stringify({type:'daily_task_error',msg:'任务领取请求无效',reason:'invalid_task_claim'}));return;
      }
      const task = DAILY_TASK_DEFS.find(item=>item.id===taskId);
      const state = ensureServerDailyTasks(u);
      if (!task){this.sendText(JSON.stringify({type:'daily_task_error',msg:'任务不存在',reason:'task_not_found'}));return;}
      if (testAdmin.hasCapability(u.uid, 'test_admin_profile')){
        this.sendText(JSON.stringify({type:'daily_task_claimed',payload:{...dailyTasksPayload(u),claimId,reward:0,virtual:true,profile:profileObj(u)}}));return;
      }
      if (state.claimIds[claimId]){this.sendText(JSON.stringify({type:'daily_task_claimed',payload:{...dailyTasksPayload(u),replayed:true,claimId}}));return;}
      if (state.claimed.includes(taskId)){this.sendText(JSON.stringify({type:'daily_task_claimed',payload:{...dailyTasksPayload(u),alreadyClaimed:true,claimId}}));return;}
      if ((Number(state[task.kind])||0) < task.target){this.sendText(JSON.stringify({type:'daily_task_error',msg:'任务尚未完成',reason:'task_incomplete'}));return;}
      u.coins = Math.max(0,Number(u.coins)||0) + task.reward;
      state.claimed.push(taskId); state.claimIds[claimId]=taskId;
      const ledger=recordEconomyChange(u,'daily_task',task.reward,'daily_task:'+u.dailyTaskKey+':'+taskId,{taskId,dayKey:u.dailyTaskKey,claimId});
      saveDB(); sbSyncProfile(u);
      this.sendText(JSON.stringify({type:'daily_task_claimed',payload:{...dailyTasksPayload(u),claimId,reward:task.reward,profile:profileObj(u),ledgerId:ledger&&ledger.refId}}));
      broadcastLeaderboard();
      return;
    }
    if (type === 'replay_list'){
      const u=this.requireUser();if(!u)return;
      const now=Date.now(),list=(db.replays||[]).filter(item=>item&&Number(item.expiresAt||0)>now&&replayVisibleById(item,u.uid,now)).slice(-50).reverse().map(item=>replayMeta(item,u.uid));
      this.sendText(JSON.stringify({type:'replay_list',payload:{items:list}}));return;
    }
    if (type === 'replay_share'){
      const u=this.requireUser();if(!u)return;
      const replayId=String(payload&&payload.replayId||''),replay=(db.replays||[]).find(item=>item&&item.replayId===replayId&&Number(item.expiresAt||0)>Date.now());
      if(!replay||!replayParticipant(replay,u.uid)){this.sendText(JSON.stringify({type:'replay_error',msg:'只有对局参与者可以分享回放',reason:'replay_share_forbidden'}));return;}
      const shareToken='shr_'+crypto.randomBytes(24).toString('base64url'),expiresAt=Math.min(Number(replay.expiresAt)||0,Date.now()+REPLAY_SHARE_TTL_MS);
      replay.shareTokenHash=crypto.createHash('sha256').update(shareToken).digest('hex');replay.shareExpiresAt=expiresAt;saveDB();
      recordAnalytics('replay_shared',{uid:u.uid,matchId:replay.matchId,game:replay.game,metadata:{replayId:replay.replayId,expiresAt}});
      this.sendText(JSON.stringify({type:'replay_shared',payload:{replayId,shareToken,expiresAt}}));return;
    }
    if (type === 'replay_unshare'){
      const u=this.requireUser();if(!u)return;
      const replayId=String(payload&&payload.replayId||''),replay=(db.replays||[]).find(item=>item&&item.replayId===replayId&&Number(item.expiresAt||0)>Date.now());
      if(!replay||!replayParticipant(replay,u.uid)){this.sendText(JSON.stringify({type:'replay_error',msg:'只有对局参与者可以撤销分享',reason:'replay_share_forbidden'}));return;}
      replay.shareTokenHash=null;replay.shareExpiresAt=0;saveDB();recordAnalytics('replay_unshared',{uid:u.uid,matchId:replay.matchId,game:replay.game,metadata:{replayId:replay.replayId}});
      this.sendText(JSON.stringify({type:'replay_unshared',payload:{replayId}}));return;
    }
    if (type === 'replay_get'){
      const u=this.requireUser();if(!u)return;
      const replayRef=String(payload&&(payload.replayId||payload.shareToken)||''),now=Date.now();
      const replay=(db.replays||[]).find(item=>item&&Number(item.expiresAt||0)>now&&(item.replayId===replayRef||replayShareValid(item,replayRef,now)));
      if(!replay||!(replayVisibleById(replay,u.uid,now)||replayShareValid(replay,replayRef,now))){this.sendText(JSON.stringify({type:'replay_error',msg:'回放不存在或无权访问',reason:'replay_forbidden'}));return;}
      this.sendText(JSON.stringify({type:'replay_data',payload:{...replayMeta(replay,u.uid),moveLog:replay.moveLog}}));return;
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
      const u = this.requirePersistentUser();
      if (!u) return;
      const category = String(payload && payload.category || '');
      const id = Number(payload && payload.id);
      const requestId = String(payload && payload.requestId || '');
      if (requestId && !/^[A-Za-z][A-Za-z0-9_-]{7,120}$/.test(requestId)){
        this.sendText(JSON.stringify({ type: 'purchase_error', payload:{category,id,requestId:''}, msg: '购买请求标识无效', reason: 'invalid_purchase_id' }));
        return;
      }
      const price = SHOP_PRICES[category] && SHOP_PRICES[category][id];
      if (!Number.isInteger(id) || !Number.isInteger(price)){
        this.sendText(JSON.stringify({ type: 'purchase_error', payload:{category,id,requestId}, msg: '商品不存在', reason: 'product_not_found' }));
        return;
      }
      if (testAdmin.hasCapability(u.uid, 'test_admin_all_catalog_items')){
        this.sendText(JSON.stringify({ type: 'purchase_ok', payload: {
          category, id, requestId, alreadyOwned: true, virtual: true, profile: profileObj(u),
        } }));
        return;
      }
      u.purchaseRequests = Array.isArray(u.purchaseRequests) ? u.purchaseRequests : [];
      u.owned = normalizeOwned(u.owned);
      if (useSupabase && !u.ephemeral){
        ensureSupabaseRuntimeState(u);
        const purchaseRef = requestId || ('purchase_' + crypto.randomBytes(12).toString('base64url'));
        const purchaseRequestsAtStart = Array.isArray(u.purchaseRequests) ? u.purchaseRequests.slice() : [];
        sbApplyPurchaseTransaction(u, category, id, price, purchaseRef).then(result => {
          if (!result){
            this.sendText(JSON.stringify({ type: 'purchase_error', payload:{category,id,requestId:purchaseRef}, msg: '购买同步失败，请稍后重试', reason: 'purchase_sync_failed' }));
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
            this.sendText(JSON.stringify({ type: 'purchase_error', payload:{category,id,requestId:purchaseRef}, msg: 'G Coins 余额不足，请完成有效对局获取 G Coins', reason: 'insufficient_balance' }));
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
            payload: { category, id, requestId:purchaseRef, replayed: result.duplicate === true, alreadyOwned: result.alreadyOwned === true, profile: profileObj(u) },
          }));
          broadcastLeaderboard();
        });
        return;
      }
      if (requestId && u.purchaseRequests.includes(requestId)){
        this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, requestId, replayed: true, profile: profileObj(u) } }));
        return;
      }
      if (ownsItem(u, category, id)){
        if (requestId) u.purchaseRequests = u.purchaseRequests.concat(requestId).slice(-100);
        saveDB(); sbSyncProfile(u);
        this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, requestId, alreadyOwned: true, profile: profileObj(u) } }));
        return;
      }
      if ((u.coins || 0) < price){
        this.sendText(JSON.stringify({ type: 'purchase_error', payload:{category,id,requestId}, msg: '余额不足，先去赢几局吧', reason: 'insufficient_balance' }));
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
      this.sendText(JSON.stringify({ type: 'purchase_ok', payload: { category, id, requestId, profile: profileObj(u) } }));
      broadcastLeaderboard();
      return;
    }
    if (type === 'logout'){
      const u = this.requireUser();
      if (!u) return;
      authProfileBoundary.session({ action:'revoke', user:u, tokenHash:this.tokenHash });
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
    if(type==='companion_checkin'){
      const user=this.requireUser();if(!user)return;
      const today=dayKey(),already=user.companionCheckinDay===today;
      if (testAdmin.shouldHidePublicUid(user.uid)){this.sendText(JSON.stringify({type:'companion_checkin_ok',payload:{day:today,already:true,ephemeral:false,virtual:true}}));return;}
      if(!already){user.companionCheckinDay=today;saveDB();if(!user.ephemeral)sbSyncAuthProfile(user);}
      this.sendText(JSON.stringify({type:'companion_checkin_ok',payload:{day:today,already,ephemeral:!!user.ephemeral}}));return;
    }
    if(type==='playline_list'){
      if(!this.capabilities||!this.capabilities.has(PLAYLINE_PROTOCOL))return playlineError(this,'playline_list',{reason:'unsupported_capability'});
      handlePlaylineList(this,payload).catch(error=>{recordOperationalError('playline_list',error);playlineError(this,'playline_list',{reason:'server_unavailable'});});return;
    }
    if(type==='playline_publish'){
      if(!this.capabilities||!this.capabilities.has(PLAYLINE_PROTOCOL))return playlineError(this,'playline_publish',{reason:'unsupported_capability'},payload&&payload.clientPostId);
      handlePlaylinePublish(this,payload).catch(error=>{recordOperationalError('playline_publish',error);playlineError(this,'playline_publish',{reason:'server_unavailable'},payload&&payload.clientPostId);});return;
    }
    if(type==='playline_remove'){
      if(!this.capabilities||!this.capabilities.has(PLAYLINE_PROTOCOL))return playlineError(this,'playline_remove',{reason:'unsupported_capability'});
      handlePlaylineRemove(this,payload).catch(error=>{recordOperationalError('playline_remove',error);playlineError(this,'playline_remove',{reason:'server_unavailable'});});return;
    }
    if(type==='chat_list'){
      handleChatList(this,payload).catch(error=>{recordOperationalError('direct_chat_list',error);chatError(this,'chat_list','server_unavailable','',3);});return;
    }
    if(type==='chat_history'){
      handleChatHistory(this,payload).catch(error=>{recordOperationalError('direct_chat_history',error);chatError(this,'chat_history','server_unavailable','',3);});return;
    }
    if(type==='chat_send'){
      handleChatSend(this,payload).catch(error=>{recordOperationalError('direct_chat_send',error);chatError(this,'chat_send','server_unavailable',payload&&payload.clientMessageId,3);});return;
    }
    if(type==='chat_read'){
      handleChatRead(this,payload).catch(error=>{recordOperationalError('direct_chat_read',error);chatError(this,'chat_read','server_unavailable','',3);});return;
    }
    if (type === 'social_get'){
      if (!this.requirePersistentUser()) return;
      this.sendText(JSON.stringify({ type:'social_state', payload:socialState(this.uid) }));
      return;
    }
    if (type === 'friend_request'){
      if (!this.requirePersistentUser()) return;
      socialSendRequest(this, payload && (payload.toUid || payload.uid));
      return;
    }
    if (type === 'friend_request_action'){
      if (!this.requirePersistentUser()) return;
      socialFriendRequestAction(this, payload || {});
      return;
    }
    if (type === 'friend_remove'){
      if (!this.requirePersistentUser()) return;
      socialRemoveFriend(this, payload && payload.uid);
      return;
    }
    if (type === 'block'){
      if (!this.requirePersistentUser()) return;
      socialBlock(this, payload && payload.uid);
      return;
    }
    if (type === 'unblock'){
      if (!this.requirePersistentUser()) return;
      socialUnblock(this, payload && payload.uid);
      return;
    }
    if (type === 'report'){
      if (!this.requirePersistentUser()) return;
      if (payload && payload.contextType === 'playline'){
        socialReportPlayline(this,payload).catch(error=>{recordOperationalError('playline_report',error);socialError(this,'动态举报暂不可用','server_unavailable');});
        return;
      }
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
      if (!r || !r.clients.has(this)){ this.sendText(JSON.stringify({ type: 'result_error', msg: '房间状态无效', reason: 'invalid_room_state' })); return; }
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
      if (this.room || this.spectatorRoom){ this.sendText(JSON.stringify({ type:'error', msg:'请先离开当前房间或观战', reason:'already_in_room' })); return; }
      const wantedGame = String(payload && payload.game || '');
      const candidate = lobbyPayload(this.uid).filter(item => item.canJoin && (!wantedGame || item.game === wantedGame))
        .sort((a, b) => (b.humanCount - a.humanCount) || (a.aiCount - b.aiCount) || String(a.room).localeCompare(String(b.room)))[0];
      if (!candidate){ this.sendText(JSON.stringify({ type:'quick_join_empty', payload:{ game:wantedGame || null } })); return; }
      this.joinRoom(candidate.room, false);
      return;
    }
    if (type === 'create'){
      if (!this.requireUser()) return;
      if (this.room) return;
      if (this.spectatorRoom) this.leaveSpectator();
      const testSandbox = testAdmin.hasCapability(this.uid, 'test_admin_sandbox_match');
      const roomAccess = testAdmin.roomAccess({ actorUid:this.uid, participantUids:[] });
      if (!roomAccess.ok){ this.sendText(JSON.stringify({ type:'error', msg:'测试管理员房间权限受限', reason:roomAccess.reason })); return; }
      let roomId = genCode();
      while (rooms.has(roomId)) roomId = genCode();
      const cap = Math.min(5, Math.max(2, parseInt(payload && payload.capacity, 10) || 2));
      const r = {
        id: roomId, host: this, clients: new Map([[this, 0]]), game: null, capacity: cap,
        seats:Array.from({length:cap}, (_, seatId) => seatId === 0 ? humanSeatFromSession(this, 0, true) : emptySeat(seatId)),
        visibility:testSandbox ? 'private' : normalizeRoomVisibility(payload && payload.visibility), allowSpectators:testSandbox ? false : payload && payload.allowSpectators !== false,
        testAdminSandbox:testSandbox,
        started: false, matchId: null, resultClaims: new Map(), settled: false, disputed: false,
        moveSeq: 0, moveLog: [], moveLogBytes: 0, moveLogTruncated: false,
        tankInputSeq: {}, tankAuthoritySeq: 0, tankFinalSent: false,
        startedAt: 0, rewardProgress: null, resultRewards: new Map(),
        spectators:new Map(), maxSpectators:Math.max(1,Math.min(50,Number(process.env.MAX_SPECTATORS)||12)),
        spectatorDelayMs:Math.max(0,Math.min(30000,Number(process.env.SPECTATOR_DELAY_MS)||0)), gameSnapshot:null,
        tetrisPresentation:new Map(),
      };
      const registered = roomPresenceBoundary.room({action:'register',room:r});
      if (!registered.ok){
        this.sendText(JSON.stringify({ type:'error', msg:'房间暂不可用', reason:registered.reason || 'room_registration_failed' }));
        return;
      }
      const member = (registered.members || []).find(item => item.sessionId === this.sessionId);
      if (!member){
        roomPresenceBoundary.room({action:'unregister',roomId});
        this.sendText(JSON.stringify({ type:'error', msg:'房间暂不可用', reason:'room_registration_failed' }));
        return;
      }
      this.sendText(JSON.stringify({ type:'created', room:roomId, player:member.player, capacity:cap, payload:roomPayload(r) }));
      broadcastRoom(r);
      broadcastLobby();
      return;
    }
    if (type === 'join'){
      if (!this.requireUser()) return;
      this.joinRoom(String((payload && payload.room) || '').trim().toUpperCase(), false);
      return;
    }
    if (type === 'spectate'){
      if (!this.requireUser()) return;
      if (this.room||this.player!==null){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'请先离开当前玩家席位', reason:'account_is_player' })); return; }
      const roomId = String(payload && payload.room || '').trim().toUpperCase();
      const target = rooms.get(roomId);
      if (!target){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'房间不存在', reason:'room_not_found' })); return; }
      const access = testAdmin.roomAccess({ actorUid:this.uid, participantUids:[...target.clients.keys()].map(c=>c.uid).filter(Boolean), roomTestOnly:target.testAdminSandbox === true, spectator:true });
      if (!access.ok){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'测试管理员房间与正式玩家隔离', reason:access.reason })); return; }
      if (!target.allowSpectators){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'该房间不存在或未开放观战', reason:'spectating_disabled' })); return; }
      if (this.uid && [...target.clients.keys()].some(c => c.uid && !socialAllowedBetween(this.uid, c.uid))){ this.sendText(JSON.stringify({ type:'social_error', msg:'你与房间内成员存在屏蔽关系，无法观战', payload:{ reason:'blocked' } })); return; }
      if (this.spectatorRoom) this.leaveSpectator();
      target.spectators = target.spectators instanceof Map ? target.spectators : new Map();
      if (target.spectators.size >= (target.maxSpectators || 20)){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'观众席已满', reason:'spectator_capacity' })); return; }
      target.spectators.set(this, { uid:this.uid, joinedAt:Date.now() });
      this.spectatorRoom = target.id;
      this.sendText(JSON.stringify({ type:'spectating', payload:{ ...spectatorSnapshot(target), spectator:true, player:null } }));
      broadcastRoom(target); broadcastLobby();
      return;
    }
    if (type === 'spectate_join'){
      if (!this.requireUser()) return;
      if (this.room||this.player!==null){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'已占用玩家席位，不能同时观战', reason:'account_is_player' })); return; }
      if (this.spectatorRoom){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'请先退出当前观战房间', reason:'already_spectating' })); return; }
      const roomId = String(payload && (payload.roomId || payload.room) || '').trim().toUpperCase();
      const target = rooms.get(roomId);
      if (!target){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'房间不存在', reason:'room_not_found' })); return; }
      const access = testAdmin.roomAccess({ actorUid:this.uid, participantUids:[...target.clients.keys()].map(c=>c.uid).filter(Boolean), roomTestOnly:target.testAdminSandbox === true, spectator:true });
      if (!access.ok){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'测试管理员房间与正式玩家隔离', reason:access.reason })); return; }
      if (!target.allowSpectators){ this.sendText(JSON.stringify({ type:'spectator_error', msg:'该房间未开放观战', reason:'spectating_disabled' })); return; }
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
      this.leaveSpectator(true);
      return;
    }
    if (type === 'tournament_create'){
      if (!this.requireUser()) return;
      let ids = Array.isArray(payload && payload.participants) ? payload.participants.map(String) : [];
      const gameId=String(payload && payload.gameId || '');
      const externalOwner = testAdmin.hasCapability(this.uid, 'tournament_create');
      if (externalOwner){
        const access = testAdmin.tournamentCreateAccess(this.uid, ids);
        if (!access.ok){ this.sendText(JSON.stringify({ type:'tournament_error', msg:'赛事参与者无效', reason:access.reason })); return; }
        ids = access.participantUids.slice();
      } else if (!ids.includes(this.uid) || ids.length < 3 || ids.some(uid=>!db.users[uid])){
        this.sendText(JSON.stringify({ type:'tournament_error', msg:'赛事参与者无效', reason:'invalid_participants' })); return;
      }
      if (ids.length < 3 || ids.some(uid=>!db.users[uid] || db.users[uid].ephemeral)){
        this.sendText(JSON.stringify({ type:'tournament_error', msg:'赛事参与者无效', reason:'invalid_participants' })); return;
      }
      try {
        const tournamentId='tour_'+crypto.randomBytes(9).toString('base64url');
        const guarded=tournamentGuard.create({tournamentId,ownerUid:this.uid,gameId,participants:ids,allowExternalOwner:externalOwner});
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
      if(!attached.ok){
        const rollback=tournamentGuard.unbindMatch(tournamentId,pairingId,{matchId:matchRoom.matchId,source:'server_rollback'});
        this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事桌位绑定失败',reason:rollback.ok?'pairing_bind_failed':'tournament_binding_rollback_failed'}));
        return;
      }
      matchRoom.tournamentBinding={tournamentId,pairingId,matchId:matchRoom.matchId,players:roomPlayers.slice()};
      broadcastTournament(entry);
      return;
    }
    if(type==='tournament_forfeit'||type==='tournament_recover'){
      if(!this.requireUser())return;
      const admin=isTournamentAdmin(this.uid);
      if(type==='tournament_recover'&&!admin){this.sendText(JSON.stringify({type:'tournament_error',msg:'只有赛事管理员可以执行恢复',reason:'admin_only'}));return;}
      const tournamentId=String(payload&&payload.tournamentId||''),pairingId=String(payload&&payload.pairingId||''),entry=tournaments.get(tournamentId),pairing=entry&&entry.tournament.pairings.find(item=>item.pairingId===pairingId);
      const room=pairing&&pairing.matchRoomId&&rooms.get(pairing.matchRoomId);
      if(!entry||!pairing||!room||!room.started||room.settled){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事桌当前没有可处理的进行中对局',reason:'recovery_match_unavailable'}));return;}
      const targetUid=String(payload&&payload.targetUid||(type==='tournament_forfeit'?this.uid:''));
      if(!pairing.players.includes(targetUid)){this.sendText(JSON.stringify({type:'tournament_error',msg:'判负目标不属于当前赛事桌',reason:'invalid_forfeit_target'}));return;}
      if(!admin&&targetUid!==this.uid){this.sendText(JSON.stringify({type:'tournament_error',msg:'参赛者只能为自己弃权',reason:'forfeit_target_forbidden'}));return;}
      const offender=[...room.clients.keys()].find(session=>session.uid===targetUid);
      if(!offender){this.sendText(JSON.stringify({type:'tournament_error',msg:'判负目标席位不存在',reason:'forfeit_target_unavailable'}));return;}
      settleRoomForfeit(room,offender,type==='tournament_recover'?'admin_recovery':'tournament_forfeit');broadcastTournament(entry);
      this.sendText(JSON.stringify({type:type==='tournament_recover'?'tournament_recovered':'tournament_forfeited',payload:{tournamentId,pairingId,targetUid}}));return;
    }
    if (['tournament_start','tournament_result','tournament_next','tournament_get'].includes(type)){
      if (!this.requireUser()) return;
      const tournamentId=String(payload && payload.tournamentId || '');
      const entry=tournaments.get(tournamentId);
      const guardState=entry&&tournamentGuard.snapshot(tournamentId);
      if (!entry || !guardState || ['expired','declined','cancelled'].includes(guardState.status) || (entry.ownerUid!==this.uid && !entry.tournament.participants.some(item=>item.id===this.uid))){ this.sendText(JSON.stringify({ type:'tournament_error', msg:'赛事不存在、已过期或无权访问', reason:'tournament_unavailable' })); return; }
      if(type==='tournament_result'){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事结果只能由已绑定的真实房间自动回传',reason:'server_result_required'}));return;}
      if (type!=='tournament_get' && entry.ownerUid!==this.uid){ this.sendText(JSON.stringify({ type:'tournament_error', msg:'只有赛事创建者可以推进赛事', reason:'owner_only' })); return; }
      let result={ok:true};
      if(type==='tournament_start'){
        const ready=tournamentParticipantSessions(entry);
        if(!ready.ok){this.sendText(JSON.stringify({type:'tournament_error',msg:'赛事无法自动建桌：'+ready.reason,reason:ready.reason}));return;}
        if(tournamentRoundCanRetry(entry,guardState)){
          const created=autoCreateTournamentRound(entry,ready);if(!created.ok)result=created;
        }else{
          result=tournamentGuard.start(tournamentId,this.uid);
          if(result.ok&&entry.tournament.start()===false)result={ok:false,reason:'invalid_status'};
          if(result.ok&&!registerTournamentPairings(entry))result={ok:false,reason:'pairing_registration_failed'};
          if(result.ok){const created=autoCreateTournamentRound(entry,ready);if(!created.ok)result=created;}
        }
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
    if (type === 'match_expression'){
      handleMatchExpression(this,payload);
      return;
    }
    if(type==='match_chat_send'){
      handleMatchChatSend(this,payload);
      return;
    }
    if(type==='match_chat_sync'){
      handleMatchChatSync(this,payload);
      return;
    }
    if (this.spectatorRoom){
      if (['move','bot_move','tank_input','bot_tank_input','tetris_lock_claim','tetris_attack_claim','tetris_ko_claim','tetris_action','xiangqi_action','monopoly_action','monopoly_auction_open','monopoly_bid','game_state','start','restart','end_game','select_game','ready','room_settings','add_ai','remove_ai'].includes(type)){
        this.sendText(JSON.stringify({ type:'spectator_error', msg:'观战模式为只读，不能发送游戏输入', reason:'spectator_readonly' }));
      }
      return;
    }
    if (!this.room) return;
    const r = rooms.get(this.room);
    if (!r) return;
    if (type === 'ready'){
      if (r.started) return;
      const seat = seatForSession(r, this);
      if (!seat || seat.type !== 'human') return;
      const changed = roomPresenceBoundary.room({action:'set_ready',room:r,session:this,ready:payload && payload.ready !== false});
      if (!changed.ok) return;
      broadcastRoom(r); broadcastLobby();
      return;
    }
    if (type === 'room_settings'){
      if (this !== r.host || r.started) return;
      if (r.testAdminSandbox){
        r.visibility = 'private';
        r.allowSpectators = false;
        this.sendText(JSON.stringify({ type:'error', msg:'测试沙盒固定为私有且不允许观战', reason:'test_admin_isolated' }));
        broadcastRoom(r); broadcastLobby();
        return;
      }
      if (payload && payload.visibility !== undefined) r.visibility = normalizeRoomVisibility(payload.visibility);
      if (payload && payload.allowSpectators !== undefined) r.allowSpectators = payload.allowSpectators === true;
      if (!r.allowSpectators && r.spectators instanceof Map){
        for (const spectator of r.spectators.keys()){
          spectatorAccessGuard.leave(spectator.sessionId);
          spectator.spectatorRoom = null;
          spectator.sendText(JSON.stringify({ type:'spectate_left', payload:{ room:r.id, reason:'disabled' } }));
        }
        r.spectators.clear();
      }
      broadcastRoom(r); broadcastLobby();
      return;
    }
    if (type === 'add_ai'){
      if (this !== r.host || r.started) return;
      const difficulty = normalizeAIDifficulty(payload && payload.difficulty);
      const persona = normalizeAIPersona(payload && payload.persona);
      const added = roomPresenceBoundary.room({action:'add_ai',room:r,session:this,difficulty,persona,ai:{nickname:AI_PERSONAS[persona].name || 'AI',avatar:141}});
      if (!added.ok){ this.sendText(JSON.stringify({ type:'error', msg:'没有可用的 AI 席位', reason:added.reason || 'no_ai_seat' })); return; }
      broadcastRoom(r); broadcastLobby();
      return;
    }
    if (type === 'remove_ai'){
      if (this !== r.host || r.started) return;
      const seatId = Number(payload && payload.seatId);
      const removed = roomPresenceBoundary.room({action:'remove_ai',room:r,session:this,seatId});
      if (!removed.ok) return;
      for (const item of removed.reassigned || []) {
        const session = [...(r.clients instanceof Map ? r.clients.keys() : [])].find(candidate => candidate && candidate.uid === item.uid && (!item.sessionId || candidate.sessionId === item.sessionId));
        if (session) session.sendText(JSON.stringify({type:'player_reassigned',payload:{player:item.player}}));
      }
      broadcastRoom(r); broadcastLobby();
      return;
    }
    const matchProtocolOutcome=matchProtocolBoundary.command({type,room:r,session:this,payload});
    if(matchProtocolOutcome.handled)return;
    if (type === 'invite'){
      if (this !== r.host) return;
      if (r.testAdminSandbox){ this.sendText(JSON.stringify({ type:'error', msg:'测试沙盒不开放正式邀请', reason:'test_admin_isolated' })); return; }
      const toUid = payload && payload.toUid;
      if (!toUid) return;
      if (!db.users[toUid] || db.users[toUid].ephemeral){
        this.sendText(JSON.stringify({ type: 'error', msg: '受邀玩家不存在', reason: 'invitee_missing' }));
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
      // A retried selection of the already active game is a protocol no-op.
      // READY commands arrive on each player's WebSocket independently; if a
      // duplicate host command reset seats, cross-socket delivery could erase
      // valid READY state that was accepted moments earlier.
      if (r.game === g){
        this.sendText(JSON.stringify({ type:'room_update', payload:roomPayload(r) }));
        return;
      }
      const curSize = activeSeatCount(r);
      if (!GAME_MAX[g] || curSize > GAME_MAX[g]){
        this.sendText(JSON.stringify({ type: 'error', msg: '该游戏最多支持 ' + (GAME_MAX[g] || 0) + ' 人，当前已加入 ' + curSize + ' 人', reason: 'game_capacity' }));
        return;
      }
      r.game = g;
      const reset = roomPresenceBoundary.room({action:'reset_ready',room:r,session:this});
      if (!reset.ok) return;
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
      const reset=resetRoomMatch(r);
      if(!reset.ok){this.sendText(JSON.stringify({type:'error',msg:'房间状态暂不可用',reason:reset.reason||'room_presence_unavailable'}));return;}
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
        this.sendText(JSON.stringify({ type:'error', msg:'请确认人数符合游戏规则且所有真人玩家都已 READY', reason:'room_not_ready' }));
        return;
      }
      if(!startRoomMatch(r))this.sendText(JSON.stringify({type:'error',msg:'房间状态暂不可用',reason:'room_presence_unavailable'}));
      return;
    }
    if (type === 'bot_move'){
      const seat = controlledAISeat(r, this, payload && payload.seatId);
      const move = payload && payload.payload;
      if (!seat || !r.started || ['tank','tetris'].includes(r.game) || !move || typeof move !== 'object'){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'bot-controller-v1', reason:'unauthorized_or_inactive' } }));
        return;
      }
      r.aiInputSeq = r.aiInputSeq || {};
      const seq = (Number(r.aiInputSeq[seat.seatId]) || 0) + 1;
      if (r.xiangqiRuleAuthority){
        const routed=matchProtocolBoundary&&matchProtocolBoundary.command({
          type:'xiangqi_action',room:r,session:this,player:seat.seatId,
          payload:{matchId:r.matchId,seq,from:move.from,to:move.to},
        });
        if(routed&&routed.handled){if(routed.ok)r.aiInputSeq[seat.seatId]=seq;return;}
        const accepted = r.xiangqiRuleAuthority.acceptMove(seat.seatId, { matchId:r.matchId, seq, from:move.from, to:move.to }, Date.now());
        if (!accepted.ok){ this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:PROTOCOL_VERSIONS.xiangqiRules, reason:accepted.reason } })); return; }
        r.aiInputSeq[seat.seatId] = seq;
        recordRoomAction(r,seat.seatId,{protocol:PROTOCOL_VERSIONS.xiangqiRules,from:move.from,to:move.to}); broadcast(r,accepted.event);
        if (accepted.result && !r.gameplayResultSent){ r.gameplayResultSent=true; broadcast(r,accepted.result); settleAuthoritativeRoom(r,accepted.result.order,'xiangqi_rule_authority'); stopRoomGameplayTimer(r); }
        return;
      }
      if (r.monopolyRuleAuthority){
        const action = Array.isArray(move.roll) ? { type:'roll' } : (['buy','pass','settle'].includes(move.decision) ? { type:move.decision } : null);
        if (!action){ this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:PROTOCOL_VERSIONS.monopolyRules, reason:'ERR_INVALID_MOVE' } })); return; }
        const routed=matchProtocolBoundary&&matchProtocolBoundary.command({
          type:'monopoly_action',room:r,session:this,player:seat.seatId,
          payload:{matchId:r.matchId,seq,action},
        });
        if(routed&&routed.handled){if(routed.ok)r.aiInputSeq[seat.seatId]=seq;return;}
        const accepted = r.monopolyRuleAuthority.acceptAction(seat.seatId, { matchId:r.matchId, seq, action }, Date.now());
        if (!accepted.ok){ this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:PROTOCOL_VERSIONS.monopolyRules, reason:accepted.reason } })); return; }
        r.aiInputSeq[seat.seatId] = seq;
        recordRoomAction(r,seat.seatId,{protocol:PROTOCOL_VERSIONS.monopolyRules,action}); broadcast(r,accepted.event);
        if (accepted.result && !r.gameplayResultSent){ r.gameplayResultSent=true; broadcast(r,accepted.result); settleAuthoritativeRoom(r,accepted.result.order,'monopoly_rule_authority'); stopRoomGameplayTimer(r); }
        return;
      }
      if (r.game === 'monopoly' && move.decision === 'settle') return;
      if (!relayRoomMove(r, seat.seatId, move, null)) this.sendText(JSON.stringify({ type:'error', msg:'AI 走子数据无效', reason:'invalid_bot_move' }));
      return;
    }
    if (type === 'bot_tank_input'){
      const seat = controlledAISeat(r, this, payload && payload.seatId);
      if (!seat || !r.started || r.game !== 'tank' || !r.tankAuthority){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:'unauthorized_bot' } })); return;
      }
      const acceptedAt=Date.now();
      const accepted = r.tankAuthority.acceptInput(seat.seatId, payload, acceptedAt);
      if (!accepted.ok){ this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:accepted.reason } })); return; }
      observeAcceptedTankInput(r,seat.seatId,'ai',tankEngagementActionClass(payload&&payload.input),acceptedAt,accepted.ack===1,
        r.testAdminSandbox===true||testAdmin.shouldHidePublicUid(this.uid));
      recordRoomAction(r, seat.seatId, { act:'input', input:payload && payload.input });
      return;
    }
    if (type === 'bot_tetris_action'){
      const seat = controlledAISeat(r, this, payload && payload.seatId);
      const authority = r.tetrisRuleAuthority;
      if (!seat || !r.started || r.game !== 'tetris' || !authority){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:PROTOCOL_VERSIONS.tetrisRules, reason:'unauthorized_bot' } })); return;
      }
      r.aiInputSeq = r.aiInputSeq || {};
      const seq = (Number(r.aiInputSeq[seat.seatId]) || 0) + 1;
      const routed=matchProtocolBoundary&&matchProtocolBoundary.command({
        type:'tetris_action',room:r,session:this,player:seat.seatId,
        payload:{matchId:r.matchId,seq,action:payload&&payload.action},
      });
      if(routed&&routed.handled){if(routed.ok)r.aiInputSeq[seat.seatId]=seq;return;}
      const accepted = authority.acceptAction(seat.seatId, { matchId:r.matchId, seq, action:payload && payload.action }, Date.now());
      if (!accepted.ok){ this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:PROTOCOL_VERSIONS.tetrisRules, reason:accepted.reason } })); return; }
      r.aiInputSeq[seat.seatId] = seq;
      recordRoomAction(r,seat.seatId,{protocol:PROTOCOL_VERSIONS.tetrisRules,action:payload && payload.action});
      if (accepted.battle) broadcast(r,{type:'tetris_rule_battle',payload:{matchId:r.matchId,revision:authority.revision,...accepted.battle}});
      broadcast(r,accepted.stateEvent || authority.stateEvent());
      if (accepted.result && !r.gameplayResultSent){ r.gameplayResultSent=true; broadcast(r,accepted.result); settleAuthoritativeRoom(r,accepted.result.order,'tetris_rule_authority'); stopRoomGameplayTimer(r); }
      return;
    }
    if (type === 'tank_input'){
      if (!r.started || r.game !== 'tank' || !r.tankAuthority){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:'not_active' } }));
        return;
      }
      const acceptedAt=Date.now();
      const accepted = r.tankAuthority.acceptInput(this.player, payload, acceptedAt);
      if (!accepted.ok){
        this.sendText(JSON.stringify({ type:'gameplay_error', payload:{ protocol:'tank-authority-v1', reason:accepted.reason } }));
        return;
      }
      observeAcceptedTankInput(r,this.player,'human',tankEngagementActionClass(payload&&payload.input),acceptedAt,accepted.ack===1,
        r.testAdminSandbox===true||testAdmin.shouldHidePublicUid(this.uid));
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
        }else if(Number.isInteger(next)&&next>=0&&next<activeSeatCount(r))r.monopolyTurn=next;
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
      r.monopolyTurn=Number.isInteger(next)&&next>=0&&next<activeSeatCount(r)&&next!==this.player?next:(r.monopolyTurn+1)%activeSeatCount(r);
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
      r.gameSnapshot = null;
      r.tetrisPresentation = new Map();
      r.matchExpressionSeen = new Map();
      r.matchExpressionRates = new Map();
      r.matchExpressionCounts = new Map();
      r.matchChatEvents = [];
      r.matchChatSeen = new Map();
      r.matchChatRates = new Map();
      r.matchChatCounts = new Map();
      r.tournamentBinding = null;
      r.finalResult = null;
      startRoomAuthorities(r);
      if (!r.testAdminSandbox) recordAnalytics('match_started', {
        matchId: r.matchId, game: r.game, mode: 'online',
        metadata: { participantCount:activeSeatCount(r), humanCount:humanRoomSeats(r).length, aiCount:aiRoomSeats(r).length, restarted:true },
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
    const access = testAdmin.roomAccess({ actorUid:this.uid, participantUids:[...r.clients.keys()].map(c=>c.uid).filter(Boolean), roomTestOnly:r.testAdminSandbox === true });
    if (!access.ok){ this.sendText(JSON.stringify({ type:'error', msg:'测试管理员房间与正式玩家隔离', reason:access.reason })); return; }
    if (this.spectatorRoom) this.leaveSpectator();
    const joined = roomPresenceBoundary.room({action:'join',room:r,session:this});
    if (!joined.ok){
      const messages = {
        room_not_found:'房间不存在', match_started:'对局已开始', room_full:'房间已满',
        selected_game_capacity:'当前已选择的游戏最多支持 ' + (GAME_MAX[r.game] || 0) + ' 人',
        duplicate_room_account:'同一账号不能重复加入同一房间', already_in_room:'你已在房间中',
      };
      if (joined.channel === 'social' || joined.reason === 'blocked'){
        this.sendText(JSON.stringify({type:'social_error',msg:'你与房间内成员存在屏蔽关系，无法加入该房间',payload:{reason:'blocked'}}));
      } else {
        this.sendText(JSON.stringify({type:'error',msg:messages[joined.reason] || '当前无法加入房间',reason:joined.reason}));
      }
      return;
    }
    const idx = joined.player;
    this.sendText(JSON.stringify({ type:'joined', room:roomId, player:idx, payload:roomPayload(r) }));
    broadcastRoom(r);
    if (fromInvite) r.host.sendText(JSON.stringify({ type: 'invite_result', payload: { accepted: true } }));
    broadcastLobby();
    maybeAutoStart(r);
  }
  leaveRoom(options={}){
    if (!this.room) return true;
    const r = rooms.get(this.room);
    if (!r){ return roomPresenceBoundary.room({action:'retire_session',session:this,allowUnregistered:true}).ok; }
    const wasHost = this === r.host;
    const departedPlayer = r.clients.get(this);
    if (r.started && !r.settled) settleRoomForfeit(r, this, 'forfeit');
    forgetTankSnapshotRecipient(r,this);
    const membership = roomPresenceBoundary.room({action:'remove',room:r,session:this,deleteWhenEmpty:true,allowUnregistered:true});
    if (!membership.ok){
      if(options.quarantineSweep===true)return false;
      const attempts=Number(this.roomPresenceRetryAttempts)||0;
      if(attempts>=ROOM_PRESENCE_RETRY_LIMIT){
        this.roomRemovalRetryTimer=null;this.roomRemovalQuarantined=true;r.presenceQuarantined=true;
        enqueueRoomGraphRecovery('leave:'+this.sessionId,{
          room:r,
          recover:()=>this.leaveRoom({quarantineSweep:true}),
          onRecovered:()=>{this.roomRemovalQuarantined=false;if(![...roomGraphRecoveryQueue.values()].some(record=>record.room===r))r.presenceQuarantined=false;},
        });
        if(this.alive)this.sendText(JSON.stringify({type:'error',msg:'房间状态已进入安全恢复队列',reason:'room_presence_quarantined'}));
        broadcast(r,{type:'error',msg:'房间状态已进入安全恢复队列',reason:'room_presence_quarantined'});
        return false;
      }
      this.roomPresenceRetryAttempts=attempts+1;
      scheduleRoomRemovalRetryTimer(this,r,roomPresenceRetryDelay(attempts+1));
      return false;
    }
    cancelRoomRemovalRetryTimer(this);
    this.roomPresenceRetryAttempts=0;this.roomRemovalQuarantined=false;
    if (membership.closed){
      const spectators = r.spectators ? [...r.spectators.keys()] : [];
      for (const spectator of spectators){
        spectatorAccessGuard.leave(spectator.sessionId);
        spectator.spectatorRoom = null;
        spectator.sendText(JSON.stringify({ type:'peer_left', payload:{ roomClosed:true, player:departedPlayer } }));
      }
      stopRoomAuthorities(r);
      broadcastLobby();
      cleanupEphemeralUser(this.uid);
      return true;
    }
    const hostChanged = !!membership.hostChanged || wasHost;
    const reset=resetRoomMatch(r);
    if(!reset.ok)broadcast(r,{type:'error',msg:'房间状态暂不可用',reason:reset.reason||'room_presence_unavailable'});
    notifyRoomReassignments(r,membership.reassigned);
    broadcast(r, { type:'peer_left', payload:{ roomClosed:false, player:departedPlayer } });
    if (hostChanged) broadcast(r, { type:'host_changed', payload:{ uid:r.host.uid, player:r.clients.get(r.host) } });
    broadcastRoom(r);
    broadcastLobby();
    return true;
  }
  leaveSpectator(notify){
    if(!this.spectatorRoom)return;
    const roomId=this.spectatorRoom,r=rooms.get(roomId);this.spectatorRoom=null;
    spectatorAccessGuard.leave(this.sessionId);
    if(r&&r.spectators){forgetTankSnapshotRecipient(r,this);r.spectators.delete(this);broadcastRoom(r);broadcastLobby();}
    if(notify&&this.alive)this.sendText(JSON.stringify({type:'spectate_left',payload:{room:roomId}}));
  }
  close(intentional){
    if (!this.alive) return;
    const uid = this.uid;
    this.alive = false;
    sessions.delete(this);
    if(this.spectatorRoom)this.leaveSpectator();
    const retained = !intentional && detachForReconnect(this);
    if (!retained){ cancelReconnectTimer(this); this.leaveRoom(); }
    try { this.socket.destroy(); } catch {}
    if (!retained) scheduleEphemeralCleanup(uid,60000);
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

const HEARTBEAT_SWEEP_TIMER_OWNER='heartbeat-sweep';
const HEARTBEAT_SWEEP_INTERVAL_MS=Math.min(10000,Math.max(1000,Math.floor(HEARTBEAT_TIMEOUT_MS/4)));
const heartbeatSweepIsolation=createHeartbeatSweepIsolation({
  recordError:recordOperationalError,
  recordFallback:()=>incrementGameplayMetric('serverErrors'),
});
const heartbeatSweep=serverClockTimer.schedule({
  owner:HEARTBEAT_SWEEP_TIMER_OWNER,
  delayMs:HEARTBEAT_SWEEP_INTERVAL_MS,
  repeat:true,
  run:({now})=>{
    for (const session of [...sessions]){
      heartbeatSweepIsolation.run('heartbeat_session_sweep',()=>{
        const user=session.uid&&db.users[session.uid];
        if(user&&user.ephemeral&&Number(user.guestExpiresAt||0)<=now){
          heartbeatSweepIsolation.run('heartbeat_guest_expiry_notify',()=>session.sendText(JSON.stringify({type:'auth_error',msg:'访客会话已到期',reason:'session_expired'})));
          heartbeatSweepIsolation.run('heartbeat_guest_expiry_close',()=>session.close(true));
          heartbeatSweepIsolation.run('heartbeat_guest_expiry_cleanup',()=>scheduleEphemeralCleanup(user.uid,1000));
          return;
        }
        if(session.alive&&now-session.lastSeen>=HEARTBEAT_TIMEOUT_MS){
          heartbeatSweepIsolation.run('heartbeat_session_timeout_close',()=>session.close());
        }
      });
    }
    for(const room of rooms.values()){
      heartbeatSweepIsolation.run('heartbeat_room_idle_sweep',()=>{
        if(!room.started||room.settled)return;
        const progress=roomProgress(room);
        if(now-Number(progress.lastActionAt||progress.startedAt||now)>=MATCH_IDLE_TIMEOUT_MS){
          settleRoomNoContest(room,'afk_timeout');
          recordAnalytics('match_afk',{matchId:room.matchId,game:room.game,mode:'online',metadata:{roomWide:true}});
        }
      });
    }
    heartbeatSweepIsolation.run('heartbeat_tournament_cleanup',()=>tournamentGuard.cleanup(now));
    for(const [tournamentId,entry] of tournaments){
      heartbeatSweepIsolation.run('heartbeat_tournament_sweep',()=>{
        const state=tournamentGuard.snapshot(tournamentId,now);
        if(!state||['expired','declined','cancelled'].includes(state.status)||
            (state.status==='finished'&&now-Number(state.lastActivityAt||0)>60*60*1000)){
          if(state)broadcastTournament(entry);
          tournaments.delete(tournamentId);
        }
      });
    }
    heartbeatSweepIsolation.run('heartbeat_resume_expiry_sweep',()=>clearExpiredResumes(now));
  },
});
if(!heartbeatSweep.ok)recordOperationalError('heartbeat_sweep_schedule',new Error(heartbeatSweep.reason||'clock_timer_unavailable'));

const metricsHistorySweep=serverClockTimer.schedule({
  owner:'operational-metrics-history',
  delayMs:METRICS_HISTORY_INTERVAL_MS,
  repeat:true,
  run:()=>{
    try{const snapshot=operationalMetricsBoundary.capture(false);if(clusterCoordinator.enabled)clusterCoordinator.recordMetrics(snapshot);}catch(error){recordOperationalError('metrics_history_capture',error);}
  },
});
if(!metricsHistorySweep.ok)recordOperationalError('metrics_history_schedule',new Error(metricsHistorySweep.reason));
server.once('close',()=>serverClockTimer.dispose());

async function bootstrapConfiguredTestAdmin(){
  if (!testAdmin.enabled) return;
  const boot = await testAdmin.bootstrap({
    users:db.users,
    createStarterUser:testAdminStarterUser,
    persist:()=>{ saveDB(); return true; },
  });
  if (!boot.ok) throw new Error(TestAdmin.TEST_ADMIN_REASON);
  const adminUser = db.users[testAdmin.uid];
  let remotePersisted = true;
  if (boot.created) remotePersisted = await sbCreateProfile(adminUser);
  else if (boot.passwordUpdated) remotePersisted = await sbSyncAuthProfile(adminUser);
  if (useSupabase && remotePersisted !== true) throw new Error(TestAdmin.TEST_ADMIN_REASON);
}
sbLoadProfiles().then(bootstrapConfiguredTestAdmin).then(() => clusterCoordinator.start()).then(() => server.listen(PORT, () => {
  try{const snapshot=operationalMetricsBoundary.capture(true);if(clusterCoordinator.enabled)clusterCoordinator.recordMetrics(snapshot);}catch(error){recordOperationalError('metrics_initial_capture',error);}
  console.log('小游戏合集在线服务已启动: http://localhost:' + PORT + (useSupabase ? '（Supabase 数据库已连接）' : '（本地 JSON 存储）'));
})).catch(error => {
  serverClockTimer.dispose();
  console.error('测试管理员启动引导失败（reason=' + TestAdmin.TEST_ADMIN_REASON + '）');
  process.exitCode = 1;
});
// outbox 失败后不依赖下一次重启；同一 resultId 的 RPC 是幂等的，可安全重试。
if (useSupabase){
  const rewardSyncSweep = setInterval(() => { if(clusterCoordinator.isLeader())retryPendingRewardSync(); }, REWARD_SYNC_RETRY_MS);
  if (rewardSyncSweep.unref) rewardSyncSweep.unref();
  const aiLearningSyncSweep = setInterval(() => { if(clusterCoordinator.isLeader())retryPendingAILearningSync(); }, REWARD_SYNC_RETRY_MS);
  if (aiLearningSyncSweep.unref) aiLearningSyncSweep.unref();
}
