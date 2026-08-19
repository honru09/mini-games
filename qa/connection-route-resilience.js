'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const websocketPath = path.join(__dirname, '../public/src/online/03-websocket.js');
const appShellPath = path.join(__dirname, '../public/src/core/02-app-shell.js');
const websocketSource = fs.readFileSync(websocketPath, 'utf8')
  + '\n;globalThis.__online = online;';
const appShellSource = fs.readFileSync(appShellPath, 'utf8');
const rosterSource = fs.readFileSync(path.join(__dirname, '../public/src/ui/07-roster.js'), 'utf8');
const failures = [];

function check(name, fn) {
  try {
    fn();
    console.log('PASS  ' + name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL  ' + name + ' :: ' + error.message);
  }
}

function makeNode() {
  return {
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute() {},
    removeAttribute() {},
    focus() {},
    innerHTML: '',
    textContent: '',
  };
}

function makeHarness(account) {
  const timers = new Map();
  let timerId = 0;
  const listeners = { window: Object.create(null), document: Object.create(null) };
  const sockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = 0;
      this.sent = [];
      sockets.push(this);
    }
    send(payload) { this.sent.push(payload); }
  }
  const node = makeNode();
  const context = {
    console, Date, Map, Set, JSON, URLSearchParams,
    account,
    currentGameId: null,
    deviceUid: account && account.uid || null,
    location: { protocol: 'https:', host: 'honru09.github.io', hostname: 'honru09.github.io' },
    WebSocket: FakeWebSocket,
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    document: {
      hidden: false,
      addEventListener(type, listener) { listeners.document[type] = listener; },
      removeEventListener() {},
    },
    window: {
      addEventListener(type, listener) { listeners.window[type] = listener; },
      removeEventListener() {},
    },
    $: () => node,
    t: key => key,
    toast() {},
    localizeRuntimeText: value => value,
    showHub() {},
    closeTournamentStateModal() {},
    setTimeout(fn, delay) {
      const id = ++timerId;
      timers.set(id, { fn, delay });
      return id;
    },
    clearTimeout(id) { timers.delete(id); },
    setInterval() { return ++timerId; },
    clearInterval() {},
  };
  context.globalThis = context;
  vm.runInNewContext(websocketSource, context, { filename: '03-websocket.js' });
  return { context, online: context.__online, timers, listeners, sockets };
}

function openSocket(harness) {
  harness.online.connect();
  const socket = harness.sockets[harness.sockets.length - 1];
  assert(socket, 'connect must create a socket');
  socket.readyState = 1;
  socket.onopen();
  return socket;
}

function pendingDelays(harness) {
  return [...harness.timers.values()].map(timer => timer.delay);
}

function runTimer(harness, timer) {
  const scheduled = harness.timers.get(timer);
  assert(scheduled, 'expected scheduled reconnect timer');
  harness.timers.delete(timer);
  scheduled.fn();
}

function resetDisconnected(harness) {
  harness.online.connected = false;
  harness.online.ws = null;
  harness.online._reconnectTimer = null;
}

function routeRecoveryCalls() {
  let calls = 0;
  const document = {
    hidden: false,
    body: { classList: { add() {}, remove() {} } },
    querySelectorAll() { return []; },
  };
  const context = {
    console, Date, Map, Set, JSON,
    account: { uid: 'member-route', authToken: 'member-token', ephemeral: false },
    online: { ensureConnected() { calls++; } },
    document,
    window: { addEventListener() {} },
    location: { hash: '#/games' },
    history: { replaceState() {}, pushState() {} },
    $: () => null,
    showHub() {},
    clearInterval() {},
    setInterval() { return 1; },
  };
  context.globalThis = context;
  vm.runInNewContext(appShellSource + '\n;globalThis.__setAppRoute = setAppRoute;', context, { filename: '02-app-shell.js' });
  context.__setAppRoute('games', { silentHash: true });
  return calls;
}

check('a signed-in member retries after a non-room connection close with exponential backoff', () => {
  const harness = makeHarness({ uid: 'member-1', authToken: 'member-token', ephemeral: false });
  const socket = openSocket(harness);
  socket.readyState = 3;
  socket.onclose();
  assert(harness.online._reconnectTimer, 'non-room close must schedule recovery');
  assert.deepStrictEqual(pendingDelays(harness), [500]);

  runTimer(harness, harness.online._reconnectTimer);
  const retrySocket = harness.sockets[harness.sockets.length - 1];
  retrySocket.readyState = 1;
  retrySocket.onopen();
  retrySocket.readyState = 3;
  retrySocket.onclose();
  assert.deepStrictEqual(pendingDelays(harness), [1000], 'subsequent non-room retries must back off');
});

check('room recovery keeps its 60-second resume deadline and then falls back to ordinary retry', () => {
  const harness = makeHarness({ uid: 'member-2', authToken: 'member-token', ephemeral: false });
  const socket = openSocket(harness);
  harness.online.room = 'ROOM42';
  harness.online.player = 1;
  harness.online.game = 'gomoku';
  const beforeClose = Date.now();
  socket.readyState = 3;
  socket.onclose();
  assert(harness.online.resume, 'room close must preserve a resume record');
  assert(harness.online.resume.deadline >= beforeClose + 59000 && harness.online.resume.deadline <= beforeClose + 61000, 'room resume window must remain 60 seconds');

  harness.online.clearResume();
  harness.online.resume = { room: 'ROOM42', deadline: Date.now() - 1 };
  resetDisconnected(harness);
  harness.online.scheduleReconnect();
  assert.strictEqual(harness.online.resume, null, 'expired room resume must be discarded');
  assert(harness.online._reconnectTimer, 'the signed-in client must remain online-recoverable after room resume expiry');
});

check('guest room resume expires without indefinite ordinary reconnect', () => {
  const harness = makeHarness({ uid: 'guest-room', authToken: 'guest-token', ephemeral: true });
  const socket = openSocket(harness);
  harness.online.room = 'GUEST42';
  socket.readyState = 3;
  socket.onclose();
  assert(harness.online.resume, 'guest room close must retain the bounded resume record');
  harness.online.resume.deadline = Date.now() - 1;
  harness.online.scheduleReconnect();
  assert.strictEqual(harness.online.resume, null, 'expired guest room resume must be discarded');
  assert.strictEqual(harness.online._reconnectTimer, null, 'expired guest room must not enter indefinite ordinary retry');
});

check('foreground, pageshow, online, and app-route recovery paths request a reconnect', () => {
  const harness = makeHarness({ uid: 'member-3', authToken: 'member-token', ephemeral: false });
  assert.strictEqual(typeof harness.listeners.window.pageshow, 'function', 'pageshow recovery listener missing');
  assert.strictEqual(typeof harness.listeners.window.online, 'function', 'online recovery listener missing');
  assert.strictEqual(typeof harness.listeners.document.visibilitychange, 'function', 'foreground recovery listener missing');

  for (const trigger of [
    () => harness.listeners.window.pageshow({ persisted: true }),
    () => harness.listeners.window.online(),
    () => { harness.context.document.hidden = false; harness.listeners.document.visibilitychange(); },
  ]) {
    resetDisconnected(harness);
    harness.online.clearResume();
    const socketsBefore = harness.sockets.length;
    trigger();
    assert(harness.sockets.length > socketsBefore || harness.online._reconnectTimer, 'lifecycle event must initiate recovery');
  }

  assert.strictEqual(routeRecoveryCalls(), 1, 'Home/Games/Playline/Profile route changes must request recovery');
});

check('recovery does not overlap a WebSocket that is still closing', () => {
  const harness = makeHarness({ uid: 'member-closing', authToken: 'member-token', ephemeral: false });
  const socket = openSocket(harness);
  harness.online.connected = false;
  socket.readyState = 2;
  harness.listeners.window.online();
  assert.strictEqual(harness.sockets.length, 1, 'closing transport must finish before a replacement is opened');
});

check('explicit logout and guest deletion do not schedule a reconnect', () => {
  const member = makeHarness({ uid: 'member-logout', authToken: 'member-token', ephemeral: false });
  const memberSocket = openSocket(member);
  member.online.room = 'LOGOUT1';
  member.online.send({ type: 'logout' });
  memberSocket.readyState = 3;
  memberSocket.onclose();
  assert.strictEqual(member.online._reconnectTimer, null, 'an explicit logout must not reconnect before account cleanup finishes');

  const guest = makeHarness({ uid: 'guest-delete', authToken: 'guest-token', ephemeral: true });
  const guestSocket = openSocket(guest);
  guest.context.account = null;
  guestSocket.readyState = 3;
  guestSocket.onclose();
  assert.strictEqual(guest.online._reconnectTimer, null, 'a deleted guest identity must not reconnect');
});

check('capabilities survive in-connection state resets but clear only after a true socket close', () => {
  const harness = makeHarness({ uid: 'member-4', authToken: 'member-token', ephemeral: false });
  const socket = openSocket(harness);
  harness.online.capabilities = new Set(['match-expression-v1']);
  harness.online.resetState();
  assert(harness.online.capabilities.has('match-expression-v1'), 'in-connection reset must preserve negotiated capability');
  socket.readyState = 3;
  socket.onclose();
  assert.strictEqual(harness.online.capabilities.size, 0, 'true socket close must clear negotiated capability');
});

check('Games room workspace refreshes the connection label and lobby when returning from another route', () => {
  assert(/function syncOnlineWorkspaceStatus\(\)/.test(websocketSource), 'shared online workspace status seam missing');
  assert(/syncOnlineWorkspaceStatus\(\);[\s\S]{0,80}listEl\.innerHTML/.test(websocketSource), 'lobby refresh must sync status before rendering');
  assert(/if\(next==='rooms'\)[\s\S]{0,220}syncOnlineWorkspaceStatus\(\)[\s\S]{0,220}renderLobby\(\)/.test(rosterSource), 'room tab must refresh both status and lobby');
});

if (failures.length) {
  console.error('CONNECTION_ROUTE_RESILIENCE_FAILED');
  process.exit(1);
}
console.log('CONNECTION_ROUTE_RESILIENCE_ALL_PASS');
