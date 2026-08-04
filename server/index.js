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
  for (const s of sessions) if (s.uid) onlineUids.add(s.uid);
  const list = Object.keys(db.users)
    .map(uid => {
      const u = db.users[uid];
      return { uid, name: u.name, avatar: u.avatar, coins: u.coins || 0, played: u.played || {}, total: u.total || 0, online: onlineUids.has(uid) };
    })
    .sort((a, b) => (b.coins - a.coins) || (b.total - a.total) || String(a.name).localeCompare(String(b.name)))
    .slice(0, 50);
  return { list, total: Object.keys(db.users).length };
}
function broadcastLeaderboard(){
  const payload = leaderboardPayload();
  for (const s of sessions) s.sendText(JSON.stringify({ type: 'leaderboard', payload }));
}
function roomPayload(r){
  const players = [...r.clients.entries()]
    .map(([c, p]) => ({ uid: c.uid || null, player: p }))
    .sort((a, b) => a.player - b.player);
  return { room: r.id, game: r.game || null, players, size: r.clients.size };
}
function broadcastRoom(r){
  const text = JSON.stringify({ type: 'room_update', payload: roomPayload(r) });
  for (const c of r.clients.keys()) c.sendText(text);
}
function maybeAutoStart(r){
  if (r.game && r.clients.size === 2) broadcast(r, { type: 'started', game: r.game });
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
    if (type === 'hello'){
      const uid = payload && payload.uid;
      if (uid) this.uid = String(uid);
      broadcastLeaderboard();
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
    if (type === 'create'){
      if (this.room) return;
      const roomId = genCode();
      const r = { id: roomId, host: this, clients: new Map([[this, 0]]), game: null };
      rooms.set(roomId, r);
      this.room = roomId;
      this.player = 0;
      this.sendText(JSON.stringify({ type: 'created', room: roomId, player: 0 }));
      broadcastRoom(r);
      return;
    }
    if (type === 'join'){
      const roomId = String((payload && payload.room) || '').trim().toUpperCase();
      const r = rooms.get(roomId);
      if (!r){
        this.sendText(JSON.stringify({ type: 'error', msg: '房间不存在' }));
        return;
      }
      if (r.clients.size >= 2){
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
      maybeAutoStart(r);
      return;
    }
    if (type === 'leave'){
      this.leaveRoom();
      return;
    }
    if (!this.room) return;
    const r = rooms.get(this.room);
    if (!r) return;
    if (type === 'select_game'){
      if (this !== r.host) return;
      const g = payload && payload.game;
      if (!g) return;
      r.game = g;
      broadcastRoom(r);
      maybeAutoStart(r);
      return;
    }
    if (type === 'start'){
      if (this !== r.host) return;
      r.game = payload && payload.game;
      broadcast(r, { type: 'started', game: r.game });
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
    } else {
      if (r.clients.size === 0){ rooms.delete(r.id); return; }
      r.host.sendText(JSON.stringify({ type: 'peer_left' }));
      broadcastRoom(r);
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

server.listen(PORT, () => {
  console.log('小游戏合集在线服务已启动: http://localhost:' + PORT);
});
