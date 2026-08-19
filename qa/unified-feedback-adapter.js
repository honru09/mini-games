'use strict';

/* Isolated contract test for the presentation-only unified audio adapter. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '21-unified-feedback-adapter.js'), 'utf8');
const Adapter = require(path.join(ROOT, 'public', 'src', 'core', '21-unified-feedback-adapter.js'));

function check(name, fn) {
  try { fn(); process.stdout.write(`ok - ${name}\n`); }
  catch (error) { process.stderr.write(`not ok - ${name}: ${error.message}\n`); process.exitCode = 1; }
}

const asyncChecks = [];
function checkAsync(name, fn) {
  asyncChecks.push(Promise.resolve().then(fn).then(
    () => { process.stdout.write(`ok - ${name}\n`); },
    error => { process.stderr.write(`not ok - ${name}: ${error.message}\n`); process.exitCode = 1; }
  ));
}

function fakeParam(value) {
  return { value, setValueAtTime(next) { this.value = next; } };
}
function fakeNode(kind, log) {
  const node = {
    kind,
    gain: fakeParam(1),
    frequency: fakeParam(0),
    pan: fakeParam(0),
    connections: [],
    connect(target) { this.connections.push(target); log.push(`${kind}:connect`); return target; },
    disconnect() { this.connections.length = 0; log.push(`${kind}:disconnect`); },
    start() { log.push(`${kind}:start`); },
    stop(at) {
      log.push(`${kind}:stop`);
      // A future WebAudio stop is only scheduled; it must keep consuming a
      // voice until onended fires.  Immediate stops model reset/dispose.
      if (typeof at !== 'number' && typeof this.onended === 'function') this.onended();
    }
  };
  return node;
}
function fakeContext() {
  const log = [];
  const context = {
    currentTime: 2,
    state: 'suspended',
    destination: fakeNode('destination', log),
    createGain() { return fakeNode('gain', log); },
    createOscillator() { return fakeNode('oscillator', log); },
    createStereoPanner() { return fakeNode('panner', log); },
    resume() { this.state = 'running'; log.push('resume'); },
    close() { this.state = 'closed'; log.push('close'); },
    log
  };
  return context;
}
function busStub() {
  let listener = null;
  return {
    subscribe(fn) { listener = fn; return () => { listener = null; }; },
    emit(cue) { if (listener) listener(Object.assign({ channels: { audio: true, haptic: true }, intensity: 1, pan: 0 }, cue)); }
  };
}

check('CommonJS and browser UMD exports are narrow', () => {
  assert.deepStrictEqual(Object.keys(Adapter), ['create']);
  const context = vm.createContext({ console });
  vm.runInContext(SOURCE, context, { filename: '21-unified-feedback-adapter.js' });
  assert.strictEqual(typeof vm.runInContext('globalThis.UnifiedFeedbackAdapter.create', context), 'function');
});

check('disabled or missing bus does not subscribe or create audio', () => {
  const context = fakeContext();
  const a = Adapter.create({ enabled: false, audioContextFactory: () => context });
  assert.strictEqual(a.snapshot().subscribed, false);
  assert.strictEqual(a.unlock().reason, 'disabled');
  assert.strictEqual(context.log.length, 0);
});

check('unlock creates/resumes context only explicitly and configures gains', () => {
  const bus = busStub(); const context = fakeContext(); let creates = 0;
  const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => { creates += 1; return context; } });
  assert.strictEqual(creates, 0);
  assert.strictEqual(a.unlock().accepted, true);
  assert.strictEqual(creates, 1);
  assert.strictEqual(a.snapshot().unlocked, true);
  assert(context.log.includes('resume'));
  a.setPreferences({ masterVolume: .5, sfxVolume: .25, musicVolume: .2 });
  assert.strictEqual(a.snapshot().sfxVolume, .25);
});

checkAsync('async resume rejection stays locked and can be retried', async () => {
  const bus = busStub(); const context = fakeContext(); let attempts = 0;
  context.resume = function resume() {
    attempts += 1;
    context.log.push('resume');
    if (attempts === 1) return Promise.reject(new Error('gesture lost'));
    context.state = 'running';
    return Promise.resolve();
  };
  const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => context });
  const failed = await a.unlock();
  assert.strictEqual(failed.accepted, false);
  assert.strictEqual(failed.reason, 'resume_failed');
  assert.strictEqual(a.snapshot().unlocked, false);
  assert.strictEqual(a.snapshot().contextReady, true);
  const retried = await a.unlock();
  assert.strictEqual(retried.accepted, true);
  assert.strictEqual(a.snapshot().unlocked, true);
  assert.strictEqual(attempts, 2);
});

check('failed graph construction closes owned context and remains retryable', () => {
  const bus = busStub(); let creates = 0; const contexts = [];
  const a = Adapter.create({
    enabled: true,
    bus,
    audioContextFactory: () => {
      creates += 1;
      const context = {
        currentTime: 0,
        destination: {},
        createGain() { throw new Error('graph unavailable'); },
        closeCalls: 0,
        close() { this.closeCalls += 1; }
      };
      contexts.push(context);
      return context;
    }
  });
  assert.strictEqual(a.unlock().reason, 'audio_unavailable');
  assert.strictEqual(contexts[0].closeCalls, 1);
  assert.strictEqual(a.snapshot().contextReady, false);
  assert.strictEqual(a.unlock().reason, 'audio_unavailable');
  assert.strictEqual(creates, 2);
  assert.strictEqual(contexts[1].closeCalls, 1);
});

check('semantic cues produce bounded voices, deterministic variants and haptics', () => {
  const bus = busStub(); const context = fakeContext(); const haptics = [];
  const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => context, vibrate: ms => haptics.push(ms), now: () => 100 });
  a.unlock();
  assert.strictEqual(a.playMusic('game').accepted, true);
  for (let i = 0; i < 12; i += 1) bus.emit({ type: 'tank_fire', id: `fire-${i}`, pan: i % 2 ? .8 : -.8 });
  const snap = a.snapshot();
  assert.strictEqual(snap.musicLayers, 3);
  assert.strictEqual(snap.sfxVoices, 5);
  assert.strictEqual(snap.activeVoices, 8);
  assert(snap.activeVoices <= snap.maxVoices);
  assert(snap.counters.variants >= 1);
  assert(haptics.length > 0);
  const before = snap.counters.coalesced;
  bus.emit({ type: 'tank_fire', id: 'same', pan: 0 }); bus.emit({ type: 'tank_fire', id: 'same', pan: 0 });
  assert(a.snapshot().counters.coalesced > before);
});

check('zero haptics volume never calls vibrate', () => {
  const bus = busStub(); const context = fakeContext(); const haptics = [];
  const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => context, vibrate: ms => haptics.push(ms) });
  a.unlock();
  assert.strictEqual(a.setPreferences({ hapticsVolume: 0 }).accepted, true);
  bus.emit({ type: 'tank_hit', id: 'zero-haptics', pan: 0 });
  assert.strictEqual(haptics.length, 0);
  assert.strictEqual(a.snapshot().counters.hapticCalls, 0);
});

check('reduced effects suppress only high-frequency non-critical cues', () => {
  const bus = busStub(); const context = fakeContext();
  const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => context });
  a.unlock();
  a.setReducedEffects(true);
  bus.emit({ type: 'ui_confirm', id: 'reduced-confirm' });
  assert.strictEqual(a.snapshot().activeVoices, 0);
  bus.emit({ type: 'ui_error', id: 'reduced-error' });
  bus.emit({ type: 'match_terminal', id: 'reduced-terminal' });
  bus.emit({ type: 'reward_loss', id: 'reduced-result' });
  assert.strictEqual(a.snapshot().activeVoices, 3);
});

check('a false vibration result is counted as a fail-silent haptic failure', () => {
  const bus = busStub(); const context = fakeContext();
  const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => context, vibrate: () => false });
  a.unlock();
  bus.emit({ type: 'tank_hit', id: 'vibrate-denied', pan: 0 });
  assert.strictEqual(a.snapshot().counters.hapticCalls, 0);
  assert.strictEqual(a.snapshot().counters.hapticFailures, 1);
});

check('lifecycle and preference gates suppress output without throwing', () => {
  const bus = busStub(); const context = fakeContext(); const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => context });
  a.unlock(); a.setVisibility(true); bus.emit({ type: 'tank_hit', id: 'hidden' });
  assert.strictEqual(a.snapshot().hidden, true);
  a.setVisibility(false); a.setReducedMotion(true); a.setMuted(true); bus.emit({ type: 'tank_hit', id: 'muted' });
  assert.strictEqual(a.snapshot().muted, true);
  assert.doesNotThrow(() => a.playMusic('menu')); assert.strictEqual(a.playMusic('menu').accepted, false);
});

check('music is no-op safe and dispose closes context and unsubscribes', () => {
  const bus = busStub(); const context = fakeContext(); const a = Adapter.create({ enabled: true, bus, audioContextFactory: () => context });
  assert.strictEqual(a.playMusic('before-unlock').accepted, false);
  a.unlock(); assert.strictEqual(a.playMusic('menu').accepted, true); assert.strictEqual(a.snapshot().musicActive, true);
  a.stopMusic(); assert.strictEqual(a.snapshot().musicActive, false);
  const disposed = a.dispose(); assert.strictEqual(disposed.disposed, true); assert(context.log.includes('close'));
  assert.strictEqual(a.unlock().reason, 'disposed');
  assert.doesNotThrow(() => bus.emit({ type: 'tank_fire', id: 'after-dispose' }));
});

Promise.all(asyncChecks).then(() => {
  if (!process.exitCode) process.stdout.write('UNIFIED_FEEDBACK_ADAPTER_ALL_PASS\n');
});
