// Focused real-WebSocket regression for the default-off Tank snapshot delta.
//
// This test owns only a local child server and a temporary data directory. It
// deliberately exercises the public WebSocket seam: a client that advertises
// tank-snapshot-delta-v2 must still receive the canonical v1 snapshot while
// ENABLE_TANK_SNAPSHOT_DELTA_V2 is explicitly disabled.
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const V1_PROTOCOL = 'tank-authority-v1';
const V2_PROTOCOL = 'tank-snapshot-delta-v2';
const WAIT_MS = 8000;
const CAPABLE_CAPABILITIES = [V1_PROTOCOL, V2_PROTOCOL];
const LEGACY_CAPABILITIES = [V1_PROTOCOL];

const clients = [];
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-tank-default-off-'));
let server = null;
let serverOutput = '';
let failures = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function check(name, condition, detail) {
  const ok = !!condition;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (!ok && detail ? ' :: ' + detail : ''));
  if (!ok) failures += 1;
  return ok;
}

function childExited(child) {
  return !child || child.exitCode !== null || child.signalCode !== null;
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    const fail = error => {
      try { probe.close(); } catch {}
      reject(error);
    };
    probe.once('error', fail);
    probe.listen({ host: '127.0.0.1', port: 0, exclusive: true }, () => {
      probe.removeListener('error', fail);
      const address = probe.address();
      const port = address && typeof address === 'object' ? Number(address.port) : 0;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function httpReady(port) {
  return new Promise(resolve => {
    const request = http.get({ host: '127.0.0.1', port, path: '/', timeout: 800 }, response => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.once('error', () => resolve(false));
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
  });
}

async function waitForServer(port) {
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    if (childExited(server)) {
      throw new Error('Tank default-off server exited before readiness\n' + serverOutput.slice(-3000));
    }
    if (await httpReady(port)) return;
    await sleep(50);
  }
  throw new Error('Tank default-off server readiness timeout\n' + serverOutput.slice(-3000));
}

class WsClient {
  constructor(name, url, capabilities) {
    this.name = name;
    this.url = url;
    this.capabilities = capabilities.slice();
    this.ws = null;
    this.messages = [];
    this.sequence = 0;
    this.closed = false;
  }

  async open() {
    if (typeof WebSocket !== 'function') throw new Error('Node 20 requires --experimental-websocket');
    this.ws = new WebSocket(this.url);
    clients.push(this);
    this.ws.addEventListener('message', event => {
      const raw = event && event.data;
      let message;
      try {
        message = JSON.parse(typeof raw === 'string' ? raw : String(raw));
      } catch {
        message = { type: '__invalid_json__' };
      }
      this.messages.push({ sequence: ++this.sequence, message });
    });
    this.ws.addEventListener('close', () => { this.closed = true; });
    await new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(this.name + ' WebSocket open timeout'));
      }, WAIT_MS);
      this.ws.addEventListener('open', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve();
      }, { once: true });
      this.ws.addEventListener('error', () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error(this.name + ' WebSocket open failed'));
      }, { once: true });
    });
    return this;
  }

  mark() {
    return this.sequence;
  }

  send(type, payload) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error(this.name + ' WebSocket is not open');
    this.ws.send(JSON.stringify({ type, ...(payload === undefined ? {} : { payload }) }));
  }

  async waitAfter(mark, predicate, label, timeout = WAIT_MS) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this.messages.find(entry => entry.sequence > mark && predicate(entry.message));
      if (found) return found.message;
      if (this.closed) throw new Error(this.name + ' closed while waiting for ' + label);
      await sleep(20);
    }
    const tail = this.messages.slice(-10).map(entry => entry.message.type).join(', ');
    throw new Error(this.name + ' timed out waiting for ' + label + '; recent=' + (tail || '(none)'));
  }

  async request(type, payload, predicate, label, timeout) {
    const mark = this.mark();
    this.send(type, payload);
    return this.waitAfter(mark, predicate, label, timeout);
  }

  async close() {
    if (!this.ws) return;
    if (this.ws.readyState === 0 || this.ws.readyState === 1) {
      try { this.ws.close(); } catch {}
    }
    const deadline = Date.now() + 1200;
    while (!this.closed && Date.now() < deadline) await sleep(20);
  }
}

function credentialsFor(label) {
  const suffix = crypto.randomBytes(6).toString('hex');
  // The fixed prefix and trailing digit make the username valid even if a
  // random hex suffix happens to contain no decimal digit.
  return {
    username: 'Tank' + suffix + '7',
    password: 'Tank!' + suffix + 'Pass7',
    name: 'Tank ' + label,
  };
}

async function registerFormal(client, label) {
  const credentials = credentialsFor(label);
  const registered = await client.request(
    'register',
    { authVersion: 2, username: credentials.username, password: credentials.password, lang: 'en-US' },
    message => message.type === 'registered',
    label + ' registration',
  );
  const profile = registered.payload && registered.payload.profile;
  client.uid = String(profile && profile.uid || registered.payload && registered.payload.uid || '');
  client.token = String(registered.token || registered.payload && registered.payload.token || '');
  assert(client.uid && client.token, label + ' registration did not return credentials');
  check(label + ' is a formal username/password account',
    registered.authVersion === 'username-password-v1' && profile && profile.ephemeral !== true,
    JSON.stringify(registered));

  const hello = await client.request(
    'hello',
    { uid: client.uid, token: client.token, proto: 2, capabilities: client.capabilities },
    message => message.type === 'hello_ack',
    label + ' authenticated hello',
  );
  check(label + ' hello is authenticated', hello.authenticated === true, JSON.stringify(hello));
  return hello;
}

async function startTankMatch(host, guest) {
  const created = await host.request(
    'create',
    { capacity: 2, visibility: 'private', allowSpectators: false },
    message => message.type === 'created',
    'room creation',
  );
  const room = String(created.room || '');
  assert(room, 'server returned an empty room id');
  await guest.request('join', { room }, message => message.type === 'joined', 'guest room join');

  const selectedMark = host.mark();
  host.send('select_game', { game: 'tank' });
  await host.waitAfter(
    selectedMark,
    message => message.type === 'room_update' && message.payload && message.payload.game === 'tank',
    'Tank game selection',
  );

   const readyMark = host.mark();
   guest.send('ready', { ready: true });
   await host.waitAfter(readyMark, message => message.type === 'room_update' && message.payload && message.payload.canStart === true, 'guest READY projection');
  const startHostMark = host.mark();
  const startGuestMark = guest.mark();
  host.send('start', {});
  const [startedHost, startedGuest] = await Promise.all([
    host.waitAfter(startHostMark, message => message.type === 'started' && message.game === 'tank', 'host Tank start'),
    guest.waitAfter(startGuestMark, message => message.type === 'started' && message.game === 'tank', 'guest Tank start'),
  ]);
  check('two formal clients enter one Tank authority match',
    startedHost.matchId && startedHost.matchId === startedGuest.matchId &&
      startedHost.gameplay && startedHost.gameplay.protocol === V1_PROTOCOL,
    JSON.stringify({ startedHost, startedGuest }));
  return { room, matchId: String(startedHost.matchId || ''), startHostMark, startGuestMark };
}

function tankSnapshotsSince(client, mark) {
  return client.messages
    .filter(entry => entry.sequence > mark && entry.message && entry.message.type === 'tank_snapshot')
    .map(entry => entry.message);
}

function v2Envelope(payload) {
  if (!payload || typeof payload !== 'object') return true;
  return payload.protocol === V2_PROTOCOL ||
    Object.prototype.hasOwnProperty.call(payload, 'kind') ||
    Object.prototype.hasOwnProperty.call(payload, 'frameId') ||
    Object.prototype.hasOwnProperty.call(payload, 'baseFrameId') ||
    Object.prototype.hasOwnProperty.call(payload, 'payload');
}

async function main() {
  const port = await reservePort();
  // Keep every test side effect outside the repository and explicitly clear
  // the feature flag even if the parent process inherited an opt-in value.
  const env = {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dataDir,
    NODE_ENV: 'test',
    ALLOWED_ORIGINS: 'http://127.0.0.1:' + port,
    SUPABASE_URL: '',
    SUPABASE_KEY: '',
    DEEPSEEK_KEY: '',
    ENABLE_RULE_AUTHORITY_V2: '1',
    ENABLE_TANK_SNAPSHOT_DELTA_V2: '0',
    TANK_MATCH_DURATION_MS: '10000',
    RECONNECT_GRACE_MS: '1000',
  };
  server = spawn(process.execPath, [SERVER], { cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', chunk => { serverOutput += String(chunk); });
  server.stderr.on('data', chunk => { serverOutput += String(chunk); });
  await waitForServer(port);
  check('server launch explicitly sets ENABLE_TANK_SNAPSHOT_DELTA_V2=0', env.ENABLE_TANK_SNAPSHOT_DELTA_V2 === '0');

  const url = 'ws://127.0.0.1:' + port + '/ws';
  const capable = await new WsClient('capable', url, CAPABLE_CAPABILITIES).open();
  const legacy = await new WsClient('legacy', url, LEGACY_CAPABILITIES).open();
  const [capableHello] = await Promise.all([
    registerFormal(capable, 'capable'),
    registerFormal(legacy, 'legacy'),
  ]);
  check('at least one formal client declares tank-snapshot-delta-v2',
    capable.capabilities.includes(V2_PROTOCOL), JSON.stringify(capable.capabilities));
  check('server advertises the v2 capability name',
    Array.isArray(capableHello.capabilities) && capableHello.capabilities.some(value =>
      value === V2_PROTOCOL || value === V2_PROTOCOL.replace(/-/g, '_')),
    JSON.stringify(capableHello.capabilities));

  const match = await startTankMatch(capable, legacy);
  assert(match.matchId, 'Tank start did not provide a match id');
  // These marks were taken immediately before the host's start command, so
  // no authority frame can arrive between `started` handling and collection.
  const snapshotMarks = { capable: match.startHostMark, legacy: match.startGuestMark };
  await Promise.all([
    capable.waitAfter(snapshotMarks.capable, message => message.type === 'tank_snapshot', 'first capable Tank snapshot'),
    legacy.waitAfter(snapshotMarks.legacy, message => message.type === 'tank_snapshot', 'first legacy Tank snapshot'),
  ]);
  // The authority broadcasts at 10Hz. Observe several broadcasts so the
  // assertion covers both the initial and subsequent live frames.
  await sleep(500);
  await sleep(0);

  const capableSnapshots = tankSnapshotsSince(capable, snapshotMarks.capable);
  const legacySnapshots = tankSnapshotsSince(legacy, snapshotMarks.legacy);
  check('capable formal client receives multiple Tank snapshots', capableSnapshots.length >= 2, 'count=' + capableSnapshots.length);
  check('legacy formal client receives multiple Tank snapshots', legacySnapshots.length >= 2, 'count=' + legacySnapshots.length);
  const allSnapshots = [
    ...capableSnapshots.map(payload => ({ recipient: capable.name, payload: payload.payload })),
    ...legacySnapshots.map(payload => ({ recipient: legacy.name, payload: payload.payload })),
  ];
  const wrongProtocol = allSnapshots.filter(item => !item.payload || item.payload.protocol !== V1_PROTOCOL);
  const v2Frames = allSnapshots.filter(item => v2Envelope(item.payload));
  check('every live tank_snapshot remains canonical tank-authority-v1',
    allSnapshots.length > 0 && wrongProtocol.length === 0,
    JSON.stringify(wrongProtocol.slice(0, 2)));
  check('default-off room emits zero v2 envelopes to capable and legacy recipients',
    allSnapshots.length > 0 && v2Frames.length === 0,
    JSON.stringify(v2Frames.slice(0, 2)));
  check('all Tank snapshots carry the started match id',
    allSnapshots.every(item => item.payload.matchId === match.matchId),
    JSON.stringify(allSnapshots.slice(0, 2)));
  check('both recipients remain connected during the capture window', !capable.closed && !legacy.closed);
}

async function stopServer() {
  if (!server || childExited(server)) return;
  await new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(() => {
      if (!childExited(server)) {
        try { server.kill('SIGKILL'); } catch {}
      }
      finish();
    }, 3000);
    server.once('exit', finish);
    try { server.kill(); } catch { finish(); }
    if (childExited(server)) finish();
  });
}

async function cleanup() {
  await Promise.all(clients.map(client => client.close().catch(() => {})));
  await stopServer();
  try {
    fs.rmSync(dataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  } catch (error) {
    failures += 1;
    console.error('TANK_SNAPSHOT_DEFAULT_OFF_DATA_CLEANUP_ERROR', error && error.message || error);
  }
  if (fs.existsSync(dataDir)) {
    failures += 1;
    console.error('TANK_SNAPSHOT_DEFAULT_OFF_DATA_DIR_REMAINS', dataDir);
  }
}

main()
  .catch(error => {
    failures += 1;
    console.error('TANK_SNAPSHOT_DEFAULT_OFF_ONLINE_CRASH', error && error.stack || error);
    if (serverOutput) console.error(serverOutput.slice(-3000));
  })
  .finally(async () => {
    await cleanup();
    console.log(failures ? 'TANK_SNAPSHOT_DEFAULT_OFF_ONLINE_HAS_FAILURES' : 'TANK_SNAPSHOT_DEFAULT_OFF_ONLINE_ALL_PASS');
    process.exitCode = failures ? 1 : 0;
  });
