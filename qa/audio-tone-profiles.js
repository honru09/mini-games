#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const adapterPath = path.join(ROOT, 'public/src/core/21-unified-feedback-adapter.js');
const busPath = path.join(ROOT, 'public/src/core/15-feedback-bus.js');
const source = fs.readFileSync(adapterPath, 'utf8');
const busSource = fs.readFileSync(busPath, 'utf8');
const Adapter = require(adapterPath);

let assertions = 0;
let failures = 0;
function check(label, fn) {
  assertions += 1;
  try { fn(); process.stdout.write(`PASS  ${label}\n`); }
  catch (error) { failures += 1; process.stderr.write(`FAIL  ${label} :: ${error.message}\n`); }
}

function literalBetween(text, start, end) {
  const from = text.indexOf(start);
  assert(from >= 0, `missing ${start}`);
  const bodyStart = from + start.length;
  const to = text.indexOf(end, bodyStart);
  assert(to >= 0, `missing terminator ${end}`);
  return text.slice(bodyStart, to).trim();
}
function evaluateLiteral(literal) {
  return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
}

const cueTypes = evaluateLiteral(literalBetween(source, 'var CUE_TYPES =', ';\n  // Each family'));
const families = evaluateLiteral(literalBetween(source, 'var TONE_FAMILIES =', ';\n  var CUE_PROFILES'));
const profiles = evaluateLiteral(literalBetween(source, 'var CUE_PROFILES =', ';\n  var HAPTIC_MS'));
const musicProfiles = evaluateLiteral(literalBetween(source, 'var MUSIC_PROFILES =', ';\n\n  function freeze'));
const busTypes = evaluateLiteral(literalBetween(busSource, 'var EVENT_TYPES = Object.freeze(', ');\n  var SPATIAL_TYPES'));

check('adapter and FeedbackBus expose the same semantic cue vocabulary', () => {
  assert.deepStrictEqual(Array.from(cueTypes), Array.from(busTypes));
  assert.strictEqual(new Set(cueTypes).size, cueTypes.length);
});

check('every cue explicitly selects one intentional tone family', () => {
  assert.strictEqual(Object.keys(profiles).length, cueTypes.length);
  cueTypes.forEach(type => {
    assert.strictEqual(typeof profiles[type], 'string', `missing profile for ${type}`);
    assert(Array.isArray(families[profiles[type]]), `unknown family ${profiles[type]} for ${type}`);
  });
});

check('every family has two to four bounded deterministic variants', () => {
  const allowedWaves = new Set(['sine', 'triangle', 'square', 'sawtooth']);
  Object.entries(families).forEach(([name, variants]) => {
    assert(variants.length >= 2 && variants.length <= 4, `${name} has ${variants.length} variants`);
    variants.forEach((tone, index) => {
      assert(Number.isFinite(tone.f) && tone.f >= 30 && tone.f <= 4000, `${name}[${index}] frequency`);
      assert(Number.isFinite(tone.d) && tone.d >= 0.02 && tone.d <= 0.5, `${name}[${index}] duration`);
      assert(Number.isFinite(tone.g) && tone.g > 0 && tone.g <= 0.2, `${name}[${index}] gain`);
      assert(allowedWaves.has(tone.w), `${name}[${index}] waveform`);
      if (tone.f2 !== undefined) assert(Number.isFinite(tone.f2) && tone.f2 >= 30 && tone.f2 <= 4000, `${name}[${index}] glide`);
    });
  });
});

check('legacy generic tone fallback is absent', () => {
  assert(!source.includes('GENERIC_TONES'));
  assert(!/\bTONES\b/.test(source));
  assert(source.includes("TONE_FAMILIES[CUE_PROFILES[type]]"));
});

check('optional BGM has three quiet timer-free presentation beds', () => {
  assert.deepStrictEqual(Object.keys(musicProfiles), ['home', 'game', 'result']);
  Object.entries(musicProfiles).forEach(([track, layers]) => {
    assert.strictEqual(layers.length, 3, `${track} layer count`);
    assert(layers.reduce((sum, layer) => sum + layer.g, 0) <= 0.04, `${track} mix budget`);
    layers.forEach(layer => {
      assert(Number.isFinite(layer.f) && layer.f >= 80 && layer.f <= 500);
      assert(Number.isFinite(layer.g) && layer.g > 0 && layer.g <= 0.02);
      assert(['sine', 'triangle'].includes(layer.w));
    });
  });
  assert(!/setInterval|setTimeout/.test(literalBetween(source, 'var MUSIC_PROFILES =', ';\n\n  function freeze')));
});

function param(value) {
  return {
    value,
    setValueAtTime(next) { this.value = next; },
    exponentialRampToValueAtTime(next) { this.value = next; }
  };
}
function fakeNode() {
  return {
    gain: param(1), frequency: param(0), pan: param(0), type: 'sine',
    connect(target) { return target; }, disconnect() {}, start() {},
    stop() { if (typeof this.onended === 'function') this.onended(); }
  };
}
function fakeContext() {
  return {
    currentTime: 1, state: 'suspended', destination: fakeNode(),
    createGain: fakeNode, createOscillator: fakeNode, createStereoPanner: fakeNode,
    resume() { this.state = 'running'; }, close() { this.state = 'closed'; }
  };
}
function busStub() {
  let listener = null;
  return {
    subscribe(fn) { listener = fn; return () => { listener = null; }; },
    deliver(cue) { if (listener) listener(Object.freeze({ ...cue, channels:Object.freeze({ audio:true, haptic:true }), intensity:cue.intensity ?? 1, pan:cue.pan ?? 0 })); }
  };
}

check('all cue profiles play fail-silent through the narrow adapter seam', () => {
  const bus = busStub();
  const context = fakeContext();
  const adapter = Adapter.create({ enabled:true, bus, audioContextFactory:() => context, vibrate:() => true, now:(() => { let n = 0; return () => ++n * 100; })() });
  assert.strictEqual(adapter.unlock().accepted, true);
  cueTypes.forEach((type, index) => {
    assert.doesNotThrow(() => bus.deliver({ type, id:`profile-${index}`, pan:type.startsWith('tank_') ? 0.25 : 0 }));
  });
  const snapshot = adapter.snapshot();
  assert.strictEqual(snapshot.counters.audioFailures, 0);
  assert(snapshot.counters.audioStarted >= cueTypes.length);
  assert.strictEqual(adapter.dispose().disposed, true);
});

if (failures) {
  process.stderr.write(`AUDIO_TONE_PROFILE_FAILURES=${failures}/${assertions}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`AUDIO_TONE_PROFILES_ALL_PASS assertions=${assertions} cues=${cueTypes.length} families=${Object.keys(families).length} music=${Object.keys(musicProfiles).length}\n`);
}
