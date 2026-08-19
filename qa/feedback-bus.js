#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '15-feedback-bus.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const FeedbackBus = require(MODULE_PATH);
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

function enabledEnvironment(overrides) {
  return Object.assign({ enabled: true, audioEnabled: true, hapticsEnabled: true }, overrides || {});
}

let nextCueId = 0;

function cue(type, extras) {
  return Object.assign({ type, id: `cue-${nextCueId++}` }, extras || {});
}

check('UMD/CommonJS exposes only the create seam', () => {
  exactKeys(FeedbackBus, ['create']);
  assert.strictEqual(typeof FeedbackBus.create, 'function');
  assert(Object.isFrozen(FeedbackBus));
});

check('browser-global UMD export has the same narrow seam', () => {
  const context = vm.createContext({ globalThis: {}, Object, Array, String, Math, Number, RegExp, Symbol });
  vm.runInContext(SOURCE, context, { filename: '15-feedback-bus.js' });
  const browserApi = vm.runInContext('globalThis.FeedbackBus', context);
  assert(browserApi);
  exactKeys(browserApi, ['create']);
  const bus = browserApi.create();
  exactKeys(bus, ['dispose', 'emit', 'setEnvironment', 'subscribe']);
});

check('the default bus is inert until an explicit environment opt-in', () => {
  const bus = FeedbackBus.create();
  let calls = 0;
  bus.subscribe(() => { calls += 1; });
  assert.deepStrictEqual(bus.emit(cue('tank_fire')), {
    accepted: false, reason: 'disabled', generation: 0, dispatched: 0, failed: 0
  });
  assert.strictEqual(calls, 0);
});

check('a valid immutable semantic cue reaches local adapters without browser work', () => {
  const bus = FeedbackBus.create();
  const received = [];
  bus.subscribe(cue => received.push(cue));
  assert.strictEqual(bus.setEnvironment(enabledEnvironment()).accepted, true);
  const fire = cue('tank_fire', { intensity: 0.5, pan: -0.75 });
  const result = bus.emit(fire);
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.dispatched, 1);
  assert.strictEqual(received.length, 1);
  assert.deepStrictEqual(received[0], {
    type: 'tank_fire', id: fire.id, intensity: 0.5, pan: -0.75,
    channels: { audio: true, haptic: true }, reducedMotion: false, generation: 1
  });
  assert(Object.isFrozen(received[0]) && Object.isFrozen(received[0].channels));
});

check('the cue vocabulary and payload shape reject illegal or private data', () => {
  const bus = FeedbackBus.create({ environment: enabledEnvironment() });
  const rejected = [
    [cue('unknown'), 'unsupported_type'],
    [cue('tetris_lock', { pan: 0.2 }), 'invalid_pan'],
    [cue('tank_fire', { pan: 2 }), 'invalid_pan'],
    [cue('tank_fire', { intensity: -0.1 }), 'invalid_intensity'],
    [cue('tank_fire', { text: 'private' }), 'sensitive_field'],
    [cue('tank_fire', { debug: true }), 'unsupported_field'],
    [{ type: 'tank_fire' }, 'invalid_id']
  ];
  rejected.forEach(([event, reason]) => assert.strictEqual(bus.emit(event).reason, reason));
  assert.strictEqual(bus.emit(Object.create({ type: 'tank_fire', id: 'proto-1' })).reason, 'invalid_event');
});

check('stable semantic IDs dedupe double triggers and a fixed no-timer rate window is bounded', () => {
  let time = 0;
  const bus = FeedbackBus.create({ environment: enabledEnvironment(), now: () => time });
  let delivered = 0;
  bus.subscribe(() => { delivered += 1; });
  const once = cue('tank_fire');
  assert.strictEqual(bus.emit(once).accepted, true);
  assert.strictEqual(bus.emit(once).reason, 'duplicate');
  for (let index = 0; index < 31; index += 1) assert.strictEqual(bus.emit(cue('tetris_lock')).accepted, true);
  assert.strictEqual(bus.emit(cue('tetris_lock')).reason, 'rate_limited');
  assert.strictEqual(delivered, 32);
  time = 1001;
  assert.strictEqual(bus.emit(cue('tetris_lock')).accepted, true);
});

check('mute and haptic preference independently narrow the delivered channels', () => {
  const bus = FeedbackBus.create({ environment: enabledEnvironment() });
  const received = [];
  bus.subscribe(cue => received.push(cue));
  bus.setEnvironment({ muted: true });
  bus.emit(cue('tank_hit', { pan: 0.25 }));
  assert.deepStrictEqual(received.pop().channels, { audio: false, haptic: true });
  bus.setEnvironment({ muted: false, hapticsEnabled: false });
  bus.emit(cue('tetris_lock'));
  assert.deepStrictEqual(received.pop().channels, { audio: true, haptic: false });
  bus.setEnvironment({ muted: true });
  assert.strictEqual(bus.emit(cue('tetris_lock')).reason, 'silent');
});

check('hidden and reduced-effects suppress output while reduced-motion remains a cue property', () => {
  const bus = FeedbackBus.create({ environment: enabledEnvironment() });
  const received = [];
  bus.subscribe(cue => received.push(cue));
  bus.setEnvironment({ hidden: true });
  assert.strictEqual(bus.emit(cue('gomoku_place')).reason, 'hidden');
  bus.setEnvironment({ hidden: false, reducedMotion: true });
  assert.strictEqual(bus.emit(cue('gomoku_place')).accepted, true);
  assert.strictEqual(received.pop().reducedMotion, true);
  bus.setEnvironment({ reducedEffects: true });
  assert.strictEqual(bus.emit(cue('gomoku_place')).reason, 'reduced_effects');
});

check('listener and reentrant queue limits are fixed', () => {
  const bus = FeedbackBus.create({ environment: enabledEnvironment() });
  let calls = 0;
  for (let index = 0; index < 9; index += 1) bus.subscribe(() => { calls += 1; });
  bus.emit(cue('tetris_lock'));
  assert.strictEqual(calls, 8);

  const nested = FeedbackBus.create({ environment: enabledEnvironment() });
  let nestedAccepted = 0;
  let nestedFull = 0;
  let nestedCalls = 0;
  nested.subscribe(delivery => {
    nestedCalls += 1;
    if (delivery.type !== 'tank_fire') return;
    for (let index = 0; index < 20; index += 1) {
      const outcome = nested.emit(cue('tetris_lock'));
      if (outcome.accepted) nestedAccepted += 1;
      if (outcome.reason === 'queue_full') nestedFull += 1;
    }
  });
  nested.emit(cue('tank_fire'));
  assert.strictEqual(nestedAccepted, 16);
  assert.strictEqual(nestedFull, 4);
  assert.strictEqual(nestedCalls, 17);
});

check('an environment generation change during delivery clears the remaining work', () => {
  const bus = FeedbackBus.create({ environment: enabledEnvironment() });
  let first = 0;
  let second = 0;
  bus.subscribe(() => {
    first += 1;
    bus.setEnvironment({ hidden: true });
  });
  bus.subscribe(() => { second += 1; });
  const output = bus.emit(cue('tank_fire'));
  assert.strictEqual(output.accepted, true);
  assert.strictEqual(first, 1);
  assert.strictEqual(second, 0);
  assert.strictEqual(bus.emit(cue('tank_fire')).reason, 'hidden');
});

check('listener failures are isolated and disposal is terminal', () => {
  const bus = FeedbackBus.create({ environment: enabledEnvironment() });
  let healthy = 0;
  const unsubscribe = bus.subscribe(() => { throw new Error('adapter fault'); });
  bus.subscribe(() => { healthy += 1; });
  const result = bus.emit(cue('tetris_line_clear'));
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.failed, 1);
  assert.strictEqual(healthy, 1);
  assert.strictEqual(unsubscribe(), true);
  assert.strictEqual(unsubscribe(), false);
  assert.deepStrictEqual(bus.dispose(), { status: 'disposed', generation: 1, queued: 0, listeners: 0 });
  assert.strictEqual(bus.emit(cue('tetris_lock')).reason, 'disposed');
  assert.strictEqual(bus.setEnvironment({ enabled: true }).reason, 'disposed');
});

check('the module has no browser effect, transport, persistence, native listener, or timer dependency', () => {
  [
    /\bfetch\b/i, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/,
    /addEventListener/, /removeEventListener/, /setInterval/, /setTimeout/, /AudioContext/, /navigator\s*\./, /vibrate\s*\(/
  ].forEach(pattern => assert(!pattern.test(SOURCE), `forbidden dependency ${pattern}`));
});

if (failures) {
  console.error(`FEEDBACK_BUS_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`FEEDBACK_BUS_ALL_PASS assertions=${assertions}`);
}
