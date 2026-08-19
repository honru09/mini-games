'use strict';

/*
 * Local network matrix for development evidence only.  Every clock tick is
 * advanced explicitly; this file never opens a socket and never calls a
 * native timer.  It exercises protocol/authority seams under a deterministic
 * virtual transport and must not be described as OS-level network shaping.
 */

const assert = require('assert');
const {
  DeterministicTransport,
  EVIDENCE_CLASS,
  clone,
  digest,
} = require('./helpers/deterministic-transport');
const { TetrisRuleAuthority } = require('../server/gameplay/tetris-rule-authority');
const { TankAuthority } = require('../server/gameplay/tank-sim');
const TankSnapshotWireCodec = require('../shared/protocol/tank-snapshot-wire-codec');

const failures = [];
const LATENCIES = Object.freeze([50, 100, 200]);
const SCENARIOS = Object.freeze([
  Object.freeze({ id: 'ordered', label: 'ordered', jitterMs: 0 }),
  Object.freeze({ id: 'jitter', label: 'jitter', jitterMs: 8 }),
  Object.freeze({ id: 'reorder', label: 'reorder', jitterMs: 0 }),
  Object.freeze({ id: 'duplicate-late', label: 'duplicate+late', jitterMs: 0 }),
  Object.freeze({ id: 'reconnect', label: 'reconnect', jitterMs: 0 }),
]);

function check(name, fn) {
  try {
    fn();
    console.log('PASS  [' + EVIDENCE_CLASS + '] ' + name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL  [' + EVIDENCE_CLASS + '] ' + name + ' :: ' + (error && error.message || error));
  }
}

function profileId(latency, scenario) {
  return 'SIMULATED_NETWORK_' + latency + 'MS_' + scenario.id.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
}

function assertLatency(trace, latency) {
  const delivered = trace.filter(item => item.status === 'delivered');
  assert(delivered.length > 0, 'scenario must deliver at least one packet');
  delivered.forEach(item => {
    assert(item.latencyMs >= latency, 'one-way latency fell below profile base');
    assert(item.observedAt >= item.deliverAt, 'delivery observed before virtual deadline');
  });
}

function actionSnapshot(authority) {
  return clone(authority.snapshot(9999));
}

function runTetrisScenario(latency, scenario, seed) {
  const transport = new DeterministicTransport({ seed, startAt: 0, baseLatencyMs: latency, jitterMs: 0 });
  const authority = new TetrisRuleAuthority({
    matchId: 'sim-tetris-' + latency + '-' + scenario.id,
    playerCount: 2,
    startAt: 1,
    matchEndAt: 100000,
    matchSeed: 'sim-seed-' + seed,
  });
  const outcomes = [];
  transport.register('client', () => {});
  transport.register('server', (payload, meta) => {
    const accepted = authority.acceptAction(0, payload, meta.observedAt);
    outcomes.push({ seq: payload.seq, ok: accepted.ok === true, reason: accepted.reason || null });
  });
  const send = (seq, type, options = {}) => transport.send({
    from: 'client',
    to: 'server',
    channel: 'tetris-action',
    payload: { matchId: authority.matchId, seq, action: { type } },
    ...options,
  });

  if (scenario.id === 'ordered') {
    send(1, 'left');
    send(2, 'right');
    send(3, 'rotate_cw');
  } else if (scenario.id === 'jitter') {
    // Explicit offsets keep the trace ordered while still exercising a
    // bounded, deterministic jitter envelope.
    send(1, 'left', { jitterOffsetMs: 0 });
    send(2, 'right', { jitterOffsetMs: 3 });
    send(3, 'rotate_cw', { jitterOffsetMs: 7 });
  } else if (scenario.id === 'reorder') {
    send(1, 'left', { extraDelayMs: 24 });
    send(2, 'right', { extraDelayMs: 0 });
    send(3, 'rotate_cw', { extraDelayMs: 8 });
  } else if (scenario.id === 'duplicate-late') {
    send(1, 'left');
    send(3, 'rotate_cw', { extraDelayMs: 4, duplicateCount: 1, duplicateDelayMs: 20 });
    send(2, 'right', { extraDelayMs: 56 });
  } else if (scenario.id === 'reconnect') {
    send(1, 'left', { extraDelayMs: 100 });
    transport.advanceTo(latency + 20);
    assert.strictEqual(transport.disconnect('client').ok, true);
    assert.strictEqual(transport.connect('client').ok, true);
    transport.advanceTo(latency + 100);
    send(1, 'left');
  } else {
    throw new Error('unknown_tetris_scenario');
  }

  transport.flush();
  const trace = transport.trace();
  const accepted = outcomes.filter(item => item.ok).map(item => item.seq);
  const rejected = outcomes.filter(item => !item.ok).map(item => item.reason);
  if (scenario.id === 'ordered' || scenario.id === 'jitter') {
    assert.deepStrictEqual(accepted, [1, 2, 3]);
    assert.deepStrictEqual(rejected, []);
  } else if (scenario.id === 'reorder') {
    assert.deepStrictEqual(accepted, [2, 3]);
    assert.deepStrictEqual(rejected, ['ERR_STALE_SEQ']);
  } else if (scenario.id === 'duplicate-late') {
    assert.deepStrictEqual(accepted, [1, 3]);
    assert.deepStrictEqual(rejected, ['ERR_DUPLICATE_ACTION', 'ERR_STALE_SEQ']);
  } else if (scenario.id === 'reconnect') {
    assert.deepStrictEqual(accepted, [1]);
    assert(trace.some(item => item.status === 'dropped' && item.reason === 'stale_connection_epoch'));
  }
  assert.strictEqual(authority.lastSeq[0], accepted.length ? accepted[accepted.length - 1] : 0);
  assertLatency(trace, latency);
  if (scenario.id === 'jitter') {
    trace.filter(item => item.status === 'delivered').forEach(item => assert(item.latencyMs <= latency + scenario.jitterMs));
  }
  const summary = {
    evidenceClass: EVIDENCE_CLASS,
    profile: profileId(latency, scenario),
    latency,
    scenario: scenario.id,
    outcomes,
    accepted,
    rejected,
    lastSeq: authority.lastSeq.slice(),
    snapshot: actionSnapshot(authority),
    trace,
    traceDigest: transport.traceDigest(),
  };
  transport.dispose();
  assert.strictEqual(transport.pendingCount(), 0);
  return summary;
}

function tankSnapshots(matchId) {
  const authority = new TankAuthority({ matchId, playerCount: 2, startedAt: 1000, durationMs: 10000 });
  authority.advance(1100);
  const first = authority.snapshot(1100);
  authority.acceptInput(0, { matchId, seq: 1, clientTick: authority.serverTick, input: { right: true } }, 1101);
  authority.advance(1200);
  const second = authority.snapshot(1200);
  authority.acceptInput(0, { matchId, seq: 2, clientTick: authority.serverTick, input: { right: true, fire: true } }, 1201);
  authority.advance(1300);
  const third = authority.snapshot(1300);
  return { first, second, third };
}

function runTankScenario(latency, scenario, seed) {
  const transport = new DeterministicTransport({ seed, startAt: 0, baseLatencyMs: latency, jitterMs: 0 });
  const matchId = 'sim-tank-' + latency + '-' + scenario.id;
  const snapshots = tankSnapshots(matchId);
  const sender = TankSnapshotWireCodec.create({ keyframeEveryTicks: 100, maxFramesPerRecipient: 4 });
  // One retained frame is sufficient for the normal delta chain and makes a
  // replayed, already superseded envelope exercise the explicit late_frame
  // branch rather than the duplicate cache branch.
  const receiver = TankSnapshotWireCodec.create({ maxFramesPerRecipient: 1 });
  const first = sender.encode(snapshots.first, { recipientKey: 'client', forceKeyframe: true });
  const second = sender.encode(snapshots.second, { recipientKey: 'client' });
  const third = sender.encode(snapshots.third, { recipientKey: 'client' });
  assert.strictEqual(first.accepted, true, first.reason || 'first encode');
  assert.strictEqual(second.accepted, true, second.reason || 'second encode');
  assert.strictEqual(third.accepted, true, third.reason || 'third encode');
  const outcomes = [];
  transport.register('server', () => {});
  transport.register('client', (payload, meta) => {
    const decoded = receiver.decode(payload);
    outcomes.push({ packetId: meta.packetId, mode: payload.kind, accepted: decoded.accepted === true, reason: decoded.reason || null, snapshot: decoded.snapshot ? clone(decoded.snapshot) : null });
  });
  const send = (envelope, options = {}) => transport.send({
    from: 'server',
    to: 'client',
    channel: 'tank-snapshot',
    payload: clone(envelope),
    ...options,
  });

  if (scenario.id === 'ordered') {
    send(first.envelope);
    send(second.envelope);
    send(third.envelope);
  } else if (scenario.id === 'jitter') {
    send(first.envelope, { jitterOffsetMs: 0 });
    send(second.envelope, { jitterOffsetMs: 2 });
    send(third.envelope, { jitterOffsetMs: 6 });
  } else if (scenario.id === 'reorder') {
    // A delta arrives before its base.  Replaying that same envelope after
    // the keyframe models the receiver's requested keyframe recovery.
    send(second.envelope, { extraDelayMs: 0 });
    send(first.envelope, { extraDelayMs: 12 });
    send(second.envelope, { extraDelayMs: 24 });
    send(third.envelope, { extraDelayMs: 36 });
  } else if (scenario.id === 'duplicate-late') {
    send(first.envelope);
    send(second.envelope, { extraDelayMs: 4 });
    send(third.envelope, { extraDelayMs: 8, duplicateCount: 1, duplicateDelayMs: 16 });
    send(second.envelope, { extraDelayMs: 40 });
  } else if (scenario.id === 'reconnect') {
    send(first.envelope);
    transport.advanceTo(latency);
    send(second.envelope, { extraDelayMs: 100 });
    assert.strictEqual(transport.disconnect('client').ok, true);
    transport.advanceTo(latency + 100);
    assert.strictEqual(sender.forget('client').accepted, true);
    assert.strictEqual(receiver.reset({ matchId }).accepted, true);
    assert.strictEqual(transport.connect('client').ok, true);
    const fresh = sender.encode(snapshots.third, { recipientKey: 'client', forceKeyframe: true });
    assert.strictEqual(fresh.accepted, true, fresh.reason || 'reconnect keyframe encode');
    send(fresh.envelope);
  } else {
    throw new Error('unknown_tank_scenario');
  }

  transport.flush();
  const trace = transport.trace();
  assertLatency(trace, latency);
  const accepted = outcomes.filter(item => item.accepted);
  if (scenario.id === 'ordered' || scenario.id === 'jitter') {
    assert.deepStrictEqual(accepted.map(item => item.mode), ['keyframe', 'delta', 'delta']);
    assert.deepStrictEqual(accepted.map(item => item.snapshot.serverTick), [snapshots.first.serverTick, snapshots.second.serverTick, snapshots.third.serverTick]);
  } else if (scenario.id === 'reorder') {
    assert.strictEqual(outcomes[0].accepted, false);
    assert.strictEqual(outcomes[0].reason, 'missing_base');
    assert.deepStrictEqual(accepted.map(item => item.snapshot.serverTick), [snapshots.first.serverTick, snapshots.second.serverTick, snapshots.third.serverTick]);
  } else if (scenario.id === 'duplicate-late') {
    assert.deepStrictEqual(accepted.map(item => item.snapshot.serverTick), [snapshots.first.serverTick, snapshots.second.serverTick, snapshots.third.serverTick]);
    assert(outcomes.some(item => item.reason === 'duplicate_frame' && item.accepted === false));
    assert(outcomes.some(item => item.reason === 'late_frame' && item.accepted === false));
  } else if (scenario.id === 'reconnect') {
    assert.deepStrictEqual(accepted.map(item => item.mode), ['keyframe', 'keyframe']);
    assert(trace.some(item => item.status === 'dropped' && item.reason === 'stale_connection_epoch'));
  }
  const summary = {
    evidenceClass: EVIDENCE_CLASS,
    profile: profileId(latency, scenario),
    latency,
    scenario: scenario.id,
    outcomes,
    trace,
    traceDigest: transport.traceDigest(),
  };
  transport.dispose();
  assert.strictEqual(transport.pendingCount(), 0);
  return summary;
}

function transportContractChecks() {
  check('virtual clock and queue are synchronous (no native timer needed)', () => {
    const transport = new DeterministicTransport({ seed: 77, baseLatencyMs: 50 });
    const seen = [];
    transport.register('a', () => {});
    transport.register('b', (payload, meta) => { seen.push({ payload, meta }); payload.value = 'receiver-mutated'; });
    const source = { value: 'original', nested: { count: 1 } };
    const sent = transport.send({ from: 'a', to: 'b', payload: source, duplicate: true, duplicateDelayMs: 10 });
    source.nested.count = 99;
    assert.strictEqual(transport.pendingCount(), 2);
    assert.strictEqual(transport.advanceTo(49).delivered, 0);
    assert.strictEqual(transport.advanceTo(50).delivered, 1);
    assert.strictEqual(seen[0].payload.nested.count, 1);
    assert.strictEqual(transport.advanceTo(60).delivered, 1);
    assert.strictEqual(seen[1].payload.nested.count, 1);
    assert.notStrictEqual(seen[0].payload, seen[1].payload);
    assert.strictEqual(sent.ok, true);
    transport.dispose();
  });

  check('epoch fence drops queued packets and dispose leaves no work', () => {
    const transport = new DeterministicTransport({ seed: 78, baseLatencyMs: 50 });
    const seen = [];
    transport.register('a', () => {});
    transport.register('b', payload => seen.push(payload));
    transport.send({ from: 'a', to: 'b', payload: { seq: 1 }, extraDelayMs: 50 });
    assert.strictEqual(transport.disconnect('b').ok, true);
    const dropped = transport.advanceTo(100);
    assert.strictEqual(dropped.delivered, 0);
    assert.strictEqual(dropped.dropped, 1);
    assert.strictEqual(seen.length, 0);
    assert.strictEqual(transport.connect('b').ok, true);
    transport.send({ from: 'a', to: 'b', payload: { seq: 2 } });
    assert.strictEqual(transport.flush().delivered, 1);
    assert.deepStrictEqual(seen, [{ seq: 2 }]);
    transport.send({ from: 'a', to: 'b', payload: { seq: 3 }, extraDelayMs: 500 });
    assert.strictEqual(transport.dispose(), true);
    assert.strictEqual(transport.pendingCount(), 0);
    assert.strictEqual(transport.flush().reason, 'disposed');
    assert.strictEqual(transport.send({ from: 'a', to: 'b', payload: {} }).reason, 'disposed');
  });

  check('same seed produces byte-identical trace and different seed changes jitter trace', () => {
    const run = seed => {
      const transport = new DeterministicTransport({ seed, baseLatencyMs: 100, jitterMs: 9 });
      transport.register('a', () => {});
      transport.register('b', () => {});
      for (let i = 0; i < 8; i += 1) transport.send({ from: 'a', to: 'b', payload: { i } });
      transport.flush();
      return transport.traceDigest();
    };
    assert.strictEqual(run(91), run(91));
    assert.notStrictEqual(run(91), run(92));
  });
}

transportContractChecks();

for (const latency of LATENCIES) {
  for (const scenario of SCENARIOS) {
    check(profileId(latency, scenario) + ' Tetris authority action trace', () => {
      const seed = latency * 100 + scenario.id.length;
      const first = runTetrisScenario(latency, scenario, seed);
      const second = runTetrisScenario(latency, scenario, seed);
      assert.strictEqual(first.traceDigest, second.traceDigest, 'same seed must replay the same trace');
      assert.strictEqual(digest(first.outcomes), digest(second.outcomes));
      assert.strictEqual(digest(first.snapshot), digest(second.snapshot));
    });
    check(profileId(latency, scenario) + ' Tank snapshot codec trace', () => {
      const seed = latency * 1000 + scenario.id.length;
      const first = runTankScenario(latency, scenario, seed);
      const second = runTankScenario(latency, scenario, seed);
      assert.strictEqual(first.traceDigest, second.traceDigest, 'same seed must replay the same trace');
      assert.strictEqual(digest(first.outcomes), digest(second.outcomes));
    });
  }
}

console.log('INFO  ' + EVIDENCE_CLASS + ' :: virtual one-way latency profiles 50/100/200ms; no OS shaper, physical device, second browser, or production claim');
if (failures.length) {
  console.error('NETWORK_SIMULATION_MATRIX_FAILED: ' + failures.join('、'));
  process.exitCode = 1;
} else {
  console.log('NETWORK_SIMULATION_MATRIX_ALL_PASS [' + EVIDENCE_CLASS + '] profiles=' + (LATENCIES.length * SCENARIOS.length * 2));
}
