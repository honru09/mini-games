/**
 * Tank Ghost3D renderer island.
 *
 * This adapter owns only a procedural Three scene and bounded renderer-local
 * effects. It consumes frozen Tank3DFrame data after Tank's existing local
 * commit or accepted server receipt. It has no input or authority callback.
 */
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';

const ARENA_HEIGHT = 13;
const MAX_ARENA_WIDTH = 17;
const MAX_TANKS = 5;
const MAX_PROJECTILES = 128;
const MAX_TERRAIN = 221;
const INTERPOLATION_MS = 90;
const ARENA_HALF_HEIGHT = ARENA_HEIGHT / 2;
const DEFAULT_CAMERA = Object.freeze({ x:0, y:16.5, z:13.5 });
const VALID_QUALITY = new Set(['HIGH', 'BALANCED', 'LOW']);
const VALID_SOURCE = new Set(['local', 'live', 'reconcile']);
const VALID_SEASON = new Set(['spring', 'summer', 'autumn', 'winter']);
const VALID_ACTION_MOTION = new Set(['tank_move', 'tank_ko', 'tank_hit', 'tank_fire', 'tank_spawn']);
const VALID_MOTION = new Set([...VALID_ACTION_MOTION, 'terminal']);
const TANK_COLOURS = Object.freeze([0xd75452, 0x4986d8, 0x5aa76c, 0xd8a44c, 0x926ec3]);
const SEASON_COLOURS = Object.freeze({
  spring:0x6baa6d,
  summer:0x3f8e52,
  autumn:0x9b693f,
  winter:0x91aebe
});
const MOTION_DURATION = Object.freeze({ fast:0.12, normal:0.18, medium:0.26 });
// Barrel geometry is authored facing -Z. Board X maps to Three X and board Y
// maps to Three Z, so right(+X) is a negative Y rotation.
const DIRECTION_Y_ROTATION = Object.freeze([0, -Math.PI / 2, Math.PI, Math.PI / 2]);

function adapterError(code) {
  const error = new Error(code);
  error.name = 'Tank3DAdapterError';
  error.code = code;
  return error;
}

function safeRead(record, key) {
  try { return record && typeof record === 'object' ? record[key] : undefined; } catch (_error) { return undefined; }
}

function safeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try { return Object.prototype.toString.call(value) === '[object Object]'; } catch (_error) { return false; }
}

function safeInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function finite(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function isDeepFrozen(value, seen) {
  if (!value || typeof value !== 'object') return true;
  const visited = seen || new Set();
  if (visited.has(value)) return false;
  try {
    if (!Object.isFrozen(value)) return false;
    visited.add(value);
    const keys = Array.isArray(value) ? Array.from({ length:value.length }, (_item, index) => index) : Object.keys(value);
    const frozen = keys.every(key => isDeepFrozen(value[key], visited));
    visited.delete(value);
    return frozen;
  } catch (_error) { return false; }
}

function normalizeQuality(value) {
  const quality = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return VALID_QUALITY.has(quality) ? quality : null;
}

function callbackOption(options, name) {
  const candidate = safeRead(options, name);
  return typeof candidate === 'function' ? candidate : function noOp() {};
}

function runtimeWindow() {
  if (typeof window !== 'undefined') return window;
  return typeof globalThis !== 'undefined' ? globalThis : null;
}

function makeSurfaceTexture(palette) {
  if (typeof document === 'undefined' || typeof THREE.CanvasTexture !== 'function') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const gradient = context.createRadialGradient(128, 118, 8, 128, 128, 190);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.7, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    context.globalAlpha = .22;
    context.strokeStyle = palette[3] || '#ffffff';
    context.lineWidth = 1.5;
    for (let index = -256; index < 512; index += 24) {
      context.beginPath();
      context.moveTo(index, 0);
      context.lineTo(index + 220, 256);
      context.stroke();
    }
    context.globalAlpha = 1;
    const texture = new THREE.CanvasTexture(canvas);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  } catch (_error) {
    return null;
  }
}

function applySurfaceTexture(material, palette) {
  const texture = makeSurfaceTexture(palette);
  if (!texture || !material) return texture;
  material.map = texture;
  if (material.color && typeof material.color.set === 'function') material.color.set(0xffffff);
  material.needsUpdate = true;
  return texture;
}

function rendererDevicePolicy(quality) {
  const win = runtimeWindow();
  const api = win && win.RendererDeviceProfile;
  if (!api || typeof api.evaluate !== 'function') return null;
  try { return api.evaluate(quality, win); }
  catch (_error) { return null; }
}

function devicePixelRatioCap(quality) {
  const win = runtimeWindow();
  const policy = rendererDevicePolicy(quality);
  if (policy && Number.isFinite(policy.pixelRatio)) return policy.pixelRatio;
  const deviceRatio = win && Number.isFinite(win.devicePixelRatio) ? win.devicePixelRatio : 1;
  const cap = quality === 'HIGH' ? 2 : (quality === 'BALANCED' ? 1.5 : 1);
  return Math.max(1, Math.min(cap, deviceRatio));
}

function rendererAntialias(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy ? policy.antialias === true : quality !== 'LOW';
}

function rendererPowerPreference(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy && policy.powerPreference === 'low-power' ? 'low-power' : 'high-performance';
}

function rendererShadowPolicy(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy ? { enabled:policy.shadowEnabled === true, mapSize:policy.shadowMapSize } :
    { enabled:quality === 'HIGH', mapSize:1024 };
}

function readOrigin(value) {
  if (!safeRecord(value)) return null;
  const source = safeRead(value, 'source');
  const continuity = safeRead(value, 'continuity');
  if (typeof source !== 'string' || !VALID_SOURCE.has(source) || (continuity !== 'snap' && continuity !== 'interpolate')) return null;
  const matchId = safeRead(value, 'matchId');
  const serverTick = safeRead(value, 'serverTick');
  if (source === 'local') {
    if (matchId !== undefined || serverTick !== undefined) return null;
    return { source, continuity, matchId:null, serverTick:null };
  }
  if (!nonEmptyString(matchId) || !safeInteger(serverTick, 0, Number.MAX_SAFE_INTEGER)) return null;
  return { source, continuity, matchId, serverTick };
}

function readArena(value) {
  if (!safeRecord(value)) return null;
  const width = safeRead(value, 'width');
  const height = safeRead(value, 'height');
  const season = safeRead(value, 'season');
  const cells = safeRead(value, 'cells');
  if ((width !== 15 && width !== 17) || height !== ARENA_HEIGHT || typeof season !== 'string' || !VALID_SEASON.has(season) ||
      !Array.isArray(cells) || cells.length !== ARENA_HEIGHT) return null;
  const output = [];
  for (let row = 0; row < ARENA_HEIGHT; row += 1) {
    if (!Array.isArray(cells[row]) || cells[row].length !== width) return null;
    const next = [];
    for (let col = 0; col < width; col += 1) {
      const cell = cells[row][col];
      if (cell !== 0 && cell !== 2 && cell !== 3) return null;
      next.push(cell);
    }
    output.push(next);
  }
  return { width, height, season, cells:output };
}

function readTanks(value, playerCount, width) {
  if (!Array.isArray(value) || value.length !== playerCount || playerCount < 2 || playerCount > MAX_TANKS) return null;
  const tanks = [];
  for (let index = 0; index < playerCount; index += 1) {
    const tank = value[index];
    const id = safeRead(tank, 'id');
    const x = safeRead(tank, 'x');
    const y = safeRead(tank, 'y');
    const direction = safeRead(tank, 'direction');
    const hp = safeRead(tank, 'hp');
    const alive = safeRead(tank, 'alive');
    const shielded = safeRead(tank, 'shielded');
    if (!safeRecord(tank) || id !== index || !finite(x, 0.5, width - 0.5) || !finite(y, 0.5, ARENA_HEIGHT - 0.5) ||
        !safeInteger(direction, 0, 3) || !safeInteger(hp, 0, 3) || typeof alive !== 'boolean' || typeof shielded !== 'boolean') return null;
    tanks.push({ id, x, y, direction, hp, alive, shielded });
  }
  return tanks;
}

function readProjectiles(value, playerCount, width) {
  if (!Array.isArray(value) || value.length > MAX_PROJECTILES) return null;
  const ids = new Set();
  const output = [];
  for (let index = 0; index < value.length; index += 1) {
    const projectile = value[index];
    const id = safeRead(projectile, 'id');
    const owner = safeRead(projectile, 'owner');
    const x = safeRead(projectile, 'x');
    const y = safeRead(projectile, 'y');
    const direction = safeRead(projectile, 'direction');
    if (!safeRecord(projectile) || !safeInteger(id, 1, Number.MAX_SAFE_INTEGER) || ids.has(id) ||
        !safeInteger(owner, 0, playerCount - 1) || !finite(x, 0.01, width - 0.01) || !finite(y, 0.01, ARENA_HEIGHT - 0.01) ||
        !safeInteger(direction, 0, 3)) return null;
    ids.add(id);
    output.push({ id, owner, x, y, direction });
  }
  return output;
}

function readProjection(frame) {
  if (!safeRecord(frame) || !isDeepFrozen(frame) || safeRead(frame, 'kind') !== 'tank-3d-frame-v1') return null;
  const revision = safeRead(frame, 'revision');
  const origin = readOrigin(safeRead(frame, 'origin'));
  const arena = readArena(safeRead(frame, 'arena'));
  const playerCount = safeRead(frame, 'playerCount');
  const tanks = arena && readTanks(safeRead(frame, 'tanks'), playerCount, arena.width);
  const projectiles = arena && readProjectiles(safeRead(frame, 'projectiles'), playerCount, arena.width);
  const terminal = safeRead(frame, 'terminal');
  const winner = safeRead(frame, 'winner');
  if (!safeInteger(revision, 0, Number.MAX_SAFE_INTEGER) || !origin || !arena || !safeInteger(playerCount, 2, MAX_TANKS) ||
      !tanks || !projectiles || typeof terminal !== 'boolean' || !safeInteger(winner, -1, playerCount - 1)) return null;
  return { revision, origin, arena, playerCount, tanks, projectiles, terminal, winner };
}

function readActionMotion(event, revision, width) {
  if (!safeRecord(event) || !isDeepFrozen(event) || !VALID_ACTION_MOTION.has(safeRead(event, 'type'))) return null;
  const type = safeRead(event, 'type');
  const eventRevision = safeRead(event, 'revision');
  const eventId = nonEmptyString(safeRead(event, 'eventId'));
  const seat = safeRead(event, 'seat');
  const position = safeRead(event, 'position');
  const direction = safeRead(event, 'direction');
  if (eventRevision !== revision || !eventId || eventId.length > 192 || !safeInteger(seat, 0, MAX_TANKS - 1) || !safeRecord(position) ||
      !finite(safeRead(position, 'x'), 0, width) || !finite(safeRead(position, 'y'), 0, ARENA_HEIGHT) ||
      (type === 'tank_fire' && !safeInteger(direction, 0, 3)) || (type !== 'tank_fire' && direction !== undefined)) return null;
  return {
    type,
    eventId,
    seat,
    x:position.x,
    y:position.y,
    direction:type === 'tank_fire' ? direction : null,
    instant:safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true
  };
}

function readTerminalMotion(event, revision, width) {
  if (!safeRecord(event) || !isDeepFrozen(event) || safeRead(event, 'type') !== 'terminal') return null;
  const eventRevision = safeRead(event, 'revision');
  const eventId = nonEmptyString(safeRead(event, 'eventId'));
  const winner = safeRead(event, 'winner');
  const position = safeRead(event, 'position');
  if (eventRevision !== revision || !eventId || eventId.length > 192 || !safeInteger(winner, 0, MAX_TANKS - 1) ||
      !safeRecord(position) || !finite(safeRead(position, 'x'), 0, width) || !finite(safeRead(position, 'y'), 0, ARENA_HEIGHT)) return null;
  return {
    type:'terminal',
    eventId,
    seat:winner,
    x:position.x,
    y:position.y,
    direction:null,
    instant:safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true
  };
}

function angleForDirection(direction) {
  return DIRECTION_Y_ROTATION[direction] || 0;
}

function shortestAngle(from, to) {
  let delta = (to - from + Math.PI) % (Math.PI * 2);
  if (delta < 0) delta += Math.PI * 2;
  return delta - Math.PI;
}

export function isTank3DSupported() {
  try { return !!WebGL && typeof WebGL.isWebGL2Available === 'function' && WebGL.isWebGL2Available() === true; }
  catch (_error) { return false; }
}

export function createTank3DAdapter(options) {
  const opts = safeRecord(options) ? options : null;
  if (!opts) throw adapterError('TANK3D_INVALID_OPTIONS');
  const mountElement = safeRead(opts, 'mountElement');
  if (!mountElement || typeof mountElement.appendChild !== 'function' || typeof mountElement.removeChild !== 'function') {
    throw adapterError('TANK3D_INVALID_MOUNT_ELEMENT');
  }
  const requestedQuality = safeRead(opts, 'quality') === undefined ? 'BALANCED' : normalizeQuality(safeRead(opts, 'quality'));
  if (!requestedQuality) throw adapterError('TANK3D_INVALID_QUALITY');
  if (!isTank3DSupported()) throw adapterError('TANK3D_WEBGL2_UNAVAILABLE');

  const onReady = callbackOption(opts, 'onReady');
  const onError = callbackOption(opts, 'onError');
  const onContextLost = callbackOption(opts, 'onContextLost');
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const tankGroups = [];
  const tankEmissiveMaterials = [];
  const fromPose = Array.from({ length:MAX_TANKS }, () => ({ x:0, y:0, angle:0, hp:0, alive:false, shielded:false, visible:false }));
  const targetPose = Array.from({ length:MAX_TANKS }, () => ({ x:0, y:0, angle:0, hp:0, alive:false, shielded:false, visible:false }));
  const tankPose = fromPose;
  const tankTarget = targetPose;
  const projectilePose = Array.from({ length:MAX_PROJECTILES }, () => ({ id:0, x:0, y:0, direction:0, visible:false }));
  const projectileTarget = Array.from({ length:MAX_PROJECTILES }, () => ({ id:0, x:0, y:0, direction:0, visible:false }));
  const instanceDummy = new THREE.Object3D();
  const brickTerrainColor = new THREE.Color(0x9c5a46);
  const steelTerrainColor = new THREE.Color(0x8ca3ab);
  let disposed = false;
  let mounted = false;
  let suspended = false;
  let contextWasLost = false;
  let renderFailed = false;
  let readyAnnounced = false;
  let hasProjection = false;
  let quality = requestedQuality;
  let reducedMotion = safeRead(opts, 'reducedMotion') === true;
  let renderer = null;
  let canvas = null;
  let scene = null;
  let camera = null;
  let cameraAim = null;
  let arenaFloor = null;
  let terrain = null;
  let terrainMaterial = null;
  let projectileMesh = null;
  let projectileMaterial = null;
  let fxRing = null;
  let fxFlash = null;
  let fxRingMaterial = null;
  let fxFlashMaterial = null;
  let resizeObserver = null;
  let resizeWindow = null;
  let resizeFrame = null;
  let resizeQueued = false;
  let resizeEpoch = 0;
  let contextLossHandler = null;
  let latestProjection = null;
  let currentWidth = 15;
  let currentHalfWidth = currentWidth / 2;
  let interpolationActive = false;
  let interpolationStart = 0;
  let animationLoopActive = false;
  let activeMotion = null;
  let activeMotionEpoch = 0;
  let initialCameraEntrancePending = true;
  let initialCameraEntrancePrepared = false;
  let fxPose = { x:0, y:0, ringScale:1, ringOpacity:0, flashScale:1, flashOpacity:0 };
  let gsapContext = null;
  let runtimeQualityAdapter = null;
  let applyingRuntimeQuality = false;

  function ownGeometry(geometry) { ownedGeometries.add(geometry); return geometry; }
  function ownMaterial(material) { ownedMaterials.add(material); return material; }

  function reportError(error) {
    try { onError(error); } catch (_error) {}
  }

  function mountRuntimeQualityAdapter() {
    const win = runtimeWindow();
    const api = win && win.RendererQualityAdapter;
    if (!api || typeof api.create !== 'function') return false;
    runtimeQualityAdapter = api.create({
      quality,
      reducedMotion,
      onQuality(nextQuality) {
        applyingRuntimeQuality = true;
        try { return setQuality(nextQuality); }
        finally { applyingRuntimeQuality = false; }
      },
    });
    if (!runtimeQualityAdapter) return false;
    runtimeQualityAdapter.mount();
    return true;
  }

  function observeRuntimeQuality(timestamp) {
    if (runtimeQualityAdapter && typeof runtimeQualityAdapter.observeFrame === 'function') {
      runtimeQualityAdapter.observeFrame(timestamp);
    }
  }

  function setReadOnlyCanvas() {
    if (!canvas) return;
    if (canvas.style) canvas.style.pointerEvents = 'none';
    if (typeof canvas.setAttribute === 'function') {
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('role', 'presentation');
      canvas.setAttribute('tabindex', '-1');
    }
  }

  function fallbackCameraPlan(mode, targetValue) {
    const target = targetValue && typeof targetValue === 'object' ? targetValue : { x:0, y:0, z:0 };
    const scale = reducedMotion || quality === 'LOW' ? 0 : (quality === 'HIGH' ? 1 : .72);
    const plans = {
      overview:{ camera:{ ...DEFAULT_CAMERA }, aim:{ x:0, y:0, z:0 }, duration:.22, ease:'power2.inOut' },
      entrance:{ camera:{ x:0, y:DEFAULT_CAMERA.y + 3.2, z:DEFAULT_CAMERA.z + 4 }, aim:{ x:0, y:.3, z:0 }, duration:.26, ease:'power2.out' },
      'turn-focus':{ camera:{ x:target.x * .18, y:DEFAULT_CAMERA.y - .9, z:DEFAULT_CAMERA.z + target.z * .14 }, aim:{ x:target.x, y:target.y || 0, z:target.z }, duration:.22, ease:'power2.out' },
      'action-follow':{ camera:{ x:target.x * .2, y:DEFAULT_CAMERA.y - 1, z:DEFAULT_CAMERA.z + target.z * .16 }, aim:{ x:target.x, y:target.y || 0, z:target.z }, duration:.24, ease:'power2.out' },
      impact:{ camera:{ x:target.x * .14, y:DEFAULT_CAMERA.y - .55, z:DEFAULT_CAMERA.z + target.z * .1 }, aim:{ x:target.x, y:(target.y || 0) + .04, z:target.z }, duration:.16, ease:'power2.out' },
      result:{ camera:{ x:target.x * .06, y:DEFAULT_CAMERA.y + 1.1, z:DEFAULT_CAMERA.z + 1.35 + target.z * .05 }, aim:{ x:target.x, y:(target.y || 0) + .12, z:target.z }, duration:.42, ease:'power2.inOut' },
    };
    const selected = plans[mode] || plans.overview;
    return { ...selected, mode, animated:selected.duration * scale > 0, duration:selected.duration * scale };
  }

  function cameraPlan(mode, targetValue) {
    const win = runtimeWindow();
    const rig = win && win.TabletopCameraRig;
    if (rig && typeof rig.plan === 'function') {
      try {
        const planned = rig.plan('tank', mode, targetValue, { quality, reducedMotion });
        if (planned && planned.projection === 'orthographic' && planned.camera && planned.aim && Number.isFinite(planned.duration)) return planned;
      } catch (_error) {}
    }
    return fallbackCameraPlan(mode, targetValue);
  }

  function setCameraPlan(plan) {
    if (!camera || !cameraAim || !plan || !plan.camera || !plan.aim) return false;
    camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
    cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
    camera.lookAt(cameraAim);
    return true;
  }

  function setCameraOverview() {
    return setCameraPlan(cameraPlan('overview', { x:0, y:0, z:0 }));
  }

  function tweenCamera(timeline, plan, label) {
    if (!timeline || !plan || !plan.animated || !camera || !cameraAim) return false;
    timeline.to(camera.position, {
      x:plan.camera.x, y:plan.camera.y, z:plan.camera.z, duration:plan.duration, ease:plan.ease,
    }, label).to(cameraAim, {
      x:plan.aim.x, y:plan.aim.y, z:plan.aim.z, duration:plan.duration, ease:plan.ease,
    }, label);
    return true;
  }

  function worldTarget(x, y) {
    return { x:x - currentHalfWidth, y:0, z:y - ARENA_HALF_HEIGHT };
  }

  function projectionResultTarget(projection) {
    const winner = projection && projection.terminal && projection.winner >= 0
      ? projection.tanks.find(tank => tank.id === projection.winner)
      : null;
    return winner ? worldTarget(winner.x, winner.y) : { x:0, y:0, z:0 };
  }

  function settleCameraForProjection() {
    if (latestProjection && latestProjection.terminal) {
      const plan = cameraPlan('result', projectionResultTarget(latestProjection));
      setCameraPlan(plan);
      const winnerGroup = latestProjection.winner >= 0 ? tankGroups[latestProjection.winner] : null;
      if (winnerGroup) winnerGroup.scale.set(1.12, 1.12, 1.12);
      return true;
    }
    tankGroups.forEach(group => group.scale.set(1, 1, 1));
    return setCameraOverview();
  }

  function configureRendererQuality() {
    if (!renderer) return;
    const shadow = rendererShadowPolicy(quality);
    const high = shadow.enabled;
    renderer.setPixelRatio(devicePixelRatioCap(quality));
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = high;
      if (high && THREE.PCFShadowMap !== undefined) renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    if (terrain) {
      terrain.castShadow = high;
      terrain.receiveShadow = high;
    }
    tankGroups.forEach(group => {
      group.traverse(node => { if (node && node.isMesh) { node.castShadow = high; node.receiveShadow = high; } });
    });
  }

  function layoutCamera(width, height) {
    if (!camera) return;
    const aspect = Math.max(.1, width / Math.max(1, height));
    const span = Math.max(currentWidth + 2.6, ARENA_HEIGHT + 2.6);
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    camera.updateProjectionMatrix();
    if (cameraAim) camera.lookAt(cameraAim);
  }

  function applyResize() {
    resizeQueued = false;
    resizeFrame = null;
    if (disposed || contextWasLost || !renderer || !canvas) return;
    const rect = mountElement.getBoundingClientRect ? mountElement.getBoundingClientRect() : null;
    const width = Math.max(1, Math.floor((rect && rect.width) || mountElement.clientWidth || 1));
    const height = Math.max(1, Math.floor((rect && rect.height) || mountElement.clientHeight || 1));
    try {
      renderer.setSize(width, height, false);
      layoutCamera(width, height);
      renderOnce();
    } catch (error) { failRender(error); }
  }

  function queueResize() {
    if (disposed || contextWasLost || resizeQueued) return;
    resizeQueued = true;
    const epoch = ++resizeEpoch;
    const win = runtimeWindow();
    const run = () => {
      if (disposed || contextWasLost || epoch !== resizeEpoch) return;
      applyResize();
    };
    if (win && typeof win.requestAnimationFrame === 'function') resizeFrame = win.requestAnimationFrame(run);
    else Promise.resolve().then(run);
  }

  function clearResize() {
    resizeEpoch += 1;
    if (resizeObserver && typeof resizeObserver.disconnect === 'function') resizeObserver.disconnect();
    resizeObserver = null;
    if (resizeWindow && typeof resizeWindow.removeEventListener === 'function') {
      resizeWindow.removeEventListener('resize', queueResize);
      resizeWindow.removeEventListener('orientationchange', queueResize);
    }
    resizeWindow = null;
    const win = runtimeWindow();
    if (resizeFrame && win && typeof win.cancelAnimationFrame === 'function') win.cancelAnimationFrame(resizeFrame);
    resizeFrame = null;
    resizeQueued = false;
  }

  function installResize() {
    resizeWindow = runtimeWindow();
    if (resizeWindow && typeof resizeWindow.addEventListener === 'function') {
      resizeWindow.addEventListener('resize', queueResize);
      resizeWindow.addEventListener('orientationchange', queueResize);
    }
    if (typeof ResizeObserver === 'function') {
      try { resizeObserver = new ResizeObserver(queueResize); resizeObserver.observe(mountElement); } catch (_error) { resizeObserver = null; }
    }
  }

  function stopAnimationLoop() {
    if (!renderer || !animationLoopActive) return;
    renderer.setAnimationLoop(null);
    animationLoopActive = false;
  }

  function startAnimationLoop() {
    if (disposed || contextWasLost || suspended || renderFailed || !renderer || animationLoopActive || (!interpolationActive && !activeMotion)) return;
    renderer.setAnimationLoop(animationTick);
    animationLoopActive = true;
  }

  function copyPose(target, source) {
    target.x = source.x;
    target.y = source.y;
    target.angle = source.angle;
    target.hp = source.hp;
    target.alive = source.alive;
    target.shielded = source.shielded;
    target.visible = source.visible;
  }

  function updateTankObjects() {
    for (let index = 0; index < tankGroups.length; index += 1) {
      const group = tankGroups[index];
      const pose = tankPose[index];
      group.visible = pose.visible && pose.alive;
      if (!group.visible) continue;
      group.position.set(pose.x - currentHalfWidth, .36, pose.y - ARENA_HALF_HEIGHT);
      group.rotation.y = pose.angle;
      group.userData.shielded = pose.shielded;
      const emissiveMaterials = tankEmissiveMaterials[index];
      const emissiveIntensity = pose.shielded ? .45 : .08;
      for (let materialIndex = 0; materialIndex < emissiveMaterials.length; materialIndex += 1) {
        emissiveMaterials[materialIndex].emissiveIntensity = emissiveIntensity;
      }
    }
  }

  function updateProjectileObjects() {
    if (!projectileMesh) return;
    let count = 0;
    for (let index = 0; index < projectilePose.length; index += 1) {
      const pose = projectilePose[index];
      if (!pose.visible) continue;
      instanceDummy.position.set(pose.x - currentHalfWidth, .32, pose.y - ARENA_HALF_HEIGHT);
      instanceDummy.scale.set(.16, .16, .16);
      instanceDummy.updateMatrix();
      projectileMesh.setMatrixAt(count, instanceDummy.matrix);
      count += 1;
    }
    projectileMesh.count = count;
    projectileMesh.instanceMatrix.needsUpdate = true;
  }

  function updateFxObjects() {
    if (!fxRing || !fxFlash) return;
    fxRing.visible = fxPose.ringOpacity > 0.001;
    fxRing.position.set(fxPose.x - currentHalfWidth, .56, fxPose.y - ARENA_HALF_HEIGHT);
    fxRing.scale.set(fxPose.ringScale, fxPose.ringScale, fxPose.ringScale);
    fxRingMaterial.opacity = fxPose.ringOpacity;
    fxFlash.visible = fxPose.flashOpacity > 0.001;
    fxFlash.position.set(fxPose.x - currentHalfWidth, .58, fxPose.y - ARENA_HALF_HEIGHT);
    fxFlash.scale.set(fxPose.flashScale, fxPose.flashScale, fxPose.flashScale);
    fxFlashMaterial.opacity = fxPose.flashOpacity;
  }

  function applyPoses(alpha) {
    for (let index = 0; index < tankPose.length; index += 1) {
      const pose = tankPose[index];
      const target = tankTarget[index];
      if (alpha >= 1) copyPose(pose, target);
      else {
        pose.x += (target.x - pose.x) * alpha;
        pose.y += (target.y - pose.y) * alpha;
        pose.angle += shortestAngle(pose.angle, target.angle) * alpha;
        pose.hp = target.hp;
        pose.alive = target.alive;
        pose.shielded = target.shielded;
        pose.visible = target.visible;
      }
    }
    for (let index = 0; index < projectilePose.length; index += 1) {
      const pose = projectilePose[index];
      const target = projectileTarget[index];
      if (alpha >= 1 || pose.id !== target.id) {
        pose.id = target.id; pose.x = target.x; pose.y = target.y; pose.direction = target.direction; pose.visible = target.visible;
      } else {
        pose.x += (target.x - pose.x) * alpha;
        pose.y += (target.y - pose.y) * alpha;
        pose.direction = target.direction;
        pose.visible = target.visible;
      }
    }
    updateTankObjects();
    updateProjectileObjects();
    updateFxObjects();
  }

  function updateInterpolation() {
    if (!interpolationActive) return;
    const now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const progress = Math.max(0, Math.min(1, (now - interpolationStart) / INTERPOLATION_MS));
    applyPoses(progress >= 1 ? 1 : progress);
    if (progress >= 1) interpolationActive = false;
  }

  function clearFx() {
    fxPose.ringOpacity = 0;
    fxPose.flashOpacity = 0;
    fxPose.ringScale = 1;
    fxPose.flashScale = 1;
    updateFxObjects();
  }

  function killMotion(renderAfterKill) {
    activeMotionEpoch += 1;
    if (activeMotion && typeof activeMotion.kill === 'function') activeMotion.kill();
    activeMotion = null;
    if (typeof gsap.killTweensOf === 'function') {
      [fxPose, camera && camera.position, cameraAim].filter(Boolean).forEach(target => gsap.killTweensOf(target));
      tankGroups.forEach(group => gsap.killTweensOf(group.scale));
    }
    tankGroups.forEach(group => group.scale.set(1, 1, 1));
    clearFx();
    if (renderAfterKill) renderOnce();
    if (!interpolationActive) stopAnimationLoop();
  }

  function failRender(error) {
    if (disposed || contextWasLost || renderFailed) return false;
    renderFailed = true;
    readyAnnounced = false;
    killMotion(false);
    stopAnimationLoop();
    reportError(error || adapterError('TANK3D_RENDER_FAILURE'));
    return false;
  }

  function announceReadyAfterRender() {
    if (readyAnnounced || disposed || contextWasLost || suspended || renderFailed || !mounted || !hasProjection) return false;
    readyAnnounced = true;
    setReadOnlyCanvas();
    try { onReady(); } catch (error) { readyAnnounced = false; return failRender(error); }
    return true;
  }

  function prepareInitialCameraEntrance() {
    if (!initialCameraEntrancePending || !hasProjection || !camera || !cameraAim) return false;
    initialCameraEntrancePending = false;
    const plan = cameraPlan('entrance', { x:0, y:0, z:0 });
    if (!plan.animated) {
      setCameraOverview();
      return false;
    }
    setCameraPlan(plan);
    initialCameraEntrancePrepared = true;
    return true;
  }

  function playInitialCameraEntrance() {
    if (!initialCameraEntrancePrepared || disposed || contextWasLost || suspended || renderFailed || reducedMotion || quality === 'LOW') return false;
    initialCameraEntrancePrepared = false;
    const epoch = ++activeMotionEpoch;
    const plan = cameraPlan('overview', { x:0, y:0, z:0 });
    const timeline = createTimeline(() => {
      const next = gsap.timeline({
        defaults:{ overwrite:'auto', ease:'power2.out' },
        onComplete:() => {
          if (disposed || contextWasLost || epoch !== activeMotionEpoch) return;
          setCameraPlan(plan);
          activeMotion = null;
          renderOnce();
          if (!interpolationActive) stopAnimationLoop();
        }
      });
      if (typeof next.addLabel === 'function') next.addLabel('entrance', 0);
      tweenCamera(next, plan, 'entrance');
      return next;
    });
    if (!timeline) return failRender(adapterError('TANK3D_CAMERA_ENTRANCE_UNAVAILABLE'));
    timeline.data = 'camera:entrance';
    activeMotion = timeline;
    startAnimationLoop();
    return true;
  }

  function renderOnce() {
    if (disposed || contextWasLost || suspended || renderFailed || !mounted || !hasProjection || !renderer || !scene || !camera) return false;
    const entrancePrepared = prepareInitialCameraEntrance();
    try {
      if (cameraAim) camera.lookAt(cameraAim);
      renderer.render(scene, camera);
      if (!readyAnnounced) announceReadyAfterRender();
      if (entrancePrepared && !playInitialCameraEntrance()) return false;
      return true;
    } catch (error) { return failRender(error); }
  }

  function animationTick(timestamp) {
    if (disposed || contextWasLost || suspended || renderFailed) { stopAnimationLoop(); return; }
    observeRuntimeQuality(timestamp);
    updateInterpolation();
    // GSAP only mutates the private proxy.  Keep the procedural meshes in
    // sync on the renderer loop so finite semantic effects are actually seen.
    if (activeMotion) updateFxObjects();
    renderOnce();
    if (!interpolationActive && !activeMotion) stopAnimationLoop();
  }

  function rebuildTerrain(projection) {
    if (!terrain) return;
    currentWidth = projection.arena.width;
    currentHalfWidth = currentWidth / 2;
    let count = 0;
    for (let row = 0; row < ARENA_HEIGHT; row += 1) {
      for (let col = 0; col < projection.arena.width; col += 1) {
        const type = projection.arena.cells[row][col];
        if (!type) continue;
        instanceDummy.position.set(col + .5 - currentHalfWidth, type === 3 ? .5 : .36, row + .5 - ARENA_HALF_HEIGHT);
        instanceDummy.scale.set(.92, type === 3 ? .95 : .68, .92);
        instanceDummy.updateMatrix();
        terrain.setMatrixAt(count, instanceDummy.matrix);
        terrain.setColorAt(count, type === 3 ? steelTerrainColor : brickTerrainColor);
        count += 1;
      }
    }
    terrain.count = count;
    terrain.instanceMatrix.needsUpdate = true;
    if (terrain.instanceColor) terrain.instanceColor.needsUpdate = true;
    if (arenaFloor && arenaFloor.material && arenaFloor.material.color) arenaFloor.material.color.setHex(SEASON_COLOURS[projection.arena.season]);
  }

  function updateTargets(projection, forceSnap) {
    const canInterpolate = !forceSnap && !reducedMotion && quality !== 'LOW' && latestProjection !== null;
    projection.tanks.forEach(tank => {
      const target = tankTarget[tank.id];
      target.x = tank.x;
      target.y = tank.y;
      target.angle = angleForDirection(tank.direction);
      target.hp = tank.hp;
      target.alive = tank.alive;
      target.shielded = tank.shielded;
      target.visible = true;
      if (!canInterpolate || !tankPose[tank.id].visible) copyPose(tankPose[tank.id], target);
    });
    for (let index = projection.tanks.length; index < MAX_TANKS; index += 1) {
      tankTarget[index].visible = false;
      tankTarget[index].alive = false;
      if (!canInterpolate) copyPose(tankPose[index], tankTarget[index]);
    }
    for (let index = 0; index < MAX_PROJECTILES; index += 1) {
      const projectile = projection.projectiles[index];
      const target = projectileTarget[index];
      if (!projectile) {
        target.visible = false;
        if (!canInterpolate) { projectilePose[index].visible = false; projectilePose[index].id = 0; }
        continue;
      }
      target.id = projectile.id;
      target.x = projectile.x;
      target.y = projectile.y;
      target.direction = projectile.direction;
      target.visible = true;
      if (!canInterpolate || projectilePose[index].id !== target.id || !projectilePose[index].visible) {
        projectilePose[index].id = target.id;
        projectilePose[index].x = target.x;
        projectilePose[index].y = target.y;
        projectilePose[index].direction = target.direction;
        projectilePose[index].visible = true;
      }
    }
    interpolationActive = canInterpolate;
    if (interpolationActive) {
      interpolationStart = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      startAnimationLoop();
    } else applyPoses(1);
  }

  function createScene() {
    THREE.ColorManagement.enabled = true;
    renderer = new THREE.WebGLRenderer({
      alpha:true,
      antialias:rendererAntialias(quality),
      powerPreference:rendererPowerPreference(quality)
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;
    canvas = renderer.domElement;
    setReadOnlyCanvas();
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1721);
    if (typeof THREE.Fog === 'function') scene.fog = new THREE.Fog(0x0f1721, 18, 42);
    camera = new THREE.OrthographicCamera(-10, 10, 8, -8, .1, 100);
    cameraAim = new THREE.Vector3(0, 0, 0);
    camera.position.set(DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z);
    camera.lookAt(cameraAim);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x253848, 2.2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
    keyLight.position.set(4, 10, 6);
    scene.add(keyLight);
    if (typeof THREE.DirectionalLight === 'function') {
      const rimLight = new THREE.DirectionalLight(0x65a5ff, .72);
      rimLight.position.set(-7, 6, -8);
      scene.add(rimLight);
    }
    const floorGeometry = ownGeometry(new THREE.PlaneGeometry(MAX_ARENA_WIDTH + 1.8, ARENA_HEIGHT + 1.8));
    const floorMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color:SEASON_COLOURS.spring, roughness:.72, metalness:.04 }));
    applySurfaceTexture(floorMaterial, ['#4d8e83', '#1f4c54', '#111f31', '#9be0bc']);
    arenaFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    arenaFloor.rotation.x = -Math.PI / 2;
    arenaFloor.position.y = 0;
    scene.add(arenaFloor);
    const terrainGeometry = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
    terrainMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color:0xffffff, roughness:.72, metalness:.08, vertexColors:true }));
    terrain = new THREE.InstancedMesh(terrainGeometry, terrainMaterial, MAX_TERRAIN);
    terrain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(terrain);
    const projectileGeometry = ownGeometry(new THREE.SphereGeometry(.25, 8, 6));
    projectileMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color:0xf7d146, emissive:0x8f6214, emissiveIntensity:.65, roughness:.42 }));
    projectileMesh = new THREE.InstancedMesh(projectileGeometry, projectileMaterial, MAX_PROJECTILES);
    projectileMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    scene.add(projectileMesh);
    for (let index = 0; index < MAX_TANKS; index += 1) {
      const group = new THREE.Group();
      const colour = TANK_COLOURS[index];
      const chassis = new THREE.Mesh(
        ownGeometry(new THREE.BoxGeometry(.82, .38, .98)),
        ownMaterial(new THREE.MeshStandardMaterial({ color:colour, roughness:.48, metalness:.2, emissive:colour, emissiveIntensity:.08 }))
      );
      chassis.position.y = .16;
      const turret = new THREE.Mesh(
        ownGeometry(new THREE.CylinderGeometry(.25, .25, .22, 10)),
        ownMaterial(new THREE.MeshStandardMaterial({ color:0xf1eee7, roughness:.4, metalness:.18, emissive:0x111111, emissiveIntensity:.08 }))
      );
      turret.position.y = .45;
      const barrel = new THREE.Mesh(
        ownGeometry(new THREE.BoxGeometry(.16, .14, .62)),
        ownMaterial(new THREE.MeshStandardMaterial({ color:0x283243, roughness:.36, metalness:.42 }))
      );
      barrel.position.set(0, .45, -.34);
      group.add(chassis, turret, barrel);
      group.visible = false;
      tankGroups.push(group);
      tankEmissiveMaterials.push([chassis.material, turret.material, barrel.material]);
      scene.add(group);
    }
    const ringGeometry = ownGeometry(new THREE.TorusGeometry(.48, .05, 6, 16));
    fxRingMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color:0xffd05c, transparent:true, opacity:0, depthWrite:false }));
    fxRing = new THREE.Mesh(ringGeometry, fxRingMaterial);
    fxRing.rotation.x = Math.PI / 2;
    fxRing.visible = false;
    scene.add(fxRing);
    const flashGeometry = ownGeometry(new THREE.SphereGeometry(.34, 8, 6));
    fxFlashMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color:0xfff0a8, transparent:true, opacity:0, depthWrite:false }));
    fxFlash = new THREE.Mesh(flashGeometry, fxFlashMaterial);
    fxFlash.visible = false;
    scene.add(fxFlash);
    gsapContext = typeof gsap.context === 'function' ? gsap.context(() => {}) : null;
    contextLossHandler = event => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      if (disposed || contextWasLost) return;
      contextWasLost = true;
      if (runtimeQualityAdapter) runtimeQualityAdapter.contextLost();
      killMotion(false);
      stopAnimationLoop();
      try { onContextLost('webglcontextlost'); } catch (_error) {}
    };
    if (canvas && typeof canvas.addEventListener === 'function') canvas.addEventListener('webglcontextlost', contextLossHandler, false);
    mountElement.appendChild(canvas);
    installResize();
    configureRendererQuality();
    queueResize();
  }

  function mount() {
    if (disposed || contextWasLost || renderFailed) return false;
    mounted = true;
    mountRuntimeQualityAdapter();
    return true;
  }

  function render(frame) {
    if (disposed || contextWasLost || renderFailed || !mounted) return false;
    const projection = readProjection(frame);
    if (!projection) return false;
    if (latestProjection && projection.revision <= latestProjection.revision) return true;
    const hadProjection = latestProjection !== null;
    // A newer presentation fact supersedes any finite feedback attached to
    // the prior revision.  The next same-revision semantic event is delivered
    // after this frame and creates its own fresh timeline.
    if (activeMotion) killMotion(false);
    setCameraOverview();
    const dimensionChanged = !latestProjection || projection.arena.width !== currentWidth || projection.arena.season !== latestProjection.arena.season ||
      JSON.stringify(projection.arena.cells) !== JSON.stringify(latestProjection.arena.cells);
    if (dimensionChanged) rebuildTerrain(projection);
    const forceSnap = projection.origin.continuity !== 'interpolate' || reducedMotion || quality === 'LOW' || projection.terminal;
    updateTargets(projection, forceSnap);
    latestProjection = projection;
    hasProjection = true;
    if (projection.terminal && (!hadProjection || reducedMotion || quality === 'LOW')) {
      initialCameraEntrancePending = false;
      initialCameraEntrancePrepared = false;
      setCameraPlan(cameraPlan('result', projectionResultTarget(projection)));
    }
    renderOnce();
    return !renderFailed;
  }

  function createTimeline(build) {
    let timeline = null;
    const create = () => { timeline = build(); };
    if (gsapContext && typeof gsapContext.add === 'function') gsapContext.add(create);
    else create();
    return timeline;
  }

  function motion(event) {
    if (disposed || contextWasLost || suspended || renderFailed || !latestProjection) return false;
    const type = safeRead(event, 'type');
    if (!VALID_MOTION.has(type)) return false;
    const fact = type === 'terminal'
      ? readTerminalMotion(event, latestProjection.revision, latestProjection.arena.width)
      : readActionMotion(event, latestProjection.revision, latestProjection.arena.width);
    if (!fact || fact.seat >= latestProjection.playerCount || fact.eventId === (activeMotion && activeMotion.data && activeMotion.data)) return false;
    if (fact.type === 'terminal') {
      if (!latestProjection.terminal || fact.seat !== latestProjection.winner) return false;
    } else if (latestProjection.terminal) return false;

    const target = worldTarget(fact.x, fact.y);
    const cameraMode = fact.type === 'terminal'
      ? 'result'
      : (fact.type === 'tank_hit' || fact.type === 'tank_ko')
        ? 'impact'
        : fact.type === 'tank_spawn' ? 'turn-focus' : 'action-follow';
    const focusPlan = cameraPlan(cameraMode, target);
    const overviewPlan = cameraPlan('overview', { x:0, y:0, z:0 });
    const winnerGroup = fact.type === 'terminal' ? tankGroups[fact.seat] : null;

    if (fact.instant || reducedMotion || quality === 'LOW' || !focusPlan.animated) {
      killMotion(false);
      if (fact.type === 'terminal') {
        setCameraPlan(focusPlan);
        if (winnerGroup) winnerGroup.scale.set(1.12, 1.12, 1.12);
      } else setCameraPlan(overviewPlan);
      return renderOnce();
    }

    killMotion(false);
    const epoch = ++activeMotionEpoch;
    fxPose.x = fact.x;
    fxPose.y = fact.y;
    fxPose.ringScale = fact.type === 'tank_spawn' ? .5 : .8;
    fxPose.ringOpacity = fact.type === 'tank_fire' || fact.type === 'tank_move' || fact.type === 'terminal' ? 0 : .92;
    fxPose.flashScale = fact.type === 'tank_fire' ? .58 : .85;
    fxPose.flashOpacity = fact.type === 'tank_fire' ? .95 : (fact.type === 'tank_ko' ? .72 : (fact.type === 'tank_hit' || fact.type === 'tank_spawn' ? .35 : 0));
    updateFxObjects();
    const high = quality === 'HIGH';
    const timeline = createTimeline(() => {
      const tl = gsap.timeline({
        defaults:{ overwrite:'auto', ease:'power2.out' },
        onComplete:() => {
          if (disposed || contextWasLost || epoch !== activeMotionEpoch) return;
          clearFx();
          if (fact.type === 'terminal') {
            setCameraPlan(focusPlan);
            if (winnerGroup) winnerGroup.scale.set(1.12, 1.12, 1.12);
          } else {
            setCameraPlan(overviewPlan);
            tankGroups.forEach(group => group.scale.set(1, 1, 1));
          }
          activeMotion = null;
          renderOnce();
          if (!interpolationActive) stopAnimationLoop();
        }
      });
      if (typeof tl.addLabel === 'function') tl.addLabel('focus', 0);
      tweenCamera(tl, focusPlan, 'focus');
      if (fact.type === 'tank_fire') {
        tl.to(fxPose, { flashScale:1.55, flashOpacity:.35, duration:MOTION_DURATION.fast }, 'focus')
          .to(fxPose, { flashScale:.8, flashOpacity:0, duration:high ? MOTION_DURATION.normal : MOTION_DURATION.fast }, '>');
      } else if (fact.type === 'tank_ko') {
        tl.to(fxPose, { ringScale:1.9, ringOpacity:.88, flashScale:1.65, flashOpacity:.55, duration:MOTION_DURATION.normal }, 'focus')
          .to(fxPose, { ringScale:2.35, ringOpacity:0, flashScale:2.05, flashOpacity:0, duration:MOTION_DURATION.medium }, '>');
      } else if (fact.type === 'tank_hit') {
        tl.to(fxPose, { ringScale:1.42, ringOpacity:.74, flashScale:1.24, flashOpacity:.2, duration:MOTION_DURATION.fast }, 'focus')
          .to(fxPose, { ringScale:1.74, ringOpacity:0, flashOpacity:0, duration:high ? MOTION_DURATION.normal : MOTION_DURATION.fast }, '>');
      } else if (fact.type === 'tank_spawn') {
        tl.to(fxPose, { ringScale:1.32, ringOpacity:.62, flashScale:1.12, flashOpacity:.18, duration:MOTION_DURATION.normal }, 'focus')
          .to(fxPose, { ringScale:1.7, ringOpacity:0, flashOpacity:0, duration:high ? MOTION_DURATION.normal : MOTION_DURATION.fast }, '>');
      }
      if (fact.type === 'terminal') {
        if (winnerGroup) {
          tl.to(winnerGroup.scale, { x:1.2, y:1.2, z:1.2, duration:.2, ease:'back.out(1.25)' }, 'focus+=.08')
            .to(winnerGroup.scale, { x:1.12, y:1.12, z:1.12, duration:.18, ease:'power2.out' }, 'focus+=.28');
        }
      } else {
        if (typeof tl.addLabel === 'function') tl.addLabel('restore', '>');
        tweenCamera(tl, overviewPlan, 'restore');
      }
      return tl;
    });
    if (!timeline) return false;
    timeline.data = fact.eventId;
    activeMotion = timeline;
    startAnimationLoop();
    return true;
  }

  function setQuality(nextQuality) {
    const normalized = normalizeQuality(nextQuality);
    if (!normalized || disposed || contextWasLost) return false;
    quality = normalized;
    configureRendererQuality();
    killMotion(false);
    if (quality === 'LOW') {
      interpolationActive = false;
      applyPoses(1);
      // killMotion() intentionally preserves an in-flight interpolation until
      // its caller decides whether the new mode still permits it. LOW is a
      // static presentation mode, so the renderer loop must be released only
      // after the final pose has been copied.
      stopAnimationLoop();
    }
    settleCameraForProjection();
    queueResize();
    renderOnce();
    if (runtimeQualityAdapter && !applyingRuntimeQuality) runtimeQualityAdapter.setQuality(normalized);
    return true;
  }

  function environment(value) {
    if (!safeRecord(value) || typeof safeRead(value, 'reducedMotion') !== 'boolean') return false;
    reducedMotion = value.reducedMotion === true;
    killMotion(false);
    if (reducedMotion) {
      interpolationActive = false;
      applyPoses(1);
      // Reduced motion has the same static-state contract as LOW quality.
      stopAnimationLoop();
    }
    if (runtimeQualityAdapter) runtimeQualityAdapter.environment({ reducedMotion });
    settleCameraForProjection();
    renderOnce();
    return true;
  }

  function suspend() {
    if (disposed) return false;
    suspended = true;
    killMotion(false);
    interpolationActive = false;
    settleCameraForProjection();
    stopAnimationLoop();
    if (runtimeQualityAdapter) runtimeQualityAdapter.suspend();
    return true;
  }

  function resume() {
    if (disposed || contextWasLost || renderFailed) return false;
    suspended = false;
    if (runtimeQualityAdapter) runtimeQualityAdapter.resume();
    // Recovery is always static; dropped history is never animated later.
    interpolationActive = false;
    applyPoses(1);
    settleCameraForProjection();
    renderOnce();
    return true;
  }

  function contextLost() {
    if (disposed) return false;
    contextWasLost = true;
    if (runtimeQualityAdapter) runtimeQualityAdapter.contextLost();
    killMotion(false);
    settleCameraForProjection();
    stopAnimationLoop();
    return true;
  }

  function dispose() {
    if (disposed) return true;
    disposed = true;
    suspended = true;
    if (runtimeQualityAdapter) runtimeQualityAdapter.dispose();
    runtimeQualityAdapter = null;
    killMotion(false);
    stopAnimationLoop();
    clearResize();
    if (canvas && contextLossHandler && typeof canvas.removeEventListener === 'function') canvas.removeEventListener('webglcontextlost', contextLossHandler, false);
    contextLossHandler = null;
    if (gsapContext && typeof gsapContext.revert === 'function') {
      try { gsapContext.revert(); } catch (_error) {}
    }
    gsapContext = null;
    ownedGeometries.forEach(geometry => { try { geometry.dispose(); } catch (_error) {} });
    ownedMaterials.forEach(material => {
      try { if (material && material.map && typeof material.map.dispose === 'function') material.map.dispose(); } catch (_error) {}
      try { material.dispose(); } catch (_error) {}
    });
    ownedGeometries.clear();
    ownedMaterials.clear();
    if (renderer) { try { renderer.dispose(); } catch (_error) {} }
    if (canvas) {
      try {
        if (typeof canvas.remove === 'function') canvas.remove();
        else if (canvas.parentNode && typeof canvas.parentNode.removeChild === 'function') canvas.parentNode.removeChild(canvas);
      } catch (_error) {}
    }
    renderer = null;
    canvas = null;
    scene = null;
    camera = null;
    cameraAim = null;
    latestProjection = null;
    return true;
  }

  try { createScene(); }
  catch (error) {
    try { dispose(); } catch (_error) {}
    throw error;
  }

  return Object.freeze({ mount, render, motion, setQuality, environment, suspend, resume, contextLost, dispose });
}
