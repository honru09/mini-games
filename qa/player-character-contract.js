'use strict';

// Player Character v1 contract and live authority regression.
// Node 20: node --experimental-websocket qa/player-character-contract.js

const fs = require('fs');
const http = require('http');
const net = require('net');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const {
  SCHEMA_VERSION,
  PLAYER_CHARACTER_CATALOG,
  DEFAULT_PLAYER_CHARACTER,
  normalizeStored,
  publicPresentation,
} = require('../server/player-character');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const failures = [];
const clients = [];
let server = null;
let serverOutput = '';
let dataDir = null;

function check(name, value, detail) {
  const ok = !!value;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail && !ok ? ' :: ' + detail : ''));
  if (!ok) failures.push(name);
  return ok;
}

function exact(value) {
  return JSON.stringify(value) === JSON.stringify(DEFAULT_PLAYER_CHARACTER);
}

function publicShape(value) {
  return !!value && Object.keys(value).sort().join(',') === 'characterId,schemaVersion,slots' &&
    value.schemaVersion === SCHEMA_VERSION && value.slots &&
    Object.keys(value.slots).sort().join(',') === 'accessory,body,bottom,face,footwear,hair,top';
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function httpGet(port, requestPath) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: requestPath || '/' }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
  });
}

async function waitServer(port) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (server && server.exitCode !== null) throw new Error('server exited: ' + serverOutput.slice(-3000));
    try { if (await httpGet(port, '/api/ip') === 200) return; } catch {}
    await sleep(50);
  }
  throw new Error('server start timeout: ' + serverOutput.slice(-3000));
}

class Client {
  constructor(name, url) {
    this.name = name;
    this.url = url;
    this.messages = [];
    this.sequence = 0;
    this.closed = false;
  }
  async open() {
    this.ws = new WebSocket(this.url);
    this.ws.addEventListener('message', event => {
      try { this.messages.push({ seq: ++this.sequence, value: JSON.parse(String(event.data)) }); } catch {}
    });
    this.ws.addEventListener('close', () => { this.closed = true; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.name + ' open timeout')), 5000);
      this.ws.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      this.ws.addEventListener('error', () => { clearTimeout(timer); reject(new Error(this.name + ' open failed')); }, { once: true });
    });
    clients.push(this);
    return this;
  }
  mark() { return this.sequence; }
  send(type, payload) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error(this.name + ' is not open');
    this.ws.send(JSON.stringify({ type, ...(payload === undefined ? {} : { payload }) }));
  }
  async waitAfter(mark, predicate, label, timeout = 7000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this.messages.find(item => item.seq > mark && predicate(item.value));
      if (found) return found.value;
      if (this.closed) throw new Error(this.name + ' closed while waiting for ' + label);
      await sleep(20);
    }
    throw new Error(this.name + ' wait timeout for ' + label + '; tail=' + this.messages.slice(-8).map(item => item.value.type).join(','));
  }
  async request(type, payload, predicate, label, timeout) {
    const mark = this.mark();
    this.send(type, payload);
    return this.waitAfter(mark, predicate, label, timeout);
  }
  close() {
    try { if (this.ws && this.ws.readyState < 2) this.ws.close(); } catch {}
  }
}

async function register(client, uid, pin) {
  const response = await client.request('register', { uid, pin, name: uid }, message => message.type === 'registered' || message.type === 'auth_error', 'register');
  if (response.type !== 'registered') throw new Error(client.name + ' register rejected: ' + JSON.stringify(response));
  const payload = response.payload || {};
  return { uid: String(payload.uid || ''), token: String(response.token || payload.token || ''), profile: payload.profile || null };
}

function hello(client, credentials) {
  return client.request('hello', { uid: credentials.uid, token: credentials.token, proto: 1, capabilities: ['match-expression-v1'] }, message => message.type === 'hello_ack' || message.type === 'auth_error', 'hello');
}

async function runPureContract() {
  check('module exports a frozen schema/catalog/default', SCHEMA_VERSION === 'player-character-v1' && Object.isFrozen(PLAYER_CHARACTER_CATALOG) && Object.isFrozen(DEFAULT_PLAYER_CHARACTER) && Object.isFrozen(DEFAULT_PLAYER_CHARACTER.slots));
  check('missing/old/unknown schema falls back', exact(normalizeStored()) && exact(normalizeStored(null)) && exact(normalizeStored({ schemaVersion: 'player-character-v0' })) && exact(normalizeStored({ schemaVersion: 'future' })));
  check('non-record and oversized values fall back', exact(normalizeStored([])) && exact(normalizeStored('player-character-v1')) && exact(normalizeStored({ schemaVersion: SCHEMA_VERSION, characterId: 'x'.repeat(65) })));
  const valid = { schemaVersion: SCHEMA_VERSION, characterId: 'character-base-01', slots: { ...DEFAULT_PLAYER_CHARACTER.slots } };
  const before = JSON.stringify(valid);
  const normalized = normalizeStored(valid);
  check('valid v1 is normalized without mutating input', exact(normalized) && JSON.stringify(valid) === before);
  check('unknown character/slot IDs fall back per field', exact(normalizeStored({ schemaVersion: SCHEMA_VERSION, characterId: 'character-unknown', slots: { body: 'body-unknown', face: 'face-dot-01' } })));
  check('unknown fields are discarded while known IDs survive', exact(normalizeStored({ ...valid, owned: { coins: 999 }, price: 1, slots: { ...valid.slots, unknown: 'unknown' } })));
  const polluted = JSON.parse('{"schemaVersion":"player-character-v1","characterId":"character-base-01","slots":{"body":"body-paper-01","__proto__":{"polluted":true}},"__proto__":{"polluted":true},"constructor":{"polluted":true},"owned":{"coins":999}}');
  check('prototype-pollution keys cannot enter normalized state', exact(normalizeStored(polluted)) && !({}).polluted);
  const first = normalizeStored(valid);
  first.slots.body = 'tampered';
  const second = normalizeStored(valid);
  check('each call returns isolated mutable copies', second.slots.body === DEFAULT_PLAYER_CHARACTER.slots.body && first.slots !== second.slots);
  const projected = publicPresentation({ ...valid, owned: { coins: 999 }, token: 'secret', password: 'secret', slots: { ...valid.slots, private: 'x' } });
  check('public projection has only stable public keys', publicShape(projected) && !JSON.stringify(projected).includes('secret') && !Object.prototype.hasOwnProperty.call(projected, 'owned'));
  projected.slots.body = 'tampered';
  check('public projection is isolated from default/catalog', publicPresentation(valid).slots.body === DEFAULT_PLAYER_CHARACTER.slots.body && PLAYER_CHARACTER_CATALOG.slots.body[0] === DEFAULT_PLAYER_CHARACTER.slots.body);
}

async function runLiveContract() {
  if (typeof WebSocket !== 'function') throw new Error('Node 20 requires --experimental-websocket');
  const port = await reservePort();
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mini-games-player-character-'));
  server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DATA_DIR: dataDir, NODE_ENV: 'test', SUPABASE_URL: '', SUPABASE_KEY: '', DEEPSEEK_KEY: '', RECONNECT_GRACE_MS: '1500' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', data => { serverOutput += String(data); });
  server.stderr.on('data', data => { serverOutput += String(data); });
  await waitServer(port);
  const url = 'ws://127.0.0.1:' + port + '/ws';
  const host = await new Client('host', url).open();
  const peer = await new Client('peer', url).open();
  const suffix = Date.now().toString(36);
  const hostAuth = await register(host, 'u_pchost' + suffix, 'PcHostA1' + suffix);
  const peerAuth = await register(peer, 'u_pcpeer' + suffix, 'PcPeerA1' + suffix);
  check('new accounts receive deterministic Player Character projection', publicShape(hostAuth.profile && hostAuth.profile.playerCharacter) && publicShape(peerAuth.profile && peerAuth.profile.playerCharacter));
  await hello(host, hostAuth);
  await hello(peer, peerAuth);

  const mutationMark = host.mark();
  host.send('profile', { uid: hostAuth.uid, name: hostAuth.uid, playerCharacter: { schemaVersion: SCHEMA_VERSION, characterId: 'character-hacked', slots: { body: 'body-hacked' }, owned: { coins: 999999 }, token: 'secret' } });
  const profileOk = await host.waitAfter(mutationMark, message => message.type === 'profile_ok', 'profile mutation response');
  const mutatedProfile = profileOk.payload && (profileOk.payload.profile || profileOk.payload);
  check('client profile mutation cannot write/forge Player Character', publicShape(mutatedProfile && mutatedProfile.playerCharacter) && exact(mutatedProfile.playerCharacter));

  const publicMark = peer.mark();
  peer.send('profile_get', { uid: hostAuth.uid });
  const publicReply = await peer.waitAfter(publicMark, message => message.type === 'profile_data', 'public profile');
  const publicProfile = publicReply.payload || {};
  check('public Profile exposes the same safe projection without private character fields', publicShape(publicProfile.playerCharacter) && !Object.prototype.hasOwnProperty.call(publicProfile.playerCharacter, 'owned') && !Object.prototype.hasOwnProperty.call(publicProfile.playerCharacter, 'coins') && !Object.prototype.hasOwnProperty.call(publicProfile.playerCharacter, 'token'));

  const createdMark = host.mark();
  host.send('create', { capacity: 2 });
  const created = await host.waitAfter(createdMark, message => message.type === 'created', 'room creation');
  const joinMark = peer.mark();
  peer.send('join', { room: created.room });
  await peer.waitAfter(joinMark, message => message.type === 'joined', 'room join');
  const roomUpdate = await host.waitAfter(createdMark, message => message.type === 'room_update' && message.payload && message.payload.size === 2, 'room seats');
  const seats = roomUpdate.payload.seats || [];
  check('Room Seat carries the same safe projection for each human', seats.filter(seat => seat && seat.type === 'human').length === 2 && seats.filter(seat => seat && seat.type === 'human').every(seat => publicShape(seat.playerCharacter) && exact(seat.playerCharacter)));

  const selectMark = host.mark();
  host.send('select_game', { game: 'gomoku' });
  await host.waitAfter(selectMark, message => message.type === 'room_update' && message.payload && message.payload.game === 'gomoku', 'game selection');
  // READY is delivered on a different WebSocket.  Synchronize on the
  // authoritative room projection before asking the host to start; otherwise
  // a valid peer READY can legitimately arrive after the host's start command
  // and the contract would intermittently observe room_not_ready.
  const readyMark = host.mark();
  peer.send('ready', { ready: true });
  await host.waitAfter(readyMark, message => {
    const payload = message && message.type === 'room_update' && message.payload;
    const humans = payload && Array.isArray(payload.seats) ? payload.seats.filter(seat => seat && seat.type === 'human') : [];
    return !!(payload && payload.canStart === true && humans.length === 2 && humans.every(seat => seat.ready === true));
  }, 'peer READY projection');
  const startMark = host.mark();
  host.send('start', {});
  await host.waitAfter(startMark, message => message.type === 'started', 'match start');
  const reconnectMark = host.mark();
  peer.send('debug_disconnect');
  await host.waitAfter(reconnectMark, message => message.type === 'peer_status' && message.payload && message.payload.online === false, 'peer offline');
  const peer2 = await new Client('peer-reconnect', url).open();
  const rejoinMark = peer2.mark();
  peer2.send('hello', { uid: peerAuth.uid, token: peerAuth.token, proto: 1, capabilities: ['match-expression-v1'] });
  const rejoined = await peer2.waitAfter(rejoinMark, message => message.type === 'rejoined', 'rejoin');
  const rejoinSeats = rejoined.payload && rejoined.payload.seats || [];
  const restoredSeat = rejoinSeats.find(seat => seat && seat.userId === peerAuth.uid);
  check('reconnect restores the same Player Character projection', restoredSeat && publicShape(restoredSeat.playerCharacter) && exact(restoredSeat.playerCharacter));
  peer2.close();
}

async function main() {
  await runPureContract();
  await runLiveContract();
}

main().catch(error => {
  console.error('PLAYER_CHARACTER_CRASH', error && error.stack || error);
  failures.push('unexpected crash');
}).finally(async () => {
  clients.forEach(client => client.close());
  if (server && server.exitCode === null) server.kill();
  await sleep(100);
  if (dataDir) try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
  console.log(failures.length ? 'PLAYER_CHARACTER_CONTRACT_HAS_FAILURES' : 'PLAYER_CHARACTER_CONTRACT_ALL_PASS');
  process.exitCode = failures.length ? 1 : 0;
});
