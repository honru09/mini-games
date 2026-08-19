'use strict';

// Playline Community P0 online contract.
//
// This test deliberately crosses only the public WebSocket wire seam.  Each
// run launches a fresh local server with its own DATA_DIR and port, so the
// assertions cover the server authority (auth/session, social graph, reward
// references, cursor signing, persistence and reconnect) rather than a
// mocked Playline module.  It is intentionally not a production smoke test:
// real Supabase/RLS/multi-instance gates remain outside this local contract.
//
// Node 20: node --experimental-websocket qa/playline-online.js
// Node 22+: node qa/playline-online.js

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = global.WebSocket || require('ws');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const CAPABILITY = 'playline-v1';
const TEST_ADMIN = Object.freeze({
  uid: 'u_playlineadmin',
  username: 'PlaylineAdmin9',
  password: 'QaPlaylineAdmin9!',
});
const clients = [];
const servers = [];
const failures = [];
let postCounter = 0;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function check(name, value, detail) {
  const ok = !!value;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail && !ok ? ' :: ' + detail : ''));
  if (!ok) failures.push(name);
  return ok;
}
function clientPostId(label) {
  postCounter += 1;
  return 'pl-' + label + '-' + String(postCounter).padStart(6, '0') + '-' + crypto.randomBytes(3).toString('hex');
}
function requestId(label) {
  return 'req-' + label + '-' + String(postCounter + 1).padStart(6, '0') + '-' + crypto.randomBytes(3).toString('hex');
}
function profileFrom(message) {
  const payload = message && message.payload && typeof message.payload === 'object' ? message.payload : {};
  return payload.profile && typeof payload.profile === 'object' ? payload.profile : payload;
}
function uidFrom(message) {
  const profile = profileFrom(message);
  return String((profile && profile.uid) || (message && message.uid) || '');
}
function tokenFrom(message) {
  return String((message && message.token) || (message && message.payload && message.payload.token) || '');
}
function reasonFrom(message) {
  return String((message && message.reason) || (message && message.payload && message.payload.reason) || '');
}
function tail(value, max = 2400) {
  return String(value || '').slice(-max);
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(error => error ? reject(error) : resolve(value));
    });
  });
}

function httpStatus(port, pathname = '/') {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: pathname }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
  });
}

async function waitServer(record) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (record.child.exitCode !== null) {
      throw new Error(record.label + ' exited before health check: ' + tail(record.log));
    }
    try {
      if (await httpStatus(record.port) === 200) return;
    } catch {}
    await sleep(45);
  }
  throw new Error(record.label + ' did not become healthy: ' + tail(record.log));
}

async function startServer(label, enabled, testAdmin = false) {
  const port = await reservePort();
  const dataDir = fs.mkdtempSync(path.join(ROOT, 'data', 'playline-online-'));
  const record = { label, port, dataDir, log: '', child: null, stopped: false };
  const env = {
    ...process.env,
    PORT: String(port),
    DATA_DIR: dataDir,
    NODE_ENV: 'test',
    SUPABASE_URL: '',
    SUPABASE_KEY: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
    DEEPSEEK_KEY: '',
    ENABLE_PLAYLINE_V1: enabled ? '1' : '0',
    PLAYLINE_CURSOR_SECRET: 'qa-playline-cursor-' + crypto.randomBytes(12).toString('hex'),
    RECONNECT_GRACE_MS: '3000',
    REWARD_TEST_MIN_DURATION_MS: '0',
    REWARD_TEST_MIN_ACTIONS: '0',
    REWARD_TEST_MIN_UNIQUE_ACTIONS: '0',
    REWARD_TEST_MIN_PLAYER_ACTIONS: '0',
    TEST_ADMIN_ENABLED: testAdmin ? '1' : '0',
    TEST_ADMIN_UID: testAdmin ? TEST_ADMIN.uid : '',
    TEST_ADMIN_USERNAME: testAdmin ? TEST_ADMIN.username : '',
    TEST_ADMIN_PASSWORD: testAdmin ? TEST_ADMIN.password : '',
  };
  record.child = spawn(process.execPath, [SERVER], {
    cwd: ROOT,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const capture = chunk => { record.log = (record.log + String(chunk)).slice(-20000); };
  record.child.stdout.on('data', capture);
  record.child.stderr.on('data', capture);
  servers.push(record);
  await waitServer(record);
  console.log('INFO  ' + label + ' isolated server on 127.0.0.1:' + port);
  return record;
}

async function stopServer(record) {
  if (!record || record.stopped) return;
  record.stopped = true;
  if (record.child && record.child.exitCode === null) {
    await new Promise(resolve => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      const timer = setTimeout(finish, 1800);
      record.child.once('exit', () => { clearTimeout(timer); finish(); });
      try { record.child.kill(); } catch { clearTimeout(timer); finish(); }
    });
  }
}

class Client {
  constructor(label, server) {
    this.label = label;
    this.server = server;
    this.url = 'ws://127.0.0.1:' + server.port + '/ws';
    this.messages = [];
    this.waiters = [];
    this.sequence = 0;
    this.ws = null;
    this.uid = '';
    this.token = '';
    this.username = '';
    this.password = '';
    this.capabilityAck = null;
  }

  async open() {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = event => {
      let value;
      try { value = JSON.parse(String(event.data)); } catch { return; }
      const entry = { sequence: ++this.sequence, value };
      let index = -1;
      for (let i = 0; i < this.waiters.length; i += 1) {
        try {
          if (this.waiters[i].predicate(value)) { index = i; break; }
        } catch {}
      }
      if (index >= 0) {
        const waiter = this.waiters.splice(index, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(value);
      } else {
        this.messages.push(entry);
      }
    };
    this.ws.onclose = () => {
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error(this.label + ' socket closed while waiting'));
      }
    };
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.label + ' WebSocket open timeout')), 7000);
      this.ws.onopen = () => { clearTimeout(timer); resolve(); };
      this.ws.onerror = error => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(this.label + ' WebSocket error')); };
    });
    clients.push(this);
    return this;
  }

  mark() { return this.sequence; }

  send(type, payload) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error(this.label + ' WebSocket is not open');
    this.ws.send(JSON.stringify({ type, payload }));
  }

  wait(predicate, description, after = 0, timeout = 8000) {
    const found = this.messages.find(entry => entry.sequence > after && predicate(entry.value));
    if (found) {
      this.messages.splice(this.messages.indexOf(found), 1);
      return Promise.resolve(found.value);
    }
    return new Promise((resolve, reject) => {
      const waiter = {
        predicate: value => {
          if (this.sequence <= after) return false;
          return predicate(value);
        },
        resolve,
        reject,
        timer: null,
      };
      waiter.timer = setTimeout(() => {
        this.waiters = this.waiters.filter(item => item !== waiter);
        reject(new Error(this.label + ' timeout waiting for ' + description + '; tail=' + JSON.stringify(this.messages.slice(-5).map(item => item.value.type))));
      }, timeout);
      this.waiters.push(waiter);
    });
  }

  async request(type, payload, predicate, description, timeout = 8000) {
    const mark = this.mark();
    this.send(type, payload);
    return this.wait(predicate, description, mark, timeout);
  }

  drain(predicate) {
    if (!predicate) { this.messages = []; return; }
    this.messages = this.messages.filter(entry => !predicate(entry.value));
  }

  close() {
    try { if (this.ws && this.ws.readyState < 2) this.ws.close(); } catch {}
  }
}

async function hello(client, uid, token, capabilities) {
  const ack = await client.request('hello', { uid: uid || null, token: token || null, capabilities }, message => message.type === 'hello_ack', 'hello_ack');
  client.capabilityAck = ack;
  if (ack.authenticated === true && uid && token) {
    client.uid = String(uid);
    client.token = String(token);
  }
  return ack;
}

async function openClient(server, label, capabilities = [CAPABILITY]) {
  const client = await new Client(label, server).open();
  await hello(client, null, null, capabilities);
  return client;
}

async function registerFormal(server, label, capabilities = [CAPABILITY], displayName = label) {
  const client = await openClient(server, label, capabilities);
  const suffix = crypto.randomBytes(6).toString('hex');
  client.username = 'P9' + suffix;
  client.password = 'Playline9!' + suffix;
  const message = await client.request('register', {
    authVersion: 2,
    username: client.username,
    password: client.password,
    name: displayName,
    lang: 'en-US',
    avatar: 100,
  }, value => value.type === 'registered' || value.type === 'auth_error', 'register');
  if (message.type !== 'registered') throw new Error(label + ' registration failed: ' + JSON.stringify(message));
  client.uid = uidFrom(message);
  client.token = tokenFrom(message);
  if (!client.uid || !client.token) throw new Error(label + ' registration omitted uid/token');
  check(label + ' receives a formal account token', !profileFrom(message).ephemeral && !!client.uid && !!client.token);
  return client;
}

async function loginAdmin(server) {
  const client = await openClient(server, 'test-admin', [CAPABILITY]);
  const message = await client.request('login', {
    authVersion: 2,
    username: TEST_ADMIN.username,
    password: TEST_ADMIN.password,
  }, value => value.type === 'logged_in' || value.type === 'auth_error', 'test-admin login');
  if (message.type !== 'logged_in') throw new Error('test-admin login failed: ' + JSON.stringify(message));
  client.uid = uidFrom(message);
  client.token = tokenFrom(message);
  check('test-admin login returns the configured isolated uid', client.uid === TEST_ADMIN.uid && !!client.token);
  return client;
}

async function loginGuest(server) {
  const client = await openClient(server, 'guest', [CAPABILITY]);
  const message = await client.request('guest_login', { lang: 'en-US' }, value => value.type === 'guest_logged_in' || value.type === 'auth_error', 'guest login');
  if (message.type !== 'guest_logged_in') throw new Error('guest login failed: ' + JSON.stringify(message));
  client.uid = uidFrom(message);
  client.token = tokenFrom(message);
  client.ephemeral = true;
  return client;
}

async function playlineError(client, action, reason, payload = {}, description = action + ' ' + reason) {
  return client.request('playline_' + action.replace(/^playline_/, ''), payload,
    message => message.type === 'playline_error' && message.payload && message.payload.action === action &&
      (!reason || message.payload.reason === reason), description);
}

async function publish(client, clientPostIdValue, audience, content, extra = {}) {
  return client.request('playline_publish', {
    ...extra,
    clientPostId: clientPostIdValue,
    audience,
    content,
  }, message => message.type === 'playline_publish_ok' && message.payload && message.payload.clientPostId === clientPostIdValue,
  'publish ' + clientPostIdValue);
}

async function publishExpectError(client, clientPostIdValue, audience, content, reason, extra = {}) {
  return client.request('playline_publish', {
    ...extra,
    clientPostId: clientPostIdValue,
    audience,
    content,
  }, message => message.type === 'playline_error' && message.payload && message.payload.action === 'playline_publish' &&
    message.payload.clientPostId === clientPostIdValue && message.payload.reason === reason,
  'publish error ' + reason);
}

async function listFeed(client, filter, limit = 30, cursor) {
  const payload = { filter, limit };
  if (cursor !== undefined && cursor !== null && cursor !== '') payload.cursor = cursor;
  return client.request('playline_list', payload,
    message => message.type === 'playline_state' && message.payload && message.payload.filter === filter,
    'list ' + filter);
}

async function removePost(client, postId, request) {
  return client.request('playline_remove', { postId, requestId: request },
    message => message.type === 'playline_remove_ok' && message.payload && message.payload.postId === postId,
    'remove ' + postId);
}

async function makeFriends(a, b) {
  const sent = await a.request('friend_request', { toUid: b.uid },
    message => message.type === 'social_ok' && message.action === 'sent', 'friend request');
  const request = sent.requestId;
  if (!request) throw new Error('friend request omitted requestId');
  return b.request('friend_request_action', { action: 'accept', requestId: request },
    message => message.type === 'social_ok' && message.action === 'accepted', 'friend accept');
}

async function removeFriend(a, b) {
  return a.request('friend_remove', { uid: b.uid },
    message => message.type === 'social_ok' && message.action === 'removed', 'friend remove');
}

async function block(a, b) {
  return a.request('block', { uid: b.uid },
    message => message.type === 'social_ok' && (message.action === 'blocked' || message.action === 'idempotent'), 'block');
}

async function unblock(a, b) {
  return a.request('unblock', { uid: b.uid },
    message => message.type === 'social_ok' && message.action === 'unblocked', 'unblock');
}

async function startSettledGomoku(a, b) {
  const created = await a.request('create', { capacity: 2, visibility: 'private', allowSpectators: false },
    message => message.type === 'created', 'create room');
  const room = String(created.room || '').toUpperCase();
  if (!room) throw new Error('room creation omitted room id');
  await b.request('join', { room }, message => message.type === 'joined' && message.room === room, 'join room');
  await a.request('select_game', { game: 'gomoku' },
    message => message.type === 'room_update' && message.payload && message.payload.game === 'gomoku', 'select gomoku');
  const readyMark = a.mark();
  b.send('ready', { ready: true });
  await a.wait(message => message.type === 'room_update' && message.payload && message.payload.canStart === true, 'room ready', readyMark);

  const startMarkA = a.mark();
  const startMarkB = b.mark();
  a.send('start', {});
  const [startedA, startedB] = await Promise.all([
    a.wait(message => message.type === 'started', 'started A', startMarkA),
    b.wait(message => message.type === 'started', 'started B', startMarkB),
  ]);
  const matchId = String(startedA.matchId || '');
  check('online tracer match receives a shared server matchId', !!matchId && matchId === startedB.matchId && startedA.size === 2);

  const moveMarkB = b.mark();
  a.send('move', { r: 7, c: 7 });
  await b.wait(message => message.type === 'move' && message.player === 0 && message.payload && message.payload.r === 7 && message.payload.c === 7, 'first gomoku move', moveMarkB);
  const moveMarkA = a.mark();
  b.send('move', { r: 7, c: 8 });
  await a.wait(message => message.type === 'move' && message.player === 1 && message.payload && message.payload.r === 7 && message.payload.c === 8, 'second gomoku move', moveMarkA);

  const results = [
    { slot: 0, rank: 1, coins: 1 },
    { slot: 1, rank: 2, coins: 0 },
  ];
  const pendingMark = a.mark();
  a.send('result', { matchId, game: 'gomoku', results });
  await a.wait(message => message.type === 'result_pending' && message.matchId === matchId, 'pending result', pendingMark);
  const resultMarkA = a.mark();
  const resultMarkB = b.mark();
  b.send('result', { matchId, game: 'gomoku', results });
  const [resultA, resultB] = await Promise.all([
    a.wait(message => message.type === 'result_ok' && message.matchId === matchId, 'result A', resultMarkA),
    b.wait(message => message.type === 'result_ok' && message.matchId === matchId, 'result B', resultMarkB),
  ]);
  const rewardA = resultA.payload && resultA.payload.reward;
  check('online result consensus is eligible for the Playline result reference', rewardA && rewardA.eligible === true,
    JSON.stringify(rewardA));
  return {
    room,
    matchId,
    aResultId: String(resultA.payload && resultA.payload.resultId || ''),
    bResultId: String(resultB.payload && resultB.payload.resultId || ''),
  };
}

function tamperCursor(cursor) {
  const source = String(cursor || '');
  if (!source) return 'tampered.cursor';
  const last = source.length - 1;
  return source.slice(0, last) + (source[last] === 'A' ? 'B' : 'A');
}

function readDb(record) {
  const file = path.join(record.dataDir, 'leaderboard.json');
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

async function runDefaultOffTracer() {
  const record = await startServer('playline-default-off', false, false);
  let client = null;
  try {
    client = await registerFormal(record, 'default-off-formal', [CAPABILITY], 'Default Off');
    const advertised = Array.isArray(client.capabilityAck && client.capabilityAck.capabilities) && client.capabilityAck.capabilities.includes(CAPABILITY);
    check('tracer: default-off server omits playline-v1 capability', !advertised);
    const disabled = await playlineError(client, 'playline_list', 'feature_disabled', {}, 'default-off list');
    check('tracer: default-off server rejects Playline reads', reasonFrom(disabled) === 'feature_disabled');
    if (!advertised && reasonFrom(disabled) === 'feature_disabled') console.log('TRACER_PASS default-off capability/read boundary');
  } finally {
    if (client) client.close();
    await stopServer(record);
  }
}

async function runEnabledSuite() {
  const server = await startServer('playline-enabled', true, true);
  const a = await registerFormal(server, 'A', [CAPABILITY], 'Playline Alpha');
  const b = await registerFormal(server, 'B', [CAPABILITY], 'Playline Beta');
  const legacy = await registerFormal(server, 'legacy-no-capability', [], 'Legacy Reader');
  const guest = await loginGuest(server);
  const admin = await loginAdmin(server);

  check('enabled server advertises playline-v1', Array.isArray(a.capabilityAck && a.capabilityAck.capabilities) && a.capabilityAck.capabilities.includes(CAPABILITY));
  check('formal accounts are persistent and distinct', !a.ephemeral && !b.ephemeral && a.uid !== b.uid);

  const empty = await listFeed(a, 'all', 20);
  check('formal account can read an empty Playline page', empty.payload && Array.isArray(empty.payload.posts) && empty.payload.posts.length === 0);

  const match = await startSettledGomoku(a, b);
  check('result IDs are server-issued and account-scoped', /^.+:0$/.test(match.aResultId) && /^.+:1$/.test(match.bResultId) && match.aResultId !== match.bResultId);

  const legacyError = await playlineError(legacy, 'playline_list', 'unsupported_capability', {}, 'legacy capability denial');
  check('formal client without negotiated capability is denied', reasonFrom(legacyError) === 'unsupported_capability');
  const guestError = await playlineError(guest, 'playline_list', 'guest_forbidden', {}, 'guest denial');
  check('guest cannot read or write Playline', reasonFrom(guestError) === 'guest_forbidden');
  const adminError = await playlineError(admin, 'playline_list', 'test_admin_isolated', {}, 'test-admin denial');
  check('test-admin content is isolated from Playline', reasonFrom(adminError) === 'test_admin_isolated');

  const forgedOuter = {
    authorUid: 'forged-author',
    author: { uid: 'forged-author' },
    id: 'forged-post-id',
    seq: '999999',
    createdAt: 0,
    updatedAt: 0,
    serverTime: 0,
  };
  const textId = clientPostId('text');
  const textMarker = 'PlaylineRawMarker-' + crypto.randomBytes(5).toString('hex');
  const textBefore = Date.now();
  const textResponse = await publish(a, textId, 'all', { kind: 'text', text: '  ' + textMarker + '\r\n世界\u202E  ' }, forgedOuter);
  const textPost = textResponse.payload.post;
  check('text share is normalized and server-authoritative',
    textPost && textPost.author && textPost.author.uid === a.uid &&
    Number.isInteger(textPost.createdAt) && textPost.createdAt >= textBefore &&
    textPost.content && textPost.content.kind === 'text' && textPost.content.text === textMarker + '\n世界' &&
    textPost.id !== forgedOuter.id && !Object.prototype.hasOwnProperty.call(textPost, 'seq'));

  const gameId = clientPostId('game');
  const gameResponse = await publish(a, gameId, 'all', { kind: 'game_share', gameId: 'tetris' }, forgedOuter);
  const gamePost = gameResponse.payload.post;
  check('game share accepts only the canonical game projection',
    gamePost && gamePost.author.uid === a.uid && gamePost.content.kind === 'game_share' && gamePost.content.gameId === 'tetris' &&
    Object.keys(gamePost.content).length === 2);
  const badShapeId = clientPostId('badshape');
  const badShape = await publishExpectError(a, badShapeId, 'all', { kind: 'game_share', gameId: 'gomoku', title: 'forged caption' }, 'invalid_post_shape');
  check('game share rejects client captions and extra fields', reasonFrom(badShape) === 'invalid_post_shape');

  const forgedResultId = clientPostId('forged-result');
  const forgedResult = await publishExpectError(a, forgedResultId, 'friends', { kind: 'result_share', resultId: match.bResultId }, 'result_unavailable', forgedOuter);
  check('result share rejects another player result and forged authority', reasonFrom(forgedResult) === 'result_unavailable');
  const resultId = clientPostId('result');
  const resultResponse = await publish(a, resultId, 'friends', { kind: 'result_share', resultId: match.aResultId }, forgedOuter);
  const resultPost = resultResponse.payload.post;
  check('result share is derived from the formal settled result',
    resultPost && resultPost.author.uid === a.uid && resultPost.content.kind === 'result_share' &&
    resultPost.content.gameId === 'gomoku' && resultPost.content.outcome === 'win' &&
    !JSON.stringify(resultPost).includes(match.aResultId) && !JSON.stringify(resultPost).includes('resultId'));

  const recordId = clientPostId('record');
  const recordResponse = await publish(b, recordId, 'friends', { kind: 'record_share', replayId: 'game_wins:gomoku' }, forgedOuter);
  const recordPost = recordResponse.payload.post;
  check('record share is derived from the authoritative profile record',
    recordPost && recordPost.author.uid === b.uid && recordPost.content.kind === 'record_share' &&
    recordPost.content.record === 'game_wins:gomoku' && !JSON.stringify(recordPost).includes('game_wins:gomoku' + '-forged') &&
    !JSON.stringify(recordPost).includes('replayId'));

  const bTextId = clientPostId('btext');
  const bTextResponse = await publish(b, bTextId, 'all', { kind: 'text', text: 'Beta public text' });
  const bGameId = clientPostId('bgame');
  const bGameResponse = await publish(b, bGameId, 'all', { kind: 'game_share', gameId: 'ludo' });
  check('both formal authors can publish the four wire-visible content families',
    !!textPost && !!gamePost && !!resultPost && !!recordPost && !!bTextResponse.payload.post && !!bGameResponse.payload.post);

  const duplicate = await publish(a, textId, 'all', { kind: 'text', text: '  ' + textMarker + '\r\n世界\u202E  ' }, { authorUid: 'different-forged-author', createdAt: 1 });
  check('same author/clientPostId and normalized intent replay idempotently',
    duplicate.payload.duplicate === true && duplicate.payload.replayed === true && duplicate.payload.post.id === textPost.id);
  const conflict = await publishExpectError(a, textId, 'all', { kind: 'text', text: 'conflicting body' }, 'idempotency_conflict');
  check('same clientPostId with a conflicting intent is rejected', reasonFrom(conflict) === 'idempotency_conflict');

  const rateId = clientPostId('rate');
  const rate = await publishExpectError(a, rateId, 'all', { kind: 'game_share', gameId: 'tank' }, 'rate_limited');
  check('publish rate limit is author-scoped and server-enforced', reasonFrom(rate) === 'rate_limited');

  const beforeFriendAll = await listFeed(b, 'all', 30);
  const beforeFriendFriends = await listFeed(b, 'friends', 30);
  check('Friends feed hides a non-friend friends-only share while All keeps public text',
    beforeFriendAll.payload.posts.some(post => post.id === textPost.id) &&
    !beforeFriendAll.payload.posts.some(post => post.id === resultPost.id) &&
    !beforeFriendFriends.payload.posts.some(post => post.id === resultPost.id));

  await makeFriends(a, b);
  const afterFriendFriends = await listFeed(b, 'friends', 30);
  const afterFriendAll = await listFeed(b, 'all', 30);
  check('friendship immediately exposes the friends feed and All projection',
    afterFriendFriends.payload.posts.some(post => post.id === resultPost.id) &&
    afterFriendFriends.payload.posts.some(post => post.id === recordPost.id) &&
    afterFriendAll.payload.posts.some(post => post.id === resultPost.id));

  const reportResponse = await b.request('report', {
    // The targetUid is deliberately forged; the Playline resolver must bind
    // the report to the stored post author instead.
    targetUid: b.uid,
    reason: 'spam',
    contextType: 'playline',
    contextId: textPost.id,
  }, message => message.type === 'social_ok' && message.action === 'reported', 'Playline report');
  check('Playline report returns a server report id', !!reportResponse.reportId);

  const removedFriend = await removeFriend(a, b);
  check('removing friendship returns an authoritative social transition', removedFriend.action === 'removed');
  const afterRemoveFriends = await listFeed(b, 'friends', 30);
  const afterRemoveAll = await listFeed(b, 'all', 30);
  check('removing friendship immediately hides friends-only content without hiding public text',
    !afterRemoveFriends.payload.posts.some(post => post.id === resultPost.id) &&
    !afterRemoveAll.payload.posts.some(post => post.id === resultPost.id) &&
    afterRemoveAll.payload.posts.some(post => post.id === textPost.id));
  await makeFriends(a, b);

  const unauthorizedRemove = await b.request('playline_remove', { postId: textPost.id, requestId: requestId('forged-delete') },
    message => message.type === 'playline_error' && message.payload && message.payload.action === 'playline_remove', 'cross-account delete');
  check('a different account cannot delete the author post', reasonFrom(unauthorizedRemove) === 'post_unavailable');
  const deleteRequest = requestId('delete');
  const deleted = await removePost(a, gamePost.id, deleteRequest);
  const deletedAgain = await removePost(a, gamePost.id, deleteRequest);
  check('delete is an idempotent tombstone acknowledged on replay', deleted.payload.deleted === true && deletedAgain.payload.replayed === true);
  const afterDelete = await listFeed(b, 'all', 30);
  check('deleted post disappears from the public projection', !afterDelete.payload.posts.some(post => post.id === gamePost.id));

  const firstPage = await listFeed(a, 'all', 2);
  check('list uses a bounded viewer-specific projection and signed keyset cursor',
    firstPage.payload.posts.length === 2 && firstPage.payload.hasMore === true && typeof firstPage.payload.nextCursor === 'string' &&
    !JSON.stringify(firstPage.payload.posts).includes('"seq"') && !JSON.stringify(firstPage.payload.posts).includes(match.aResultId));
  const tampered = await a.request('playline_list', { filter: 'all', limit: 2, cursor: tamperCursor(firstPage.payload.nextCursor) },
    message => message.type === 'playline_error' && message.payload && message.payload.action === 'playline_list', 'tampered cursor');
  check('tampered cursor is rejected before pagination', reasonFrom(tampered) === 'invalid_cursor');
  const secondPage = await listFeed(a, 'all', 2, firstPage.payload.nextCursor);
  check('valid cursor advances without repeating the first page',
    secondPage.payload.posts.length >= 1 && !secondPage.payload.posts.some(post => firstPage.payload.posts.some(previous => previous.id === post.id)));

  const oldA = a;
  oldA.close();
  await sleep(120);
  const reconnected = await openClient(server, 'A-reconnected', [CAPABILITY]);
  const reconnectAck = await hello(reconnected, oldA.uid, oldA.token, [CAPABILITY]);
  const reconnectFeed = await listFeed(reconnected, 'all', 30);
  check('reconnect restores the same formal account and public projection',
    reconnectAck.authenticated === true && reconnectFeed.payload.posts.some(post => post.id === textPost.id && post.actions.canDelete === true));

  const impostor = await openClient(server, 'uid-token-impostor', [CAPABILITY]);
  const forgedAck = await hello(impostor, b.uid, oldA.token, [CAPABILITY]);
  check('uid/token mismatch cannot authenticate as another account', forgedAck.authenticated === false);
  const forgedRead = await playlineError(impostor, 'playline_list', 'not_authenticated', {}, 'uid/token mismatch read');
  check('uid/token mismatch cannot read Playline', reasonFrom(forgedRead) === 'not_authenticated');

  const bBlocked = await block(b, reconnected);
  check('B can establish a directional block', bBlocked.action === 'blocked' || bBlocked.action === 'idempotent');
  const bBlockedFeed = await listFeed(b, 'all', 30);
  check('B-to-A block hides A posts from B', !bBlockedFeed.payload.posts.some(post => post.author && post.author.uid === reconnected.uid));
  const aBlockedView = await listFeed(reconnected, 'all', 30);
  check('the reverse projection also hides B posts from A', !aBlockedView.payload.posts.some(post => post.author && post.author.uid === b.uid));
  await unblock(b, reconnected);
  await makeFriends(reconnected, b);
  const aBlocked = await block(reconnected, b);
  check('A can independently establish the reverse directional block', aBlocked.action === 'blocked' || aBlocked.action === 'idempotent');
  const bReverseBlockedFeed = await listFeed(b, 'all', 30);
  check('A-to-B block also hides A posts from B', !bReverseBlockedFeed.payload.posts.some(post => post.author && post.author.uid === reconnected.uid));
  await unblock(reconnected, b);

  const persisted = readDb(server);
  const report = persisted && Array.isArray(persisted.reports)
    ? persisted.reports.find(row => row && row.reporterUid === b.uid && row.contextType === 'playline' && row.contextId === textPost.id)
    : null;
  check('report target binding persists the stored author, not the forged targetUid',
    !!report && report.targetUid === oldA.uid && report.targetUid !== b.uid && report.contextType === 'playline' && report.contextId === textPost.id);
  const eventText = JSON.stringify(persisted && persisted.events || []);
  check('Playline body text is absent from analytics/event audit rows', !eventText.includes(textMarker));
  const tombstone = persisted && Array.isArray(persisted.playlinePosts)
    ? persisted.playlinePosts.find(row => row && row.id === gamePost.id)
    : null;
  check('delete keeps a local tombstone instead of physically removing the row', !!tombstone && tombstone.tombstone === true);

  // Keep the local account references alive for cleanup/debug output.
  return { server, a: reconnected, b, legacy, guest, admin, impostor };
}

async function main() {
  if (typeof WebSocket !== 'function') throw new Error('Node 20 requires --experimental-websocket');
  await runDefaultOffTracer();
  await runEnabledSuite();
}

main().catch(error => {
  failures.push('Playline online workflow crashed');
  console.error('PLAYLINE_ONLINE_CRASH', error && (error.stack || error));
  const logs = servers.map(record => record.label + ':\n' + tail(record.log, 1800)).join('\n');
  if (logs) console.error(logs);
}).finally(async () => {
  for (const client of clients) client.close();
  await sleep(120);
  for (const record of servers.slice().reverse()) await stopServer(record);
  for (const record of servers) {
    try { fs.rmSync(record.dataDir, { recursive: true, force: true }); } catch {}
  }
  console.log(failures.length ? 'PLAYLINE_ONLINE_HAS_FAILURES' : 'PLAYLINE_ONLINE_ALL_PASS');
  if (failures.length) console.error('FAILURES: ' + failures.join('、'));
  process.exitCode = failures.length ? 1 : 0;
});
