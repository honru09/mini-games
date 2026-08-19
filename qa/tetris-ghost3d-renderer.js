'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'tetris-entry.js');
const ENTRY_SOURCE = fs.readFileSync(ENTRY, 'utf8');
const CAMERA_RIG_SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', '00-tabletop-camera-rig.js'), 'utf8');
const TetrisRules = require(path.join(ROOT, 'shared', 'rules', 'tetris.js'));
let assertions = 0;

function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function expectCode(action, code, message) {
  assertions += 1;
  assert.throws(action, error => error && error.code === code, message);
}

class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }
  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type);
    if (handlers) handlers.delete(handler);
  }
  dispatch(type, event) { (this.listeners.get(type) || new Set()).forEach(handler => handler(event || {})); }
  listenerCount(type) { return type ? (this.listeners.get(type) || new Set()).size : Array.from(this.listeners.values()).reduce((n, handlers) => n + handlers.size, 0); }
}

class FakeElement extends FakeEventTarget {
  constructor(width = 420, height = 600) {
    super();
    this.children = [];
    this.parentNode = null;
    this.clientWidth = width;
    this.clientHeight = height;
    this.style = {};
    this.attributes = new Map();
    this.tabIndex = 0;
  }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}

class FakeCanvas extends FakeElement {}

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  clone() { return new FakeVector3(this.x, this.y, this.z); }
}

class FakeObject3D {
  constructor() {
    this.children = [];
    this.parent = null;
    this.position = new FakeVector3();
    this.rotation = new FakeVector3();
    this.scale = new FakeVector3(1, 1, 1);
    this.matrix = {};
    this.visible = true;
  }
  add(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
  remove(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parent = null; }
  updateMatrix() { this.matrix = { x: this.position.x, y: this.position.y, z: this.position.z, sx: this.scale.x, sy: this.scale.y, sz: this.scale.z }; }
  traverse(visitor) { visitor(this); this.children.forEach(child => child.traverse ? child.traverse(visitor) : visitor(child)); }
}

class FakeScene extends FakeObject3D { clear() { this.children.length = 0; this.cleared = true; } }
class FakeCamera extends FakeObject3D {
  constructor() { super(); this.aspect = 1; }
  updateProjectionMatrix() { this.projectionUpdates = (this.projectionUpdates || 0) + 1; }
  lookAt(target) { this.lookTarget = target && target.clone ? target.clone() : target; }
}
class FakeGeometry { constructor(...args) { this.args = args; } dispose() { this.disposed = (this.disposed || 0) + 1; } }
class FakeColor { constructor(value) { this.value = value; } setHex(value) { this.value = value; } }
class FakeMaterial {
  constructor(options) { this.options = options || {}; this.opacity = this.options.opacity === undefined ? 1 : this.options.opacity; this.color = new FakeColor(this.options.color); }
  dispose() { this.disposed = (this.disposed || 0) + 1; }
}
class FakeMesh extends FakeObject3D { constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; this.isMesh = true; } }
class FakeInstancedMesh extends FakeMesh {
  constructor(geometry, material, capacity) { super(geometry, material); this.capacity = capacity; this.count = capacity; this.instanceMatrix = { needsUpdate: false }; this.matrices = []; }
  setMatrixAt(index, matrix) { this.matrices[index] = { ...matrix }; }
}
class FakeHemisphereLight extends FakeObject3D {}
class FakeDirectionalLight extends FakeObject3D { constructor() { super(); this.target = new FakeObject3D(); this.shadow = { mapSize: { set: (x, y) => { this.shadowSize = [x, y]; } } }; } }
class FakeResizeObserver {
  constructor(callback) { this.callback = callback; FakeResizeObserver.instances.push(this); }
  observe(element) { this.element = element; }
  disconnect() { this.disconnected = true; }
}
FakeResizeObserver.instances = [];

function makeGsap(state) {
  return {
    context(callback, scope) {
      callback();
      const context = { scope, add(fn) { fn(); }, revert() { state.contextReverts += 1; } };
      state.contexts.push(context);
      return context;
    },
    timeline(config) {
      const timeline = {
        config: config || {}, children: [], labels: [], played: 0, killed: 0,
        addLabel(label, position) { this.labels.push([label, position]); return this; },
        to(target, vars, position) { this.children.push({ target, vars, position }); return this; },
        play() { this.played += 1; return this; },
        kill() { this.killed += 1; return this; },
        complete() {
          this.children.forEach(child => {
            Object.keys(child.vars).forEach(key => {
              if (['duration', 'ease', 'overwrite', 'onUpdate', 'onComplete'].includes(key)) return;
              if (typeof child.vars[key] === 'number') child.target[key] = child.vars[key];
            });
            if (typeof child.vars.onUpdate === 'function') child.vars.onUpdate();
          });
          if (typeof this.config.onComplete === 'function') this.config.onComplete();
        }
      };
      state.timelines.push(timeline);
      return timeline;
    },
    killTweensOf(target) { state.killedTargets.push(target); }
  };
}

function makeHarness(supported, options) {
  options = options || {};
  const state = { renderers: [], timelines: [], killedTargets: [], contexts: [], contextReverts: 0, microtasks: [], animationFrames: [], cancelledFrames: [], cameraPlans: [], throwRender: options.throwRender === true };
  state.flushMicrotasks = () => { while (state.microtasks.length) state.microtasks.shift()(); };
  state.flushAnimationFrames = () => {
    const frames = state.animationFrames.splice(0);
    frames.forEach(frame => frame.callback());
  };
  class FakeWebGLRenderer {
    constructor(rendererOptions) {
      this.options = rendererOptions;
      this.domElement = new FakeCanvas();
      this.shadowMap = {};
      this.renderLists = { dispose: () => { this.renderListsDisposed = (this.renderListsDisposed || 0) + 1; } };
      state.renderers.push(this);
    }
    setPixelRatio(value) { this.pixelRatio = value; }
    setSize(width, height, updateStyle) { this.size = [width, height, updateStyle]; }
    setAnimationLoop(callback) { this.loop = callback; }
    render(scene, camera) {
      if (state.throwRender) throw new Error('forced_render_failure');
      this.renderCount = (this.renderCount || 0) + 1;
      this.lastScene = scene;
      this.lastCamera = camera;
    }
    dispose() { this.disposed = (this.disposed || 0) + 1; }
  }
  const fakeThree = {
    ColorManagement: { enabled: false }, SRGBColorSpace: 'srgb', NoToneMapping: 'no-tone-mapping', PCFShadowMap: 'pcf-shadow-map',
    WebGLRenderer: FakeWebGLRenderer, Scene: FakeScene, PerspectiveCamera: FakeCamera, Vector3: FakeVector3, Object3D: FakeObject3D,
    BoxGeometry: FakeGeometry, MeshStandardMaterial: FakeMaterial, MeshBasicMaterial: FakeMaterial, Mesh: FakeMesh,
    InstancedMesh: FakeInstancedMesh, HemisphereLight: FakeHemisphereLight, DirectionalLight: FakeDirectionalLight, Color: FakeColor
  };
  const fakeWindow = new FakeEventTarget();
  fakeWindow.devicePixelRatio = 3;
  const rigSandbox = { globalThis: {} };
  vm.createContext(rigSandbox);
  vm.runInContext(CAMERA_RIG_SOURCE, rigSandbox, { filename: '00-tabletop-camera-rig.js' });
  const sharedRig = rigSandbox.globalThis.TabletopCameraRig;
  fakeWindow.TabletopCameraRig = {
    ...sharedRig,
    plan(gameId, mode, target, planOptions) {
      state.cameraPlans.push({ gameId, mode, target, options: planOptions });
      return sharedRig.plan(gameId, mode, target, planOptions);
    }
  };
  if (!options.noAnimationFrame) {
    let nextFrame = 0;
    fakeWindow.requestAnimationFrame = callback => {
      const id = ++nextFrame;
      state.animationFrames.push({ id, callback });
      return id;
    };
    fakeWindow.cancelAnimationFrame = id => {
      state.cancelledFrames.push(id);
      const index = state.animationFrames.findIndex(frame => frame.id === id);
      if (index >= 0) state.animationFrames.splice(index, 1);
    };
  }
  const module = { exports: {} };
  const transformed = ENTRY_SOURCE
    .replace("import * as THREE from '../vendor/three/r185/build/three.module.js';", 'const THREE = __THREE__;')
    .replace("import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';", 'const WebGL = __WEBGL__;')
    .replace("import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';", 'const gsap = __GSAP__;')
    .replace('export const TETRIS_3D_QUALITY', 'const TETRIS_3D_QUALITY')
    .replace('export function isTetris3DSupported', 'function isTetris3DSupported')
    .replace('export function createTetris3DAdapter', 'function createTetris3DAdapter')
    .concat('\nmodule.exports = { TETRIS_3D_QUALITY, isTetris3DSupported, createTetris3DAdapter };\n');
  vm.runInNewContext(transformed, {
    module, exports: module.exports, __THREE__: fakeThree, __WEBGL__: { isWebGL2Available: () => supported }, __GSAP__: makeGsap(state),
    window: fakeWindow, ResizeObserver: FakeResizeObserver, queueMicrotask(callback) { state.microtasks.push(callback); }, console
  }, { filename: ENTRY });
  return { api: module.exports, state, fakeThree };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(key => deepFreeze(value[key]));
  return Object.freeze(value);
}

function well(cells) {
  const result = Array.from({ length: 18 }, () => Array(10).fill(0));
  (cells || [[17, 4], [17, 5], [16, 4]]).forEach(([row, col]) => { result[row][col] = 1; });
  return result;
}

function buildFrame(revision, options) {
  const settings = options || {};
  return {
    kind: 'tetris-3d-frame-v1',
    revision,
    origin: settings.origin || { source: 'local' },
    viewPlayer: settings.viewPlayer === undefined ? 0 : settings.viewPlayer,
    playerCount: settings.playerCount === undefined ? 2 : settings.playerCount,
    well: settings.well || well(),
    active: settings.active === undefined ? { kind: 0, rotation: 0, x: 3, y: 0 } : settings.active,
    alive: settings.alive === undefined ? true : settings.alive,
    placementSeq: settings.placementSeq === undefined ? revision : settings.placementSeq,
    terminal: settings.terminal === true,
    winner: settings.winner === undefined ? -1 : settings.winner
  };
}

function frame(revision, options) { return deepFreeze(buildFrame(revision, options)); }
function lockEvent(revision, options) {
  const settings = options || {};
  return deepFreeze({
    type: 'piece_locked', revision, eventId: settings.eventId || ('g:' + revision + ':0:' + (settings.placementSeq || revision)),
    player: settings.player === undefined ? 0 : settings.player, kind: settings.kind === undefined ? 0 : settings.kind,
    rotation: settings.rotation === undefined ? 0 : settings.rotation, x: settings.x === undefined ? 3 : settings.x,
    y: settings.y === undefined ? 14 : settings.y, cleared: settings.cleared === undefined ? 0 : settings.cleared
  });
}
function terminalEvent(revision, options) {
  const settings = options || {};
  const winner = settings.winner === undefined ? 0 : settings.winner;
  return deepFreeze({
    type: 'terminal', revision, winner, outcome: winner >= 0 ? 'win' : 'draw',
    eventId: settings.eventId || ('g:' + revision + ':terminal')
  });
}

function optionsFor(mount, callbacks, quality) {
  return { mountElement: mount, onReady: callbacks.onReady, onError: callbacks.onError, onContextLost: callbacks.onContextLost, quality: quality || 'HIGH' };
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {}));
  adapter.mount({ quality: 'LOW', reducedMotion: true });
  const originX = 3;
  const originY = 4;
  for (let kind = 0; kind < 7; kind += 1) {
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const revision = kind * 4 + rotation + 1;
      check(adapter.render(frame(revision, { active: { kind, rotation, x: originX, y: originY } })) === true,
        'renderer accepts exact Rule Core shape ' + kind + ' rotation ' + rotation);
      const pools = [];
      harness.state.renderers[0].lastScene.traverse(node => { if (node instanceof FakeInstancedMesh && node.capacity === 4) pools.push(node); });
      const actual = pools[0].matrices.slice(0, pools[0].count)
        .map(matrix => [matrix.x, matrix.y])
        .sort((left, right) => left[0] - right[0] || left[1] - right[1]);
      const expected = [];
      const shape = TetrisRules.shapeAt(kind, rotation);
      shape.forEach((row, rowIndex) => row.forEach((cell, colIndex) => {
        if (cell) expected.push([(originX + colIndex - 4.5), (8.5 - (originY + rowIndex))]);
      }));
      expected.sort((left, right) => left[0] - right[0] || left[1] - right[1]);
      check(JSON.stringify(actual) === JSON.stringify(expected),
        'active pool is Rule Core equivalent for all 7x4 shapes, including unpadded rotations (' + kind + ':' + rotation + ')');
    }
  }
  adapter.dispose();
}

{
  const harness = makeHarness(false);
  check(harness.api.isTetris3DSupported() === false, 'support predicate safely reports unavailable WebGL2');
  expectCode(() => harness.api.createTetris3DAdapter({ mountElement: new FakeElement() }), 'TETRIS3D_WEBGL2_UNAVAILABLE', 'factory rejects unsupported platform before mount');
}

{
  const harness = makeHarness(true);
  expectCode(() => harness.api.createTetris3DAdapter(null), 'TETRIS3D_INVALID_OPTIONS', 'factory rejects missing options');
  expectCode(() => harness.api.createTetris3DAdapter({}), 'TETRIS3D_INVALID_MOUNT_ELEMENT', 'factory requires a DOM-like mount');
  expectCode(() => harness.api.createTetris3DAdapter({ mountElement: new FakeElement(), quality: 'cinematic' }), 'TETRIS3D_INVALID_QUALITY', 'factory only accepts bounded quality values');
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const errors = [];
  const losses = [];
  let readyCalls = 0;
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {
    onReady() { readyCalls += 1; }, onError(error) { errors.push(error); }, onContextLost(reason) { losses.push(reason); }
  }));
  check(adapter.mount({ quality: 'HIGH', reducedMotion: false }) === true, 'procedural observed well mounts');
  const renderer = harness.state.renderers[0];
  const canvas = renderer.domElement;
  check(readyCalls === 0 && !renderer.renderCount && canvas.style.pointerEvents === 'none', 'mount preserves the DOM well and waits for a semantic frame');
  check(canvas.getAttribute('aria-hidden') === 'true' && canvas.getAttribute('role') === 'presentation' && canvas.tabIndex === -1 && canvas.listenerCount() === 1,
    'canvas is hidden, read-only, and only observes WebGL context loss');
  check(harness.fakeThree.ColorManagement.enabled === true && renderer.outputColorSpace === 'srgb' && renderer.toneMapping === 'no-tone-mapping', 'renderer sets explicit colour output');
  check(renderer.pixelRatio === 2 && renderer.shadowMap.enabled === true, 'HIGH caps DPR and uses its single shadow path');

  const initial = frame(1);
  check(adapter.render(initial) === true, 'deeply frozen 18x10 projection renders');
  check(readyCalls === 1 && renderer.renderCount > 0 && harness.state.timelines.length === 1, 'first real draw announces ready and starts one finite camera entrance');
  const entrance = harness.state.timelines.at(-1);
  check(entrance.labels.map(item => item[0]).join(',') === 'entrance,overview' && entrance.children.length === 2 &&
    harness.state.cameraPlans.slice(0, 2).map(item => item.gameId + ':' + item.mode).join(',') === 'tetris:entrance,tetris:overview',
    'entry camera uses the shared Tetris rig and returns to overview');
  check(typeof renderer.loop === 'function', 'camera entrance renders only while its finite timeline is active');
  entrance.complete();
  check(renderer.loop === null, 'camera entrance settles without a persistent render loop');
  const pools = [];
  renderer.lastScene.traverse(node => { if (node instanceof FakeInstancedMesh) pools.push(node); });
  check(pools.length === 2 && pools.some(pool => pool.capacity === 180) && pools.some(pool => pool.capacity === 4), 'renderer owns bounded 180 locked plus four active block pools');
  check(pools.find(pool => pool.capacity === 180).count === 3 && pools.find(pool => pool.capacity === 4).count === 4, 'one current well synchronizes lock and active pools without extra meshes');
  check(adapter.render(initial) === true && harness.state.timelines.length === 1, 'identical Foundation repaint is idempotent and does not replay entrance');

  const mutable = buildFrame(2);
  check(adapter.render(mutable) === false, 'renderer only accepts deeply frozen presentation frames');
  const badWell = buildFrame(2); badWell.well.pop();
  check(adapter.render(deepFreeze(badWell)) === false, 'renderer fails closed on non-18-row well');
  const badCell = buildFrame(2); badCell.well[0][0] = 2;
  check(adapter.render(deepFreeze(badCell)) === false, 'renderer accepts only binary observed cells');
  const badOnline = buildFrame(2, { origin: { source: 'live' } });
  check(adapter.render(deepFreeze(badOnline)) === false, 'online renderer projection requires trusted authority guards');
  const guardedLocal = buildFrame(2, { origin: { source: 'local', matchId: 'not-authority', authorityRevision: 2, stateHash: 'not-authority' } });
  check(adapter.render(deepFreeze(guardedLocal)) === false, 'local projection rejects authority-only guards rather than silently relabeling state');
  const sameRevisionConflict = buildFrame(1, { alive: false });
  check(adapter.render(deepFreeze(sameRevisionConflict)) === false, 'same revision cannot replace its public projection');

  const liveBaseline = frame(2, { origin: { source: 'live', matchId: 'match-1', authorityRevision: 1, stateHash: 'hash-1' }, placementSeq: 1 });
  check(adapter.render(liveBaseline) === true && adapter.motion(lockEvent(2)) === false, 'first live reconciliation remains static without a consecutive live predecessor');
  const live = frame(3, { origin: { source: 'live', matchId: 'match-1', authorityRevision: 2, stateHash: 'hash-2' }, placementSeq: 2 });
  check(adapter.render(live) === true, 'accepted current-match live frame updates the observed well');
  check(adapter.motion(lockEvent(2)) === false, 'stale motion cannot animate newer state');
  check(adapter.motion(deepFreeze({ ...lockEvent(3), type: 'token_moved' })) === false, 'unregistered renderer semantic motion is rejected');
  check(adapter.motion(lockEvent(3, { player: 1 })) === false, 'renderer only moves the observed player');
  const liveLock = lockEvent(3);
  check(adapter.motion(liveLock) === true && adapter.motion(liveLock) === false, 'current lock event is one-shot and deduplicated');
  const highMotion = harness.state.timelines.at(-1);
  check(highMotion.labels.map(item => item[0]).join(',') === 'follow,impact,overview,settled', 'HIGH uses one finite action-follow impact overview timeline');
  check(highMotion.children.length <= 10 && highMotion.children.every(child => child.vars.duration > 0 && child.vars.duration <= 0.24),
    'HIGH lock motion stays within ten transform/opacity camera-and-marker tweens');
  check(harness.state.cameraPlans.slice(-3).map(item => item.mode).join(',') === 'action-follow,impact,overview',
    'piece_locked maps to the shared action-follow, impact, and overview camera vocabulary');
  check(typeof renderer.loop === 'function', 'on-demand renderer enters an animation loop only for finite semantic motion');
  highMotion.complete();
  check(renderer.loop === null, 'loop stops after semantic motion settles');

  check(adapter.setQuality('BALANCED') === true && renderer.pixelRatio === 1.5 && renderer.shadowMap.enabled === false, 'BALANCED reduces DPR and drops shadows');
  const balanced = frame(4, { origin: { source: 'live', matchId: 'match-1', authorityRevision: 3, stateHash: 'hash-3' }, placementSeq: 3 });
  check(adapter.render(balanced) === true && adapter.motion(lockEvent(4)) === true, 'BALANCED accepts the verified lock');
  const balancedMotion = harness.state.timelines.at(-1);
  check(balancedMotion.labels.map(item => item[0]).join(',') === 'follow,impact,overview,settled', 'BALANCED retains the readable shared camera grammar at scaled duration');
  check(balancedMotion.children.length <= 10 && balancedMotion.children.every(child => child.vars.duration > 0 && child.vars.duration <= 0.18),
    'BALANCED lock motion stays within the bounded transform/opacity sequence');
  balancedMotion.complete();

  const beforeLow = harness.state.timelines.length;
  check(adapter.setQuality('LOW') === true && renderer.pixelRatio === 1, 'LOW uses DPR one');
  const low = frame(5, { origin: { source: 'live', matchId: 'match-1', authorityRevision: 4, stateHash: 'hash-4' }, placementSeq: 4 });
  check(adapter.render(low) === true && adapter.motion(lockEvent(5)) === true && harness.state.timelines.length === beforeLow && renderer.loop === null,
    'LOW resolves the final lock state without timeline or loop');

  check(adapter.setQuality('HIGH') === true && adapter.environment({ reducedMotion: true }) === true, 'reduced-motion environment updates');
  const beforeReduced = harness.state.timelines.length;
  const reduced = frame(6, { origin: { source: 'live', matchId: 'match-1', authorityRevision: 5, stateHash: 'hash-5' }, placementSeq: 5 });
  check(adapter.render(reduced) === true && adapter.motion(lockEvent(6)) === true && harness.state.timelines.length === beforeReduced,
    'reduced motion paints the equivalent final state without slow animation');
  check(adapter.environment({ reducedMotion: false }) === true, 'normal motion can be restored');

  const suspended = frame(7, { origin: { source: 'live', matchId: 'match-1', authorityRevision: 6, stateHash: 'hash-6' }, placementSeq: 6 });
  check(adapter.render(suspended) === true && adapter.motion(lockEvent(7)) === true, 'normal motion starts before suspension');
  const suspendedMotion = harness.state.timelines.at(-1);
  check(adapter.suspend() === true && suspendedMotion.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none', 'suspend kills work and leaves DOM input untouched');
  check(adapter.resume() === true && renderer.loop === null && canvas.style.pointerEvents === 'none', 'resume statically reconciles latest state');

  const observer = FakeResizeObserver.instances.at(-1);
  mount.clientWidth = 390; mount.clientHeight = 480;
  observer.callback(); observer.callback();
  check(harness.state.animationFrames.length === 1, 'resize observer coalesces duplicate geometry work into one animation frame');
  harness.state.flushAnimationFrames();
  check(renderer.size[0] === 390 && renderer.size[1] === 480 && renderer.lastCamera.projectionUpdates >= 1, 'resize recomputes canvas geometry from its one slot');

  const lossFrame = frame(8, { origin: { source: 'live', matchId: 'match-1', authorityRevision: 7, stateHash: 'hash-7' }, placementSeq: 7 });
  check(adapter.render(lossFrame) === true && adapter.motion(lockEvent(8)) === true, 'semantic motion can start before context loss');
  const lossMotion = harness.state.timelines.at(-1);
  let prevented = false;
  canvas.dispatch('webglcontextlost', { preventDefault() { prevented = true; } });
  check(prevented && losses.length === 1 && losses[0] === 'webglcontextlost', 'context loss prevents default and informs fresh recovery owner');
  check(lossMotion.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none', 'context loss clears finite work and preserves DOM ownership');
  check(adapter.render(frame(9)) === false && adapter.contextLost() === true && losses.length === 1, 'lost adapter never resumes and explicit notification is idempotent');
  check(adapter.dispose() === true && adapter.dispose() === true, 'dispose is idempotent');
  check(renderer.disposed === 1 && renderer.renderListsDisposed === 1 && mount.children.length === 0 && FakeResizeObserver.instances.some(item => item.disconnected),
    'dispose releases canvas, renderer, observer, geometries, and local GSAP context');
  check(harness.state.contextReverts === 1 && errors.length === 0, 'normal lifecycle completes without renderer error');
}

{
  const harness = makeHarness(true, { throwRender: true });
  const mount = new FakeElement();
  const errors = [];
  let readyCalls = 0;
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, { onReady() { readyCalls += 1; }, onError(error) { errors.push(error); } }));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const canvas = harness.state.renderers[0].domElement;
  check(adapter.render(frame(1)) === false, 'first real render failure fails closed');
  check(readyCalls === 0 && errors.length === 1 && canvas.style.pointerEvents === 'none', 'failure never claims ready or input');
  check(adapter.dispose() === true && harness.state.contextReverts === 1, 'failed adapter remains cleanly disposable');
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {}));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const terminal = frame(1, { terminal: true, winner: 0, placementSeq: 1 });
  check(adapter.render(terminal) === true && adapter.motion(lockEvent(1)) === false,
    'terminal targets cannot replay a final lock');
  const entrance = harness.state.timelines.at(-1);
  entrance.complete();
  check(adapter.motion(terminalEvent(1)) === true, 'accepted terminal fact starts the presentation-only result camera after its frame');
  const resultShot = harness.state.timelines.at(-1);
  check(resultShot.labels.map(item => item[0]).join(',') === 'result,podium,settled' && resultShot.children.length <= 4 &&
    harness.state.cameraPlans.at(-1).mode === 'result',
    'terminal uses one bounded shared result shot and marker pulse');
  resultShot.complete();
  check(harness.state.renderers[0].loop === null, 'completed result shot holds a static result pose without a persistent loop');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {}, 'LOW'));
  adapter.mount({ quality: 'LOW', reducedMotion: false });
  const terminal = frame(1, { terminal: true, winner: 0, placementSeq: 1 });
  check(adapter.render(terminal) === true && harness.state.timelines.length === 0 && adapter.motion(terminalEvent(1)) === true &&
    harness.state.timelines.length === 0 && harness.state.renderers[0].loop == null,
    'LOW terminal reaches the same readable result pose immediately without timeline work');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter({ ...optionsFor(mount, {}, 'HIGH'), reducedMotion: true });
  adapter.mount({ quality: 'HIGH', reducedMotion: true });
  const terminal = frame(1, { terminal: true, winner: 0, placementSeq: 1 });
  const before = harness.state.timelines.length;
  check(adapter.render(terminal) === true && adapter.motion(terminalEvent(1), { reducedMotion: true }) === true &&
    harness.state.timelines.length === before && harness.state.renderers[0].loop == null,
    'reduced-motion terminal applies the static result pose with zero timeline');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {}));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const restored = frame(1, { origin: { source: 'room-restored', matchId: 'm', authorityRevision: 1, stateHash: 'h' }, placementSeq: 1 });
  check(adapter.render(restored) === true && adapter.motion(lockEvent(1)) === false, 'restore snapshots are always static reconciliation');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {}));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  check(adapter.render(frame(1, { placementSeq: 1 })) === true, 'local baseline presents before static reconcile');
  const reconcile = frame(2, { origin: { source: 'reconcile' }, placementSeq: 2 });
  check(adapter.render(reconcile) === true && adapter.motion(lockEvent(2)) === false,
    'reconcile may omit authority guards but can never turn its static state into motion');
  const partialGuard = buildFrame(3, { origin: { source: 'reconcile', matchId: 'm' }, placementSeq: 3 });
  check(adapter.render(deepFreeze(partialGuard)) === false, 'reconcile with any guard must carry a complete valid authority guard triplet');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {}));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  adapter.render(frame(1));
  const renderer = harness.state.renderers[0];
  const before = renderer.size.slice();
  mount.clientWidth = 844;
  mount.clientHeight = 390;
  const observer = FakeResizeObserver.instances.at(-1);
  observer.callback();
  observer.callback();
  check(harness.state.animationFrames.length === 1, 'duplicate resize callbacks schedule exactly one cancellable animation-frame task');
  check(adapter.dispose() === true && harness.state.cancelledFrames.length === 1 && harness.state.animationFrames.length === 0,
    'dispose cancels queued resize work before it can touch released renderer resources');
  harness.state.flushAnimationFrames();
  check(JSON.stringify(renderer.size) === JSON.stringify(before), 'cancelled resize callback cannot run after disposal');
}

{
  const harness = makeHarness(true, { noAnimationFrame: true });
  const mount = new FakeElement();
  const adapter = harness.api.createTetris3DAdapter(optionsFor(mount, {}));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  adapter.render(frame(1));
  mount.clientWidth = 1024;
  mount.clientHeight = 768;
  const observer = FakeResizeObserver.instances.at(-1);
  observer.callback();
  observer.callback();
  check(harness.state.microtasks.length === 1, 'microtask fallback remains coalesced when animation-frame scheduling is unavailable');
  harness.state.flushMicrotasks();
  check(harness.state.renderers[0].size[0] === 1024 && harness.state.renderers[0].size[1] === 768, 'fallback performs one safe latest geometry update');
  adapter.dispose();
}

console.log('ALL_PASS tetris-ghost3d-renderer assertions=' + assertions);
