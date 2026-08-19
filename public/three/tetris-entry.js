/**
 * Tetris Ghost3D renderer island.
 *
 * This module owns a single procedural, read-only observed well. It receives
 * only frozen presentation projections after an existing Tetris commit and
 * never creates game input or authority state.
 */
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';

const ROWS = 18;
const COLS = 10;
const LOCKED_CAPACITY = ROWS * COLS;
const ACTIVE_CAPACITY = 4;
const CELL_SIZE = 1;
const WELL_WIDTH = COLS * CELL_SIZE;
const WELL_HEIGHT = ROWS * CELL_SIZE;
const VALID_SOURCES = new Set(['local', 'live', 'room-restored', 'reconnect', 'spectator-bootstrap', 'reconcile']);
const AUTHORITY_SOURCES = new Set(['live', 'room-restored', 'reconnect', 'spectator-bootstrap']);
const VALID_MOTION = new Set(['piece_locked', 'terminal']);
const DEFAULT_CAMERA = Object.freeze({ x: 0, y: 0.75, z: 24.5 });
// This is deliberately the same seven base matrices and clockwise rotation
// rule as the shared Rule Core. The Renderer keeps a code-native copy because
// importing the Rule Core would cross the presentation authority firewall.
const TETROMINO_SHAPES = Object.freeze([
  Object.freeze([
    Object.freeze([1, 1, 1, 1])
  ]),
  Object.freeze([
    Object.freeze([1, 1]),
    Object.freeze([1, 1])
  ]),
  Object.freeze([
    Object.freeze([1, 0, 0]),
    Object.freeze([1, 1, 1])
  ]),
  Object.freeze([
    Object.freeze([0, 0, 1]),
    Object.freeze([1, 1, 1])
  ]),
  Object.freeze([
    Object.freeze([0, 1, 1]),
    Object.freeze([1, 1, 0])
  ]),
  Object.freeze([
    Object.freeze([1, 1, 0]),
    Object.freeze([0, 1, 1])
  ]),
  Object.freeze([
    Object.freeze([0, 1, 0]),
    Object.freeze([1, 1, 1])
  ])
]);
const ACTIVE_COLOURS = Object.freeze([0x45d6ef, 0xe5d24a, 0xbc71e6, 0x60d97c, 0xea5e6d, 0x4f91ee, 0xee9b49]);

export const TETRIS_3D_QUALITY = Object.freeze({
  HIGH: 'HIGH',
  BALANCED: 'BALANCED',
  LOW: 'LOW'
});

const VALID_QUALITY = new Set(Object.values(TETRIS_3D_QUALITY));

function adapterError(code) {
  const error = new Error(code);
  error.name = 'Tetris3DAdapterError';
  error.code = code;
  return error;
}

function safeRead(record, key) {
  try {
    return record && typeof record === 'object' ? record[key] : undefined;
  } catch (_error) {
    return undefined;
  }
}

function safeRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    return Object.prototype.toString.call(value) === '[object Object]';
  } catch (_error) {
    return false;
  }
}

function safeInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function normalizeQuality(value) {
  const quality = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return VALID_QUALITY.has(quality) ? quality : null;
}

function callbackOption(options, name) {
  const callback = safeRead(options, name);
  return typeof callback === 'function' ? callback : function noOp() {};
}

function runtimeWindow() {
  if (typeof window !== 'undefined') return window;
  return typeof globalThis !== 'undefined' ? globalThis : null;
}

function attachRuntimeTexture(material, source) {
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
  const cap = quality === TETRIS_3D_QUALITY.HIGH ? 2 : (quality === TETRIS_3D_QUALITY.BALANCED ? 1.5 : 1);
  return Math.max(1, Math.min(cap, deviceRatio));
}

function rendererAntialias(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy ? policy.antialias === true : quality !== TETRIS_3D_QUALITY.LOW;
}

function rendererPowerPreference(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy && policy.powerPreference === 'low-power' ? 'low-power' : 'high-performance';
}

function rendererShadowPolicy(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy ? { enabled:policy.shadowEnabled === true, mapSize:policy.shadowMapSize } :
    { enabled:quality === TETRIS_3D_QUALITY.HIGH, mapSize:1024 };
}

function isDeepFrozen(value, seen) {
  if (!value || typeof value !== 'object') return true;
  const visited = seen || new Set();
  if (visited.has(value)) return false;
  try {
    if (!Object.isFrozen(value)) return false;
    visited.add(value);
    const keys = Array.isArray(value)
      ? Array.from({ length: value.length }, (_item, index) => index)
      : Object.keys(value);
    const frozen = keys.every(key => isDeepFrozen(value[key], visited));
    visited.delete(value);
    return frozen;
  } catch (_error) {
    return false;
  }
}

function readOrigin(value) {
  if (!safeRecord(value)) return null;
  const source = safeRead(value, 'source');
  const matchId = safeRead(value, 'matchId');
  const authorityRevision = safeRead(value, 'authorityRevision');
  const stateHash = safeRead(value, 'stateHash');
  if (typeof source !== 'string' || !VALID_SOURCES.has(source)) return null;
  if (AUTHORITY_SOURCES.has(source)) {
    if (!nonEmptyString(matchId) || !safeInteger(authorityRevision, 0, Number.MAX_SAFE_INTEGER) || !nonEmptyString(stateHash)) return null;
    return { source, matchId, authorityRevision, stateHash };
  }
  if (source === 'local') {
    if (matchId !== undefined || authorityRevision !== undefined || stateHash !== undefined) return null;
    return { source, matchId: null, authorityRevision: null, stateHash: null };
  }
  const hasAnyGuard = matchId !== undefined || authorityRevision !== undefined || stateHash !== undefined;
  if (hasAnyGuard && (!nonEmptyString(matchId) || !safeInteger(authorityRevision, 0, Number.MAX_SAFE_INTEGER) || !nonEmptyString(stateHash))) return null;
  return {
    source,
    matchId: matchId === undefined ? null : matchId,
    authorityRevision: authorityRevision === undefined ? null : authorityRevision,
    stateHash: stateHash === undefined ? null : stateHash
  };
}

function rotateCW(matrix) {
  const rows = matrix.length;
  const cols = matrix[0].length;
  const output = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) output[col][rows - 1 - row] = matrix[row][col];
  }
  return output;
}

function shapeCells(kind, rotation) {
  let shape = TETROMINO_SHAPES[kind];
  for (let index = 0; index < rotation; index += 1) shape = rotateCW(shape);
  const cells = [];
  for (let row = 0; row < shape.length; row += 1) {
    for (let col = 0; col < shape[row].length; col += 1) {
      if (shape[row][col]) cells.push([col, row]);
    }
  }
  return cells;
}

function readWell(value) {
  if (!Array.isArray(value) || value.length !== ROWS) return null;
  const well = [];
  for (let row = 0; row < ROWS; row += 1) {
    const cells = value[row];
    if (!Array.isArray(cells) || cells.length !== COLS) return null;
    const next = [];
    for (let col = 0; col < COLS; col += 1) {
      const cell = cells[col];
      if (cell !== 0 && cell !== 1) return null;
      next.push(cell);
    }
    well.push(next);
  }
  return well;
}

function readActive(value) {
  if (value === null) return null;
  if (!safeRecord(value)) return undefined;
  const kind = safeRead(value, 'kind');
  const rotation = safeRead(value, 'rotation');
  const x = safeRead(value, 'x');
  const y = safeRead(value, 'y');
  if (!safeInteger(kind, 0, 6) || !safeInteger(rotation, 0, 3) ||
      !safeInteger(x, -3, 9) || !safeInteger(y, -4, 17)) {
    return undefined;
  }
  return { kind, rotation, x, y };
}

function readProjection(frame) {
  if (!safeRecord(frame) || !isDeepFrozen(frame) || safeRead(frame, 'kind') !== 'tetris-3d-frame-v1') return null;
  const revision = safeRead(frame, 'revision');
  const origin = readOrigin(safeRead(frame, 'origin'));
  const viewPlayer = safeRead(frame, 'viewPlayer');
  const playerCount = safeRead(frame, 'playerCount');
  const well = readWell(safeRead(frame, 'well'));
  const active = readActive(safeRead(frame, 'active'));
  const alive = safeRead(frame, 'alive');
  const placementSeq = safeRead(frame, 'placementSeq');
  const terminal = safeRead(frame, 'terminal');
  const winner = safeRead(frame, 'winner');
  if (!safeInteger(revision, 0, Number.MAX_SAFE_INTEGER) || !origin ||
      !safeInteger(playerCount, 2, 5) || !safeInteger(viewPlayer, 0, playerCount - 1) || !well ||
      active === undefined || typeof alive !== 'boolean' || !safeInteger(placementSeq, 0, Number.MAX_SAFE_INTEGER) ||
      typeof terminal !== 'boolean' || !safeInteger(winner, -1, playerCount - 1)) {
    return null;
  }
  return { revision, origin, viewPlayer, playerCount, well, active, alive, placementSeq, terminal, winner };
}

function readMotion(event, revision) {
  if (!safeRecord(event) || !isDeepFrozen(event) || safeRead(event, 'type') !== 'piece_locked') return null;
  const eventRevision = safeRead(event, 'revision');
  const eventId = nonEmptyString(safeRead(event, 'eventId'));
  const player = safeRead(event, 'player');
  const kind = safeRead(event, 'kind');
  const rotation = safeRead(event, 'rotation');
  const x = safeRead(event, 'x');
  const y = safeRead(event, 'y');
  const cleared = safeRead(event, 'cleared');
  if (eventRevision !== revision || !eventId || eventId.length > 192 ||
      !safeInteger(player, 0, 4) || !safeInteger(kind, 0, 6) || !safeInteger(rotation, 0, 3) ||
      !safeInteger(x, -3, 9) || !safeInteger(y, -4, 17) || !safeInteger(cleared, 0, 4)) {
    return null;
  }
  return { eventId, player, kind, rotation, x, y, cleared };
}

function readTerminalMotion(event, revision, playerCount) {
  if (!safeRecord(event) || !isDeepFrozen(event) || safeRead(event, 'type') !== 'terminal') return null;
  const eventRevision = safeRead(event, 'revision');
  const eventId = nonEmptyString(safeRead(event, 'eventId'));
  const winner = safeRead(event, 'winner');
  const outcome = safeRead(event, 'outcome');
  if (eventRevision !== revision || !eventId || eventId.length > 192 ||
      !safeInteger(winner, -1, playerCount - 1) ||
      (outcome !== 'win' && outcome !== 'draw') ||
      (winner === -1) !== (outcome === 'draw')) {
    return null;
  }
  return { eventId, winner, outcome };
}

function projectionFingerprint(projection) {
  return JSON.stringify([
    projection.revision,
    projection.origin.source,
    projection.origin.matchId,
    projection.origin.authorityRevision,
    projection.origin.stateHash,
    projection.viewPlayer,
    projection.playerCount,
    projection.well,
    projection.active && [projection.active.kind, projection.active.rotation, projection.active.x, projection.active.y],
    projection.alive,
    projection.placementSeq,
    projection.terminal,
    projection.winner
  ]);
}

export function isTetris3DSupported() {
  try {
    return !!WebGL && typeof WebGL.isWebGL2Available === 'function' && WebGL.isWebGL2Available() === true;
  } catch (_error) {
    return false;
  }
}

export function createTetris3DAdapter(options) {
  const opts = safeRecord(options) ? options : null;
  if (!opts) throw adapterError('TETRIS3D_INVALID_OPTIONS');
  const mountElement = safeRead(opts, 'mountElement');
  if (!mountElement || typeof mountElement.appendChild !== 'function' || typeof mountElement.removeChild !== 'function') {
    throw adapterError('TETRIS3D_INVALID_MOUNT_ELEMENT');
  }
  const initialQuality = safeRead(opts, 'quality') === undefined
    ? TETRIS_3D_QUALITY.HIGH
    : normalizeQuality(safeRead(opts, 'quality'));
  if (!initialQuality) throw adapterError('TETRIS3D_INVALID_QUALITY');
  if (!isTetris3DSupported()) throw adapterError('TETRIS3D_WEBGL2_UNAVAILABLE');

  const onReady = callbackOption(opts, 'onReady');
  const onError = callbackOption(opts, 'onError');
  const onContextLost = callbackOption(opts, 'onContextLost');
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const handledMotionEventIds = new Set();
  let disposed = false;
  let mounted = false;
  let suspended = false;
  let contextWasLost = false;
  let renderFailed = false;
  let readyAnnounced = false;
  let hasSemanticFrame = false;
  let quality = initialQuality;
  let reducedMotion = safeRead(opts, 'reducedMotion') === true;
  let renderer = null;
  let canvas = null;
  let scene = null;
  let camera = null;
  let cameraAim = null;
  let directionalLight = null;
  let lockedBlocks = null;
  let activeBlocks = null;
  let activeMaterial = null;
  let impactMarker = null;
  let impactMaterial = null;
  let instanceDummy = null;
  let resizeObserver = null;
  let resizeFallbackWindow = null;
  let resizeQueued = false;
  let resizeFrame = null;
  let resizeGeneration = 0;
  let contextLossHandler = null;
  let activeMotion = null;
  let motionRevision = null;
  let animationLoopActive = false;
  let motionGeneration = 0;
  let latestProjection = null;
  let previousProjection = null;
  let latestRevision = null;
  let latestFingerprint = null;
  let gsapContext = null;
  let runtimeQualityAdapter = null;
  let applyingRuntimeQuality = false;
  let initialCameraEntrancePending = true;
  let initialCameraEntrancePrepared = false;

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

  function setReadOnlyCanvas() {
    if (canvas && canvas.style) canvas.style.pointerEvents = 'none';
  }

  function setCameraDefault() {
    if (!camera || !cameraAim) return;
    camera.position.set(DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z);
    cameraAim.set(0, 0, 0);
  }

  function fallbackCameraPlan(mode, targetValue) {
    const target = targetValue && typeof targetValue === 'object' ? targetValue : { x: 0, y: 0, z: 0 };
    const scale = reducedMotion || quality === TETRIS_3D_QUALITY.LOW ? 0 : (quality === TETRIS_3D_QUALITY.HIGH ? 1 : 0.72);
    const plans = {
      overview: { camera: { ...DEFAULT_CAMERA }, aim: { x: 0, y: 0, z: 0 }, duration: 0.22, ease: 'power2.inOut' },
      entrance: { camera: { x: 0, y: DEFAULT_CAMERA.y + 3.2, z: DEFAULT_CAMERA.z + 4 }, aim: { x: 0, y: 0.3, z: 0 }, duration: 0.26, ease: 'power2.out' },
      'action-follow': { camera: { x: target.x * 0.2, y: DEFAULT_CAMERA.y - 1, z: DEFAULT_CAMERA.z + target.z * 0.16 }, aim: { x: target.x, y: target.y || 0, z: target.z || 0 }, duration: 0.24, ease: 'power2.out' },
      impact: { camera: { x: target.x * 0.14, y: DEFAULT_CAMERA.y - 0.55, z: DEFAULT_CAMERA.z + target.z * 0.1 }, aim: { x: target.x, y: (target.y || 0) + 0.04, z: target.z || 0 }, duration: 0.16, ease: 'power2.out' },
      result: { camera: { x: target.x * 0.06, y: DEFAULT_CAMERA.y + 1.1, z: DEFAULT_CAMERA.z + 1.35 + target.z * 0.05 }, aim: { x: target.x, y: (target.y || 0) + 0.12, z: target.z || 0 }, duration: 0.42, ease: 'power2.inOut' }
    };
    const selected = plans[mode] || plans.overview;
    return { ...selected, mode, animated: selected.duration * scale > 0, duration: selected.duration * scale };
  }

  function cameraPlan(mode, targetValue) {
    const win = runtimeWindow();
    const rig = win && win.TabletopCameraRig;
    if (rig && typeof rig.plan === 'function') {
      try {
        const planned = rig.plan('tetris', mode, targetValue, { quality, reducedMotion });
        if (planned && planned.camera && planned.aim && Number.isFinite(planned.duration)) return planned;
      } catch (_error) {}
    }
    return fallbackCameraPlan(mode, targetValue);
  }

  function tweenCamera(timeline, plan, label) {
    if (!timeline || !plan || !plan.animated) return false;
    timeline.to(camera.position, {
      x: plan.camera.x, y: plan.camera.y, z: plan.camera.z, duration: plan.duration, ease: plan.ease
    }, label).to(cameraAim, {
      x: plan.aim.x, y: plan.aim.y, z: plan.aim.z, duration: plan.duration, ease: plan.ease
    }, label);
    return true;
  }

  function cellPoint(row, col, depth) {
    return {
      x: (col - (COLS - 1) / 2) * CELL_SIZE,
      y: ((ROWS - 1) / 2 - row) * CELL_SIZE,
      z: depth
    };
  }

  function setBlockMatrix(mesh, index, row, col, depth, scale) {
    if (!mesh || !instanceDummy) return;
    const point = cellPoint(row, col, depth);
    instanceDummy.position.set(point.x, point.y, point.z);
    instanceDummy.scale.set(scale, scale, scale);
    instanceDummy.updateMatrix();
    mesh.setMatrixAt(index, instanceDummy.matrix);
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
    if (lockedBlocks) {
      lockedBlocks.castShadow = high;
      lockedBlocks.receiveShadow = high;
    }
    if (activeBlocks) {
      activeBlocks.castShadow = high;
      activeBlocks.receiveShadow = high;
    }
  }

  function clearImpactMarker() {
    if (!impactMarker) return;
    impactMarker.visible = false;
    impactMarker.scale.set(1, 1, 1);
    if (impactMaterial) impactMaterial.opacity = 0;
  }

  function settleStaticPose() {
    setCameraDefault();
    clearImpactMarker();
  }

  function prepareInitialCameraEntrance() {
    if (!initialCameraEntrancePending || !hasSemanticFrame || !camera || !cameraAim) return false;
    initialCameraEntrancePending = false;
    const plan = cameraPlan('entrance', { x: 0, y: 0, z: 0 });
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
    setReadOnlyCanvas();
    try {
      onReady();
    } catch (error) {
      readyAnnounced = false;
      renderFailed = true;
      setReadOnlyCanvas();
      reportError(error);
      return false;
    }
    return true;
  }

  function stopAnimationLoop() {
    if (!renderer || !animationLoopActive) return;
    renderer.setAnimationLoop(null);
    animationLoopActive = false;
  }

  function startAnimationLoop() {
    if (disposed || contextWasLost || suspended || renderFailed || !renderer || !activeMotion || animationLoopActive) return;
    animationLoopActive = true;
    renderer.setAnimationLoop(animationTick);
  }

  function killKnownTweens() {
    if (typeof gsap.killTweensOf !== 'function') return;
    [camera && camera.position, cameraAim, impactMarker && impactMarker.scale, impactMaterial].filter(Boolean)
      .forEach(target => gsap.killTweensOf(target));
  }

  function killMotion(renderAfterKill) {
    motionGeneration += 1;
    if (activeMotion && typeof activeMotion.kill === 'function') activeMotion.kill();
    activeMotion = null;
    motionRevision = null;
    killKnownTweens();
    stopAnimationLoop();
    clearImpactMarker();
    if (renderAfterKill) renderOnce();
  }

  function failRender(error) {
    if (disposed || contextWasLost) return false;
    renderFailed = true;
    readyAnnounced = false;
    killMotion(false);
    settleStaticPose();
    setReadOnlyCanvas();
    reportError(error);
    return false;
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
    if (!readyAnnounced && !announceReadyAfterRender()) return false;
    if (entrancePrepared && !playInitialCameraEntrance()) return false;
    return true;
  }

  function animationTick(timestamp) {
    observeRuntimeQuality(timestamp);
    renderOnce();
  }

  function makeMotion(build) {
    let timeline = null;
    const create = () => { timeline = build(); };
    if (gsapContext && typeof gsapContext.add === 'function') gsapContext.add(create);
    else create();
    return timeline;
  }

  function playInitialCameraEntrance() {
    if (!initialCameraEntrancePrepared || disposed || contextWasLost || suspended || renderFailed || reducedMotion || quality === TETRIS_3D_QUALITY.LOW) return false;
    initialCameraEntrancePrepared = false;
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const plan = cameraPlan('overview', { x: 0, y: 0, z: 0 });
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
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto', ease: 'power2.out' }, onComplete: complete });
        next.addLabel('entrance', 0);
        tweenCamera(next, plan, 'entrance');
        next.addLabel('overview', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('TETRIS3D_CAMERA_ENTRANCE_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function createWell() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1120);
    if (typeof THREE.Fog === 'function') scene.fog = new THREE.Fog(0x0b1120, 28, 58);
    camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    cameraAim = new THREE.Vector3(0, 0, 0);
    setCameraDefault();

    const hemisphere = new THREE.HemisphereLight(0xd5edff, 0x0a1020, 1.3);
    hemisphere.position.set(0, 8, 6);
    directionalLight = new THREE.DirectionalLight(0xbbe8ff, 2.1);
    directionalLight.position.set(5.5, 8.5, 10);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(hemisphere, directionalLight, directionalLight.target);
    if (typeof THREE.DirectionalLight === 'function') {
      const rimLight = new THREE.DirectionalLight(0x7a8dff, .76);
      rimLight.position.set(-5, 5, -10);
      rimLight.target.position.set(0, 0, 0);
      scene.add(rimLight, rimLight.target);
    }

    const wellGeometry = ownGeometry(new THREE.BoxGeometry(WELL_WIDTH + 0.72, WELL_HEIGHT + 0.72, 0.38));
    const wellMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x132544, roughness: 0.62, metalness: 0.12 }));
    attachRuntimeTexture(wellMaterial, './assets/board/tetris/mg_board_tetris_well_v01.webp');
    const wellBack = new THREE.Mesh(wellGeometry, wellMaterial);
    wellBack.position.set(0, 0, -0.34);
    wellBack.receiveShadow = quality === TETRIS_3D_QUALITY.HIGH;
    scene.add(wellBack);

    const lockedGeometry = ownGeometry(new THREE.BoxGeometry(0.88, 0.88, 0.46));
    const lockedMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x648cf1, roughness: 0.42, metalness: 0.1 }));
    const activeGeometry = ownGeometry(new THREE.BoxGeometry(0.92, 0.92, 0.56));
    activeMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: ACTIVE_COLOURS[0], roughness: 0.35, metalness: 0.12 }));
    lockedBlocks = new THREE.InstancedMesh(lockedGeometry, lockedMaterial, LOCKED_CAPACITY);
    activeBlocks = new THREE.InstancedMesh(activeGeometry, activeMaterial, ACTIVE_CAPACITY);
    lockedBlocks.count = 0;
    activeBlocks.count = 0;
    lockedBlocks.frustumCulled = false;
    activeBlocks.frustumCulled = false;
    scene.add(lockedBlocks, activeBlocks);

    const impactGeometry = ownGeometry(new THREE.BoxGeometry(0.98, 0.98, 0.08));
    impactMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: 0xf9e56b, transparent: true, opacity: 0 }));
    impactMarker = new THREE.Mesh(impactGeometry, impactMaterial);
    impactMarker.position.set(0, 0, 0.55);
    impactMarker.visible = false;
    scene.add(impactMarker);
    instanceDummy = new THREE.Object3D();
  }

  function syncWell(projection) {
    if (!lockedBlocks || !activeBlocks || !instanceDummy) return;
    let lockedCount = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (projection.well[row][col] !== 1) continue;
        if (lockedCount >= LOCKED_CAPACITY) return;
        setBlockMatrix(lockedBlocks, lockedCount, row, col, 0, 1);
        lockedCount += 1;
      }
    }
    lockedBlocks.count = lockedCount;
    if (lockedBlocks.instanceMatrix) lockedBlocks.instanceMatrix.needsUpdate = true;

    let activeCount = 0;
    if (projection.active) {
      const active = projection.active;
      if (activeMaterial && activeMaterial.color && typeof activeMaterial.color.setHex === 'function') {
        activeMaterial.color.setHex(ACTIVE_COLOURS[active.kind]);
      }
      const blocks = shapeCells(active.kind, active.rotation);
      blocks.forEach(block => {
        const col = active.x + block[0];
        const row = active.y + block[1];
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS || activeCount >= ACTIVE_CAPACITY) return;
        setBlockMatrix(activeBlocks, activeCount, row, col, 0.17, 1);
        activeCount += 1;
      });
    }
    activeBlocks.count = activeCount;
    if (activeBlocks.instanceMatrix) activeBlocks.instanceMatrix.needsUpdate = true;
  }

  function resize() {
    if (disposed || contextWasLost || !renderer || !camera) return false;
    const rect = typeof mountElement.getBoundingClientRect === 'function' ? mountElement.getBoundingClientRect() : null;
    const width = Math.max(1, Math.floor((rect && rect.width) || mountElement.clientWidth || 1));
    const height = Math.max(1, Math.floor((rect && rect.height) || mountElement.clientHeight || 1));
    camera.aspect = width / height;
    if ('fov' in camera) camera.fov = camera.aspect < .76 ? 39 : (camera.aspect < 1.05 ? 36 : 34);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (!animationLoopActive && hasSemanticFrame) renderOnce();
    return true;
  }

  function scheduleResize() {
    if (resizeQueued || disposed || contextWasLost) return;
    resizeQueued = true;
    const generation = resizeGeneration;
    const flush = () => {
      resizeQueued = false;
      resizeFrame = null;
      if (generation !== resizeGeneration || disposed || contextWasLost) return;
      resize();
    };
    const win = runtimeWindow();
    if (win && typeof win.requestAnimationFrame === 'function') {
      resizeFrame = win.requestAnimationFrame(flush);
      return;
    }
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(flush);
      return;
    }
    Promise.resolve().then(flush, () => {});
  }

  function installResizeObserver() {
    if (typeof ResizeObserver === 'function') {
      resizeObserver = new ResizeObserver(() => scheduleResize());
      resizeObserver.observe(mountElement);
      return;
    }
    const win = runtimeWindow();
    if (win && typeof win.addEventListener === 'function') {
      resizeFallbackWindow = win;
      win.addEventListener('resize', scheduleResize);
      win.addEventListener('orientationchange', scheduleResize);
    }
  }

  function cancelQueuedResize() {
    const win = runtimeWindow();
    if (resizeFrame !== null && win && typeof win.cancelAnimationFrame === 'function') {
      try { win.cancelAnimationFrame(resizeFrame); } catch (_error) {}
    }
    resizeFrame = null;
    resizeGeneration += 1;
    resizeQueued = false;
  }

  function removeResizeObserver() {
    if (resizeObserver && typeof resizeObserver.disconnect === 'function') resizeObserver.disconnect();
    resizeObserver = null;
    if (resizeFallbackWindow && typeof resizeFallbackWindow.removeEventListener === 'function') {
      resizeFallbackWindow.removeEventListener('resize', scheduleResize);
      resizeFallbackWindow.removeEventListener('orientationchange', scheduleResize);
    }
    resizeFallbackWindow = null;
    cancelQueuedResize();
  }

  function claimMotionEvent(eventId) {
    if (handledMotionEventIds.has(eventId)) return false;
    handledMotionEventIds.add(eventId);
    if (handledMotionEventIds.size > 128) {
      const oldest = handledMotionEventIds.values().next().value;
      handledMotionEventIds.delete(oldest);
    }
    return true;
  }

  function impactPoint(motion) {
    const blocks = shapeCells(motion.kind, motion.rotation);
    let x = 0;
    let y = 0;
    let count = 0;
    blocks.forEach(block => {
      const col = motion.x + block[0];
      const row = motion.y + block[1];
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
      const point = cellPoint(row, col, 0.56);
      x += point.x;
      y += point.y;
      count += 1;
    });
    return count ? { x: x / count, y: y / count } : { x: 0, y: 0 };
  }

  function playLockMotion(event) {
    const motion = readMotion(event, latestRevision);
    if (!motion || !latestProjection || latestProjection.terminal || !latestProjection.alive ||
        latestProjection.viewPlayer !== motion.player ||
        (latestProjection.origin.source !== 'local' && latestProjection.origin.source !== 'live')) {
      return false;
    }
    const previous = previousProjection;
    const consecutiveLocal = latestProjection.origin.source === 'local' && previous && previous.origin.source === 'local';
    const consecutiveLive = latestProjection.origin.source === 'live' && previous && previous.origin.source === 'live' &&
      latestProjection.origin.matchId === previous.origin.matchId &&
      latestProjection.origin.authorityRevision === previous.origin.authorityRevision + 1;
    if ((!consecutiveLocal && !consecutiveLive) || previous.viewPlayer !== latestProjection.viewPlayer ||
        latestProjection.placementSeq !== previous.placementSeq + 1) {
      return false;
    }
    if (!claimMotionEvent(motion.eventId)) return false;
    if (safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || reducedMotion || quality === TETRIS_3D_QUALITY.LOW) {
      settleStaticPose();
      return renderOnce();
    }
    killMotion(false);
    settleStaticPose();
    const target = impactPoint(motion);
    const worldTarget = { x: target.x, y: target.y, z: 0.56 };
    const followPlan = cameraPlan('action-follow', worldTarget);
    const impactPlan = cameraPlan('impact', worldTarget);
    const overviewPlan = cameraPlan('overview', { x: 0, y: 0, z: 0 });
    const generation = ++motionGeneration;
    const revision = latestRevision;
    if (impactMarker) {
      impactMarker.position.set(target.x, target.y, 0.56);
      impactMarker.scale.set(0.72, 0.72, 1);
      impactMarker.visible = true;
    }
    if (impactMaterial) impactMaterial.opacity = 0.18;
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
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto', ease: 'power2.out' }, onComplete: complete });
        next.addLabel('follow', 0);
        tweenCamera(next, followPlan, 'follow');
        next.addLabel('impact', '>');
        tweenCamera(next, impactPlan, 'impact');
        if (impactMarker && impactMaterial) {
          const peak = quality === TETRIS_3D_QUALITY.HIGH ? 1.28 : 1.16;
          next.to(impactMarker.scale, { x: peak, y: peak, z: 1, duration: quality === TETRIS_3D_QUALITY.HIGH ? 0.14 : 0.1 }, 'impact')
            .to(impactMaterial, { opacity: 0.92, duration: quality === TETRIS_3D_QUALITY.HIGH ? 0.14 : 0.1 }, 'impact');
        }
        next.addLabel('overview', '>');
        tweenCamera(next, overviewPlan, 'overview');
        if (impactMarker && impactMaterial) {
          next.to(impactMarker.scale, { x: 1, y: 1, z: 1, duration: 0.18 }, 'overview')
            .to(impactMaterial, { opacity: 0, duration: 0.18 }, 'overview');
        }
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('TETRIS3D_LOCK_MOTION_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function resultTarget() {
    if (!latestProjection) return { x: 0, y: 0, z: 0.56 };
    let x = 0;
    let y = 0;
    let count = 0;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (latestProjection.well[row][col] !== 1) continue;
        const point = cellPoint(row, col, 0.56);
        x += point.x;
        y += point.y;
        count += 1;
      }
    }
    return count ? { x: x / count, y: y / count, z: 0.56 } : { x: 0, y: 0, z: 0.56 };
  }

  function applyResultPose(plan) {
    clearImpactMarker();
    if (!camera || !cameraAim || !plan) return;
    camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
    cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
  }

  function playResult(event) {
    const terminal = readTerminalMotion(event, latestRevision, latestProjection ? latestProjection.playerCount : 0);
    if (!terminal || !latestProjection || !latestProjection.terminal || terminal.winner !== latestProjection.winner ||
        !claimMotionEvent(terminal.eventId)) return false;
    const target = resultTarget();
    const plan = cameraPlan('result', target);
    const instant = safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || reducedMotion || quality === TETRIS_3D_QUALITY.LOW;
    if (instant || !plan.animated) {
      killMotion(false);
      applyResultPose(plan);
      return renderOnce();
    }
    killMotion(false);
    const generation = ++motionGeneration;
    const revision = latestRevision;
    if (impactMarker) {
      impactMarker.position.set(target.x, target.y, target.z);
      impactMarker.scale.set(0.82, 0.82, 1);
      impactMarker.visible = true;
    }
    if (impactMaterial) impactMaterial.opacity = 0.24;
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      applyResultPose(plan);
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    let timeline = null;
    try {
      timeline = makeMotion(() => {
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto', ease: 'power2.out' }, onComplete: complete });
        next.addLabel('result', 0);
        tweenCamera(next, plan, 'result');
        if (impactMarker && impactMaterial) {
          next.addLabel('podium', 'result+=0.08')
            .to(impactMarker.scale, { x: 1.42, y: 1.42, z: 1, duration: 0.2, ease: 'back.out(1.25)' }, 'podium')
            .to(impactMaterial, { opacity: 0, duration: 0.22, ease: 'power2.out' }, 'podium+=0.08');
        }
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('TETRIS3D_RESULT_MOTION_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function notifyContextLost(reason) {
    if (contextWasLost || disposed) return true;
    contextWasLost = true;
    suspended = true;
    if (runtimeQualityAdapter) runtimeQualityAdapter.contextLost();
    readyAnnounced = false;
    cancelQueuedResize();
    killMotion(false);
    settleStaticPose();
    setReadOnlyCanvas();
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
      if (context && normalizeQuality(safeRead(context, 'quality'))) quality = normalizeQuality(safeRead(context, 'quality'));
      if (context && safeRead(context, 'reducedMotion') === true) reducedMotion = true;
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
      if (!canvas || typeof canvas.addEventListener !== 'function') throw adapterError('TETRIS3D_INVALID_CANVAS');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('role', 'presentation');
      canvas.tabIndex = -1;
      if (canvas.style) {
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.pointerEvents = 'none';
      }
      mountElement.appendChild(canvas);
      createWell();
      gsapContext = typeof gsap.context === 'function' ? gsap.context(() => {}, mountElement) : null;
      applyQuality();
      contextLossHandler = event => {
        if (event && typeof event.preventDefault === 'function') event.preventDefault();
        notifyContextLost('webglcontextlost');
      };
      canvas.addEventListener('webglcontextlost', contextLossHandler);
      installResizeObserver();
      mounted = true;
      mountRuntimeQualityAdapter();
      resize();
      return true;
    } catch (error) {
      reportError(error);
      dispose();
      throw adapterError('TETRIS3D_RENDERER_CONSTRUCTION_FAILED');
    }
  }

  function render(frame) {
    if (disposed || contextWasLost || renderFailed || !mounted) return false;
    const projection = readProjection(frame);
    const fingerprint = projection ? projectionFingerprint(projection) : null;
    if (!projection || (latestRevision !== null && projection.revision < latestRevision) ||
        (latestRevision !== null && projection.revision === latestRevision && fingerprint !== latestFingerprint)) {
      return false;
    }
    killMotion(false);
    if (latestRevision === null || projection.revision > latestRevision) previousProjection = latestProjection;
    latestProjection = projection;
    latestRevision = projection.revision;
    latestFingerprint = fingerprint;
    hasSemanticFrame = true;
    syncWell(projection);
    settleStaticPose();
    return renderOnce();
  }

  function motion(event, context) {
    if (disposed || contextWasLost || renderFailed || suspended || !mounted || !event || typeof event !== 'object') return false;
    const type = String(safeRead(event, 'type') || '').trim().toLowerCase();
    if (!VALID_MOTION.has(type)) return false;
    if (type === 'terminal') {
      if (context && safeRead(context, 'reducedMotion') === true && safeRead(event, 'reducedMotion') !== true) {
        return playResult(Object.freeze({ ...event, reducedMotion: true }));
      }
      return playResult(event);
    }
    if (context && safeRead(context, 'reducedMotion') === true && safeRead(event, 'reducedMotion') !== true) {
      return playLockMotion(Object.freeze({ ...event, reducedMotion: true }));
    }
    return playLockMotion(event);
  }

  function setQuality(nextQuality) {
    if (disposed || contextWasLost || renderFailed) return false;
    const normalized = normalizeQuality(nextQuality);
    if (!normalized) return false;
    quality = normalized;
    killMotion(false);
    settleStaticPose();
    applyQuality();
    resize();
    if (runtimeQualityAdapter && !applyingRuntimeQuality) runtimeQualityAdapter.setQuality(normalized);
    return true;
  }

  function environment(value, context) {
    if (disposed || contextWasLost || renderFailed || !safeRecord(value)) return false;
    const nextReducedMotion = safeRead(value, 'reducedMotion');
    if (typeof nextReducedMotion !== 'boolean') return false;
    const changed = reducedMotion !== nextReducedMotion || (context && safeRead(context, 'reducedMotion') === true && !reducedMotion);
    reducedMotion = nextReducedMotion || !!(context && safeRead(context, 'reducedMotion') === true);
    if (changed || reducedMotion) {
      killMotion(false);
      settleStaticPose();
    }
    if (runtimeQualityAdapter) runtimeQualityAdapter.environment({ reducedMotion });
    if (hasSemanticFrame) renderOnce();
    return true;
  }

  function suspend() {
    if (disposed || contextWasLost || renderFailed) return false;
    suspended = true;
    killMotion(false);
    settleStaticPose();
    setReadOnlyCanvas();
    if (runtimeQualityAdapter) runtimeQualityAdapter.suspend();
    return true;
  }

  function resume() {
    if (disposed || contextWasLost || renderFailed) return false;
    suspended = false;
    if (runtimeQualityAdapter) runtimeQualityAdapter.resume();
    setReadOnlyCanvas();
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
    settleStaticPose();
    setReadOnlyCanvas();
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
    handledMotionEventIds.clear();
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
    directionalLight = null;
    lockedBlocks = null;
    activeBlocks = null;
    activeMaterial = null;
    impactMarker = null;
    impactMaterial = null;
    instanceDummy = null;
    latestProjection = null;
    previousProjection = null;
    latestRevision = null;
    latestFingerprint = null;
    hasSemanticFrame = false;
    readyAnnounced = false;
    initialCameraEntrancePending = false;
    initialCameraEntrancePrepared = false;
    motionRevision = null;
    mounted = false;
    return true;
  }

  return Object.freeze({
    id: 'tetris-three-r185',
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
