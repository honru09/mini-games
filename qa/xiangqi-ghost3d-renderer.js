'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'xiangqi-entry.js');
const ENTRY_SOURCE = fs.readFileSync(ENTRY, 'utf8');
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
  constructor(width = 420, height = 360) {
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
    microtasks: [],
    throwRender: options.throwRender === true
  };
  state.flushMicrotasks = () => {
    while (state.microtasks.length) state.microtasks.shift()();
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
    Mesh: FakeMesh,
    HemisphereLight: FakeHemisphereLight,
    DirectionalLight: FakeDirectionalLight,
    Color: FakeColor
  };
  const fakeWindow = new FakeEventTarget();
  fakeWindow.devicePixelRatio = 3;
  const module = { exports: {} };
  const transformed = ENTRY_SOURCE
    .replace("import * as THREE from '../vendor/three/r185/build/three.module.js';", 'const THREE = __THREE__;')
    .replace("import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';", 'const WebGL = __WEBGL__;')
    .replace("import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';", 'const gsap = __GSAP__;')
    .replace('export const XIANGQI_3D_QUALITY', 'const XIANGQI_3D_QUALITY')
    .replace('export function isXiangqi3DSupported', 'function isXiangqi3DSupported')
    .replace('export function createXiangqi3DAdapter', 'function createXiangqi3DAdapter')
    .concat('\nmodule.exports = { XIANGQI_3D_QUALITY, isXiangqi3DSupported, createXiangqi3DAdapter };\n');
  vm.runInNewContext(transformed, {
    module,
    exports: module.exports,
    __THREE__: fakeThree,
    __WEBGL__: { isWebGL2Available: () => supported },
    __GSAP__: makeGsap(state),
    window: fakeWindow,
    ResizeObserver: FakeResizeObserver,
    queueMicrotask(callback) { state.microtasks.push(callback); },
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

function standardPieces(redRook, blackRook, blackKing) {
  return [
    { p: 1, t: 'k', row: 0, col: blackKing === undefined ? 4 : blackKing },
    { p: 1, t: 'r', row: 0, col: blackRook === undefined ? 0 : blackRook },
    { p: 0, t: 'k', row: 9, col: 4 },
    { p: 0, t: 'r', row: redRook[0], col: redRook[1] }
  ];
}

function boardFromPieces(pieces) {
  const board = Array.from({ length: 10 }, () => Array(9).fill(null));
  (pieces || standardPieces([9, 0])).forEach(piece => {
    board[piece.row][piece.col] = { p: piece.p, t: piece.t };
  });
  return board;
}

function buildXiangqiFrame(revision, pieces, options) {
  const settings = options || {};
  return {
    kind: 'xiangqi-3d-frame-v1',
    revision,
    origin: settings.origin || { source: 'local' },
    board: settings.board || boardFromPieces(pieces),
    current: settings.current === undefined ? 0 : settings.current,
    moveNumber: settings.moveNumber === undefined ? revision : settings.moveNumber,
    lastMove: settings.lastMove === undefined ? null : settings.lastMove,
    check: settings.check === true,
    terminal: settings.terminal === true,
    winner: settings.winner === undefined ? -1 : settings.winner
  };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(key => deepFreeze(value[key]));
  return Object.freeze(value);
}

function xiangqiFrame(revision, pieces, options) {
  return deepFreeze(buildXiangqiFrame(revision, pieces, options));
}

function moveEvent(revision, from, to, capture, eventId) {
  return deepFreeze({
    type: 'piece_moved',
    revision,
    eventId: eventId || 'generation:' + revision + ':0:' + from.join(',') + ':' + to.join(','),
    player: 0,
    from: from.slice(),
    to: to.slice(),
    capture: capture === true
  });
}

{
  const unsupported = makeHarness(false);
  check(unsupported.api.isXiangqi3DSupported() === false, 'WebGL2 capability reports unavailable');
  expectCode(() => unsupported.api.createXiangqi3DAdapter(validOptions(new FakeElement(), {})),
    'XIANGQI3D_WEBGL2_UNAVAILABLE', 'unsupported capability rejects before renderer construction');
  check(unsupported.state.renderers.length === 0, 'WebGLRenderer is never constructed without WebGL2');
}

{
  const harness = makeHarness(true);
  const { createXiangqi3DAdapter, isXiangqi3DSupported, XIANGQI_3D_QUALITY } = harness.api;
  check(isXiangqi3DSupported() === true, 'official WebGL capability seam is used');
  check(Object.isFrozen(XIANGQI_3D_QUALITY) && XIANGQI_3D_QUALITY.HIGH === 'HIGH' && XIANGQI_3D_QUALITY.LOW === 'LOW',
    'quality ladder is immutable and explicit');
  expectCode(() => createXiangqi3DAdapter(null), 'XIANGQI3D_INVALID_OPTIONS', 'options are required');
  expectCode(() => createXiangqi3DAdapter({}), 'XIANGQI3D_INVALID_MOUNT_ELEMENT', 'mount element is required');
  expectCode(() => createXiangqi3DAdapter({ mountElement: new FakeElement(), quality: 'invalid' }),
    'XIANGQI3D_INVALID_QUALITY', 'quality is bounded to the shared ladder');

  const errors = [];
  const losses = [];
  let readyCalls = 0;
  const mount = new FakeElement();
  const adapter = createXiangqi3DAdapter(validOptions(mount, {
    onReady() { readyCalls += 1; },
    onError(error) { errors.push(error); },
    onContextLost(reason) { losses.push(reason); }
  }));
  check(Object.isFrozen(adapter), 'Adapter surface is immutable');
  check(JSON.stringify(Object.keys(adapter)) === JSON.stringify([
    'id', 'mount', 'render', 'motion', 'setQuality', 'environment', 'suspend', 'resume', 'contextLost', 'dispose'
  ]), 'Adapter exposes exactly the Foundation lifecycle Interface');
  check(adapter.id === 'xiangqi-three-r185', 'Adapter id is stable');
  check(adapter.mount({ quality: 'HIGH', reducedMotion: false }) === true, 'procedural 10x9 scene mounts');
  const renderer = harness.state.renderers[0];
  const canvas = renderer.domElement;
  check(readyCalls === 0 && !renderer.renderCount && canvas.style.pointerEvents === 'none',
    'mount retains the DOM board and never claims readiness before a semantic frame');
  check(canvas.getAttribute('aria-hidden') === 'true' && canvas.tabIndex === -1 && canvas.listenerCount('pointerdown') === 0,
    'renderer canvas is read-only, inaccessible, and owns no game-input listener');
  check(harness.fakeThree.ColorManagement.enabled === true && renderer.outputColorSpace === 'srgb' && renderer.toneMapping === 'no-tone-mapping',
    'colour output is explicit');
  check(renderer.pixelRatio === 2 && renderer.shadowMap.enabled === true,
    'HIGH caps DPR at two and enables the one shadow path');

  const initial = xiangqiFrame(1, standardPieces([9, 0]));
  check(adapter.render(initial) === true, 'frozen 10x9 projection renders');
  check(readyCalls === 1 && renderer.renderCount > 0 && harness.state.timelines.length >= 1,
    'first frame announces ready after a successful render and starts only its finite entrance beat');
  const entranceTimeline = harness.state.timelines.at(-1);
  check(entranceTimeline.labels.map(item => item[0]).join(',') === 'entrance,overview' && entranceTimeline.children.length === 2,
    'HIGH first frame uses one bounded shared camera-entrance timeline');
  const firstFrameTimelineCount = harness.state.timelines.length;
  check(renderer.lastScene.children.length >= 4 && canvas.style.pointerEvents === 'none',
    'scene owns the procedural board, pieces, lights, and neutral state marker without input');
  const frozenMapGeometry = { horizontal:0, border:0, riverSegments:0, palace:0, river:0 };
  const frozenTable = renderer.lastScene.children.find(child => child instanceof FakeGroup && child.children.some(node => node && node.geometry && Array.isArray(node.geometry.args) && Math.abs(node.geometry.args[1] - .46) < 1e-9));
  (frozenTable ? frozenTable.children : []).forEach(node => {
    const args = node && node.geometry && Array.isArray(node.geometry.args) ? node.geometry.args : null;
    if (!args || args.length !== 3) return;
    if (node.name === 'xiangqi-map-grid-horizontal') frozenMapGeometry.horizontal += 1;
    if (node.name === 'xiangqi-map-grid-border') frozenMapGeometry.border += 1;
    if (node.name === 'xiangqi-map-grid-river-segment') frozenMapGeometry.riverSegments += 1;
    if (node.name === 'xiangqi-map-palace-diagonal') frozenMapGeometry.palace += 1;
    if (node.name === 'xiangqi-map-river') frozenMapGeometry.river += 1;
  });
  check(frozenMapGeometry.horizontal === 10 && frozenMapGeometry.border === 2 && frozenMapGeometry.riverSegments === 14,
    'the frozen optional renderer keeps ten ranks while only the two borders cross the river ' + JSON.stringify(frozenMapGeometry));
  check(frozenMapGeometry.palace === 4 && frozenMapGeometry.river === 1,
    'the frozen optional renderer keeps both palace crosses and one recessed river lane');
  const pieceGroups = [];
  renderer.lastScene.traverse(node => {
    if (node instanceof FakeGroup && Array.isArray(node.children) && node.children.length === 3 && node.children.every(child => child && child.isMesh)) pieceGroups.push(node);
  });
  const markerGeometryProfiles = new Set(pieceGroups.map(group => JSON.stringify(group.children[2].geometry.args)));
  check(pieceGroups.length >= 4 && markerGeometryProfiles.size >= 2,
    'procedural pieces expose raised type-specific geometry instead of indistinguishable side-colour tokens');
  check(adapter.render(initial) === true && harness.state.timelines.length === firstFrameTimelineCount,
    'an equal Foundation repaint is idempotent and never invents motion');

  const mutable = buildXiangqiFrame(2, standardPieces([9, 0]));
  check(adapter.render(mutable) === false, 'renderer only accepts the bridge’s deeply frozen semantic frame');
  const wrongRows = buildXiangqiFrame(2, standardPieces([9, 0]));
  wrongRows.board.pop();
  check(adapter.render(deepFreeze(wrongRows)) === false, 'projection locks the tabletop to ten 9-cell rows');
  const unknownOrigin = buildXiangqiFrame(2, standardPieces([9, 0]));
  unknownOrigin.origin.source = 'unknown';
  check(adapter.render(deepFreeze(unknownOrigin)) === false, 'unknown source continuity fails closed');
  const invalidOnlineOrigin = buildXiangqiFrame(2, standardPieces([9, 0]), { origin: { source: 'live' } });
  check(adapter.render(deepFreeze(invalidOnlineOrigin)) === false, 'live projection requires all raw authority guards');
  const invalidCell = buildXiangqiFrame(2, standardPieces([9, 0]));
  invalidCell.board[9][0] = { p: 0, t: 'invalid' };
  check(adapter.render(deepFreeze(invalidCell)) === false, 'a 10x9 public cell admits only Xiangqi piece values');
  const equalRevisionConflict = buildXiangqiFrame(1, standardPieces([9, 0]), { current: 1 });
  check(adapter.render(deepFreeze(equalRevisionConflict)) === false,
    'same-revision repaint must preserve its complete public projection');

  const walked = xiangqiFrame(2, standardPieces([7, 0]), {
    origin: { source: 'live', matchId: 'match-1', authorityRevision: 2, stateHash: 'state-2' },
    lastMove: { from: [9, 0], to: [7, 0], capture: null }
  });
  check(adapter.render(walked) === true, 'a later revision moves the accepted public projection');
  check(adapter.motion(moveEvent(1, [9, 0], [7, 0], false)) === false,
    'stale semantic motion cannot animate a newer projection');
  check(adapter.motion(deepFreeze({ ...moveEvent(2, [9, 0], [7, 0], false), type: 'token_moved' })) === false,
    'non-canonical semantic motion names are rejected');
  check(adapter.motion(moveEvent(2, [9, 0], [7, 1], false)) === false,
    'motion must target the accepted public piece position');
  const walkedMotion = moveEvent(2, [9, 0], [7, 0], false);
  check(adapter.motion(walkedMotion) === true,
    'one current-revision non-capture movement creates renderer-owned choreography');
  check(adapter.motion(walkedMotion) === false, 'a motion event id is consumed exactly once by the adapter');
  const highMotion = harness.state.timelines.at(-1);
  check(highMotion.labels.map(item => item[0]).join(',') === 'focus,travel,settle,settled',
    'HIGH uses only the semantic focus travel settle sequence');
  check(typeof renderer.loop === 'function', 'a render loop only exists during finite motion');
  highMotion.complete();
  check(renderer.loop === null, 'render loop stops when the semantic motion settles');

  const captured = xiangqiFrame(3, [
    { p: 1, t: 'k', row: 0, col: 4 },
    { p: 0, t: 'k', row: 9, col: 4 },
    { p: 0, t: 'r', row: 0, col: 0 }
  ], { lastMove: { from: [7, 0], to: [0, 0], capture: { p: 1, t: 'r' } } });
  check(adapter.render(captured) === true && adapter.motion(moveEvent(3, [7, 0], [0, 0], true)) === true,
    'a current-revision capture remains one semantic movement type');
  const captureMotion = harness.state.timelines.at(-1);
  check(captureMotion.labels.map(item => item[0]).join(',') === 'focus,travel,settle,impact,settled',
    'HIGH uses a bounded post-travel capture impact beat before settle');
  captureMotion.complete();

  check(adapter.setQuality('BALANCED') === true && renderer.pixelRatio === 1.5 && renderer.shadowMap.enabled === false,
    'BALANCED lowers DPR and removes shadows');
  const balancedFrame = xiangqiFrame(4, [
    { p: 1, t: 'k', row: 0, col: 4 },
    { p: 0, t: 'k', row: 9, col: 4 },
    { p: 0, t: 'r', row: 0, col: 3 }
  ], { lastMove: { from: [0, 0], to: [0, 3], capture: null } });
  check(adapter.render(balancedFrame) === true && adapter.motion(moveEvent(4, [0, 0], [0, 3], false)) === true,
    'BALANCED represents the accepted semantic movement');
  const balancedMotion = harness.state.timelines.at(-1);
  check(balancedMotion.labels.map(item => item[0]).join(',') === 'focus,travel,settle,settled',
    'BALANCED keeps the shared shortened focus/travel language with a finite semantic sequence');
  balancedMotion.complete();

  const beforeLow = harness.state.timelines.length;
  check(adapter.setQuality('LOW') === true && renderer.pixelRatio === 1, 'LOW uses DPR one');
  const lowFrame = xiangqiFrame(5, [
    { p: 1, t: 'k', row: 0, col: 4 },
    { p: 0, t: 'k', row: 9, col: 4 },
    { p: 0, t: 'r', row: 0, col: 6 }
  ], { lastMove: { from: [0, 3], to: [0, 6], capture: null } });
  check(adapter.render(lowFrame) === true && adapter.motion(moveEvent(5, [0, 3], [0, 6], false)) === true &&
    harness.state.timelines.length === beforeLow && renderer.loop === null,
  'LOW resolves accepted semantic state without a timeline or persistent loop');

  check(adapter.setQuality('HIGH') === true && adapter.environment({ reducedMotion: true }) === true,
    'reduced-motion environment is accepted');
  const beforeReduced = harness.state.timelines.length;
  const reducedFrame = xiangqiFrame(6, [
    { p: 1, t: 'k', row: 0, col: 4 },
    { p: 0, t: 'k', row: 9, col: 4 },
    { p: 0, t: 'r', row: 1, col: 6 }
  ], { lastMove: { from: [0, 6], to: [1, 6], capture: null } });
  check(adapter.render(reducedFrame) === true && adapter.motion(moveEvent(6, [0, 6], [1, 6], false)) === true &&
    harness.state.timelines.length === beforeReduced,
  'reduced motion settles immediately instead of slowing the animation');
  check(adapter.environment({ reducedMotion: false }) === true, 'normal motion can be restored');

  const suspendFrame = xiangqiFrame(7, [
    { p: 1, t: 'k', row: 0, col: 4 },
    { p: 0, t: 'k', row: 9, col: 4 },
    { p: 0, t: 'r', row: 2, col: 6 }
  ], { lastMove: { from: [1, 6], to: [2, 6], capture: null } });
  check(adapter.render(suspendFrame) === true && adapter.motion(moveEvent(7, [1, 6], [2, 6], false)) === true,
    'normal motion accepts a new current-revision event');
  const suspendedMotion = harness.state.timelines.at(-1);
  check(adapter.suspend() === true && suspendedMotion.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'suspend kills local motion, settles the latest frame, and leaves DOM input untouched');
  check(adapter.resume() === true && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'resume re-renders static state without reviving dropped work or input');

  const observer = FakeResizeObserver.instances.at(-1);
  mount.clientWidth = 510;
  mount.clientHeight = 300;
  observer.callback();
  observer.callback();
  check(harness.state.microtasks.length === 1, 'ResizeObserver work is coalesced to one queued geometry update');
  harness.state.flushMicrotasks();
  check(renderer.size[0] === 510 && renderer.size[1] === 300 && renderer.lastCamera.projectionUpdates >= 1,
    'ResizeObserver recomputes renderer geometry from the host');

  const lossFrame = xiangqiFrame(8, [
    { p: 1, t: 'k', row: 0, col: 4 },
    { p: 0, t: 'k', row: 9, col: 4 },
    { p: 0, t: 'r', row: 3, col: 6 }
  ], { lastMove: { from: [2, 6], to: [3, 6], capture: null } });
  check(adapter.render(lossFrame) === true && adapter.motion(moveEvent(8, [2, 6], [3, 6], false)) === true,
    'a final active motion can begin before context loss');
  const lossMotion = harness.state.timelines.at(-1);
  let prevented = false;
  canvas.dispatch('webglcontextlost', { preventDefault() { prevented = true; } });
  check(prevented && losses.length === 1 && losses[0] === 'webglcontextlost',
    'context loss prevents browser default and reports once');
  check(lossMotion.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'context loss removes renderer ownership immediately');
  check(adapter.render(xiangqiFrame(9, standardPieces([3, 6]))) === false && adapter.contextLost() === true && losses.length === 1,
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
  const adapter = harness.api.createXiangqi3DAdapter(validOptions(mount, {
    onReady() { readyCalls += 1; },
    onError(error) { errors.push(error); }
  }));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const canvas = harness.state.renderers[0].domElement;
  check(adapter.render(xiangqiFrame(1, standardPieces([9, 0]))) === false, 'pre-ready render failure fails closed');
  check(readyCalls === 0 && errors.length === 1 && canvas.style.pointerEvents === 'none',
    'failed first render never announces ready or captures input');
  check(adapter.dispose() === true && harness.state.contextReverts === 1,
    'failed adapter still cleans scoped GSAP resources');
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createXiangqi3DAdapter(validOptions(mount, {}));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const terminal = xiangqiFrame(1, standardPieces([7, 0]), {
    terminal: true,
    winner: 0,
    lastMove: { from: [9, 0], to: [7, 0], capture: null }
  });
  check(adapter.render(terminal) === true && adapter.motion(moveEvent(1, [9, 0], [7, 0], false)) === false,
  'an explicit terminal target never turns lastMove into renderer motion');
  check(adapter.motion(deepFreeze({ type:'terminal', revision:1, winner:0, outcome:'win', eventId:'terminal-1' })) === true,
    'an accepted terminal fact starts the finite result camera beat');
  const resultTimeline = harness.state.timelines.at(-1);
  check(resultTimeline.labels.map(item => item[0]).join(',') === 'result,settled' && resultTimeline.children.length === 4,
    'result beat combines camera read and bounded winner-king pulse');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  let firstReady = 0;
  const first = harness.api.createXiangqi3DAdapter(validOptions(mount, { onReady() { firstReady += 1; } }));
  first.mount({ quality: 'HIGH', reducedMotion: false });
  first.render(xiangqiFrame(1, standardPieces([9, 0])));
  const firstEntrance = harness.state.timelines.at(-1);
  check(first.dispose() === true && firstEntrance.killed >= 1,
    'dispose kills the in-flight first-camera entrance before recovery');
  let recoveredReady = 0;
  const recovered = harness.api.createXiangqi3DAdapter(validOptions(mount, { onReady() { recoveredReady += 1; } }));
  check(recovered.mount({ quality: 'HIGH', reducedMotion: false }) === true && recoveredReady === 0,
    'fresh recovery remains unready through mount');
  check(recovered.render(xiangqiFrame(1, standardPieces([8, 0]))) === true && firstReady === 1 && recoveredReady === 1 &&
    harness.state.timelines.length >= 2,
  'fresh recovery starts its own finite entrance only after its own first render');
  recovered.dispose();
}

console.log('ALL_PASS xiangqi-ghost3d-renderer assertions=' + assertions);
