// Focused real-WebSocket local preflight for the default-off Tank delta
// transport.  This is not real network shaping and does not change the
// device/network shared Gate.
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const TankSnapshotWireCodec = require('../shared/protocol/tank-snapshot-wire-codec');

const SERVER = path.join(__dirname, '..', 'server', 'index.js');
const SERVER_SOURCE = fs.readFileSync(SERVER, 'utf8');
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-tank-delta-'));
const clients = [];
let server = null;
let serverOutput = '';
let failures = 0;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, value, detail) {
  console.log((value ? 'PASS' : 'FAIL') + '  ' + name + (!value && detail ? ' :: ' + detail : ''));
  if (!value) failures += 1;
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitReady(port) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    const ready = await new Promise(resolve => {
      const request = http.get('http://127.0.0.1:' + port + '/', response => {
        response.resume();
        resolve(response.statusCode === 200);
      });
      request.on('error', () => resolve(false));
    });
    if (ready) return;
    await sleep(50);
  }
  throw new Error('server did not become ready: ' + serverOutput.slice(-1000));
}

class Client {
  constructor(name, url) {
    this.name = name;
    this.url = url;
    this.ws = null;
    this.messages = [];
    this.sequence = 0;
    this.uid = null;
    this.token = null;
  }
  async open() {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = event => {
      try { this.messages.push({ sequence:++this.sequence, message:JSON.parse(String(event.data)) }); } catch {}
    };
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(this.name + ' open timeout')), 5000);
      this.ws.onopen = () => { clearTimeout(timeout); resolve(); };
      this.ws.onerror = () => { clearTimeout(timeout); reject(new Error(this.name + ' open failed')); };
    });
    clients.push(this);
    return this;
  }
  mark() { return this.sequence; }
  send(type, payload) { this.ws.send(JSON.stringify({ type, ...(payload === undefined ? {} : { payload }) })); }
  async waitAfter(mark, predicate, label, timeout = 5000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      const found = this.messages.find(item => item.sequence > mark && predicate(item.message));
      if (found) return found.message;
      await sleep(15);
    }
    throw new Error(this.name + ' timeout ' + label + ': ' + this.messages.slice(-12).map(item => item.message.type).join(','));
  }
  async request(type, payload, predicate, label) {
    const mark = this.mark();
    this.send(type, payload);
    return this.waitAfter(mark, predicate, label);
  }
  close() { try { if (this.ws && this.ws.readyState < 2) this.ws.close(); } catch {} }
}

async function registerAndHello(client, suffix, capabilities) {
  const registered = await client.request('register', { uid:'u_td' + suffix, pin:'TankDelta' + suffix, name:'Tank ' + suffix }, message => message.type === 'registered', 'registered');
  client.uid = registered.payload && registered.payload.uid;
  client.token = registered.token || registered.payload && registered.payload.token;
  assert(client.uid && client.token, 'registration did not provide credentials');
  const hello = await client.request('hello', { uid:client.uid, token:client.token, proto:2, capabilities }, message => message.type === 'hello_ack', 'hello');
  assert(hello.authenticated === true, 'hello was not authenticated');
}

async function startTank(host, guest) {
  const created = await host.request('create', { capacity:2 }, message => message.type === 'created', 'created');
  await guest.request('join', { room:created.room }, message => message.type === 'joined', 'joined');
  const selected = host.mark();
  host.send('select_game', { game:'tank' });
  await host.waitAfter(selected, message => message.type === 'room_update' && message.payload && message.payload.game === 'tank', 'selected tank');
   const readyMark = host.mark();
   guest.send('ready', { ready:true });
   await host.waitAfter(readyMark, message => message.type === 'room_update' && message.payload && message.payload.canStart === true, 'guest READY projection');
   const hostStart = host.mark();
   const guestStart = guest.mark();
  host.send('start');
  const startedHost = await host.waitAfter(hostStart, message => message.type === 'started' && message.game === 'tank', 'host started');
  const startedGuest = await guest.waitAfter(guestStart, message => message.type === 'started' && message.game === 'tank', 'guest started');
  assert.strictEqual(startedHost.matchId, startedGuest.matchId);
  return { room:created.room, matchId:startedHost.matchId };
}

async function main() {
  if (typeof WebSocket !== 'function') throw new Error('Node 20 requires --experimental-websocket');
  const port = await reservePort();
  server = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT:String(port), DATA_DIR, NODE_ENV:'test', SUPABASE_URL:'', SUPABASE_KEY:'', DEEPSEEK_KEY:'',
      ENABLE_RULE_AUTHORITY_V2:'0', ENABLE_TANK_SNAPSHOT_DELTA_V2:'1',
      TANK_SNAPSHOT_DELTA_KEYFRAME_TICKS:'20', RECONNECT_GRACE_MS:'1500', SPECTATOR_DELAY_MS:'350',
    },
    stdio:['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => { serverOutput += data; });
  server.stderr.on('data', data => { serverOutput += data; });
  await waitReady(port);
  const url = 'ws://127.0.0.1:' + port + '/ws';
  const capable = await new Client('capable', url).open();
  const legacy = await new Client('legacy', url).open();
  const spectator = await new Client('spectator', url).open();
  const suffix = Date.now().toString(36);
  await registerAndHello(capable, suffix + 'a', ['tank-authority-v1', 'tank-snapshot-delta-v2']);
  await registerAndHello(legacy, suffix + 'b', ['tank-authority-v1']);
  await registerAndHello(spectator, suffix + 'c', ['tank-authority-v1', 'tank-snapshot-delta-v2', 'spectator-room-v1']);
  const match = await startTank(capable, legacy);
  const capableMark = capable.mark();
  const legacyMark = legacy.mark();
  const capableSnapshot = await capable.waitAfter(capableMark, message => message.type === 'tank_snapshot', 'v2 tank snapshot');
  const legacySnapshot = await legacy.waitAfter(legacyMark, message => message.type === 'tank_snapshot', 'v1 tank snapshot');
  check('Tank Delta Online：capable receiver gets negotiated v2 envelope', capableSnapshot.payload && capableSnapshot.payload.protocol === TankSnapshotWireCodec.V2_PROTOCOL && capableSnapshot.payload.kind === 'keyframe');
  check('Tank Delta Online：legacy receiver keeps original v1 full snapshot', legacySnapshot.payload && legacySnapshot.payload.protocol === TankSnapshotWireCodec.V1_PROTOCOL && legacySnapshot.payload.matchId === match.matchId);
  const decoder = TankSnapshotWireCodec.create();
  const decoded = decoder.decode(capableSnapshot.payload);
  check('Tank Delta Online：v2 keyframe restores canonical authority snapshot', decoded.accepted === true && decoded.snapshot.protocol === TankSnapshotWireCodec.V1_PROTOCOL && decoded.snapshot.matchId === match.matchId, decoded.reason);
  const deltaMark = capable.mark();
  const later = await capable.waitAfter(deltaMark, message => message.type === 'tank_snapshot' && message.payload && message.payload.protocol === TankSnapshotWireCodec.V2_PROTOCOL && message.payload.kind === 'delta', 'v2 delta');
  const decodedDelta = decoder.decode(later.payload);
  check('Tank Delta Online：following delta applies against recipient-local base', decodedDelta.accepted === true && decodedDelta.mode === 'delta', decodedDelta.reason);

  const spectatorJoinMark = spectator.mark();
  spectator.send('spectate_join', { roomId:match.room, matchId:match.matchId });
  const joined = await spectator.waitAfter(spectatorJoinMark, message => message.type === 'spectate_joined', 'spectator joined');
  check('Tank Delta Online：spectator bootstrap remains full canonical v1 state', joined.payload && joined.payload.tankSnapshot && joined.payload.tankSnapshot.protocol === TankSnapshotWireCodec.V1_PROTOCOL);
  const spectatorFrame = await spectator.waitAfter(spectatorJoinMark, message => message.type === 'tank_snapshot' && message.payload && message.payload.protocol === TankSnapshotWireCodec.V2_PROTOCOL, 'spectator v2 keyframe');
  check('Tank Delta Online：new spectator starts live v2 on a keyframe', spectatorFrame.payload.kind === 'keyframe');
  const leaveMark = spectator.mark();
  spectator.send('spectate_leave');
  await spectator.waitAfter(leaveMark, message => message.type === 'spectate_left', 'spectator left');
  const afterLeave = spectator.mark();
  await sleep(750);
  const leakedFrames = spectator.messages.filter(item => item.sequence > afterLeave && item.message.type === 'tank_snapshot');
  check('Tank Delta Online：退出观战后排队中的延迟帧全部失效', leakedFrames.length === 0, 'leaked=' + leakedFrames.length);
  check('Tank Delta Online：延迟帧使用房间级有界队列并复核 room/match/member epoch',
    SERVER_SOURCE.includes('TANK_SNAPSHOT_DELAY_TIMER_LIMIT=320') && SERVER_SOURCE.includes('r.spectators.get(session)!==recipient.marker') && SERVER_SOURCE.includes("String(r.matchId||'')!==expectedMatchId"));

  capable.send('debug_disconnect');
  await sleep(100);
  const resumed = await new Client('capable-resumed', url).open();
  const rejoinMark = resumed.mark();
  resumed.send('hello', { uid:capable.uid, token:capable.token, proto:2, capabilities:['tank-authority-v1', 'tank-snapshot-delta-v2'] });
  const rejoined = await resumed.waitAfter(rejoinMark, message => message.type === 'rejoined', 'rejoined');
  check('Tank Delta Online：reconnect bootstrap remains full canonical v1 state', rejoined.payload && rejoined.payload.tankSnapshot && rejoined.payload.tankSnapshot.protocol === TankSnapshotWireCodec.V1_PROTOCOL);
  const rejoinedLive = await resumed.waitAfter(rejoinMark, message => message.type === 'tank_snapshot' && message.payload && message.payload.protocol === TankSnapshotWireCodec.V2_PROTOCOL, 'reconnect live keyframe');
  check('Tank Delta Online：reconnect gets a new v2 keyframe rather than stale delta', rejoinedLive.payload.kind === 'keyframe');
}

main().catch(error => {
  failures += 1;
  console.error('TANK_SNAPSHOT_DELTA_ONLINE_CRASH', error && error.stack || error);
}).finally(async () => {
  clients.forEach(client => client.close());
  if (server && server.exitCode === null) server.kill();
  await sleep(100);
  try { fs.rmSync(DATA_DIR, { recursive:true, force:true }); } catch {}
  console.log(failures ? 'TANK_SNAPSHOT_DELTA_ONLINE_HAS_FAILURES' : 'TANK_SNAPSHOT_DELTA_ONLINE_ALL_PASS');
  process.exitCode = failures ? 1 : 0;
});
