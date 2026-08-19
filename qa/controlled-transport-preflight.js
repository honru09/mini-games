'use strict';

// Deterministic local transport preflight.  This uses the production
// WebSocket callback closure, but deliberately does not claim real latency,
// jitter, packet loss, or OS/network shaping coverage.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TetrisRuleAuthority } = require('../server/gameplay/tetris-rule-authority');
const { TankAuthority } = require('../server/gameplay/tank-sim');
const TankSnapshotWireCodec = require('../shared/protocol/tank-snapshot-wire-codec');

const websocketSource = fs.readFileSync(path.join(__dirname, '../public/src/online/03-websocket.js'), 'utf8')
  + '\n;globalThis.__controlledOnline = online;';
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

function json(value) {
  return JSON.stringify(value);
}

function tetrisPreflight() {
  const authority = new TetrisRuleAuthority({
    matchId:'controlled-tetris', playerCount:2, startAt:1, matchEndAt:100000, matchSeed:'controlled-tetris',
  });
  const first = authority.acceptAction(0, { matchId:'controlled-tetris', seq:1, action:{ type:'left' } }, 100);
  const third = authority.acceptAction(0, { matchId:'controlled-tetris', seq:3, action:{ type:'right' } }, 101);
  assert(first.ok && third.ok, 'seq 1 and early seq 3 must be accepted');
  const accepted = json(authority.snapshot(200));
  const duplicate = authority.acceptAction(0, { matchId:'controlled-tetris', seq:3, action:{ type:'hard_drop' } }, 201);
  assert.strictEqual(duplicate.reason, 'ERR_DUPLICATE_ACTION');
  assert.strictEqual(json(authority.snapshot(200)), accepted, 'duplicate must not mutate accepted state');
  const delayed = authority.acceptAction(0, { matchId:'controlled-tetris', seq:2, action:{ type:'rotate_cw' } }, 202);
  assert.strictEqual(delayed.reason, 'ERR_STALE_SEQ');
  assert.strictEqual(json(authority.snapshot(200)), accepted, 'late reordered action must not mutate accepted state');
  assert.strictEqual(authority.lastSeq[0], 3);
  assert.strictEqual(json(authority.inputLog.map(item => item.seq)), '[1,3]');
}

// This is intentionally a local preflight transport gate.  It demonstrates
// the client-side boundary required to keep an unacknowledged packet from a
// closed connection away from the authority; it does not claim the production
// protocol has introduced a server-side connection epoch.
class ControlledTankInputEpochGate {
  constructor(authority) {
    this.authority = authority;
    this.epoch = 1;
    this.authorityCalls = 0;
  }

  disconnect(player) {
    this.epoch += 1;
    return this.authority.clearDisconnectedInput(player);
  }

  deliver(epoch, player, payload, now) {
    if (epoch !== this.epoch) return { ok:false, dropped:'stale_connection_epoch' };
    this.authorityCalls += 1;
    return this.authority.acceptInput(player, payload, now);
  }
}

function tankPreflight() {
  const authority = new TankAuthority({ matchId:'controlled-tank', playerCount:2, startedAt:1000, durationMs:10000 });
  const transport = new ControlledTankInputEpochGate(authority);
  const startX = authority.players[0].x;
  const first = transport.deliver(1, 0, {
    matchId:'controlled-tank', seq:1, clientTick:0, input:{ right:true, fire:true },
  }, 1050);
  assert(first.ok, 'initial held input must be accepted');
  assert.strictEqual(transport.authorityCalls, 1);
  assert.strictEqual(transport.disconnect(0), true);
  assert.strictEqual(transport.epoch, 2, 'disconnect must move the local transport to a fresh epoch');
  authority.advance(1100);
  assert.strictEqual(authority.players[0].x, startX, 'detached held movement must not advance');
  assert.strictEqual(authority.players[0].shots, 0, 'detached held fire must not advance');
  const afterClear = json(authority.snapshot(1100));
  const callsBeforeOldEpoch = transport.authorityCalls;
  const old = transport.deliver(1, 0, {
    matchId:'controlled-tank', seq:2, clientTick:authority.serverTick, input:{ right:true, fire:true },
  }, 1101);
  assert.strictEqual(old.dropped, 'stale_connection_epoch');
  assert.strictEqual(transport.authorityCalls, callsBeforeOldEpoch, 'old-epoch packet must be discarded before Authority.acceptInput');
  assert.strictEqual(json(authority.snapshot(1100)), afterClear, 'old-epoch unacknowledged input must not mutate authority state');
  const resumed = transport.deliver(2, 0, {
    matchId:'controlled-tank', seq:2, clientTick:authority.serverTick, input:{ right:true },
  }, 1150);
  assert(resumed.ok, 'same sequence is valid only after delivery from the fresh epoch');
  assert.strictEqual(transport.authorityCalls, callsBeforeOldEpoch + 1, 'fresh-epoch input must reach Authority exactly once');
  const afterResume = json(authority.snapshot(1150));
  const duplicate = transport.deliver(2, 0, {
    matchId:'controlled-tank', seq:2, clientTick:authority.serverTick, input:{ fire:true },
  }, 1151);
  assert.strictEqual(duplicate.reason, 'stale_seq');
  assert.strictEqual(json(authority.snapshot(1150)), afterResume, 'duplicate must not introduce ghost fire');
  authority.advance(1200);
  assert(authority.players[0].x > startX, 'fresh resumed input must move normally');
  assert.strictEqual(authority.players[0].shots, 0, 'fresh movement-only input must not create a ghost shot');
}

function tankSnapshotDeltaPreflight() {
  const authority = new TankAuthority({ matchId:'controlled-tank-delta', playerCount:2, startedAt:1000, durationMs:10000 });
  authority.advance(1100);
  const first = authority.snapshot(1100);
  authority.acceptInput(0, { matchId:first.matchId, seq:1, clientTick:authority.serverTick, input:{ right:true } }, 1101);
  authority.advance(1200);
  const second = authority.snapshot(1200);
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100, maxFramesPerRecipient:4 });
  const receiver = TankSnapshotWireCodec.create({ maxFramesPerRecipient:4 });
  const keyframe = sender.encode(first, { recipientKey:'controlled-receiver', forceKeyframe:true });
  const delta = sender.encode(second, { recipientKey:'controlled-receiver' });
  assert.strictEqual(keyframe.mode, 'keyframe');
  assert.strictEqual(delta.mode, 'delta');
  const missing = receiver.decode(delta.envelope);
  assert.strictEqual(missing.accepted, false, 'out-of-order delta cannot produce a partial snapshot');
  assert.strictEqual(missing.reason, 'missing_base');
  assert.strictEqual(missing.needKeyframe, true);
  const restored = receiver.decode(keyframe.envelope);
  assert.strictEqual(restored.accepted, true, restored.reason || 'keyframe must recover the base');
  const applied = receiver.decode(delta.envelope);
  assert.strictEqual(applied.accepted, true, applied.reason || 'delta must apply after base recovery');
  assert.strictEqual(json(applied.snapshot), json(second), 'recovered delta must equal canonical Authority state');
}

function makeNode() {
  return {
    classList:{ add() {}, remove() {}, toggle() {} }, dataset:{}, style:{}, innerHTML:'', textContent:'',
    setAttribute() {}, removeAttribute() {}, focus() {}, querySelectorAll() { return []; },
  };
}

function makeWebSocketHarness() {
  const timers = new Map();
  const sockets = [];
  let nextTimer = 0;
  class FakeWebSocket {
    constructor(url) { this.url = url; this.readyState = 0; this.sent = []; sockets.push(this); }
    send(value) { this.sent.push(value); }
  }
  const node = makeNode();
  const context = {
    console, Date, JSON, Map, Set, URLSearchParams,
    account:{ uid:'member-local', authToken:'member-token', ephemeral:false }, deviceUid:'member-local', currentGameId:null,
    location:{ protocol:'https:', host:'ghost.example', hostname:'ghost.example' }, WebSocket:FakeWebSocket,
    localStorage:{ getItem() { return null; }, setItem() {}, removeItem() {} },
    document:{ hidden:false, addEventListener() {}, removeEventListener() {} },
    window:{ addEventListener() {}, removeEventListener() {} },
    $:() => node, t:key => key, toast() {}, localizeRuntimeText:value => value, showHub() {}, syncProfiles() {},
    closeTournamentStateModal() {}, renderRoomPanel() {}, renderLobby() {}, renderGameStage() {}, cacheRoomPlayerCharacters() {},
    updateChatUnreadBadge() {}, updateGameStageStateStrip() {},
    setTimeout(callback, delay) { const id = ++nextTimer; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); }, setInterval() { return ++nextTimer; }, clearInterval() {},
  };
  context.globalThis = context;
  vm.runInNewContext(websocketSource, context, { filename:'03-websocket.js' });
  return { online:context.__controlledOnline, sockets, timers };
}

function openSocket(harness) {
  assert.strictEqual(harness.online.connect(), true);
  const socket = harness.sockets.at(-1);
  socket.readyState = 1;
  socket.onopen();
  return socket;
}

function reconnect(harness) {
  const id = harness.online._reconnectTimer;
  const task = harness.timers.get(id);
  assert(task, 'expected a scheduled reconnect');
  harness.timers.delete(id);
  task.callback();
  const socket = harness.sockets.at(-1);
  socket.readyState = 1;
  socket.onopen();
  return socket;
}

function deliver(socket, message) {
  socket.onmessage({ data:JSON.stringify(message) });
}

function transportPreflight() {
  const harness = makeWebSocketHarness();
  const oldSocket = openSocket(harness);
  harness.online.capabilities = new Set(['match-expression-v1']);
  harness.online.resetState();
  assert(harness.online.capabilities.has('match-expression-v1'), 'same connection reset must preserve capability');

  oldSocket.readyState = 3;
  oldSocket.onclose();
  assert.strictEqual(harness.online.capabilities.size, 0, 'true close must clear capability');
  const newSocket = reconnect(harness);
  harness.online._authenticated = true;
  harness.online.room = 'NEW001';
  harness.online.roomInfo = { room:'NEW001', capacity:2, players:[], seats:[] };
  harness.online.chatHistory = {};
  const beforeOldDelivery = json({ room:harness.online.room, roomInfo:harness.online.roomInfo, chat:harness.online.chatHistory });

  deliver(oldSocket, { type:'room_update', payload:{ room:'OLD001', capacity:2, players:[], seats:[] } });
  deliver(oldSocket, { type:'chat_message', payload:{ message:{ id:'old-message', seq:'1', senderUid:'friend-local', recipientUid:'member-local', text:'old' } } });
  assert.strictEqual(json({ room:harness.online.room, roomInfo:harness.online.roomInfo, chat:harness.online.chatHistory }), beforeOldDelivery,
    'old WebSocket callbacks must not resurrect room or chat state');

  const message = (seq, id) => ({ type:'chat_message', payload:{ message:{ id, seq:String(seq), senderUid:'friend-local', recipientUid:'member-local', text:'m'+seq } } });
  deliver(newSocket, message(10, 'message-10'));
  deliver(newSocket, message(2, 'message-2'));
  deliver(newSocket, message(10, 'message-10'));
  deliver(newSocket, message(11, 'message-11'));
  const rows = harness.online.chatHistory['friend-local'] || [];
  assert.strictEqual(rows.length, 3, 'duplicate DM id must be stored once');
  assert.strictEqual(json(rows.map(row => String(row.seq))), '["2","10","11"]', 'DM history must use numeric, not lexicographic, sequence ordering');
  assert.strictEqual(json(rows.map(row => row.id)), '["message-2","message-10","message-11"]');
}

console.log('INFO  controlled-local-transport-preflight: NOT real network shaping; development remains OPEN and TECH-030 release evidence remains pending');
check('Controlled transport：Tetris 1→3→duplicate 3→late 2 preserves accepted authority state', tetrisPreflight);
check('Controlled transport：Tank old epoch is rejected before Authority and fresh epoch safely resumes', tankPreflight);
check('Controlled transport：Tank v2 missing base waits for keyframe and then losslessly recovers', tankSnapshotDeltaPreflight);
check('Controlled transport：old socket callback is inert; new DM packets dedupe and sort deterministically', transportPreflight);

if (failures.length) {
  console.error('CONTROLLED_TRANSPORT_PREFLIGHT_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('CONTROLLED_TRANSPORT_PREFLIGHT_ALL_PASS');
}
