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

/* ---------------- 静态文件 ---------------- */
const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
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
const GAME_MAX = { tictactoe: 2, gomoku: 2, ludo: 4, monopoly: 5, checker: 5 };

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
    const rows = await sbFetch('profiles?select=uid,name,avatar,coins,played,total&order=coins.desc&limit=5000');
    const users = {};
    for (const r of rows){
      users[r.uid] = { name: r.name, avatar: r.avatar, coins: r.coins || 0, played: r.played || {}, total: r.total || 0 };
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
      body: JSON.stringify({ uid: u.uid, name: u.name, avatar: u.avatar, coins: u.coins, played: u.played, total: u.total, updated_at: new Date().toISOString() }),
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
      return { uid, name: u.name, avatar: u.avatar, coins: u.coins || 0, played: u.played || {}, total: u.total || 0, online: onlineUids.has(uid) };
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
    broadcast(r, { type: 'started', game: r.game });
  }
}
loadDB();

function genCode(){
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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
    if (type === 'profile'){
      const uid = payload && payload.uid;
      const name = String(payload && payload.name || '').trim().slice(0, 12) || '玩家';
      if (!uid) return;
      const avatar = Number.isInteger(payload.avatar) ? Math.max(0, Math.min(19, payload.avatar)) : 0;
      const u = db.users[uid] || (db.users[uid] = { name, avatar, coins: 0, played: {}, total: 0 });
      u.name = name;
      u.avatar = avatar;
      saveDB();
      sbSyncProfile(u);
      this.sendText(JSON.stringify({ type: 'profile_ok', payload: { uid, name: u.name, avatar: u.avatar, coins: u.coins, played: u.played, total: u.total } }));
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
      if (GAME_MAX[g] && r.capacity > GAME_MAX[g]){
        this.sendText(JSON.stringify({ type: 'error', msg: '该游戏最多支持 ' + GAME_MAX[g] + ' 人' }));
        return;
      }
      r.game = g;
      broadcastRoom(r);
      broadcastLobby();
      maybeAutoStart(r);
      return;
    }
    if (type === 'start'){
      if (this !== r.host) return;
      if (!r.game || r.clients.size < 2 || r.started) return;
      r.started = true;
      broadcast(r, { type: 'started', game: r.game });
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
    r.clients.set(this, 1);
    this.room = roomId;
    this.player = 1;
    this.sendText(JSON.stringify({ type: 'joined', room: roomId, player: 1 }));
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
