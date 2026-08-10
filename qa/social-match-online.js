'use strict';

// Social Match P0 online contract.  This test intentionally talks to a fresh
// local server so the assertions exercise the WebSocket authority rather than
// a mocked handler.  It does not write to the repository; DATA_DIR is removed
// during teardown.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const WebSocket = global.WebSocket || require('ws');

const ROOT = path.join(__dirname, '..');
const SERVER = path.join(ROOT, 'server', 'index.js');
const port = 20200 + Math.floor(Math.random() * 500);
const data = fs.mkdtempSync(path.join(ROOT, 'data', 'social-match-'));
const CAPABILITY = 'match-expression-v1';
const CAPABILITIES = [
  'direct-chat-v1', CAPABILITY, 'spectator-room-v1', 'seat_protocol_v2',
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let server = null;
let serverLog = '';
let failures = 0;

function check(name, value, detail) {
  const ok = !!value;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? ' :: ' + detail : ''));
  if (!ok) failures++;
}

class Client {
  constructor(name) {
    this.name = name;
    this.messages = [];
    this.waiters = [];
    this.uid = null;
    this.token = null;
    this.username = null;
    this.password = null;
    this.ws = null;
    this.closed = null;
  }

  _installSocket(ws) {
    this.ws = ws;
    ws.onmessage = event => {
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      let consumed = false;
      this.waiters = [...this.waiters].filter(waiter => {
        if (!consumed && waiter.p(message)) {
          consumed = true;
          waiter.r(message);
          return false;
        }
        return true;
      });
      if (!consumed) this.messages.push(message);
    };
    this.closed = new Promise(resolve => { ws.onclose = () => resolve(); });
  }

  async open(capabilities = CAPABILITIES) {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    this._installSocket(ws);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.name + ' WebSocket open timeout')), 6000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = error => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(this.name + ' WebSocket error')); };
    });
    this.send('hello', { uid: null, token: null, capabilities });
    const ack = await this.wait(message => message.type === 'hello_ack', 'hello_ack');
    this.capabilityAck = ack;
    return ack;
  }

  async reconnect(capabilities = CAPABILITIES) {
    const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
    this._installSocket(ws);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(this.name + ' reconnect open timeout')), 6000);
      ws.onopen = () => { clearTimeout(timer); resolve(); };
      ws.onerror = error => { clearTimeout(timer); reject(error instanceof Error ? error : new Error(this.name + ' reconnect error')); };
    });
    this.send('hello', { uid: this.uid, token: this.token, capabilities });
    const ack = await this.wait(message => message.type === 'hello_ack' && message.authenticated === true, 'reconnect hello_ack');
    const rejoined = await this.wait(message => message.type === 'rejoined', 'rejoined');
    return { ack, rejoined };
  }

  send(type, payload) {
    if (!this.ws || this.ws.readyState !== 1) throw new Error(this.name + ' is not connected');
    this.ws.send(JSON.stringify({ type, payload }));
  }

  wait(predicate, label, timeout = 7000) {
    const found = this.messages.find(predicate);
    if (found) {
      this.messages.splice(this.messages.indexOf(found), 1);
      return Promise.resolve(found);
    }
    return new Promise((resolve, reject) => {
      const entry = {
        p: predicate,
        r: message => { clearTimeout(timer); resolve(message); },
      };
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter(item => item !== entry);
        reject(new Error(this.name + ' timeout waiting for ' + label));
      }, timeout);
      this.waiters.push(entry);
    });
  }

  drain(predicate) {
    if (!predicate) { this.messages = []; return; }
    this.messages = this.messages.filter(message => !predicate(message));
  }

  async noMessage(predicate, duration = 220) {
    await sleep(duration);
    return !this.messages.some(predicate);
  }

  async registerFormal(name, lang, nameFx) {
    const suffix = crypto.randomBytes(5).toString('hex');
    this.username = 'Sm' + suffix.slice(0, 8); // 10 ASCII chars, letters + digits.
    this.password = 'P@ss' + suffix + 'x';
    this.send('register', {
      authVersion: 2,
      username: this.username,
      password: this.password,
      name,
      lang,
      avatar: 100,
    });
    const message = await this.wait(item => item.type === 'registered', 'formal registration');
    this.uid = message.payload && message.payload.profile && message.payload.profile.uid;
    this.token = message.token || (message.payload && message.payload.token);
    check(this.name + ' receives a persistent registration token', !!this.uid && !!this.token && message.authVersion === 'username-password-v1');
    this.send('profile', { uid: this.uid, lang, nameFx, frame: 0, effect: 0 });
    await this.wait(item => item.type === 'profile_ok', 'profile cosmetics');
    return this;
  }

  async guestLogin() {
    this.send('guest_login', { lang: 'en-US' });
    const message = await this.wait(item => item.type === 'guest_logged_in', 'guest login');
    this.uid = message.payload && message.payload.profile && message.payload.profile.uid;
    this.token = message.token || (message.payload && message.payload.token);
    this.ephemeral = true;
    return message;
  }

  close() {
    try { if (this.ws && this.ws.readyState < 2) this.ws.close(); } catch {}
  }
}

async function startServer() {
  server = spawn(process.execPath, [SERVER], {
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: data,
      NODE_ENV: 'test',
      SUPABASE_URL: '',
      SUPABASE_KEY: '',
      DEEPSEEK_KEY: '',
      SPECTATOR_DELAY_MS: '0',
      RECONNECT_GRACE_MS: '8000',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', chunk => { serverLog += String(chunk); });
  server.stderr.on('data', chunk => { serverLog += String(chunk); });
  await new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => require('http').get('http://127.0.0.1:' + port + '/', response => {
      response.resume();
      if (response.statusCode === 200) resolve();
      else if (Date.now() - started > 7000) reject(new Error('isolated server returned ' + response.statusCode));
      else setTimeout(poll, 35);
    }).on('error', error => {
      if (Date.now() - started > 7000) reject(new Error('isolated server not ready: ' + error.message));
      else setTimeout(poll, 35);
    });
    poll();
  });
}

function expressionMessage(eventId, extra = {}) {
  return {
    matchId: extra.matchId,
    eventId,
    kind: extra.kind || 'emoji',
    expressionId: extra.expressionId || 'emoji_wave',
    ...(extra.targetSeat === undefined ? {} : { targetSeat: extra.targetSeat }),
    // These fields intentionally try to overwrite server authority.
    senderUid: 'forged-sender',
    player: 99,
    createdAt: 0,
    protocol: 'forged-protocol',
  };
}

const isExpression = (eventId, type = 'match_expression') => message =>
  message.type === type && (!eventId || message.payload && message.payload.eventId === eventId);
const isExpressionAck = (eventId, replayed) => message =>
  message.type === 'match_expression_ok' && message.payload && message.payload.eventId === eventId &&
  (replayed === undefined || message.payload.replayed === replayed);
const isExpressionError = (reason, eventId) => message =>
  message.type === 'match_expression_error' && message.payload && message.payload.reason === reason &&
  (eventId === undefined || message.payload.eventId === eventId);

async function main() {
  await startServer();
  const clients = [];
  const make = async (name, caps = CAPABILITIES) => { const client = new Client(name); await client.open(caps); clients.push(client); return client; };
  const a = await make('A');
  const b = await make('B');
  const noCapability = await make('NoCapability', []);
  const spectator = await make('Spectator');
  const guest = await make('Guest');
  const [registeredA, registeredB, registeredNoCapability, registeredSpectator] = await Promise.all([
    a.registerFormal('Expression Alpha', 'en-US', 2),
    b.registerFormal('Expression Beta', 'uk-UA', 1),
    noCapability.registerFormal('Expression Legacy', 'zh-CN', 0),
    spectator.registerFormal('Expression Watcher', 'en-US', 0),
  ]);
  await guest.guestLogin();

  check('server capability declaration includes match-expression-v1', Array.isArray(a.capabilityAck.capabilities) && a.capabilityAck.capabilities.includes(CAPABILITY));
  check('formal accounts are non-ephemeral', !registeredA.ephemeral && !registeredB.ephemeral && !registeredSpectator.ephemeral && !!registeredA.uid && !!registeredB.uid && !!registeredSpectator.uid);

  a.send('create', { capacity: 2, visibility: 'public', allowSpectators: true });
  const created = await a.wait(message => message.type === 'created', 'room create');
  const roomId = String(created.room || '').toUpperCase();
  check('formal account can create a public room', /^[A-Z0-9]{6}$/.test(roomId));
  b.send('join', { room: roomId });
  const joined = await b.wait(message => message.type === 'joined' && message.room === roomId, 'room join');
  check('second formal account joins with a distinct seat', joined.player === 1 && joined.payload && joined.payload.seats && joined.payload.seats.filter(seat => seat.type === 'human').length === 2);

  // Choose a game whose ordinary relay keeps a small moveLog for the
  // reconnect assertion below.
  a.send('select_game', { game: 'gomoku' });
  await a.wait(message => message.type === 'room_update' && message.payload && message.payload.game === 'gomoku', 'game selection');
  b.send('ready', { ready: true });
  await a.wait(message => message.type === 'room_update' && message.payload && message.payload.canStart === true, 'ready room');
  a.send('start');
  const [startedA, startedB] = await Promise.all([
    a.wait(message => message.type === 'started', 'started for host'),
    b.wait(message => message.type === 'started', 'started for peer'),
  ]);
  const matchId = String(startedA.matchId || '');
  check('two formal players can start a match with a server matchId', /^[A-Za-z0-9_-]{8,}$/.test(matchId) && startedA.size === 2 && startedB.matchId === matchId);

  const seats = Array.isArray(startedA.seats) ? startedA.seats : [];
  const allowedSeatKeys = new Set(['seatId','type','userId','nickname','avatar','frame','effect','nameFx','lang','playerCharacter','ready','host','online','aiDifficulty','aiPersona','controllerUid']);
  const sensitiveSeatKeys = ['owned','token','authToken','password','passwordHash','coins','xp','purchaseRequests'];
  const publicCharacter = seat => {
    const character = seat && seat.playerCharacter;
    return !!character && character.schemaVersion === 'player-character-v1' &&
      Object.keys(character).sort().join(',') === 'characterId,schemaVersion,slots' && character.slots &&
      Object.keys(character.slots).sort().join(',') === 'accessory,body,bottom,face,footwear,hair,top' &&
      !sensitiveSeatKeys.some(key => Object.prototype.hasOwnProperty.call(character, key));
  };
  const publicSeatShape = seats.length === 2 && seats.every(seat => {
    return ['frame','effect','nameFx','lang','avatar','nickname','userId'].every(key => Object.prototype.hasOwnProperty.call(seat, key)) &&
      publicCharacter(seat) && [...Object.keys(seat)].every(key => allowedSeatKeys.has(key)) && sensitiveSeatKeys.every(key => !Object.prototype.hasOwnProperty.call(seat, key));
  });
  const alphaSeat = seats.find(seat => seat.userId === a.uid);
  const betaSeat = seats.find(seat => seat.userId === b.uid);
  check('started public Seat frame/effect/nameFx/lang are present and sensitive fields stay private', publicSeatShape && alphaSeat && betaSeat && alphaSeat.frame === 0 && alphaSeat.effect === 0 && alphaSeat.nameFx === 2 && alphaSeat.lang === 'en-US' && betaSeat.nameFx === 1 && betaSeat.lang === 'uk-UA' && !JSON.stringify(seats).includes(a.token) && !JSON.stringify(seats).includes(b.token));

  // Unsupported clients are rejected before room/match validation, which is
  // the capability negotiation boundary for old clients.
  noCapability.send('match_expression', expressionMessage('mxNoCap01', { matchId }));
  const unsupported = await noCapability.wait(isExpressionError('unsupported_capability', 'mxNoCap01'), 'unsupported capability');
  check('client without negotiated capability cannot send', unsupported.payload.reason === 'unsupported_capability');

  const beforeAuthority = Date.now();
  const authId = 'mxAuthority01';
  a.send('match_expression', expressionMessage(authId, { matchId, targetSeat: 1 }));
  const [authorityEventA, authorityEventB, authorityAck] = await Promise.all([
    a.wait(isExpression(authId), 'authoritative event for sender'),
    b.wait(isExpression(authId), 'authoritative event for peer'),
    a.wait(isExpressionAck(authId, false), 'expression ack'),
  ]);
  const authority = authorityEventA.payload;
  check('legal Emoji is broadcast to both players and acknowledged once', authorityEventB.payload.expressionId === 'emoji_wave' && authorityAck.payload.replayed === false);
  check('sender/player/time/protocol are server authoritative', authority.protocol === CAPABILITY && authority.senderUid === a.uid && authority.player === 0 && authority.targetSeat === 1 && Number.isInteger(authority.createdAt) && authority.createdAt >= beforeAuthority && authority.createdAt <= Date.now() && authority.senderUid !== 'forged-sender' && authority.player !== 99 && authority.createdAt !== 0);

  b.send('report', { targetUid:a.uid, reason:'spam', contextType:'match', contextId:authId, matchId, recentEventIds:[authId] });
  const expressionReport = await b.wait(message => message.type === 'social_ok' && message.action === 'reported', 'match expression report');
  check('match expression report preserves event and match context', !!expressionReport.reportId);

  const quickId = 'mxQuick001';
  b.send('match_expression', { matchId, eventId: quickId, kind: 'quick', expressionId: 'quick_hello' });
  const [quickEvent, quickAck] = await Promise.all([
    a.wait(isExpression(quickId), 'quick expression'),
    b.wait(isExpressionAck(quickId, false), 'quick ack'),
  ]);
  check('legal quick phrase is accepted with an optional all-player target', quickEvent.payload.kind === 'quick' && quickEvent.payload.expressionId === 'quick_hello' && quickEvent.payload.targetSeat === null && quickAck.payload.matchId === matchId);

  a.drain(message => message.type === 'match_expression' || message.type === 'match_expression_ok' || message.type === 'match_expression_error');
  b.drain(message => message.type === 'match_expression' || message.type === 'match_expression_ok' || message.type === 'match_expression_error');
  a.send('match_expression', expressionMessage(authId, { matchId, targetSeat: 1 }));
  const replayAck = await a.wait(isExpressionAck(authId, true), 'replayed expression ack');
  check('replayed eventId only returns an idempotent ack and does not rebroadcast', replayAck.payload.replayed === true && await b.noMessage(isExpression(authId)) && await a.noMessage(isExpression(authId)));

  const invalidCases = [
    ['invalid_event_id', { eventId: 'short', matchId }],
    ['invalid_expression', { eventId: 'mxInvalid01', matchId, expressionId: 'emoji_not_allowed' }],
    ['invalid_target', { eventId: 'mxTarget01', matchId, targetSeat: 99 }],
    ['invalid_match', { eventId: 'mxMatch01', matchId: 'stale-match-id' }],
  ];
  for (const [reason, payload] of invalidCases) {
    a.drain(message => message.type === 'match_expression' || message.type === 'match_expression_ok' || message.type === 'match_expression_error');
    a.send('match_expression', expressionMessage(payload.eventId, payload));
    const error = await a.wait(isExpressionError(reason, payload.eventId), reason);
    check('invalid ' + reason + ' is rejected without a broadcast', error.payload.reason === reason && await b.noMessage(isExpression(payload.eventId)));
  }

  // Join a formal spectator after the match starts.  It receives a valid
  // event, but its mutation is read-only.
  spectator.send('spectate_join', { roomId, matchId });
  const spectateJoined = await spectator.wait(message => message.type === 'spectate_joined', 'spectator join');
  check('formal spectator joins the active match as a read-only seat', spectateJoined.payload && spectateJoined.payload.role === 'spectator' && (spectateJoined.payload.player === null || spectateJoined.payload.player === undefined));
  const spectatorId = 'mxSpectator01';
  a.send('match_expression', expressionMessage(spectatorId, { matchId, targetSeat: 1 }));
  const spectatorEvent = await spectator.wait(isExpression(spectatorId), 'spectator receives expression');
  check('spectator receives expression presentation', spectatorEvent.payload.senderUid === a.uid && spectatorEvent.payload.matchId === matchId);
  spectator.send('match_expression', expressionMessage('mxSpectatorSend', { matchId }));
  const spectatorError = await spectator.wait(isExpressionError('spectator_readonly', 'mxSpectatorSend'), 'spectator readonly');
  check('spectator cannot send expressions', spectatorError.payload.reason === 'spectator_readonly');

  guest.send('match_expression', expressionMessage('mxGuestSend', { matchId }));
  const guestError = await guest.wait(isExpressionError('persistent_account_required', 'mxGuestSend'), 'guest readonly');
  check('ephemeral guest cannot send expressions', guestError.payload.reason === 'persistent_account_required');

  // Block B -> A.  A's targeted expression is rejected; an all-player
  // expression is delivered to A and the spectator but filtered from B.
  b.send('block', { uid: a.uid });
  await b.wait(message => message.type === 'social_ok' && message.action === 'blocked', 'block peer');
  a.drain(message => message.type === 'match_expression' || message.type === 'match_expression_ok' || message.type === 'match_expression_error');
  b.drain(message => message.type === 'match_expression' || message.type === 'match_expression_ok' || message.type === 'match_expression_error');
  spectator.drain(message => message.type === 'match_expression');
  const blockedTargetId = 'mxBlocked01';
  a.send('match_expression', expressionMessage(blockedTargetId, { matchId, targetSeat: 1 }));
  const blockedError = await a.wait(isExpressionError('blocked', blockedTargetId), 'blocked target');
  check('either-direction Block rejects a targeted expression', blockedError.payload.reason === 'blocked' && await b.noMessage(isExpression(blockedTargetId)));
  const filterId = 'mxFilter001';
  a.send('match_expression', expressionMessage(filterId, { matchId }));
  const [filterOwn, filterAck, filterSpectator] = await Promise.all([
    a.wait(isExpression(filterId), 'filtered event for sender'),
    a.wait(isExpressionAck(filterId, false), 'filtered event ack'),
    spectator.wait(isExpression(filterId), 'filtered event for spectator'),
  ]);
  check('recipient-side Block filtering hides all-player events only from blocked receiver', filterOwn.payload.senderUid === a.uid && filterSpectator.payload.senderUid === a.uid && filterAck.payload.replayed === false && await b.noMessage(isExpression(filterId)));

  // Trigger the server-side 10-second frequency bucket.  The exact number of
  // accepted events before this loop depends only on the events above; the
  // loop stops at the first authoritative rate_limited response.
  let rateLimited = null;
  let acceptedRateEvents = 0;
  for (let i = 0; i < 8 && !rateLimited; i++) {
    const id = 'mxRate' + String(i).padStart(3, '0');
    b.drain(message => message.type === 'match_expression' || message.type === 'match_expression_ok' || message.type === 'match_expression_error');
    b.send('match_expression', { matchId, eventId: id, kind: 'quick', expressionId: 'quick_nice' });
    const response = await b.wait(message =>
      (message.type === 'match_expression_ok' || message.type === 'match_expression_error') &&
      message.payload && message.payload.eventId === id,
      'rate response ' + i);
    if (response.type === 'match_expression_error') rateLimited = response;
    else acceptedRateEvents++;
  }
  check('server frequency control returns rate_limited with integer retryAfter', !!rateLimited && Number.isInteger(rateLimited.payload.retryAfter) && rateLimited.payload.retryAfter >= 1 && acceptedRateEvents >= 1);

  spectator.send('spectate_leave');
  const spectatorLeft = await spectator.wait(message => message.type === 'spectate_left', 'spectator leave acknowledgement');
  check('spectator leave is explicitly acknowledged for client cleanup', spectatorLeft.payload && spectatorLeft.payload.room === roomId);

  // Reset the match so the reconnect check starts with a clean expression
  // store and a fresh matchId.  The ordinary move is deliberately placed in
  // moveLog; the expression must stay out of it.
  a.send('restart');
  const restarted = await a.wait(message => message.type === 'restart', 'match restart');
  const resumedMatchId = String(restarted.matchId || '');
  await b.wait(message => message.type === 'restart' && String(message.matchId) === resumedMatchId, 'peer restart');
  a.drain();
  const moveId = 'mxMoveProbe';
  a.send('move', { r: 0, c: 0, moveProbe: moveId });
  await b.wait(message => message.type === 'move' && message.payload && message.payload.moveProbe === moveId, 'ordinary move');
  const beforeReconnectId = 'mxBeforeReconnect';
  a.send('match_expression', expressionMessage(beforeReconnectId, { matchId: resumedMatchId }));
  await a.wait(isExpression(beforeReconnectId), 'pre-reconnect expression');
  await a.wait(isExpressionAck(beforeReconnectId, false), 'pre-reconnect ack');
  a.drain();
  a.send('debug_disconnect');
  await Promise.race([a.closed, sleep(2500)]);
  const resumed = await a.reconnect();
  const resumePayload = resumed.rejoined.payload || {};
  const resumeMoveLogText = JSON.stringify(resumePayload.moveLog || []);
  check('reconnect resumes the same match without replaying expressions', String(resumePayload.matchId) === resumedMatchId && !resumeMoveLogText.includes(beforeReconnectId) && !resumeMoveLogText.includes('match_expression') && !resumeMoveLogText.includes('emoji_wave') && !a.messages.some(isExpression(beforeReconnectId)));

  // End the probe match so the existing Replay v1.1 writer has a concrete
  // record to inspect.  The move is persisted; the expression must not be.
  a.send('end_game');
  await a.wait(message => message.type === 'end_game', 'end probe match');
  a.send('replay_list');
  const replayList = await a.wait(message => message.type === 'replay_list', 'replay list');
  const replayMeta = (replayList.payload && replayList.payload.items || []).find(item => item.matchId === resumedMatchId);
  let replayData = null;
  if (replayMeta) {
    a.send('replay_get', { replayId: replayMeta.replayId });
    replayData = await a.wait(message => message.type === 'replay_data' && message.payload && message.payload.replayId === replayMeta.replayId, 'replay data');
  }
  const replayMoveLogText = replayData ? JSON.stringify(replayData.payload.moveLog || []) : '';
  check('Replay moveLog contains no expression event or ID', !!replayData && !replayMoveLogText.includes(beforeReconnectId) && !replayMoveLogText.includes('match_expression') && !replayMoveLogText.includes('emoji_wave'));

  // The persistence boundary is intentionally explicit: no expression ID or
  // payload may appear in local replay/history/analytics storage.
  let persistedText = '',persisted=null;
  try { persistedText = fs.readFileSync(path.join(data, 'leaderboard.json'), 'utf8');persisted=JSON.parse(persistedText); } catch {}
  check('expressions do not enter local replay/history/analytics persistence', !persistedText.includes(beforeReconnectId) && !persistedText.includes('match_expression') && !persistedText.includes('emoji_wave'));
  const persistedReport=persisted&&Array.isArray(persisted.reports)&&persisted.reports.find(row=>row&&row.reporterUid===b.uid&&row.targetUid===a.uid&&row.contextId===authId);
  check('event-scoped report persists only the approved expression identifiers', !!persistedReport && persistedReport.contextType === 'match' && persistedReport.matchId === matchId && Array.isArray(persistedReport.recentEventIds) && persistedReport.recentEventIds.includes(authId));

  clients.forEach(client => client.close());
}

main().catch(error => {
  failures++;
  console.error('SOCIAL_MATCH_CRASH', error && (error.stack || error));
  if (serverLog) console.error(serverLog.slice(-4000));
}).finally(async () => {
  for (const client of []) client.close();
  if (server && server.exitCode === null) server.kill();
  await sleep(120);
  try { fs.rmSync(data, { recursive: true, force: true }); } catch {}
  console.log(failures ? 'SOCIAL_MATCH_ONLINE_HAS_FAILURES' : 'SOCIAL_MATCH_ONLINE_ALL_PASS');
  process.exitCode = failures ? 1 : 0;
});
