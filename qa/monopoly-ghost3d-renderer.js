'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'monopoly-entry.js');
const ENTRY_SOURCE = fs.readFileSync(ENTRY, 'utf8');
const CAMERA_RIG_SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', '00-tabletop-camera-rig.js'), 'utf8');
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
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    const handlers = this.listeners.get(type);
    if (handlers) handlers.delete(handler);
  }

  dispatch(type, event) {
    (this.listeners.get(type) || new Set()).forEach(handler => handler(event || {}));
  }

  listenerCount(type) {
    if (type) return (this.listeners.get(type) || new Set()).size;
    return Array.from(this.listeners.values()).reduce((total, handlers) => total + handlers.size, 0);
  }
}

class FakeElement extends FakeEventTarget {
  constructor(width = 360, height = 300) {
    super();
    this.children = [];
    this.parentNode = null;
    this.clientWidth = width;
    this.clientHeight = height;
    this.style = {};
    this.attributes = new Map();
    this.tabIndex = 0;
  }

  appendChild(child) {
    this.children.push(child);
    child.parentNode = this;
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }
}

class FakeCanvas extends FakeElement {}

class FakeVector3 {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }

  clone() {
    return new FakeVector3(this.x, this.y, this.z);
  }
}

class FakeObject3D {
  constructor() {
    this.children = [];
    this.parent = null;
    this.position = new FakeVector3();
    this.rotation = new FakeVector3();
    this.scale = new FakeVector3(1, 1, 1);
    this.userData = {};
    this.visible = true;
  }

  add(...children) {
    children.forEach(child => {
      child.parent = this;
      this.children.push(child);
    });
  }

  remove(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parent = null;
  }

  traverse(visitor) {
    visitor(this);
    this.children.forEach(child => child.traverse ? child.traverse(visitor) : visitor(child));
  }
}

class FakeScene extends FakeObject3D {
  clear() {
    this.children.length = 0;
    this.cleared = true;
  }
}

class FakeCamera extends FakeObject3D {
  constructor() {
    super();
    this.aspect = 1;
  }

  updateProjectionMatrix() {
    this.projectionUpdates = (this.projectionUpdates || 0) + 1;
  }

  lookAt(target) {
    this.lookTarget = target && target.clone ? target.clone() : target;
  }
}

class FakeGroup extends FakeObject3D {}

class FakeGeometry {
  constructor(...args) {
    this.args = args;
  }

  dispose() {
    this.disposed = (this.disposed || 0) + 1;
  }
}

class FakeMaterial {
  constructor(options) {
    this.options = options;
  }

  dispose() {
    this.disposed = (this.disposed || 0) + 1;
  }
}

class FakeMesh extends FakeObject3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
    this.isMesh = true;
  }
}

class FakeHemisphereLight extends FakeObject3D {}

class FakeDirectionalLight extends FakeObject3D {
  constructor() {
    super();
    this.target = new FakeObject3D();
    this.shadow = { mapSize: { set: (width, height) => { this.shadowSize = [width, height]; } } };
  }
}

class FakeColor {
  constructor(value) {
    this.value = value;
  }
}

class FakeResizeObserver {
  constructor(callback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  observe(element) {
    this.element = element;
  }

  disconnect() {
    this.disconnected = true;
  }
}
FakeResizeObserver.instances = [];

function makeGsap(state) {
  return {
    context(callback, scope) {
      callback();
      const context = {
        scope,
        add(fn) { fn(); },
        revert() { state.contextReverts += 1; }
      };
      state.contexts.push(context);
      return context;
    },
    timeline(config) {
      const timeline = {
        config: config || {},
        children: [],
        labels: [],
        played: 0,
        killed: 0,
        addLabel(label, position) {
          this.labels.push([label, position]);
          return this;
        },
        to(target, vars, position) {
          this.children.push({ target, vars, position });
          return this;
        },
        play() {
          this.played += 1;
          return this;
        },
        kill() {
          this.killed += 1;
          return this;
        },
        complete() {
          this.children.forEach(child => {
            ['x', 'y', 'z'].forEach(key => {
              if (Object.prototype.hasOwnProperty.call(child.vars, key)) child.target[key] = child.vars[key];
            });
            if (typeof child.vars.onUpdate === 'function') child.vars.onUpdate();
          });
          if (typeof this.config.onComplete === 'function') this.config.onComplete();
        }
      };
      state.timelines.push(timeline);
      return timeline;
    },
    killTweensOf(target) {
      state.killedTargets.push(target);
    }
  };
}

function makeHarness(supported, options) {
  options = options || {};
  const state = {
    renderers: [],
    timelines: [],
    killedTargets: [],
    contexts: [],
    contextReverts: 0,
    throwRender: options.throwRender === true
  };
  class FakeWebGLRenderer {
    constructor(rendererOptions) {
      this.options = rendererOptions;
      this.domElement = new FakeCanvas();
      this.shadowMap = {};
      this.renderLists = { dispose: () => { this.renderListsDisposed = (this.renderListsDisposed || 0) + 1; } };
      state.renderers.push(this);
    }

    setPixelRatio(value) {
      this.pixelRatio = value;
    }

    setSize(width, height, updateStyle) {
      this.size = [width, height, updateStyle];
    }

    setAnimationLoop(callback) {
      this.loop = callback;
    }

    render(scene, camera) {
      if (state.throwRender) throw new Error('forced_render_failure');
      this.renderCount = (this.renderCount || 0) + 1;
      this.lastScene = scene;
      this.lastCamera = camera;
    }

    dispose() {
      this.disposed = (this.disposed || 0) + 1;
    }
  }

  const fakeThree = {
    ColorManagement: { enabled: false },
    SRGBColorSpace: 'srgb',
    NoToneMapping: 'no-tone-mapping',
    PCFShadowMap: 'pcf-shadow-map',
    WebGLRenderer: FakeWebGLRenderer,
    Scene: FakeScene,
    PerspectiveCamera: FakeCamera,
    Vector3: FakeVector3,
    Group: FakeGroup,
    BoxGeometry: FakeGeometry,
    CylinderGeometry: FakeGeometry,
    SphereGeometry: FakeGeometry,
    MeshStandardMaterial: FakeMaterial,
    MeshBasicMaterial: FakeMaterial,
    Mesh: FakeMesh,
    HemisphereLight: FakeHemisphereLight,
    DirectionalLight: FakeDirectionalLight,
    Color: FakeColor
  };
  const fakeWindow = new FakeEventTarget();
  fakeWindow.devicePixelRatio = 3;
  const rigSandbox = { globalThis: {} };
  vm.createContext(rigSandbox);
  vm.runInContext(CAMERA_RIG_SOURCE, rigSandbox, { filename: '00-tabletop-camera-rig.js' });
  fakeWindow.TabletopCameraRig = rigSandbox.globalThis.TabletopCameraRig;
  const module = { exports: {} };
  const transformed = ENTRY_SOURCE
    .replace("import * as THREE from '../vendor/three/r185/build/three.module.js';", 'const THREE = __THREE__;')
    .replace("import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';", 'const WebGL = __WEBGL__;')
    .replace("import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';", 'const gsap = __GSAP__;')
    .replace('export const VERSIONS', 'const VERSIONS')
    .replace('export function isMonopoly3DSupported', 'function isMonopoly3DSupported')
    .replace('export function createMonopoly3DAdapter', 'function createMonopoly3DAdapter')
    .concat('\nmodule.exports = { VERSIONS, isMonopoly3DSupported, createMonopoly3DAdapter };\n');
  vm.runInNewContext(transformed, {
    module,
    exports: module.exports,
    __THREE__: fakeThree,
    __WEBGL__: { isWebGL2Available: () => supported },
    __GSAP__: makeGsap(state),
    window: fakeWindow,
    ResizeObserver: FakeResizeObserver,
    console
  }, { filename: ENTRY });
  return { api: module.exports, state, fakeThree };
}

function validOptions(mountElement, callbacks, quality) {
  return {
    mountElement,
    onReady: callbacks.onReady,
    onError: callbacks.onError,
    onContextLost: callbacks.onContextLost,
    quality: quality || 'HIGH'
  };
}

function monopolyFrame(revision, playerCount, process) {
  const types = ['go', 'chance', 'prop', 'tax', 'prop', 'rest'];
  const processStage = process || 'walk';
  const phaseForStage = {
    roll: 'roll',
    walk: 'moving',
    land: 'resolving',
    buy: 'buy',
    event: 'chance',
    auction: 'auction',
    trade: 'resolving',
    'turn-end': 'done'
  };
  return {
    kind: 'monopoly-3d-frame-v1',
    revision,
    board: {
      cellCount: 24,
      cells: Array.from({ length: 24 }, (_, index) => ({
        index,
        type: types[index % types.length],
        ownerPlayerId: index % 5 === 0 ? index % playerCount : -1
      }))
    },
    players: Array.from({ length: playerCount }, (_, seatId) => ({
      playerId: seatId,
      seatId,
      authorityPosition: (seatId * 4 + revision) % 24,
      displayPosition: (seatId * 4 + revision) % 24,
      visible: seatId !== playerCount - 1 || playerCount < 5,
      state: seatId === 0 ? 'moving' : 'idle',
      facing: 'north',
      renderMode: 'code-fallback'
    })),
    turn: { activePlayerId: 0, phase: phaseForStage[processStage] || 'moving' },
    process: { stage: processStage },
    status: 'active',
    terminal: false,
    winnerPlayerId: -1,
    standings: []
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(key => deepFreeze(value[key]));
  return Object.freeze(value);
}

{
  const unsupported = makeHarness(false);
  check(unsupported.api.isMonopoly3DSupported() === false, 'WebGL2 capability reports unavailable');
  expectCode(() => unsupported.api.createMonopoly3DAdapter(validOptions(new FakeElement(), {})),
    'MONOPOLY3D_WEBGL2_UNAVAILABLE', 'unsupported capability rejects before renderer construction');
  check(unsupported.state.renderers.length === 0, 'WebGLRenderer is never constructed without WebGL2');
}

{
  const harness = makeHarness(true);
  const { createMonopoly3DAdapter, isMonopoly3DSupported, VERSIONS } = harness.api;
  check(isMonopoly3DSupported() === true, 'official WebGL capability seam is used');
  check(Object.isFrozen(VERSIONS) && Object.isFrozen(VERSIONS.three) && Object.isFrozen(VERSIONS.gsap), 'version record is deeply frozen');
  check(VERSIONS.three.version === '0.185.1' && VERSIONS.gsap.version === '3.15.0', 'Three and GSAP versions remain pinned');
  expectCode(() => createMonopoly3DAdapter(null), 'MONOPOLY3D_INVALID_OPTIONS', 'options are required');
  expectCode(() => createMonopoly3DAdapter({}), 'MONOPOLY3D_INVALID_MOUNT_ELEMENT', 'mount element is required');
  expectCode(() => createMonopoly3DAdapter({ mountElement: new FakeElement(), quality: 'invalid' }),
    'MONOPOLY3D_INVALID_QUALITY', 'quality is bounded to the shared ladder');

  const errors = [];
  const losses = [];
  let readyCalls = 0;
  const mount = new FakeElement();
  const adapter = createMonopoly3DAdapter(validOptions(mount, {
    onReady() { readyCalls += 1; },
    onError(error) { errors.push(error); },
    onContextLost(reason) { losses.push(reason); }
  }));
  check(Object.isFrozen(adapter), 'Adapter surface is immutable');
  check(JSON.stringify(Object.keys(adapter)) === JSON.stringify([
    'id', 'mount', 'render', 'motion', 'setQuality', 'environment', 'suspend', 'resume', 'contextLost', 'dispose'
  ]), 'Adapter exposes exactly the Foundation lifecycle Interface');
  check(adapter.id === 'monopoly-three-r185', 'Adapter id is stable');
  check(adapter.mount({ quality: 'HIGH', reducedMotion: false }) === true, 'procedural 24-cell scene mounts');
  const renderer = harness.state.renderers[0];
  const canvas = renderer.domElement;
  check(readyCalls === 0 && !renderer.renderCount && canvas.style.pointerEvents === 'none',
    'mount retains the DOM board and never claims readiness before a semantic frame');
  check(canvas.getAttribute('aria-hidden') === 'true' && canvas.tabIndex === -1 && canvas.listenerCount('pointerdown') === 0,
    'renderer canvas is read-only, inaccessible, and owns no game input listener');
  check(harness.fakeThree.ColorManagement.enabled === true && renderer.outputColorSpace === 'srgb' && renderer.toneMapping === 'no-tone-mapping',
    'colour output is explicit');
  check(renderer.pixelRatio === 2 && renderer.shadowMap.enabled === true,
    'HIGH caps DPR at two and enables the one shadow path');
  check(adapter.environment({ reducedMotion: false }, { reducedMotion: false }) === true && readyCalls === 0 && !renderer.renderCount,
    'pre-first-frame environment configuration remains inert');

  check(adapter.render(deepFreeze(monopolyFrame(1, 2, 'walk'))) === true, 'two-player frozen projection renders');
  check(adapter.render(monopolyFrame(2, 3, 'event')) === true, 'three-player projection stays data-driven');
  check(adapter.render(monopolyFrame(3, 4, 'buy')) === true, 'four-player projection stays data-driven');
  check(adapter.render(monopolyFrame(4, 5, 'auction')) === true, 'five-player projection stays data-driven');
  check(readyCalls === 1 && renderer.renderCount > 0 && canvas.style.pointerEvents === 'none',
    'first successful render alone announces readiness while the renderer remains read-only');
  check(renderer.lastScene.children.length >= 4,
    'scene owns table, lights, pieces, property projection, and neutral center state');
  const firstFrameTimelineCount = harness.state.timelines.length;
  const entranceTimeline = harness.state.timelines[0];
  check(firstFrameTimelineCount >= 1 && entranceTimeline.labels.map(item => item[0]).join(',') === 'entrance,settled' && entranceTimeline.children.length === 2,
    'HIGH first frame uses one bounded shared camera-entrance timeline');
  canvas.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  check(canvas.listenerCount('pointerdown') === 0 && canvas.style.pointerEvents === 'none',
    'pointer activity never creates an authority command');

  check(adapter.render({ kind: 'monopoly-3d-frame-v1', revision: 5, board: { cells: [] }, players: [] }) === false,
    'malformed frames fail closed without inventing state');
  const mismatchedIdentity = monopolyFrame(5, 2);
  mismatchedIdentity.players[0].playerId = 1;
  check(adapter.render(mismatchedIdentity) === false,
    'a projection cannot remap a player to a different seat');
  const gappedSeats = monopolyFrame(5, 2);
  gappedSeats.players[1].playerId = 2;
  gappedSeats.players[1].seatId = 2;
  check(adapter.render(gappedSeats) === false,
    'a projection cannot skip a public seat');
  const legacyOwner = monopolyFrame(5, 2);
  legacyOwner.board.cells[0].owner = legacyOwner.board.cells[0].ownerPlayerId;
  delete legacyOwner.board.cells[0].ownerPlayerId;
  check(adapter.render(legacyOwner) === false,
    'frame parsing accepts only the frozen ownerPlayerId projection key');
  const wrongCellCount = monopolyFrame(5, 2);
  wrongCellCount.board.cellCount = 23;
  check(adapter.render(wrongCellCount) === false,
    'frame parser locks the tabletop to its 24-cell projection');
  const unknownPhase = monopolyFrame(5, 2);
  unknownPhase.turn.phase = 'countdown';
  check(adapter.render(unknownPhase) === false,
    'an unknown frozen turn phase fails closed instead of becoming visual state');
  const unknownStage = monopolyFrame(5, 2);
  unknownStage.process.stage = 'countdown';
  check(adapter.render(unknownStage) === false,
    'an unknown frozen process stage fails closed instead of being hashed visually');
  check(adapter.motion({ type: 'piece_moved', revision: 3, actorPlayerId: 0, from: 0, to: 1, steps: 2, direction: 1 }) === false,
    'stale motion cannot animate a newer projection');
  check(adapter.motion({ type: 'move', revision: 4, actorPlayerId: 0, from: 0, to: 4, steps: 4, direction: 1 }) === false,
    'non-canonical motion names are rejected');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 4, to: 1, steps: -3, direction: -1 }) === false,
    'motion rejects a non-contract reverse distance');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 0, to: 4, steps: 4, direction: -1 }) === false,
    'motion rejects a forward signed-step and direction conflict');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 4, to: 2, steps: -2, direction: 1 }) === false,
    'motion rejects a reverse signed-step and direction conflict');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 0, to: 5, steps: 4, direction: 1 }) === false,
    'motion rejects a destination that disagrees with signed circular movement');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 4, to: 2, steps: -2, direction: -1 }) === true,
    'the one legal reverse token movement is accepted with its signed direction');
  const reverseMotion = harness.state.timelines.at(-1);
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 0, to: 4, steps: 4, direction: 1 }) === true,
    'one canonical semantic movement creates renderer-owned choreography');
  const highMotion = harness.state.timelines.at(-1);
  check(harness.state.timelines.length === firstFrameTimelineCount + 2 && reverseMotion.killed >= 1 && highMotion.labels.map(item => item[0]).join(',') === 'focus,travel,impact,restore,settled',
    'HIGH uses one labeled action-follow/impact/overview token motion and interrupts only earlier token work');
  check(highMotion.children.every(child => !Number.isFinite(child.vars.duration) || child.vars.duration <= 0.24) &&
    ENTRY_SOURCE.includes('const stepDuration = Math.max(0.028, 0.14 / points.length);'),
    'composite motion stays finite and bounded so land/settled are not cut off');
  check(typeof renderer.loop === 'function', 'a render loop only exists during finite motion');
  highMotion.complete();
  check(renderer.loop === null, 'render loop stops when the semantic motion settles');

  check(adapter.setQuality('BALANCED') === true && renderer.pixelRatio === 1.5 && renderer.shadowMap.enabled === false,
    'BALANCED lowers DPR and removes shadows');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 4, to: 7, steps: 3, direction: 1 }) === true,
    'BALANCED still represents an accepted semantic motion');
  const balanced = harness.state.timelines.at(-1);
  check(balanced.labels.map(item => item[0]).join(',') === 'focus,travel,impact,restore,settled',
    'BALANCED keeps the shared shortened action-follow/impact camera language with a finite state pulse');
  balanced.complete();
  const beforeLow = harness.state.timelines.length;
  check(adapter.setQuality('LOW') === true && renderer.pixelRatio === 1, 'LOW uses DPR one');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 7, to: 10, steps: 3, direction: 1 }) === true &&
    harness.state.timelines.length === beforeLow && renderer.loop === null,
  'LOW resolves the same semantic state without a timeline or persistent loop');
  check(adapter.setQuality('FALLBACK') === false, 'Renderer never constructs a Foundation fallback scene');

  check(adapter.setQuality('HIGH') === true && adapter.environment({ reducedMotion: true }) === true,
    'reduced-motion environment is accepted');
  const beforeReduced = harness.state.timelines.length;
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 10, to: 12, steps: 2, direction: 1 }) === true &&
    harness.state.timelines.length === beforeReduced,
  'reduced motion settles immediately instead of slowing the animation');
  check(adapter.environment({ reducedMotion: false }) === true, 'normal motion can be restored');
  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 12, to: 15, steps: 3, direction: 1 }) === true,
    'normal motion accepts a new current-revision event');
  const suspendedMotion = harness.state.timelines.at(-1);
  check(adapter.suspend() === true && suspendedMotion.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'suspend kills the local motion, settles visual state, and leaves fallback input untouched');
  check(adapter.resume() === true && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'resume re-renders settled state without reviving stale work or input');

  const observer = FakeResizeObserver.instances.at(-1);
  mount.clientWidth = 420;
  mount.clientHeight = 280;
  observer.callback();
  check(renderer.size[0] === 420 && renderer.size[1] === 280 && renderer.lastCamera.projectionUpdates >= 1,
    'ResizeObserver recomputes renderer geometry from the host');

  check(adapter.motion({ type: 'token_moved', revision: 4, actorPlayerId: 0, from: 15, to: 18, steps: 3, direction: 1 }) === true,
    'a final active motion can begin before context loss');
  const lossMotion = harness.state.timelines.at(-1);
  let prevented = false;
  canvas.dispatch('webglcontextlost', { preventDefault() { prevented = true; } });
  check(prevented && losses.length === 1 && losses[0] === 'webglcontextlost',
    'context loss prevents browser default and reports once');
  check(lossMotion.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'context loss removes renderer ownership immediately');
  check(adapter.render(monopolyFrame(5, 2)) === false && adapter.contextLost() === true && losses.length === 1,
    'lost adapter is never reused and explicit loss is idempotent');
  check(adapter.dispose() === true && adapter.dispose() === true, 'dispose is idempotent');
  check(renderer.disposed === 1 && renderer.renderListsDisposed === 1 && mount.children.length === 0 &&
    FakeResizeObserver.instances.some(item => item.disconnected),
  'dispose releases renderer canvas, render lists, geometry observers, and local resources');
  check(harness.state.contextReverts === 1 && errors.length === 0, 'normal lifecycle reverts local GSAP ownership without errors');
}

{
  const harness = makeHarness(true, { throwRender: true });
  const mount = new FakeElement();
  const errors = [];
  let readyCalls = 0;
  const adapter = harness.api.createMonopoly3DAdapter(validOptions(mount, {
    onReady() { readyCalls += 1; },
    onError(error) { errors.push(error); }
  }));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const canvas = harness.state.renderers[0].domElement;
  check(adapter.render(monopolyFrame(1, 2)) === false, 'pre-ready render failure fails closed');
  check(readyCalls === 0 && errors.length === 1 && canvas.style.pointerEvents === 'none',
    'failed first render never announces ready or captures input');
  check(adapter.dispose() === true && harness.state.contextReverts === 1,
    'failed adapter still cleans scoped GSAP resources');
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  let firstReady = 0;
  const first = harness.api.createMonopoly3DAdapter(validOptions(mount, { onReady() { firstReady += 1; } }));
  first.mount({ quality: 'HIGH', reducedMotion: false });
  first.render(monopolyFrame(1, 2));
  const firstEntrance = harness.state.timelines.at(-1);
  check(firstEntrance && first.dispose() === true && firstEntrance.killed >= 1,
    'dispose kills the in-flight first-camera entrance before fresh recovery');
  let recoveredReady = 0;
  const recovered = harness.api.createMonopoly3DAdapter(validOptions(mount, { onReady() { recoveredReady += 1; } }));
  check(recovered.mount({ quality: 'HIGH', reducedMotion: false }) === true && recoveredReady === 0,
    'fresh recovery remains unready through mount');
  check(recovered.render(monopolyFrame(1, 3)) === true && harness.state.timelines.length >= 2 && firstReady === 1 && recoveredReady === 1,
    'fresh recovery announces only after its own first-frame camera entrance begins');
  recovered.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createMonopoly3DAdapter(validOptions(mount, {}));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const terminal = monopolyFrame(1, 2, 'turn-end');
  terminal.terminal = true;
  terminal.winnerPlayerId = 0;
  terminal.turn.phase = 'finished';
  terminal.status = 'finished';
  check(adapter.render(deepFreeze(terminal)) === true, 'terminal authority projection renders before the result beat');
  check(adapter.motion(deepFreeze({ type:'terminal', revision:1, winnerPlayerId:0, eventId:'result-1' })) === true,
    'accepted terminal fact starts the finite result camera beat');
  const resultTimeline = harness.state.timelines.at(-1);
  check(resultTimeline.labels.map(item => item[0]).join(',') === 'read,podium,settled' && resultTimeline.children.length === 4,
    'result beat combines camera read and bounded winner-token pulse');
  adapter.dispose();
}

console.log('ALL_PASS monopoly-ghost3d-renderer assertions=' + assertions);
