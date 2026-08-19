/**
 * Xiangqi Ghost3D renderer island.
 *
 * This adapter owns only its procedural Three scene and finite GSAP work. It
 * receives frozen presentation data after Xiangqi has committed or accepted a
 * state; it never creates game input or writes authority state.
 */
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';

const ROWS = 10;
const COLS = 9;
const MAX_PIECES = 32;
const GRID_SPACING = 1.08;
const BOARD_WIDTH = (COLS - 1) * GRID_SPACING;
const BOARD_DEPTH = (ROWS - 1) * GRID_SPACING;
const BOARD_SIZE = Object.freeze({ x: BOARD_WIDTH + 1.3, z: BOARD_DEPTH + 1.3 });
const DEFAULT_CAMERA = Object.freeze({ x: 0, y: 14.8, z: 13.6 });
const VALID_PIECE_TYPES = new Set(['k', 'a', 'e', 'h', 'r', 'c', 'p']);
// Presentation events are emitted only after a frozen semantic frame has been
// accepted by Ghost3D Foundation.  `piece_moved` carries the committed move
// plus capture/check metadata; `terminal` owns the finite result camera.  The
// standalone `check` form remains useful for a restored frame that has no
// motion path, but it never mutates the board.
const VALID_MOTION = new Set(['piece_moved', 'check', 'terminal']);
const VALID_SOURCES = new Set(['local', 'live', 'room-restored', 'reconnect', 'spectator-bootstrap']);
const ONLINE_SOURCES = new Set(['live', 'room-restored', 'reconnect', 'spectator-bootstrap']);

export const XIANGQI_3D_QUALITY = Object.freeze({
  HIGH: 'HIGH',
  BALANCED: 'BALANCED',
  LOW: 'LOW'
});

const VALID_QUALITY = new Set(Object.values(XIANGQI_3D_QUALITY));
const SIDE_COLOURS = Object.freeze([0xd64943, 0x263d5b]);
const PHASE_COLOURS = Object.freeze([0x6d90cc, 0x62a37c, 0xe4ab4b, 0xd6675d, 0x9d79c7, 0x5aa9a6, 0x6f6874]);
const PIECE_MARKER_PROFILES = Object.freeze({
  k: Object.freeze({ scale:Object.freeze([1,1,1]), rotation:Object.freeze([0,Math.PI/4,0]) }),
  a: Object.freeze({ scale:Object.freeze([1,1,1]), rotation:Object.freeze([0,Math.PI/4,0]) }),
  e: Object.freeze({ scale:Object.freeze([1.2,.62,.9]), rotation:Object.freeze([0,0,0]) }),
  h: Object.freeze({ scale:Object.freeze([.72,1.12,1.18]), rotation:Object.freeze([0,Math.PI/7,0]) }),
  r: Object.freeze({ scale:Object.freeze([1,1,1]), rotation:Object.freeze([0,Math.PI/4,0]) }),
  c: Object.freeze({ scale:Object.freeze([.72,.72,1.28]), rotation:Object.freeze([Math.PI/2,0,0]) }),
  p: Object.freeze({ scale:Object.freeze([.82,.58,.82]), rotation:Object.freeze([0,0,0]) }),
});

function adapterError(code) {
  const error = new Error(code);
  error.name = 'Xiangqi3DAdapterError';
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

function makeSurfaceTexture(palette) {
  if (typeof document === 'undefined' || typeof THREE.CanvasTexture !== 'function') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return null;
    const gradient = context.createLinearGradient(0, 0, 0, 256);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.48, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    context.globalAlpha = .18;
    context.strokeStyle = palette[3] || '#ffffff';
    context.lineWidth = 2;
    for (let index = -256; index < 512; index += 36) {
      context.beginPath();
      context.moveTo(0, index);
      context.quadraticCurveTo(96, index - 16, 256, index + 12);
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
  const cap = quality === XIANGQI_3D_QUALITY.HIGH ? 2 : (quality === XIANGQI_3D_QUALITY.BALANCED ? 1.5 : 1);
  return Math.max(1, Math.min(cap, deviceRatio));
}

function rendererAntialias(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy ? policy.antialias === true : quality !== XIANGQI_3D_QUALITY.LOW;
}

function rendererPowerPreference(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy && policy.powerPreference === 'low-power' ? 'low-power' : 'high-performance';
}

function rendererShadowPolicy(quality) {
  const policy = rendererDevicePolicy(quality);
  return policy ? { enabled:policy.shadowEnabled === true, mapSize:policy.shadowMapSize } :
    { enabled:quality === XIANGQI_3D_QUALITY.HIGH, mapSize:1024 };
}

function fallbackCameraPlan(mode, targetValue, qualityValue, reducedMotionValue) {
  const target = targetValue && typeof targetValue === 'object' ? targetValue : { x:0, y:0, z:0 };
  const quality = normalizeQuality(qualityValue) || XIANGQI_3D_QUALITY.BALANCED;
  const scale = reducedMotionValue === true || quality === XIANGQI_3D_QUALITY.LOW
    ? 0 : (quality === XIANGQI_3D_QUALITY.HIGH ? 1 : .72);
  const plans = {
    overview: { camera:{ ...DEFAULT_CAMERA }, aim:{ x:0, y:0, z:0 }, duration:.22, ease:'power2.inOut' },
    entrance: { camera:{ x:0, y:DEFAULT_CAMERA.y + 3.2, z:DEFAULT_CAMERA.z + 4 }, aim:{ x:0, y:.3, z:0 }, duration:.26, ease:'power2.out' },
    'turn-focus': { camera:{ x:target.x * .18, y:DEFAULT_CAMERA.y - .9, z:DEFAULT_CAMERA.z + target.z * .14 }, aim:{ x:target.x, y:target.y || 0, z:target.z }, duration:.22, ease:'power2.out' },
    'action-follow': { camera:{ x:target.x * .2, y:DEFAULT_CAMERA.y - 1, z:DEFAULT_CAMERA.z + target.z * .16 }, aim:{ x:target.x, y:target.y || 0, z:target.z }, duration:.24, ease:'power2.out' },
    impact: { camera:{ x:target.x * .14, y:DEFAULT_CAMERA.y - .55, z:DEFAULT_CAMERA.z + target.z * .1 }, aim:{ x:target.x, y:(target.y || 0) + .04, z:target.z }, duration:.16, ease:'power2.out' },
    result: { camera:{ x:target.x * .06, y:DEFAULT_CAMERA.y + 1.1, z:DEFAULT_CAMERA.z + 1.35 + target.z * .05 }, aim:{ x:target.x, y:(target.y || 0) + .12, z:target.z }, duration:.42, ease:'power2.inOut' },
  };
  const selected = plans[mode] || plans.overview;
  return { ...selected, mode, animated:selected.duration * scale > 0, duration:selected.duration * scale };
}

function validCell(row, col) {
  return safeInteger(row, 0, ROWS - 1) && safeInteger(col, 0, COLS - 1);
}

function readCoordinate(value) {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const row = value[0];
  const col = value[1];
  return validCell(row, col) ? { row, col } : null;
}

function pieceKey(piece) {
  return piece.playerId + ':' + piece.type + ':' + piece.row + ':' + piece.col;
}

function normalizePiece(value) {
  if (!safeRecord(value)) return null;
  const playerId = safeRead(value, 'p');
  const type = safeRead(value, 't');
  if (!safeInteger(playerId, 0, 1) || typeof type !== 'string' || !VALID_PIECE_TYPES.has(type)) {
    return null;
  }
  return { playerId, type };
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function readOrigin(value) {
  if (!safeRecord(value)) return null;
  const source = safeRead(value, 'source');
  if (typeof source !== 'string' || !VALID_SOURCES.has(source)) return null;
  const matchId = safeRead(value, 'matchId');
  const authorityRevision = safeRead(value, 'authorityRevision');
  const stateHash = safeRead(value, 'stateHash');
  if (!ONLINE_SOURCES.has(source)) {
    if ((matchId !== undefined && !nonEmptyString(matchId)) ||
        (authorityRevision !== undefined && !safeInteger(authorityRevision, 0, Number.MAX_SAFE_INTEGER)) ||
        (stateHash !== undefined && !nonEmptyString(stateHash))) {
      return null;
    }
    return {
      source,
      matchId: matchId === undefined ? null : matchId,
      authorityRevision: authorityRevision === undefined ? null : authorityRevision,
      stateHash: stateHash === undefined ? null : stateHash
    };
  }
  if (!nonEmptyString(matchId) || !safeInteger(authorityRevision, 0, Number.MAX_SAFE_INTEGER) || !nonEmptyString(stateHash)) {
    return null;
  }
  return { source, matchId, authorityRevision, stateHash };
}

function readLastMove(value) {
  if (value === null) return null;
  if (!safeRecord(value)) return undefined;
  const from = readCoordinate(safeRead(value, 'from'));
  const to = readCoordinate(safeRead(value, 'to'));
  const captureValue = safeRead(value, 'capture');
  const capture = captureValue === null ? null : normalizePiece(captureValue);
  if (!from || !to || (from.row === to.row && from.col === to.col) || (captureValue !== null && !capture)) {
    return undefined;
  }
  return { from, to, capture };
}

function isDeepFrozen(value, seen) {
  if (!value || typeof value !== 'object') return true;
  const visited = seen || new Set();
  if (visited.has(value)) return false;
  try {
    if (!Object.isFrozen(value)) return false;
    visited.add(value);
    const keys = Array.isArray(value) ? Array.from({ length: value.length }, (_item, index) => index) : Object.keys(value);
    const frozen = keys.every(key => isDeepFrozen(value[key], visited));
    visited.delete(value);
    return frozen;
  } catch (_error) {
    return false;
  }
}

function readProjection(frame) {
  if (!safeRecord(frame) || !isDeepFrozen(frame) || safeRead(frame, 'kind') !== 'xiangqi-3d-frame-v1') return null;
  const revision = safeRead(frame, 'revision');
  const origin = readOrigin(safeRead(frame, 'origin'));
  const board = safeRead(frame, 'board');
  const current = safeRead(frame, 'current');
  const moveNumber = safeRead(frame, 'moveNumber');
  const lastMove = readLastMove(safeRead(frame, 'lastMove'));
  const check = safeRead(frame, 'check');
  const terminal = safeRead(frame, 'terminal');
  const winner = safeRead(frame, 'winner');
  if (!safeInteger(revision, 0, Number.MAX_SAFE_INTEGER) || !origin || !Array.isArray(board) || board.length !== ROWS ||
      !safeInteger(current, 0, 1) || !safeInteger(moveNumber, 0, Number.MAX_SAFE_INTEGER) || lastMove === undefined ||
      typeof check !== 'boolean' || typeof terminal !== 'boolean' || !safeInteger(winner, -1, 1)) {
    return null;
  }
  const pieces = [];
  for (let row = 0; row < ROWS; row += 1) {
    const cells = board[row];
    if (!Array.isArray(cells) || cells.length !== COLS) return null;
    for (let col = 0; col < COLS; col += 1) {
      const cell = cells[col];
      if (cell === null) continue;
      const piece = normalizePiece(cell);
      if (!piece || pieces.length >= MAX_PIECES) return null;
      pieces.push({ ...piece, row, col, visible: true });
    }
  }
  return {
    revision,
    origin,
    pieces,
    current,
    moveNumber,
    lastMove,
    check,
    stage: terminal ? 'terminal' : (check ? 'check' : 'turn'),
    terminal,
    winner
  };
}

function readMotion(event, revision) {
  if (!safeRecord(event) || !isDeepFrozen(event) || safeRead(event, 'type') !== 'piece_moved') return null;
  const eventRevision = safeRead(event, 'revision');
  const eventId = nonEmptyString(safeRead(event, 'eventId'));
  const playerId = safeRead(event, 'player');
  const from = readCoordinate(safeRead(event, 'from'));
  const to = readCoordinate(safeRead(event, 'to'));
  const capture = safeRead(event, 'capture');
  const check = safeRead(event, 'check');
  if (eventRevision !== revision || !eventId || !safeInteger(playerId, 0, 1) || !from || !to ||
      (from.row === to.row && from.col === to.col) || typeof capture !== 'boolean' ||
      (check !== undefined && typeof check !== 'boolean')) {
    return null;
  }
  return { eventId, playerId, from, to, capture, check:check === true };
}

function readCheckMotion(event, revision) {
  if (!safeRecord(event) || !isDeepFrozen(event) || safeRead(event, 'type') !== 'check') return null;
  const eventRevision = safeRead(event, 'revision');
  const eventId = nonEmptyString(safeRead(event, 'eventId'));
  const playerId = safeRead(event, 'player');
  const targetValue = safeRead(event, 'target');
  const target = targetValue === undefined || targetValue === null ? null : readCoordinate(targetValue);
  if (eventRevision !== revision || !eventId || !safeInteger(playerId, 0, 1) ||
      (targetValue !== undefined && targetValue !== null && !target)) return null;
  return { eventId, playerId, target };
}

function readTerminalMotion(event, revision) {
  if (!safeRecord(event) || !isDeepFrozen(event) || safeRead(event, 'type') !== 'terminal') return null;
  const eventRevision = safeRead(event, 'revision');
  const eventId = nonEmptyString(safeRead(event, 'eventId'));
  const winner = safeRead(event, 'winner');
  const outcome = safeRead(event, 'outcome');
  if (eventRevision !== revision || !eventId || !safeInteger(winner, -1, 1) ||
      (outcome !== 'win' && outcome !== 'draw')) return null;
  return { eventId, winner, outcome };
}

function projectionFingerprint(projection) {
  return JSON.stringify([
    projection.revision,
    projection.origin.source,
    projection.origin.matchId,
    projection.origin.authorityRevision,
    projection.origin.stateHash,
    projection.current,
    projection.moveNumber,
    projection.lastMove && [
      projection.lastMove.from.row,
      projection.lastMove.from.col,
      projection.lastMove.to.row,
      projection.lastMove.to.col,
      projection.lastMove.capture && [projection.lastMove.capture.playerId, projection.lastMove.capture.type]
    ],
    projection.check,
    projection.terminal,
    projection.winner,
    projection.pieces.map(piece => [piece.playerId, piece.type, piece.row, piece.col])
  ]);
}

function phaseIndex(stage) {
  return ['turn', 'select', 'move', 'capture', 'check', 'clock', 'terminal'].indexOf(stage);
}

export function isXiangqi3DSupported() {
  try {
    return !!WebGL && typeof WebGL.isWebGL2Available === 'function' && WebGL.isWebGL2Available() === true;
  } catch (_error) {
    return false;
  }
}

export function createXiangqi3DAdapter(options) {
  const opts = safeRecord(options) ? options : null;
  if (!opts) throw adapterError('XIANGQI3D_INVALID_OPTIONS');
  const mountElement = safeRead(opts, 'mountElement');
  if (!mountElement || typeof mountElement.appendChild !== 'function' || typeof mountElement.removeChild !== 'function') {
    throw adapterError('XIANGQI3D_INVALID_MOUNT_ELEMENT');
  }
  const initialQuality = safeRead(opts, 'quality') === undefined
    ? XIANGQI_3D_QUALITY.HIGH
    : normalizeQuality(safeRead(opts, 'quality'));
  if (!initialQuality) throw adapterError('XIANGQI3D_INVALID_QUALITY');
  if (!isXiangqi3DSupported()) throw adapterError('XIANGQI3D_WEBGL2_UNAVAILABLE');

  const onReady = callbackOption(opts, 'onReady');
  const onError = callbackOption(opts, 'onError');
  const onContextLost = callbackOption(opts, 'onContextLost');
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
  let tableGroup = null;
  let tableBase = null;
  let directionalLight = null;
  let centerIndicator = null;
  let centerBody = null;
  let impactCue = null;
  let impactCueMaterial = null;
  let impactCueGeometry = null;
  let resizeObserver = null;
  let resizeFallbackWindow = null;
  let resizeQueued = false;
  let resizeGeneration = 0;
  let contextLossHandler = null;
  let activeMotion = null;
  let motionRevision = null;
  let motionGeneration = 0;
  let animationLoopActive = false;
  let latestProjection = null;
  let latestRevision = null;
  let latestFingerprint = null;
  let gsapContext = null;
  let runtimeQualityAdapter = null;
  let applyingRuntimeQuality = false;
  let initialCameraEntrancePending = true;
  let initialCameraEntrancePrepared = false;
  let pieceBodyGeometry = null;
  let pieceCapGeometry = null;
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const pieceNodes = new Map();
  const pieceMarkerGeometries = new Map();
  const handledMotionEventIds = new Set();
  const pieceMaterials = [];
  const pieceMarkerMaterials = [];
  const phaseMaterials = [];

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

  function setCameraDefault() {
    if (!camera || !cameraAim) return;
    camera.position.set(DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z);
    cameraAim.set(0, 0, 0);
  }

  function cameraPlan(mode, targetValue) {
    const win = runtimeWindow();
    const rig = win && win.TabletopCameraRig;
    if (rig && typeof rig.plan === 'function') {
      try {
        const planned = rig.plan('xiangqi', mode, targetValue, { quality, reducedMotion });
        if (planned && planned.camera && planned.aim && Number.isFinite(planned.duration)) return planned;
      } catch (_error) {}
    }
    return fallbackCameraPlan(mode, targetValue, quality, reducedMotion);
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

  function prepareInitialCameraEntrance() {
    if (!initialCameraEntrancePending || !hasSemanticFrame || !camera || !cameraAim) return false;
    initialCameraEntrancePending = false;
    const plan = cameraPlan('entrance', { x:0, y:0, z:0 });
    if (!plan.animated) {
      setCameraDefault();
      return false;
    }
    camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
    cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
    initialCameraEntrancePrepared = true;
    return true;
  }

  function setReadOnlyCanvas() {
    if (canvas && canvas.style) canvas.style.pointerEvents = 'none';
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

  function boardPoint(row, col) {
    return {
      x: (col - (COLS - 1) / 2) * GRID_SPACING,
      y: 0,
      z: (row - (ROWS - 1) / 2) * GRID_SPACING
    };
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
    if (tableBase) tableBase.receiveShadow = high;
    pieceNodes.forEach(piece => setObjectShadow(piece.group, high));
  }

  function settleStaticPose() {
    setCameraDefault();
    pieceNodes.forEach(piece => {
      const point = boardPoint(piece.row, piece.col);
      piece.group.position.set(point.x, point.y, point.z);
      piece.group.scale.set(1, 1, 1);
    });
    if (impactCue && impactCueMaterial) {
      impactCue.visible = false;
      impactCue.scale.set(1, 1, 1);
      impactCueMaterial.opacity = 0;
    }
    if (centerIndicator) {
      centerIndicator.position.set(BOARD_WIDTH / 2 + 0.38, 0.16, 0);
      centerIndicator.scale.set(1, 1, 1);
    }
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

  function playInitialCameraEntrance() {
    if (!initialCameraEntrancePrepared || disposed || contextWasLost || suspended || renderFailed) return false;
    initialCameraEntrancePrepared = false;
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const plan = cameraPlan('overview', { x:0, y:0, z:0 });
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
        const next = gsap.timeline({ paused:true, defaults:{ overwrite:'auto' }, onComplete:complete });
        next.addLabel('entrance', 0);
        tweenCamera(next, plan, 'entrance');
        next.addLabel('overview', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('XIANGQI3D_CAMERA_ENTRANCE_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
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
    [camera && camera.position, cameraAim].filter(Boolean).forEach(target => gsap.killTweensOf(target));
    pieceNodes.forEach(piece => {
      gsap.killTweensOf(piece.group.position);
      gsap.killTweensOf(piece.group.scale);
    });
  }

  function killMotion(renderAfterKill) {
    motionGeneration += 1;
    if (activeMotion && typeof activeMotion.kill === 'function') activeMotion.kill();
    activeMotion = null;
    motionRevision = null;
    killKnownTweens();
    stopAnimationLoop();
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
    const create = () => {
      timeline = build();
    };
    if (gsapContext && typeof gsapContext.add === 'function') gsapContext.add(create);
    else create();
    return timeline;
  }

  function createBoard() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111825);
    if (typeof THREE.Fog === 'function') scene.fog = new THREE.Fog(0x111825, 20, 42);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    cameraAim = new THREE.Vector3(0, 0, 0);
    setCameraDefault();

    const hemisphere = new THREE.HemisphereLight(0xddefff, 0x38271c, 1.24);
    hemisphere.position.set(0, 12, 0);
    directionalLight = new THREE.DirectionalLight(0xffefd4, 2.05);
    directionalLight.position.set(5.4, 10.8, 7.2);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(hemisphere, directionalLight, directionalLight.target);
    if (typeof THREE.DirectionalLight === 'function') {
      const rimLight = new THREE.DirectionalLight(0x8fc5ff, .48);
      rimLight.position.set(-7, 6, -8);
      rimLight.target.position.set(0, 0, 0);
      scene.add(rimLight, rimLight.target);
    }

    tableGroup = new THREE.Group();
    scene.add(tableGroup);
    const baseGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_SIZE.x, 0.46, BOARD_SIZE.z));
    const baseMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xe1c89d, roughness: 0.62, metalness: 0.02 }));
    applySurfaceTexture(baseMaterial, ['#e8c990', '#b78353', '#5d3f34', '#fff2ce']);
    tableBase = new THREE.Mesh(baseGeometry, baseMaterial);
    tableBase.position.y = -0.25;
    tableGroup.add(tableBase);

    const boardGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_WIDTH + 0.42, 0.1, BOARD_DEPTH + 0.42));
    const boardMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf8e5bf, roughness: 0.55, metalness: 0.01 }));
    applySurfaceTexture(boardMaterial, ['#f9e8bd', '#e4c98e', '#a77b55', '#fff7dd']);
    const boardSurface = new THREE.Mesh(boardGeometry, boardMaterial);
    boardSurface.position.y = 0.01;
    tableGroup.add(boardSurface);

    const gridMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x563d2b, roughness: 0.5, metalness: 0 }));
    const horizontalGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_WIDTH, 0.028, 0.034));
    const verticalBorderGeometry = ownGeometry(new THREE.BoxGeometry(0.034, 0.028, BOARD_DEPTH));
    const riverSegmentDepth = (BOARD_DEPTH - GRID_SPACING) / 2;
    const verticalRiverSegmentGeometry = ownGeometry(new THREE.BoxGeometry(0.034, 0.028, riverSegmentDepth));
    const palaceDiagonalGeometry = ownGeometry(new THREE.BoxGeometry(Math.hypot(2 * GRID_SPACING, 2 * GRID_SPACING), 0.028, 0.034));
    for (let row = 0; row < ROWS; row += 1) {
      const line = new THREE.Mesh(horizontalGeometry, gridMaterial);
      const point = boardPoint(row, 0);
      line.position.set(0, 0.08, point.z);
      line.name = 'xiangqi-map-grid-horizontal';
      tableGroup.add(line);
    }
    for (let col = 0; col < COLS; col += 1) {
      const point = boardPoint(0, col);
      if (col === 0 || col === COLS - 1) {
        const border = new THREE.Mesh(verticalBorderGeometry, gridMaterial);
        border.position.set(point.x, 0.08, 0);
        border.name = 'xiangqi-map-grid-border';
        tableGroup.add(border);
        continue;
      }
      [-1, 1].forEach(side => {
        const segment = new THREE.Mesh(verticalRiverSegmentGeometry, gridMaterial);
        segment.position.set(point.x, 0.08, side * (riverSegmentDepth + GRID_SPACING) / 2);
        segment.name = 'xiangqi-map-grid-river-segment';
        tableGroup.add(segment);
      });
    }

    [[0, 3, 2, 5], [0, 5, 2, 3], [7, 3, 9, 5], [7, 5, 9, 3]].forEach(([fromRow, fromCol, toRow, toCol]) => {
      const from = boardPoint(fromRow, fromCol);
      const to = boardPoint(toRow, toCol);
      const diagonal = new THREE.Mesh(palaceDiagonalGeometry, gridMaterial);
      diagonal.position.set((from.x + to.x) / 2, 0.08, (from.z + to.z) / 2);
      diagonal.rotation.y = -Math.atan2(to.z - from.z, to.x - from.x);
      diagonal.name = 'xiangqi-map-palace-diagonal';
      tableGroup.add(diagonal);
    });

    const riverGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_WIDTH + 0.12, 0.014, GRID_SPACING * 0.68));
    const riverMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xd8edf1, roughness: 0.58, metalness: 0.01 }));
    const river = new THREE.Mesh(riverGeometry, riverMaterial);
    river.position.set(0, 0.066, 0);
    river.name = 'xiangqi-map-river';
    tableGroup.add(river);

    const centerGeometry = ownGeometry(new THREE.BoxGeometry(0.34, 0.08, 0.34));
    const centerMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xe8e0d2, roughness: 0.32, metalness: 0.03 }));
    centerIndicator = new THREE.Group();
    centerBody = new THREE.Mesh(centerGeometry, centerMaterial);
    centerIndicator.add(centerBody);
    centerIndicator.position.set(BOARD_WIDTH / 2 + 0.38, 0.16, 0);
    tableGroup.add(centerIndicator);

    // A small, renderer-local amber plate is the capture impact language. It
    // is deliberately geometry-light and inert until an accepted motion event
    // asks for it; the DOM board remains the only input surface.
    impactCueGeometry = ownGeometry(new THREE.BoxGeometry(.82, .045, .82));
    impactCueMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xf59e0b, roughness: .28, metalness: .05, transparent: true, opacity: 0,
    }));
    impactCue = new THREE.Mesh(impactCueGeometry, impactCueMaterial);
    impactCue.position.y = .14;
    impactCue.visible = false;
    tableGroup.add(impactCue);

    SIDE_COLOURS.forEach(colour => {
      pieceMaterials.push(ownMaterial(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.3, metalness: 0.08 })));
    });
    [0xffe7cb, 0xd9ecff].forEach(colour => {
      pieceMarkerMaterials.push(ownMaterial(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.24, metalness: 0.12 })));
    });
    PHASE_COLOURS.forEach(colour => {
      phaseMaterials.push(ownMaterial(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.04 })));
    });
    pieceBodyGeometry = ownGeometry(new THREE.CylinderGeometry(0.3, 0.36, 0.18, 24));
    pieceCapGeometry = ownGeometry(new THREE.SphereGeometry(0.28, 20, 12));
    pieceMarkerGeometries.set('k', ownGeometry(new THREE.CylinderGeometry(0.1, 0.18, 0.18, 6)));
    pieceMarkerGeometries.set('a', ownGeometry(new THREE.BoxGeometry(0.21, 0.12, 0.21)));
    pieceMarkerGeometries.set('e', ownGeometry(new THREE.SphereGeometry(0.16, 12, 8)));
    pieceMarkerGeometries.set('h', ownGeometry(new THREE.BoxGeometry(0.14, 0.2, 0.22)));
    pieceMarkerGeometries.set('r', ownGeometry(new THREE.CylinderGeometry(0.17, 0.17, 0.16, 4)));
    pieceMarkerGeometries.set('c', ownGeometry(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 12)));
    pieceMarkerGeometries.set('p', ownGeometry(new THREE.SphereGeometry(0.15, 10, 7)));
  }

  function createPiece(piece) {
    const group = new THREE.Group();
    const material = pieceMaterials[piece.playerId] || pieceMaterials[0];
    const body = new THREE.Mesh(pieceBodyGeometry, material);
    body.position.y = 0.13;
    const cap = new THREE.Mesh(pieceCapGeometry, material);
    cap.position.y = 0.27;
    cap.scale.set(1, 0.5, 1);
    const markerGeometry = pieceMarkerGeometries.get(piece.type) || pieceMarkerGeometries.get('p');
    const marker = new THREE.Mesh(markerGeometry, pieceMarkerMaterials[piece.playerId] || pieceMarkerMaterials[0]);
    const markerProfile = PIECE_MARKER_PROFILES[piece.type] || PIECE_MARKER_PROFILES.p;
    marker.position.y = 0.43;
    marker.scale.set(markerProfile.scale[0], markerProfile.scale[1], markerProfile.scale[2]);
    marker.rotation.set(markerProfile.rotation[0], markerProfile.rotation[1], markerProfile.rotation[2]);
    group.add(body, cap, marker);
    tableGroup.add(group);
    setObjectShadow(group, quality === XIANGQI_3D_QUALITY.HIGH);
    return { group, playerId: piece.playerId, type: piece.type, row: piece.row, col: piece.col, visible: piece.visible };
  }

  function syncPieces(projection) {
    const retained = new Map(pieceNodes);
    const nextNodes = new Map();
    const pending = [];
    projection.pieces.forEach(piece => {
      const key = pieceKey(piece);
      let node = retained.get(key);
      if (node) retained.delete(key);
      else pending.push({ key, piece });
      if (!node) return;
      node.playerId = piece.playerId;
      node.type = piece.type;
      node.row = piece.row;
      node.col = piece.col;
      node.visible = piece.visible;
      node.group.visible = piece.visible;
      const point = boardPoint(piece.row, piece.col);
      node.group.position.set(point.x, point.y, point.z);
      node.group.scale.set(1, 1, 1);
      nextNodes.set(key, node);
    });
    pending.forEach(({ key, piece }) => {
      const candidates = Array.from(retained.entries()).filter(([_oldKey, node]) =>
        node.playerId === piece.playerId && node.type === piece.type);
      let node = null;
      if (candidates.length === 1) {
        const [oldKey, previous] = candidates[0];
        retained.delete(oldKey);
        node = previous;
      }
      if (!node) {
        node = createPiece(piece);
      }
      node.playerId = piece.playerId;
      node.type = piece.type;
      node.row = piece.row;
      node.col = piece.col;
      node.visible = piece.visible;
      node.group.visible = piece.visible;
      const point = boardPoint(piece.row, piece.col);
      node.group.position.set(point.x, point.y, point.z);
      node.group.scale.set(1, 1, 1);
      nextNodes.set(key, node);
    });
    retained.forEach(piece => tableGroup.remove(piece.group));
    pieceNodes.clear();
    nextNodes.forEach((piece, key) => pieceNodes.set(key, piece));
  }

  function syncCenter(projection) {
    if (!centerIndicator) return;
    const index = phaseIndex(projection.stage);
    if (centerBody) centerBody.material = phaseMaterials[index >= 0 ? index : 0] || phaseMaterials[0];
    centerIndicator.rotation.set(0, (projection.revision % 8) * Math.PI / 4, 0);
    centerIndicator.scale.set(1, 1, 1);
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

  function scheduleResize() {
    if (resizeQueued || disposed || contextWasLost) return;
    resizeQueued = true;
    const generation = resizeGeneration;
    const flush = () => {
      resizeQueued = false;
      if (generation !== resizeGeneration || disposed || contextWasLost) return;
      resize();
    };
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
    }
  }

  function removeResizeObserver() {
    if (resizeObserver && typeof resizeObserver.disconnect === 'function') resizeObserver.disconnect();
    resizeObserver = null;
    if (resizeFallbackWindow && typeof resizeFallbackWindow.removeEventListener === 'function') {
      resizeFallbackWindow.removeEventListener('resize', scheduleResize);
    }
    resizeFallbackWindow = null;
    resizeGeneration += 1;
    resizeQueued = false;
  }

  function sameCell(first, second) {
    return !!first && !!second && first.row === second.row && first.col === second.col;
  }

  function projectionPieceAt(projection, cell) {
    if (!projection || !cell) return null;
    return projection.pieces.find(piece => piece.row === cell.row && piece.col === cell.col) || null;
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

  function pieceForMotion(motion) {
    const target = projectionPieceAt(latestProjection, motion && motion.to);
    if (!target || target.playerId !== motion.playerId) return null;
    return pieceNodes.get(pieceKey(target));
  }

  function worldPointForCell(cell) {
    const point = boardPoint(cell && cell.row || 0, cell && cell.col || 0);
    return new THREE.Vector3(point.x, point.y, point.z);
  }

  function kingTarget(playerId) {
    if (!latestProjection) return new THREE.Vector3(0, 0, 0);
    const king = latestProjection.pieces.find(piece => piece.playerId === playerId && piece.type === 'k');
    return king ? worldPointForCell(king) : new THREE.Vector3(0, 0, 0);
  }

  function kingNode(playerId) {
    if (!latestProjection) return null;
    const king = latestProjection.pieces.find(piece => piece.playerId === playerId && piece.type === 'k');
    return king ? pieceNodes.get(pieceKey(king)) : null;
  }

  function primeImpactCue(target) {
    if (!impactCue || !impactCueMaterial) return;
    impactCue.position.set(target.x, target.y + .14, target.z);
    impactCue.scale.set(.5, .5, .5);
    impactCueMaterial.opacity = .78;
    impactCue.visible = true;
  }

  function primeCheckCue() {
    if (!centerIndicator) return;
    centerIndicator.scale.set(1.24, 1.24, 1.24);
  }

  function playCheckFocus(event) {
    const check = readCheckMotion(event, latestRevision);
    if (!check || !latestProjection || latestProjection.terminal || !latestProjection.check || !claimMotionEvent(check.eventId)) return false;
    const target = check.target ? worldPointForCell(check.target) : kingTarget(check.playerId);
    const plan = cameraPlan('turn-focus', target);
    const instant = safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || reducedMotion || quality === XIANGQI_3D_QUALITY.LOW;
    if (instant || !plan.animated) {
      killMotion(false);
      primeCheckCue();
      return renderOnce();
    }
    killMotion(false);
    const generation = ++motionGeneration;
    const revision = latestRevision;
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
        const next = gsap.timeline({ paused:true, defaults:{ overwrite:'auto', ease:'power2.out' }, onComplete:complete });
        next.addLabel('check', 0);
        tweenCamera(next, plan, 'check');
        next.to(centerIndicator.scale, { x:1.48, y:1.48, z:1.48, duration:.14, ease:'back.out(1.3)' }, 'check')
          .to(centerIndicator.scale, { x:1.18, y:1.18, z:1.18, duration:.16, ease:'power2.out' }, 'check+=.14')
          .addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('XIANGQI3D_CHECK_MOTION_UNAVAILABLE'));
    primeCheckCue();
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function playPieceMotion(event) {
    const motion = readMotion(event, latestRevision);
    if (!motion || !latestProjection) return false;
    if (latestProjection.terminal || !latestProjection.lastMove ||
        !sameCell(latestProjection.lastMove.from, motion.from) || !sameCell(latestProjection.lastMove.to, motion.to) ||
        (latestProjection.lastMove.capture !== null) !== motion.capture || projectionPieceAt(latestProjection, motion.from)) {
      return false;
    }
    const piece = pieceForMotion(motion);
    if (!piece || !piece.visible) return false;
    if (!claimMotionEvent(motion.eventId)) return false;
    if (safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || reducedMotion || quality === XIANGQI_3D_QUALITY.LOW) {
      settleStaticPose();
      if (motion.check) primeCheckCue();
      return renderOnce();
    }

    killMotion(false);
    settleStaticPose();
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const start = boardPoint(motion.from.row, motion.from.col);
    const target = boardPoint(motion.to.row, motion.to.col);
    const worldTarget = new THREE.Vector3(target.x, target.y, target.z);
    const focusPlan = cameraPlan(motion.capture ? 'impact' : 'action-follow', worldTarget);
    const checkTarget = kingTarget(latestProjection.current);
    const checkPlan = cameraPlan('turn-focus', checkTarget);
    piece.group.position.set(start.x, start.y, start.z);
    piece.group.scale.set(0.9, 0.9, 0.9);
    if (motion.capture) primeImpactCue(worldTarget);
    if (motion.check) primeCheckCue();
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
        next.addLabel('focus', 0);
        tweenCamera(next, focusPlan, 'focus');
        next.addLabel('travel', focusPlan.animated ? 'focus+=0.05' : 'focus');
        next.to(piece.group.position, { x: target.x, y: target.y + 0.08, z: target.z, duration: 0.16 }, 'travel')
          .to(piece.group.position, { x: target.x, y: target.y, z: target.z, duration: 0.06 }, '>');
        const settleLabel = 'settle';
        next.addLabel(settleLabel, '>')
          .to(piece.group.scale, { x: 1.14, y: 1.14, z: 1.14, duration: 0.07 }, settleLabel)
          .to(piece.group.scale, { x: 1, y: 1, z: 1, duration: 0.08 }, '>');
        if (motion.capture && impactCue && impactCueMaterial) {
          next.addLabel('impact', 'settle+=0.03')
            .to(impactCue.scale, { x:1.65, y:1.65, z:1.65, duration:.2, ease:'power2.out' }, 'impact')
            .to(impactCueMaterial, { opacity:0, duration:.2, ease:'power2.out' }, 'impact');
        }
        if (motion.check) {
          const checkLabel = motion.capture ? 'check' : 'settle+=0.04';
          next.addLabel('check', checkLabel);
          tweenCamera(next, checkPlan, 'check');
          next.to(centerIndicator.scale, { x:1.48, y:1.48, z:1.48, duration:.14, ease:'back.out(1.3)' }, 'check')
            .to(centerIndicator.scale, { x:1.18, y:1.18, z:1.18, duration:.16, ease:'power2.out' }, 'check+=.14');
        }
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('XIANGQI3D_PIECE_MOTION_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function playResult(event) {
    const terminal = readTerminalMotion(event, latestRevision);
    if (!terminal || !latestProjection || !latestProjection.terminal || terminal.winner !== latestProjection.winner || !claimMotionEvent(terminal.eventId)) return false;
    const target = kingTarget(terminal.winner);
    const plan = cameraPlan('result', target);
    const winnerKing = kingNode(terminal.winner);
    const instant = safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || reducedMotion || quality === XIANGQI_3D_QUALITY.LOW;
    if (instant || !plan.animated) {
      killMotion(false);
      camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
      cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
      if (winnerKing) winnerKing.group.scale.set(1.16, 1.16, 1.16);
      return renderOnce();
    }
    killMotion(false);
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      if (winnerKing) winnerKing.group.scale.set(1.12, 1.12, 1.12);
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    let timeline = null;
    try {
      timeline = makeMotion(() => {
        const next = gsap.timeline({ paused:true, defaults:{ overwrite:'auto', ease:'power2.out' }, onComplete:complete });
        next.addLabel('result', 0);
        tweenCamera(next, plan, 'result');
        if (winnerKing) {
          next.to(winnerKing.group.scale, { x:1.2, y:1.2, z:1.2, duration:.2, ease:'back.out(1.25)' }, 'result+=.08')
            .to(winnerKing.group.scale, { x:1.12, y:1.12, z:1.12, duration:.18, ease:'power2.out' }, 'result+=.28');
        }
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('XIANGQI3D_RESULT_MOTION_UNAVAILABLE'));
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
      if (!canvas || typeof canvas.addEventListener !== 'function') throw adapterError('XIANGQI3D_INVALID_CANVAS');
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
      createBoard();
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
      throw adapterError('XIANGQI3D_RENDERER_CONSTRUCTION_FAILED');
    }
  }

  function render(frame) {
    if (disposed || contextWasLost || renderFailed || !mounted) return false;
    const projection = readProjection(frame);
    const fingerprint = projection ? projectionFingerprint(projection) : null;
    // Foundation may redraw its current immutable frame after a quality,
    // environment, or resume configuration pass. That same-revision repaint
    // is safe only when its complete public projection is unchanged.
    if (!projection || (latestRevision !== null && projection.revision < latestRevision) ||
        (latestRevision !== null && projection.revision === latestRevision && fingerprint !== latestFingerprint)) {
      return false;
    }
    killMotion(false);
    latestProjection = projection;
    latestRevision = projection.revision;
    latestFingerprint = fingerprint;
    hasSemanticFrame = true;
    syncPieces(projection);
    syncCenter(projection);
    settleStaticPose();
    return renderOnce();
  }

  function motion(event, context) {
    if (disposed || contextWasLost || renderFailed || suspended || !mounted || !event || typeof event !== 'object') return false;
    const type = safeRead(event, 'type');
    if (!VALID_MOTION.has(type)) return false;
    if (type === 'terminal') {
      if (context && safeRead(context, 'reducedMotion') === true && safeRead(event, 'reducedMotion') !== true) {
        return playResult(Object.freeze({ ...event, reducedMotion:true }));
      }
      return playResult(event);
    }
    if (type === 'check') {
      if (context && safeRead(context, 'reducedMotion') === true && safeRead(event, 'reducedMotion') !== true) {
        return playCheckFocus(Object.freeze({ ...event, reducedMotion:true }));
      }
      return playCheckFocus(event);
    }
    if (context && safeRead(context, 'reducedMotion') === true && safeRead(event, 'reducedMotion') !== true) {
      return playPieceMotion(Object.freeze({ ...event, reducedMotion: true }));
    }
    return playPieceMotion(event);
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
    pieceNodes.clear();
    pieceMaterials.length = 0;
    pieceMarkerMaterials.length = 0;
    pieceMarkerGeometries.clear();
    phaseMaterials.length = 0;
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
    tableGroup = null;
    tableBase = null;
    directionalLight = null;
    centerIndicator = null;
    centerBody = null;
    impactCue = null;
    impactCueMaterial = null;
    impactCueGeometry = null;
    pieceBodyGeometry = null;
    pieceCapGeometry = null;
    latestProjection = null;
    latestRevision = null;
    latestFingerprint = null;
    handledMotionEventIds.clear();
    readyAnnounced = false;
    hasSemanticFrame = false;
    initialCameraEntrancePending = false;
    initialCameraEntrancePrepared = false;
    mounted = false;
    return true;
  }

  return Object.freeze({
    id: 'xiangqi-three-r185',
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
