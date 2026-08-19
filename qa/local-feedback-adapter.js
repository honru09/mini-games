#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '17-local-feedback-adapter.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8');
const LocalFeedbackAdapter = require(MODULE_PATH);
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

function makeBus() {
  let listener = null;
  return {
    subscribe(fn) { listener = fn; return () => { listener = null; }; },
    emit(cue) { if (listener) listener(cue); },
    hasListener() { return typeof listener === 'function'; }
  };
}

function makeContext(options) {
  const opts = Object.assign({ stereo: true, stopFailure: false }, options || {});
  const calls = { oscillators: [], gains: [], panners: [], resume: 0, close: 0 };
  const context = {
    currentTime: 10,
    destination: { destination: true },
    createOscillator() {
      const oscillator = {
        frequency: { value: 0, setValueAtTime(value) { this.value = value; } },
        onended: null,
        startCalls: 0,
        stopCalls: 0,
        connections: 0,
        connect() { this.connections += 1; },
        disconnect() {},
        start() { this.startCalls += 1; },
        stop() { this.stopCalls += 1; if (opts.stopFailure) throw new Error('stop failure'); }
      };
      calls.oscillators.push(oscillator);
      return oscillator;
    },
    createGain() {
      const gain = {
        gain: { value: 0, setValueAtTime(value) { this.value = value; } },
        connections: 0,
        connect() { this.connections += 1; },
        disconnect() {}
      };
      calls.gains.push(gain);
      return gain;
    },
    resume() { calls.resume += 1; },
    close() { calls.close += 1; }
  };
  if (opts.stereo) {
    context.createStereoPanner = function createStereoPanner() {
      const panner = {
        pan: { value: 0, setValueAtTime(value) { this.value = value; } },
        connections: 0,
        connect() { this.connections += 1; },
        disconnect() {}
      };
      calls.panners.push(panner);
      return panner;
    };
  }
  context.calls = calls;
  return context;
}

function cue(type, channels, extras) {
  return Object.assign({
    type,
    id: `semantic-${Math.random().toString(36).slice(2)}`,
    intensity: 0.75,
    pan: 0,
    channels,
    reducedMotion: false
  }, extras || {});
}

check('UMD/CommonJS exposes only the create seam', () => {
  exactKeys(LocalFeedbackAdapter, ['create']);
  assert.strictEqual(typeof LocalFeedbackAdapter.create, 'function');
  assert(Object.isFrozen(LocalFeedbackAdapter));
});

check('browser-global export and returned interface stay narrow', () => {
  const context = vm.createContext({ globalThis: {}, Object, Array, String, Math, Number, RegExp, Date });
  vm.runInContext(SOURCE, context, { filename: '17-local-feedback-adapter.js' });
  const api = vm.runInContext('globalThis.LocalFeedbackAdapter', context);
  assert(api);
  exactKeys(api, ['create']);
  exactKeys(api.create(), ['dispose', 'snapshot', 'unlock']);
});

check('default-off does not subscribe, create audio, vibrate, or throw', () => {
  const bus = makeBus();
  let factoryCalls = 0;
  let hapticCalls = 0;
  const adapter = LocalFeedbackAdapter.create({
    bus,
    audioContextFactory() { factoryCalls += 1; return makeContext(); },
    vibrate() { hapticCalls += 1; }
  });
  exactKeys(adapter, ['dispose', 'snapshot', 'unlock']);
  assert.strictEqual(bus.hasListener(), false);
  assert.strictEqual(adapter.unlock().reason, 'disabled');
  bus.emit(cue('tank_fire', { audio: true, haptic: true }));
  assert.strictEqual(factoryCalls, 0);
  assert.strictEqual(hapticCalls, 0);
  assert.strictEqual(adapter.snapshot().activeVoices, 0);
});

check('explicit opt-in subscribes but AudioContext waits for unlock', () => {
  const bus = makeBus();
  let factoryCalls = 0;
  const context = makeContext();
  const adapter = LocalFeedbackAdapter.create({
    enabled: true,
    bus,
    audioContextFactory() { factoryCalls += 1; return context; }
  });
  assert.strictEqual(bus.hasListener(), true);
  bus.emit(cue('tank_fire', { audio: true, haptic: false }));
  assert.strictEqual(factoryCalls, 0);
  assert.strictEqual(adapter.snapshot().audioStarted, 0);
  assert.strictEqual(adapter.unlock().accepted, true);
  assert.strictEqual(factoryCalls, 1);
  assert.strictEqual(context.calls.resume, 1);
  bus.emit(cue('tank_fire', { audio: true, haptic: false }, { pan: -0.8 }));
  assert.strictEqual(context.calls.oscillators.length, 1);
  assert.strictEqual(context.calls.panners[0].pan.value, -0.8);
});

check('missing stereo panner falls back to centered gain output', () => {
  const bus = makeBus();
  const context = makeContext({ stereo: false });
  const adapter = LocalFeedbackAdapter.create({ enabled: true, bus, audioContextFactory: () => context });
  adapter.unlock();
  bus.emit(cue('tank_hit', { audio: true, haptic: false }, { pan: 1 }));
  assert.strictEqual(context.calls.panners.length, 0);
  assert.strictEqual(adapter.snapshot().activePanners, 0);
  assert.strictEqual(adapter.snapshot().audioStarted, 1);
});

check('audio and haptic channels are independent; reduced motion disables haptic', () => {
  const bus = makeBus();
  const context = makeContext();
  const haptics = [];
  const adapter = LocalFeedbackAdapter.create({ enabled: true, bus, audioContextFactory: () => context, vibrate: value => haptics.push(value) });
  adapter.unlock();
  bus.emit(cue('tank_hit', { audio: false, haptic: true }));
  assert.strictEqual(context.calls.oscillators.length, 0);
  assert.strictEqual(haptics.length, 1);
  bus.emit(cue('tank_fire', { audio: true, haptic: false }));
  assert.strictEqual(context.calls.oscillators.length, 1);
  bus.emit(cue('tank_hit', { audio: false, haptic: true }, { reducedMotion: true }));
  assert.strictEqual(haptics.length, 1);
});

check('WebAudio, vibration, and bus failures are isolated', () => {
  const bus = makeBus();
  let hapticCalls = 0;
  const adapter = LocalFeedbackAdapter.create({
    enabled: true,
    bus,
    audioContextFactory() { throw new Error('factory failure'); },
    vibrate() { hapticCalls += 1; throw new Error('haptic failure'); }
  });
  assert.doesNotThrow(() => adapter.unlock());
  assert.doesNotThrow(() => bus.emit(cue('tank_hit', { audio: true, haptic: true })));
  assert.strictEqual(hapticCalls, 1);
  const badBus = { subscribe() { throw new Error('subscribe failure'); } };
  assert.doesNotThrow(() => LocalFeedbackAdapter.create({ enabled: true, bus: badBus }));
});

check('active voice, oscillator, gain, and panner counts never exceed eight', () => {
  const bus = makeBus();
  const context = makeContext();
  const adapter = LocalFeedbackAdapter.create({ enabled: true, bus, audioContextFactory: () => context });
  adapter.unlock();
  for (let index = 0; index < 20; index += 1) bus.emit(cue('tank_fire', { audio: true, haptic: false }, { pan: (index % 3) - 1 }));
  const snapshot = adapter.snapshot();
  assert.strictEqual(snapshot.activeVoices, 8);
  assert(snapshot.activeOscillators <= 8 && snapshot.activeGains <= 8 && snapshot.activePanners <= 8);
  assert.strictEqual(snapshot.audioSkipped, 12);
});

check('dispose is idempotent, unsubscribes, cleans nodes, and closes own context', () => {
  const bus = makeBus();
  const context = makeContext();
  const adapter = LocalFeedbackAdapter.create({ enabled: true, bus, audioContextFactory: () => context });
  adapter.unlock();
  bus.emit(cue('tank_fire', { audio: true, haptic: false }));
  const first = adapter.dispose();
  const second = adapter.dispose();
  assert.strictEqual(bus.hasListener(), false);
  assert.strictEqual(first.disposed, true);
  assert.strictEqual(first.activeVoices, 0);
  assert.strictEqual(second.disposed, true);
  assert.strictEqual(context.calls.close, 1);
  assert.strictEqual(adapter.unlock().reason, 'disposed');
});

check('a double stop failure is fail-silent and cannot pin an active voice', () => {
  const bus = makeBus();
  const context = makeContext({ stopFailure: true });
  const adapter = LocalFeedbackAdapter.create({ enabled: true, bus, audioContextFactory: () => context });
  adapter.unlock();
  assert.doesNotThrow(() => bus.emit(cue('tank_fire', { audio: true, haptic: false })));
  const snapshot = adapter.snapshot();
  assert.strictEqual(snapshot.activeVoices, 0);
  assert(snapshot.audioFailures >= 1);
});

check('snapshot is bounded and never contains node objects or cue data', () => {
  const bus = makeBus();
  const context = makeContext();
  const adapter = LocalFeedbackAdapter.create({ enabled: true, bus, audioContextFactory: () => context });
  adapter.unlock();
  bus.emit(cue('tank_fire', { audio: true, haptic: false }, { id: 'private-cue-id', text: 'private' }));
  const snapshot = adapter.snapshot();
  const serialized = JSON.stringify(snapshot);
  assert(Object.isFrozen(snapshot));
  assert(!serialized.includes('private-cue-id') && !serialized.includes('private'));
  assert(!serialized.includes('oscillator') || serialized.includes('activeOscillators'));
  Object.keys(snapshot).forEach(key => assert.notStrictEqual(typeof snapshot[key], 'object'));
});

check('module has no platform discovery, persistence, transport, framework, or raw input dependency', () => {
  [
    /\bfetch\b/i, /XMLHttpRequest/, /sendBeacon/, /WebSocket/, /localStorage/, /sessionStorage/, /indexedDB/,
    /document\s*\./, /window\s*\./, /navigator\s*\./, /addEventListener/, /removeEventListener/,
    /setInterval/, /setTimeout/, /KeyboardEvent/, /PointerEvent/, /TouchEvent/, /keyCode/, /clientX/, /clientY/,
    /gsap\./, /three\./, /Rule|Authority|Reward|Replay|Chat/
  ].forEach(pattern => assert(!pattern.test(SOURCE), `forbidden dependency ${pattern}`));
});

if (failures) {
  console.error(`LOCAL_FEEDBACK_ADAPTER_FAILURES=${failures}/${assertions}`);
  process.exitCode = 1;
} else {
  console.log(`LOCAL_FEEDBACK_ADAPTER_ALL_PASS assertions=${assertions}`);
}
