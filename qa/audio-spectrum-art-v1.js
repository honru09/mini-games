#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const Module = require(path.join(ROOT, 'public/src/core/30-audio-spectrum-art.js'));
let failures = 0;
let assertions = 0;
const asyncChecks = [];

function check(label, run) {
  assertions += 1;
  try { run(); process.stdout.write(`PASS  ${label}\n`); }
  catch (error) { failures += 1; process.stderr.write(`FAIL  ${label} :: ${error.message}\n`); }
}
function checkAsync(label, run) {
  assertions += 1;
  asyncChecks.push(Promise.resolve().then(run).then(() => {
    process.stdout.write(`PASS  ${label}\n`);
  }, error => {
    failures += 1;
    process.stderr.write(`FAIL  ${label} :: ${error.message}\n`);
  }));
}

function fakeStyle() {
  const values = {};
  return { setProperty(key, value) { values[key] = String(value); }, getPropertyValue(key) { return values[key] || ''; } };
}
function fakeClassList() {
  const values = new Set();
  return { add(value) { values.add(value); }, remove(value) { values.delete(value); }, contains(value) { return values.has(value); } };
}
function fakeHost() {
  const bars = Array.from({ length: 12 }, () => ({ style: fakeStyle() }));
  const status = { textContent: '', attributes: {}, setAttribute(key, value) { this.attributes[key] = String(value); } };
  return {
    bars, status, dataset: {}, classList: fakeClassList(), isConnected: true,
    querySelectorAll(selector) { return selector === '[data-audio-spectrum-bar]' ? bars : []; },
    querySelector(selector) { return selector === '[data-audio-spectrum-status]' ? status : null; }
  };
}

const artSource = read('public/src/core/30-audio-spectrum-art.js');
const runtimeSource = read('public/src/core/22-audio-runtime.js');
const adapterSource = read('public/audio-spectrum-motion-entry.js');
const { readPresentationSource } = require('./presentation-source');
const template = readPresentationSource();
const shell = read('public/src/core/02-app-shell.js');
const assets = read('public/src/core/06-assets.js');
const packageJson = JSON.parse(read('package.json'));

check('P2-08 uses the existing audio requirement pair and no invented product requirement', () => {
  const ledger = JSON.parse(read('art-source/production/ghost-game-art-program-v1/production-ledger-v1.json'));
  const unit = ledger.units.find(item => item.id === 'P2-08');
  assert(unit);
  assert.deepStrictEqual(unit.requirements, ['GAME-037', 'GAME-038', 'TECH-049']);
});

check('code-native family manifest pins exclusive runtime bytes and tracks mutable integration seams', () => {
  const manifest = JSON.parse(read('art-source/platform/audio-spectrum-art-v1/asset-family-manifest-v1.json'));
  assert.strictEqual(manifest.familyId, 'P-AUDIO-SPECTRUM-ART-V1');
  assert.strictEqual(manifest.runtimeRasterBytes, 0);
  manifest.runtimeFiles.forEach(record => {
    const bytes = fs.readFileSync(path.join(ROOT, record.path));
    assert.strictEqual(bytes.length, record.bytes, record.path);
    assert.strictEqual(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), record.sha256, record.path);
  });
  assert.deepStrictEqual(manifest.integrationFiles, [
    'public/src/core/22-audio-runtime.js',
    'public/src/core/02-app-shell.js',
    'public/src/core/06-assets.js',
    'public/index-template.html',
    'scripts/build.js',
    'package.json'
  ]);
  manifest.integrationFiles.forEach(file => assert(fs.statSync(path.join(ROOT, file)).isFile(), file));
});

check('runtime visual envelopes expose only detached categorical audio presentation facts', () => {
  ['cueType', 'intensity', 'pan', 'track', 'unlocked', 'hidden', 'reducedMotion', 'reducedEffects', 'sfxEnabled', 'musicEnabled', 'sfxAudible', 'musicAudible', 'musicActive', 'generation'].forEach(field => assert(runtimeSource.includes(field), field));
  assert(runtimeSource.includes('MAX_VISUAL_LISTENERS = 4'));
  assert(runtimeSource.includes('subscribeVisual'));
  const envelope = runtimeSource.slice(runtimeSource.indexOf('function visualEnvelope'), runtimeSource.indexOf('function publishVisual'));
  ['text', 'message', 'uid', 'room', 'payload', 'token', 'replay', 'reward'].forEach(field => assert(!new RegExp(`\\b${field}\\b`, 'i').test(envelope), field));
});

check('spectrum module stays presentation-only and never inspects real audio or private input', () => {
  ['AudioContext', 'AnalyserNode', 'getUserMedia', 'MediaStream', 'WebSocket', 'fetch(', 'localStorage', 'innerHTML'].forEach(term => assert(!artSource.includes(term), term));
  assert(artSource.includes("import('./audio-spectrum-motion-entry.js')"));
  assert(artSource.includes("envelope.kind === 'cue'"));
  assert(artSource.includes("envelope.sfxAudible === true"));
  assert(artSource.includes('envelope.version !== \'1.0\''));
  assert(artSource.includes("if (destroyed)"));
  assert(artSource.includes("value.dispose()"));
});

check('GSAP adapter is finite, lazy, transform-only and fully disposable', () => {
  assert(adapterSource.includes("from './vendor/gsap/3.15.0/esm/index.js'"));
  assert(adapterSource.includes('scaleY'));
  assert(adapterSource.includes('autoAlpha'));
  assert(adapterSource.includes('repeat: 1'));
  assert(adapterSource.includes('yoyo: true'));
  assert(adapterSource.includes('tween.kill()'));
  assert(adapterSource.includes('context.revert()'));
  ['width:', 'height:', 'top:', 'left:', 'ScrollTrigger', 'repeat: -1'].forEach(term => assert(!adapterSource.includes(term), term));
});

check('Settings owns a 12-bar accessible, responsive and high-contrast visual surface', () => {
  assert(shell.includes("dataset.audioSpectrumArt = 'v1'"));
  assert(shell.includes('for (let index = 0; index < 12; index += 1)'));
  assert(shell.includes("setAttribute('role', 'status')"));
  assert(shell.includes('audioSpectrumMount.destroy()'));
  assert(template.includes('@media(prefers-reduced-motion:reduce)'));
  assert(template.includes('@media(forced-colors:active)'));
  assert(template.includes('.audio-spectrum-motion-active .audio-spectrum-bar{will-change:transform,opacity}'));
});

check('feature flag is owner-cleared default-on and preserves a no-spectrum rollback', () => {
  assert(assets.includes("const AUDIO_SPECTRUM_ART_FLAG = 'mg_art_audio_spectrum_v1'"));
  assert(assets.includes('return ownerClearedDefaultOnFlagEnabled(AUDIO_SPECTRUM_ART_FLAG)'));
  assert(shell.includes("typeof audioSpectrumArtEnabled !== 'function' || audioSpectrumArtEnabled()"));
});

check('all three locales contain the complete spectrum copy family', () => {
  const keys = ['audio_spectrum_title', 'audio_spectrum_note', 'audio_spectrum_silent', 'audio_spectrum_paused', 'audio_spectrum_locked', 'audio_spectrum_music', 'audio_spectrum_live', 'audio_spectrum_ready'];
  ['zh-CN', 'en-US', 'uk-UA'].forEach(locale => {
    const values = JSON.parse(read(`public/locales/${locale}.json`));
    keys.forEach(key => assert.strictEqual(typeof values[key], 'string', `${locale}:${key}`));
  });
});

check('static fallback consumes runtime state and cleanup unsubscribes without loading GSAP', () => {
  let listener = null;
  let unsubscribed = false;
  let loads = 0;
  const runtime = { subscribeVisual(fn) {
    listener = fn;
    fn(Object.freeze({ version:'1.0', kind:'state', cueType:null, intensity:0, pan:0, track:null, unlocked:false, hidden:false, reducedMotion:false, reducedEffects:false, sfxEnabled:true, musicEnabled:false, sfxAudible:true, musicAudible:false, musicActive:false, generation:0 }));
    return () => { unsubscribed = true; listener = null; };
  } };
  const timers = [];
  const root = { t:key => `t:${key}`, setTimeout(fn) { timers.push(fn); return timers.length; }, clearTimeout() {}, matchMedia() { return { matches:true }; } };
  const controller = Module.create({ root, runtime, enabled:true, loadAdapter() { loads += 1; return Promise.resolve(null); } });
  const host = fakeHost();
  const mounted = controller.mount(host);
  assert(mounted);
  assert.strictEqual(host.dataset.audioSpectrumState, 'locked');
  assert.strictEqual(host.status.textContent, 't:audio_spectrum_locked');
  listener(Object.freeze({ version:'1.0', kind:'cue', cueType:'ui_test', intensity:.8, pan:0, track:null, unlocked:true, hidden:false, reducedMotion:true, reducedEffects:false, sfxEnabled:true, musicEnabled:false, sfxAudible:true, musicAudible:false, musicActive:false, generation:1 }));
  assert.strictEqual(host.dataset.audioSpectrumState, 'live');
  assert.strictEqual(loads, 0);
  assert(host.bars.every(bar => Number(bar.style.getPropertyValue('--spectrum-level')) >= .12));
  assert.strictEqual(mounted.destroy(), true);
  assert.strictEqual(unsubscribed, true);
  assert.strictEqual(controller.snapshot().mounted, 0);
});

checkAsync('adapter resolving after destroy is disposed once and never becomes active', async () => {
  let listener = null;
  let resolveLoader;
  let disposeCount = 0;
  const runtime = { subscribeVisual(fn) {
    listener = fn;
    fn(Object.freeze({ version:'1.0', kind:'state', cueType:null, intensity:0, pan:0, track:null, unlocked:true, hidden:false, reducedMotion:false, reducedEffects:false, sfxEnabled:true, musicEnabled:false, sfxAudible:true, musicAudible:false, musicActive:false, generation:0 }));
    return () => { listener = null; };
  } };
  const pending = new Promise(resolve => { resolveLoader = resolve; });
  const root = { t:key => key, setTimeout() { return 1; }, clearTimeout() {}, matchMedia() { return { matches:false }; } };
  const controller = Module.create({ root, runtime, enabled:true, loadAdapter() { return pending; } });
  const host = fakeHost();
  const mounted = controller.mount(host);
  listener(Object.freeze({ version:'1.0', kind:'cue', cueType:'ui_test', intensity:.8, pan:0, track:null, unlocked:true, hidden:false, reducedMotion:false, reducedEffects:false, sfxEnabled:true, musicEnabled:false, sfxAudible:true, musicAudible:false, musicActive:false, generation:1 }));
  await Promise.resolve();
  assert.strictEqual(mounted.destroy(), true);
  resolveLoader({ createAudioSpectrumMotionAdapter() { return { pulse() { throw new Error('stale pulse'); }, settle() {}, dispose() { disposeCount += 1; } }; } });
  await pending;
  await new Promise(resolve => setImmediate(resolve));
  assert.strictEqual(disposeCount, 1);
  assert.strictEqual(mounted.snapshot().adapterLoaded, false);
  assert.strictEqual(controller.snapshot().mounted, 0);
});

check('build and audio test routes include the complete P2-08 graph', () => {
  assert(read('scripts/build.js').includes("'core/30-audio-spectrum-art.js'"));
  assert(packageJson.scripts['test:audio-spectrum'].includes('qa/audio-spectrum-art-v1.js'));
  assert(packageJson.scripts['test:audio'].includes('test:audio-spectrum'));
});

Promise.all(asyncChecks).then(() => {
  if (failures) {
    process.stderr.write(`AUDIO_SPECTRUM_ART_V1_FAILURES=${failures}/${assertions}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`AUDIO_SPECTRUM_ART_V1_ALL_PASS assertions=${assertions}\n`);
  }
});
