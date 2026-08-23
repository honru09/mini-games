'use strict';

const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const DATA = fs.mkdtempSync(path.join(ROOT, 'data', 'undo-online-'));
const failures = [];
const clients = [];
let server = null;
let serverLog = '';

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures.push(name);
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(() => resolve(address.port));
    });
  });
}

class Client {
  constructor(name, port) { this.name = name; this.port = port; this.messages = []; this.waiters = []; }
  async connect() {
    this.ws = new WebSocket('ws://127.0.0.1:' + this.port + '/ws');
    this.ws.onmessage = event => {
      const message = JSON.parse(event.data);
      this.messages.push(message);
      this.waiters.splice(0).forEach(resolve => resolve());
    };
    await new Promise((resolve, reject) => { this.ws.onopen = resolve; this.ws.onerror = reject; });
  }
  send(type, payload) { this.ws.send(JSON.stringify({ type, payload })); }
  async wait(type, predicate = () => true, timeout = 7000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      const index = this.messages.findIndex(message => message.type === type && predicate(message));
      if (index >= 0) return this.messages.splice(index, 1)[0];
      await new Promise(resolve => { this.waiters.push(resolve); setTimeout(resolve, 25); });
    }
    throw new Error(this.name + ' wait ' + type + ' :: ' + JSON.stringify(this.messages.slice(-8)));
  }
  async register(index) {
    await this.connect();
    this.send('register', { uid:'u_undo' + index, pin:'UndoTestPin' + index, name:this.name });
    const registered = await this.wait('registered');
    this.uid = registered.payload.uid;
    this.token = registered.payload.token;
    this.send('hello', { uid:this.uid, token:this.token, proto:2, capabilities:['xiangqi-rule-v2'] });
    await this.wait('hello_ack', message => message.authenticated === true);
  }
  close() { try { if (this.ws) this.ws.close(); } catch {} }
}

async function waitForServer(port) {
  const started = Date.now();
  while (Date.now() - started < 7000) {
    try {
      await new Promise((resolve, reject) => {
        const request = http.get('http://127.0.0.1:' + port + '/', response => { response.resume(); resolve(); });
        request.on('error', reject);
      });
      return;
    } catch { await new Promise(resolve => setTimeout(resolve, 40)); }
  }
  throw new Error('server start timeout :: ' + serverLog);
}

async function readyAndStart(host, guest, game) {
  host.send('select_game', { game });
  await host.wait('room_update', message => message.payload && message.payload.game === game);
  await guest.wait('room_update', message => message.payload && message.payload.game === game);
  guest.send('ready', { ready:true });
  await host.wait('room_update', message => message.payload && message.payload.game === game && message.payload.canStart === true);
  host.send('start', {});
  const startedHost = await host.wait('started');
  await guest.wait('started');
  return startedHost;
}

async function endMatch(host, guest) {
  host.send('end_game', {});
  await host.wait('end_game');
  await guest.wait('end_game');
}

async function main() {
  const port = await freePort();
  server = spawn(process.execPath, [SERVER], {
    cwd:ROOT,
    env:{ ...process.env, PORT:String(port), DATA_DIR:DATA, NODE_ENV:'test', ENABLE_RULE_AUTHORITY_V2:'1', SUPABASE_URL:'', SUPABASE_KEY:'', DEEPSEEK_KEY:'' },
    stdio:['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { serverLog += String(chunk); });
  server.stderr.on('data', chunk => { serverLog += String(chunk); });
  await waitForServer(port);

  const host = new Client('UndoHost', port), guest = new Client('UndoGuest', port);
  clients.push(host, guest);
  await host.register(1); await guest.register(2);

  host.send('create', { capacity:2, allowUndo:false });
  const created = await host.wait('created');
  guest.send('join', { room:created.room });
  const joined = await guest.wait('joined');
  check('Room creation preserves an explicit disabled undo policy', joined.payload && joined.payload.allowUndo === false);

  let started = await readyAndStart(host, guest, 'gomoku');
  host.send('move', [7, 7]);
  await guest.wait('move');
  host.send('undo', { matchId:started.matchId });
  const disabled = await host.wait('gameplay_error', message => message.payload && message.payload.reason === 'ERR_UNDO_DISABLED');
  check('Disabled rooms reject Gomoku undo without mutating the match', disabled.payload.protocol === 'undo-v1');
  await endMatch(host, guest);

  host.send('room_settings', { allowUndo:true });
  const enabledHost = await host.wait('room_update', message => message.payload && message.payload.allowUndo === true);
  await guest.wait('room_update', message => message.payload && message.payload.allowUndo === true);
  check('The host can enable one undo before a match starts', enabledHost.payload.allowUndo === true);

  started = await readyAndStart(host, guest, 'gomoku');
  host.send('move', [7, 7]);
  await guest.wait('move');
  guest.send('undo', { matchId:started.matchId });
  const wrongGomokuPlayer = await guest.wait('gameplay_error', message => message.payload && message.payload.reason === 'ERR_NOT_LAST_MOVER');
  check('Gomoku does not let the opponent retract another player\'s move', wrongGomokuPlayer.payload.protocol === 'undo-v1');
  host.send('undo', { matchId:started.matchId });
  const undoHost = await host.wait('undo'), undoGuest = await guest.wait('undo');
  check('Gomoku undo broadcasts an empty authoritative move log to both players',
    undoHost.payload.undoUsed === true && undoGuest.payload.undoUsed === true && undoHost.payload.moveLog.length === 0 && undoGuest.payload.moveLog.length === 0);
  host.send('undo', { matchId:started.matchId });
  const usedGomoku = await host.wait('gameplay_error', message => message.payload && message.payload.reason === 'ERR_UNDO_ALREADY_USED');
  check('Gomoku permits only one room-wide undo per match', usedGomoku.payload.protocol === 'undo-v1');
  await endMatch(host, guest);

  started = await readyAndStart(host, guest, 'xiangqi');
  host.send('xiangqi_action', { matchId:started.matchId, seq:1, from:[6,0], to:[5,0] });
  const movedHost = await host.wait('xiangqi_rule_state'), movedGuest = await guest.wait('xiangqi_rule_state');
  check('Xiangqi authority accepts the opening move before undo', movedHost.payload.moveNumber === 1 && movedGuest.payload.moveNumber === 1);
  guest.send('undo', { matchId:started.matchId });
  const wrongXiangqiPlayer = await guest.wait('gameplay_error', message => message.payload && message.payload.reason === 'ERR_NOT_LAST_MOVER');
  check('Xiangqi does not let the opponent retract another player\'s move', wrongXiangqiPlayer.payload.protocol === 'xiangqi-rule-v2');
  host.send('undo', { matchId:started.matchId });
  const restoredHost = await host.wait('xiangqi_rule_state', message => message.payload && message.payload.moveNumber === 0);
  const restoredGuest = await guest.wait('xiangqi_rule_state', message => message.payload && message.payload.moveNumber === 0);
  check('Xiangqi undo rolls board state back while authority revision remains monotonic',
    restoredHost.payload.revision > movedHost.payload.revision && restoredGuest.payload.revision === restoredHost.payload.revision && restoredHost.payload.current === 0);
  host.send('xiangqi_action', { matchId:started.matchId, seq:2, from:[6,0], to:[5,0] });
  const continuedHost = await host.wait('xiangqi_rule_state', message => message.payload && message.payload.moveNumber === 1);
  await guest.wait('xiangqi_rule_state', message => message.payload && message.payload.revision === continuedHost.payload.revision);
  check('Xiangqi action sequence stays monotonic and play continues after undo', continuedHost.payload.revision > restoredHost.payload.revision);
  host.send('undo', { matchId:started.matchId });
  const usedXiangqi = await host.wait('gameplay_error', message => message.payload && message.payload.reason === 'ERR_UNDO_ALREADY_USED');
  check('Xiangqi permits only one room-wide undo per match', usedXiangqi.payload.protocol === 'undo-v1');
  await endMatch(host, guest);

  started = await readyAndStart(host, guest, 'xiangqi');
  host.send('xiangqi_action', { matchId:started.matchId, seq:1, from:[6,0], to:[5,0] });
  await host.wait('xiangqi_rule_state'); await guest.wait('xiangqi_rule_state');
  host.send('undo', { matchId:started.matchId });
  const resetAllowance = await host.wait('xiangqi_rule_state', message => message.payload && message.payload.moveNumber === 0);
  await guest.wait('xiangqi_rule_state', message => message.payload && message.payload.moveNumber === 0);
  check('Starting a new match resets the one-use undo allowance', resetAllowance.payload.revision === 2);

  if (failures.length) {
    console.error('UNDO_ONLINE_FAILURES=' + failures.length);
    process.exitCode = 1;
  } else console.log('UNDO_ONLINE_ALL_PASS');
}

main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; }).finally(() => {
  clients.forEach(client => client.close());
  if (server) server.kill();
  try { fs.rmSync(DATA, { recursive:true, force:true }); } catch {}
});
