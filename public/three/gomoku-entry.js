/**
 * Gomoku Ghost3D renderer island.
 *
 * This module intentionally owns every Three.js, GSAP, DOM, and WebGL object.
 * It consumes presentation frames only; it never writes game state back across
 * the Ghost3D Foundation seam.
 */
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';

const GRID_SIZE = 15;
const GRID_CENTER = (GRID_SIZE - 1) / 2;
const GRID_SPACING = 1;
const BOARD_EXTENT = (GRID_SIZE - 1) * GRID_SPACING;
const BOARD_SIZE = BOARD_EXTENT + 1.1;
const BOARD_THICKNESS = 0.48;
const STONE_RADIUS = 0.42;
const STONE_BASE_HEIGHT = 0.16;
const DEFAULT_CAMERA = Object.freeze({ x: 0, y: 15.5, z: 14.5 });
const VALID_QUALITY = new Set(['HIGH', 'BALANCED', 'LOW']);

export const VERSIONS = Object.freeze({
  three: Object.freeze({
    version: '0.185.1',
    release: 'r185',
    commit: '2431a09f46f34c560bc8e44b33be0e567723d5b9'
  }),
  gsap: Object.freeze({
    version: '3.15.0',
    tag: '3.15.0',
    commit: '13e2b790546426a1a2e0e9b409f3f8dc6d6611f2'
  })
});

function adapterError(code) {
  const error = new Error(code);
  error.name = 'Gomoku3DAdapterError';
  error.code = code;
  return error;
}

function isFiniteInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isCellCoordinate(row, col) {
  return Number.isInteger(row) && Number.isInteger(col) &&
    row >= 0 && row < GRID_SIZE && col >= 0 && col < GRID_SIZE;
}

function normalizeQuality(value) {
  const quality = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return VALID_QUALITY.has(quality) ? quality : null;
}

function normalizeQuarterTurns(value) {
  const turns = Number.isFinite(value) ? Math.trunc(value) : 0;
  return ((turns % 4) + 4) % 4;
}

function noOp() {}

function safeRead(record, key) {
  try {
    return record && typeof record === 'object' ? record[key] : undefined;
  } catch (_error) {
    return undefined;
  }
}

function callbackOption(options, name, required) {
  const callback = safeRead(options, name);
  if (callback === undefined && !required) return noOp;
  if (typeof callback !== 'function') {
    throw adapterError(`GOMOKU3D_INVALID_${name.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`);
  }
  return callback;
}

function readCellPair(value) {
  if (Array.isArray(value) && value.length >= 2 && isCellCoordinate(value[0], value[1])) {
    return { row: value[0], col: value[1] };
  }
  if (!value || typeof value !== 'object') return null;
  const row = safeRead(value, 'row');
  const col = safeRead(value, 'col');
  const column = safeRead(value, 'column');
  const resolvedCol = Number.isInteger(col) ? col : column;
  return isCellCoordinate(row, resolvedCol) ? { row, col: resolvedCol } : null;
}

function readStonePlayer(value) {
  const candidate = Array.isArray(value)
    ? value[2]
    : value && typeof value === 'object'
    ? (safeRead(value, 'player') ?? safeRead(value, 'owner') ?? safeRead(value, 'color') ?? safeRead(value, 'value'))
    : value;
  if (candidate === 0 || candidate === '0') return 'black';
  if (candidate === 1 || candidate === '1') return 'white';
  if (typeof candidate !== 'string') return null;
  const normalized = candidate.trim().toLowerCase();
  if (normalized === 'black' || normalized === 'dark' || normalized === 'b') return 'black';
  if (normalized === 'white' || normalized === 'light' || normalized === 'w') return 'white';
  return null;
}

function addStone(stones, row, col, value) {
  const player = readStonePlayer(value);
  if (!player || !isCellCoordinate(row, col)) return;
  stones.set(`${row}:${col}`, { row, col, player });
}

function addRows(stones, rows) {
  if (!Array.isArray(rows)) return;
  for (let row = 0; row < Math.min(GRID_SIZE, rows.length); row += 1) {
    const sourceRow = rows[row];
    if (Array.isArray(sourceRow)) {
      for (let col = 0; col < Math.min(GRID_SIZE, sourceRow.length); col += 1) {
        addStone(stones, row, col, sourceRow[col]);
      }
      continue;
    }
    if (typeof sourceRow === 'string') {
      for (let col = 0; col < Math.min(GRID_SIZE, sourceRow.length); col += 1) {
        addStone(stones, row, col, sourceRow[col]);
      }
    }
  }
}

function addFlatBoard(stones, cells) {
  if (!Array.isArray(cells) || cells.length < GRID_SIZE * GRID_SIZE) return;
  for (let index = 0; index < GRID_SIZE * GRID_SIZE; index += 1) {
    addStone(stones, Math.floor(index / GRID_SIZE), index % GRID_SIZE, cells[index]);
  }
}

function addCoordinateCollection(stones, values) {
  if (!Array.isArray(values)) return;
  values.slice(0, GRID_SIZE * GRID_SIZE).forEach(value => {
    const cell = readCellPair(value);
    if (!cell) return;
    addStone(stones, cell.row, cell.col, value);
  });
}

function addKeyedBoard(stones, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  Object.keys(value).slice(0, GRID_SIZE * GRID_SIZE).forEach(key => {
    const match = /^(\d{1,2})[:;,|\-](\d{1,2})$/.exec(key);
    if (!match) return;
    addStone(stones, Number(match[1]), Number(match[2]), safeRead(value, key));
  });
}

function frameStones(frame) {
  const stones = new Map();
  const board = safeRead(frame, 'board') ?? safeRead(frame, 'grid');
  if (Array.isArray(board)) {
    if (board.length >= GRID_SIZE * GRID_SIZE && !Array.isArray(board[0])) addFlatBoard(stones, board);
    else addRows(stones, board);
  } else if (typeof board === 'string') {
    addRows(stones, board.split('/'));
  } else {
    addKeyedBoard(stones, board);
  }
  if (stones.size > 0) return stones;
  // The classic bridge packages the canonical collection under `board.stones`
  // so board metadata (size, last move, winning line) stays presentation-only.
  addCoordinateCollection(stones, safeRead(board, 'stones'));
  if (stones.size > 0) return stones;
  addCoordinateCollection(stones, safeRead(board, 'pieces'));
  if (stones.size > 0) return stones;
  addCoordinateCollection(stones, safeRead(board, 'cells'));
  if (stones.size > 0) return stones;
  addCoordinateCollection(stones, safeRead(frame, 'stones'));
  if (stones.size > 0) return stones;
  addCoordinateCollection(stones, safeRead(frame, 'pieces'));
  if (stones.size > 0) return stones;
  addCoordinateCollection(stones, safeRead(frame, 'cells'));
  return stones;
}

function eventCell(event) {
  const direct = readCellPair(event);
  if (direct) return direct;
  const nestedNames = ['cell', 'move', 'placement', 'stone', 'position'];
  for (const name of nestedNames) {
    const candidate = readCellPair(safeRead(event, name));
    if (candidate) return candidate;
  }
  return null;
}

function eventCanPlace(event) {
  const type = String(safeRead(event, 'type') || '').trim().toLowerCase();
  return type === 'place' || type === 'piece_placed' || type === 'stone_placed' || type === 'placement' ||
    type === 'gomoku_piece_placed';
}

function eventType(event) {
  return String(safeRead(event, 'type') || '').trim().toLowerCase();
}

function winningLineCells(value) {
  const board = safeRead(value, 'board');
  const source = safeRead(board, 'winningLine') ?? safeRead(value, 'winningLine');
  if (!Array.isArray(source)) return [];
  return source.map(readCellPair).filter(Boolean).slice(0, 5);
}

function runtimeWindow() {
  if (typeof window !== 'undefined') return window;
  return typeof globalThis !== 'undefined' ? globalThis : null;
}

/**
 * Optional runtime art lane.  The board texture is decorative only: it is
 * loaded after the renderer has mounted and the procedural material remains
 * the deterministic fallback when Image/Texture/WebGL is unavailable.
 */
function attachRuntimeTexture(material, source, repeatX, repeatY) {
  if (!material || typeof Image === 'undefined' || typeof THREE.Texture !== 'function') return null;
  try {
    const image = new Image();
    image.decoding = 'async';
    const texture = new THREE.Texture(image);
    if ('colorSpace' in texture && THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    if (THREE.ClampToEdgeWrapping !== undefined) {
      texture.wrapS = THREE.ClampToEdgeWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
    }
    if (texture.repeat && typeof texture.repeat.set === 'function') texture.repeat.set(repeatX || 1, repeatY || 1);
    material.map = texture;
    if (material.color && typeof material.color.set === 'function') material.color.set(0xffffff);
    material.needsUpdate = true;
    image.onload = () => { texture.needsUpdate = true; };
    image.onerror = () => {
      if (material.map === texture) {
        material.map = null;
        material.needsUpdate = true;
      }
      if (typeof texture.dispose === 'function') texture.dispose();
    };
    image.src = source;
    return texture;
  } catch (_error) {
    return null;
  }
}

function makeSurfaceTexture(palette) {
  if (typeof document === 'undefined' || typeof THREE.CanvasTexture !== 'function') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const gradient = context.createLinearGradient(0, 0, 256, 256);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.52, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    context.globalAlpha = .14;
    context.strokeStyle = palette[3] || '#ffffff';
    context.lineWidth = 2;
    for (let index = -256; index < 512; index += 28) {
      context.beginPath();
      context.moveTo(index, 0);
      context.quadraticCurveTo(index + 42, 128, index - 8, 256);
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
  const dpr = win && Number.isFinite(win.devicePixelRatio) ? win.devicePixelRatio : 1;
  const cap = quality === 'HIGH' ? 2 : (quality === 'BALANCED' ? 1.5 : 1);
  return Math.max(1, Math.min(cap, dpr));
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

export function isGomoku3DSupported() {
  try {
    return !!WebGL && typeof WebGL.isWebGL2Available === 'function' && WebGL.isWebGL2Available() === true;
  } catch (_error) {
    return false;
  }
}

export function createGomoku3DAdapter(options) {
  const opts = options && typeof options === 'object' ? options : null;
  if (!opts) throw adapterError('GOMOKU3D_INVALID_OPTIONS');

  const mountElement = safeRead(opts, 'mountElement');
  if (!mountElement || typeof mountElement.appendChild !== 'function' || typeof mountElement.removeChild !== 'function') {
    throw adapterError('GOMOKU3D_INVALID_MOUNT_ELEMENT');
  }

  const onInput = callbackOption(opts, 'onInput', true);
  const onContextLost = callbackOption(opts, 'onContextLost', true);
  const onError = callbackOption(opts, 'onError', false);
  const onReady = callbackOption(opts, 'onReady', false);
  const initialQuality = safeRead(opts, 'quality') === undefined ? 'HIGH' : normalizeQuality(safeRead(opts, 'quality'));
  if (!initialQuality) throw adapterError('GOMOKU3D_INVALID_QUALITY');
  if (!isGomoku3DSupported()) throw adapterError('GOMOKU3D_WEBGL2_UNAVAILABLE');

  let disposed = false;
  let mounted = false;
  let suspended = false;
  let contextWasLost = false;
  let pointerEnabled = false;
  let readyAnnounced = false;
  let renderFailed = false;
  let hasSemanticFrame = false;
  let initialCameraEntrancePending = true;
  let initialCameraEntrancePrepared = false;
  let quality = initialQuality;
  let reducedMotion = safeRead(opts, 'reducedMotion') === true;
  let renderer = null;
  let canvas = null;
  let scene = null;
  let camera = null;
  let cameraAim = null;
  let boardGroup = null;
  let boardBase = null;
  let directionalLight = null;
  let pickPlane = null;
  let impactRing = null;
  let impactRingMaterial = null;
  let winningLine = null;
  let winningLineRibbon = null;
  let winningLineGeometry = null;
  let winningLineMaterial = null;
  let currentWinningLine = [];
  let raycaster = null;
  let pointer = null;
  let resizeObserver = null;
  let resizeFallbackWindow = null;
  let contextLossHandler = null;
  let animationLoopActive = false;
  let activeMotion = null;
  let motionRevision = null;
  let motionGeneration = 0;
  let latestFrame = null;
  let latestRevision = null;
  let aimedKey = null;
  let gsapContext = null;
  let runtimeQualityAdapter = null;
  let applyingRuntimeQuality = false;

  const stones = new Map();
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const pointerListeners = [];

  function reportError(error) {
    try {
      onError(error);
    } catch (_error) {}
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

  function ownGeometry(geometry) {
    ownedGeometries.add(geometry);
    return geometry;
  }

  function ownMaterial(material) {
    ownedMaterials.add(material);
    return material;
  }

  function fallbackCameraPlan(mode, targetValue) {
    const target = targetValue && typeof targetValue === 'object' ? targetValue : { x: 0, y: 0, z: 0 };
    const scale = reducedMotion || quality === 'LOW' ? 0 : (quality === 'HIGH' ? 1 : .72);
    const plans = {
      entrance: { camera:{ x:0, y:DEFAULT_CAMERA.y + 3.4, z:DEFAULT_CAMERA.z + 4.2 }, aim:{ x:0, y:.36, z:0 }, duration:.26, ease:'power2.out' },
      'action-follow': { camera:{ x:target.x * .2, y:DEFAULT_CAMERA.y - 1, z:DEFAULT_CAMERA.z + target.z * .16 }, aim:{ x:target.x, y:target.y || 0, z:target.z }, duration:.24, ease:'power2.out' },
      result: { camera:{ x:target.x * .06, y:DEFAULT_CAMERA.y + 1.1, z:DEFAULT_CAMERA.z + 1.35 + target.z * .05 }, aim:{ x:target.x, y:(target.y || 0) + .12, z:target.z }, duration:.42, ease:'power2.inOut' },
    };
    const selected = plans[mode] || { camera:{ ...DEFAULT_CAMERA }, aim:{ x:0, y:0, z:0 }, duration:0, ease:'power2.out' };
    return { ...selected, mode, animated:selected.duration * scale > 0, duration:selected.duration * scale };
  }

  function cameraPlan(mode, targetValue) {
    const win = runtimeWindow();
    const rig = win && win.TabletopCameraRig;
    if (rig && typeof rig.plan === 'function') {
      try {
        const planned = rig.plan('gomoku', mode, targetValue, { quality, reducedMotion });
        if (planned && planned.camera && planned.aim && Number.isFinite(planned.duration)) return planned;
      } catch (_error) {}
    }
    return fallbackCameraPlan(mode, targetValue);
  }

  function tweenCamera(timeline, plan, label) {
    if (!timeline || !plan || !plan.animated) return false;
    timeline.to(camera.position, {
      x:plan.camera.x, y:plan.camera.y, z:plan.camera.z, duration:plan.duration, ease:plan.ease,
    }, label).to(cameraAim, {
      x:plan.aim.x, y:plan.aim.y, z:plan.aim.z, duration:plan.duration, ease:plan.ease,
    }, label);
    return true;
  }

  function setCameraDefault() {
    if (!camera || !cameraAim) return;
    camera.position.set(DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z);
    cameraAim.set(0, 0, 0);
  }

  function settleStaticPose() {
    setCameraDefault();
    stones.forEach(stone => {
      if (!stone || !stone.group) return;
      stone.group.position.y = 0;
      stone.group.scale.set(1, 1, 1);
    });
    if (impactRing && impactRingMaterial) {
      impactRing.scale.set(1, 1, 1);
      impactRingMaterial.opacity = 0;
      impactRing.visible = false;
    }
    if (winningLine && winningLineMaterial) {
      winningLine.scale.set(1, 1, 1);
      winningLineMaterial.opacity = currentWinningLine.length >= 2 ? .92 : 0;
      winningLine.visible = currentWinningLine.length >= 2;
    }
  }

  function setObjectShadow(object, enabled) {
    if (!object) return;
    if (typeof object.traverse === 'function') {
      object.traverse(node => {
        if (node && node.isMesh) {
          node.castShadow = enabled;
          node.receiveShadow = enabled;
        }
      });
      return;
    }
    if (object.isMesh) {
      object.castShadow = enabled;
      object.receiveShadow = enabled;
    }
  }

  function applyQuality() {
    if (!renderer) return;
    const shadow = rendererShadowPolicy(quality);
    const high = shadow.enabled;
    renderer.setPixelRatio(devicePixelRatioCap(quality));
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = high;
      if (high && THREE.PCFShadowMap !== undefined) renderer.shadowMap.type = THREE.PCFShadowMap;
    }
    if (directionalLight) {
      directionalLight.castShadow = high;
      if (high && directionalLight.shadow && directionalLight.shadow.mapSize && typeof directionalLight.shadow.mapSize.set === 'function') {
        directionalLight.shadow.mapSize.set(shadow.mapSize, shadow.mapSize);
      }
    }
    if (boardBase) boardBase.receiveShadow = high;
    stones.forEach(stone => setObjectShadow(stone.group, high));
  }

  function prepareInitialCameraEntrance() {
    if (!initialCameraEntrancePending || !hasSemanticFrame || !camera || !cameraAim) return false;
    initialCameraEntrancePending = false;
    const plan = cameraPlan('entrance', { x:0, y:0, z:0 });
    if (!plan.animated) {
      settleStaticPose();
      return false;
    }
    camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
    cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
    initialCameraEntrancePrepared = true;
    return true;
  }

  function announceReadyAfterRender() {
    if (readyAnnounced || disposed || contextWasLost || suspended || renderFailed || !mounted || !hasSemanticFrame) return false;
    readyAnnounced = true;
    setPointerAccess(true);
    try {
      onReady();
    } catch (error) {
      readyAnnounced = false;
      renderFailed = true;
      setPointerAccess(false);
      reportError(error);
      return false;
    }
    return true;
  }

  function failRender(error) {
    if (disposed || contextWasLost) return false;
    renderFailed = true;
    readyAnnounced = false;
    killMotion(false);
    setPointerAccess(false);
    reportError(error);
    return false;
  }

  function playInitialCameraEntrance() {
    if (!initialCameraEntrancePrepared || disposed || contextWasLost || suspended || renderFailed) return false;
    initialCameraEntrancePrepared = false;
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const plan = cameraPlan('overview', { x:0, y:0, z:0 });
    const entranceDuration = quality === 'HIGH' ? .26 : .18;
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      settleStaticPose();
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    let timeline = null;
    try {
      timeline = makeMotion(() => {
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' }, onComplete: complete });
        next.addLabel('entrance', 0)
          .to(camera.position, { x: plan.camera.x, y: plan.camera.y, z: plan.camera.z, duration: entranceDuration, ease: 'power2.out' }, 'entrance')
          .to(cameraAim, { x: plan.aim.x, y: plan.aim.y, z: plan.aim.z, duration: entranceDuration, ease: 'power2.out' }, 'entrance')
          .addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('GOMOKU3D_CAMERA_ENTRANCE_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function renderOnce() {
    if (disposed || contextWasLost || suspended || renderFailed || !mounted || !hasSemanticFrame || !renderer || !scene || !camera) return false;
    const entrancePrepared = prepareInitialCameraEntrance();
    try {
      camera.lookAt(cameraAim);
      renderer.render(scene, camera);
    } catch (error) {
      return failRender(error);
    }
    if (hasSemanticFrame && !readyAnnounced && !announceReadyAfterRender()) return false;
    if (entrancePrepared && !playInitialCameraEntrance()) return false;
    return true;
  }

  function animationTick(timestamp) {
    observeRuntimeQuality(timestamp);
    renderOnce();
  }

  function startAnimationLoop() {
    if (disposed || contextWasLost || suspended || renderFailed || !renderer || !activeMotion || animationLoopActive) return;
    animationLoopActive = true;
    renderer.setAnimationLoop(animationTick);
  }

  function stopAnimationLoop() {
    if (!renderer || !animationLoopActive) return;
    renderer.setAnimationLoop(null);
    animationLoopActive = false;
  }

  function killKnownTweens() {
    if (typeof gsap.killTweensOf !== 'function') return;
    [camera && camera.position, cameraAim, impactRing && impactRing.scale, impactRingMaterial,
      winningLine && winningLine.scale, winningLineMaterial].filter(Boolean).forEach(target => gsap.killTweensOf(target));
    stones.forEach(stone => {
      gsap.killTweensOf(stone.group);
      if (stone.group && stone.group.scale) gsap.killTweensOf(stone.group.scale);
    });
  }

  function killMotion(renderAfterKill) {
    motionGeneration += 1;
    if (activeMotion && typeof activeMotion.kill === 'function') activeMotion.kill();
    activeMotion = null;
    motionRevision = null;
    killKnownTweens();
    stopAnimationLoop();
    if (impactRing && impactRingMaterial) {
      impactRingMaterial.opacity = 0;
      impactRing.visible = false;
      impactRing.scale.set(1, 1, 1);
    }
    if (renderAfterKill) renderOnce();
  }

  function createBoard() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101722);
    if (typeof THREE.Fog === 'function') scene.fog = new THREE.Fog(0x101722, 20, 42);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    cameraAim = new THREE.Vector3(0, 0, 0);
    setCameraDefault();
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    const hemisphere = new THREE.HemisphereLight(0xd7ebff, 0x3a2819, 1.35);
    hemisphere.position.set(0, 12, 0);
    directionalLight = new THREE.DirectionalLight(0xfff1d5, 2.2);
    directionalLight.position.set(5.5, 11, 7.5);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(hemisphere, directionalLight, directionalLight.target);
    if (typeof THREE.DirectionalLight === 'function') {
      const rimLight = new THREE.DirectionalLight(0x79a9ff, .62);
      rimLight.position.set(-7, 6, -9);
      rimLight.target.position.set(0, 0, 0);
      scene.add(rimLight, rimLight.target);
    }

    boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const boardGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_SIZE, BOARD_THICKNESS, BOARD_SIZE));
    const boardMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xb68148,
      roughness: 0.57,
      metalness: 0.04
    }));
    attachRuntimeTexture(boardMaterial, './assets/board/gomoku/mg_board_gomoku_surface_v01.webp', 1, 1);
    boardBase = new THREE.Mesh(boardGeometry, boardMaterial);
    boardBase.position.y = -BOARD_THICKNESS / 2;
    boardGroup.add(boardBase);

    const gridVertices = [];
    for (let index = 0; index < GRID_SIZE; index += 1) {
      const offset = (index - GRID_CENTER) * GRID_SPACING;
      gridVertices.push(offset, 0.028, -BOARD_EXTENT / 2, offset, 0.028, BOARD_EXTENT / 2);
      gridVertices.push(-BOARD_EXTENT / 2, 0.028, offset, BOARD_EXTENT / 2, 0.028, offset);
    }
    const gridGeometry = ownGeometry(new THREE.BufferGeometry());
    gridGeometry.setAttribute('position', new THREE.Float32BufferAttribute(gridVertices, 3));
    const gridMaterial = ownMaterial(new THREE.LineBasicMaterial({ color: 0x533820, transparent: true, opacity: 0.92 }));
    boardGroup.add(new THREE.LineSegments(gridGeometry, gridMaterial));

    const starGeometry = ownGeometry(new THREE.SphereGeometry(0.095, 12, 8));
    const starMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x3d2817, roughness: 0.72 }));
    [[3, 3], [3, 11], [7, 7], [11, 3], [11, 11]].forEach(([row, col]) => {
      const star = new THREE.Mesh(starGeometry, starMaterial);
      const point = localPointForCell(row, col);
      star.position.set(point.x, 0.065, point.z);
      boardGroup.add(star);
    });

    const pickGeometry = ownGeometry(new THREE.PlaneGeometry(BOARD_EXTENT + 0.6, BOARD_EXTENT + 0.6));
    const pickMaterial = ownMaterial(new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    pickPlane = new THREE.Mesh(pickGeometry, pickMaterial);
    pickPlane.rotation.x = -Math.PI / 2;
    pickPlane.position.y = 0.045;
    boardGroup.add(pickPlane);

    const impactGeometry = ownGeometry(new THREE.RingGeometry(STONE_RADIUS * 1.02, STONE_RADIUS * 1.22, 32));
    impactRingMaterial = ownMaterial(new THREE.MeshBasicMaterial({
      color:0xf1b640, transparent:true, opacity:0, depthWrite:false, depthTest:false,
    }));
    impactRing = new THREE.Mesh(impactGeometry, impactRingMaterial);
    impactRing.rotation.x = -Math.PI / 2;
    impactRing.position.y = .11;
    impactRing.visible = false;
    impactRing.renderOrder = 4;
    boardGroup.add(impactRing);

    // WebGL lineWidth is effectively fixed to one pixel on the target browser
    // family.  A slim world-space ribbon stays legible on compact viewports and
    // remains a single reusable, bounded piece of procedural geometry.
    winningLineGeometry = ownGeometry(new THREE.BoxGeometry(1, .055, .18));
    winningLineMaterial = ownMaterial(new THREE.MeshBasicMaterial({
      color:0xf1b640, transparent:true, opacity:0, depthWrite:false, depthTest:false,
    }));
    winningLine = new THREE.Group();
    winningLineRibbon = new THREE.Mesh(winningLineGeometry, winningLineMaterial);
    winningLineRibbon.renderOrder = 5;
    winningLine.add(winningLineRibbon);
    winningLine.position.y = .68;
    winningLine.visible = false;
    winningLine.renderOrder = 5;
    boardGroup.add(winningLine);

    const stoneBaseGeometry = ownGeometry(new THREE.CylinderGeometry(STONE_RADIUS, STONE_RADIUS * 0.95, STONE_BASE_HEIGHT, 32));
    const stoneTopGeometry = ownGeometry(new THREE.SphereGeometry(STONE_RADIUS, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2));
    const blackMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x151a23, roughness: 0.25, metalness: 0.17 }));
    const whiteMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf7f3ea, roughness: 0.31, metalness: 0.03 }));
    return { stoneBaseGeometry, stoneTopGeometry, blackMaterial, whiteMaterial };
  }

  let stoneResources = null;

  function localPointForCell(row, col) {
    return {
      x: (col - GRID_CENTER) * GRID_SPACING,
      z: (row - GRID_CENTER) * GRID_SPACING
    };
  }

  function createStone(entry) {
    const group = new THREE.Group();
    const material = entry.player === 'black' ? stoneResources.blackMaterial : stoneResources.whiteMaterial;
    const base = new THREE.Mesh(stoneResources.stoneBaseGeometry, material);
    const top = new THREE.Mesh(stoneResources.stoneTopGeometry, material);
    base.position.y = STONE_BASE_HEIGHT / 2;
    top.position.y = STONE_BASE_HEIGHT;
    group.add(base, top);
    const point = localPointForCell(entry.row, entry.col);
    group.position.set(point.x, 0, point.z);
    group.scale.set(1, 1, 1);
    setObjectShadow(group, quality === 'HIGH');
    boardGroup.add(group);
    return { group, player: entry.player, row: entry.row, col: entry.col };
  }

  function syncStones(frame) {
    if (!boardGroup || !stoneResources) return;
    const next = frameStones(frame);
    stones.forEach((stone, key) => {
      const incoming = next.get(key);
      if (incoming && incoming.player === stone.player) return;
      boardGroup.remove(stone.group);
      stones.delete(key);
    });
    next.forEach((entry, key) => {
      let stone = stones.get(key);
      if (!stone) {
        stone = createStone(entry);
        stones.set(key, stone);
      }
      const point = localPointForCell(entry.row, entry.col);
      stone.group.position.set(point.x, 0, point.z);
      stone.group.scale.set(1, 1, 1);
    });
  }

  function syncWinningLine(frame) {
    currentWinningLine = winningLineCells(frame);
    if (!winningLine || !winningLineRibbon || !winningLineGeometry || !winningLineMaterial || currentWinningLine.length < 2) {
      if (winningLine) winningLine.visible = false;
      if (winningLineMaterial) winningLineMaterial.opacity = 0;
      return false;
    }
    const first = localPointForCell(currentWinningLine[0].row, currentWinningLine[0].col);
    const lastCell = currentWinningLine[currentWinningLine.length - 1];
    const last = localPointForCell(lastCell.row, lastCell.col);
    const midpoint = { x:(first.x + last.x) / 2, z:(first.z + last.z) / 2 };
    const delta = { x:last.x - first.x, z:last.z - first.z };
    const length = Math.max(.01, Math.hypot(delta.x, delta.z));
    winningLineRibbon.scale.set(length + STONE_RADIUS * 1.7, 1, 1);
    winningLine.position.set(midpoint.x, .68, midpoint.z);
    winningLine.rotation.y = -Math.atan2(delta.z, delta.x);
    winningLine.scale.set(1, 1, 1);
    winningLine.visible = true;
    const process = safeRead(frame, 'process');
    const stage = String(safeRead(process, 'stage') || '').toLowerCase();
    winningLineMaterial.opacity = reducedMotion || quality === 'LOW' || stage === 'terminal' ? .92 : 0;
    return true;
  }

  function winningLineWorldTarget() {
    if (!boardGroup || currentWinningLine.length < 2) return new THREE.Vector3(0, 0, 0);
    const first = localPointForCell(currentWinningLine[0].row, currentWinningLine[0].col);
    const lastCell = currentWinningLine[currentWinningLine.length - 1];
    const last = localPointForCell(lastCell.row, lastCell.col);
    return boardGroup.localToWorld(new THREE.Vector3((first.x + last.x) / 2, .23, (first.z + last.z) / 2));
  }

  function frameQuarterTurns(frame) {
    const view = safeRead(frame, 'view');
    return normalizeQuarterTurns(safeRead(view, 'quarterTurns'));
  }

  function installPointerListener(type, handler) {
    if (!canvas || typeof canvas.addEventListener !== 'function') return;
    canvas.addEventListener(type, handler);
    pointerListeners.push({ type, handler });
  }

  function removePointerAccess() {
    pointerListeners.splice(0).forEach(listener => {
      if (canvas && typeof canvas.removeEventListener === 'function') canvas.removeEventListener(listener.type, listener.handler);
    });
    pointerEnabled = false;
    if (canvas && canvas.style) canvas.style.pointerEvents = 'none';
    aimedKey = null;
  }

  function setPointerAccess(enabled) {
    pointerEnabled = !!enabled && readyAnnounced && !disposed && !suspended && !contextWasLost && !renderFailed;
    if (canvas && canvas.style) canvas.style.pointerEvents = pointerEnabled ? 'auto' : 'none';
  }

  function emitInput(type, cell) {
    if (!pointerEnabled || !latestFrame || !isFiniteInteger(latestRevision)) return;
    const command = { type, revision: latestRevision };
    if (cell) {
      command.row = cell.row;
      command.col = cell.col;
    }
    try {
      onInput(Object.freeze(command));
    } catch (error) {
      reportError(error);
    }
  }

  function pointerCell(event) {
    if (!pointerEnabled || !canvas || !raycaster || !pointer || !camera || !pickPlane || !boardGroup) return null;
    const rect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;
    const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : canvas.clientWidth;
    const height = rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : canvas.clientHeight;
    if (!(width > 0) || !(height > 0)) return null;
    const left = rect && Number.isFinite(rect.left) ? rect.left : 0;
    const top = rect && Number.isFinite(rect.top) ? rect.top : 0;
    const clientX = Number(event && event.clientX);
    const clientY = Number(event && event.clientY);
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
    pointer.x = ((clientX - left) / width) * 2 - 1;
    pointer.y = -((clientY - top) / height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObject(pickPlane, false);
    if (!Array.isArray(intersections) || !intersections.length || !intersections[0] || !intersections[0].point) return null;
    const localPoint = boardGroup.worldToLocal(intersections[0].point.clone());
    const row = Math.round(localPoint.z / GRID_SPACING) + GRID_CENTER;
    const col = Math.round(localPoint.x / GRID_SPACING) + GRID_CENTER;
    return isCellCoordinate(row, col) ? { row, col } : null;
  }

  function clearAim() {
    if (aimedKey === null) return;
    aimedKey = null;
    emitInput('clear_aim');
  }

  function installPointerAccess() {
    installPointerListener('pointermove', event => {
      const cell = pointerCell(event);
      if (!cell) {
        clearAim();
        return;
      }
      const key = `${cell.row}:${cell.col}`;
      if (key === aimedKey) return;
      aimedKey = key;
      emitInput('aim_cell', cell);
    });
    installPointerListener('pointerleave', clearAim);
    installPointerListener('pointercancel', clearAim);
    installPointerListener('pointerdown', event => {
      const cell = pointerCell(event);
      if (!cell) return;
      aimedKey = `${cell.row}:${cell.col}`;
      emitInput('select_cell', cell);
    });
    setPointerAccess(false);
  }

  function resize() {
    if (disposed || contextWasLost || !renderer || !camera) return false;
    const rect = typeof mountElement.getBoundingClientRect === 'function' ? mountElement.getBoundingClientRect() : null;
    const width = Math.max(1, Math.floor((rect && rect.width) || mountElement.clientWidth || 1));
    const height = Math.max(1, Math.floor((rect && rect.height) || mountElement.clientHeight || 1));
    camera.aspect = width / height;
    if ('fov' in camera) camera.fov = camera.aspect < .76 ? 48 : (camera.aspect < 1.05 ? 45 : 42);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (!animationLoopActive && hasSemanticFrame) renderOnce();
    return true;
  }

  function installResizeObserver() {
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => resize());
      resizeObserver.observe(mountElement);
      return;
    }
    const win = runtimeWindow();
    if (win && typeof win.addEventListener === 'function') {
      resizeFallbackWindow = win;
      win.addEventListener('resize', resize);
    }
  }

  function removeResizeObserver() {
    if (resizeObserver && typeof resizeObserver.disconnect === 'function') resizeObserver.disconnect();
    resizeObserver = null;
    if (resizeFallbackWindow && typeof resizeFallbackWindow.removeEventListener === 'function') {
      resizeFallbackWindow.removeEventListener('resize', resize);
    }
    resizeFallbackWindow = null;
  }

  function makeMotion(build) {
    let timeline = null;
    const create = () => {
      timeline = build();
    };
    if (gsapContext && typeof gsapContext.add === 'function') gsapContext.add(create);
    else create();
    return timeline;
  }

  function playPlacement(stone) {
    if (!stone || disposed || contextWasLost || suspended || reducedMotion || quality === 'LOW') {
      if (stone) {
        stone.group.position.y = 0;
        stone.group.scale.set(1, 1, 1);
      }
      renderOnce();
      return true;
    }

    killMotion(false);
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const localTarget = new THREE.Vector3(stone.group.position.x, 0, stone.group.position.z);
    const worldTarget = boardGroup.localToWorld(localTarget.clone());
    const plan = cameraPlan('action-follow', worldTarget);
    const drop = { y: 0.86, scale: 0.88 };
    stone.group.position.y = drop.y;
    stone.group.scale.set(drop.scale, drop.scale, drop.scale);
    if (impactRing && impactRingMaterial) {
      impactRing.position.set(stone.group.position.x, .11, stone.group.position.z);
      impactRing.scale.set(.58, .58, .58);
      impactRingMaterial.opacity = .72;
      impactRing.visible = true;
    }
    const applyDrop = () => {
      stone.group.position.y = drop.y;
      stone.group.scale.set(drop.scale, drop.scale, drop.scale);
    };
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      stone.group.position.y = 0;
      stone.group.scale.set(1, 1, 1);
      if (impactRing && impactRingMaterial) {
        impactRingMaterial.opacity = 0;
        impactRing.visible = false;
        impactRing.scale.set(1, 1, 1);
      }
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    const timeline = makeMotion(() => {
      const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' }, onComplete: complete });
      next.addLabel('focus', 0);
      tweenCamera(next, plan, 'focus');
      next.addLabel('place', plan.animated ? 'focus+=0.05' : 'focus')
        .to(drop, { y: 0, scale: 1, duration: quality === 'HIGH' ? .18 : .14, ease:'power2.out', onUpdate:applyDrop }, 'place')
        .addLabel('impact', 'place+=0.08');
      if (impactRing && impactRingMaterial) {
        next.to(impactRing.scale, { x:1.5, y:1.5, z:1.5, duration:.22, ease:'power2.out' }, 'impact')
          .to(impactRingMaterial, { opacity:0, duration:.2, ease:'power2.out' }, 'impact');
      }
      next.addLabel('settled', '>');
      return next;
    });
    activeMotion = timeline;
    motionRevision = revision;
    if (timeline && typeof timeline.play === 'function') timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function playResult(event) {
    if (disposed || contextWasLost || suspended || renderFailed) return false;
    const hasLine = !!(winningLine && winningLineMaterial && currentWinningLine.length >= 2);
    const target = hasLine ? winningLineWorldTarget() : new THREE.Vector3(0, 0, 0);
    const plan = cameraPlan('result', target);
    if (safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || !plan.animated) {
      killMotion(false);
      camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
      cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
      if (hasLine) {
        winningLine.visible = true;
        winningLine.scale.set(1, 1, 1);
        winningLineMaterial.opacity = .92;
      }
      return renderOnce();
    }

    killMotion(false);
    const generation = ++motionGeneration;
    const revision = latestRevision;
    if (hasLine) {
      winningLine.visible = true;
      winningLine.scale.set(.72, .72, .72);
      winningLineMaterial.opacity = .16;
    }
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      if (hasLine) {
        winningLine.scale.set(1, 1, 1);
        winningLineMaterial.opacity = .92;
      }
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    const timeline = makeMotion(() => {
      const next = gsap.timeline({ paused:true, defaults:{ overwrite:'auto' }, onComplete:complete });
      next.addLabel('read', 0);
      tweenCamera(next, plan, 'read');
      next.addLabel('reveal', 'read+=0.05');
      if (hasLine) {
        next.to(winningLine.scale, { x:1.08, y:1.08, z:1.08, duration:.24, ease:'back.out(1.3)' }, 'reveal')
          .to(winningLineMaterial, { opacity:.96, duration:.16, ease:'power2.out' }, 'reveal')
          .to(winningLine.scale, { x:1, y:1, z:1, duration:.18, ease:'power2.out' }, 'reveal+=0.18');
      }
      next.addLabel('settled', '>');
      return next;
    });
    activeMotion = timeline;
    motionRevision = revision;
    if (timeline && typeof timeline.play === 'function') timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function notifyContextLost(reason) {
    if (contextWasLost || disposed) return true;
    contextWasLost = true;
    suspended = true;
    if (runtimeQualityAdapter) runtimeQualityAdapter.contextLost();
    readyAnnounced = false;
    killMotion(false);
    removePointerAccess();
    try {
      onContextLost(reason);
    } catch (error) {
      reportError(error);
    }
    return true;
  }

  function removeContextLossListener() {
    if (!canvas || !contextLossHandler || typeof canvas.removeEventListener !== 'function') return;
    canvas.removeEventListener('webglcontextlost', contextLossHandler);
    contextLossHandler = null;
  }

  function mount(context) {
    if (disposed || contextWasLost) return false;
    if (mounted) return true;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: rendererAntialias(quality),
        alpha: true,
        powerPreference: rendererPowerPreference(quality)
      });
      THREE.ColorManagement.enabled = true;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.toneMappingExposure = 1;
      canvas = renderer.domElement;
      if (!canvas || typeof canvas.addEventListener !== 'function') throw adapterError('GOMOKU3D_INVALID_CANVAS');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('role', 'presentation');
      canvas.tabIndex = -1;
      if (canvas.style) {
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.touchAction = 'none';
      }
      mountElement.appendChild(canvas);
      stoneResources = createBoard();
      gsapContext = typeof gsap.context === 'function' ? gsap.context(() => {}, mountElement) : null;
      applyQuality();
      installPointerAccess();
      contextLossHandler = event => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        notifyContextLost('webglcontextlost');
      };
      canvas.addEventListener('webglcontextlost', contextLossHandler);
      installResizeObserver();
      mounted = true;
      if (context && normalizeQuality(safeRead(context, 'quality'))) quality = normalizeQuality(safeRead(context, 'quality'));
      if (context && safeRead(context, 'reducedMotion') === true) reducedMotion = true;
      applyQuality();
      mountRuntimeQualityAdapter();
      resize();
      return true;
    } catch (error) {
      reportError(error);
      dispose();
      throw adapterError('GOMOKU3D_RENDERER_CONSTRUCTION_FAILED');
    }
  }

  function render(frame) {
    if (disposed || contextWasLost || renderFailed || !mounted || !frame || typeof frame !== 'object') return false;
    const revision = safeRead(frame, 'revision');
    if (revision !== undefined && !isFiniteInteger(revision)) return false;
    killMotion(false);
    latestFrame = frame;
    latestRevision = revision === undefined ? latestRevision : revision;
    hasSemanticFrame = true;
    boardGroup.rotation.y = normalizeQuarterTurns(safeRead(safeRead(frame, 'view'), 'quarterTurns')) * (Math.PI / 2);
    setCameraDefault();
    syncStones(frame);
    syncWinningLine(frame);
    return renderOnce();
  }

  function motion(event, context) {
    if (disposed || contextWasLost || renderFailed || suspended || !mounted || !event || typeof event !== 'object') return false;
    const revision = safeRead(event, 'revision');
    if (revision !== undefined && (!isFiniteInteger(revision) || (latestRevision !== null && revision !== latestRevision))) return false;
    const type = eventType(event);
    if (type === 'winning_line' || type === 'terminal' || type === 'result') return playResult(event);
    if (safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || (context && safeRead(context, 'reducedMotion') === true)) {
      killMotion(false);
      settleStaticPose();
      return renderOnce();
    }
    if (!eventCanPlace(event)) return renderOnce();
    const cell = eventCell(event);
    if (!cell) return renderOnce();
    const stone = stones.get(`${cell.row}:${cell.col}`);
    return playPlacement(stone);
  }

  function setQuality(nextQuality) {
    if (disposed || contextWasLost || renderFailed) return false;
    const normalized = normalizeQuality(nextQuality);
    if (!normalized) return false;
    quality = normalized;
    killMotion(false);
    if (quality !== 'HIGH' || reducedMotion) settleStaticPose();
    applyQuality();
    resize();
    if (runtimeQualityAdapter && !applyingRuntimeQuality) runtimeQualityAdapter.setQuality(normalized);
    return true;
  }

  function environment(value, context) {
    if (disposed || contextWasLost || renderFailed || !value || typeof value !== 'object') return false;
    const nextReducedMotion = safeRead(value, 'reducedMotion');
    if (typeof nextReducedMotion !== 'boolean') return false;
    const changed = reducedMotion !== nextReducedMotion || (context && safeRead(context, 'reducedMotion') === true && !reducedMotion);
    reducedMotion = nextReducedMotion || !!(context && safeRead(context, 'reducedMotion') === true);
    if (changed || reducedMotion) {
      killMotion(false);
      if (reducedMotion) settleStaticPose();
    }
    if (runtimeQualityAdapter) runtimeQualityAdapter.environment({ reducedMotion });
    renderOnce();
    return true;
  }

  function suspend() {
    if (disposed || contextWasLost || renderFailed) return false;
    suspended = true;
    setPointerAccess(false);
    if (activeMotion && typeof activeMotion.pause === 'function') activeMotion.pause();
    stopAnimationLoop();
    if (runtimeQualityAdapter) runtimeQualityAdapter.suspend();
    return true;
  }

  function resume() {
    if (disposed || contextWasLost || renderFailed) return false;
    suspended = false;
    if (runtimeQualityAdapter) runtimeQualityAdapter.resume();
    setPointerAccess(readyAnnounced);
    if (activeMotion && motionRevision === latestRevision && !reducedMotion && quality !== 'LOW') {
      if (typeof activeMotion.play === 'function') activeMotion.play();
      startAnimationLoop();
      return true;
    }
    if (activeMotion) killMotion(false);
    return renderOnce();
  }

  function contextLost() {
    if (runtimeQualityAdapter) runtimeQualityAdapter.contextLost();
    return notifyContextLost('foundation');
  }

  function dispose() {
    if (disposed) return true;
    disposed = true;
    suspended = true;
    if (runtimeQualityAdapter) runtimeQualityAdapter.dispose();
    runtimeQualityAdapter = null;
    killMotion(false);
    removePointerAccess();
    removeResizeObserver();
    removeContextLossListener();
    if (gsapContext && typeof gsapContext.revert === 'function') gsapContext.revert();
    gsapContext = null;
    ownedGeometries.forEach(geometry => {
      if (geometry && typeof geometry.dispose === 'function') geometry.dispose();
    });
    ownedMaterials.forEach(material => {
      if (material && material.map && typeof material.map.dispose === 'function') material.map.dispose();
      if (material && typeof material.dispose === 'function') material.dispose();
    });
    ownedGeometries.clear();
    ownedMaterials.clear();
    stones.clear();
    if (scene && typeof scene.clear === 'function') scene.clear();
    if (renderer) {
      renderer.setAnimationLoop(null);
      if (renderer.renderLists && typeof renderer.renderLists.dispose === 'function') renderer.renderLists.dispose();
      if (typeof renderer.dispose === 'function') renderer.dispose();
    }
    if (canvas && canvas.parentNode === mountElement) mountElement.removeChild(canvas);
    renderer = null;
    canvas = null;
    scene = null;
    camera = null;
    cameraAim = null;
    boardGroup = null;
    boardBase = null;
    directionalLight = null;
    pickPlane = null;
    impactRing = null;
    impactRingMaterial = null;
    winningLine = null;
    winningLineGeometry = null;
    winningLineMaterial = null;
    currentWinningLine = [];
    raycaster = null;
    pointer = null;
    stoneResources = null;
    latestFrame = null;
    latestRevision = null;
    readyAnnounced = false;
    hasSemanticFrame = false;
    initialCameraEntrancePrepared = false;
    mounted = false;
    return true;
  }

  return Object.freeze({
    id: 'gomoku-three-r185',
    mount,
    render,
    motion,
    setQuality,
    environment,
    suspend,
    resume,
    contextLost,
    dispose
  });
}
