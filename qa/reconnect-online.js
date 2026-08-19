// 断线重连回归：保留席位、恢复 moveLog、超时释放。
// Node 20: node --experimental-websocket qa/reconnect-online.js
'use strict';
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const SERVER = path.join(__dirname, '..', 'server', 'index.js');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-reconnect-'));
const clients = [];
let server;
let serverOut = '';
let failures = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (!condition && detail ? ' :: ' + detail : ''));
  if (!condition) failures++;
}
async function reservePort(){
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(err => err ? reject(err) : resolve(p)); });
  });
}
async function waitReady(port){
  const end = Date.now() + 10000;
  while (Date.now() < end){
    try {
      const ok = await new Promise(resolve => {
        const req = http.get('http://127.0.0.1:' + port + '/', res => { res.resume(); resolve(res.statusCode === 200); });
        req.on('error', () => resolve(false));
      });
      if (ok) return;
    } catch {}
    await sleep(80);
  }
  throw new Error('server not ready\n' + serverOut);
}
class Client {
  constructor(name, url){ this.name = name; this.url = url; this.messages = []; this.seq = 0; this.ws = null; }
  async open(){
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = event => {
      try { this.messages.push({ seq: ++this.seq, msg: JSON.parse(String(event.data)) }); } catch {}
    };
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.name + ' open timeout')), 5000);
      this.ws.onopen = () => { clearTimeout(timer); resolve(); };
      this.ws.onerror = () => { clearTimeout(timer); reject(new Error(this.name + ' open failed')); };
    });
    clients.push(this);
    return this;
  }
  mark(){ return this.seq; }
  send(type, payload){ this.ws.send(JSON.stringify({ type, ...(payload === undefined ? {} : { payload }) })); }
  async waitAfter(mark, predicate, label, timeout = 5000){
    const end = Date.now() + timeout;
    while (Date.now() < end){
      const found = this.messages.find(x => x.seq > mark && predicate(x.msg));
      if (found) return found.msg;
      await sleep(20);
    }
    throw new Error(this.name + ' wait timeout: ' + label + ' / ' + this.messages.slice(-8).map(x => x.msg.type).join(','));
  }
  async request(type, payload, predicate, label){ const mark = this.mark(); this.send(type, payload); return this.waitAfter(mark, predicate, label); }
  close(){ try { if (this.ws && this.ws.readyState < 2) this.ws.close(); } catch {} }
}
async function register(client, uid, pin){
  const msg = await client.request('register', { uid, pin, name: uid }, m => m.type === 'registered', 'register');
  const p = msg.payload || {};
  return { uid: p.uid, token: msg.token || p.token };
}
async function main(){
  if (typeof WebSocket !== 'function') throw new Error('Node 20 请加 --experimental-websocket');
  const port = await reservePort();
  server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DATA_DIR, NODE_ENV: 'test', ENABLE_RULE_AUTHORITY_V2: '0', RECONNECT_GRACE_MS: '1000', SUPABASE_URL: '', SUPABASE_KEY: '', DEEPSEEK_KEY: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', d => { serverOut += d; });
  server.stderr.on('data', d => { serverOut += d; });
  await waitReady(port);
  const url = 'ws://127.0.0.1:' + port + '/ws';
  const a = await new Client('A', url).open();
  const b = await new Client('B', url).open();
  const suffix = Date.now().toString(36);
  const accA = await register(a, 'u_reca' + suffix, 'RecA' + suffix);
  const accB = await register(b, 'u_recb' + suffix, 'RecB' + suffix);
  const created = await a.request('create', { capacity: 2 }, m => m.type === 'created', 'created');
  await b.request('join', { room: created.room }, m => m.type === 'joined', 'joined');
  const selectedMark = a.mark();
  a.send('select_game', { game: 'gomoku' });
  await a.waitAfter(selectedMark, m => m.type === 'room_update' && m.payload && m.payload.game === 'gomoku', 'selected game');
  const readyMark = a.mark();
  b.send('ready', { ready: true });
  await a.waitAfter(readyMark, m => m.type === 'room_update' && m.payload && m.payload.canStart === true, 'ready projection');
  const am = a.mark(), bm = b.mark();
  a.send('start', {});
  const startedA = await a.waitAfter(am, m => m.type === 'started', 'started A');
  const startedB = await b.waitAfter(bm, m => m.type === 'started', 'started B');
  check('双方拿到相同 matchId', !!startedA.matchId && startedA.matchId === startedB.matchId);
  const move = { r: 7, c: 7 };
  const moveMark = b.mark();
  a.send('move', move);
  await b.waitAfter(moveMark, m => m.type === 'move' && m.payload && m.payload.r === 7 && m.payload.c === 7 && m.player === 0, 'move log seed');
  const offlineMark = a.mark();
  b.send('debug_disconnect');
  const offline = await a.waitAfter(offlineMark, m => m.type === 'peer_status' && m.payload && m.payload.online === false, 'peer offline');
  check('异常断线先进入重连等待', offline.payload.player === 1);
  const b2 = await new Client('B2', url).open();
  const rejoinMark = b2.mark();
  b2.send('hello', { uid: accB.uid, token: accB.token, proto: 1 });
  const rejoined = await b2.waitAfter(rejoinMark, m => m.type === 'rejoined', 'rejoined');
  const state = rejoined.payload || {};
  check('重连复用原玩家席位', state.player === 1 && state.room === created.room, JSON.stringify(state));
  check('重连保持原 matchId', state.matchId === startedA.matchId);
  check('重连下发完整 moveLog', Array.isArray(state.moveLog) && state.moveLog.some(e => e.payload && e.payload.r === 7 && e.payload.c === 7 && e.player === 0), JSON.stringify(state.moveLog));
  const onlineAgain = await a.waitAfter(offlineMark, m => m.type === 'peer_status' && m.payload && m.payload.online === true, 'peer online');
  check('其他玩家收到恢复在线通知', onlineAgain.payload.player === 1);
  const nextMoveMark = a.mark(); b2.send('move', { r: 6, c: 6 });
  const nextMove = await a.waitAfter(nextMoveMark, m => m.type === 'move' && m.payload && m.payload.r === 6 && m.payload.c === 6, 'post-rejoin move');
  check('恢复后仍可继续转发走子', nextMove.player === 1);

  const secondOfflineMark = a.mark();
  b2.send('debug_disconnect');
  await a.waitAfter(secondOfflineMark, m => m.type === 'peer_status' && m.payload && m.payload.online === false, 'second offline');
  const expiryMark = a.mark();
  const expired = await a.waitAfter(expiryMark, m => m.type === 'reconnect_expired', 'reconnect expired', 4000);
  check('重连窗口过期后释放席位并结束本局', expired.payload && expired.payload.player === 1);
  const waitingRoom = await a.waitAfter(expiryMark, m => m.type === 'room_update' && m.payload && m.payload.room === created.room && m.payload.started === false, 'room reset after expiry');
  check('房主仍保留等待房间', waitingRoom.payload.players.length === 1 && waitingRoom.payload.players[0].player === 0);
  const b3 = await new Client('B3', url).open();
  const expiredMark = b3.mark();
  b3.send('hello', { uid: accB.uid, token: accB.token, proto: 1 });
  const expiredReply = await b3.waitAfter(expiredMark, m => m.type === 'resume_expired', 'resume expired reply');
  check('过期账号不能偷偷占回旧席位', expiredReply.payload && expiredReply.payload.room === created.room);

  const rejoinRoomMark = b3.mark();
  b3.send('join', { room: created.room });
  const joinedAgain = await b3.waitAfter(rejoinRoomMark, m => m.type === 'joined', 'join after expired resume');
  check('过期账号可作为新连接重新加入', joinedAgain.player === 1 && joinedAgain.room === created.room);
   const restartReadyMark = a.mark();
   b3.send('ready', { ready: true });
   await a.waitAfter(restartReadyMark, m => m.type === 'room_update' && m.payload && m.payload.canStart === true, 'restart ready projection');
   a.send('start', {});
  await b3.waitAfter(rejoinRoomMark, m => m.type === 'started', 'match restarted after join');

  const hostExpiryMark = b3.mark();
  a.send('debug_disconnect');
  const hostOffline = await b3.waitAfter(hostExpiryMark, m => m.type === 'peer_status' && m.payload && m.payload.online === false, 'host offline');
  check('房主异常断线也先保留席位', hostOffline.payload.player === 0);
  const hostExpired = await b3.waitAfter(hostExpiryMark, m => m.type === 'reconnect_expired' && m.payload && m.payload.player === 0, 'host reconnect expired', 4000);
  check('房主超时后转移房主并压紧席位', hostExpired.payload.hostChanged === true && hostExpired.payload.hostPlayer === 0, JSON.stringify(hostExpired.payload));
  const hostChanged = await b3.waitAfter(hostExpiryMark, m => m.type === 'host_changed', 'host changed message');
  check('新房主收到独立转移通知', hostChanged.payload && hostChanged.payload.uid === accB.uid && hostChanged.payload.player === 0);
  const transferredRoom = await b3.waitAfter(hostExpiryMark, m => m.type === 'room_update' && m.payload && m.payload.started === false && m.payload.players.length === 1, 'room after host transfer');
  check('房主转移后房间可继续等待', transferredRoom.payload.players[0].uid === accB.uid && transferredRoom.payload.players[0].player === 0);
}
main().catch(err => { console.error('RECONNECT_CRASH', err && err.stack || err); failures++; }).finally(async () => {
  clients.forEach(c => c.close());
  if (server && server.exitCode === null) server.kill();
  await sleep(100);
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
  console.log(failures ? 'RECONNECT_HAS_FAILURES' : 'RECONNECT_ALL_PASS');
  process.exitCode = failures ? 1 : 0;
});
