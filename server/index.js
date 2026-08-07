// 小游戏合集在线服务：静态文件 + WebSocket 房间中继（零依赖，手写 RFC6455）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  tictactoe: '井字棋', gomoku: '五子棋', ludo: '飞行棋', monopoly: '大富翁', checker: '弹珠跳棋',
  tank: '坦克大战', snake: '贪吃蛇', tetris: '俄罗斯方块', draughts: '跳棋', jungle: '斗兽棋', xiangqi: '象棋',
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
const MOVE_LOG_MAX_EVENTS = Math.max(100, Math.min(20000, Number(process.env.MOVE_LOG_MAX_EVENTS) || 5000));
const MOVE_LOG_MAX_BYTES = Math.max(262144, Math.min(16 * 1024 * 1024, Number(process.env.MOVE_LOG_MAX_BYTES) || 4 * 1024 * 1024));
const expiredResumes = new Map(); // uid|tokenHash -> { room, player, expiresAt }
const GAME_MAX = { tictactoe: 2, gomoku: 2, ludo: 4, monopoly: 5, checker: 5, tank: 2, snake: 4, tetris: 4, draughts: 2, jungle: 2, xiangqi: 2 };
const GAME_MIN = { tictactoe: 2, gomoku: 2, ludo: 2, monopoly: 2, checker: 2, tank: 2, snake: 2, tetris: 2, draughts: 2, jungle: 2, xiangqi: 2 };

const PROTOCOL_VERSION = 1;
function levelFromXp(xp){
  xp = Math.max(0, xp || 0);
  if (xp < 30) return 1;
  if (xp < 80) return 2;
  if (xp < 160) return 3;
  if (xp < 280) return 4;
  return 5 + Math.floor((xp - 280) / 150);
}

/* ---------------- Supabase 数据库（可选，配置环境变量后启用） ---------------- */
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
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
async function sbLoadProfiles(){
  if (!useSupabase) return;
  try {
    const rows = await sbFetch('profiles?select=*&order=coins.desc&limit=5000');
    const users = {};
    for (const r of (Array.isArray(rows) ? rows : [])){
      users[r.uid] = {
        uid: r.uid, name: r.name, avatar: r.avatar, coins: r.coins || 0, xp: r.xp || 0, level: r.level || 1, streak: r.streak || 0, bestStreak: r.best_streak || 0, played: r.played || {}, total: r.total || 0,
        background: r.background || 0, frame: r.frame || 0, effect: r.effect || 0,
        owned: normalizeOwned(r.owned),
        pin_hash: r.pin_hash || null, lang: r.lang || 'zh-CN',
        achievements: r.achievements || [], playmates: r.playmates || {}, daily: r.daily || { play: 0, win: 0, streak: 0 }, dailyKey: r.daily_key || '', nameFx: r.name_fx || 0,
        authTokens: normalizeAuthTokenRecords(r.auth_tokens),
        recentResults: Array.isArray(r.recent_results) ? r.recent_results.map(String).slice(-500) : [],
        purchaseRequests: Array.isArray(r.purchase_requests) ? r.purchase_requests.map(String).slice(-100) : [],
        soloRate: Array.isArray(r.solo_rate) ? r.solo_rate.map(Number).filter(Number.isFinite).slice(-100) : [],
      };
    }
    const localOnly = Object.values(db.users).filter(u => u && u.uid && !users[u.uid] && !u.ephemeral);
    db.users = { ...db.users, ...users };
    if (localOnly.length) await Promise.all(localOnly.map(u => sbSyncProfile(u)));
    console.log('已从 Supabase 加载 ' + Object.keys(users).length + ' 位玩家');
  } catch (e) {
    console.error('加载 Supabase 数据失败（继续使用本地数据）:', e.message);
  }
}
function sbSyncProfile(u){
  if (!useSupabase || !u || u.ephemeral) return Promise.resolve();
  const uid = u.uid;
  const body = JSON.stringify({
    uid: u.uid, name: u.name, avatar: u.avatar, coins: u.coins, xp: u.xp || 0, level: u.level || 1, streak: u.streak || 0, best_streak: u.bestStreak || 0, played: u.played, total: u.total,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: normalizeOwned(u.owned),
    pin_hash: u.pin_hash || null, lang: u.lang || 'zh-CN',
    achievements: u.achievements || [], playmates: u.playmates || {}, daily: u.daily || { play: 0, win: 0, streak: 0 }, daily_key: u.dailyKey || '', name_fx: u.nameFx || 0,
    auth_tokens: Array.isArray(u.authTokens) ? u.authTokens.slice(-5) : [],
    recent_results: Array.isArray(u.recentResults) ? u.recentResults.slice(-500) : [],
    purchase_requests: Array.isArray(u.purchaseRequests) ? u.purchaseRequests.slice(-100) : [],
    solo_rate: Array.isArray(u.soloRate) ? u.soloRate.slice(-100) : [],
    updated_at: new Date().toISOString(),
  });
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
async function sbAddHistory(uid, game, coins, meta = {}){
  if (!useSupabase || (db.users[uid] && db.users[uid].ephemeral)) return;
  try {
    await sbFetch('history', {
      method: 'POST',
      body: JSON.stringify([{
        uid, game, coins,
        result_id: meta.resultId || null,
        match_id: meta.matchId || null,
        mode: meta.mode || 'online',
        created_at: new Date().toISOString(),
      }]),
    });
  } catch (e) { console.error('Supabase 写入历史失败:', e.message); }
}

/* ---------------- 排行榜持久化（JSON 文件） ---------------- */
let db = { users: {}, history: [] };
function loadDB(){
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    db = { users: parsed.users || {}, history: parsed.history || [] };
  } catch { db = { users: {}, history: [] }; }
  for (const [uid, u] of Object.entries(db.users)){
    u.uid = u.uid || uid;
    if (u.coins === undefined) u.coins = u.points || 0;
    delete u.points;
    if (!u.played) u.played = {};
    if (!u.total) u.total = 0;
    u.owned = normalizeOwned(u.owned);
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
  }
}
function saveDB(){
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  const users = Object.fromEntries(Object.entries(db.users).filter(([, u]) => !u.ephemeral));
  const history = db.history.filter(h => !h.ephemeral && (!db.users[h.uid] || !db.users[h.uid].ephemeral));
  fs.writeFileSync(tmp, JSON.stringify({ users, history }, null, 2));
  fs.renameSync(tmp, DB_FILE);
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
        coins: u.coins || 0, xp: u.xp || 0, level: u.level || 1, streak: u.streak || 0, bestStreak: u.bestStreak || 0, played: u.played || {}, total: u.total || 0, lang: u.lang || 'zh-CN', online: onlineUids.has(uid),
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
    if (r.started || r.clients.size >= joinLimit) continue;
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
  return { room: r.id, game: r.game || null, capacity: r.capacity, players, size: r.clients.size, onlineSize: players.filter(p => p.online).length, started: !!r.started, matchId: r.matchId || null };
}
function broadcastRoom(r){
  const text = JSON.stringify({ type: 'room_update', payload: roomPayload(r) });
  for (const c of r.clients.keys()) c.sendText(text);
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
  saveDB();
}
function resetRoomMatch(r){
  r.started = false;
  r.matchId = null;
  r.resultClaims = new Map();
  r.settled = false;
  r.disputed = false;
  r.moveSeq = 0;
  r.moveLog = [];
  r.moveLogBytes = 0;
  r.moveLogTruncated = false;
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
  const wasHost = r.host === oldSession;
  r.clients.delete(oldSession);
  oldSession.room = null;
  oldSession.player = null;
  oldSession.resumeUntil = 0;
  oldSession.reconnectTimer = null;
  expiredResumes.set(resumeKey(uid, oldSession.tokenHash), {
    room: r.id, player, expiresAt: Date.now() + EXPIRED_RESUME_TTL_MS,
  });
  if (!r.clients.size){ rooms.delete(r.id); cleanupEphemeralUser(uid); broadcastLobby(); return; }
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
      const replayUnavailable = !!(r.started && r.moveLogTruncated);
      if (replayUnavailable) resetRoomMatch(r);
      const payload = {
        ...roomPayload(r),
        player,
        isHost: r.host === session,
        moveSeq: r.moveSeq || 0,
        moveLog: (r.moveLog || []).map(e => ({ seq: e.seq, player: e.player, payload: e.payload })),
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
  avatars: { 30:8,31:10,32:10,33:12,34:15,35:15,36:6,37:6,38:8,39:8,40:10,41:12,42:8,43:8,44:10,45:10,46:12,47:12,48:8,49:10,50:10,51:12,52:15,53:15,54:8,55:20 },
  frames: { 1:5,2:8,3:12,4:16,5:18,6:22,7:26,8:30 },
  effects: { 1:6,2:9,3:9,4:15 },
  backgrounds: { 1:3,2:3,3:3,4:3,5:3,6:5,7:10,8:10,9:14,10:12 },
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
  return {
    uid: u.uid, name: u.name, avatar: u.avatar,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: u.owned || { avatars: [], frames: [], effects: [], backgrounds: [] },
    coins: u.coins || 0, xp: u.xp || 0, level: u.level || 1, streak: u.streak || 0, bestStreak: u.bestStreak || 0,
    played: u.played || {}, total: u.total || 0, lang: u.lang || 'zh-CN',
    achievements: u.achievements || [], playmates: u.playmates || {}, daily: u.daily || { play: 0, win: 0, streak: 0 }, nameFx: u.nameFx || 0,
  };
}
function publicProfileObj(u){
  const p = profileObj(u);
  delete p.owned;
  delete p.playmates;
  delete p.daily;
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
}
function addServerAchievement(u, id){
  if (!Array.isArray(u.achievements)) u.achievements = [];
  if (!u.achievements.includes(id)) u.achievements.push(id);
}
function updateServerAchievements(u){
  if ((u.total || 0) >= 1 && (u.coins || 0) >= 1) addServerAchievement(u, 'first_win');
  if ((u.coins || 0) >= 10) addServerAchievement(u, 'win_10');
  if ((u.coins || 0) >= 50) addServerAchievement(u, 'win_50');
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
function applyVerifiedProgress(u, game, won, meta){
  const coins = won ? 1 : 0;
  u.coins = (u.coins || 0) + coins;
  u.xp = (u.xp || 0) + (won ? 10 : 4);
  u.level = levelFromXp(u.xp);
  if (won){
    u.streak = (u.streak || 0) + 1;
    u.bestStreak = Math.max(u.bestStreak || 0, u.streak);
  } else {
    u.streak = 0;
  }
  if (!u.played) u.played = {};
  u.played[game] = (u.played[game] || 0) + 1;
  u.total = (u.total || 0) + 1;
  updateServerDaily(u, won);
  updateServerAchievements(u);
  const at = Date.now();
  const row = { uid: u.uid, game, coins, at, resultId: meta.resultId || null, matchId: meta.matchId || null, mode: meta.mode || 'online', ephemeral: !!u.ephemeral };
  db.history.push(row);
  return row;
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
  broadcast(r, { type: 'started', game: r.game, size: r.clients.size, players: [...r.clients.values()].sort((a, b) => a - b), matchId: r.matchId });
  broadcastLobby();
}
function normalizeRoomResults(value, size){
  if (!Array.isArray(value)) return null;
  const bySlot = new Map();
  for (const item of value){
    const slot = Number(item && item.slot);
    if (!Number.isInteger(slot) || slot < 0 || slot >= size || bySlot.has(slot)) return null;
    bySlot.set(slot, { slot, coins: item && item.coins === 1 ? 1 : 0, rank: Number.isInteger(item && item.rank) ? item.rank : null });
  }
  if (bySlot.size !== size) return null;
  const out = [...bySlot.values()].sort((a, b) => a.slot - b.slot);
  if (out.filter(x => x.coins === 1).length > 1) return null;
  return out;
}
function roomResultError(r, msg){
  for (const c of r.clients.keys()) c.sendText(JSON.stringify({ type: 'result_error', msg, matchId: r.matchId }));
}
function settleRoomResult(r, results){
  if (r.settled || r.disputed) return;
  r.settled = true;
  const participants = [...r.clients.entries()].map(([session, slot]) => ({ session, slot, user: session.uid && db.users[session.uid] })).filter(x => x.user);
  for (const p of participants){
    const mine = results.find(x => x.slot === p.slot);
    const others = participants.filter(x => x !== p).map(x => x.user);
    for (const other of others) recordServerPlaymate(p.user, other, r.game);
    updateServerAchievements(p.user);
    const resultMeta = { matchId: r.matchId, resultId: r.matchId + ':' + p.slot, mode: 'online' };
    applyVerifiedProgress(p.user, r.game, !!(mine && mine.coins === 1), resultMeta);
    p.resultMeta = resultMeta;
    p.resultCoins = mine && mine.coins === 1 ? 1 : 0;
    p.user.recentResults = (p.user.recentResults || []).concat(r.matchId + ':' + p.slot).slice(-500);
  }
  if (db.history.length > 1000) db.history = db.history.slice(-500);
  saveDB();
  for (const p of participants){
    sbSyncProfile(p.user).then(ok => { if (ok !== false) return sbAddHistory(p.user.uid, r.game, p.resultCoins, p.resultMeta); });
    p.session.sendText(JSON.stringify({ type: 'result_ok', matchId: r.matchId, payload: { profile: profileObj(p.user) } }));
  }
  broadcastLeaderboard();
}
function submitRoomResult(session, payload, r){
  if (!r.started || !r.matchId || r.disputed){ session.sendText(JSON.stringify({ type: 'result_error', msg: '当前没有可结算的对局' })); return; }
  const matchId = String(payload && payload.matchId || '');
  if (matchId !== r.matchId){ session.sendText(JSON.stringify({ type: 'result_error', msg: '对局标识已失效' })); return; }
  const game = String(payload && payload.game || '');
  if (game !== r.game){ session.sendText(JSON.stringify({ type: 'result_error', msg: '游戏标识不匹配' })); return; }
  const normalized = normalizeRoomResults(payload && payload.results, r.clients.size);
  if (!normalized){ session.sendText(JSON.stringify({ type: 'result_error', msg: '结算数据无效' })); return; }
  const digest = JSON.stringify(normalized.map(x => ({ slot: x.slot, coins: x.coins, rank: x.rank })));
  const previous = r.resultClaims.get(session.player);
  if (previous){
    if (previous.digest !== digest) session.sendText(JSON.stringify({ type: 'result_error', msg: '同一玩家重复提交了冲突结果' }));
    else if (r.settled) session.sendText(JSON.stringify({ type: 'result_ok', matchId: r.matchId, payload: { profile: profileObj(db.users[session.uid]) } }));
    else session.sendText(JSON.stringify({ type: 'result_pending', matchId: r.matchId }));
    return;
  }
  r.resultClaims.set(session.player, { digest, results: normalized });
  if (r.resultClaims.size < r.clients.size){ session.sendText(JSON.stringify({ type: 'result_pending', matchId: r.matchId })); return; }
  const claims = [...r.resultClaims.values()];
  if (new Set(claims.map(c => c.digest)).size !== 1){
    r.disputed = true;
    roomResultError(r, '双方结算结果不一致，本局未计入排行榜');
    return;
  }
  settleRoomResult(r, claims[0].results);
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
}

class Session {
  constructor(socket, req){
    this.socket = socket;
    this.ip = requestIp(req || { headers: {}, socket });
    this.room = null;
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
      } else {
        this.uid = null;
        this.tokenHash = null;
      }
      this.sendText(JSON.stringify({ type: 'hello_ack', proto: PROTOCOL_VERSION, authenticated: !!this.uid }));
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
        owned: starterOwned,
        xp: 0, level: 1, streak: 0, bestStreak: 0, coins: 0, played: {}, total: 0,
        recentResults: [], purchaseRequests: [], soloRate: [], pin_hash: ph,
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
      if (ownsItem(u, category, id)){
        if (requestId) u.purchaseRequests = u.purchaseRequests.concat(requestId).slice(-100);
        saveDB(); sbSyncProfile(u);
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
      this.uid = null; this.tokenHash = null;
      saveDB(); sbSyncProfile(u);
      this.sendText(JSON.stringify({ type: 'logged_out' }));
      broadcastLeaderboard(); broadcastLobby();
      cleanupEphemeralUser(u.uid);
      return;
    }
    if (type === 'result'){
      const user = this.requireUser();
      if (!user) return;
      if (!this.room){
        const solo = payload && !Array.isArray(payload) && payload.mode === 'solo' ? payload : null;
        const game = String(solo && solo.game || '');
        const resultId = String(solo && solo.resultId || '');
        const coins = solo && solo.coins === 1 ? 1 : 0;
        if (!solo || !Object.prototype.hasOwnProperty.call(GAME_NAMES, game) || !/^solo_[A-Za-z0-9_-]{8,120}$/.test(resultId)){
          this.sendText(JSON.stringify({ type: 'result_error', msg: '排行榜结算必须绑定有效对局' }));
          return;
        }
        user.recentResults = Array.isArray(user.recentResults) ? user.recentResults : [];
        if (user.recentResults.includes(resultId)){
          this.sendText(JSON.stringify({ type: 'result_ok', payload: { profile: profileObj(user), resultId } }));
          return;
        }
        const now = Date.now();
        user.soloRate = (Array.isArray(user.soloRate) ? user.soloRate : [])
          .map(Number).filter(Number.isFinite).filter(t => now - t < 3600000);
        if (user.soloRate.length >= 60){
          this.sendText(JSON.stringify({ type: 'result_error', msg: '单机结算已达到每小时上限，请稍后再试' }));
          return;
        }
        const resultMeta = { resultId, mode: 'solo' };
        applyVerifiedProgress(user, game, coins === 1, resultMeta);
        user.soloRate.push(now);
        user.recentResults.push(resultId);
        user.recentResults = user.recentResults.slice(-500);
        if (db.history.length > 1000) db.history = db.history.slice(-500);
        saveDB();
        sbSyncProfile(user).then(ok => { if (ok !== false) return sbAddHistory(user.uid, game, coins, resultMeta); });
        this.sendText(JSON.stringify({ type: 'result_ok', payload: { profile: profileObj(user), resultId } }));
        broadcastLeaderboard();
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
      if (this.room) return;
      let roomId = genCode();
      while (rooms.has(roomId)) roomId = genCode();
      const cap = Math.min(5, Math.max(2, parseInt(payload && payload.capacity, 10) || 2));
      const r = {
        id: roomId, host: this, clients: new Map([[this, 0]]), game: null, capacity: cap,
        started: false, matchId: null, resultClaims: new Map(), settled: false, disputed: false,
        moveSeq: 0, moveLog: [], moveLogBytes: 0, moveLogTruncated: false,
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
    if (type === 'leave'){
      if (!this.requireUser()) return;
      this.leaveRoom();
      return;
    }
    if (!this.requireUser()) return;
    if (!this.room) return;
    const r = rooms.get(this.room);
    if (!r) return;
    if (type === 'invite'){
      if (this !== r.host) return;
      const toUid = payload && payload.toUid;
      if (!toUid) return;
      if (!db.users[toUid] || db.users[toUid].ephemeral){
        this.sendText(JSON.stringify({ type: 'error', msg: '受邀玩家不存在' }));
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
        this.sendText(JSON.stringify({ type: 'error', msg: '该游戏最多支持 ' + (GAME_MAX[g] || 0) + ' 人，当前已加入 ' + curSize + ' 人' }));
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
      r.started = false;
      r.game = null;
      r.matchId = null;
      r.resultClaims = new Map();
      r.settled = false;
      r.disputed = false;
      r.moveSeq = 0;
      r.moveLog = [];
      r.moveLogBytes = 0;
      r.moveLogTruncated = false;
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
        this.sendText(JSON.stringify({ type: 'error', msg: '请等待掉线玩家恢复连接后再开始' }));
        return;
      }
      startRoomMatch(r);
      return;
    }
    if (type === 'move'){
      if (!r.started) return;
      if (r.game === 'tictactoe'){
        if (!Number.isInteger(payload) || payload < 0 || payload > 8) return;
      } else if (!payload || typeof payload !== 'object'){
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
      broadcast(r, { type: 'move', payload, seq: event.seq, player: event.player }, this);
      return;
    }
    if (type === 'restart'){
      if (this !== r.host) return;
      if (!r.game || !r.started) return;
      r.matchId = crypto.randomBytes(12).toString('base64url');
      r.resultClaims = new Map();
      r.settled = false;
      r.disputed = false;
      r.moveSeq = 0;
      r.moveLog = [];
      r.moveLogBytes = 0;
      r.moveLogTruncated = false;
      broadcast(r, { type: 'restart', matchId: r.matchId });
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
    if (r.clients.size >= r.capacity){
      this.sendText(JSON.stringify({ type: 'error', msg: '房间已满' }));
      return;
    }
    if (r.game && GAME_MAX[r.game] && r.clients.size + 1 > GAME_MAX[r.game]){
      this.sendText(JSON.stringify({ type: 'error', msg: '当前已选择的游戏最多支持 ' + GAME_MAX[r.game] + ' 人' }));
      return;
    }
    if (this.uid && [...r.clients.keys()].some(c => c.uid === this.uid)){
      this.sendText(JSON.stringify({ type: 'error', msg: '同一账号不能重复加入同一房间' }));
      return;
    }
    if (this.room){
      this.sendText(JSON.stringify({ type: 'error', msg: '你已在房间中' }));
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
    r.clients.delete(this);
    this.room = null;
    this.player = null;
    if (wasHost){
      const remaining = [...r.clients.keys()];
      for (const c of remaining){
        if (c.reconnectTimer) clearTimeout(c.reconnectTimer);
        c.reconnectTimer = null;
        c.room = null;
        c.player = null;
        c.resumeUntil = 0;
        c.sendText(JSON.stringify({ type: 'peer_left', payload: { roomClosed: true, player: departedPlayer } }));
      }
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
  close(intentional){
    if (!this.alive) return;
    const uid = this.uid;
    this.alive = false;
    sessions.delete(this);
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
  clearExpiredResumes();
}, Math.min(10000, Math.max(1000, Math.floor(HEARTBEAT_TIMEOUT_MS / 4))));
if (heartbeatSweep.unref) heartbeatSweep.unref();

sbLoadProfiles().finally(() => {
  server.listen(PORT, () => {
    console.log('小游戏合集在线服务已启动: http://localhost:' + PORT + (useSupabase ? '（Supabase 数据库已连接）' : '（本地 JSON 存储）'));
  });
});
