'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { TankAuthority } = require('../server/gameplay/tank-sim');
const TankSnapshotWireCodec = require('../shared/protocol/tank-snapshot-wire-codec');

const codecSource = fs.readFileSync(path.join(__dirname, '../shared/protocol/tank-snapshot-wire-codec.js'), 'utf8');
const onlineSource = fs.readFileSync(path.join(__dirname, '../public/src/online/03-websocket.js'), 'utf8') + '\n;globalThis.__tankClientOnline = online;';
const failures = [];
function check(name, fn) {
  try { fn(); console.log('PASS  ' + name); }
  catch (error) { failures.push(name); console.error('FAIL  ' + name + ' :: ' + error.message); }
}

function node() {
  return { classList:{ add() {}, remove() {}, toggle() {} }, dataset:{}, style:{}, innerHTML:'', textContent:'', setAttribute() {}, removeAttribute() {}, focus() {}, querySelectorAll() { return []; } };
}

function makeClient(options = {}) {
  const one = node();
  const context = {
    console, Date, JSON, Map, Set, URLSearchParams,
    module:{ exports:{} },
    account:{ uid:'client-user', authToken:'client-token', ephemeral:false }, deviceUid:'client-user', currentGameId:null,
    currentGame:null, location:{ protocol:'https:', host:'ghost.example', hostname:'ghost.example' },
    localStorage:{ getItem() { return null; }, setItem() {}, removeItem() {} },
    document:{ hidden:false, addEventListener() {}, removeEventListener() {} }, window:{ addEventListener() {}, removeEventListener() {} },
    $:() => one, t:key => key, toast() {}, localizeRuntimeText:value => value, showHub() {}, syncProfiles() {},
    closeTournamentStateModal() {}, renderRoomPanel() {}, renderLobby() {}, renderGameStage() {}, cacheRoomPlayerCharacters() {},
    updateChatUnreadBadge() {}, updateGameStageStateStrip() {}, startOnlineGame() {}, finishRoomGame() {}, runCountdown() {},
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
  };
  context.globalThis = context;
  if (options.codec !== 'missing') {
    if (typeof options.codecFactory === 'function') context.TankSnapshotWireCodec = { create:options.codecFactory };
    else vm.runInNewContext(codecSource, context, { filename:'tank-snapshot-wire-codec.js' });
    assert(context.TankSnapshotWireCodec && typeof context.TankSnapshotWireCodec.create === 'function', 'codec must remain global in browser-like CommonJS VM');
  }
  vm.runInNewContext(onlineSource, context, { filename:'03-websocket.js' });
  return { context, online:context.__tankClientOnline };
}

function helloCapabilities(harness) {
  let sent = null;
  harness.online.send = message => { sent = message; };
  harness.online.sendHello('client-user', 'client-token');
  assert(sent && sent.type === 'hello' && sent.payload && Array.isArray(sent.payload.capabilities), 'sendHello must emit a capability list');
  return sent.payload.capabilities;
}

function snapshots() {
  const authority = new TankAuthority({ matchId:'tank-client-wire', playerCount:2, startedAt:1000, durationMs:10000 });
  authority.advance(1100);
  const first = authority.snapshot(1100);
  authority.acceptInput(0, { matchId:first.matchId, seq:1, clientTick:authority.serverTick, input:{ right:true } }, 1101);
  authority.advance(1200);
  return { first, second:authority.snapshot(1200) };
}

check('Tank Snapshot Client：hello 仅在 codec create/reset 健康时声明 v2 并复用实例', () => {
  const lifecycle = { create:0, reset:0, dispose:0 };
  const codec = {
    reset() { lifecycle.reset += 1; return { accepted:true }; },
    dispose() { lifecycle.dispose += 1; return { status:'disposed' }; },
  };
  const harness = makeClient({ codecFactory() { lifecycle.create += 1; return codec; } });
  assert(helloCapabilities(harness).includes('tank-snapshot-delta-v2'));
  assert(helloCapabilities(harness).includes('tank-snapshot-delta-v2'));
  assert.deepStrictEqual(lifecycle, { create:1, reset:2, dispose:0 });
  assert.strictEqual(harness.online.tankSnapshotCodec, codec);
});

check('Tank Snapshot Client：codec 缺失、create/reset 异常或 rejected 时 hello 只声明 v1', () => {
  const missing = makeClient({ codec:'missing' });
  assert(!helloCapabilities(missing).includes('tank-snapshot-delta-v2'));
  assert.strictEqual(missing.online.tankSnapshotCodec, null);

  const createThrows = makeClient({ codecFactory() { throw new Error('create failed'); } });
  assert(!helloCapabilities(createThrows).includes('tank-snapshot-delta-v2'));
  assert.strictEqual(createThrows.online.tankSnapshotCodec, null);

  for (const mode of ['throws', 'rejected']) {
    let disposed = 0;
    const harness = makeClient({ codecFactory() {
      return {
        reset() {
          if (mode === 'throws') throw new Error('reset failed');
          return { accepted:false, reason:'unhealthy' };
        },
        dispose() { disposed += 1; return { status:'disposed' }; },
      };
    } });
    assert(!helloCapabilities(harness).includes('tank-snapshot-delta-v2'), mode);
    assert.strictEqual(harness.online.tankSnapshotCodec, null, mode);
    assert.strictEqual(disposed, 1, mode);
  }
});

check('Tank Snapshot Client：v2 keyframe/delta 只在已协商能力时转为 canonical v1', () => {
  const harness = makeClient();
  const seen = [];
  harness.context.currentGame = { onAuthoritySnapshot:value => seen.push(value) };
  const { first, second } = snapshots();
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const keyframe = sender.encode(first, { recipientKey:'client-a', forceKeyframe:true });
  const delta = sender.encode(second, { recipientKey:'client-a' });
  harness.online.game = 'tank';
  harness.online.matchId = first.matchId;
  // The server publishes gameplay registry aliases with underscores; clients
  // may still advertise the hyphenated wire ID.
  harness.online.capabilities = new Set(['tank_snapshot_delta_v2']);
  harness.online.onMessage({ type:'tank_snapshot', payload:keyframe.envelope });
  harness.online.onMessage({ type:'tank_snapshot', payload:delta.envelope });
  assert.strictEqual(seen.length, 2);
  assert.strictEqual(seen[0].protocol, 'tank-authority-v1');
  assert.deepStrictEqual(JSON.parse(JSON.stringify(seen[1])), second);
});

check('Tank Snapshot Client：缺 capability、错 match 和缺 base 均 fail-closed', () => {
  const harness = makeClient();
  const seen = [];
  harness.context.currentGame = { onAuthoritySnapshot:value => seen.push(value) };
  const { first, second } = snapshots();
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const keyframe = sender.encode(first, { recipientKey:'client-a', forceKeyframe:true });
  const delta = sender.encode(second, { recipientKey:'client-a' });
  harness.online.game = 'tank';
  harness.online.matchId = first.matchId;
  harness.online.capabilities = new Set();
  harness.online.onMessage({ type:'tank_snapshot', payload:keyframe.envelope });
  assert.strictEqual(seen.length, 0);
  harness.online.capabilities = new Set(['tank-snapshot-delta-v2']);
  harness.online.onMessage({ type:'tank_snapshot', payload:delta.envelope });
  assert.strictEqual(seen.length, 0);
  const wrongMatch = JSON.parse(JSON.stringify(keyframe.envelope));
  wrongMatch.matchId = 'tank-other'; wrongMatch.payload.snapshot.matchId = 'tank-other';
  harness.online.onMessage({ type:'tank_snapshot', payload:wrongMatch });
  assert.strictEqual(seen.length, 0);
});

check('Tank Snapshot Client：v1 bootstrap clears stale transport state and stays compatible', () => {
  const harness = makeClient();
  const seen = [];
  harness.context.currentGame = { onAuthoritySnapshot:value => seen.push(value) };
  const { first } = snapshots();
  harness.online.game = 'tank';
  harness.online.matchId = first.matchId;
  harness.online.capabilities = new Set(['tank-snapshot-delta-v2']);
  harness.online.onMessage({ type:'tank_snapshot', payload:first });
  assert.strictEqual(seen.length, 1);
  assert.strictEqual(seen[0], first, 'existing v1 payload must remain the same object/path');
  assert.strictEqual(harness.online.tankSnapshotCodecMatchId, first.matchId);
  harness.online.resetState();
  assert.strictEqual(harness.online.tankSnapshotCodecMatchId, null);
});

check('Tank Snapshot Client：旧 match 的 v1 延迟帧不会重置当前 decoder', () => {
  const harness = makeClient();
  const seen = [];
  harness.context.currentGame = { onAuthoritySnapshot:value => seen.push(value) };
  const { first } = snapshots();
  harness.online.game = 'tank';
  harness.online.matchId = first.matchId;
  harness.online.capabilities = new Set(['tank-snapshot-delta-v2']);
  harness.online.resetTankSnapshotTransport(first.matchId);
  const stale = JSON.parse(JSON.stringify(first));
  stale.matchId = 'tank-old-match';
  harness.online.onMessage({ type:'tank_snapshot', payload:stale });
  assert.strictEqual(seen.length, 0);
  assert.strictEqual(harness.online.tankSnapshotCodecMatchId, first.matchId);
});

const source = fs.readFileSync(path.join(__dirname, '../public/src/online/03-websocket.js'), 'utf8');
check('Tank Snapshot Client：旧 spectating bootstrap 也应用 Tank canonical snapshot', () => {
  const block = source.slice(source.indexOf("case 'spectating':"), source.indexOf("case 'spectate_joined':"));
  assert(block.includes('decodeTankSnapshot(p.tankSnapshot)'));
  assert(block.includes('onAuthoritySnapshot(tankSnapshot,true)'));
});

if (failures.length) {
  console.error('TANK_SNAPSHOT_CLIENT_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('TANK_SNAPSHOT_CLIENT_ALL_PASS');
}
