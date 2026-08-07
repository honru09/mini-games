// 最小复现：guest 断开后 host 是否收到 peer_left
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const SERVER = path.join(__dirname, '..', 'server', 'index.js');
const PORT = 8123;
const DATA_DIR = fs.mkdtempSync(require('path').join(os.tmpdir(), 'mini-games-ws-close-'));

const server = spawn(process.execPath, [SERVER], {
  env: {
    ...process.env,
    PORT: String(PORT),
    DATA_DIR,
    NODE_ENV: 'test',
    SUPABASE_URL: '',
    SUPABASE_KEY: '',
    DEEPSEEK_KEY: '',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', d => process.stdout.write('[SVR] ' + d));
server.stderr.on('data', d => process.stderr.write(d));

function waitReady(){
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const req = http.get('http://127.0.0.1:' + PORT + '/', r => { r.resume(); clearInterval(iv); resolve(); });
      req.on('error', () => { if (Date.now() - t0 > 8000){ clearInterval(iv); reject(new Error('server not ready')); } });
    }, 150);
  });
}

function client(name){
  const ws = new WebSocket('ws://127.0.0.1:' + PORT + '/ws');
  const msgs = [];
  ws.onmessage = e => {
    const m = JSON.parse(e.data);
    msgs.push(m);
    console.log('[' + name + ']', m.type, m.room || (m.payload && m.payload.room) || '');
  };
  ws.onclose = e => console.log('[' + name + '] closed', e.code);
  const wait = (pred, timeout = 5000) => new Promise((resolve, reject) => {
    const t0 = Date.now();
    const iv = setInterval(() => {
      const hit = msgs.find(pred);
      if (hit){ clearInterval(iv); resolve(hit); }
      else if (Date.now() - t0 > timeout){ clearInterval(iv); reject(new Error(name + ' wait timeout')); }
    }, 30);
  });
  return { ws, msgs, wait };
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  await waitReady();
  const a = client('A');
  const b = client('B');
  await sleep(400);
  const suffix = Date.now().toString(36);
  a.ws.send(JSON.stringify({ type: 'register', payload: { uid: 'u_closea' + suffix, pin: 'CloseA' + suffix, name: 'Close A' } }));
  b.ws.send(JSON.stringify({ type: 'register', payload: { uid: 'u_closeb' + suffix, pin: 'CloseB' + suffix, name: 'Close B' } }));
  await a.wait(m => m.type === 'registered');
  await b.wait(m => m.type === 'registered');
  a.ws.send(JSON.stringify({ type: 'create', payload: { capacity: 2 } }));
  const created = await a.wait(m => m.type === 'created');
  const room = created.room;
  console.log('room:', room);
  b.ws.send(JSON.stringify({ type: 'join', payload: { room } }));
  await b.wait(m => m.type === 'joined');
  await a.wait(m => m.type === 'room_update' && m.payload.size === 2);
  a.ws.send(JSON.stringify({ type: 'select_game', payload: { game: 'gomoku' } }));
  await a.wait(m => m.type === 'room_update' && m.payload && m.payload.game === 'gomoku');
  b.ws.send(JSON.stringify({ type: 'ready', payload: { ready: true } }));
  await a.wait(m => m.type === 'room_update' && m.payload && m.payload.canStart === true);
  a.ws.send(JSON.stringify({ type: 'start' }));
  await a.wait(m => m.type === 'started');
  console.log('--- game started, now closing B ---');
  console.log('B readyState:', b.ws.readyState);
  console.log('--- B closing ---');
  b.ws.close();
  await sleep(300);
  console.log('B readyState after close:', b.ws.readyState);
  await a.wait(m => m.type === 'peer_left', 4000);
  console.log('RESULT: A received peer_left ✅');
  server.kill();
  try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {}
  process.exit(0);
})().catch(e => { console.error('ERR', e); server.kill(); try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch {} process.exit(1); });
