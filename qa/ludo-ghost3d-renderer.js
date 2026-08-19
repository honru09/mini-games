'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'ludo-entry.js');
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

class FakeVector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}

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

  localToWorld(vector) {
    const angle = this.rotation.y || 0;
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = vector.x;
    const z = vector.z;
    vector.x = cosine * x + sine * z + this.position.x;
    vector.z = -sine * x + cosine * z + this.position.z;
    vector.y += this.position.y;
    return vector;
  }
}

class FakeScene extends FakeObject3D {
  clear() {
    this.children.length = 0;
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
      return context;
    },
    timeline(config) {
      const timeline = {
        config: config || {}, children: [], labels: [], played: 0, paused: 0, killed: 0,
        addLabel(label, position) { this.labels.push([label, position]); return this; },
        to(target, vars, position) { this.children.push({ target, vars, position }); return this; },
        play() { this.played += 1; return this; },
        pause() { this.paused += 1; return this; },
        kill() { this.killed += 1; return this; },
        complete() {
          this.children.forEach(child => {
            ['x', 'y', 'z'].forEach(key => {
              if (Object.prototype.hasOwnProperty.call(child.vars, key)) child.target[key] = child.vars[key];
            });
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
  const state = { renderers: [], timelines: [], killedTargets: [], contextReverts: 0, throwRender: options.throwRender === true };
  class FakeWebGLRenderer {
    constructor(rendererOptions) {
      this.options = rendererOptions;
      this.domElement = new FakeCanvas();
      this.shadowMap = {};
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
  class FakeRaycaster {
    setFromCamera(pointer, camera) {
      this.pointer = { x: pointer.x, y: pointer.y };
      this.camera = camera;
    }

    intersectObjects(objects, recursive) {
      state.raycastTargets = { objects, recursive };
      return objects.length ? [{ object: objects[0] }] : [];
    }
  }
  const fakeThree = {
    ColorManagement: { enabled: false }, SRGBColorSpace: 'srgb', NoToneMapping: 'no-tone-mapping', PCFShadowMap: 'pcf-shadow-map',
    WebGLRenderer: FakeWebGLRenderer, Scene: FakeScene, PerspectiveCamera: FakeCamera, Vector2: FakeVector2, Vector3: FakeVector3,
    Raycaster: FakeRaycaster, HemisphereLight: FakeHemisphereLight, DirectionalLight: FakeDirectionalLight, Group: FakeGroup,
    BoxGeometry: FakeGeometry, CylinderGeometry: FakeGeometry, SphereGeometry: FakeGeometry,
    MeshStandardMaterial: FakeMaterial, Mesh: FakeMesh, Color: FakeColor
  };
  const fakeWindow = new FakeEventTarget();
  fakeWindow.devicePixelRatio = 3;
  const module = { exports: {} };
  const transformed = ENTRY_SOURCE
    .replace("import * as THREE from '../vendor/three/r185/build/three.module.js';", 'const THREE = __THREE__;')
    .replace("import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';", 'const WebGL = __WEBGL__;')
    .replace("import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';", 'const gsap = __GSAP__;')
    .replace('export const VERSIONS', 'const VERSIONS')
    .replace('export function isLudo3DSupported', 'function isLudo3DSupported')
    .replace('export function createLudo3DAdapter', 'function createLudo3DAdapter')
    .concat('\nmodule.exports = { VERSIONS, isLudo3DSupported, createLudo3DAdapter };\n');
  vm.runInNewContext(transformed, {
    module, exports: module.exports, __THREE__: fakeThree, __WEBGL__: { isWebGL2Available: () => supported },
    __GSAP__: makeGsap(state), window: fakeWindow, ResizeObserver: FakeResizeObserver, console
  }, { filename: ENTRY });
  return { api: module.exports, state, fakeThree };
}

function validOptions(mountElement, callbacks, quality) {
  return {
    mountElement,
    onInput: callbacks.onInput,
    onContextLost: callbacks.onContextLost,
    onError: callbacks.onError,
    onReady: callbacks.onReady,
    quality: quality || 'HIGH'
  };
}

function ludoFrame(revision, playerCount, canSelect) {
  const teams = playerCount === 2 ? [0, 2] : (playerCount === 3 ? [0, 1, 2] : [0, 1, 2, 3]);
  const keys = ['red', 'blue', 'green', 'yellow'];
  return {
    revision,
    board: {
      trackLength: 52,
      home: 56,
      players: teams.map((team, seat) => ({ seat, colourKey: keys[team] })),
      pieces: teams.flatMap((team, seat) => [0, 1, 2, 3].map(tokenIndex => ({
        seat, tokenIndex, position: seat === 0 && tokenIndex === 0 ? 4 : (tokenIndex === 3 ? 56 : -1)
      })))
    },
    turn: { activeSeat: 0, canSelect: canSelect !== false, movableTokenIndexes: [0] },
    view: { quarterTurns: 1 },
    dice: { value: 6, phase: 'pick' },
    process: { stage: 'pick' }
  };
}

function findLudoToken(root, seat, tokenIndex) {
  if (!root) return null;
  if (root.userData && root.userData.ludoToken === true && root.userData.seat === seat && root.userData.tokenIndex === tokenIndex) return root;
  for (const child of root.children || []) {
    const found = findLudoToken(child, seat, tokenIndex);
    if (found) return found;
  }
  return null;
}

{
  const unsupported = makeHarness(false);
  check(unsupported.api.isLudo3DSupported() === false, 'WebGL2 capability reports unavailable');
  expectCode(() => unsupported.api.createLudo3DAdapter(validOptions(new FakeElement(), { onInput() {}, onContextLost() {} })), 'LUDO3D_WEBGL2_UNAVAILABLE', 'unsupported capability rejects before renderer construction');
  check(unsupported.state.renderers.length === 0, 'WebGLRenderer is never constructed without WebGL2');
}

{
  const harness = makeHarness(true);
  const { createLudo3DAdapter, isLudo3DSupported, VERSIONS } = harness.api;
  check(isLudo3DSupported() === true, 'official WebGL capability seam is used');
  check(Object.isFrozen(VERSIONS) && Object.isFrozen(VERSIONS.three) && Object.isFrozen(VERSIONS.gsap), 'pinned version record is frozen');
  check(VERSIONS.three.version === '0.185.1' && VERSIONS.gsap.version === '3.15.0', 'Three and GSAP versions remain pinned');
  expectCode(() => createLudo3DAdapter(null), 'LUDO3D_INVALID_OPTIONS', 'options are required');
  expectCode(() => createLudo3DAdapter({ onInput() {}, onContextLost() {} }), 'LUDO3D_INVALID_MOUNT_ELEMENT', 'mount element is required');
  expectCode(() => createLudo3DAdapter({ mountElement: new FakeElement(), onContextLost() {} }), 'LUDO3D_INVALID_ON_INPUT', 'input callback is required');
  expectCode(() => createLudo3DAdapter({ mountElement: new FakeElement(), onInput() {} }), 'LUDO3D_INVALID_ON_CONTEXT_LOST', 'context-loss callback is required');

  const inputs = [];
  const losses = [];
  const errors = [];
  let readyCalls = 0;
  const mount = new FakeElement();
  const adapter = createLudo3DAdapter(validOptions(mount, {
    onInput(command) { inputs.push(command); },
    onContextLost(reason) { losses.push(reason); },
    onError(error) { errors.push(error); },
    onReady() { readyCalls += 1; }
  }));
  check(Object.isFrozen(adapter), 'Adapter surface is immutable');
  check(JSON.stringify(Object.keys(adapter)) === JSON.stringify(['id', 'mount', 'render', 'motion', 'setQuality', 'environment', 'suspend', 'resume', 'contextLost', 'dispose']), 'Adapter exposes only the Foundation lifecycle Interface');
  check(adapter.id === 'ludo-three-r185', 'Adapter id is stable');
  check(adapter.mount({ quality: 'HIGH', reducedMotion: false }) === true, 'procedural board mounts');
  const renderer = harness.state.renderers[0];
  const canvas = renderer.domElement;
  check(readyCalls === 0 && !renderer.renderCount && canvas.style.pointerEvents === 'none', 'mount keeps fallback pointer access until a semantic frame renders');
  check(canvas.getAttribute('aria-hidden') === 'true' && canvas.tabIndex === -1, 'Three canvas is presentation-only for accessibility');
  check(harness.fakeThree.ColorManagement.enabled === true && renderer.outputColorSpace === 'srgb' && renderer.toneMapping === 'no-tone-mapping', 'colour output is explicit');
  check(renderer.pixelRatio === 2 && renderer.shadowMap.enabled === true, 'HIGH has capped DPR and the single shadow path');
  check(adapter.environment({ reducedMotion: false }, { reducedMotion: false }) === true && readyCalls === 0 && !renderer.renderCount && canvas.style.pointerEvents === 'none', 'pre-first-frame environment configuration succeeds without claiming readiness or rendering');

  check(adapter.render(ludoFrame(1, 2)) === true, 'two-player frame renders a procedural 52-track board');
  check(adapter.render(ludoFrame(2, 3)) === true, 'three-player frame keeps the Adapter data-driven');
  check(adapter.render(ludoFrame(3, 4)) === true, 'four-player frame keeps the Adapter data-driven');
  check(readyCalls === 1 && renderer.renderCount > 0 && canvas.style.pointerEvents === 'auto', 'only first successful semantic render announces ready and enables selection');
  check(renderer.lastScene.children.length >= 4 && harness.state.timelines.length >= 1, 'scene owns board, lights, read-only dice, and finite entrance motion');
  const entrance = harness.state.timelines[0];
  check(entrance.labels.map(item => item[0]).join(',') === 'entrance,settled' && entrance.children.length === 2, 'HIGH entrance is a bounded labeled camera timeline');

  canvas.dispatch('pointerdown', { clientX: 40, clientY: 40 });
  check(inputs.length === 1 && inputs[0].type === 'select_token' && inputs[0].tokenIndex === 0 && inputs[0].revision === 3, 'raycast emits only logical token selection with the current revision');
  check(!Object.prototype.hasOwnProperty.call(inputs[0], 'seat') && !Object.prototype.hasOwnProperty.call(inputs[0], 'dice'), 'raycast cannot emit player authority or dice commands');
  check(harness.state.raycastTargets && harness.state.raycastTargets.recursive === true && harness.state.raycastTargets.objects.length === 1, 'raycaster receives only currently selectable token objects');
  check(adapter.motion({ type: 'token_moved', revision: 3, seat: 0, tokenIndex: 0, path: [0] }) === false, 'non-canonical motion aliases are rejected');

  const captureFrame = ludoFrame(4, 4);
  captureFrame.board.pieces.find(piece => piece.seat === 0 && piece.tokenIndex === 0).position = 56;
  check(adapter.render(captureFrame) === true, 'post-capture frame supplies final home/base positions before presentation motion');
  check(adapter.motion({
    type: 'piece_moved', revision: 4, seat: 0, tokenIndex: 0, from: -1, path: [0, 1, 2, 3, 56], reachedHome: true,
    capturedTokens: [{ seat: 1, tokenIndex: 0, from: 16 }, { seat: 1, tokenIndex: 0, from: 16 }, { seat: 0, tokenIndex: 0, from: 4 }]
  }) === true, 'canonical motion owns move, capture, and finish sub-stages without a new message type');
  const movement = harness.state.timelines.at(-1);
  const capturedToken = findLudoToken(renderer.lastScene, 1, 0);
  const capturedStart = { x: capturedToken.position.x, y: capturedToken.position.y, z: capturedToken.position.z };
  const capturedScaleChildren = movement.children.filter(child => child.target === capturedToken.scale);
  check(entrance.killed >= 1 && movement.labels.map(item => item[0]).join(',') === 'focus,travel,capture,finish,restore,settled', 'HIGH motion restores camera/aim inside its finite labeled timeline');
  check(capturedScaleChildren.some(child => child.vars.x === 0.42 && child.position === 'capture') && capturedScaleChildren.some(child => child.vars.x === 1 && child.position === 'capture+=0.12'), 'capture substage rebounds every captured token to full scale without another message');
  check(typeof renderer.loop === 'function', 'render loop exists only while an active timeline exists');
  movement.complete();
  check(renderer.loop === null && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1 &&
    (capturedStart.x !== capturedToken.position.x || capturedStart.z !== capturedToken.position.z), 'capture and finish settle every temporary actor/captured pose at the final projection');

  check(adapter.motion({ type: 'piece_moved', revision: 4, seat: 0, tokenIndex: 0, from: -1, path: [0, 1], capturedTokens: [{ seat: 1, tokenIndex: 0, from: 15 }] }) === true, 'a second canonical capture motion can be interrupted safely');
  const interruptedMotion = harness.state.timelines.at(-1);
  check(adapter.render(ludoFrame(5, 4)) === true && interruptedMotion.killed >= 1 && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1, 'new frame interruption kills capture work and restores final poses');

  check(adapter.setQuality('BALANCED') === true && renderer.pixelRatio === 1.5 && renderer.shadowMap.enabled === false, 'BALANCED lowers DPR and disables shadows');
  adapter.motion({ type: 'piece_moved', revision: 5, seat: 0, tokenIndex: 0, from: -1, path: [0, 1] });
  const balanced = harness.state.timelines.at(-1);
  check(balanced.labels.map(item => item[0]).join(',') === 'focus,travel,restore,settled', 'BALANCED keeps the shared shortened focus/overview language with finite piece motion');
  balanced.complete();
  check(adapter.setQuality('HIGH') === true && adapter.motion({ type:'terminal', revision:5, winnerSeat:0 }) === true,
    'terminal semantic event starts the renderer-local result shot');
  const resultShot = harness.state.timelines.at(-1);
  check(resultShot.labels.map(item => item[0]).join(',') === 'read,podium,settled' && resultShot.children.length === 4,
    'result shot combines one camera read and one bounded winner-base pulse');
  resultShot.complete();
  check(renderer.loop === null, 'completed result shot holds a static pose without a persistent loop');
  const beforeLow = harness.state.timelines.length;
  check(adapter.setQuality('LOW') === true && renderer.pixelRatio === 1, 'LOW uses DPR one');
  adapter.motion({ type: 'piece_moved', revision: 5, seat: 0, tokenIndex: 0, from: -1, path: [0, 1], reachedHome: true, capturedTokens: [{ seat: 1, tokenIndex: 0, from: 12 }] });
  check(harness.state.timelines.length === beforeLow && renderer.loop === null && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1, 'LOW settles capture/finish without a timeline or persistent loop');
  check(adapter.motion({ type:'terminal', revision:5, winnerSeat:0 }) === true && harness.state.timelines.length === beforeLow,
    'LOW terminal reaches the same readable result pose without timeline work');
  check(adapter.setQuality('FALLBACK') === false, 'Adapter does not construct a Foundation fallback scene');

  check(adapter.setQuality('HIGH') === true && adapter.environment({ reducedMotion: true }) === true, 'reduced-motion environment is accepted');
  const beforeReduced = harness.state.timelines.length;
  adapter.motion({ type: 'piece_moved', revision: 5, seat: 0, tokenIndex: 0, from: -1, path: [0, 1], reachedHome: true, capturedTokens: [{ seat: 1, tokenIndex: 0, from: 12 }] });
  check(harness.state.timelines.length === beforeReduced && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1, 'reduced-motion capture/finish is static rather than slowed');
  check(adapter.environment({ reducedMotion: false }) === true, 'normal motion can be restored');
  adapter.motion({ type: 'piece_moved', revision: 5, seat: 0, tokenIndex: 0, from: -1, path: [0, 1], capturedTokens: [{ seat: 1, tokenIndex: 0, from: 12 }] });
  const suspendedMotion = harness.state.timelines.at(-1);
  check(adapter.suspend() === true && renderer.loop === null && suspendedMotion.killed >= 1 && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1 && canvas.style.pointerEvents === 'none', 'suspend kills composite motion and settles all temporary poses');
  canvas.dispatch('pointerdown', { clientX: 40, clientY: 40 });
  check(inputs.length === 1, 'suspended canvas cannot emit commands');
  check(adapter.resume() === true && renderer.loop === null && canvas.style.pointerEvents === 'auto', 'resume re-renders the settled current revision without reviving a stale timeline');

  adapter.motion({ type: 'piece_moved', revision: 5, seat: 0, tokenIndex: 0, from: -1, path: [0, 1], capturedTokens: [{ seat: 1, tokenIndex: 0, from: 12 }] });
  const lossMotion = harness.state.timelines.at(-1);
  let prevented = false;
  canvas.dispatch('webglcontextlost', { preventDefault() { prevented = true; } });
  check(prevented && losses.length === 1 && losses[0] === 'webglcontextlost', 'context loss prevents default and notifies once');
  check(lossMotion.killed >= 1 && renderer.loop === null && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1 && canvas.style.pointerEvents === 'none', 'context loss immediately removes visual/input ownership and temporary poses');
  check(adapter.render(ludoFrame(4, 2)) === false && adapter.contextLost() === true && losses.length === 1, 'lost Adapter is never reused');
  check(adapter.dispose() === true && adapter.dispose() === true && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1, 'dispose is idempotent and retains only settled transient state until release');
  check(renderer.disposed === 1 && mount.children.length === 0 && FakeResizeObserver.instances.some(observer => observer.disconnected), 'dispose releases renderer canvas and observer');
  check(harness.state.contextReverts === 1 && errors.length === 0, 'normal lifecycle reverts GSAP ownership without reporting errors');
}

{
  const harness = makeHarness(true, { throwRender: true });
  const mount = new FakeElement();
  const inputs = [];
  const errors = [];
  let ready = 0;
  const adapter = harness.api.createLudo3DAdapter(validOptions(mount, {
    onInput(command) { inputs.push(command); }, onContextLost() {}, onError(error) { errors.push(error); }, onReady() { ready += 1; }
  }));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const canvas = harness.state.renderers[0].domElement;
  check(adapter.render(ludoFrame(1, 2)) === false, 'pre-ready renderer error fails closed');
  canvas.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  check(ready === 0 && errors.length === 1 && inputs.length === 0 && canvas.style.pointerEvents === 'none', 'failed first render cannot steal fallback input');
  check(adapter.dispose() === true && harness.state.contextReverts === 1, 'failed Adapter still cleans local GSAP resources');
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createLudo3DAdapter(validOptions(mount, { onInput() {}, onContextLost() {}, onError() {}, onReady() {} }));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  adapter.render(ludoFrame(1, 4));
  adapter.motion({ type: 'piece_moved', revision: 1, seat: 0, tokenIndex: 0, from: -1, path: [0, 1], capturedTokens: [{ seat: 1, tokenIndex: 0, from: 12 }], reachedHome: true });
  const composite = harness.state.timelines.at(-1);
  const capturedToken = findLudoToken(harness.state.renderers[0].lastScene, 1, 0);
  check(adapter.dispose() === true && composite.killed >= 1 && capturedToken.scale.x === 1 && capturedToken.scale.y === 1 && capturedToken.scale.z === 1, 'dispose kills an in-flight capture/finish composite only after it is statically settled');
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  const adapter = harness.api.createLudo3DAdapter(validOptions(mount, { onInput() {}, onContextLost() {}, onError() {}, onReady() {} }));
  adapter.mount({ quality: 'LOW', reducedMotion: true });
  const twoDQuarterPoint = (x, y, turns) => {
    switch (((turns % 4) + 4) % 4) {
      case 1: return [-y, x];
      case 2: return [-x, -y];
      case 3: return [y, -x];
      default: return [x, y];
    }
  };
  const threeQuarterPoint = (x, z, turns) => {
    const angle = -turns * Math.PI / 2;
    return [Math.cos(angle) * x + Math.sin(angle) * z, -Math.sin(angle) * x + Math.cos(angle) * z];
  };
  const mappings = [
    { players: 2, pids: [0, 2] },
    { players: 3, pids: [0, 1, 2] },
    { players: 4, pids: [0, 1, 2, 3] }
  ];
  let revision = 1;
  mappings.forEach(mapping => {
    mapping.pids.forEach((pid, seat) => {
      const turns = (3 - pid + 4) % 4;
      const frame = ludoFrame(revision++, mapping.players, false);
      frame.view.quarterTurns = turns;
      check(adapter.render(frame) === true, `${mapping.players}-player seat ${seat} accepts its near-side presentation frame`);
      const board = harness.state.renderers[0].lastScene.children[3];
      const pointPairs = [[2.1, -3.4], [-4.2, 1.7], [0.8, 5.6]];
      const sameDirection = pointPairs.every(([x, y]) => {
        const twoD = twoDQuarterPoint(x, y, turns);
        const threeD = threeQuarterPoint(x, y, turns);
        return Math.abs(twoD[0] - threeD[0]) < 1e-8 && Math.abs(twoD[1] - threeD[1]) < 1e-8;
      });
      check(Math.abs(board.rotation.y + turns * Math.PI / 2) < 1e-8 && sameDirection, `${mapping.players}-player seat ${seat} uses the TabletopPerspective clockwise-equivalent Three rotation`);
    });
  });
  check((3 - 2 + 4) % 4 === 1, 'two-player seat 1 maps PID 2 to its required near-side quarter turn');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement();
  let firstReady = 0;
  const first = harness.api.createLudo3DAdapter(validOptions(mount, { onInput() {}, onContextLost() {}, onError() {}, onReady() { firstReady += 1; } }));
  first.mount({ quality: 'HIGH', reducedMotion: false });
  first.render(ludoFrame(1, 2));
  const firstEntrance = harness.state.timelines.at(-1);
  check(first.dispose() === true && firstEntrance.killed >= 1, 'dispose kills in-flight entrance before a fresh recovery Adapter');
  let recoveredReady = 0;
  const recovered = harness.api.createLudo3DAdapter(validOptions(mount, { onInput() {}, onContextLost() {}, onError() {}, onReady() { recoveredReady += 1; } }));
  check(recovered.mount({ quality: 'HIGH', reducedMotion: false }) === true && recoveredReady === 0, 'fresh recovery remains unready through mount');
  check(recovered.render(ludoFrame(1, 3)) === true && firstReady === 1 && recoveredReady === 1, 'fresh recovery announces only after its own first render');
  recovered.dispose();
}

console.log(`ALL_PASS ludo-ghost3d-renderer assertions=${assertions}`);
