#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '20-tank-prediction-adapter.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const TankPredictionAdapter = require(MODULE_PATH);
let failures = 0;
let assertions = 0;

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
  assert(Math.abs(actual - expected) < 0.0000001, `${label || 'value'} expected ${expected}, got ${actual}`);
}

function input(overrides) {
  return Object.assign({ up: false, right: false, down: false, left: false, fire: false }, overrides || {});
}

function command(generation, sequence, tick, movement, overrides) {
  return Object.assign({
    matchId: 'tank-predict-1',
    generation,
    seq: sequence,
    clientTick: tick,
    input: input(movement)
  }, overrides || {});
}

function player(id, overrides) {
  return Object.assign({ id, x: id ? 12.5 : 1.5, y: id ? 10.5 : 1.5, d: id ? 3 : 1, alive: true, hp: 3, shots: 0 }, overrides || {});
}

function snapshot(tick, ack, overrides) {
  return Object.assign({
    protocol: 'tank-authority-v1',
    matchId: 'tank-predict-1',
    serverTick: tick,
    ack: [ack, 0],
    players: [player(0), player(1)],
    projectiles: [{ id: 7, owner: 1, x: 9, y: 9, d: 3, ttl: 1200 }],
    destructibles: [[3, 3], [3, 3]],
    status: 'running',
    finished: false,
    finishReason: null,
    order: null
  }, overrides || {});
}

function adapter(options) {
  return TankPredictionAdapter.create(Object.assign({ enabled: true, matchId: 'tank-predict-1', playerIndex: 0, generation: 0 }, options || {}));
}

check('UMD/CommonJS exposes only the create seam', () => {
  exactKeys(TankPredictionAdapter, ['create']);
  assert.strictEqual(typeof TankPredictionAdapter.create, 'function');
  assert(Object.isFrozen(TankPredictionAdapter));
});

check('browser-global export and returned Interface stay narrow', () => {
  const context = vm.createContext({ globalThis: {}, Object, Array, String, Number, Math, RegExp, isFinite });
  vm.runInContext(SOURCE, context, { filename: '20-tank-prediction-adapter.js' });
  const api = vm.runInContext('globalThis.TankPredictionAdapter', context);
  assert(api);
  exactKeys(api, ['create']);
  exactKeys(api.create(), ['acceptAuthority', 'dispose', 'reset', 'submitLocalInput']);
});

check('default-off and invalid enabled configuration preserve the old no-prediction path', () => {
  const disabled = TankPredictionAdapter.create();
  assert.strictEqual(disabled.acceptAuthority(snapshot(1, 0)).reason, 'disabled');
  assert.strictEqual(disabled.submitLocalInput(command(0, 1, 1, { right: true })).reason, 'disabled');
  const invalid = TankPredictionAdapter.create({ enabled: true, playerIndex: 0 });
  assert.strictEqual(invalid.acceptAuthority(snapshot(1, 0)).reason, 'invalid_config');
  assert.strictEqual(invalid.submitLocalInput(command(0, 1, 1, { right: true })).reason, 'invalid_config');
});

check('only bounded local movement is replayed from an authority base and no receipt is mutated or exposed', () => {
  const instance = adapter();
  const first = snapshot(10, 0);
  const before = JSON.stringify(first);
  const baseline = instance.acceptAuthority(first);
  assert.strictEqual(baseline.accepted, true);
  close(baseline.presentation.x, 1.5, 'baseline x');
  close(baseline.presentation.y, 1.5, 'baseline y');
  assert.strictEqual(baseline.presentation.replayed, 0);
  assert.strictEqual(baseline.presentation.transition.mode, 'snap');

  const local = instance.submitLocalInput(command(0, 1, 10, { right: true, fire: true }));
  assert.strictEqual(local.accepted, true);
  close(local.presentation.x, 1.6325, 'one fixed right movement');
  close(local.presentation.y, 1.5, 'right movement keeps y');
  assert.strictEqual(local.presentation.d, 1);
  assert.strictEqual(local.presentation.replayed, 1);
  assert.strictEqual(local.presentation.transition.mode, 'snap');

  const fireOnly = instance.submitLocalInput(command(0, 2, 10, { right: true, fire: true }));
  assert.strictEqual(fireOnly.accepted, true);
  close(fireOnly.presentation.x, 1.6325, 'fire has no movement projection');
  assert.strictEqual(fireOnly.presentation.replayed, 1, 'only movement commands are replayed');
  assert.strictEqual(JSON.stringify(first), before, 'the receipt must remain immutable to this adapter');

  const serialized = JSON.stringify(fireOnly.presentation);
  ['projectiles', 'hp', 'destructibles', 'status', 'finishReason', 'order', 'fire'].forEach(key => {
    assert(!serialized.includes(key), `presentation leaked ${key}`);
  });
  assert(Object.isFrozen(fireOnly.presentation));
  assert(Object.isFrozen(fireOnly.presentation.transition));
});

check('authority acknowledgement removes only confirmed input and returns a bounded correction plan', () => {
  const instance = adapter({ smoothingMs: 120 });
  assert.strictEqual(instance.acceptAuthority(snapshot(10, 0)).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 10, { right: true })).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 2, 10, { up: true })).accepted, true);
  const receipt = snapshot(11, 1, { players: [player(0, { x: 1.6325, y: 1.5, d: 1 }), player(1)] });
  const accepted = instance.acceptAuthority(receipt);
  assert.strictEqual(accepted.accepted, true);
  close(accepted.presentation.x, 1.6325, 'confirmed x');
  close(accepted.presentation.y, 1.3675, 'remaining unacknowledged movement');
  assert.strictEqual(accepted.presentation.d, 0);
  assert.strictEqual(accepted.presentation.replayed, 1);
  assert.strictEqual(accepted.presentation.transition.mode, 'smooth');
  assert.strictEqual(accepted.presentation.transition.durationMs, 120);

  const largeCorrection = instance.acceptAuthority(snapshot(12, 2, { players: [player(0, { x: 10, y: 10, d: 2 }), player(1)] }));
  assert.strictEqual(largeCorrection.accepted, true);
  assert.strictEqual(largeCorrection.presentation.replayed, 0);
  assert.strictEqual(largeCorrection.presentation.transition.mode, 'snap');
  assert.strictEqual(largeCorrection.presentation.transition.durationMs, 0);
});

check('stale match, generation, tick, acknowledgement, and sequence conditions fail closed', () => {
  const instance = adapter();
  assert.strictEqual(instance.acceptAuthority(snapshot(10, 0)).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(1, 1, 10, { right: true })).reason, 'stale_generation');
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 9, { right: true })).reason, 'stale_tick');
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 11, { right: true })).reason, 'stale_tick');
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 10, { right: true })).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 10, { right: true })).reason, 'stale_sequence');
  assert.strictEqual(instance.acceptAuthority(snapshot(10, 0)).reason, 'stale_tick');
  const resynchronized = instance.acceptAuthority(snapshot(11, 2));
  assert.strictEqual(resynchronized.accepted, true);
  assert.strictEqual(resynchronized.resynchronized, true, 'trusted Authority ack heals a locally missed command');
  assert.strictEqual(instance.acceptAuthority(snapshot(11, 0, { matchId: 'tank-predict-other' })).reason, 'wrong_match');
  assert.strictEqual(instance.acceptAuthority(snapshot(11, 0, { predictionGeneration: 99 })).reason, 'stale_generation');
  assert.strictEqual(instance.acceptAuthority(snapshot(12, 2)).accepted, true);
  assert.strictEqual(instance.acceptAuthority(snapshot(12, 0)).reason, 'stale_ack');
});

check('reset clears speculative work, advances generation, and cannot reaccept a lower delayed tick', () => {
  const instance = adapter();
  assert.strictEqual(instance.acceptAuthority(snapshot(30, 0)).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 30, { down: true })).accepted, true);
  const reset = instance.reset('reconnect');
  assert.deepStrictEqual(reset, { accepted: true, reason: null, generation: 1, cleared: 1 });
  assert.strictEqual(instance.submitLocalInput(command(0, 2, 30, { down: true })).reason, 'no_authority');
  assert.strictEqual(instance.acceptAuthority(snapshot(29, 0)).reason, 'stale_tick');
  assert.strictEqual(instance.acceptAuthority(snapshot(30, 0, { predictionGeneration: 0 })).reason, 'stale_generation');
  assert.strictEqual(instance.acceptAuthority(snapshot(30, 0)).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(1, 1, 30, { down: true })).accepted, true);
});

check('the pending list is fixed, input records are strict, and a dead local tank remains authority-only', () => {
  const instance = adapter({ maxUnacked: 2 });
  assert.strictEqual(instance.acceptAuthority(snapshot(5, 0)).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 5, { left: true })).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 2, 5, { left: true })).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 3, 5, { left: true })).reason, 'queue_full');
  const recovered = instance.acceptAuthority(snapshot(6, 3));
  assert.strictEqual(recovered.accepted, true, 'Authority ack must rebase after a locally rejected queue-full command');
  assert.strictEqual(recovered.resynchronized, true);
  assert.strictEqual(instance.submitLocalInput(Object.assign(command(0, 3, 5, { left: true }), { raw: 'not accepted' })).reason, 'invalid_command');
  const dead = adapter();
  assert.strictEqual(dead.acceptAuthority(snapshot(5, 0, { players: [player(0, { alive: false }), player(1)] })).accepted, true);
  const predicted = dead.submitLocalInput(command(0, 1, 5, { right: true }));
  assert.strictEqual(predicted.accepted, true);
  close(predicted.presentation.x, 1.5, 'dead player x');
  assert.strictEqual(predicted.presentation.replayed, 0, 'dead state does not fabricate motion');
});

check('malformed records and accessor-backed fields are rejected without invoking caller code', () => {
  const instance = adapter();
  const hostile = snapshot(7, 0);
  Object.defineProperty(hostile, 'serverTick', { enumerable: true, get() { throw new Error('must not run'); } });
  assert.doesNotThrow(() => instance.acceptAuthority(hostile));
  assert.strictEqual(instance.acceptAuthority(hostile).reason, 'invalid_snapshot');
  assert.strictEqual(instance.acceptAuthority(snapshot(7, 0)).accepted, true);
  const hostileInput = input({ right: true });
  Object.defineProperty(hostileInput, 'right', { enumerable: true, get() { throw new Error('must not run'); } });
  assert.doesNotThrow(() => instance.submitLocalInput(command(0, 1, 7, {}, { input: hostileInput })));
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 7, {}, { input: hostileInput })).reason, 'invalid_input');
});

check('dispose is terminal and clears all retained local movement', () => {
  const instance = adapter();
  assert.strictEqual(instance.acceptAuthority(snapshot(3, 0)).accepted, true);
  assert.strictEqual(instance.submitLocalInput(command(0, 1, 3, { right: true })).accepted, true);
  assert.deepStrictEqual(instance.dispose(), { status: 'disposed', generation: 0, queued: 0 });
  assert.strictEqual(instance.submitLocalInput(command(0, 2, 3, { right: true })).reason, 'disposed');
  assert.strictEqual(instance.acceptAuthority(snapshot(4, 1)).reason, 'disposed');
  assert.strictEqual(instance.reset('leave').reason, 'disposed');
});

check('the module has no transport, persistence, timer, platform, rules, or non-local-state dependency', () => {
  [
    /\bfetch\b/i, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/,
    /addEventListener/, /removeEventListener/, /setInterval/, /setTimeout/, /document\s*\./, /window\s*\./, /navigator\s*\./,
    /projectiles/i, /\bhp\b/i, /destructibles/i, /finishReason/i, /\bReward\b/, /\bReplay\b/, /\bmap\b/i
  ].forEach(pattern => assert(!pattern.test(SOURCE), `forbidden dependency or state ${pattern}`));
});

if (failures) {
  console.error(`TANK_PREDICTION_ADAPTER_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`TANK_PREDICTION_ADAPTER_ALL_PASS assertions=${assertions}`);
}
