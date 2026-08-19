#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'server', 'gameplay', 'engagement-integrity.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8').replace(/^\uFEFF/, '');
const EngagementIntegrityAnalyzer = require(MODULE_PATH);

let assertions = 0;
let failures = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log(`PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${label} :: ${error && error.message || error}`);
  }
}

function exactKeys(value, expected) {
  assert.deepStrictEqual(Object.keys(value).sort(), expected.slice().sort());
}

function close(actual, expected, label) {
  assert(Number.isFinite(actual), `${label || 'value'} must be finite`);
  assert(Math.abs(actual - expected) < 0.000000001,
    `${label || 'value'} expected ${expected}, got ${actual}`);
}

function summary(overrides) {
  return Object.assign({
    gameId: 'tank',
    mode: 'online',
    actorSlot: 0,
    actorClass: 'human',
    sourceClass: 'authority',
    actionClass: 'move',
    acceptedAt: 1000,
    sequenceClass: 'monotonic',
    reconnectEpoch: 0,
    inputModality: 'keyboard',
  }, overrides || {});
}

check('module and instance expose one narrow pure seam', () => {
  exactKeys(EngagementIntegrityAnalyzer, ['create']);
  assert.strictEqual(typeof EngagementIntegrityAnalyzer.create, 'function');
  assert(Object.isFrozen(EngagementIntegrityAnalyzer));
  const instance = EngagementIntegrityAnalyzer.create();
  exactKeys(instance, ['dispose', 'record', 'reset', 'snapshot']);
  assert(Object.isFrozen(instance));
  assert.strictEqual(instance.observe, instance.record);
  assert.strictEqual(instance.report, instance.snapshot);
});

check('analyzer is default-off and always reports audit-only measurements', () => {
  const instance = EngagementIntegrityAnalyzer.create();
  assert.deepStrictEqual(instance.record(summary()), { accepted: false, reason: 'disabled' });
  const report = instance.snapshot();
  assert.strictEqual(report.auditOnly, true);
  assert.strictEqual(report.enabled, false);
  assert.strictEqual(report.acceptedCount, 0);
  assert.strictEqual(report.transitionCount, 0);
  assert.strictEqual(report.repeatRatio, 0);
  assert.strictEqual(report.observedMs, 0);
  assert.strictEqual(report.APM, 0);
  assert.strictEqual(report.entropy, 0);
  assert.strictEqual(report.entropyApplicable, false);
  assert.strictEqual(report.confidence, 0);
  assert(Array.isArray(report.reasons));
  assert(!Object.prototype.hasOwnProperty.call(report, 'verdict'));
});

check('only the ten fixed accepted-action summary fields cross the boundary', () => {
  let now = 5000;
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, now: () => now });
  const input = summary();
  const accepted = instance.record(input);
  assert.strictEqual(accepted.accepted, true);
  assert.strictEqual(accepted.reason, null);
  assert(Object.isFrozen(accepted));
  assert(Object.isFrozen(accepted.summary));
  exactKeys(accepted.summary, [
    'gameId', 'mode', 'actorSlot', 'actorClass', 'sourceClass', 'actionClass',
    'acceptedAt', 'sequenceClass', 'reconnectEpoch', 'inputModality',
  ]);
  input.actionClass = 'fire';
  input.acceptedAt = 999999;
  assert.strictEqual(accepted.summary.actionClass, 'move');
  assert.strictEqual(instance.snapshot().acceptedCount, 1);
  now += 1;
});

check('UIDs, match identifiers, payloads, coordinates, text and unknown fields are rejected', () => {
  const forbidden = [
    ['uid', 'user-1'],
    ['userId', 'user-1'],
    ['matchId', 'match-1'],
    ['payload', { x: 1 }],
    ['x', 1],
    ['coordinates', [1, 2]],
    ['text', 'hello'],
    ['message', 'hello'],
    ['debug', true],
  ];
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true });
  forbidden.forEach(([key, value]) => {
    const input = summary();
    input[key] = value;
    const outcome = instance.record(input);
    assert.strictEqual(outcome.accepted, false, key);
    assert(['sensitive_field', 'unsupported_field'].includes(outcome.reason), `${key}: ${outcome.reason}`);
  });
  const hidden = summary();
  Object.defineProperty(hidden, 'payload', { value: 'hidden', enumerable: false });
  assert.strictEqual(instance.record(hidden).accepted, false);
  const symbol = summary();
  symbol[Symbol('payload')] = 'hidden';
  assert.strictEqual(instance.record(symbol).accepted, false);
  assert.strictEqual(instance.snapshot().acceptedCount, 0);
});

check('malformed values and accessor-backed summaries fail open without executing caller code', () => {
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true });
  assert.deepStrictEqual(instance.record(null), { accepted: false, reason: 'invalid_record' });
  assert.strictEqual(instance.record(summary({ actorClass: 'player name' })).accepted, false);
  assert.strictEqual(instance.record(summary({ actorClass: 'operator' })).accepted, false);
  assert.strictEqual(instance.record(summary({ actorSlot: 6 })).accepted, false);
  assert.strictEqual(instance.record(summary({ acceptedAt: NaN })).accepted, false);
  assert.strictEqual(instance.record(summary({ reconnectEpoch: -1 })).accepted, false);
  const missing = summary();
  delete missing.mode;
  assert.deepStrictEqual(instance.record(missing), { accepted: false, reason: 'missing_field' });
  const accessor = summary();
  let invoked = false;
  Object.defineProperty(accessor, 'actionClass', {
    enumerable: true,
    get() { invoked = true; throw new Error('must not run'); },
  });
  assert.doesNotThrow(() => instance.record(accessor));
  assert.strictEqual(instance.record(accessor).accepted, false);
  assert.strictEqual(invoked, false);
  const hostile = new Proxy({}, { ownKeys() { throw new Error('hostile proxy'); } });
  assert.doesNotThrow(() => instance.record(hostile));
  assert.strictEqual(instance.record(hostile).accepted, false);
  assert.strictEqual(instance.snapshot().acceptedCount, 0);
});

check('APM, transitions, repetition and Shannon entropy are descriptive and deterministic', () => {
  let now = 0;
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, now: () => now });
  const actions = ['move', 'move', 'fire', 'fire'];
  actions.forEach((actionClass, index) => {
    now = index * 1000;
    const outcome = instance.record(summary({ actionClass, acceptedAt: 1000 + index * 1000 }));
    assert.strictEqual(outcome.accepted, true);
  });
  const report = instance.snapshot();
  assert.strictEqual(report.auditOnly, true);
  assert.strictEqual(report.acceptedCount, 4);
  assert.strictEqual(report.transitionCount, 1);
  close(report.repeatRatio, 2 / 3, 'repeat ratio');
  assert.strictEqual(report.observedMs, 3000);
  close(report.APM, 80, 'APM');
  close(report.entropy, 1, 'entropy');
  assert.strictEqual(report.entropyApplicable, true);
  assert(report.confidence > 0 && report.confidence <= 1);
  assert(!Object.prototype.hasOwnProperty.call(report, 'verdict'));
});

check('one accepted action explicitly marks entropy as not applicable', () => {
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, now: () => 100 });
  assert.strictEqual(instance.record(summary()).accepted, true);
  const report = instance.snapshot();
  assert.strictEqual(report.acceptedCount, 1);
  assert.strictEqual(report.entropy, 0);
  assert.strictEqual(report.entropyApplicable, false);
  assert(report.reasons.includes('entropy_not_applicable'));
  assert.strictEqual(report.APM, 0);
});

check('human, AI, Test Admin, spectator and reconnect summaries remain separately contextual', () => {
  let now = 0;
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, now: () => now });
  const records = [
    summary({ actorClass: 'human', actorSlot: 0, sourceClass: 'authority', inputModality: 'assistive' }),
    summary({ actorClass: 'ai', actorSlot: 1, sourceClass: 'ai', inputModality: 'server', acceptedAt: 1100 }),
    summary({ actorClass: 'test-admin', actorSlot: 2, sourceClass: 'test-admin', inputModality: 'synthetic', acceptedAt: 1200 }),
    summary({ actorClass: 'spectator', actorSlot: -1, mode: 'spectator', sourceClass: 'spectator', inputModality: 'server', acceptedAt: 1300 }),
    summary({ actorClass: 'human', actorSlot: 0, sourceClass: 'reconnect', sequenceClass: 'reconnect', reconnectEpoch: 1, inputModality: 'touch', acceptedAt: 1400 }),
  ];
  records.forEach((record, index) => {
    now = index;
    assert.strictEqual(instance.record(record).accepted, true);
  });
  const report = instance.snapshot();
  assert.strictEqual(report.acceptedCount, 5);
  assert.strictEqual(report.transitionCount, 0, 'class/context boundaries must not fabricate action transitions');
  assert.strictEqual(report.repeatRatio, 0, 'class/context boundaries must not fabricate repeats');
  assert(report.reasons.includes('no_transitions'));
});

check('TTL pruning is lazy, bounded and creates no scheduled work', () => {
  let now = 0;
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, ttlMs: 100, now: () => now });
  assert.strictEqual(instance.record(summary({ acceptedAt: 0 })).accepted, true);
  now = 99;
  assert.strictEqual(instance.snapshot().acceptedCount, 1);
  now = 100;
  const expired = instance.snapshot();
  assert.strictEqual(expired.acceptedCount, 0);
  assert(expired.reasons.includes('ttl_pruned'));
});

check('capacity saturation drops the oldest retained observation without unbounded growth', () => {
  let now = 0;
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, capacity: 2, now: () => now });
  ['move', 'fire', 'turn'].forEach((actionClass, index) => {
    now = index;
    assert.strictEqual(instance.record(summary({ actionClass, acceptedAt: 1000 + index })).accepted, true);
  });
  const report = instance.snapshot();
  assert.strictEqual(report.capacity, 2);
  assert.strictEqual(report.acceptedCount, 2);
  assert.strictEqual(report.totalAccepted, 3);
  assert.strictEqual(report.saturated, true);
  assert(report.reasons.includes('capacity_saturated'));
  assert.strictEqual(report.transitionCount, 1);
});

check('wall-clock and acceptedAt rollback never produce negative or infinite measurements', () => {
  let now = 100;
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, now: () => now });
  assert.strictEqual(instance.record(summary({ acceptedAt: 1000 })).accepted, true);
  now = 90;
  assert.strictEqual(instance.record(summary({ acceptedAt: 900, actionClass: 'fire' })).accepted, true);
  const report = instance.snapshot();
  assert.strictEqual(report.acceptedCount, 2);
  assert.strictEqual(report.observedMs, 0);
  assert.strictEqual(report.APM, 0);
  assert(Number.isFinite(report.repeatRatio));
  assert(Number.isFinite(report.entropy));
  assert(Number.isFinite(report.confidence));
  assert(report.reasons.includes('clock_rollback'));
});

check('a throwing or invalid clock is isolated and does not disable later observation', () => {
  let calls = 0;
  const instance = EngagementIntegrityAnalyzer.create({
    enabled: true,
    now() {
      calls += 1;
      if (calls === 1) throw new Error('clock unavailable');
      return 2000 + calls;
    },
  });
  assert.doesNotThrow(() => instance.record(summary()));
  assert.strictEqual(instance.record(summary({ actionClass: 'fire', acceptedAt: 2000 })).accepted, true);
  const report = instance.snapshot();
  assert(report.acceptedCount >= 1);
  assert(report.reasons.includes('clock_error'));
});

check('reset clears observations and anomaly state while dispose is terminal', () => {
  let now = 0;
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, capacity: 1, now: () => now });
  instance.record(summary());
  now += 1;
  instance.record(summary({ actionClass: 'fire', acceptedAt: 1100 }));
  assert.strictEqual(instance.snapshot().saturated, true);
  assert.deepStrictEqual(instance.reset('caller text is ignored'), { accepted: true, reason: null, cleared: 1 });
  const reset = instance.snapshot();
  assert.strictEqual(reset.acceptedCount, 0);
  assert.strictEqual(reset.saturated, false);
  assert(!reset.reasons.includes('capacity_saturated'));
  instance.record(summary());
  assert.deepStrictEqual(instance.dispose(), { status: 'disposed' });
  assert.deepStrictEqual(instance.dispose(), { status: 'disposed' });
  assert.deepStrictEqual(instance.record(summary()), { accepted: false, reason: 'disposed' });
  assert.deepStrictEqual(instance.reset(), { accepted: false, reason: 'disposed' });
  const disposed = instance.snapshot();
  assert.strictEqual(disposed.auditOnly, true);
  assert.strictEqual(disposed.status, 'disposed');
  assert.strictEqual(disposed.acceptedCount, 0);
  assert.deepStrictEqual(disposed.reasons, ['disposed']);
});

check('snapshots, reasons, confidence bounds and accepted summaries are immutable', () => {
  const instance = EngagementIntegrityAnalyzer.create({ enabled: true, now: () => 0 });
  const accepted = instance.record(summary());
  const report = instance.snapshot();
  assert(Object.isFrozen(report));
  assert(Object.isFrozen(report.reasons));
  assert(Object.isFrozen(report.confidenceInterval));
  assert(Object.isFrozen(accepted.summary));
  assert.throws(() => { report.acceptedCount = 99; }, TypeError);
  assert.throws(() => { report.reasons.push('mutated'); }, TypeError);
  assert.throws(() => { report.confidenceInterval.lower = 1; }, TypeError);
  assert.strictEqual(instance.snapshot().acceptedCount, 1);
});

check('source has no scheduling, transport, persistence or authority-side integration', () => {
  [
    /\bsetTimeout\b/, /\bsetInterval\b/, /\bsetImmediate\b/, /\bqueueMicrotask\b/,
    /\bfetch\b/i, /XMLHttpRequest/, /sendBeacon/, /WebSocket/,
    /\blocalStorage\b/, /\bsessionStorage\b/, /\bindexedDB\b/,
    /\brequire\s*\(/, /\bfs\s*\./, /\bSupabase\b/i,
    /\bReward\b/, /\bReplay\b/, /\bAnalytics\b/,
  ].forEach(pattern => assert(!pattern.test(SOURCE), `forbidden dependency ${pattern}`));
});

if (failures) {
  console.error(`ENGAGEMENT_INTEGRITY_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`ENGAGEMENT_INTEGRITY_ALL_PASS assertions=${assertions}`);
}

