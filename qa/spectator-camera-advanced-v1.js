'use strict';

// P2-05 is a presentation-only contract.  It verifies the advanced spectator
// composition without starting a server, mutating a rule, or requiring GSAP.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const cameraSource = read('public/src/core/25-camera-system.js');
const stageSource = read('public/src/core/28-game-stage-2_5d.js');
const shellSource = read('public/src/core/02-app-shell.js');
const { readPresentationSource } = require('./presentation-source');
const template = readPresentationSource();

assert.match(cameraSource, /const SPECTATOR_MODES=Object\.freeze\(\['overview','focus','impact','result'\]\)/);
assert.match(cameraSource, /function spectatorTo\(mode,options\)/);
assert.match(cameraSource, /composition:'spectator-neutral'/);
assert.match(cameraSource, /data.*camera25dSpectator|camera25dSpectator/);
assert.match(stageSource, /function spectatorView\(\)/);
assert.match(stageSource, /CameraSystem25D\.spectatorTo/);
assert.match(stageSource, /focus:spectatorView\(\)\?'spectator:impact'/);
assert.match(stageSource, /focus:'spectator:overview'/);
assert.match(shellSource, /desiredComposition=watching\?'spectator-neutral':'player'/);
assert.match(template, /data-camera25d-composition="spectator-neutral"|data-camera25d-composition="spectator-neutral"/);
assert.match(template, /data-camera25d-composition/);

function node() {
  return { nodeType: 1, dataset: {}, style: {}, isConnected: true };
}

function cameraRuntime(reduced = true) {
  const stage = node();
  const events = [];
  const context = {
    console,
    document: { hidden: false, getElementById(id) { return id === 'screen-game' ? stage : null; } },
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init.detail; },
    dispatchEvent(event) { events.push(event); },
    DepthScene25D: { isEnabled() { return true; } },
    matchMedia() { return { matches: reduced, addEventListener() {}, removeEventListener() {} }; },
  };
  context.globalThis = context;
  vm.runInContext(cameraSource, vm.createContext(context), { filename: '25-camera-system.js' });
  return { context, api: context.CameraSystem25D, stage, events };
}

const runtime = cameraRuntime(true);
assert.strictEqual(JSON.stringify(runtime.api.SPECTATOR_MODES), JSON.stringify(['overview', 'focus', 'impact', 'result']));
const target = node();
for (const mode of runtime.api.SPECTATOR_MODES) {
  const result = runtime.api.spectatorTo(mode, { target, focus: 'shared:' + mode });
  assert.strictEqual(result.status, 'static');
  assert.strictEqual(runtime.api.snapshot().composition, 'spectator-neutral');
  assert.strictEqual(runtime.api.snapshot().mode, mode);
  assert.strictEqual(target.dataset.camera25dComposition, 'spectator-neutral');
  assert.strictEqual(target.dataset.camera25dSpectator, 'true');
  assert.strictEqual(runtime.stage.dataset.camera25dSpectator, 'true');
}
const invalid = runtime.api.spectatorTo('enter', { target });
assert.strictEqual(invalid.status, 'static');
assert.strictEqual(invalid.mode, 'overview');
assert.strictEqual(runtime.api.snapshot().focus, 'spectator:overview');
assert.ok(runtime.events.every(event => event.detail.spectator === true));
runtime.api.compose('player', { mode: 'active', target, focus: 'player:active' });
assert.strictEqual(target.dataset.camera25dSpectator, 'false');
assert.strictEqual(runtime.stage.dataset.camera25dComposition, 'player');
runtime.api.destroy();
assert.strictEqual(runtime.stage.dataset.camera25dComposition, undefined);
assert.strictEqual(target.dataset.camera25dComposition, undefined);

// The shared bridge must select the spectator API for every event while a
// viewer is read-only.  This small runtime avoids DOM animation and uses the
// same semantic events emitted by the six game modules.
function stageRuntime() {
  const timers = new Map();
  let nextTimer = 0;
  const surface = { nodeType: 1, dataset: {}, style: {}, isConnected: true, classList: { add() {}, remove() {} }, appendChild() {} };
  const area = { nodeType: 1, dataset: {}, style: {}, isConnected: true, querySelector() { return surface; } };
  const listeners = new Map();
  const cameraCalls = [];
  const document = {
    hidden: false,
    getElementById(id) { return id === 'board-area' ? area : null; },
    createElement() { return { nodeType: 1, dataset: {}, style: {}, isConnected: true, className: '', setAttribute() {}, appendChild() {}, remove() {} }; },
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener(name, fn) { const set = listeners.get(name); if (set) set.delete(fn); },
  };
  const context = {
    console, document, innerWidth: 1200,
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); },
    matchMedia() { return { matches: true }; },
    online: { isSpectator: true, spectatorRoom: 'ROOM' },
    CameraSystem25D: {
      spectatorTo(mode, options) { cameraCalls.push(['spectatorTo', mode, options]); return { status: 'static', mode }; },
      to(mode, options) { cameraCalls.push(['to', mode, options]); return { status: 'static', mode }; },
    },
    GhostMascot25D: { result() {} },
  };
  context.globalThis = context;
  vm.runInContext(stageSource, vm.createContext(context), { filename: '28-game-stage-2_5d.js' });
  return { api: context.GameStage25D, cameraCalls, timers, document, listeners };
}

const stage = stageRuntime();
assert.strictEqual(stage.api.emit({ type: 'phase', game: 'tank', phase: 'fire', detail: 1 }), true);
assert.strictEqual(stage.cameraCalls[0][0], 'spectatorTo');
assert.strictEqual(stage.cameraCalls[0][1], 'impact');
assert.strictEqual(stage.cameraCalls[0][2].composition, 'spectator-neutral');
assert.strictEqual(stage.cameraCalls[0][2].focus, 'spectator:impact');
for (const callback of [...stage.timers.values()]) callback();
assert.strictEqual(stage.cameraCalls.at(-1)[0], 'spectatorTo');
assert.strictEqual(stage.cameraCalls.at(-1)[1], 'overview');
assert.strictEqual(stage.api.emit({ type: 'result', game: 'tank', outcome: 'win' }), true);
assert.strictEqual(stage.cameraCalls.at(-1)[0], 'spectatorTo');
assert.strictEqual(stage.cameraCalls.at(-1)[1], 'result');
stage.api.destroy();
assert.strictEqual(stage.listeners.get('visibilitychange').size, 0);

console.log('SPECTATOR_CAMERA_ADVANCED_V1_ALL_PASS modes=4 composition=neutral fallback=static');
