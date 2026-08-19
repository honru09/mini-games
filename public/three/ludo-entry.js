/**
 * Ludo Ghost3D renderer island.
 *
 * This Module owns every Three.js, GSAP, DOM, and WebGL value it needs.  It
 * consumes a frozen Ludo presentation projection and can only emit a logical,
 * revision-bound token-selection command.  Rules, transport, rewards, Replay,
 * and persistence stay outside this Adapter.
 */
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';

const TRACK_LENGTH = 52;
const HOME = 56;
const PLAYER_COUNT_MAX = 4;
const TOKENS_PER_PLAYER = 4;
const START = [0, 13, 26, 39];
const BOARD_RADIUS = 6.25;
const BOARD_SIZE = 17.2;
const DEFAULT_CAMERA = Object.freeze({ x: 0, y: 16.4, z: 14.8 });
const VALID_QUALITY = new Set(['HIGH', 'BALANCED', 'LOW']);
const VALID_MOTION = new Set(['piece_moved', 'terminal']);
const COLOUR_KEYS = Object.freeze(['red', 'blue', 'green', 'yellow']);
const COLOURS = Object.freeze([
  Object.freeze({ board: 0xe85c5d, soft: 0xffd7d5, token: 0xd93f45 }),
  Object.freeze({ board: 0x4d8fe9, soft: 0xd9e9ff, token: 0x2e70d1 }),
  Object.freeze({ board: 0x48a86e, soft: 0xd8f6e3, token: 0x2f8654 }),
  Object.freeze({ board: 0xf3ae41, soft: 0xffebc0, token: 0xd88b16 })
]);

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
  error.name = 'Ludo3DAdapterError';
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

function callbackOption(options, name, required) {
  const callback = safeRead(options, name);
  if (callback === undefined && !required) return function noOp() {};
  if (typeof callback !== 'function') {
    throw adapterError(`LUDO3D_INVALID_${name.replace(/[A-Z]/g, letter => `_${letter}`).toUpperCase()}`);
  }
  return callback;
}

function isSafeInteger(value) {
  return Number.isSafeInteger(value);
}

function normalizeQuality(value) {
  const quality = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return VALID_QUALITY.has(quality) ? quality : null;
}

function normalizeSeat(value) {
  return isSafeInteger(value) && value >= 0 && value < PLAYER_COUNT_MAX ? value : null;
}

function normalizeTokenIndex(value) {
  return isSafeInteger(value) && value >= 0 && value < TOKENS_PER_PLAYER ? value : null;
}

function normalizePosition(value) {
  return isSafeInteger(value) && value >= -1 && value <= HOME ? value : null;
}

function normalizeQuarterTurns(value) {
  const turns = Number.isFinite(value) ? Math.trunc(value) : 0;
  return ((turns % 4) + 4) % 4;
}

function normalizeColour(value, fallback) {
  if (isSafeInteger(value) && value >= 0 && value < PLAYER_COUNT_MAX) return value;
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : '';
  const index = COLOUR_KEYS.indexOf(candidate);
  return index >= 0 ? index : fallback;
}

function readBoard(frame) {
  const board = safeRead(frame, 'board');
  return board && typeof board === 'object' ? board : {};
}

function readPlayers(frame, board) {
  const values = safeRead(board, 'players') ?? safeRead(frame, 'players');
  const seen = new Set();
  if (!Array.isArray(values)) return [];
  return values.slice(0, PLAYER_COUNT_MAX).reduce((players, value, fallback) => {
    const seat = normalizeSeat(safeRead(value, 'seat') ?? safeRead(value, 'player') ?? fallback);
    if (seat === null || seen.has(seat)) return players;
    seen.add(seat);
    const colour = normalizeColour(
      safeRead(value, 'colourKey') ?? safeRead(value, 'colorKey') ?? safeRead(value, 'team') ?? safeRead(value, 'colour') ?? safeRead(value, 'color'),
      seat
    );
    players.push({ seat, colour });
    return players;
  }, []).sort((left, right) => left.seat - right.seat);
}

function readPieces(frame, board, players) {
  const values = safeRead(board, 'pieces') ?? safeRead(frame, 'pieces');
  const coloursBySeat = new Map(players.map(player => [player.seat, player.colour]));
  const seen = new Set();
  if (!Array.isArray(values)) return [];
  return values.slice(0, PLAYER_COUNT_MAX * TOKENS_PER_PLAYER).reduce((pieces, value) => {
    const seat = normalizeSeat(safeRead(value, 'seat') ?? safeRead(value, 'player'));
    const tokenIndex = normalizeTokenIndex(safeRead(value, 'tokenIndex') ?? safeRead(value, 'token') ?? safeRead(value, 'index'));
    const position = normalizePosition(safeRead(value, 'position'));
    if (seat === null || tokenIndex === null || position === null) return pieces;
    const key = `${seat}:${tokenIndex}`;
    if (seen.has(key)) return pieces;
    seen.add(key);
    pieces.push({ seat, tokenIndex, position, colour: coloursBySeat.get(seat) ?? seat });
    return pieces;
  }, []).sort((left, right) => left.seat - right.seat || left.tokenIndex - right.tokenIndex);
}

function readMovableIndexes(turn) {
  const values = safeRead(turn, 'movableTokenIndexes') ?? safeRead(turn, 'movableTokens');
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.slice(0, TOKENS_PER_PLAYER).reduce((indexes, value) => {
    const index = normalizeTokenIndex(value);
    if (index === null || seen.has(index)) return indexes;
    seen.add(index);
    indexes.push(index);
    return indexes;
  }, []);
}

function readProjection(frame) {
  if (!frame || typeof frame !== 'object') return null;
  const revisionValue = safeRead(frame, 'revision');
  if (revisionValue !== undefined && (!isSafeInteger(revisionValue) || revisionValue < 0)) return null;
  const board = readBoard(frame);
  const players = readPlayers(frame, board);
  const turn = safeRead(frame, 'turn');
  const activeSeat = normalizeSeat(safeRead(turn, 'activeSeat') ?? safeRead(turn, 'activePlayer'));
  const canSelect = safeRead(turn, 'canSelect') === true;
  const view = safeRead(frame, 'view');
  const dice = safeRead(frame, 'dice');
  const diceValue = Number(safeRead(dice, 'value'));
  return {
    revision: revisionValue === undefined ? null : revisionValue,
    players,
    pieces: readPieces(frame, board, players),
    activeSeat,
    canSelect,
    movableTokenIndexes: readMovableIndexes(turn),
    quarterTurns: normalizeQuarterTurns(safeRead(view, 'quarterTurns')),
    diceValue: Number.isInteger(diceValue) && diceValue >= 0 && diceValue <= 6 ? diceValue : 0
  };
}

function readMotionPath(event) {
  const values = safeRead(event, 'path');
  if (!Array.isArray(values)) return [];
  return values.slice(0, 8).reduce((path, value) => {
    const position = normalizePosition(value);
    if (position !== null) path.push(position);
    return path;
  }, []);
}

function readCapturedTokens(event, projection, actorSeat, actorTokenIndex) {
  const values = safeRead(event, 'capturedTokens');
  if (!Array.isArray(values) || !projection || !Array.isArray(projection.pieces)) return [];
  const piecesByKey = new Map(projection.pieces.map(piece => [`${piece.seat}:${piece.tokenIndex}`, piece]));
  const seen = new Set();
  const maxCaptured = PLAYER_COUNT_MAX * TOKENS_PER_PLAYER - 1;
  return values.slice(0, maxCaptured).reduce((captured, value) => {
    const seat = normalizeSeat(safeRead(value, 'seat') ?? safeRead(value, 'player'));
    const tokenIndex = normalizeTokenIndex(safeRead(value, 'tokenIndex') ?? safeRead(value, 'token') ?? safeRead(value, 'index'));
    const from = normalizePosition(safeRead(value, 'from'));
    if (seat === null || tokenIndex === null || from === null || (seat === actorSeat && tokenIndex === actorTokenIndex)) return captured;
    const key = `${seat}:${tokenIndex}`;
    if (seen.has(key) || !piecesByKey.has(key)) return captured;
    seen.add(key);
    captured.push({ seat, tokenIndex, from });
    return captured;
  }, []);
}

function runtimeWindow() {
  if (typeof window !== 'undefined') return window;
  return typeof globalThis !== 'undefined' ? globalThis : null;
}

// Existing owner-cleared board art is an optional material layer.  The
// procedural board geometry and colours remain the immediate first-frame
// fallback, so a slow or failed image decode never delays play.
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
    gradient.addColorStop(.55, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    context.globalAlpha = .12;
    context.strokeStyle = palette[3] || '#ffffff';
    context.lineWidth = 3;
    for (let index = -256; index < 512; index += 32) {
      context.beginPath();
      context.moveTo(index, 0);
      context.quadraticCurveTo(index + 30, 128, index - 4, 256);
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

export function isLudo3DSupported() {
  try {
    return !!WebGL && typeof WebGL.isWebGL2Available === 'function' && WebGL.isWebGL2Available() === true;
  } catch (_error) {
    return false;
  }
}

export function createLudo3DAdapter(options) {
  const opts = options && typeof options === 'object' ? options : null;
  if (!opts) throw adapterError('LUDO3D_INVALID_OPTIONS');

  const mountElement = safeRead(opts, 'mountElement');
  if (!mountElement || typeof mountElement.appendChild !== 'function' || typeof mountElement.removeChild !== 'function') {
    throw adapterError('LUDO3D_INVALID_MOUNT_ELEMENT');
  }

  const onInput = callbackOption(opts, 'onInput', true);
  const onContextLost = callbackOption(opts, 'onContextLost', true);
  const onError = callbackOption(opts, 'onError', false);
  const onReady = callbackOption(opts, 'onReady', false);
  const initialQuality = safeRead(opts, 'quality') === undefined ? 'HIGH' : normalizeQuality(safeRead(opts, 'quality'));
  if (!initialQuality) throw adapterError('LUDO3D_INVALID_QUALITY');
  if (!isLudo3DSupported()) throw adapterError('LUDO3D_WEBGL2_UNAVAILABLE');

  let disposed = false;
  let mounted = false;
  let suspended = false;
  let contextWasLost = false;
  let renderFailed = false;
  let readyAnnounced = false;
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
  let latestProjection = null;
  let latestRevision = null;
  let gsapContext = null;
  let runtimeQualityAdapter = null;
  let applyingRuntimeQuality = false;
  let diceGroup = null;
  let diceDots = [];

  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const pointerListeners = [];
  const tokenNodes = new Map();
  const baseGroups = new Map();
  const homeGroups = new Map();
  const selectableKeys = new Set();
  const tokenMaterials = new Map();

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
    const target = targetValue && typeof targetValue === 'object' ? targetValue : { x:0, y:0, z:0 };
    const scale = reducedMotion || quality === 'LOW' ? 0 : (quality === 'HIGH' ? 1 : .72);
    const plans = {
      overview:{ camera:{ ...DEFAULT_CAMERA }, aim:{ x:0, y:0, z:0 }, duration:.22, ease:'power2.inOut' },
      entrance:{ camera:{ x:0, y:DEFAULT_CAMERA.y + 3.2, z:DEFAULT_CAMERA.z + 4 }, aim:{ x:0, y:.3, z:0 }, duration:.26, ease:'power2.out' },
      'action-follow':{ camera:{ x:target.x * .2, y:DEFAULT_CAMERA.y - 1, z:DEFAULT_CAMERA.z + target.z * .16 }, aim:{ x:target.x, y:target.y || 0, z:target.z }, duration:.24, ease:'power2.out' },
      impact:{ camera:{ x:target.x * .14, y:DEFAULT_CAMERA.y - .55, z:DEFAULT_CAMERA.z + target.z * .1 }, aim:{ x:target.x, y:(target.y || 0) + .04, z:target.z }, duration:.16, ease:'power2.out' },
      portrait:{ camera:{ x:target.x * .26, y:DEFAULT_CAMERA.y - 1.8, z:DEFAULT_CAMERA.z + target.z * .2 }, aim:{ x:target.x, y:(target.y || 0) + .2, z:target.z }, duration:.3, ease:'power2.inOut' },
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
        const planned = rig.plan('ludo', mode, targetValue, { quality, reducedMotion });
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

  function setCameraDefault() {
    if (!camera || !cameraAim) return;
    camera.position.set(DEFAULT_CAMERA.x, DEFAULT_CAMERA.y, DEFAULT_CAMERA.z);
    cameraAim.set(0, 0, 0);
  }

  function teamStart(colour) {
    return START[normalizeColour(colour, 0)];
  }

  function trackPoint(index) {
    const angle = (-Math.PI / 2) + (index * Math.PI * 2 / TRACK_LENGTH);
    return { x: Math.cos(angle) * BOARD_RADIUS, y: 0, z: Math.sin(angle) * BOARD_RADIUS };
  }

  function basePoint(colour, tokenIndex) {
    const team = normalizeColour(colour, 0);
    const centers = [
      { x: -4.75, z: -4.75 }, { x: 4.75, z: -4.75 },
      { x: 4.75, z: 4.75 }, { x: -4.75, z: 4.75 }
    ];
    const offsets = [
      { x: -0.58, z: -0.58 }, { x: 0.58, z: -0.58 },
      { x: -0.58, z: 0.58 }, { x: 0.58, z: 0.58 }
    ];
    const center = centers[team];
    const offset = offsets[normalizeTokenIndex(tokenIndex) ?? 0];
    return { x: center.x + offset.x, y: 0, z: center.z + offset.z };
  }

  function homePoint(colour, laneIndex) {
    const entry = trackPoint((teamStart(colour) - 1 + TRACK_LENGTH) % TRACK_LENGTH);
    const progress = (Math.max(0, Math.min(4, laneIndex)) + 1) / 6;
    return { x: entry.x * (1 - progress), y: 0, z: entry.z * (1 - progress) };
  }

  function finishPoint(tokenIndex) {
    const offsets = [
      { x: -0.34, z: -0.34 }, { x: 0.34, z: -0.34 },
      { x: -0.34, z: 0.34 }, { x: 0.34, z: 0.34 }
    ];
    const offset = offsets[normalizeTokenIndex(tokenIndex) ?? 0];
    return { x: offset.x, y: 0, z: offset.z };
  }

  function pointForPosition(colour, tokenIndex, position) {
    if (position === -1) return basePoint(colour, tokenIndex);
    if (position >= 0 && position <= 50) return trackPoint((teamStart(colour) + position) % TRACK_LENGTH);
    if (position >= 51 && position < HOME) return homePoint(colour, position - 51);
    return finishPoint(tokenIndex);
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
    tokenNodes.forEach(token => setObjectShadow(token.group, high));
  }

  function settleStaticPose() {
    setCameraDefault();
    baseGroups.forEach(group => group.scale.set(1, 1, 1));
    tokenNodes.forEach(token => {
      const point = pointForPosition(token.colour, token.tokenIndex, token.position);
      token.group.position.set(point.x, point.y, point.z);
      token.group.scale.set(1, 1, 1);
    });
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

  function installPointerListener(type, handler) {
    if (!canvas || typeof canvas.addEventListener !== 'function') return;
    canvas.addEventListener(type, handler);
    pointerListeners.push({ type, handler });
  }

  function removePointerAccess() {
    pointerListeners.splice(0).forEach(listener => {
      if (canvas && typeof canvas.removeEventListener === 'function') canvas.removeEventListener(listener.type, listener.handler);
    });
    if (canvas && canvas.style) canvas.style.pointerEvents = 'none';
  }

  function pointerCanSelect() {
    return !!latestProjection && latestProjection.canSelect && selectableKeys.size > 0;
  }

  function setPointerAccess(enabled) {
    const allowed = !!enabled && readyAnnounced && !disposed && !suspended && !contextWasLost && !renderFailed && pointerCanSelect();
    if (canvas && canvas.style) canvas.style.pointerEvents = allowed ? 'auto' : 'none';
  }

  function tokenForObject(object) {
    let current = object;
    while (current) {
      const data = current.userData;
      if (data && data.ludoToken === true) {
        const seat = normalizeSeat(data.seat);
        const tokenIndex = normalizeTokenIndex(data.tokenIndex);
        if (seat !== null && tokenIndex !== null) return { seat, tokenIndex };
      }
      current = current.parent;
    }
    return null;
  }

  function tokenAtPointer(event) {
    if (disposed || suspended || contextWasLost || renderFailed || !readyAnnounced || !canvas || !raycaster || !pointer || !camera || !pointerCanSelect()) return null;
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
    const targets = Array.from(selectableKeys).map(key => tokenNodes.get(key)).filter(Boolean).map(token => token.group);
    if (!targets.length) return null;
    const intersections = typeof raycaster.intersectObjects === 'function'
      ? raycaster.intersectObjects(targets, true)
      : targets.reduce((all, target) => all.concat(raycaster.intersectObject(target, true) || []), []);
    if (!Array.isArray(intersections) || !intersections.length) return null;
    const token = tokenForObject(intersections[0] && intersections[0].object);
    if (!token || token.seat !== latestProjection.activeSeat) return null;
    if (!selectableKeys.has(`${token.seat}:${token.tokenIndex}`)) return null;
    return token;
  }

  function emitSelection(token) {
    if (!token || disposed || suspended || contextWasLost || renderFailed || !readyAnnounced || !isSafeInteger(latestRevision)) return;
    const command = Object.freeze({ type: 'select_token', tokenIndex: token.tokenIndex, revision: latestRevision });
    try {
      onInput(command);
    } catch (error) {
      reportError(error);
    }
  }

  function installPointerAccess() {
    installPointerListener('pointerdown', event => {
      const token = tokenAtPointer(event);
      if (token) emitSelection(token);
    });
    setPointerAccess(false);
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
    settleStaticPose();
    setPointerAccess(false);
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
    [camera && camera.position, cameraAim].filter(Boolean).forEach(target => gsap.killTweensOf(target));
    tokenNodes.forEach(token => {
      gsap.killTweensOf(token.group.position);
      gsap.killTweensOf(token.group.scale);
    });
    baseGroups.forEach(group => gsap.killTweensOf(group.scale));
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

  function makeMotion(build) {
    let timeline = null;
    const create = () => {
      timeline = build();
    };
    if (gsapContext && typeof gsapContext.add === 'function') gsapContext.add(create);
    else create();
    return timeline;
  }

  function playInitialCameraEntrance() {
    if (!initialCameraEntrancePrepared || disposed || contextWasLost || suspended || renderFailed || reducedMotion || quality === 'LOW') return false;
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
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto', ease: 'power2.out' }, onComplete: complete });
        next.addLabel('entrance', 0);
        tweenCamera(next, plan, 'entrance');
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('LUDO3D_CAMERA_ENTRANCE_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function createStaticBoard() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101722);
    if (typeof THREE.Fog === 'function') scene.fog = new THREE.Fog(0x101722, 22, 46);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    cameraAim = new THREE.Vector3(0, 0, 0);
    setCameraDefault();
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    const hemisphere = new THREE.HemisphereLight(0xd7ebff, 0x3a2819, 1.3);
    hemisphere.position.set(0, 12, 0);
    directionalLight = new THREE.DirectionalLight(0xfff1d5, 2.15);
    directionalLight.position.set(5.5, 11, 7.5);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(hemisphere, directionalLight, directionalLight.target);
    boardGroup = new THREE.Group();
    scene.add(boardGroup);
    if (typeof THREE.DirectionalLight === 'function') {
      const rimLight = new THREE.DirectionalLight(0x83b8ff, .58);
      rimLight.position.set(-8, 7, -8);
      rimLight.target.position.set(0, 0, 0);
      scene.add(rimLight, rimLight.target);
    }

    const boardGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_SIZE, 0.44, BOARD_SIZE));
    const boardMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xe7d4b0, roughness: 0.62, metalness: 0.02 }));
    attachRuntimeTexture(boardMaterial, './assets/games/ludo/final-art-v1/board-classic-v1.webp');
    boardBase = new THREE.Mesh(boardGeometry, boardMaterial);
    boardBase.position.y = -0.24;
    boardGroup.add(boardBase);

    const trackGeometry = ownGeometry(new THREE.BoxGeometry(0.9, 0.18, 0.9));
    const trackMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf8f1e5, roughness: 0.58, metalness: 0.01 }));
    const startMaterials = COLOURS.map(colour => ownMaterial(new THREE.MeshStandardMaterial({ color: colour.board, roughness: 0.54, metalness: 0.02 })));
    for (let index = 0; index < TRACK_LENGTH; index += 1) {
      const cell = new THREE.Mesh(trackGeometry, START.includes(index) ? startMaterials[START.indexOf(index)] : trackMaterial);
      const point = trackPoint(index);
      cell.position.set(point.x, 0, point.z);
      boardGroup.add(cell);
    }

    const baseGeometry = ownGeometry(new THREE.BoxGeometry(3.35, 0.14, 3.35));
    const homeGeometry = ownGeometry(new THREE.BoxGeometry(0.82, 0.15, 0.82));
    COLOURS.forEach((colour, team) => {
      const baseMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: colour.soft, roughness: 0.68, metalness: 0.01 }));
      const base = new THREE.Group();
      const basePlate = new THREE.Mesh(baseGeometry, baseMaterial);
      const anchor = basePoint(team, 0);
      basePlate.position.set(anchor.x + 0.58, -0.04, anchor.z + 0.58);
      base.add(basePlate);
      baseGroups.set(team, base);
      boardGroup.add(base);

      const lane = new THREE.Group();
      const laneMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: colour.board, roughness: 0.55, metalness: 0.01 }));
      for (let index = 0; index < 5; index += 1) {
        const cell = new THREE.Mesh(homeGeometry, laneMaterial);
        const point = homePoint(team, index);
        cell.position.set(point.x, 0, point.z);
        lane.add(cell);
      }
      homeGroups.set(team, lane);
      boardGroup.add(lane);
      tokenMaterials.set(team, ownMaterial(new THREE.MeshStandardMaterial({ color: colour.token, roughness: 0.31, metalness: 0.08 })));
    });

    const goalGeometry = ownGeometry(new THREE.CylinderGeometry(1.1, 1.1, 0.18, 32));
    const goalMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf5f0df, roughness: 0.52, metalness: 0.03 }));
    const goal = new THREE.Mesh(goalGeometry, goalMaterial);
    goal.position.y = 0.02;
    boardGroup.add(goal);

    createReadOnlyDice();
  }

  function createReadOnlyDice() {
    const bodyGeometry = ownGeometry(new THREE.BoxGeometry(1.28, 1.28, 1.28));
    const bodyMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf6f3ec, roughness: 0.34, metalness: 0.02 }));
    const pipGeometry = ownGeometry(new THREE.SphereGeometry(0.09, 12, 8));
    const pipMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0x172033, roughness: 0.36, metalness: 0.04 }));
    diceGroup = new THREE.Group();
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    diceGroup.add(body);
    const positions = [
      [-0.3, 0.3], [0, 0.3], [0.3, 0.3], [-0.3, 0], [0, 0], [0.3, 0], [-0.3, -0.3], [0, -0.3], [0.3, -0.3]
    ];
    diceDots = positions.map(([x, z]) => {
      const dot = new THREE.Mesh(pipGeometry, pipMaterial);
      dot.position.set(x, 0.655, z);
      diceGroup.add(dot);
      return dot;
    });
    diceGroup.position.set(0, 0.78, 0);
    diceGroup.userData = { ludoReadOnlyDice: true };
    boardGroup.add(diceGroup);
  }

  function updateDice(value) {
    if (!diceGroup) return;
    const patterns = {
      0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8]
    };
    const shown = new Set(patterns[value] || patterns[0]);
    diceDots.forEach((dot, index) => { dot.visible = shown.has(index); });
    diceGroup.rotation.set(0, value * Math.PI / 12, 0);
  }

  function createToken(piece) {
    const group = new THREE.Group();
    group.userData = { ludoToken: true, seat: piece.seat, tokenIndex: piece.tokenIndex };
    const bodyGeometry = ownGeometry(new THREE.CylinderGeometry(0.31, 0.38, 0.28, 24));
    const canopyGeometry = ownGeometry(new THREE.SphereGeometry(0.29, 20, 12));
    const wingGeometry = ownGeometry(new THREE.BoxGeometry(0.86, 0.08, 0.18));
    const material = tokenMaterials.get(piece.colour) || tokenMaterials.get(0);
    const body = new THREE.Mesh(bodyGeometry, material);
    body.position.y = 0.16;
    const canopy = new THREE.Mesh(canopyGeometry, material);
    canopy.position.y = 0.34;
    canopy.scale.set(1, 0.55, 1);
    const wing = new THREE.Mesh(wingGeometry, material);
    wing.position.y = 0.23;
    group.add(body, canopy, wing);
    boardGroup.add(group);
    setObjectShadow(group, quality === 'HIGH');
    return { group, seat: piece.seat, tokenIndex: piece.tokenIndex, colour: piece.colour, position: piece.position };
  }

  function syncActiveTeams(players) {
    const active = new Set(players.map(player => player.colour));
    baseGroups.forEach((group, team) => { group.visible = active.has(team); });
    homeGroups.forEach((group, team) => { group.visible = active.has(team); });
  }

  function syncPieces(projection) {
    const next = new Map(projection.pieces.map(piece => [`${piece.seat}:${piece.tokenIndex}`, piece]));
    tokenNodes.forEach((token, key) => {
      if (next.has(key)) return;
      boardGroup.remove(token.group);
      tokenNodes.delete(key);
    });
    next.forEach((piece, key) => {
      let token = tokenNodes.get(key);
      if (!token) {
        token = createToken(piece);
        tokenNodes.set(key, token);
      }
      token.colour = piece.colour;
      token.position = piece.position;
      const point = pointForPosition(piece.colour, piece.tokenIndex, piece.position);
      token.group.position.set(point.x, point.y, point.z);
      token.group.scale.set(1, 1, 1);
      token.group.userData.seat = piece.seat;
      token.group.userData.tokenIndex = piece.tokenIndex;
    });
    selectableKeys.clear();
    if (projection.canSelect && projection.activeSeat !== null) {
      projection.movableTokenIndexes.forEach(tokenIndex => {
        const key = `${projection.activeSeat}:${tokenIndex}`;
        if (tokenNodes.has(key)) selectableKeys.add(key);
      });
    }
    setPointerAccess(true);
  }

  function syncProjection(projection) {
    if (!projection || !boardGroup) return;
    // TabletopPerspective.quarterPoint() applies a positive screen-clockwise
    // quarter turn.  In Three's x/z plane and the current +z camera, the
    // equivalent visual rotation is negative around y.
    boardGroup.rotation.y = -projection.quarterTurns * (Math.PI / 2);
    syncActiveTeams(projection.players);
    syncPieces(projection);
    updateDice(projection.diceValue);
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

  function playPieceMotion(event, projection) {
    const seat = normalizeSeat(safeRead(event, 'seat'));
    const tokenIndex = normalizeTokenIndex(safeRead(event, 'tokenIndex') ?? safeRead(event, 'token'));
    if (seat === null || tokenIndex === null) return renderOnce();
    const key = `${seat}:${tokenIndex}`;
    const token = tokenNodes.get(key);
    if (!token) return renderOnce();
    const path = readMotionPath(event);
    const from = normalizePosition(safeRead(event, 'from'));
    const captured = readCapturedTokens(event, projection, seat, tokenIndex).map(entry => {
      const capturedToken = tokenNodes.get(`${entry.seat}:${entry.tokenIndex}`);
      return capturedToken ? { ...entry, token: capturedToken } : null;
    }).filter(Boolean);
    const reachedHome = safeRead(event, 'reachedHome') === true;
    const instant = safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true;
    if (instant || reducedMotion || quality === 'LOW' || !path.length) {
      settleStaticPose();
      return renderOnce();
    }

    killMotion(false);
    settleStaticPose();
    const generation = ++motionGeneration;
    const revision = latestRevision;
    if (from !== null) {
      const start = pointForPosition(token.colour, token.tokenIndex, from);
      token.group.position.set(start.x, start.y, start.z);
    }
    captured.forEach(entry => {
      const start = pointForPosition(entry.token.colour, entry.token.tokenIndex, entry.from);
      entry.token.group.position.set(start.x, start.y, start.z);
      entry.token.group.scale.set(1, 1, 1);
    });
    token.group.scale.set(0.9, 0.9, 0.9);
    const target = pointForPosition(token.colour, token.tokenIndex, path[path.length - 1]);
    const finalPoint = pointForPosition(token.colour, token.tokenIndex, token.position);
    const localTarget = new THREE.Vector3(target.x, target.y, target.z);
    const worldTarget = boardGroup.localToWorld(localTarget.clone());
    const focusMode = captured.length ? 'impact' : (reachedHome ? 'portrait' : 'action-follow');
    const focusPlan = cameraPlan(focusMode, worldTarget);
    const overviewPlan = cameraPlan('overview', { x:0, y:0, z:0 });
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      settleStaticPose();
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    const timeline = makeMotion(() => {
      const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto', ease: 'power2.out' }, onComplete: complete });
      if (focusPlan.animated) {
        next.addLabel('focus', 0);
        tweenCamera(next, focusPlan, 'focus');
        next.addLabel('travel', 'focus+=0.05');
      } else {
        next.addLabel('travel', 0);
      }
      path.forEach((position, index) => {
        const point = pointForPosition(token.colour, token.tokenIndex, position);
        next.to(token.group.position, { x: point.x, y: point.y + 0.12, z: point.z, duration: Math.max(0.07, 0.38 / path.length) }, index === 0 ? 'travel' : '>');
      });
      next.to(token.group.position, { x: finalPoint.x, y: finalPoint.y, z: finalPoint.z, duration: 0.08 }, '>')
        .to(token.group.scale, { x: 1, y: 1, z: 1, duration: 0.08 }, '<');
      if (captured.length) {
        next.addLabel('capture', '>');
        captured.forEach(entry => {
          const base = pointForPosition(entry.token.colour, entry.token.tokenIndex, entry.token.position);
          next.to(entry.token.group.position, { x: base.x, y: base.y, z: base.z, duration: 0.16 }, 'capture')
            .to(entry.token.group.scale, { x: 0.42, y: 0.42, z: 0.42, duration: 0.12 }, 'capture')
            .to(entry.token.group.scale, { x: 1, y: 1, z: 1, duration: 0.1 }, 'capture+=0.12');
        });
      }
      if (reachedHome) {
        next.addLabel('finish', '>')
          .to(token.group.position, { x: finalPoint.x, y: finalPoint.y + 0.56, z: finalPoint.z, duration: 0.11 }, 'finish')
          .to(token.group.scale, { x: 1.18, y: 1.18, z: 1.18, duration: 0.11 }, 'finish')
          .to(token.group.position, { x: finalPoint.x, y: finalPoint.y, z: finalPoint.z, duration: 0.14 }, '>')
          .to(token.group.scale, { x: 1, y: 1, z: 1, duration: 0.14 }, '<');
      }
      if (overviewPlan.animated) {
        next.addLabel('restore', '>');
        tweenCamera(next, overviewPlan, 'restore');
      }
      next.addLabel('settled', '>');
      return next;
    });
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('LUDO3D_PIECE_MOTION_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function applyResultPose(plan) {
    tokenNodes.forEach(token => {
      const point = pointForPosition(token.colour, token.tokenIndex, token.position);
      token.group.position.set(point.x, point.y, point.z);
      token.group.scale.set(1, 1, 1);
    });
    baseGroups.forEach(group => group.scale.set(1, 1, 1));
    if (camera && cameraAim && plan) {
      camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
      cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
    }
  }

  function playResult(event) {
    if (disposed || contextWasLost || suspended || renderFailed) return false;
    const winnerSeat = normalizeSeat(safeRead(event, 'winnerSeat') ?? safeRead(event, 'seat'));
    const winner = latestProjection && latestProjection.players.find(player => player.seat === winnerSeat);
    const winnerBase = winner ? baseGroups.get(winner.colour) : null;
    const target = winner ? basePoint(winner.colour, 0) : { x:0, y:0, z:0 };
    const worldTarget = boardGroup
      ? boardGroup.localToWorld(new THREE.Vector3(target.x, target.y, target.z))
      : new THREE.Vector3(0, 0, 0);
    const plan = cameraPlan('result', worldTarget);
    const instant = safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true;
    if (instant || reducedMotion || !plan.animated) {
      killMotion(false);
      applyResultPose(plan);
      return renderOnce();
    }

    killMotion(false);
    settleStaticPose();
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      applyResultPose(plan);
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    const timeline = makeMotion(() => {
      const next = gsap.timeline({ paused:true, defaults:{ overwrite:'auto', ease:'power2.out' }, onComplete:complete });
      next.addLabel('read', 0);
      tweenCamera(next, plan, 'read');
      if (winnerBase) {
        next.addLabel('podium', 'read+=0.08')
          .to(winnerBase.scale, { x:1.08, y:1.08, z:1.08, duration:.18, ease:'back.out(1.25)' }, 'podium')
          .to(winnerBase.scale, { x:1, y:1, z:1, duration:.16, ease:'power2.out' }, 'podium+=0.18');
      }
      next.addLabel('settled', '>');
      return next;
    });
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('LUDO3D_RESULT_MOTION_UNAVAILABLE'));
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
      if (!canvas || typeof canvas.addEventListener !== 'function') throw adapterError('LUDO3D_INVALID_CANVAS');
      canvas.setAttribute('aria-hidden', 'true');
      canvas.setAttribute('role', 'presentation');
      canvas.tabIndex = -1;
      if (canvas.style) {
        canvas.style.display = 'block';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.touchAction = 'none';
        canvas.style.pointerEvents = 'none';
      }
      mountElement.appendChild(canvas);
      createStaticBoard();
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
      mountRuntimeQualityAdapter();
      resize();
      return true;
    } catch (error) {
      reportError(error);
      dispose();
      throw adapterError('LUDO3D_RENDERER_CONSTRUCTION_FAILED');
    }
  }

  function render(frame) {
    if (disposed || contextWasLost || renderFailed || !mounted) return false;
    const projection = readProjection(frame);
    if (!projection) return false;
    killMotion(false);
    settleStaticPose();
    latestFrame = frame;
    latestProjection = projection;
    latestRevision = projection.revision === null ? latestRevision : projection.revision;
    hasSemanticFrame = true;
    syncProjection(projection);
    return renderOnce();
  }

  function motion(event, context) {
    if (disposed || contextWasLost || renderFailed || suspended || !mounted || !event || typeof event !== 'object') return false;
    const revision = safeRead(event, 'revision');
    if (revision !== undefined && (!isSafeInteger(revision) || (latestRevision !== null && revision !== latestRevision))) return false;
    const type = String(safeRead(event, 'type') || '').trim().toLowerCase();
    if (!VALID_MOTION.has(type)) return false;
    const withContext = context && safeRead(context, 'reducedMotion') === true;
    if (type === 'terminal') {
      if (withContext && safeRead(event, 'reducedMotion') !== true) return playResult({ ...event, reducedMotion:true });
      return playResult(event);
    }
    if (withContext && safeRead(event, 'reducedMotion') !== true) {
      return playPieceMotion({ ...event, reducedMotion: true }, latestProjection);
    }
    return playPieceMotion(event, latestProjection);
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
    if (disposed || contextWasLost || renderFailed || !value || typeof value !== 'object') return false;
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
    setPointerAccess(false);
    killMotion(false);
    settleStaticPose();
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
    settleStaticPose();
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
    tokenNodes.clear();
    selectableKeys.clear();
    baseGroups.clear();
    homeGroups.clear();
    tokenMaterials.clear();
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
    raycaster = null;
    pointer = null;
    diceGroup = null;
    diceDots = [];
    latestFrame = null;
    latestProjection = null;
    latestRevision = null;
    readyAnnounced = false;
    hasSemanticFrame = false;
    initialCameraEntrancePrepared = false;
    mounted = false;
    return true;
  }

  return Object.freeze({
    id: 'ludo-three-r185',
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
