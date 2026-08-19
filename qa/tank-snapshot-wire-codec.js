'use strict';

const assert = require('assert');
const { TankAuthority } = require('../server/gameplay/tank-sim');
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

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function authoritySnapshot(matchId) {
  const authority = new TankAuthority({ matchId, playerCount:2, startedAt:1000, durationMs:10000 });
  authority.advance(1100);
  return authority.snapshot(1100);
}

function roundTrip(sender, receiver, snapshot, config) {
  const encoded = sender.encode(snapshot, config);
  assert.strictEqual(encoded.accepted, true, encoded.reason || 'encode');
  const decoded = receiver.decode(encoded.envelope);
  assert.strictEqual(decoded.accepted, true, decoded.reason || 'decode');
  assert.deepStrictEqual(decoded.snapshot, snapshot);
  return { encoded, decoded };
}

check('Tank Snapshot Codec：完整 keyframe 无损往返', () => {
  const snapshot = authoritySnapshot('tank-wire-keyframe');
  const sender = TankSnapshotWireCodec.create();
  const receiver = TankSnapshotWireCodec.create();
  const outcome = roundTrip(sender, receiver, snapshot, { recipientKey:'receiver-a', forceKeyframe:true });
  assert.strictEqual(outcome.encoded.mode, 'keyframe');
  assert.strictEqual(outcome.decoded.mode, 'keyframe');
});

check('Tank Snapshot Codec：玩家、输入确认、弹道和墙体 delta 无损恢复', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const receiver = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const first = authoritySnapshot('tank-wire-delta');
  roundTrip(sender, receiver, first, { recipientKey:'receiver-a', forceKeyframe:true });
  const second = clone(first);
  second.serverTick += 2;
  second.serverNow += 100;
  second.remainingMs -= 100;
  second.players[0].x += 0.265;
  second.players[0].input.right = true;
  second.players[0].shots += 1;
  second.ack[0] += 1;
  second.projectiles.push({ id:1, owner:0, x:2.5, y:1.5, d:1, ttl:2500 });
  second.destructibles[3][3] = 0;
  const outcome = roundTrip(sender, receiver, second, { recipientKey:'receiver-a' });
  assert.strictEqual(outcome.encoded.mode, 'delta');
  assert.strictEqual(outcome.encoded.envelope.baseFrameId, 1);
});

check('Tank Snapshot Codec：复杂增量大于 keyframe 时保守回退完整 keyframe', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const receiver = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const first = authoritySnapshot('tank-wire-large');
  roundTrip(sender, receiver, first, { recipientKey:'receiver-a', forceKeyframe:true });
  const second = clone(first);
  second.serverTick += 2;
  second.serverNow += 100;
  second.remainingMs -= 100;
  second.players.forEach((player, id) => {
    player.x = 2 + id;
    player.y = 3 + id;
    player.kills += id + 1;
    player.damage += id + 2;
  });
  second.projectiles = Array.from({ length:160 }, (_, id) => ({
    id:id + 1, owner:id % 2, x:1.2 + (id % 10), y:1.2 + Math.floor(id / 10) % 10, d:id % 4, ttl:2400 - (id % 30),
  }));
  for (let row = 0; row < second.destructibles.length; row += 1) {
    for (let column = 0; column < second.destructibles[row].length; column += 1) {
      if (row > 0 && row < second.destructibles.length - 1 && column > 0 && column < second.destructibles[row].length - 1) second.destructibles[row][column] = 0;
    }
  }
  const outcome = roundTrip(sender, receiver, second, { recipientKey:'receiver-a' });
  assert.strictEqual(outcome.encoded.mode, 'keyframe');
});

check('Tank Snapshot Codec：每个接收者维持独立 base', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const a = TankSnapshotWireCodec.create();
  const b = TankSnapshotWireCodec.create();
  const first = authoritySnapshot('tank-wire-recipients');
  roundTrip(sender, a, first, { recipientKey:'receiver-a', forceKeyframe:true });
  roundTrip(sender, b, first, { recipientKey:'receiver-b', forceKeyframe:true });
  const second = clone(first);
  second.serverTick += 2; second.serverNow += 100; second.remainingMs -= 100; second.players[0].x += 0.1;
  const fromA = roundTrip(sender, a, second, { recipientKey:'receiver-a' });
  const fromB = roundTrip(sender, b, second, { recipientKey:'receiver-b' });
  assert.strictEqual(fromA.encoded.mode, 'delta');
  assert.strictEqual(fromB.encoded.mode, 'delta');
  assert.notStrictEqual(fromA.encoded.frameId, fromB.encoded.frameId);
});

check('Tank Snapshot Codec：Projectile remove/order 与 keyframe cadence 保持无损', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:20 });
  const receiver = TankSnapshotWireCodec.create({ maxFramesPerRecipient:4 });
  const first = authoritySnapshot('tank-wire-projectiles');
  first.projectiles = [{ id:1, owner:0, x:2.5, y:1.5, d:1, ttl:2500 }];
  roundTrip(sender, receiver, first, { recipientKey:'receiver-a', forceKeyframe:true });
  const second = clone(first);
  second.serverTick += 2; second.serverNow += 100; second.remainingMs -= 100;
  second.projectiles = [{ id:2, owner:1, x:4.5, y:3.5, d:3, ttl:2300 }];
  const delta = roundTrip(sender, receiver, second, { recipientKey:'receiver-a' });
  assert.strictEqual(delta.encoded.mode, 'delta');
  const third = clone(second);
  third.serverTick += 20; third.serverNow += 1000; third.remainingMs -= 1000;
  const cadence = roundTrip(sender, receiver, third, { recipientKey:'receiver-a' });
  assert.strictEqual(cadence.encoded.mode, 'keyframe');
});

check('Tank Snapshot Codec：只改变既有 Projectile 顺序仍无损', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const receiver = TankSnapshotWireCodec.create();
  const first = authoritySnapshot('tank-wire-projectile-order');
  first.projectiles = [
    { id:1, owner:0, x:2.5, y:1.5, d:1, ttl:2500 },
    { id:2, owner:1, x:4.5, y:3.5, d:3, ttl:2300 },
  ];
  roundTrip(sender, receiver, first, { recipientKey:'receiver-a', forceKeyframe:true });
  const second = clone(first);
  second.serverTick += 2; second.serverNow += 100; second.remainingMs -= 100;
  second.projectiles.reverse();
  const outcome = roundTrip(sender, receiver, second, { recipientKey:'receiver-a' });
  assert.strictEqual(outcome.encoded.mode, 'delta');
  assert.deepStrictEqual(outcome.decoded.snapshot.projectiles.map(item => item.id), [2, 1]);
});

check('Tank Snapshot Codec：serverTick 高水位阻止编码与恢复后的状态回退', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const receiver = TankSnapshotWireCodec.create();
  const first = authoritySnapshot('tank-wire-tick-watermark');
  const keyframe = sender.encode(first, { recipientKey:'receiver-a', forceKeyframe:true });
  assert.strictEqual(keyframe.accepted, true);
  assert.strictEqual(receiver.decode(keyframe.envelope).accepted, true);
  assert.strictEqual(sender.encode(clone(first), { recipientKey:'receiver-a' }).reason, 'stale_tick');

  const missing = clone(keyframe.envelope);
  missing.kind = 'delta';
  missing.frameId += 10;
  missing.baseFrameId = missing.frameId - 1;
  missing.serverTick += 4;
  missing.payload = { patch:{} };
  assert.strictEqual(receiver.decode(missing).reason, 'missing_base');

  const staleRecovery = clone(keyframe.envelope);
  staleRecovery.frameId += 20;
  assert.strictEqual(receiver.decode(staleRecovery).reason, 'stale_tick');
});

check('Tank Snapshot Codec：missing base 清理后保留最后已接受的 frame/tick 双高水位', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const receiver = TankSnapshotWireCodec.create();
  const first = authoritySnapshot('tank-wire-missing-watermark');
  const keyframe = sender.encode(first, { recipientKey:'receiver-a', forceKeyframe:true });
  assert.strictEqual(receiver.decode(keyframe.envelope).accepted, true);

  const missing = clone(keyframe.envelope);
  missing.kind = 'delta';
  missing.frameId = keyframe.frameId + 2;
  missing.baseFrameId = keyframe.frameId + 1;
  missing.serverTick = first.serverTick + 4;
  missing.payload = { patch:{} };
  assert.strictEqual(receiver.decode(missing).reason, 'missing_base');

  const reusedAcceptedFrame = clone(keyframe.envelope);
  reusedAcceptedFrame.serverTick = first.serverTick + 2;
  reusedAcceptedFrame.payload.snapshot.serverTick = first.serverTick + 2;
  reusedAcceptedFrame.payload.snapshot.serverNow += 100;
  reusedAcceptedFrame.payload.snapshot.remainingMs -= 100;
  assert.strictEqual(receiver.decode(reusedAcceptedFrame).reason, 'late_frame');

  const nextKeyframe = clone(reusedAcceptedFrame);
  nextKeyframe.frameId = keyframe.frameId + 1;
  const recovered = receiver.decode(nextKeyframe);
  assert.strictEqual(recovered.accepted, true, recovered.reason || 'next keyframe must recover');
  assert.strictEqual(recovered.frameId, keyframe.frameId + 1, 'rejected missing envelope must not advance the accepted frame watermark');
});

check('Tank Snapshot Codec：丢失 base、冲突 frame 与错 match 均 fail-closed', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const receiver = TankSnapshotWireCodec.create();
  const first = authoritySnapshot('tank-wire-guard');
  const keyframe = sender.encode(first, { recipientKey:'receiver-a', forceKeyframe:true });
  const second = clone(first);
  second.serverTick += 2; second.serverNow += 100; second.remainingMs -= 100; second.players[0].x += 0.1;
  const delta = sender.encode(second, { recipientKey:'receiver-a' });
  assert.strictEqual(delta.mode, 'delta');
  const missing = receiver.decode(delta.envelope);
  assert.strictEqual(missing.accepted, false);
  assert.strictEqual(missing.reason, 'missing_base');
  assert.strictEqual(missing.needKeyframe, true);
  const acceptedKeyframe = receiver.decode(keyframe.envelope);
  assert.strictEqual(acceptedKeyframe.accepted, true);
  const acceptedDelta = receiver.decode(delta.envelope);
  assert.strictEqual(acceptedDelta.accepted, true);
  const duplicate = receiver.decode(delta.envelope);
  assert.strictEqual(duplicate.duplicate, true);
  const conflicting = clone(delta.envelope);
  conflicting.payload.patch.players = [clone(second.players[0])];
  conflicting.payload.patch.players[0].x += 0.2;
  const conflict = receiver.decode(conflicting);
  assert.strictEqual(conflict.reason, 'conflicting_frame');
  assert.strictEqual(conflict.needKeyframe, true);
  const reusedConflictFrame = clone(keyframe.envelope);
  reusedConflictFrame.frameId = delta.frameId;
  reusedConflictFrame.serverTick = second.serverTick + 2;
  reusedConflictFrame.payload.snapshot.serverTick = second.serverTick + 2;
  reusedConflictFrame.payload.snapshot.serverNow = second.serverNow + 100;
  reusedConflictFrame.payload.snapshot.remainingMs = second.remainingMs - 100;
  assert.strictEqual(receiver.decode(reusedConflictFrame).reason, 'late_frame');
  const conflictRecovery = clone(reusedConflictFrame);
  conflictRecovery.frameId = delta.frameId + 1;
  const recovered = receiver.decode(conflictRecovery);
  assert.strictEqual(recovered.accepted, true, recovered.reason || 'newer keyframe must recover after a conflict');
  const other = clone(keyframe.envelope);
  other.matchId = 'tank-wire-other';
  other.payload.snapshot.matchId = 'tank-wire-other';
  const mismatch = receiver.decode(other);
  assert.strictEqual(mismatch.reason, 'match_mismatch');
});

check('Tank Snapshot Codec：未知字段、非有限值与错误 delta 均不产生局部状态', () => {
  const snapshot = authoritySnapshot('tank-wire-invalid');
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100 });
  const receiver = TankSnapshotWireCodec.create();
  const keyframe = sender.encode(snapshot, { recipientKey:'receiver-a', forceKeyframe:true });
  const unknown = clone(keyframe.envelope);
  unknown.payload.snapshot.token = 'must-not-pass';
  const rejectedUnknown = receiver.decode(unknown);
  assert.strictEqual(rejectedUnknown.accepted, false);
  assert.strictEqual(rejectedUnknown.needKeyframe, true);
  receiver.reset({ matchId:null });
  const nonFinite = clone(keyframe.envelope);
  nonFinite.payload.snapshot.players[0].x = Infinity;
  const rejectedNonFinite = receiver.decode(nonFinite);
  assert.strictEqual(rejectedNonFinite.accepted, false);
  assert.strictEqual(rejectedNonFinite.needKeyframe, true);
  receiver.reset({ matchId:null });
  const accepted = receiver.decode(keyframe.envelope);
  assert.strictEqual(accepted.accepted, true);
  const malformedDelta = {
    protocol: TankSnapshotWireCodec.V2_PROTOCOL,
    matchId: snapshot.matchId,
    frameId: keyframe.frameId + 1,
    baseFrameId: keyframe.frameId,
    serverTick: snapshot.serverTick + 2,
    kind: 'delta',
    payload:{ patch:{ scalars:{ status:'running' }, unsafe:true } }
  };
  const rejectedDelta = receiver.decode(malformedDelta);
  assert.strictEqual(rejectedDelta.accepted, false);
  assert.strictEqual(rejectedDelta.needKeyframe, true);
});

check('Tank Snapshot Codec：bounded frame/base 与 reset/dispose 可安全回滚', () => {
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks:100, maxFramesPerRecipient:4 });
  const receiver = TankSnapshotWireCodec.create({ maxFramesPerRecipient:4 });
  let snapshot = authoritySnapshot('tank-wire-bounded');
  const first = sender.encode(snapshot, { recipientKey:'receiver-a', forceKeyframe:true });
  assert.strictEqual(receiver.decode(first.envelope).accepted, true);
  let last = first;
  for (let index = 0; index < 5; index += 1) {
    snapshot = clone(snapshot);
    snapshot.serverTick += 2; snapshot.serverNow += 100; snapshot.remainingMs -= 100; snapshot.players[0].x += 0.01;
    last = sender.encode(snapshot, { recipientKey:'receiver-a' });
    assert.strictEqual(receiver.decode(last.envelope).accepted, true);
  }
  const late = receiver.decode(first.envelope);
  assert.strictEqual(late.reason, 'late_frame');
  const forgotten = sender.forget('receiver-a');
  assert.strictEqual(forgotten.accepted, true);
  assert.strictEqual(forgotten.reason, null);
  assert.strictEqual(sender.forget('receiver-a').reason, 'not_found');
  assert.strictEqual(sender.reset({ matchId:'tank-wire-bounded' }).accepted, true);
  assert.strictEqual(receiver.reset({ matchId:'tank-wire-bounded' }).accepted, true);
  assert.strictEqual(sender.dispose().status, 'disposed');
  assert.strictEqual(sender.encode(snapshot, { recipientKey:'receiver-a' }).reason, 'disposed');
});

if (failures.length) {
  console.error('TANK_SNAPSHOT_WIRE_CODEC_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('TANK_SNAPSHOT_WIRE_CODEC_ALL_PASS');
}
