'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'gomoku-entry.js');
const ENTRY_SOURCE = fs.readFileSync(ENTRY, 'utf8');

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
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
    const handlers = this.listeners.get(type);
    if (!handlers) return;
    Array.from(handlers).forEach(handler => handler(event || {}));
  }
}

class FakeElement extends FakeEventTarget {
  constructor(width = 300, height = 300) {
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

  copy(value) {
    return this.set(value.x, value.y, value.z);
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

  worldToLocal(vector) {
    const angle = -(this.rotation.y || 0);
    const cosine = Math.cos(angle);
    const sine = Math.sin(angle);
    const x = vector.x - this.position.x;
    const z = vector.z - this.position.z;
    vector.x = cosine * x + sine * z;
    vector.z = -sine * x + cosine * z;
    vector.y -= this.position.y;
    return vector;
  }
}

class FakeScene extends FakeObject3D {
  clear() {
    this.children.length = 0;
    this.cleared = true;
  }
}

class FakePerspectiveCamera extends FakeObject3D {
  constructor() {
    super();
    this.aspect = 1;
  }

  updateProjectionMatrix() {
    this.projectionUpdates = (this.projectionUpdates || 0) + 1;
  }

  lookAt(target) {
    this.lookAtTarget = target.clone ? target.clone() : target;
  }
}

class FakeGroup extends FakeObject3D {}

class FakeGeometry {
  constructor(...args) {
    this.args = args;
  }

  setAttribute(name, value) {
    if (!this.attributes) this.attributes = {};
    this.attributes[name] = value;
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

class FakeLineSegments extends FakeObject3D {
  constructor(geometry, material) {
    super();
    this.geometry = geometry;
    this.material = material;
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

class FakeFloat32BufferAttribute {
  constructor(values, size) {
    this.values = values;
    this.size = size;
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
  const gsap = {
    context(callback, scope) {
      callback();
      const context = {
        scope,
        add(fn) {
          fn();
        },
        revert() {
          this.reverted = true;
          state.contextReverts += 1;
        }
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
        paused: 0,
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
        pause() {
          this.paused += 1;
          return this;
        },
        kill() {
          this.killed += 1;
          return this;
        },
        complete() {
          this.children.forEach(child => {
            ['x', 'y', 'z', 'scale'].forEach(key => {
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
  return gsap;
}

function makeHarness(supported, options) {
  options = options || {};
  const state = {
    renderers: [],
    timelines: [],
    killedTargets: [],
    contexts: [],
    contextReverts: 0,
    raycastPoint: null,
    raycastObject: null,
    throwRender: options.throwRender === true
  };
  class FakeWebGLRenderer {
    constructor(options) {
      this.options = options;
      this.domElement = new FakeCanvas();
      this.shadowMap = {};
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
  class FakeRaycaster {
    setFromCamera(pointer, camera) {
      this.pointer = { x: pointer.x, y: pointer.y };
      this.camera = camera;
    }

    intersectObject(object, recursive) {
      state.raycastObject = { object, recursive };
      return state.raycastPoint ? [{ point: state.raycastPoint.clone() }] : [];
    }
  }
  const fakeThree = {
    ColorManagement: { enabled: false },
    SRGBColorSpace: 'srgb',
    NoToneMapping: 'no-tone-mapping',
    PCFSoftShadowMap: 'pcf-soft-shadow-map',
    WebGLRenderer: FakeWebGLRenderer,
    Scene: FakeScene,
    PerspectiveCamera: FakePerspectiveCamera,
    Vector2: FakeVector2,
    Vector3: FakeVector3,
    Raycaster: FakeRaycaster,
    HemisphereLight: FakeHemisphereLight,
    DirectionalLight: FakeDirectionalLight,
    Group: FakeGroup,
    BoxGeometry: FakeGeometry,
    BufferGeometry: FakeGeometry,
    Float32BufferAttribute: FakeFloat32BufferAttribute,
    LineBasicMaterial: FakeMaterial,
    LineSegments: FakeLineSegments,
    SphereGeometry: FakeGeometry,
    MeshStandardMaterial: FakeMaterial,
    Mesh: FakeMesh,
    PlaneGeometry: FakeGeometry,
    MeshBasicMaterial: FakeMaterial,
    CylinderGeometry: FakeGeometry,
    Color: FakeColor
  };
  const fakeWindow = new FakeEventTarget();
  fakeWindow.devicePixelRatio = 3;
  const module = { exports: {} };
  const transformed = ENTRY_SOURCE
    .replace("import * as THREE from '../vendor/three/r185/build/three.module.js';", 'const THREE = __THREE__;')
    .replace("import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';", 'const WebGL = __WEBGL__;')
    .replace("import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';", 'const gsap = __GSAP__;')
    .replace('export const VERSIONS', 'const VERSIONS')
    .replace('export function isGomoku3DSupported', 'function isGomoku3DSupported')
    .replace('export function createGomoku3DAdapter', 'function createGomoku3DAdapter')
    .concat('\nmodule.exports = { VERSIONS, isGomoku3DSupported, createGomoku3DAdapter };\n');
  const sandbox = {
    module,
    exports: module.exports,
    __THREE__: fakeThree,
    __WEBGL__: { isWebGL2Available: () => supported },
    __GSAP__: makeGsap(state),
    window: fakeWindow,
    ResizeObserver: FakeResizeObserver,
    console
  };
  vm.runInNewContext(transformed, sandbox, { filename: ENTRY });
  return { api: module.exports, state, fakeThree };
}

function validOptions(mountElement, callbacks) {
  return {
    mountElement,
    onInput: callbacks.onInput,
    onContextLost: callbacks.onContextLost,
    onError: callbacks.onError,
    onReady: callbacks.onReady,
    quality: 'HIGH'
  };
}

{
  const unsupported = makeHarness(false);
  check(unsupported.api.isGomoku3DSupported() === false, 'capability function reports false without WebGL2');
  expectCode(() => unsupported.api.createGomoku3DAdapter(validOptions(new FakeElement(), {
    onInput() {}, onContextLost() {}, onError() {}
  })), 'GOMOKU3D_WEBGL2_UNAVAILABLE', 'unsupported capability throws a stable pre-construction error');
  check(unsupported.state.renderers.length === 0, 'WebGLRenderer is never constructed when capability gate fails');
}

{
  const harness = makeHarness(true);
  const { createGomoku3DAdapter, isGomoku3DSupported, VERSIONS } = harness.api;
  check(isGomoku3DSupported() === true, 'capability function reports WebGL2 support from the official-addon seam');
  check(Object.isFrozen(VERSIONS) && Object.isFrozen(VERSIONS.three) && Object.isFrozen(VERSIONS.gsap), 'version contract is deeply frozen');
  check(VERSIONS.three.version === '0.185.1' && VERSIONS.gsap.version === '3.15.0', 'version contract pins Three and GSAP');
  expectCode(() => createGomoku3DAdapter(null), 'GOMOKU3D_INVALID_OPTIONS', 'options are validated');
  expectCode(() => createGomoku3DAdapter({ onInput() {}, onContextLost() {} }), 'GOMOKU3D_INVALID_MOUNT_ELEMENT', 'mount element is validated');
  expectCode(() => createGomoku3DAdapter({ mountElement: new FakeElement(), onContextLost() {} }), 'GOMOKU3D_INVALID_ON_INPUT', 'input callback is validated');
  expectCode(() => createGomoku3DAdapter({ mountElement: new FakeElement(), onInput() {} }), 'GOMOKU3D_INVALID_ON_CONTEXT_LOST', 'context callback is validated');

  const inputs = [];
  const losses = [];
  const errors = [];
  let readyCalls = 0;
  const mount = new FakeElement(360, 300);
  const adapter = createGomoku3DAdapter(validOptions(mount, {
    onInput(command) { inputs.push(command); },
    onContextLost(payload) { losses.push(payload); },
    onError(error) { errors.push(error); },
    onReady() { readyCalls += 1; }
  }));
  check(Object.isFrozen(adapter), 'adapter surface is immutable');
  check(JSON.stringify(Object.keys(adapter)) === JSON.stringify([
    'id', 'mount', 'render', 'motion', 'setQuality', 'environment', 'suspend', 'resume', 'contextLost', 'dispose'
  ]), 'adapter exposes exactly the Foundation lifecycle shape');
  check(adapter.id === 'gomoku-three-r185', 'adapter provides a stable renderer id');
  check(adapter.mount({ quality: 'HIGH', reducedMotion: false }) === true, 'adapter mounts procedural Three scene');

  const renderer = harness.state.renderers[0];
  const canvas = renderer.domElement;
  check(readyCalls === 0 && !renderer.renderCount && canvas.style.pointerEvents === 'none', 'mount/configuration keep readiness and 3D pointer access disabled before a semantic frame renders');
  canvas.dispatch('pointermove', { clientX: 80, clientY: 90 });
  check(inputs.length === 0, 'an unrendered 3D canvas cannot preempt the retained fallback input surface');
  check(mount.children[0] === canvas, 'adapter owns and mounts a renderer canvas');
  check(canvas.getAttribute('aria-hidden') === 'true' && canvas.tabIndex === -1, 'renderer canvas is excluded from the DOM accessibility tree');
  check(harness.fakeThree.ColorManagement.enabled === true, 'color management is explicitly enabled');
  check(renderer.outputColorSpace === 'srgb' && renderer.toneMapping === 'no-tone-mapping', 'output color space and tone mapping are explicit');
  check(renderer.pixelRatio === 2 && renderer.shadowMap.enabled === true, 'HIGH caps DPR at two and enables the single shadow path');

  const board = {
    size: 15,
    stones: [{ row: 3, col: 4, player: 0 }, { row: 7, col: 7, player: 1 }],
    lastMove: { row: 3, col: 4, player: 0 },
    winningLine: []
  };
  check(adapter.render({ revision: 1, board, view: { quarterTurns: 1 } }) === true, 'bridge-shaped frame renders a procedural 15x15 board and stones');
  check(readyCalls === 1 && renderer.renderCount > 0 && canvas.style.pointerEvents === 'auto', 'the first successful semantic render announces readiness and enables private pointer input exactly once');
  const entranceTimeline = harness.state.timelines.at(-1);
  check(entranceTimeline.children.length === 2 && entranceTimeline.labels.map(item => item[0]).join(',') === 'entrance,settled', 'HIGH first render uses a labeled camera-entrance timeline with only camera and aim targets');
  check(typeof renderer.loop === 'function', 'camera entrance enables the renderer loop only while that finite timeline is active');
  check(renderer.lastScene.children.length >= 4, 'scene includes board plus hemisphere and directional lighting');

  // With one clockwise board turn, local cell (3,4) maps to world (-4,3).
  harness.state.raycastPoint = new FakeVector3(-4, 0.045, 3);
  canvas.dispatch('pointermove', { clientX: 80, clientY: 90 });
  canvas.dispatch('pointerdown', { clientX: 80, clientY: 90 });
  canvas.dispatch('pointerleave', {});
  check(inputs.length === 3, 'pointer input emits aim, selection, and clear through the semantic callback');
  check(inputs[0].type === 'aim_cell' && inputs[0].row === 3 && inputs[0].col === 4 && inputs[0].revision === 1, 'raycast maps world space back through the rotated board group');
  check(inputs[1].type === 'select_cell' && inputs[1].row === 3 && inputs[1].col === 4 && inputs[1].revision === 1, 'pointer selection carries only a logical cell and revision');
  check(inputs[2].type === 'clear_aim' && inputs[2].revision === 1, 'pointer leave clears aim without a cell payload');
  check(harness.state.raycastObject && harness.state.raycastObject.recursive === false, 'raycaster targets only the private pick plane');

  check(adapter.motion({ type: 'piece_placed', row: 3, col: 4, revision: 1 }) === true, 'semantic placement creates a HIGH renderer-owned motion');
  const highTimeline = harness.state.timelines.at(-1);
  check(entranceTimeline.killed >= 1, 'a newly arrived placement interrupts and kills the active first-camera entrance timeline');
  check(highTimeline.children.length === 3, 'HIGH motion stays inside the three-child camera/aim/stone timeline budget');
  check(highTimeline.labels.map(item => item[0]).join(',') === 'focus,place,settled', 'HIGH motion uses labeled GSAP timeline positions');
  check(typeof renderer.loop === 'function', 'continuous renderer loop runs only while a timeline is active');
  highTimeline.complete();
  check(renderer.loop === null, 'renderer loop stops when motion settles');

  check(adapter.setQuality('BALANCED') === true, 'quality can switch to BALANCED');
  check(renderer.pixelRatio === 1.5 && renderer.shadowMap.enabled === false, 'BALANCED caps DPR and disables shadows');
  adapter.motion({ type: 'piece_placed', row: 3, col: 4, revision: 1 });
  const balancedTimeline = harness.state.timelines.at(-1);
  check(balancedTimeline.children.length === 1, 'BALANCED motion is stone-only');
  balancedTimeline.complete();

  const beforeLow = harness.state.timelines.length;
  check(adapter.setQuality('LOW') === true, 'quality can switch to LOW');
  check(renderer.pixelRatio === 1, 'LOW uses DPR one');
  adapter.motion({ type: 'piece_placed', row: 3, col: 4, revision: 1 });
  check(harness.state.timelines.length === beforeLow, 'LOW uses static final poses and creates no GSAP timeline');
  check(renderer.loop === null, 'LOW has no continuous rendering loop');
  check(adapter.setQuality('FALLBACK') === false, 'adapter does not construct or emulate a FALLBACK scene');

  check(adapter.setQuality('HIGH') === true, 'quality can restore HIGH without rebuilding authority data');
  check(adapter.environment({ reducedMotion: true }) === true, 'environment accepts reduced-motion state');
  const beforeReduced = harness.state.timelines.length;
  adapter.motion({ type: 'piece_placed', row: 3, col: 4, revision: 1 });
  check(harness.state.timelines.length === beforeReduced, 'reduced motion remains static rather than slowing animation');
  check(adapter.environment({ reducedMotion: false }) === true, 'environment can restore normal motion');
  adapter.motion({ type: 'piece_placed', row: 3, col: 4, revision: 1 });
  const suspendTimeline = harness.state.timelines.at(-1);
  check(typeof renderer.loop === 'function', 'new active HIGH timeline starts the renderer loop');
  check(adapter.suspend() === true && renderer.loop === null && suspendTimeline.paused === 1, 'suspend pauses local motion, input, and renderer loop');
  const inputCountBeforeSuspendPointer = inputs.length;
  canvas.dispatch('pointermove', { clientX: 80, clientY: 90 });
  check(inputs.length === inputCountBeforeSuspendPointer, 'suspended renderer cannot emit pointer commands');
  check(adapter.resume() === true && typeof renderer.loop === 'function' && suspendTimeline.played >= 2, 'resume only continues the current revision motion');
  suspendTimeline.complete();

  adapter.motion({ type: 'piece_placed', row: 3, col: 4, revision: 1 });
  const contextLossTimeline = harness.state.timelines.at(-1);
  let prevented = false;
  canvas.dispatch('webglcontextlost', { preventDefault() { prevented = true; } });
  check(prevented === true, 'context-loss handler prevents the browser default');
  check(losses.length === 1 && losses[0] === 'webglcontextlost', 'context loss reaches the Foundation callback exactly once');
  check(contextLossTimeline.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none', 'context loss kills active GSAP work and immediately restores pointer/fallback safety');
  check(adapter.render({ revision: 2, board, view: { quarterTurns: 0 } }) === false, 'lost renderer is not reused');
  const inputCountBeforeLostPointer = inputs.length;
  canvas.dispatch('pointerdown', { clientX: 80, clientY: 90 });
  check(inputs.length === inputCountBeforeLostPointer, 'context loss removes pointer access');
  check(adapter.contextLost() === true && losses.length === 1, 'explicit context loss is idempotent after canvas loss');

  check(adapter.dispose() === true, 'dispose releases adapter-owned resources');
  check(adapter.dispose() === true, 'dispose is idempotent');
  check(renderer.disposed === 1 && mount.children.length === 0, 'renderer and owned canvas are released exactly once');
  check(FakeResizeObserver.instances.some(observer => observer.disconnected === true), 'ResizeObserver is disconnected during teardown');
  check(harness.state.contextReverts === 1, 'adapter-local GSAP context is reverted during teardown');
  check(errors.length === 0, 'normal lifecycle never reports an adapter callback error');
}

{
  const harness = makeHarness(true, { throwRender: true });
  const mount = new FakeElement(320, 280);
  const inputs = [];
  const errors = [];
  let readyCalls = 0;
  const adapter = harness.api.createGomoku3DAdapter(validOptions(mount, {
    onInput(command) { inputs.push(command); },
    onContextLost() {},
    onError(error) { errors.push(error); },
    onReady() { readyCalls += 1; }
  }));
  check(adapter.mount({ quality: 'HIGH', reducedMotion: false }) === true, 'a failure harness mounts without treating an empty canvas as ready');
  const canvas = harness.state.renderers[0].domElement;
  check(adapter.render({ revision: 1, board: { size: 15, stones: [], winningLine: [] }, view: { quarterTurns: 0 } }) === false, 'a renderer exception reports failure instead of claiming a first render');
  canvas.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  check(readyCalls === 0 && errors.length === 1 && inputs.length === 0 && canvas.style.pointerEvents === 'none', 'render failure before first frame never announces ready or steals fallback pointer input');
  check(adapter.dispose() === true && harness.state.contextReverts === 1, 'failed pre-ready adapters still kill/revert their local GSAP ownership during disposal');
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement(320, 280);
  const inputs = [];
  const errors = [];
  let readyCalls = 0;
  const adapter = harness.api.createGomoku3DAdapter(validOptions(mount, {
    onInput(command) { inputs.push(command); },
    onContextLost() {},
    onError(error) { errors.push(error); },
    onReady() { readyCalls += 1; }
  }));
  adapter.mount({ quality: 'HIGH', reducedMotion: false });
  const canvas = harness.state.renderers[0].domElement;
  adapter.render({ revision: 1, board: { size: 15, stones: [], winningLine: [] }, view: { quarterTurns: 0 } });
  harness.state.throwRender = true;
  check(adapter.render({ revision: 2, board: { size: 15, stones: [], winningLine: [] }, view: { quarterTurns: 0 } }) === false, 'a later renderer exception fail-closes an already-ready 3D surface');
  harness.state.raycastPoint = new FakeVector3(0, 0.045, 0);
  canvas.dispatch('pointerdown', { clientX: 20, clientY: 20 });
  check(readyCalls === 1 && errors.length === 1 && inputs.length === 0 && canvas.style.pointerEvents === 'none', 'post-ready render failure restores fallback pointer safety without a second readiness callback');
  adapter.dispose();
}

{
  const harness = makeHarness(true);
  const mount = new FakeElement(300, 300);
  let firstReady = 0;
  const first = harness.api.createGomoku3DAdapter(validOptions(mount, {
    onInput() {}, onContextLost() {}, onError() {}, onReady() { firstReady += 1; }
  }));
  first.mount({ quality: 'HIGH', reducedMotion: false });
  first.render({ revision: 1, board: { size: 15, stones: [], winningLine: [] }, view: { quarterTurns: 0 } });
  const firstEntrance = harness.state.timelines.at(-1);
  check(first.dispose() === true && firstEntrance.killed >= 1 && harness.state.contextReverts === 1, 'dispose kills an in-flight first-camera timeline before reverting its local GSAP context');

  let recoveredReady = 0;
  const recovered = harness.api.createGomoku3DAdapter(validOptions(mount, {
    onInput() {}, onContextLost() {}, onError() {}, onReady() { recoveredReady += 1; }
  }));
  check(recovered.mount({ quality: 'HIGH', reducedMotion: false }) === true && recoveredReady === 0, 'a fresh recovery adapter remains unready through mount/configuration');
  check(recovered.render({ revision: 1, board: { size: 15, stones: [], winningLine: [] }, view: { quarterTurns: 0 } }) === true && firstReady === 1 && recoveredReady === 1, 'a fresh recovery adapter can announce readiness again only after its own first successful render');
  recovered.dispose();
}

{
  ['LOW', 'HIGH'].forEach((quality, index) => {
    const harness = makeHarness(true);
    const mount = new FakeElement(300, 300);
    let readyCalls = 0;
    const adapter = harness.api.createGomoku3DAdapter({
      ...validOptions(mount, { onInput() {}, onContextLost() {}, onError() {}, onReady() { readyCalls += 1; } }),
      quality,
      reducedMotion: index === 1
    });
    adapter.mount({ quality, reducedMotion: index === 1 });
    check(adapter.render({ revision: 1, board: { size: 15, stones: [], winningLine: [] }, view: { quarterTurns: 0 } }) === true, `${quality}${index === 1 ? ' reduced-motion' : ''} first frame renders a static settled pose`);
    const renderer = harness.state.renderers[0];
    check(readyCalls === 1 && harness.state.timelines.length === 0 && !renderer.loop, `${quality}${index === 1 ? ' reduced-motion' : ''} creates no entrance tween or persistent render loop`);
    adapter.dispose();
  });
}

console.log(`ALL_PASS gomoku-ghost3d-renderer assertions=${assertions}`);
