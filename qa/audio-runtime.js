#!/usr/bin/env node
'use strict';

/*
 * Browser-lifecycle contract for GhostAudioRuntime.
 *
 * The probe executes the real FeedbackBus, UnifiedFeedbackAdapter and runtime
 * against bounded fake DOM/WebAudio surfaces.  It intentionally does not
 * claim audible quality, a second browser, a physical device or lock-screen
 * evidence.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_SOURCE = fs.readFileSync(
  path.join(ROOT, 'public', 'src', 'core', '22-audio-runtime.js'),
  'utf8'
);
const FeedbackBus = require(path.join(ROOT, 'public', 'src', 'core', '15-feedback-bus.js'));
const UnifiedFeedbackAdapter = require(path.join(
  ROOT,
  'public',
  'src',
  'core',
  '21-unified-feedback-adapter.js'
));

let assertions = 0;
let failures = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    process.stdout.write(`PASS  ${label}\n`);
  } catch (error) {
    failures += 1;
    process.stderr.write(`FAIL  ${label} :: ${error && error.stack || error}\n`);
  }
}

const asyncChecks = [];
function checkAsync(label, run) {
  assertions += 1;
  asyncChecks.push(Promise.resolve().then(run).then(() => {
    process.stdout.write(`PASS  ${label}\n`);
  }, error => {
    failures += 1;
    process.stderr.write(`FAIL  ${label} :: ${error && error.stack || error}\n`);
  }));
}

function createEventTarget(initial) {
  const listeners = new Map();
  const target = Object.assign({}, initial || {});
  target.addEventListener = function addEventListener(type, listener) {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type).add(listener);
  };
  target.removeEventListener = function removeEventListener(type, listener) {
    const bucket = listeners.get(type);
    if (bucket) bucket.delete(listener);
  };
  target.dispatch = function dispatch(type, event) {
    const bucket = listeners.get(type);
    if (!bucket) return 0;
    const current = Array.from(bucket);
    current.forEach(listener => listener.call(target, Object.assign({ type, target }, event || {})));
    return current.length;
  };
  target.listenerCount = function listenerCount(type) {
    const bucket = listeners.get(type);
    return bucket ? bucket.size : 0;
  };
  return target;
}

function createStorage(seed) {
  const values = new Map();
  Object.entries(seed || {}).forEach(([key, value]) => values.set(key, String(value)));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    value(key) { return values.has(key) ? values.get(key) : null; }
  };
}

function createAudioHarness() {
  const trace = {
    nodes: [],
    starts: [],
    stops: [],
    disconnects: [],
    panners: 0,
    resumeCalls: 0,
    closeCalls: 0,
    params: []
  };
  let nodeSequence = 0;

  function param(label, initial) {
    return {
      value: initial,
      setValueAtTime(value, at) {
        this.value = value;
        trace.params.push({ label, value, at });
      }
    };
  }

  function node(kind) {
    const id = `${kind}-${++nodeSequence}`;
    const value = {
      id,
      kind,
      type: 'sine',
      gain: param(`${id}:gain`, 1),
      frequency: param(`${id}:frequency`, 0),
      pan: param(`${id}:pan`, 0),
      connections: [],
      connect(target) { this.connections.push(target); return target; },
      disconnect() { this.connections.length = 0; trace.disconnects.push(id); },
      start() { trace.starts.push({ id, kind, type: this.type }); },
      stop(at) {
        trace.stops.push({ id, kind, type: this.type, at: typeof at === 'number' ? at : null });
        if (typeof this.onended === 'function') {
          const ended = this.onended;
          this.onended = null;
          ended();
        }
      }
    };
    trace.nodes.push(value);
    return value;
  }

  const context = {
    currentTime: 4,
    state: 'suspended',
    destination: node('destination'),
    createGain() { return node('gain'); },
    createOscillator() { return node('oscillator'); },
    createStereoPanner() { trace.panners += 1; return node('panner'); },
    resume() { this.state = 'running'; trace.resumeCalls += 1; },
    close() { this.state = 'closed'; trace.closeCalls += 1; }
  };
  return { context, trace };
}

function countStarts(harness, type) {
  return harness.audio.trace.starts.filter(entry => entry.type === type).length;
}
function countAudioStarts(harness) {
  return harness.audio.trace.starts.length;
}

function createHarness(options) {
  const opts = options || {};
  const storage = createStorage(opts.storage);
  const document = createEventTarget({ hidden: opts.hidden === true });
  const window = createEventTarget();
  const mediaQuery = createEventTarget({ matches: opts.reducedMotion === true });
  const audio = createAudioHarness();
  const vibrations = [];
  let contextFactoryCalls = 0;
  const context = vm.createContext({
    console,
    FeedbackBus,
    UnifiedFeedbackAdapter,
    localStorage: storage,
    document,
    window,
    navigator: { vibrate(duration) { vibrations.push(duration); return true; } },
    matchMedia(query) {
      assert.strictEqual(query, '(prefers-reduced-motion: reduce)');
      return mediaQuery;
    }
  });
  vm.runInContext(RUNTIME_SOURCE, context, { filename: '22-audio-runtime.js' });
  const api = context.GhostAudioRuntime;
  const runtime = api.create({
    audioContextFactory() {
      contextFactoryCalls += 1;
      return audio.context;
    },
    vibrate(duration) { vibrations.push(duration); return true; }
  });
  return {
    api,
    runtime,
    storage,
    document,
    window,
    mediaQuery,
    audio,
    vibrations,
    contextFactoryCalls: () => contextFactoryCalls
  };
}

check('init and semantic emit do not create AudioContext before a user gesture', () => {
  const harness = createHarness();
  const initial = harness.runtime.init();
  assert.strictEqual(initial.initialized, true);
  assert.strictEqual(initial.unlocked, false);
  assert.strictEqual(initial.adapter.contextReady, false);
  assert.strictEqual(harness.contextFactoryCalls(), 0);

  assert.strictEqual(harness.runtime.emit('ui_confirm', { id: 'pre-gesture' }).accepted, true);
  assert.strictEqual(harness.contextFactoryCalls(), 0);
  harness.document.dispatch('pointerdown');
  assert.strictEqual(harness.contextFactoryCalls(), 1);
  assert.strictEqual(harness.runtime.snapshot().unlocked, true);
  assert.strictEqual(harness.audio.trace.resumeCalls, 1);
  harness.document.dispatch('keydown', { key: 'Enter' });
  assert.strictEqual(harness.contextFactoryCalls(), 1);
});

check('localStorage preferences are parsed, validated, persisted and frozen', () => {
  const harness = createHarness({
    storage: {
      mg_audio_sfx: '0',
      mg_audio_music: 'true',
      mg_audio_haptics: 'false',
      mg_audio_spatial: '0',
      mg_audio_reduced_effects: '1',
      mg_audio_sfx_volume: 'NaN',
      mg_audio_music_volume: '2',
      mg_audio_haptics_volume: '-1',
      mg_audio_master_volume: 'Infinity'
    }
  });
  const prefs = harness.runtime.getPreferences();
  assert.strictEqual(Object.isFrozen(prefs), true);
  assert.strictEqual(prefs.mg_audio_sfx, false);
  assert.strictEqual(prefs.mg_audio_music, true);
  assert.strictEqual(prefs.mg_audio_haptics, false);
  assert.strictEqual(prefs.mg_audio_spatial, false);
  assert.strictEqual(prefs.mg_audio_reduced_effects, true);
  assert.strictEqual(prefs.mg_audio_sfx_volume, 0.72);
  assert.strictEqual(prefs.mg_audio_music_volume, 0.22);
  assert.strictEqual(prefs.mg_audio_haptics_volume, 1);
  assert.strictEqual(prefs.mg_audio_master_volume, 1);

  const saved = harness.runtime.setPreferences({
    mg_audio_sfx: true,
    mg_audio_reduced_effects: false,
    mg_audio_sfx_volume: 0.57
  });
  assert.strictEqual(saved.accepted, true);
  assert.strictEqual(Object.isFrozen(saved.settings), true);
  assert.strictEqual(harness.storage.value('mg_audio_sfx'), '1');
  assert.strictEqual(harness.storage.value('mg_audio_reduced_effects'), '0');
  assert.strictEqual(harness.storage.value('mg_audio_sfx_volume'), '0.57');
  assert.strictEqual(harness.runtime.setPreferences({ mg_audio_sfx_volume: 1.1 }).reason, 'invalid_preferences');
  assert.strictEqual(harness.runtime.setPreferences({ mg_audio_sfx: 'yes' }).reason, 'invalid_preferences');

  const reloaded = harness.api.create({ audioContextFactory: () => harness.audio.context });
  assert.strictEqual(reloaded.getPreferences().mg_audio_sfx_volume, 0.57);
  assert.strictEqual(reloaded.getPreferences().mg_audio_sfx, true);
});

check('visibility and page lifecycle stop voices, retain track intent and resume it', () => {
  const harness = createHarness({ storage: { mg_audio_music: '1' } });
  harness.runtime.init();
  assert.strictEqual(harness.runtime.playMusic('game').reason, 'inactive');
  assert.strictEqual(harness.runtime.snapshot().track, 'game');
  harness.document.dispatch('pointerdown');
  assert.strictEqual(countAudioStarts(harness), 3);
  assert.strictEqual(harness.runtime.snapshot().adapter.musicActive, true);
  assert.strictEqual(harness.runtime.snapshot().adapter.musicLayers, 3);

  harness.document.hidden = true;
  harness.document.dispatch('visibilitychange');
  let hidden = harness.runtime.snapshot();
  assert.strictEqual(hidden.track, 'game');
  assert.strictEqual(hidden.adapter.hidden, true);
  assert.strictEqual(hidden.adapter.musicActive, false);

  harness.document.hidden = false;
  harness.document.dispatch('visibilitychange');
  let visible = harness.runtime.snapshot();
  assert.strictEqual(visible.track, 'game');
  assert.strictEqual(visible.adapter.hidden, false);
  assert.strictEqual(visible.adapter.musicActive, true);
  assert.strictEqual(countAudioStarts(harness), 6);

  harness.window.dispatch('pagehide');
  hidden = harness.runtime.snapshot();
  assert.strictEqual(hidden.track, 'game');
  assert.strictEqual(hidden.adapter.musicActive, false);
  harness.window.dispatch('pageshow');
  assert.strictEqual(harness.runtime.snapshot().adapter.musicActive, true);
  assert.strictEqual(countAudioStarts(harness), 9);

  assert.strictEqual(harness.runtime.stopMusic().accepted, true);
  assert.strictEqual(harness.runtime.snapshot().track, null);
  harness.window.dispatch('pagehide');
  harness.window.dispatch('pageshow');
  assert.strictEqual(harness.runtime.snapshot().adapter.musicActive, false);
  assert.strictEqual(countAudioStarts(harness), 9);
});

check('mute switches, volume, spatial and reduced-effects gates reach the adapter', () => {
  const harness = createHarness({
    storage: { mg_audio_sfx: '1', mg_audio_music: '1', mg_audio_haptics: '1', mg_audio_spatial: '1' }
  });
  harness.runtime.init();
  harness.document.dispatch('pointerdown');

  const first = harness.runtime.emit('tank_fire', { id: 'spatial-on-1', pan: 0.75 });
  assert.strictEqual(first.accepted, true);
  assert.strictEqual(countAudioStarts(harness), 1);
  assert.strictEqual(harness.audio.trace.panners, 1);

  const volumes = harness.runtime.setPreferences({
    mg_audio_master_volume: 0.8,
    mg_audio_sfx_volume: 0.44,
    mg_audio_music_volume: 0.18,
    mg_audio_haptics_volume: 0.5
  });
  assert.strictEqual(volumes.accepted, true);
  let adapter = harness.runtime.snapshot().adapter;
  assert.strictEqual(adapter.masterVolume, 0.8);
  assert.strictEqual(adapter.sfxVolume, 0.44);
  assert.strictEqual(adapter.musicVolume, 0.18);
  assert.strictEqual(adapter.hapticsVolume, 0.5);

  harness.runtime.setPreferences({ mg_audio_sfx: false, mg_audio_music: false });
  const beforeMutedStarts = countAudioStarts(harness);
  assert.strictEqual(harness.runtime.emit('tank_fire', { id: 'muted-1', pan: -0.5 }).accepted, true);
  assert.strictEqual(countAudioStarts(harness), beforeMutedStarts);
  adapter = harness.runtime.snapshot().adapter;
  assert.strictEqual(adapter.audioEnabled, false);
  assert.strictEqual(adapter.sfxEnabled, false);
  assert.strictEqual(adapter.musicEnabled, false);

  harness.runtime.setPreferences({ mg_audio_sfx: true, mg_audio_music: true, mg_audio_spatial: false });
  const pannersBeforeCentered = harness.audio.trace.panners;
  assert.strictEqual(harness.runtime.emit('tank_fire', { id: 'spatial-off-1', pan: 0.9 }).accepted, true);
  assert.strictEqual(harness.audio.trace.panners, pannersBeforeCentered);
  assert.strictEqual(harness.runtime.snapshot().adapter.spatialEnabled, false);

  harness.runtime.setPreferences({ mg_audio_spatial: true });
  assert.strictEqual(harness.runtime.emit('tank_fire', { id: 'spatial-on-2', pan: -0.9 }).accepted, true);
  assert.strictEqual(harness.audio.trace.panners, pannersBeforeCentered + 1);
  assert.strictEqual(harness.runtime.snapshot().adapter.spatialEnabled, true);

  const startsBeforeReduced = countAudioStarts(harness);
  harness.runtime.setPreferences({ mg_audio_reduced_effects: true });
  const reduced = harness.runtime.emit('ui_confirm', { id: 'reduced-1' });
  assert.strictEqual(reduced.accepted, true);
  assert.strictEqual(countAudioStarts(harness), startsBeforeReduced);
  assert.strictEqual(harness.runtime.snapshot().adapter.reducedEffects, true);

  assert.strictEqual(harness.runtime.emit('ui_error', { id: 'reduced-error' }).accepted, true);
  assert.strictEqual(harness.runtime.emit('match_terminal', { id: 'reduced-terminal' }).accepted, true);
  assert.strictEqual(harness.runtime.emit('reward_loss', { id: 'reduced-result' }).accepted, true);
  assert.strictEqual(countAudioStarts(harness), startsBeforeReduced + 3);
});

check('zero haptics volume suppresses vibration while retaining audio', () => {
  const harness = createHarness({ storage: { mg_audio_haptics: '1', mg_audio_haptics_volume: '0' } });
  harness.runtime.init();
  harness.document.dispatch('pointerdown');
  const starts = countAudioStarts(harness);
  assert.strictEqual(harness.runtime.emit('tank_hit', { id: 'zero-haptics-runtime', pan: 0 }).accepted, true);
  assert.strictEqual(harness.vibrations.length, 0);
  assert.strictEqual(countAudioStarts(harness), starts + 1);
});

checkAsync('async resume rejection leaves runtime locked and retryable', async () => {
  const harness = createHarness();
  let attempts = 0;
  harness.audio.context.resume = function resume() {
    attempts += 1;
    harness.audio.trace.resumeCalls += 1;
    if (attempts === 1) return Promise.reject(new Error('resume denied'));
    harness.audio.context.state = 'running';
    return Promise.resolve();
  };
  harness.runtime.init();
  const failed = await harness.runtime.unlock();
  assert.strictEqual(failed.accepted, false);
  assert.strictEqual(failed.reason, 'resume_failed');
  assert.strictEqual(harness.runtime.snapshot().unlocked, false);
  assert.strictEqual(harness.runtime.snapshot().adapter.unlocked, false);
  const retried = await harness.runtime.unlock();
  assert.strictEqual(retried.accepted, true);
  assert.strictEqual(harness.runtime.snapshot().unlocked, true);
  assert.strictEqual(attempts, 2);
});

check('reset clears active audio and dedupe while preserving lifecycle retryability', () => {
  const harness = createHarness({ storage: { mg_audio_music: '1' } });
  harness.runtime.init();
  harness.document.dispatch('pointerdown');
  harness.runtime.playMusic('game');
  const first = harness.runtime.emit('tank_fire', { id: 'reset-replay', pan: 0 });
  assert.strictEqual(first.accepted, true);
  assert.strictEqual(harness.runtime.emit('tank_fire', { id: 'reset-replay', pan: 0 }).reason, 'duplicate');
  assert.strictEqual(harness.runtime.snapshot().adapter.activeVoices, 3);
  const pointerListeners = harness.document.listenerCount('pointerdown');

  const reset = harness.runtime.reset();
  assert.strictEqual(reset.accepted, true);
  assert.strictEqual(harness.runtime.snapshot().track, null);
  assert.strictEqual(harness.runtime.snapshot().adapter.activeVoices, 0);
  assert.strictEqual(harness.runtime.snapshot().adapter.musicActive, false);
  assert.strictEqual(harness.runtime.snapshot().unlocked, true);
  assert.strictEqual(harness.document.listenerCount('pointerdown'), pointerListeners);
  assert.strictEqual(harness.runtime.emit('tank_fire', { id: 'reset-replay', pan: 0 }).accepted, true);
});

check('reduced-motion media changes suppress haptics without suppressing audio', () => {
  const harness = createHarness();
  harness.runtime.init();
  harness.document.dispatch('pointerdown');
  assert.strictEqual(harness.runtime.emit('tank_hit', { id: 'motion-normal', pan: 0 }).accepted, true);
  const vibrationCount = harness.vibrations.length;
  const startCount = countAudioStarts(harness);
  assert(vibrationCount > 0);

  harness.mediaQuery.matches = true;
  harness.mediaQuery.dispatch('change');
  assert.strictEqual(harness.runtime.snapshot().adapter.reducedMotion, true);
  assert.strictEqual(harness.runtime.emit('tank_hit', { id: 'motion-reduced', pan: 0 }).accepted, true);
  assert.strictEqual(harness.vibrations.length, vibrationCount);
  assert.strictEqual(countAudioStarts(harness), startCount + 1);
});

check('test tone performs explicit unlock and emits a fresh audible cue', () => {
  const harness = createHarness();
  harness.runtime.init();
  assert.strictEqual(harness.contextFactoryCalls(), 0);
  const first = harness.runtime.testTone();
  assert.strictEqual(first.accepted, true);
  assert.strictEqual(harness.contextFactoryCalls(), 1);
  assert.strictEqual(countAudioStarts(harness), 1);
  const second = harness.runtime.testTone();
  assert.strictEqual(second.accepted, true);
  assert.strictEqual(harness.contextFactoryCalls(), 1);
  assert.strictEqual(countAudioStarts(harness), 2);
});

check('dispose removes lifecycle listeners, stops audio and closes owned context', () => {
  const harness = createHarness({ storage: { mg_audio_music: '1' } });
  harness.runtime.init();
  harness.runtime.playMusic('result');
  harness.document.dispatch('pointerdown');
  assert.strictEqual(harness.document.listenerCount('pointerdown'), 1);
  assert.strictEqual(harness.document.listenerCount('visibilitychange'), 1);
  assert.strictEqual(harness.window.listenerCount('pagehide'), 1);
  assert.strictEqual(harness.mediaQuery.listenerCount('change'), 1);
  assert.strictEqual(harness.runtime.snapshot().adapter.musicActive, true);

  const disposed = harness.runtime.dispose();
  assert.strictEqual(disposed.initialized, false);
  assert.strictEqual(disposed.unlocked, false);
  assert.strictEqual(disposed.track, null);
  assert.strictEqual(disposed.adapter, null);
  assert.strictEqual(harness.audio.trace.closeCalls, 1);
  assert.strictEqual(harness.document.listenerCount('pointerdown'), 0);
  assert.strictEqual(harness.document.listenerCount('touchstart'), 0);
  assert.strictEqual(harness.document.listenerCount('keydown'), 0);
  assert.strictEqual(harness.document.listenerCount('visibilitychange'), 0);
  assert.strictEqual(harness.window.listenerCount('pagehide'), 0);
  assert.strictEqual(harness.window.listenerCount('pageshow'), 0);
  assert.strictEqual(harness.mediaQuery.listenerCount('change'), 0);
  harness.document.dispatch('pointerdown');
  assert.strictEqual(harness.contextFactoryCalls(), 1);
});

Promise.all(asyncChecks).then(() => {
  if (failures) {
    process.stderr.write(`AUDIO_RUNTIME_FAILURES=${failures}/${assertions}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`AUDIO_RUNTIME_ALL_PASS assertions=${assertions}\n`);
  }
});
