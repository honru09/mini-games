'use strict';

/* Tank P5 renderer boundary and real-time performance contract. */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'tank-entry.js');
let assertions = 0;
let failures = 0;

function check(value, message) {
  assertions += 1;
  try { assert.ok(value, message); console.log('PASS  ' + message); }
  catch (_error) { failures += 1; console.error('FAIL  ' + message); }
}
function section(text, start, end) {
  const from = text.indexOf(start);
  const to = from < 0 ? -1 : text.indexOf(end, from + start.length);
  return from < 0 ? '' : text.slice(from, to < 0 ? text.length : to);
}

const exists = fs.existsSync(ENTRY);
check(exists, 'Tank P5 Three entry exists');
const source = exists ? fs.readFileSync(ENTRY, 'utf8') : '';

if (source) {
  const exported = Array.from(source.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/gm), row => row[1]);
  const renderBody = section(source, 'function render(', 'function motion(');
  const animationHotPath = section(source, 'function updateTankObjects()', 'function clearFx()');
  check(JSON.stringify(exported) === JSON.stringify(['isTank3DSupported', 'createTank3DAdapter']),
    'entry exports only support predicate and Tank Renderer factory');
  check(!/^export\s+default/m.test(source), 'entry has no default/compatibility renderer export');
  check(/new THREE\.InstancedMesh/.test(source) && /\b5\b/.test(source) && /\b128\b/.test(source) && /\b221\b/.test(source),
    'procedural renderer declares bounded terrain, five-tank, and 128-projectile pools');
  check(/from(?:Pose|World|State)/.test(source) && /target(?:Pose|World|State)/.test(source) &&
    /90/.test(source) && /setAnimationLoop/.test(source),
    'real-time interpolation owns bounded private source/target poses without extrapolation');
  check(!/gsap\.timeline|new THREE\.(?:Mesh|BoxGeometry|MeshStandardMaterial|Texture)/.test(renderBody),
    'per-packet render path allocates neither GSAP timelines nor Three resources');
  check(!/scenePoint\s*\(|\.forEach\s*\(/.test(animationHotPath),
    '60fps Tank interpolation path avoids per-frame coordinate objects and callback allocation');
  check(/TabletopCameraRig/.test(source) && /['"]tank['"]/.test(source) && /OrthographicCamera/.test(source),
    'renderer consumes the shared Tank orthographic camera vocabulary with a local fallback');
  check(/gsap\.timeline/.test(source) && /tank_move|tank_ko|tank_hit|tank_fire|tank_spawn|terminal/.test(source),
    'finite GSAP feedback is attached only to approved semantic and terminal events');
  check(/['"]entrance['"]/.test(source) && /['"]action-follow['"]/.test(source) && /['"]impact['"]/.test(source) &&
    /['"]overview['"]/.test(source) && /['"]result['"]/.test(source),
    'entry, follow, impact, overview, and result camera modes are explicit');
  check(/HIGH/.test(source) && /BALANCED/.test(source) && /LOW/.test(source) && /reducedMotion/.test(source),
    'renderer has explicit quality and reduced-motion branches');
  check(/0\.12|120/.test(source) && /0\.18|180/.test(source) && /0\.26|260/.test(source),
    'finite feedback uses only approved motion-token durations');
  check(/activeMotion/.test(source) && /kill\(/.test(source) && /suspend/.test(source) && /resume/.test(source),
    'new state and lifecycle transitions cancel renderer-owned finite motion');
  check(/webglcontextlost/.test(source) && /ResizeObserver/.test(source) && /requestAnimationFrame/.test(source) && /dispose/.test(source),
    'context, resize, and disposal lifecycle paths are explicitly owned');
  check(/aria-hidden/.test(source) && /role.*presentation|presentation.*role/.test(source) &&
    /pointerEvents\s*=\s*['"]none['"]/.test(source),
    'canvas is permanently hidden from accessibility and pointer-transparent');
  check(!/\b(?:onInput|emitInput|Raycaster|pointerdown|pointermove|keydown|touchstart|sendTankInput|sendMove)\b/.test(source),
    'renderer owns no game input, pointer handling, raycast, or transport seam');
  [
    'GLTFLoader', 'DRACOLoader', 'KTX2Loader', 'TextureLoader', 'ScrollTrigger', 'CSSPlugin',
    'registerPlugin', 'repeat:', 'yoyo:', 'fetch(', 'XMLHttpRequest', 'localStorage', 'asset_manifest',
    'tank-art-p1', 'ART-035', 'WebSocket', 'reward', 'coins', 'replay', 'aiChoose'
  ].forEach(token => check(!source.includes(token), 'renderer excludes unapproved dependency or authority concern: ' + token));
  check(!/\.style\.(?:width|height|top|left|margin|padding)\s*=/.test(source),
    'renderer does not animate or own DOM layout properties');
}

/* The real ESM adapter is exercised below in an isolated VM.  Only the three
 * static vendor imports are rewritten inside this test process; the browser
 * module itself exposes no test hook. */
class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, handler) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(handler); }
  removeEventListener(type, handler) { const handlers = this.listeners.get(type); if (handlers) handlers.delete(handler); }
  dispatch(type, event) { (this.listeners.get(type) || new Set()).forEach(handler => handler(event || {})); }
  listenerCount(type) { return type ? (this.listeners.get(type) || new Set()).size : Array.from(this.listeners.values()).reduce((total, handlers) => total + handlers.size, 0); }
}

class FakeElement extends FakeEventTarget {
  constructor(width, height) {
    super();
    this.children = [];
    this.parentNode = null;
    this.clientWidth = width || 420;
    this.clientHeight = height || 360;
    this.style = {};
    this.attributes = new Map();
    this.tabIndex = 0;
  }
  appendChild(child) { this.children.push(child); child.parentNode = this; return child; }
  removeChild(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parentNode = null; return child; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  getBoundingClientRect() { return { left:0, top:0, width:this.clientWidth, height:this.clientHeight }; }
}

class FakeCanvas extends FakeElement {}
class FakeVector3 {
  constructor(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
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
    this.userData = {};
    this.visible = true;
    this.matrix = {};
  }
  add(...children) { children.forEach(child => { child.parent = this; this.children.push(child); }); }
  remove(child) { const index = this.children.indexOf(child); if (index >= 0) this.children.splice(index, 1); child.parent = null; }
  traverse(visitor) { visitor(this); this.children.forEach(child => child.traverse ? child.traverse(visitor) : visitor(child)); }
  updateMatrix() { this.matrix = { x:this.position.x, y:this.position.y, z:this.position.z, sx:this.scale.x, sy:this.scale.y, sz:this.scale.z }; }
}
class FakeScene extends FakeObject3D { clear() { this.children.length = 0; this.cleared = true; } }
class FakeCamera extends FakeObject3D {
  updateProjectionMatrix() { this.projectionUpdates = (this.projectionUpdates || 0) + 1; }
  lookAt(target) { this.lookTarget = target && target.clone ? target.clone() : target; }
}
class FakeGroup extends FakeObject3D {}
class FakeGeometry {
  constructor(type, args) { this.type = type; this.args = args || []; }
  dispose() { this.disposed = (this.disposed || 0) + 1; }
}
class FakeColor {
  constructor(value) { this.value = value; }
  setHex(value) { this.value = value; }
}
class FakeMaterial {
  constructor(options) {
    this.options = options || {};
    this.color = new FakeColor(this.options.color);
    this.emissive = new FakeColor(this.options.emissive);
    this.emissiveIntensity = this.options.emissiveIntensity || 0;
    this.opacity = this.options.opacity === undefined ? 1 : this.options.opacity;
  }
  dispose() { this.disposed = (this.disposed || 0) + 1; }
}
class FakeMesh extends FakeObject3D {
  constructor(geometry, material) { super(); this.geometry = geometry; this.material = material; this.isMesh = true; }
}
class FakeInstancedMesh extends FakeMesh {
  constructor(geometry, material, capacity) {
    super(geometry, material);
    this.capacity = capacity;
    this.count = capacity;
    this.instanceMatrix = { needsUpdate:false, setUsage:value => { this.matrixUsage = value; } };
    this.instanceColor = { needsUpdate:false };
    this.matrices = [];
    this.colors = [];
  }
  setMatrixAt(index, matrix) { this.matrices[index] = Object.assign({}, matrix); }
  setColorAt(index, color) { this.colors[index] = color && color.value; }
}
class FakeHemisphereLight extends FakeObject3D {}
class FakeDirectionalLight extends FakeObject3D {}
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
        config:config || {}, children:[], labels:new Map(), killed:0, data:null,
        addLabel(name, position) { this.labels.set(name, position); return this; },
        to(target, vars, position) {
          const start = {};
          Object.keys(vars).forEach(key => { if (typeof vars[key] === 'number') start[key] = target[key]; });
          this.children.push({ target, vars, start, position });
          return this;
        },
        kill() { this.killed += 1; return this; },
        mutate(values) {
          Object.keys(values || {}).forEach(key => {
            const child = this.children.find(entry => Object.prototype.hasOwnProperty.call(entry.target, key));
            if (child) child.target[key] = values[key];
          });
          return this;
        },
        complete() {
          this.children.forEach(child => Object.keys(child.vars).forEach(key => {
            if (typeof child.vars[key] === 'number') child.target[key] = child.vars[key];
          }));
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
  const settings = options || {};
  FakeResizeObserver.instances = [];
  const state = { renderers:[], timelines:[], cameraPlans:[], killedTargets:[], contexts:[], contextReverts:0, animationFrames:[], cancelledFrames:[], now:0, throwRender:settings.throwRender === true };
  state.flushFrames = () => { const tasks = state.animationFrames.splice(0); tasks.forEach(task => task.callback()); };
  class FakeWebGLRenderer {
    constructor(rendererOptions) {
      this.options = rendererOptions;
      this.domElement = new FakeCanvas();
      this.shadowMap = {};
      this.renderLists = { dispose:() => { this.renderListsDisposed = (this.renderListsDisposed || 0) + 1; } };
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
    ColorManagement:{ enabled:false }, SRGBColorSpace:'srgb', NoToneMapping:'no-tone-mapping', PCFShadowMap:'pcf-shadow-map', DynamicDrawUsage:'dynamic',
    WebGLRenderer:FakeWebGLRenderer, Scene:FakeScene, OrthographicCamera:FakeCamera, Vector3:FakeVector3, HemisphereLight:FakeHemisphereLight, DirectionalLight:FakeDirectionalLight,
    PlaneGeometry:class extends FakeGeometry { constructor(...args) { super('PlaneGeometry', args); } },
    BoxGeometry:class extends FakeGeometry { constructor(...args) { super('BoxGeometry', args); } },
    SphereGeometry:class extends FakeGeometry { constructor(...args) { super('SphereGeometry', args); } },
    CylinderGeometry:class extends FakeGeometry { constructor(...args) { super('CylinderGeometry', args); } },
    TorusGeometry:class extends FakeGeometry { constructor(...args) { super('TorusGeometry', args); } },
    MeshStandardMaterial:FakeMaterial, MeshBasicMaterial:FakeMaterial, Mesh:FakeMesh, InstancedMesh:FakeInstancedMesh, Group:FakeGroup, Object3D:FakeObject3D, Color:FakeColor
  };
  const fakeWindow = new FakeEventTarget();
  fakeWindow.devicePixelRatio = 3;
  fakeWindow.TabletopCameraRig = Object.freeze({ plan(gameId, mode, target, config) {
    state.cameraPlans.push({ gameId, mode, target, config });
    return null;
  } });
  let nextFrame = 0;
  fakeWindow.requestAnimationFrame = callback => { const id = ++nextFrame; state.animationFrames.push({ id, callback }); return id; };
  fakeWindow.cancelAnimationFrame = id => { state.cancelledFrames.push(id); const index = state.animationFrames.findIndex(task => task.id === id); if (index >= 0) state.animationFrames.splice(index, 1); };
  const module = { exports:{} };
  const transformed = source
    .replace("import * as THREE from '../vendor/three/r185/build/three.module.js';", 'const THREE = __THREE__;')
    .replace("import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';", 'const WebGL = __WEBGL__;')
    .replace("import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';", 'const gsap = __GSAP__;')
    .replace('export function isTank3DSupported', 'function isTank3DSupported')
    .replace('export function createTank3DAdapter', 'function createTank3DAdapter')
    .concat('\nmodule.exports = { isTank3DSupported, createTank3DAdapter };\n');
  vm.runInNewContext(transformed, {
    module, exports:module.exports, __THREE__:fakeThree, __WEBGL__:{ isWebGL2Available:() => supported }, __GSAP__:makeGsap(state),
    window:fakeWindow, performance:{ now:() => state.now }, ResizeObserver:FakeResizeObserver, Promise, Date, Math, Number, Object, Array, Set, Error, console
  }, { filename:ENTRY });
  return { api:module.exports, state, fakeThree, window:fakeWindow };
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.keys(value).forEach(key => deepFreeze(value[key]));
  return Object.freeze(value);
}
function baseCells(width) { return Array.from({ length:13 }, () => Array(width || 15).fill(0)); }
function frame(revision, options) {
  const settings = options || {};
  return deepFreeze({
    kind:'tank-3d-frame-v1',
    revision,
    origin:settings.origin || { source:'local', continuity:'snap' },
    arena:settings.arena || { width:15, height:13, season:'spring', cells:baseCells(15) },
    playerCount:2,
    tanks:settings.tanks || [
      { id:0, x:1.5, y:1.5, direction:1, hp:3, alive:true, shielded:false },
      { id:1, x:13.5, y:11.5, direction:3, hp:3, alive:true, shielded:false }
    ],
    projectiles:settings.projectiles || [],
    terminal:settings.terminal === true,
    winner:settings.winner === undefined ? -1 : settings.winner
  });
}
function event(type, revision, options) {
  const settings = options || {};
  if (type === 'terminal') return deepFreeze({
    type,
    revision,
    eventId:settings.eventId || ('tank:' + revision + ':terminal'),
    winner:settings.winner === undefined ? 0 : settings.winner,
    position:settings.position || { x:2.1, y:1.5 }
  });
  const output = { type, revision, eventId:settings.eventId || ('tank:' + revision + ':' + type), seat:settings.seat === undefined ? 0 : settings.seat, position:settings.position || { x:2.1, y:1.5 } };
  if (type === 'tank_fire') output.direction = settings.direction === undefined ? 1 : settings.direction;
  return deepFreeze(output);
}
function optionsFor(mount, callbacks, quality) {
  return { mountElement:mount, onReady:callbacks.onReady, onError:callbacks.onError, onContextLost:callbacks.onContextLost, quality:quality || 'HIGH' };
}
function all(root, predicate) {
  const output = [];
  if (root && typeof root.traverse === 'function') root.traverse(node => { if (predicate(node)) output.push(node); });
  return output;
}

if (source) {
  const unsupported = makeHarness(false);
  check(unsupported.api.isTank3DSupported() === false, 'support predicate reports unavailable WebGL2');
  let unsupportedThrows = false;
  try { unsupported.api.createTank3DAdapter(optionsFor(new FakeElement(), {})); } catch (error) { unsupportedThrows = error && error.code === 'TANK3D_WEBGL2_UNAVAILABLE'; }
  check(unsupportedThrows && unsupported.state.renderers.length === 0, 'unsupported capability rejects before creating a canvas or renderer');

  const harness = makeHarness(true);
  const mount = new FakeElement();
  const errors = [];
  const losses = [];
  let readyCalls = 0;
  const adapter = harness.api.createTank3DAdapter(optionsFor(mount, { onReady() { readyCalls += 1; }, onError(error) { errors.push(error); }, onContextLost(reason) { losses.push(reason); } }));
  const renderer = harness.state.renderers[0];
  const canvas = renderer.domElement;
  check(adapter.mount() === true && readyCalls === 0 && !renderer.renderCount, 'mount preserves DOM ownership and waits for a semantic frozen frame before readiness');
  check(canvas.getAttribute('aria-hidden') === 'true' && canvas.getAttribute('role') === 'presentation' && canvas.getAttribute('tabindex') === '-1' && canvas.style.pointerEvents === 'none' && canvas.listenerCount('webglcontextlost') === 1,
    'canvas remains inert and observes only context loss');
  const first = frame(1);
  check(adapter.render(first) === true && readyCalls === 1 && renderer.renderCount > 0 && harness.state.timelines.length === 1 &&
    harness.state.cameraPlans.some(plan => plan.gameId === 'tank' && plan.mode === 'entrance') &&
    harness.state.cameraPlans.some(plan => plan.gameId === 'tank' && plan.mode === 'overview'),
    'first deep-frozen projection announces ready after a real draw and starts one orthographic entrance shot');
  const pools = all(renderer.lastScene, node => node instanceof FakeInstancedMesh);
  const groups = all(renderer.lastScene, node => node instanceof FakeGroup);
  const terrainPool = pools.find(pool => pool.capacity === 221);
  const projectilePool = pools.find(pool => pool.capacity === 128);
  check(terrainPool && projectilePool && groups.length === 5 && renderer.pixelRatio === 2 && renderer.shadowMap.enabled === true,
    'renderer creates bounded 221 terrain, 128 projectile, and five tank pools at HIGH quality');
  check(adapter.render(first) === true && harness.state.timelines.length === 1 && all(renderer.lastScene, node => node instanceof FakeInstancedMesh).includes(projectilePool),
    'same frozen revision is idempotent, allocates no additional timeline, and reuses bounded pools');
  const invalidLocal = makeHarness(true);
  const invalidAdapter = invalidLocal.api.createTank3DAdapter(optionsFor(new FakeElement(), {}));
  invalidAdapter.mount();
  check(invalidAdapter.render(frame(1, { origin:{ source:'local', continuity:'snap', matchId:'not-authority', serverTick:1 } })) === false,
    'local presentation frames reject authority match/tick guards instead of silently discarding them');
  invalidAdapter.dispose();

  const moved = frame(2, { origin:{ source:'local', continuity:'interpolate' }, tanks:[
    { id:0, x:3.5, y:1.5, direction:3, hp:2, alive:true, shielded:false },
    { id:1, x:13.5, y:11.5, direction:3, hp:3, alive:true, shielded:false }
  ], projectiles:[{ id:1, owner:0, x:2.8, y:1.5, direction:1 }] });
  check(adapter.render(moved) === true && harness.state.timelines.length === 1 && typeof renderer.loop === 'function',
    'continuous packet interpolation reuses the existing scene without creating a per-packet GSAP timeline');
  harness.state.now = 100;
  renderer.loop();
  check(Math.abs(groups[0].rotation.y - Math.PI / 2) < 0.0001 && groups[0].position.x === -4 && projectilePool.count === 1,
    'right-to-left direction interpolation resolves to the correct left-facing tank pose without extrapolation');
  const fire = event('tank_fire', 2, { position:{ x:3.1, y:1.5 }, direction:1 });
  check(adapter.motion(fire) === true && harness.state.timelines.length === 2 && harness.state.timelines.at(-1).children.length <= 6 &&
    harness.state.cameraPlans.some(plan => plan.mode === 'action-follow') && typeof renderer.loop === 'function',
    'HIGH semantic fire creates one bounded action-follow/FX/overview timeline outside the packet render path');
  const fireTimeline = harness.state.timelines.at(-1);
  fireTimeline.mutate({ flashOpacity:.47, flashScale:1.2 });
  renderer.loop();
   const flash = all(renderer.lastScene, node => node instanceof FakeMesh && node.geometry && node.geometry.type === 'SphereGeometry' && node.material && node.material.options && node.material.options.transparent === true).at(-1);
   check(flash && flash.visible === true && Math.abs(flash.material.opacity - .47) < 0.0001,
     'animation-tick rendering synchronizes GSAP fxPose into the visible Three mesh rather than leaving effects as pure data');
   const nextFrame = frame(3, { origin:{ source:'local', continuity:'interpolate' }, tanks:[
     { id:0, x:5.5, y:1.5, direction:3, hp:2, alive:true, shielded:false },
     { id:1, x:13.5, y:11.5, direction:3, hp:3, alive:true, shielded:false }
   ] });
   check(adapter.render(nextFrame) === true && fireTimeline.killed === 1 && flash.visible === false && flash.material.opacity === 0 &&
     typeof renderer.loop === 'function' && harness.state.timelines.length === 2,
   'a newer frame without motion kills prior FX, clears it, and retains one renderer loop for current interpolation');
   harness.state.now = 200;
   renderer.loop();
   check(groups[0].position.x === -2 && renderer.loop === null,
     'newer motionless frame owns the final interpolated pose and releases the loop after it settles');
   check(adapter.motion(event('tank_hit', 3)) === true && harness.state.timelines.length === 3 && harness.state.timelines.at(-1) !== fireTimeline &&
     harness.state.timelines.at(-1).killed === 0 && typeof renderer.loop === 'function',
   'a target-revision impact event created after its frame remains active rather than being killed by frame reconciliation');
   harness.state.timelines.at(-1).complete();
   check(renderer.loop === null, 'finite feedback releases the animation loop when motion and interpolation settle');
   check(adapter.setQuality('BALANCED') === true && renderer.pixelRatio === 1.5 && renderer.shadowMap.enabled === false,
     'BALANCED lowers DPR and removes the high-only shadow path');
   const balanced = frame(4, { origin:{ source:'local', continuity:'interpolate' } });
   check(adapter.render(balanced) === true && adapter.motion(event('tank_hit', 4)) === true && harness.state.timelines.at(-1).children.length <= 6,
     'BALANCED retains bounded impact feedback and overview restoration');
   harness.state.timelines.at(-1).complete();
   const timelinesBeforeLow = harness.state.timelines.length;
   check(adapter.setQuality('LOW') === true && renderer.pixelRatio === 1, 'LOW clamps the renderer to DPR one');
   check(adapter.render(frame(5, { origin:{ source:'local', continuity:'interpolate' } })) === true && adapter.motion(event('tank_spawn', 5)) === true && harness.state.timelines.length === timelinesBeforeLow && renderer.loop === null,
     'LOW accepts the semantic cue but applies its overview-equivalent instantly with no timeline or continuous loop');
   check(adapter.setQuality('HIGH') === true && adapter.environment({ reducedMotion:true }) === true, 'reduced-motion environment is accepted');
   const timelinesBeforeReduced = harness.state.timelines.length;
   check(adapter.render(frame(6, { origin:{ source:'local', continuity:'interpolate' } })) === true && adapter.motion(event('tank_ko', 6)) === true && harness.state.timelines.length === timelinesBeforeReduced,
     'reduced motion accepts the impact cue and produces an immediate equivalent state with zero timeline');
   check(adapter.environment({ reducedMotion:false }) === true && adapter.render(frame(7, { origin:{ source:'local', continuity:'interpolate' } })) === true && adapter.motion(event('tank_hit', 7)) === true,
     'normal motion can be re-enabled for a later, current semantic fact');
  const suspendedTimeline = harness.state.timelines.at(-1);
  check(adapter.suspend() === true && suspendedTimeline.killed >= 1 && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'suspend kills finite motion and never changes DOM input ownership');
  check(adapter.resume() === true && renderer.loop === null && canvas.style.pointerEvents === 'none', 'resume reconciles latest state statically');
  mount.clientWidth = 390;
  mount.clientHeight = 480;
  const observer = FakeResizeObserver.instances.at(-1);
  observer.callback();
  observer.callback();
  check(harness.state.animationFrames.length === 1, 'duplicate resize notifications coalesce into one renderer-local animation frame');
  harness.state.flushFrames();
  check(renderer.size[0] === 390 && renderer.size[1] === 480 && renderer.lastCamera.projectionUpdates >= 1, 'one slot owns resize geometry without changing page layout');
  let prevented = false;
  canvas.dispatch('webglcontextlost', { preventDefault() { prevented = true; } });
  check(prevented && losses.length === 1 && losses[0] === 'webglcontextlost' && renderer.loop === null && canvas.style.pointerEvents === 'none',
    'context loss prevents default, clears renderer work, and leaves all interaction with DOM controls');
   check(adapter.render(frame(8)) === false && adapter.contextLost() === true && losses.length === 1, 'lost renderer cannot resume or notify context loss twice');
  check(adapter.dispose() === true && adapter.dispose() === true && renderer.disposed === 1 && mount.children.length === 0 && observer.disconnected === true && harness.state.contextReverts === 1,
    'dispose is idempotent and releases canvas, observer, renderer, owned materials, and GSAP context');

  const cameraHarness = makeHarness(true);
  const cameraMount = new FakeElement();
  const cameraAdapter = cameraHarness.api.createTank3DAdapter(optionsFor(cameraMount, {}));
  cameraAdapter.mount();
  cameraAdapter.render(frame(1, { origin:{ source:'live', continuity:'snap', matchId:'tank-camera', serverTick:10 } }));
  cameraHarness.state.timelines.at(-1).complete();
  cameraAdapter.render(frame(2, { origin:{ source:'live', continuity:'snap', matchId:'tank-camera', serverTick:12 }, tanks:[
    { id:0, x:3.5, y:1.5, direction:1, hp:3, alive:true, shielded:false },
    { id:1, x:13.5, y:11.5, direction:3, hp:3, alive:true, shielded:false }
  ] }));
  const movementTimelines = cameraHarness.state.timelines.length;
  check(cameraAdapter.motion(event('tank_move', 2, { position:{ x:3.5, y:1.5 } })) === true &&
    cameraHarness.state.timelines.length === movementTimelines + 1 && cameraHarness.state.cameraPlans.some(plan => plan.mode === 'action-follow'),
    'one accepted-frame movement cue produces action-follow and a finite overview return');
  cameraHarness.state.timelines.at(-1).complete();
  cameraAdapter.render(frame(3, {
    origin:{ source:'live', continuity:'snap', matchId:'tank-camera', serverTick:14 },
    terminal:true,
    winner:0,
    tanks:[
      { id:0, x:3.5, y:1.5, direction:1, hp:3, alive:true, shielded:false },
      { id:1, x:13.5, y:11.5, direction:3, hp:0, alive:false, shielded:false }
    ]
  }));
  const beforeResult = cameraHarness.state.timelines.length;
  check(cameraAdapter.motion(event('terminal', 3, { winner:0, position:{ x:3.5, y:1.5 } })) === true &&
    cameraHarness.state.timelines.length === beforeResult + 1 && cameraHarness.state.cameraPlans.some(plan => plan.mode === 'result'),
    'accepted terminal frame owns one result camera timeline targeted at the authoritative winner');
  cameraHarness.state.timelines.at(-1).complete();
  const resultTimelineCount = cameraHarness.state.timelines.length;
  check(cameraAdapter.environment({ reducedMotion:true }) === true &&
    cameraAdapter.motion(event('terminal', 3, { eventId:'tank:3:terminal:reduced', winner:0, position:{ x:3.5, y:1.5 } })) === true &&
    cameraHarness.state.timelines.length === resultTimelineCount && cameraHarness.state.renderers[0].loop === null,
    'reduced-motion terminal applies the same result pose immediately without a timeline');
  cameraAdapter.dispose();

  const failed = makeHarness(true, { throwRender:true });
  const failedMount = new FakeElement();
  const failedErrors = [];
  const failedAdapter = failed.api.createTank3DAdapter(optionsFor(failedMount, { onError(error) { failedErrors.push(error); } }));
  failedAdapter.mount();
  check(failedAdapter.render(frame(1)) === false && failedErrors.length === 1 && failed.state.timelines.length === 0 && failed.state.renderers[0].domElement.style.pointerEvents === 'none',
    'first draw failure fails closed before readiness, motion, or input ownership can be claimed');
  failedAdapter.dispose();
}

if (failures) {
  console.error('TANK_GHOST3D_RENDERER_FAILURES=' + failures + ' assertions=' + assertions);
  process.exitCode = 1;
} else {
  console.log('TANK_GHOST3D_RENDERER_ALL_PASS assertions=' + assertions);
}
