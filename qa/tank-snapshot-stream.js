'use strict';

const assert = require('assert');
const { TankAuthority } = require('../server/gameplay/tank-sim');
const { TANK_SNAPSHOT_DELTA_PROTOCOL, createTankSnapshotStream } = require('../server/gameplay/tank-snapshot-stream');
const TankSnapshotWireCodec = require('../shared/protocol/tank-snapshot-wire-codec');

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

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function snapshots() {
  const authority = new TankAuthority({ matchId:'tank-stream', playerCount:2, startedAt:1000, durationMs:10000 });
  authority.advance(1100);
  const first = authority.snapshot(1100);
  authority.acceptInput(0, { matchId:'tank-stream', seq:1, clientTick:authority.serverTick, input:{ right:true } }, 1101);
  authority.advance(1200);
  return { authority, first, second:authority.snapshot(1200) };
}

function decoded(receiver, item) {
  const outcome = receiver.decode(item.envelope);
  assert.strictEqual(outcome.accepted, true, outcome.reason || 'decode failed');
  return outcome.snapshot;
}

check('Tank Snapshot Stream：默认关闭，旧 full snapshot 路径保持调用方回退', () => {
  const stream = createTankSnapshotStream({ enabled:false });
  const state = snapshots().first;
  const before = clone(state);
  const outcome = stream.encodeFor('session-a', state, { forceKeyframe:true });
  assert.strictEqual(outcome.accepted, false);
  assert.strictEqual(outcome.reason, 'disabled');
  assert.deepStrictEqual(state, before);
  stream.dispose();
});

check('Tank Snapshot Stream：mixed recipient base 独立，首次/重连/观战均可强制 keyframe', () => {
  const stream = createTankSnapshotStream({ enabled:true, keyframeEveryTicks:20, maxFramesPerRecipient:4 });
  const a = TankSnapshotWireCodec.create();
  const b = TankSnapshotWireCodec.create();
  const { authority, first, second } = snapshots();
  const beforeAuthority = clone(authority.snapshot(1200));
  const aFirst = stream.encodeFor('session-a', first, { forceKeyframe:true });
  const bFirst = stream.encodeFor('spectator-b', first, { forceKeyframe:true });
  assert.strictEqual(aFirst.mode, 'keyframe');
  assert.strictEqual(bFirst.mode, 'keyframe');
  assert.strictEqual(aFirst.envelope.protocol, TANK_SNAPSHOT_DELTA_PROTOCOL);
  assert.deepStrictEqual(decoded(a, aFirst), first);
  assert.deepStrictEqual(decoded(b, bFirst), first);
  const aSecond = stream.encodeFor('session-a', second);
  const bSecond = stream.encodeFor('spectator-b', second);
  assert.strictEqual(aSecond.mode, 'delta');
  assert.strictEqual(bSecond.mode, 'delta');
  assert.deepStrictEqual(decoded(a, aSecond), second);
  assert.deepStrictEqual(decoded(b, bSecond), second);
  const reconnect = stream.encodeFor('session-a-reconnected', second, { forceKeyframe:true });
  assert.strictEqual(reconnect.mode, 'keyframe');
  assert.deepStrictEqual(authority.snapshot(1200), beforeAuthority, 'transport must not mutate Authority');
  stream.dispose();
});

check('Tank Snapshot Stream：forget/reset/dispose 清除 base 并有界失败', () => {
  const stream = createTankSnapshotStream({ enabled:true, keyframeEveryTicks:100 });
  const { first, second } = snapshots();
  assert.strictEqual(stream.encodeFor('session-a', first, { forceKeyframe:true }).mode, 'keyframe');
  assert.strictEqual(stream.encodeFor('session-a', second).mode, 'delta');
  const forgotten = stream.forget('session-a');
  assert.strictEqual(forgotten.accepted, true);
  assert.strictEqual(forgotten.reason, null);
  assert.strictEqual(stream.encodeFor('session-a', second).mode, 'keyframe');
  assert.strictEqual(stream.reset('tank-stream').accepted, true);
  assert.strictEqual(stream.encodeFor('session-a', second).mode, 'keyframe');
  assert.strictEqual(stream.encodeFor('bad recipient space', second).reason, 'invalid_recipient');
  assert.strictEqual(stream.dispose().status, 'disposed');
  assert.strictEqual(stream.encodeFor('session-a', second).reason, 'disposed');
});

if (failures.length) {
  console.error('TANK_SNAPSHOT_STREAM_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('TANK_SNAPSHOT_STREAM_ALL_PASS');
}
