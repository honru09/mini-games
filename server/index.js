// 小游戏合集在线服务：静态文件 + WebSocket 房间中继（零依赖，手写 RFC6455）
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT) || 8080;
const PUBLIC = path.join(__dirname, '..', 'public');
const DATA_DIR = path.join(__dirname, '..', 'data');
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
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};
const GAME_NAMES = {
  tictactoe: '井字棋', gomoku: '五子棋', ludo: '飞行棋', monopoly: '大富翁', checker: '弹珠跳棋',
  tank: '坦克大战', snake: '贪吃蛇', tetris: '俄罗斯方块', draughts: '跳棋', jungle: '斗兽棋', xiangqi: '象棋',
};

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

async function callDeepSeek(messages){
  const payload = {
    model: 'deepseek-chat',
    messages,
    temperature: 0.4,
    max_tokens: 200,
    stream: false,
    response_format: { type: 'json_object' },
  };
  const res = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + DEEPSEEK_KEY },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
  });
  if (res.status === 400){
    // 部分模型不支持 json_object：去掉后重试一次
    delete payload.response_format;
    const res2 = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000),
    });
    if (!res2.ok) throw new Error('deepseek ' + res2.status + ': ' + (await res2.text()).slice(0, 160));
    const data2 = await res2.json();
    return data2.choices && data2.choices[0] && data2.choices[0].message ? data2.choices[0].message.content : '';
  }
  if (!res.ok) throw new Error('deepseek ' + res.status + ': ' + (await res.text()).slice(0, 160));
  const data = await res.json();
  return data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
}

async function askDeepSeek(game, state, options){
  const messages = [
    { role: 'system', content: '你是一个棋牌游戏 AI 助手。你只会输出合法、可执行的棋步，绝不编造不存在的选项。' },
    { role: 'user', content: buildAIPrompt(game, state, options) },
  ];
  const content = await callDeepSeek(messages);
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
  const chunks = [];
  let size = 0;
  for await (const c of req){
    size += c.length;
    if (size > 100000){
      res.writeHead(413, { ...CORS, 'Content-Type': 'application/json' });
      res.end('{"choice":null}');
      return;
    }
    chunks.push(c);
  }
  let body = {};
  try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { body = {}; }
  const game = String(body.game || '');
  const options = Array.isArray(body.options) ? body.options.map(String).slice(0, 300) : null;
  let choice = null;
  if (DEEPSEEK_KEY){
    try {
      choice = await askDeepSeek(game, body.state, options);
    } catch (e) {
      console.error('AI 请求失败:', e.message);
    }
  }
  if (options && !options.includes(choice)) choice = null;
  res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ choice }));
}

/* ---------------- 静态文件 ---------------- */
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (req.method === 'OPTIONS'){
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  if (req.method === 'POST' && urlPath === '/api/ai'){
    handleAI(req, res);
    return;
  }
  if (req.method === 'GET' && urlPath === '/api/ip'){
    res.writeHead(200, { ...CORS, 'Content-Type': 'application/json' });
    const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    res.end(JSON.stringify({ ip: fwd || req.socket.remoteAddress || '' }));
    return;
  }
  let file = path.normalize(path.join(PUBLIC, urlPath === '/' ? 'index.html' : urlPath));
  if (!file.startsWith(PUBLIC)) {
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
const GAME_MAX = { tictactoe: 2, gomoku: 2, ludo: 4, monopoly: 5, checker: 5, tank: 2, snake: 4, tetris: 4, draughts: 2, jungle: 2, xiangqi: 2 };
const GAME_MIN = { tictactoe: 2, gomoku: 2, ludo: 2, monopoly: 2, checker: 2, tank: 2, snake: 2, tetris: 2, draughts: 2, jungle: 2, xiangqi: 2 };

/* ---------------- Supabase 数据库（可选，配置环境变量后启用） ---------------- */
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const useSupabase = !!(SUPABASE_URL && SUPABASE_KEY);
async function sbFetch(path, options = {}){
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error('supabase ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.status === 204 ? null : res.json();
}
async function sbLoadProfiles(){
  if (!useSupabase) return;
  try {
    const rows = await sbFetch('profiles?select=uid,name,avatar,coins,played,total,background,frame,effect,owned,pin_hash&order=coins.desc&limit=5000');
    const users = {};
    for (const r of rows){
      users[r.uid] = {
        name: r.name, avatar: r.avatar, coins: r.coins || 0, played: r.played || {}, total: r.total || 0,
        background: r.background || 0, frame: r.frame || 0, effect: r.effect || 0,
        owned: r.owned || { avatars: [], frames: [], effects: [], backgrounds: [] },
        pin_hash: r.pin_hash || null,
      };
    }
    db.users = users;
    console.log('已从 Supabase 加载 ' + Object.keys(users).length + ' 位玩家');
  } catch (e) {
    console.error('加载 Supabase 数据失败（继续使用本地数据）:', e.message);
  }
}
async function sbSyncProfile(u){
  if (!useSupabase) return;
  try {
    await sbFetch('profiles?on_conflict=uid', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({
        uid: u.uid, name: u.name, avatar: u.avatar, coins: u.coins, played: u.played, total: u.total,
        background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
        owned: u.owned || { avatars: [], frames: [], effects: [], backgrounds: [] },
        pin_hash: u.pin_hash || null,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch (e) { console.error('Supabase 同步档案失败:', e.message); }
}
async function sbAddHistory(uid, game, coins){
  if (!useSupabase) return;
  try {
    await sbFetch('history', {
      method: 'POST',
      body: JSON.stringify([{ uid, game, coins, created_at: new Date().toISOString() }]),
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
  for (const u of Object.values(db.users)){
    if (u.coins === undefined) u.coins = u.points || 0;
    delete u.points;
    if (!u.played) u.played = {};
    if (!u.total) u.total = 0;
  }
}
function saveDB(){
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
function leaderboardPayload(){
  const onlineUids = new Set();
  const now = Date.now();
  for (const s of sessions) if (s.uid && now - s.lastSeen < 40000) onlineUids.add(s.uid);
  const list = Object.keys(db.users)
    .map(uid => {
      const u = db.users[uid];
      return {
        uid, name: u.name, avatar: u.avatar,
        background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
        owned: u.owned || { avatars: [], frames: [], effects: [], backgrounds: [] },
        coins: u.coins || 0, played: u.played || {}, total: u.total || 0, online: onlineUids.has(uid),
      };
    })
    .sort((a, b) => (b.coins - a.coins) || (b.total - a.total) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 200);
  return { list, total: Object.keys(db.users).length };
}
function broadcastLeaderboard(){
  const payload = leaderboardPayload();
  for (const s of sessions) s.sendText(JSON.stringify({ type: 'leaderboard', payload }));
}
function lobbyPayload(){
  const list = [];
  for (const r of rooms.values()){
    if (r.started || r.clients.size >= r.capacity) continue;
    const hu = r.host.uid ? db.users[r.host.uid] : null;
    list.push({
      room: r.id,
      hostUid: r.host.uid || null,
      hostName: hu ? hu.name : '玩家',
      hostAvatar: hu ? hu.avatar : 0,
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
  const players = [...r.clients.entries()]
    .map(([c, p]) => ({ uid: c.uid || null, player: p }))
    .sort((a, b) => a.player - b.player);
  return { room: r.id, game: r.game || null, capacity: r.capacity, players, size: r.clients.size, started: !!r.started };
}
function broadcastRoom(r){
  const text = JSON.stringify({ type: 'room_update', payload: roomPayload(r) });
  for (const c of r.clients.keys()) c.sendText(text);
}
function maybeAutoStart(r){
  if (r.game && !r.started && r.clients.size === r.capacity){
    r.started = true;
    broadcast(r, { type: 'started', game: r.game, size: r.clients.size, players: [...r.clients.values()] });
  }
}
loadDB();

function genCode(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function genUid(){
  return 'u_' + crypto.randomBytes(6).toString('hex');
}
function hashPin(pin){
  return crypto.createHash('sha256').update('mg-pin:' + String(pin).trim().toLowerCase()).digest('hex');
}
function validPin(pin){
  return /^[A-Za-z0-9]{4,20}$/.test(String(pin).trim());
}
function profileObj(u){
  return {
    uid: u.uid, name: u.name, avatar: u.avatar,
    background: u.background || 0, frame: u.frame || 0, effect: u.effect || 0,
    owned: u.owned || { avatars: [], frames: [], effects: [], backgrounds: [] },
    coins: u.coins || 0, played: u.played || {}, total: u.total || 0,
  };
}
function normalizeOwned(o){
  const base = { avatars: [], frames: [], effects: [], backgrounds: [] };
  if (o && typeof o === 'object'){
    for (const k of Object.keys(base)){
      if (Array.isArray(o[k])) base[k] = o[k].map(Number).filter(Number.isInteger).slice(0, 500);
    }
  }
  return base;
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
  constructor(socket){
    this.socket = socket;
    this.room = null;
    this.player = null;
    this.uid = null;
    this.lastSeen = Date.now();
    this.buffer = Buffer.alloc(0);
    this.alive = true;
  }
  sendText(text){ sendFrame(this.socket, 0x1, text); }
  sendPong(){ sendFrame(this.socket, 0xA, ''); }
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
        if (big > 0x4000000) { this.close(); return; }
        len = Number(big);
        offset = 10;
      }
      if (!masked){ this.close(); return; } // 客户端帧必须掩码
      if (this.buffer.length < offset + 4 + len) return;
      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.alloc(len);
      for (let i = 0; i < len; i++) payload[i] = this.buffer[offset + 4 + i] ^ mask[i % 4];
      this.buffer = this.buffer.subarray(offset + 4 + len);
      if (opcode === 0x8){ this.close(); return; }
      if (opcode === 0x9){ this.sendPong(); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 && fin) this.handleMessage(payload.toString('utf8'));
    }
  }
  handleMessage(text){
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    const type = msg && msg.type;
    const payload = msg && msg.payload;
    this.lastSeen = Date.now();
    if (type === 'ping') return;
    if (type === 'hello'){
      const uid = payload && payload.uid;
      if (uid) this.uid = String(uid);
      broadcastLeaderboard();
      broadcastLobby();
      if (this.uid){
        const pend = pendingInvites.get(this.uid);
        if (pend && pend.length){
          for (const inv of pend.splice(0)) this.sendText(JSON.stringify({ type: 'invite', payload: inv }));
        }
      }
      return;
    }
    if (type === 'register'){
      const pin = String((payload && payload.pin) || '').trim();
      if (!validPin(pin)){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 只能使用字母和数字，长度 4-20 位' }));
        return;
      }
      const ph = hashPin(pin);
      if (Object.values(db.users).some(u => u.pin_hash === ph)){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: '该 PIN 已被其他玩家使用，请换一个' }));
        return;
      }
      const proposed = String((payload && payload.uid) || '');
      const uid = /^u_[a-z0-9]{6,32}$/.test(proposed) ? proposed : genUid();
      const name = String((payload && payload.name) || '').trim().slice(0, 12) || '玩家';
      const avatar = Number.isInteger(payload && payload.avatar) ? Math.max(0, Math.min(27, payload.avatar)) : 0;
      const u = {
        uid, name, avatar,
        background: Number.isInteger(payload && payload.background) ? Math.max(0, Math.min(12, payload.background)) : 0,
        frame: Number.isInteger(payload && payload.frame) ? Math.max(0, Math.min(12, payload.frame)) : 0,
        effect: Number.isInteger(payload && payload.effect) ? Math.max(0, Math.min(12, payload.effect)) : 0,
        owned: normalizeOwned(payload && payload.owned),
        coins: 0, played: {}, total: 0, pin_hash: ph, created_at: Date.now(),
      };
      db.users[uid] = u;
      saveDB();
      sbSyncProfile(u);
      this.uid = uid;
      this.sendText(JSON.stringify({ type: 'registered', payload: { uid, profile: profileObj(u) } }));
      broadcastLeaderboard();
      broadcastLobby();
      return;
    }
    if (type === 'login'){
      const pin = String((payload && payload.pin) || '').trim();
      if (!validPin(pin)){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 只能使用字母和数字，长度 4-20 位' }));
        return;
      }
      const ph = hashPin(pin);
      const u = Object.values(db.users).find(x => x.pin_hash === ph);
      if (!u){
        this.sendText(JSON.stringify({ type: 'auth_error', msg: 'PIN 不存在，请检查后重试' }));
        return;
      }
      this.uid = u.uid;
      this.sendText(JSON.stringify({ type: 'logged_in', payload: { uid: u.uid, profile: profileObj(u) } }));
      broadcastLeaderboard();
      broadcastLobby();
      return;
    }
    if (type === 'profile_get'){
      const uid = String((payload && payload.uid) || '');
      const u = uid && db.users[uid];
      this.sendText(JSON.stringify({ type: 'profile_data', payload: u ? profileObj(u) : null }));
      return;
    }
    if (type === 'profile'){
      const uid = payload && payload.uid;
      const name = String(payload && payload.name || '').trim().slice(0, 12) || '玩家';
      if (!uid) return;
      const avatar = Number.isInteger(payload.avatar) ? Math.max(0, Math.min(27, payload.avatar)) : 0;
      const u = db.users[uid] || (db.users[uid] = { name, avatar, coins: 0, played: {}, total: 0 });
      u.name = name;
      u.avatar = avatar;
      if (payload.background !== undefined) u.background = Number.isInteger(payload.background) ? Math.max(0, Math.min(12, payload.background)) : (u.background || 0);
      if (payload.frame !== undefined) u.frame = Number.isInteger(payload.frame) ? Math.max(0, Math.min(12, payload.frame)) : (u.frame || 0);
      if (payload.effect !== undefined) u.effect = Number.isInteger(payload.effect) ? Math.max(0, Math.min(12, payload.effect)) : (u.effect || 0);
      if (payload.owned) u.owned = normalizeOwned(payload.owned);
      if (payload.pin_hash) u.pin_hash = String(payload.pin_hash);
      saveDB();
      sbSyncProfile(u);
      this.sendText(JSON.stringify({ type: 'profile_ok', payload: profileObj(u) }));
      broadcastLeaderboard();
      return;
    }
    if (type === 'result'){
      const list = Array.isArray(payload) ? payload : [];
      for (const s of list){
        const uid = s && s.uid;
        if (!uid) continue;
        const u = db.users[uid];
        if (!u) continue;
        const game = String(s.game || 'other');
        const coins = s.coins === 1 ? 1 : 0;
        const played = s.played === 1 ? 1 : 0;
        u.coins = (u.coins || 0) + coins;
        u.played[game] = (u.played[game] || 0) + played;
        u.total = (u.total || 0) + played;
        db.history.push({ uid, game, coins, at: Date.now() });
        sbAddHistory(uid, game, coins);
        sbSyncProfile(u);
      }
      if (db.history.length > 1000) db.history = db.history.slice(-500);
      saveDB();
      broadcastLeaderboard();
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
      const roomId = String((payload && payload.room) || '').trim().toUpperCase();
      this.joinRoom(roomId, true);
      return;
    }
    if (type === 'invite_decline'){
      const roomId = String((payload && payload.room) || '').trim().toUpperCase();
      const r = rooms.get(roomId);
      if (r) r.host.sendText(JSON.stringify({ type: 'invite_result', payload: { accepted: false } }));
      return;
    }
    if (type === 'create'){
      if (this.room) return;
      const roomId = genCode();
      const cap = Math.min(5, Math.max(2, parseInt(payload && payload.capacity, 10) || 2));
      const r = { id: roomId, host: this, clients: new Map([[this, 0]]), game: null, capacity: cap, started: false };
      rooms.set(roomId, r);
      this.room = roomId;
      this.player = 0;
      this.sendText(JSON.stringify({ type: 'created', room: roomId, player: 0, capacity: cap }));
      broadcastRoom(r);
      broadcastLobby();
      return;
    }
    if (type === 'join'){
      this.joinRoom(String((payload && payload.room) || '').trim().toUpperCase(), false);
      return;
    }
    if (type === 'leave'){
      this.leaveRoom();
      return;
    }
    if (!this.room) return;
    const r = rooms.get(this.room);
    if (!r) return;
    if (type === 'invite'){
      if (this !== r.host) return;
      const toUid = payload && payload.toUid;
      if (!toUid) return;
      if (r.started || r.clients.size >= r.capacity) return;
      if ([...r.clients.keys()].some(c => c.uid === toUid)) return;
      const fromU = this.uid ? db.users[this.uid] : null;
      const inv = { fromUid: this.uid, fromName: fromU ? fromU.name : '玩家', room: r.id, game: r.game || null };
      let target = null;
      for (const s of sessions){ if (s.uid === toUid && s !== this){ target = s; break; } }
      if (target){
        target.sendText(JSON.stringify({ type: 'invite', payload: inv }));
      } else {
        if (!pendingInvites.has(toUid)) pendingInvites.set(toUid, []);
        pendingInvites.get(toUid).push(inv);
      }
      return;
    }
    if (type === 'select_game'){
      if (this !== r.host) return;
      const g = payload && payload.game;
      if (!g) return;
      const curSize = r.clients.size;
      if (GAME_MAX[g] && (r.capacity > GAME_MAX[g] || curSize > GAME_MAX[g])){
        this.sendText(JSON.stringify({ type: 'error', msg: '该游戏最多支持 ' + GAME_MAX[g] + ' 人，当前房间 ' + r.capacity + ' 人' }));
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
      broadcast(r, { type: 'end_game' });
      broadcastRoom(r);
      broadcastLobby();
      return;
    }
    if (type === 'start'){
      if (this !== r.host) return;
      if (!r.game || r.started) return;
      if (r.clients.size < GAME_MIN[r.game] || r.clients.size > GAME_MAX[r.game]) return;
      r.started = true;
      broadcast(r, { type: 'started', game: r.game, size: r.clients.size, players: [...r.clients.values()] });
      broadcastLobby();
      return;
    }
    if (type === 'move'){
      broadcast(r, { type: 'move', payload: payload }, this);
      return;
    }
    if (type === 'restart'){
      if (this !== r.host) return;
      broadcast(r, { type: 'restart' });
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
    r.clients.delete(this);
    this.room = null;
    this.player = null;
    if (wasHost){
      for (const c of r.clients.keys()) c.sendText(JSON.stringify({ type: 'peer_left' }));
      rooms.delete(r.id);
      broadcastLobby();
    } else {
      if (r.clients.size === 0){ rooms.delete(r.id); return; }
      r.started = false;
      r.host.sendText(JSON.stringify({ type: 'peer_left' }));
      broadcastRoom(r);
      broadcastLobby();
    }
  }
  close(){
    if (!this.alive) return;
    this.alive = false;
    sessions.delete(this);
    this.leaveRoom();
    try { this.socket.destroy(); } catch {}
  }
}

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key){
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
    'Upgrade: websocket\r\n' +
    'Connection: Upgrade\r\n' +
    'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  const session = new Session(socket);
  sessions.add(session);
  socket.on('data', d => session.handleData(d));
  socket.on('close', () => session.close());
  socket.on('error', () => session.close());
});

sbLoadProfiles().finally(() => {
  server.listen(PORT, () => {
    console.log('小游戏合集在线服务已启动: http://localhost:' + PORT + (useSupabase ? '（Supabase 数据库已连接）' : '（本地 JSON 存储）'));
  });
});
