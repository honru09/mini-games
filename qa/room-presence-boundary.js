#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'server', 'boundaries', 'room-presence.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const SERVER_SOURCE = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');
const RoomPresence = require(MODULE_PATH);
const {
  createRoomPresenceBoundary,
  createJsonRuntimeRoomPresenceAdapter,
  createMemoryRoomPresenceAdapter,
} = RoomPresence;

const GAMES = { gomoku: 2, ludo: 4, monopoly: 5, tank: 2, tetris: 4, xiangqi: 2 };
const MIN_GAMES = { gomoku: 2, ludo: 2, monopoly: 2, tank: 2, tetris: 2, xiangqi: 2 };
let assertions = 0;
let failures = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log('PASS  ' + label);
  } catch (error) {
    failures += 1;
    console.error('FAIL  ' + label + ' :: ' + (error && error.message || error));
  }
}

function user(uid, extra = {}) {
  return {
    uid, name: uid, avatar: 100, frame: 0, effect: 0, nameFx: 0, lang: 'zh-CN',
    presencePreference: 'joinable', presenceVisibility: 'everyone',
    playerCharacter: { characterId: 'honru-default', slots: {} }, ephemeral: false, ...extra,
  };
}

function session(uid, extra = {}) {
  return { sessionId: 's-' + uid, uid, tokenHash: 'token-' + uid, alive: true, lastSeen: 1000, room: null, player: null, resumeUntil: 0, ...extra };
}

function fixture(kind, faults = {}) {
  const sourceA = session('u-a');
  const sourceB = session('u-b');
  const sourceC = session('u-c');
  const sourceUsers = { 'u-a': user('u-a'), 'u-b': user('u-b'), 'u-c': user('u-c') };
  const sourceRoom = {
    id: 'ROOM01', host: sourceA, clients: new Map([[sourceA, 0]]), capacity: 3, game: null,
    visibility: 'public', allowSpectators: true, started: false, settled: false, matchId: null,
    spectators: new Map(), maxSpectators: 12,
  };
  let runtime = { rooms: new Map([['ROOM01', sourceRoom]]), sessions: new Set([sourceA, sourceB, sourceC]), users: sourceUsers };
  const baseAdapter = kind === 'memory'
    ? createMemoryRoomPresenceAdapter(runtime)
    : createJsonRuntimeRoomPresenceAdapter({
      readRooms: () => runtime.rooms,
      readSessions: () => runtime.sessions,
      readUsers: () => runtime.users,
      putRoom: room => runtime.rooms.set(room.id, room),
      removeRoom: roomId => runtime.rooms.delete(roomId),
    });
  let failPut = faults.putRoom === true;
  let failRemove = faults.removeRoom === true;
  let returnFalseRemove = faults.removeRoomFalse === true;
  const adapter = {
    read: baseAdapter.read,
    putRoom(room) { if (failPut) throw new Error('secret persistence failure'); return baseAdapter.putRoom(room); },
    removeRoom(roomId) {
      if (failRemove) throw new Error('secret removal failure');
      if (returnFalseRemove) return false;
      return baseAdapter.removeRoom(roomId);
    },
  };
  let now = 1000;
  const blocked = new Set();
  const friends = new Set();
  const boundary = createRoomPresenceBoundary({
    adapter,
    now: () => now,
    heartbeatTimeoutMs: 40000,
    gameMin: MIN_GAMES,
    gameMax: GAMES,
    publicPlayerCharacter: value => value || { characterId: 'honru-default', slots: {} },
    isHiddenUid: uid => uid === 'u-admin',
    isFriend: (viewer, target) => friends.has(viewer + '|' + target),
    isAllowedBetween: (viewer, target) => !blocked.has(viewer + '|' + target) && !blocked.has(target + '|' + viewer),
    gameplayMetadata: room => room && room.game ? { protocol: room.game + '-v1' } : null,
    secureEqual: (left, right) => String(left) === String(right),
  });
  const current = adapter.read();
  const sessions = [...current.sessions];
  const users = current.users;
  return {
    adapter, boundary, current, users, sessions,
    sourceUsers,
    a: sessions.find(item => item.uid === 'u-a'),
    b: sessions.find(item => item.uid === 'u-b'),
    c: sessions.find(item => item.uid === 'u-c'),
    room: current.rooms.get('ROOM01'),
    blocked, friends,
    setNow(value) { now = value; },
    setFaults(next = {}) {
      failPut = next.putRoom === true;
      failRemove = next.removeRoom === true;
      returnFalseRemove = next.removeRoomFalse === true;
    },
    now: () => now,
    runtime,
  };
}

function observableGraph(value, seen = new Map()) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (typeof value !== 'object') return typeof value === 'function' ? '[function]' : value;
  if (seen.has(value)) return { $ref: seen.get(value) };
  const id = seen.size;
  seen.set(value, id);
  if (value instanceof Map) {
    return { $id: id, $type: 'Map', entries: [...value.entries()].map(([key, child]) => [observableGraph(key, seen), observableGraph(child, seen)]) };
  }
  if (value instanceof Set) {
    return { $id: id, $type: 'Set', values: [...value].map(child => observableGraph(child, seen)) };
  }
  if (Array.isArray(value)) return { $id: id, $type: 'Array', values: value.map(child => observableGraph(child, seen)) };
  const output = { $id: id, $type: Object.getPrototypeOf(value) === null ? 'null-prototype' : 'Object' };
  for (const key of Object.keys(value).sort()) output[key] = observableGraph(value[key], seen);
  return output;
}

check('deep Module exposes only room/presence and two concrete Adapters', () => {
  assert.deepStrictEqual(Object.keys(RoomPresence).sort(), [
    'createJsonRuntimeRoomPresenceAdapter', 'createMemoryRoomPresenceAdapter', 'createRoomPresenceBoundary',
  ].sort());
  const runtime = fixture('memory');
  assert.deepStrictEqual(Object.keys(runtime.boundary).sort(), ['presence', 'room']);
  assert(Object.isFrozen(runtime.boundary));
  assert(!/require\(['"]\.\.\/index/.test(SOURCE));
});

check('server consumes the Room/Presence seam at projections and lifecycle call sites', () => {
  assert(SERVER_SOURCE.includes("require('./boundaries/room-presence')"));
  assert(SERVER_SOURCE.includes('createJsonRuntimeRoomPresenceAdapter'));
  assert(SERVER_SOURCE.includes("roomPresenceBoundary.room({action:'join'"));
  assert(SERVER_SOURCE.includes("roomPresenceBoundary.room({action:'remove'"));
  assert(SERVER_SOURCE.includes("roomPresenceBoundary.room({action:'resume'"));
  assert(SERVER_SOURCE.includes("roomPresenceBoundary.presence({ action:'online_uids' })"));
  assert(SERVER_SOURCE.includes('testAdmin.roomAccess({ actorUid:this.uid'));
  assert(SERVER_SOURCE.includes('socialAllowedBetween(this.uid'));
  assert(SOURCE.includes('room.testAdminSandbox'));
});

check('match reset commits READY through the seam before clearing state and callers consume failures', () => {
  const start = SERVER_SOURCE.indexOf('function resetRoomMatch');
  const end = SERVER_SOURCE.indexOf('function compactRoomPlayers',start);
  const source = SERVER_SOURCE.slice(start,end);
  const readyAt = source.indexOf("roomPresenceBoundary.room({action:'reset_ready'");
  const stopAt = source.indexOf('stopRoomAuthorities');
  assert(start>=0&&end>start&&readyAt>0&&stopAt>readyAt);
  assert(source.includes('if(!readyReset.ok)return readyReset'));
  assert(source.includes('return{ok:true}'));
  assert(!/^\s*resetRoomMatch\([^\n]+\);/m.test(SERVER_SOURCE));
  assert(SERVER_SOURCE.includes("if(!reset.ok){this.sendText(JSON.stringify({type:'error'"));
});

check('server checks register/rehome outcomes before exposing normal or tournament rooms', () => {
  assert(/const registered\s*=\s*roomPresenceBoundary\.room\(\{action:'register',room:r\}\)/.test(SERVER_SOURCE));
  assert(/const released=roomPresenceBoundary\.room\(\{action:targetRooms\.length\?'rehome_many':'release_many'/.test(SERVER_SOURCE));
  assert(SERVER_SOURCE.includes("if(!released.ok)return{ok:false,reason:released.reason||'room_presence_unavailable'}"));
  assert(SERVER_SOURCE.includes('if(released.committed)return abortCommittedTournamentMatchRooms'));
  assert(SERVER_SOURCE.includes('scheduleTournamentAbortRetry'));
  assert(SERVER_SOURCE.includes('tournament_room_cleanup_quarantined'));
  assert(SERVER_SOURCE.includes('ROOM_PRESENCE_RETRY_LIMIT'));
  assert(SERVER_SOURCE.includes('roomGraphRecoveryQueue'));
  assert(SERVER_SOURCE.includes("enqueueRoomGraphRecovery('tournament:'"));
  assert(SERVER_SOURCE.includes("enqueueRoomGraphRecovery('expired:'"));
  assert(SERVER_SOURCE.includes("enqueueRoomGraphRecovery('leave:'"));
  assert(SERVER_SOURCE.includes('options.quarantineSweep===true'));
  assert(!/^\s*roomPresenceBoundary\.room\(\{action:'register',room:r\}\);/m.test(SERVER_SOURCE));
});

check('tournament room release/register/rollback never writes canonical membership inline', () => {
  const start = SERVER_SOURCE.indexOf('function releaseTournamentSourceRooms');
  const end = SERVER_SOURCE.indexOf('function scheduleTournamentNextRound', start);
  const source = SERVER_SOURCE.slice(start, end);
  assert(start >= 0 && end > start);
  assert(source.includes("'rehome_many':'release_many'"));
  assert(!source.includes("action:'remove'"));
  assert(source.includes('tournamentGuard.unbindMatches'));
  assert((SERVER_SOURCE.match(/tournamentGuard\.unbindMatch(?:es)?\(/g) || []).length >= 2);
  const createStart = source.indexOf('function createTournamentMatchRoom');
  const bindAt = source.indexOf('tournamentGuard.bindMatches', createStart);
  const attachAt = source.indexOf('attachMatchRooms', bindAt);
  const rehomeAt = source.indexOf('releaseTournamentSourceRooms', attachAt);
  const releaseCommitAt = source.indexOf("const released=roomPresenceBoundary.room({action:targetRooms.length?'rehome_many':'release_many'");
  const spectateLeftAt = source.indexOf("if(session)session.sendText(JSON.stringify({type:'spectate_left'", releaseCommitAt);
  const firstVisibleWire = source.indexOf('session.sendText(JSON.stringify(member.player===0', createStart);
  const startMatchAt = source.indexOf('startRoomMatch(plan.room', createStart);
  assert(releaseCommitAt >= 0 && spectateLeftAt > releaseCommitAt && spectateLeftAt < createStart);
  assert(createStart >= 0 && bindAt > createStart && attachAt > bindAt && rehomeAt > attachAt && startMatchAt > rehomeAt && firstVisibleWire > startMatchAt);
  assert(source.includes('deferAnnounce:true'));
  assert(
    SERVER_SOURCE.includes('oldSession.reconnectTimer=setTimeout(()=>expireDetachedSession') ||
    (SERVER_SOURCE.includes('function scheduleReconnectTimer') && SERVER_SOURCE.includes('RECONNECT_TIMER_OWNER_PREFIX') && SERVER_SOURCE.includes('serverClockTimer.schedule'))
  );
  assert(
    SERVER_SOURCE.includes('this.roomRemovalRetryTimer=setTimeout') ||
    (SERVER_SOURCE.includes('function scheduleRoomRemovalRetryTimer') && SERVER_SOURCE.includes('ROOM_REMOVAL_RETRY_TIMER_OWNER_PREFIX') && SERVER_SOURCE.includes('serverClockTimer.schedule'))
  );
  assert(!/\.(?:room|player|resumeUntil)\s*=(?!=)/.test(source));
  assert(!/\.clients\.(?:set|delete|clear)\s*\(/.test(source));
  assert(!/\.host\s*=/.test(source));
});

for (const kind of ['memory', 'runtime']) {
  check(kind + ' Adapter detaches fixture state and keeps the same observable Interface', () => {
    const runtime = fixture(kind);
    assert.deepStrictEqual(Object.keys(runtime.adapter).sort(), ['putRoom', 'read', 'removeRoom']);
    const originalName = runtime.adapter.read().users['u-a'].name;
    runtime.sourceUsers['u-a'].name = 'outside mutation';
    if (kind === 'memory') assert.strictEqual(runtime.adapter.read().users['u-a'].name, originalName);
    const view = runtime.boundary.room({ action: 'inspect', roomId: 'ROOM01' });
    assert.strictEqual(view.ok, true);
    assert.strictEqual(view.details.activeCount, 1);
  });

  check(kind + ' seat normalization, sequential join and selected-game capacity stay authoritative', () => {
    const runtime = fixture(kind);
    const initial = runtime.boundary.room({ action: 'payload', roomId: 'ROOM01' });
    assert.strictEqual(initial.payload.seats.length, 3);
    assert.strictEqual(initial.payload.seats[0].type, 'human');
    const joined = runtime.boundary.room({ action: 'join', room: runtime.room, session: runtime.b });
    assert.strictEqual(joined.ok, true);
    assert.strictEqual(joined.player, 1);
    runtime.room.game = 'gomoku';
    const rejected = runtime.boundary.room({ action: 'join', room: runtime.room, session: runtime.c });
    assert.strictEqual(rejected.reason, 'selected_game_capacity');
    assert.deepStrictEqual([...runtime.room.clients.values()], [0, 1]);
  });

  check(kind + ' block/privacy filters are centralized in lobby and presence', () => {
    const runtime = fixture(kind);
    runtime.blocked.add('u-b|u-a');
    const blockedJoin = runtime.boundary.room({ action: 'join', room: runtime.room, session: runtime.b });
    assert.strictEqual(blockedJoin.reason, 'blocked');
    runtime.users['u-a'].presenceVisibility = 'friends';
    assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-a', viewerUid: 'u-b' }).value, 'offline');
    runtime.friends.add('u-b|u-a');
    runtime.blocked.clear();
    assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-a', viewerUid: 'u-b' }).value, 'joinable');
    runtime.users['u-a'].presencePreference = 'invisible';
    assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-a', viewerUid: 'u-b' }).value, 'offline');
  });

  check(kind + ' host removal returns a result, compaction preserves seat order and reports reassignment', () => {
    const runtime = fixture(kind);
    const joined = runtime.boundary.room({ action: 'join', room: runtime.room, session: runtime.b });
    assert.strictEqual(joined.player, 1);
    const removed = runtime.boundary.room({ action: 'remove', room: runtime.room, session: runtime.a });
    assert.strictEqual(removed.ok, true);
    assert.strictEqual(removed.hostChanged, true);
    assert.strictEqual(runtime.room.host.uid, 'u-b');
    assert.strictEqual(removed.reassigned.length, 1);
    assert.strictEqual(removed.reassigned[0].player, 0);
    assert(Object.isFrozen(removed.reassigned));
    assert(Object.isFrozen(removed.reassigned[0]));
    assert.strictEqual(runtime.b.player, 0);
    const compacted = runtime.boundary.room({ action: 'compact', room: runtime.room });
    assert.strictEqual(compacted.reassigned.length, 0);
    assert(Object.isFrozen(compacted.reassigned));
    assert.strictEqual(runtime.boundary.room({ action: 'payload', room: runtime.room }).payload.host.uid, 'u-b');
  });

  check(kind + ' reconnect window replaces a detached session without changing its seat', () => {
    const runtime = fixture(kind);
    runtime.room.started = true;
    const detached = runtime.boundary.room({ action: 'detach', room: runtime.room, session: runtime.a, graceMs: 60000 });
    assert.strictEqual(detached.ok, true);
    runtime.a.alive = false;
    const replacement = { ...runtime.a, sessionId: 's-a-new', alive: true, room: null, player: null };
    runtime.current.sessions.add(replacement);
    const resumed = runtime.boundary.room({ action: 'resume', session: replacement });
    assert.strictEqual(resumed.ok, true);
    assert.strictEqual(resumed.player, 0);
    assert.strictEqual(replacement.room, 'ROOM01');
    assert.strictEqual(runtime.room.clients.get(replacement), 0);
  });

  check(kind + ' online UIDs apply heartbeat, invisible and hidden-admin rules', () => {
    const runtime = fixture(kind);
    runtime.users['u-b'].presencePreference = 'invisible';
    runtime.current.sessions.add({ ...runtime.a, uid: 'u-admin', sessionId: 'admin', alive: true, lastSeen: runtime.now() });
    runtime.current.sessions.add({ ...runtime.b, uid: 'u-stale', sessionId: 'stale', alive: true, lastSeen: -100000 });
    const online = runtime.boundary.presence({ action: 'online_uids' });
    assert(online.uids.includes('u-a'));
    assert(!online.uids.includes('u-b'));
    assert(!online.uids.includes('u-admin'));
    assert(!online.uids.includes('u-stale'));
  });
}

check('both Adapters preserve lobby identity and the exact public Seat whitelist', () => {
  const publicKeys = ['seatId','type','userId','nickname','avatar','frame','effect','nameFx','lang','playerCharacter','ready','host','online','aiDifficulty','aiPersona','controllerUid'].sort();
  const privateKeys = ['owned','token','authToken','password','passwordHash','coins','xp','purchaseRequests'];
  for (const kind of ['memory', 'runtime']) {
    const runtime = fixture(kind);
    Object.assign(runtime.users['u-a'], { avatar:123, frame:7, effect:4, nameFx:3, lang:'en-US' });
    const projected = runtime.boundary.room({ action:'lobby' });
    assert.strictEqual(projected.ok, true);
    assert.strictEqual(projected.rooms.length, 1);
    assert.deepStrictEqual({
      avatar:projected.rooms[0].hostAvatar,
      frame:projected.rooms[0].hostFrame,
      effect:projected.rooms[0].hostEffect,
      nameFx:projected.rooms[0].hostNameFx,
      lang:projected.rooms[0].hostLang,
    }, { avatar:123, frame:7, effect:4, nameFx:3, lang:'en-US' });
    const seat = runtime.boundary.room({ action:'seat', kind:'public', value:{
      seatId:0, type:'human', userId:'u-a', nickname:'u-a', avatar:123, frame:7, effect:4, nameFx:3,
      lang:'en-US', playerCharacter:{ characterId:'honru-default', slots:{} }, ready:true, host:true,
      online:true, aiDifficulty:null, aiPersona:null, controllerUid:null,
      owned:['forged'], token:'forged', authToken:'forged', password:'forged', passwordHash:'forged',
      coins:999999, xp:999999, purchaseRequests:['forged'],
    } });
    assert.strictEqual(seat.ok, true);
    assert.deepStrictEqual(Object.keys(seat.seat).sort(), publicKeys);
    for (const key of privateKeys) assert.strictEqual(Object.prototype.hasOwnProperty.call(seat.seat, key), false);
  }
});

check('memory Adapter keeps canonical room references when callers pass a stale source object', () => {
  const sourceA = session('u-a');
  const sourceB = session('u-b');
  const sourceRoom = { id: 'R-ISOLATED', host: sourceA, clients: new Map([[sourceA, 0]]), capacity: 2, game: null, started: false, spectators: new Map() };
  const adapter = createMemoryRoomPresenceAdapter({
    rooms: new Map([[sourceRoom.id, sourceRoom]]),
    sessions: new Set([sourceA, sourceB]),
    users: { 'u-a': user('u-a'), 'u-b': user('u-b') },
  });
  const boundary = createRoomPresenceBoundary({ adapter, now: () => 1000, gameMin: MIN_GAMES, gameMax: GAMES });
  const canonical = adapter.read().rooms.get(sourceRoom.id);
  const joined = boundary.room({ action: 'join', room: sourceRoom, session: sourceB });
  assert.strictEqual(joined.ok, true);
  assert.deepStrictEqual(joined.room, {
    id: 'R-ISOLATED', game: null, capacity: 2, started: false, settled: false, matchId: null,
    visibility: 'public', allowSpectators: false, testAdminSandbox: false, hostUid: 'u-a',
  });
  assert(Object.isFrozen(joined.room));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(joined.room, 'clients'), false);
  assert.strictEqual(canonical.clients.size, 2);
  assert.strictEqual(sourceRoom.clients.size, 1, 'source graph must remain detached');
  assert.strictEqual([...canonical.clients.keys()].find(item => item.uid === 'u-b').room, sourceRoom.id);
  adapter.removeRoom(sourceRoom.id);
  assert.strictEqual(boundary.room({ action: 'payload', room: sourceRoom }).reason, 'room_not_found');
});

check('read projections normalize malformed canonical state without mutating room/session graph', () => {
  const runtime = fixture('memory');
  const room = runtime.room;
  const ghostHost = { uid: 'ghost-host', marker: { untouched: true } };
  const malformedSeat = { seatId: 1, type: 'human', userId: 'u-a', ready: true, marker: { untouched: true } };
  const malformedAi = { seatId: 99, type: 'ai', marker: { untouched: true } };
  room.capacity = 999;
  room.host = ghostHost;
  room.clients = new Map([[runtime.a, 1], [runtime.b, 1]]);
  room.seats = [malformedSeat, malformedAi];
  room.game = 'gomoku';
  room.started = false;
  runtime.a.room = 'stale-room';
  runtime.a.player = 41;
  runtime.a.detached = false;
  runtime.a.lastSeen = runtime.now();
  runtime.b.room = null;
  runtime.b.player = null;
  runtime.users['u-a'].playerCharacter = { nested: { values: [{ untouched: true }] } };

  const before = observableGraph({ room, sessions: [...runtime.current.sessions], users: runtime.users });
  const refs = {
    room, clients: room.clients, seats: room.seats, host: room.host,
    malformedSeat, malformedAi, a: runtime.a, b: runtime.b,
    playerCharacter: runtime.users['u-a'].playerCharacter,
  };
  const inspected = runtime.boundary.room({ action: 'inspect', roomId: room.id, session: runtime.a });
  const payload = runtime.boundary.room({ action: 'payload', roomId: room.id });
  const lobby = runtime.boundary.room({ action: 'lobby' });
  const publicPresence = runtime.boundary.presence({ action: 'public', uid: 'u-a' });
  const online = runtime.boundary.presence({ action: 'online_uids' });
  const seat = runtime.boundary.room({ action: 'seat', kind: 'public', value: malformedSeat });

  assert.strictEqual(inspected.ok, true);
  assert.strictEqual(inspected.room.capacity, 2);
  assert.strictEqual(inspected.room.hostUid, 'u-a');
  assert.strictEqual(inspected.details.activeCount, 2);
  assert.strictEqual(inspected.details.sessionSeat.userId, 'u-a');
  assert.strictEqual(inspected.details.sessionSeat.host, true);
  assert.strictEqual(inspected.details.sessionSeat.ready, true);
  assert.deepStrictEqual(payload.payload.players.map(item => item.uid), ['u-b', 'u-a']);
  assert.strictEqual(payload.payload.capacity, 2);
  assert.strictEqual(payload.payload.host.uid, 'u-a');
  assert.strictEqual(lobby.rooms.length, 1);
  assert.strictEqual(lobby.rooms[0].hostUid, 'u-a');
  assert.strictEqual(publicPresence.value, 'joinable');
  assert(online.uids.includes('u-a') && online.uids.includes('u-b'));
  assert.strictEqual(seat.ok, true);

  assert.deepStrictEqual(observableGraph({ room, sessions: [...runtime.current.sessions], users: runtime.users }), before);
  assert.strictEqual(room, refs.room);
  assert.strictEqual(room.clients, refs.clients);
  assert.strictEqual(room.seats, refs.seats);
  assert.strictEqual(room.host, refs.host);
  assert.strictEqual(room.seats[0], refs.malformedSeat);
  assert.strictEqual(room.seats[1], refs.malformedAi);
  assert.strictEqual(runtime.a, refs.a);
  assert.strictEqual(runtime.b, refs.b);
  assert.strictEqual(runtime.users['u-a'].playerCharacter, refs.playerCharacter);
  assert.strictEqual(runtime.a.room, 'stale-room');
  assert.strictEqual(runtime.a.player, 41);
});

check('memory Adapter deep-clones unknown nested state while preserving Session identity and opaque handles', () => {
  class TimerHandle {}
  const timer = new TimerHandle();
  const hook = () => 'opaque';
  const sourceA = session('u-a', {
    nested: { array: [{ value: 1 }], map: new Map([['entry', { value: 2 }]]), set: new Set([{ value: 3 }]), timer, hook },
  });
  const sourceB = session('u-b');
  const sourceUser = user('u-a', { profile: { badges: [{ id: 1 }], preferences: { compact: false } } });
  const sourceRoom = {
    id: 'DEEP-ISOLATION', host: sourceA, clients: new Map([[sourceA, 0]]),
    spectators: new Map([[sourceB, { metadata: { labels: ['watcher'] } }]]),
    seats: [{ seatId: 0, type: 'human', nested: { badges: [{ id: 1 }] } }],
    futureState: {
      panels: [{ key: 'score', state: { visible: true } }],
      map: new Map([['nested', { value: 4 }]]), set: new Set([{ value: 5 }]), timer, hook,
    },
  };
  const adapter = createMemoryRoomPresenceAdapter({
    sessions: new Set([sourceA, sourceB]), users: { 'u-a': sourceUser },
    rooms: new Map([[sourceRoom.id, sourceRoom]]),
  });
  const current = adapter.read();
  const canonicalA = [...current.sessions].find(item => item.uid === 'u-a');
  const canonicalB = [...current.sessions].find(item => item.uid === 'u-b');
  const canonicalRoom = current.rooms.get(sourceRoom.id);

  assert.strictEqual(canonicalRoom.host, canonicalA);
  assert(canonicalRoom.clients.has(canonicalA));
  assert(canonicalRoom.spectators.has(canonicalB));
  assert.notStrictEqual(canonicalA.nested, sourceA.nested);
  assert.notStrictEqual(canonicalA.nested.array, sourceA.nested.array);
  assert.notStrictEqual(canonicalA.nested.map, sourceA.nested.map);
  assert.notStrictEqual(canonicalA.nested.set, sourceA.nested.set);
  assert.notStrictEqual(current.users['u-a'].profile, sourceUser.profile);
  assert.notStrictEqual(current.users['u-a'].profile.badges, sourceUser.profile.badges);
  assert.notStrictEqual(canonicalRoom.futureState, sourceRoom.futureState);
  assert.notStrictEqual(canonicalRoom.futureState.panels, sourceRoom.futureState.panels);
  assert.notStrictEqual(canonicalRoom.futureState.map, sourceRoom.futureState.map);
  assert.notStrictEqual(canonicalRoom.futureState.set, sourceRoom.futureState.set);
  assert.strictEqual(canonicalA.nested.timer, timer);
  assert.strictEqual(canonicalA.nested.hook, hook);
  assert.strictEqual(canonicalRoom.futureState.timer, timer);
  assert.strictEqual(canonicalRoom.futureState.hook, hook);

  sourceA.nested.array[0].value = 11;
  sourceA.nested.map.get('entry').value = 12;
  sourceUser.profile.badges[0].id = 13;
  sourceRoom.futureState.panels[0].state.visible = false;
  sourceRoom.futureState.map.get('nested').value = 14;
  assert.strictEqual(canonicalA.nested.array[0].value, 1);
  assert.strictEqual(canonicalA.nested.map.get('entry').value, 2);
  assert.strictEqual(current.users['u-a'].profile.badges[0].id, 1);
  assert.strictEqual(canonicalRoom.futureState.panels[0].state.visible, true);
  assert.strictEqual(canonicalRoom.futureState.map.get('nested').value, 4);

  canonicalA.nested.array[0].value = 21;
  canonicalA.nested.map.get('entry').value = 22;
  current.users['u-a'].profile.badges[0].id = 23;
  canonicalRoom.futureState.panels[0].state.visible = 'canonical-only';
  canonicalRoom.futureState.map.get('nested').value = 24;
  assert.strictEqual(sourceA.nested.array[0].value, 11);
  assert.strictEqual(sourceA.nested.map.get('entry').value, 12);
  assert.strictEqual(sourceUser.profile.badges[0].id, 13);
  assert.strictEqual(sourceRoom.futureState.panels[0].state.visible, false);
  assert.strictEqual(sourceRoom.futureState.map.get('nested').value, 14);
});

check('inspect and membership results expose frozen DTOs rather than canonical graph objects', () => {
  const runtime = fixture('memory');
  runtime.users['u-a'].playerCharacter = { characterId:'honru-default', slots:new Map([['body','mutable']]) };
  const inspected = runtime.boundary.room({ action: 'inspect', roomId: runtime.room.id, session: runtime.a });
  assert.strictEqual(inspected.ok, true);
  assert(Object.isFrozen(inspected.room));
  assert(Object.isFrozen(inspected.details));
  assert(Object.isFrozen(inspected.details.seats));
  assert(Object.isFrozen(inspected.details.seats[0]));
  assert(!(inspected.details.seats[0].playerCharacter.slots instanceof Map));
  assert(Object.isFrozen(inspected.details.seats[0].playerCharacter.slots));
  assert.strictEqual(Object.prototype.hasOwnProperty.call(inspected.details, 'clients'), false);
  assert.strictEqual(Object.prototype.hasOwnProperty.call(inspected.details.sessionSeat, 'session'), false);
  assert.strictEqual(inspected.details.sessionSeat.userId, 'u-a');
});

check('join rejects a caller session that is absent from the Adapter session set', () => {
  const runtime = fixture('memory');
  const outsider = session('u-outsider', { sessionId: 'outside-session' });
  runtime.users['u-outsider'] = user('u-outsider');
  const joined = runtime.boundary.room({ action: 'join', roomId: runtime.room.id, session: outsider });
  assert.strictEqual(joined.ok, false);
  assert.strictEqual(joined.reason, 'session_unavailable');
  assert.strictEqual(runtime.room.clients.has(outsider), false);
  assert.strictEqual(outsider.room, null);
  assert.strictEqual(outsider.player, null);
});

check('register canonicalizes known Sessions and rejects unknown room members', () => {
  const runtime = fixture('memory');
  const forged = session('u-forged', { sessionId: 'forged-register' });
  const rejected = runtime.boundary.room({ action: 'register', room: {
    id: 'FORGED', host: forged, clients: new Map([[forged, 0]]), capacity: 2,
  } });
  assert.strictEqual(rejected.reason, 'session_unavailable');
  assert.strictEqual(runtime.current.rooms.has('FORGED'), false);
  const sourceCopy = { ...runtime.b };
  const accepted = runtime.boundary.room({ action: 'register', room: {
    id: 'KNOWN', host: sourceCopy, clients: new Map([[sourceCopy, 0]]), capacity: 2,
  } });
  assert.strictEqual(accepted.ok, true);
  assert(Object.isFrozen(accepted.members));
  assert(Object.isFrozen(accepted.members[0]));
  assert.strictEqual(runtime.current.rooms.get('KNOWN').host, runtime.b);
  assert.strictEqual(runtime.b.room, 'KNOWN');
  assert.strictEqual(runtime.b.player, 0);
  const cleanup = runtime.boundary.room({ action: 'unregister', roomId: 'KNOWN' });
  assert.strictEqual(cleanup.ok, true);
  assert.strictEqual(runtime.current.rooms.has('KNOWN'), false);
  assert.strictEqual(runtime.b.room, null);
  assert.strictEqual(runtime.b.player, null);
});

check('register never replaces an existing canonical room id or orphans its members', () => {
  const runtime = fixture('memory');
  runtime.a.room = runtime.room.id;
  runtime.a.player = 0;
  const replacement = {
    id: runtime.room.id, host: runtime.b, clients: new Map([[runtime.b, 0]]), capacity: 2,
  };
  const registered = runtime.boundary.room({ action:'register', room:replacement });
  assert.deepStrictEqual(registered, { ok:false, reason:'room_already_registered' });
  assert.strictEqual(runtime.current.rooms.get(runtime.room.id), runtime.room);
  assert.strictEqual(runtime.room.host, runtime.a);
  assert.strictEqual(runtime.room.clients.get(runtime.a), 0);
  assert.strictEqual(runtime.a.room, runtime.room.id);
  assert.strictEqual(runtime.b.room, null);
});

check('retire_session rejects active canonical membership and only clears stale transport metadata', () => {
  const runtime = fixture('memory');
  runtime.a.room = runtime.room.id;
  runtime.a.player = 0;
  const active = runtime.boundary.room({ action:'retire_session', session:runtime.a });
  assert.deepStrictEqual(active, { ok:false, reason:'room_membership_active' });
  assert.strictEqual(runtime.room.clients.get(runtime.a), 0);
  assert.strictEqual(runtime.a.room, runtime.room.id);
  const stale = runtime.b;
  stale.room = 'MISSING';
  stale.player = 4;
  const retired = runtime.boundary.room({ action:'retire_session', session:stale });
  assert.strictEqual(retired.ok, true);
  assert.strictEqual(stale.room, null);
  assert.strictEqual(stale.player, null);
});

check('release_many commits multiple source rooms atomically and rolls the whole graph back on a later write failure', () => {
  const sources = ['u-a','u-b','u-c','u-d'].map(uid => session(uid));
  const [sourceA,sourceB,sourceC,sourceD] = sources;
  Object.assign(sourceA,{room:'R1',player:0});
  Object.assign(sourceB,{room:'R1',player:1});
  Object.assign(sourceC,{room:'R2',player:0});
  Object.assign(sourceD,{room:'R2',player:1});
  const base = createMemoryRoomPresenceAdapter({
    sessions:new Set(sources),
    users:Object.fromEntries(sources.map(item => [item.uid,user(item.uid)])),
    rooms:new Map([
      ['R1',{id:'R1',host:sourceA,clients:new Map([[sourceA,0],[sourceB,1]]),capacity:2,started:false,spectators:new Map()}],
      ['R2',{id:'R2',host:sourceC,clients:new Map([[sourceC,0],[sourceD,1]]),capacity:2,started:false,spectators:new Map()}],
    ]),
  });
  let writes = 0;
  let failSecond = true;
  const adapter = {
    read:base.read,
    putRoom(room){ writes += 1; if(failSecond && writes === 2) throw new Error('second write failed'); return base.putRoom(room); },
    removeRoom:base.removeRoom,
  };
  const boundary = createRoomPresenceBoundary({adapter,now:()=>1000,gameMin:MIN_GAMES,gameMax:GAMES});
  const current = adapter.read();
  const a = [...current.sessions].find(item => item.uid === 'u-a');
  const c = [...current.sessions].find(item => item.uid === 'u-c');
  const failed = boundary.room({action:'release_many',sessions:[a,c],allowUnregistered:true});
  assert.deepStrictEqual(failed,{ok:false,reason:'room_presence_unavailable'});
  assert.strictEqual(current.rooms.get('R1').clients.has(a),true);
  assert.strictEqual(current.rooms.get('R2').clients.has(c),true);
  assert.strictEqual(a.room,'R1');
  assert.strictEqual(c.room,'R2');
  writes = 0;
  failSecond = false;
  const released = boundary.room({action:'release_many',sessions:[a,c],allowUnregistered:true});
  assert.strictEqual(released.ok,true);
  assert.strictEqual(released.changes.length,2);
  assert(Object.isFrozen(released.changes));
  assert(Object.isFrozen(released.changes[0].removed[0]));
  assert.strictEqual(current.rooms.get('R1').host.uid,'u-b');
  assert.strictEqual(current.rooms.get('R2').host.uid,'u-d');
  assert.strictEqual(a.room,null);
  assert.strictEqual(c.room,null);
});

check('rehome_many atomically replaces all source memberships with every target room', () => {
  const sources = ['u-a','u-b','u-c','u-d'].map(uid => session(uid));
  const [sourceA,sourceB,sourceC,sourceD] = sources;
  Object.assign(sourceA,{room:'SRC1',player:0});
  Object.assign(sourceB,{room:'SRC1',player:1});
  Object.assign(sourceC,{room:'SRC2',player:0});
  Object.assign(sourceD,{room:'SRC2',player:1});
  const base = createMemoryRoomPresenceAdapter({
    sessions:new Set(sources),
    users:Object.fromEntries(sources.map(item => [item.uid,user(item.uid)])),
    rooms:new Map([
      ['SRC1',{id:'SRC1',host:sourceA,clients:new Map([[sourceA,0],[sourceB,1]]),capacity:2,started:false,spectators:new Map()}],
      ['SRC2',{id:'SRC2',host:sourceC,clients:new Map([[sourceC,0],[sourceD,1]]),capacity:2,started:false,spectators:new Map()}],
    ]),
  });
  const current = base.read();
  const byUid = new Map([...current.sessions].map(item => [item.uid,item]));
  let writes = 0;
  let failSecond = true;
  const adapter = {
    read:base.read,
    putRoom(room){ writes += 1; if(failSecond && writes === 2) throw new Error('target write failed'); return base.putRoom(room); },
    removeRoom:base.removeRoom,
  };
  const boundary = createRoomPresenceBoundary({adapter,now:()=>1000,gameMin:MIN_GAMES,gameMax:GAMES});
  const targets = [
    {id:'TARGET1',host:byUid.get('u-a'),clients:new Map([[byUid.get('u-a'),0],[byUid.get('u-c'),1]]),capacity:2,started:false,spectators:new Map()},
    {id:'TARGET2',host:byUid.get('u-b'),clients:new Map([[byUid.get('u-b'),0],[byUid.get('u-d'),1]]),capacity:2,started:false,spectators:new Map()},
  ];
  const members = [...byUid.values()];
  const failed = boundary.room({action:'rehome_many',sessions:members,targetRooms:targets,allowUnregistered:true});
  assert.deepStrictEqual(failed,{ok:false,reason:'room_presence_unavailable'});
  assert(current.rooms.has('SRC1')&&current.rooms.has('SRC2'));
  assert(!current.rooms.has('TARGET1')&&!current.rooms.has('TARGET2'));
  assert.strictEqual(byUid.get('u-a').room,'SRC1');
  assert.strictEqual(byUid.get('u-d').room,'SRC2');
  writes = 0;
  failSecond = false;
  const moved = boundary.room({action:'rehome_many',sessions:members,targetRooms:targets,allowUnregistered:true});
  assert.strictEqual(moved.ok,true);
  assert.strictEqual(moved.targets.length,2);
  assert(!current.rooms.has('SRC1')&&!current.rooms.has('SRC2'));
  assert(current.rooms.has('TARGET1')&&current.rooms.has('TARGET2'));
  assert.strictEqual(byUid.get('u-a').room,'TARGET1');
  assert.strictEqual(byUid.get('u-d').room,'TARGET2');
  assert(Object.isFrozen(moved.targets[0].members[0]));
});

check('rehome_many removes canonical and stale non-target spectator membership in the same graph transaction and restores it on failure', () => {
  const sourceA = session('u-a');
  const sourceB = session('u-b');
  const sourceC = session('u-c',{spectatorRoom:'STALE-WATCH'});
  const spectatorHost = session('u-host');
  Object.assign(sourceA,{room:'SRC',player:0,spectatorRoom:'WATCH'});
  Object.assign(sourceB,{room:'SRC',player:1});
  Object.assign(spectatorHost,{room:'WATCH',player:0});
  const base = createMemoryRoomPresenceAdapter({
    sessions:new Set([sourceA,sourceB,sourceC,spectatorHost]),
    users:{'u-a':user('u-a'),'u-b':user('u-b'),'u-c':user('u-c'),'u-host':user('u-host')},
    rooms:new Map([
      ['SRC',{id:'SRC',host:sourceA,clients:new Map([[sourceA,0],[sourceB,1]]),capacity:2,started:false,spectators:new Map()}],
      ['WATCH',{id:'WATCH',host:spectatorHost,clients:new Map([[spectatorHost,0]]),capacity:2,started:true,spectators:new Map([[sourceA,{joinedAt:900}]])}],
    ]),
  });
  const current = base.read();
  const byUid = new Map([...current.sessions].map(item => [item.uid,item]));
  let writes = 0;
  let failTarget = true;
  const adapter = {
    read:base.read,
    putRoom(room){ writes += 1; if(failTarget && writes === 2) throw new Error('target write failed'); return base.putRoom(room); },
    removeRoom:base.removeRoom,
  };
  const boundary = createRoomPresenceBoundary({adapter,now:()=>1000,gameMin:MIN_GAMES,gameMax:GAMES});
  const target = {id:'TARGET',host:byUid.get('u-a'),clients:new Map([[byUid.get('u-a'),0],[byUid.get('u-b'),1]]),capacity:2,started:false,spectators:new Map()};
  const participants = [byUid.get('u-a'),byUid.get('u-b'),byUid.get('u-c')];
  const failed = boundary.room({action:'rehome_many',sessions:participants,targetRooms:[target],allowUnregistered:true});
  assert.deepStrictEqual(failed,{ok:false,reason:'room_presence_unavailable'});
  assert(current.rooms.has('SRC')&&!current.rooms.has('TARGET'));
  assert.strictEqual(current.rooms.get('WATCH').spectators.has(byUid.get('u-a')),true);
  assert.strictEqual(byUid.get('u-a').spectatorRoom,'WATCH');
  assert.strictEqual(byUid.get('u-c').spectatorRoom,'STALE-WATCH');
  assert.strictEqual(byUid.get('u-a').room,'SRC');
  writes = 0;
  failTarget = false;
  const moved = boundary.room({action:'rehome_many',sessions:participants,targetRooms:[target],allowUnregistered:true});
  assert.strictEqual(moved.ok,true);
  assert.strictEqual(current.rooms.has('SRC'),false);
  assert.strictEqual(current.rooms.has('TARGET'),true);
  assert.strictEqual(current.rooms.get('WATCH').spectators.has(byUid.get('u-a')),false);
  assert.strictEqual(byUid.get('u-a').spectatorRoom,null);
  assert.strictEqual(byUid.get('u-c').spectatorRoom,null);
  assert.deepStrictEqual(moved.spectatorReleases,[
    {uid:'u-a',sessionId:byUid.get('u-a').sessionId,roomId:'WATCH'},
    {uid:'u-c',sessionId:byUid.get('u-c').sessionId,roomId:'STALE-WATCH'},
  ]);
  assert.deepStrictEqual(moved.retired,[{uid:'u-c',sessionId:byUid.get('u-c').sessionId}]);
  assert(Object.isFrozen(moved.spectatorReleases));
  assert(Object.isFrozen(moved.spectatorReleases[0]));
});

check('mutation commands reject unknown Sessions unless explicit disconnect cleanup is requested', () => {
  const runtime = fixture('memory');
  const outsider = session('u-a', { sessionId: 'forged-session' });
  const removed = runtime.boundary.room({ action: 'remove', roomId: runtime.room.id, session: outsider });
  assert.strictEqual(removed.reason, 'room_membership_missing');
  runtime.room.started = true;
  const detached = runtime.boundary.room({ action: 'detach', roomId: runtime.room.id, session: outsider });
  assert.strictEqual(detached.reason, 'reconnect_not_available');
});

check('READY and AI seat mutations stay inside the boundary and return public DTOs', () => {
  const runtime = fixture('memory');
  assert.strictEqual(runtime.boundary.room({ action: 'join', roomId: runtime.room.id, session: runtime.b }).ok, true);
  const ready = runtime.boundary.room({ action: 'set_ready', roomId: runtime.room.id, session: runtime.b, ready: true });
  assert.strictEqual(ready.ok, true);
  assert.strictEqual(ready.ready, true);
  const added = runtime.boundary.room({ action: 'add_ai', roomId: runtime.room.id, session: runtime.a, persona: 'teacher', difficulty: 'normal', ai: { nickname: 'AI' } });
  assert.strictEqual(added.ok, true);
  assert(Object.isFrozen(added.seat));
  assert.strictEqual(runtime.room.seats[2].type, 'ai');
  const removed = runtime.boundary.room({ action: 'remove_ai', roomId: runtime.room.id, session: runtime.a, seatId: 2 });
  assert.strictEqual(removed.ok, true);
  assert.strictEqual(runtime.room.seats.some(seat => seat.type === 'ai'), false);
  assert.strictEqual(runtime.boundary.room({ action: 'reset_ready', roomId: runtime.room.id, session: runtime.a }).ok, true);
});

check('resume replaces and fully retires the old detached session', () => {
  const runtime = fixture('memory');
  const room = runtime.room;
  room.started = true;
  const oldSession = runtime.a;
  oldSession.alive = false;
  const timer = { cancelled: false };
  oldSession.reconnectTimer = timer;
  const detached = runtime.boundary.room({ action: 'detach', room, session: oldSession, graceMs: 60000 });
  assert.strictEqual(detached.ok, true);
  const replacement = { ...oldSession, sessionId: 's-a-replacement', alive: true, room: null, player: null };
  runtime.current.sessions.add(replacement);
  const resumed = runtime.boundary.room({ action: 'resume', session: replacement });
  assert.strictEqual(resumed.ok, true);
  assert.strictEqual(room.clients.has(oldSession), false);
  assert.strictEqual(runtime.current.sessions.has(oldSession), false);
  assert.strictEqual(oldSession.room, null);
  assert.strictEqual(oldSession.player, null);
  assert.strictEqual(oldSession.resumeUntil, 0);
  assert.strictEqual(oldSession.detached, false);
  assert.strictEqual(oldSession.reconnectTimer, null);
  assert.strictEqual(room.clients.get(replacement), 0);
});

check('resume requires an explicit detached finite window and same token', () => {
  const runtime = fixture('memory');
  runtime.room.started = true;
  const oldSession = runtime.a;
  oldSession.alive = false;
  // No detach marker/window: this must not be treated as a resumable seat.
  const stale = { ...oldSession, sessionId: 's-a-stale', alive: true, room: null, player: null, resumeUntil: undefined, detached: false };
  runtime.current.sessions.add(stale);
  assert.strictEqual(runtime.boundary.room({ action: 'resume', session: stale }).reason, 'resume_not_found');
  const detached = runtime.boundary.room({ action: 'detach', room: runtime.room, session: oldSession, graceMs: 60000 });
  assert.strictEqual(detached.ok, true);
  const wrongToken = { ...oldSession, sessionId: 's-a-wrong', alive: true, room: null, player: null, tokenHash: 'wrong' };
  runtime.current.sessions.add(wrongToken);
  assert.strictEqual(runtime.boundary.room({ action: 'resume', session: wrongToken }).reason, 'resume_not_found');
  const unregistered = { ...oldSession, sessionId: 's-a-unregistered', alive: true, room: null, player: null };
  assert.strictEqual(runtime.boundary.room({ action: 'resume', session: unregistered }).reason, 'resume_session_unavailable');
});

check('presence privacy and heartbeat fail closed for forged users and malformed timestamps', () => {
  const runtime = fixture('memory');
  runtime.users['u-a'].presencePreference = 'joinable';
  runtime.users['u-a'].presenceVisibility = 'everyone';
  runtime.a.lastSeen = Infinity;
  assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-a', user: user('u-a'), viewerUid: 'u-b' }).value, 'offline');
  runtime.a.lastSeen = runtime.now();
  runtime.blocked.add('u-b|u-a');
  assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-a', viewerUid: 'u-b' }).value, 'offline');
  runtime.users['u-a'].presenceVisibility = 'unknown';
  runtime.blocked.clear();
  assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-a', viewerUid: 'u-b' }).value, 'offline');
});

check('global online UID projection honors presenceVisibility without a viewer', () => {
  const runtime = fixture('memory');
  runtime.users['u-a'].presenceVisibility = 'everyone';
  runtime.users['u-b'].presenceVisibility = 'friends';
  runtime.users['u-c'].presenceVisibility = 'nobody';
  const online = runtime.boundary.presence({ action: 'online_uids' });
  assert.deepStrictEqual(online.uids, ['u-a']);
  assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-b' }).value, 'offline');
  assert.strictEqual(runtime.boundary.presence({ action: 'public', uid: 'u-c' }).value, 'offline');
  delete runtime.users['u-a'].presenceVisibility;
  assert.deepStrictEqual(runtime.boundary.presence({ action: 'online_uids' }).uids, ['u-a']);
});

check('Test Admin sandbox rooms stay out of the public lobby projection', () => {
  const runtime = fixture('memory');
  runtime.room.testAdminSandbox = true;
  const lobby = runtime.boundary.room({ action: 'lobby', viewerUid: 'u-b' });
  assert.strictEqual(lobby.ok, true);
  assert.deepStrictEqual(lobby.rooms, []);
});

check('join persistence failure rolls back the canonical room and session graph', () => {
  const a = session('u-a');
  const b = session('u-b');
  const room = {
    id: 'ROLLBACK', host: a, clients: new Map([[a, 0]]), capacity: 2,
    game: null, visibility: 'public', started: false, spectators: new Map(),
  };
  const state = {
    rooms: new Map([[room.id, room]]),
    sessions: new Set([a, b]),
    users: { 'u-a': user('u-a'), 'u-b': user('u-b') },
  };
  const boundary = createRoomPresenceBoundary({
    adapter: {
      read: () => state,
      putRoom() { throw new Error('secret persistence failure'); },
      removeRoom: roomId => state.rooms.delete(roomId),
    },
    now: () => 1000,
    gameMin: MIN_GAMES,
    gameMax: GAMES,
  });
  const joined = boundary.room({ action: 'join', roomId: room.id, session: b });
  assert.deepStrictEqual(joined, { ok: false, reason: 'room_presence_unavailable' });
  const after = boundary.room({ action: 'payload', roomId: room.id });
  assert.strictEqual(after.ok, true);
  assert.strictEqual(after.payload.humanCount, 1);
  assert.deepStrictEqual(after.payload.players.map(item => item.uid), ['u-a']);
  assert.strictEqual(b.room, null);
  assert.strictEqual(b.player, null);
});

check('register persistence failure rolls back member metadata and room publication', () => {
  const runtime = fixture('memory');
  runtime.setFaults({ putRoom: true });
  const room = { id: 'REGISTER-ROLLBACK', host: runtime.b, clients: new Map([[runtime.b, 0]]), capacity: 2 };
  const registered = runtime.boundary.room({ action: 'register', room });
  assert.deepStrictEqual(registered, { ok: false, reason: 'room_presence_unavailable' });
  assert.strictEqual(runtime.current.rooms.has(room.id), false);
  assert.strictEqual(runtime.b.room, null);
  assert.strictEqual(runtime.b.player, null);
});

check('remove persistence failure rolls back room membership, host and session fields', () => {
  const runtime = fixture('memory');
  assert.strictEqual(runtime.boundary.room({ action: 'join', roomId: runtime.room.id, session: runtime.b }).ok, true);
  const beforeClients = [...runtime.room.clients.entries()];
  const beforeHost = runtime.room.host;
  const beforePlayer = runtime.b.player;
  runtime.setFaults({ putRoom: true });
  const removed = runtime.boundary.room({ action: 'remove', roomId: runtime.room.id, session: runtime.b });
  assert.deepStrictEqual(removed, { ok: false, reason: 'room_presence_unavailable' });
  assert.deepStrictEqual([...runtime.room.clients.entries()], beforeClients);
  assert.strictEqual(runtime.room.host, beforeHost);
  assert.strictEqual(runtime.b.player, beforePlayer);
  assert.strictEqual(runtime.b.room, runtime.room.id);
});

check('closed remove and unregister rollback when Adapter removal throws or returns false without deleting', () => {
  for (const fault of [{ removeRoom:true }, { removeRoomFalse:true }]) {
    for (const action of ['remove', 'unregister']) {
      const runtime = fixture('memory');
      runtime.a.room = runtime.room.id;
      runtime.a.player = 0;
      runtime.setFaults(fault);
      const outcome = action === 'remove'
        ? runtime.boundary.room({ action, roomId: runtime.room.id, session: runtime.a })
        : runtime.boundary.room({ action, roomId: runtime.room.id });
      assert.deepStrictEqual(outcome, { ok: false, reason: 'room_presence_unavailable' });
      assert.strictEqual(runtime.current.rooms.get(runtime.room.id), runtime.room);
      assert.strictEqual(runtime.room.clients.get(runtime.a), 0);
      assert.strictEqual(runtime.room.host, runtime.a);
      assert.strictEqual(runtime.a.room, runtime.room.id);
      assert.strictEqual(runtime.a.player, 0);
    }
  }
});

check('detach persistence failure rolls back reconnect markers and seat online state', () => {
  const runtime = fixture('memory');
  runtime.room.started = true;
  const before = { detached: runtime.a.detached, resumeUntil: runtime.a.resumeUntil, player: runtime.a.player, room: runtime.a.room };
  runtime.setFaults({ putRoom: true });
  const detached = runtime.boundary.room({ action: 'detach', roomId: runtime.room.id, session: runtime.a, graceMs: 60000 });
  assert.deepStrictEqual(detached, { ok: false, reason: 'room_presence_unavailable' });
  assert.deepStrictEqual({ detached: runtime.a.detached, resumeUntil: runtime.a.resumeUntil, player: runtime.a.player, room: runtime.a.room }, before);
  assert.strictEqual(runtime.room.clients.has(runtime.a), true);
});

check('resume persistence failure rolls back replacement membership and both sessions', () => {
  const runtime = fixture('memory');
  runtime.room.started = true;
  assert.strictEqual(runtime.boundary.room({ action: 'detach', roomId: runtime.room.id, session: runtime.a, graceMs: 60000 }).ok, true);
  runtime.a.alive = false;
  const replacement = { ...runtime.a, sessionId: 's-a-replacement', alive: true, detached: false, room: null, player: null, resumeUntil: 0 };
  runtime.current.sessions.add(replacement);
  runtime.setFaults({ putRoom: true });
  const resumed = runtime.boundary.room({ action: 'resume', session: replacement });
  assert.deepStrictEqual(resumed, { ok: false, reason: 'room_presence_unavailable' });
  assert.strictEqual(runtime.room.clients.get(runtime.a), 0);
  assert.strictEqual(runtime.room.clients.has(replacement), false);
  assert.strictEqual(runtime.current.sessions.has(runtime.a), true);
  assert.strictEqual(runtime.current.sessions.has(replacement), true);
  assert.strictEqual(runtime.a.detached, true);
  assert.strictEqual(replacement.room, null);
  assert.strictEqual(replacement.player, null);
});

check('adapter, clock and projection errors return stable fail-closed results', () => {
  const source = fixture('memory');
  const brokenAdapter = Object.freeze({
    read() { throw new Error('secret adapter detail'); },
    putRoom() { throw new Error('secret write detail'); },
    removeRoom() { throw new Error('secret remove detail'); },
  });
  const broken = createRoomPresenceBoundary({ adapter: brokenAdapter, now: () => 1000 });
  const roomError = broken.room({ action: 'payload', roomId: 'R' });
  const presenceError = broken.presence({ action: 'online_uids' });
  assert.deepStrictEqual(roomError, { ok: false, reason: 'room_presence_unavailable' });
  assert.strictEqual(presenceError.ok, false);
  assert.deepStrictEqual(presenceError.uids, []);
  const clockBroken = createRoomPresenceBoundary({ adapter: source.adapter, now: () => NaN });
  assert.deepStrictEqual(clockBroken.room({ action: 'payload', room: source.room }), { ok: false, reason: 'room_presence_unavailable' });
  assert.strictEqual(clockBroken.presence({ action: 'public', uid: 'u-a' }).value, 'offline');
});

if (failures) {
  console.error(`ROOM_PRESENCE_BOUNDARY_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`ROOM_PRESENCE_BOUNDARY_ALL_PASS assertions=${assertions}`);
}
