/**
 * Monopoly Ghost3D renderer island.
 *
 * This module owns its Three.js, GSAP, DOM, and WebGL lifetime. It receives
 * only a frozen presentation projection and never creates game input or
 * authority state.
 */
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';

const CELL_COUNT = 24;
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 5;
const BOARD_SIZE = 14.2;
const TRACK_RADIUS = 5.3;
const DEFAULT_CAMERA = Object.freeze({ x: 0, y: 16.2, z: 14.7 });
const VALID_QUALITY = new Set(['HIGH', 'BALANCED', 'LOW']);
const VALID_CELL_TYPES = new Set(['go', 'chance', 'prop', 'tax', 'rest']);
const VALID_PLAYER_STATES = new Set(['idle', 'moving', 'event', 'purchase', 'auction', 'turn', 'bankrupt', 'winner', 'settled']);
const VALID_TURN_PHASES = new Set(['roll', 'resolving', 'moving', 'buy', 'chance', 'auction', 'done', 'finished']);
const VALID_PROCESS_STAGES = new Set(['roll', 'walk', 'land', 'buy', 'event', 'auction', 'trade', 'turn-end']);
const PROCESS_STAGE_INDICES = Object.freeze({
  roll: 0,
  walk: 1,
  land: 2,
  buy: 3,
  event: 4,
  auction: 0,
  trade: 1,
  'turn-end': 2
});
const VALID_MOTION = new Set(['token_moved', 'terminal']);
const SEAT_COLOURS = Object.freeze([0xe85c5d, 0x4d8fe9, 0x48a86e, 0xf3ae41, 0xa78bfa]);

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
  error.name = 'Monopoly3DAdapterError';
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
    const gradient = context.createRadialGradient(124, 92, 12, 128, 128, 190);
    gradient.addColorStop(0, palette[0]);
    gradient.addColorStop(.6, palette[1]);
    gradient.addColorStop(1, palette[2]);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    context.globalAlpha = .15;
    context.strokeStyle = palette[3] || '#ffffff';
    context.lineWidth = 2;
    for (let index = -256; index < 512; index += 32) {
      context.beginPath();
      context.moveTo(0, index);
      context.lineTo(256, index + 22);
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

function normalizeCell(value, index) {
  if (!safeRecord(value)) return null;
  const cellIndex = safeRead(value, 'index');
  const type = String(safeRead(value, 'type') || '').trim().toLowerCase();
  const owner = safeRead(value, 'ownerPlayerId');
  if (!safeInteger(cellIndex, 0, CELL_COUNT - 1) || cellIndex !== index ||
      !VALID_CELL_TYPES.has(type) || !safeInteger(owner, -1, MAX_PLAYERS - 1)) return null;
  return { type, owner };
}

function normalizePlayer(value) {
  if (!safeRecord(value)) return null;
  const playerId = safeRead(value, 'playerId');
  const seatId = safeRead(value, 'seatId');
  const authorityPosition = safeRead(value, 'authorityPosition');
  const displayPosition = safeRead(value, 'displayPosition');
  if (!safeInteger(seatId, 0, MAX_PLAYERS - 1) ||
      !safeInteger(playerId, 0, MAX_PLAYERS - 1) || playerId !== seatId ||
      !safeInteger(authorityPosition, 0, CELL_COUNT - 1) ||
      !safeInteger(displayPosition, 0, CELL_COUNT - 1)) {
    return null;
  }
  const directState = safeRead(value, 'state');
  if (typeof directState !== 'string' || !VALID_PLAYER_STATES.has(directState) || typeof safeRead(value, 'visible') !== 'boolean') return null;
  return {
    seatId,
    authorityPosition,
    displayPosition,
    visible: safeRead(value, 'visible'),
    state: directState
  };
}

function readProjection(frame) {
  if (!safeRecord(frame) || safeRead(frame, 'kind') !== 'monopoly-3d-frame-v1') return null;
  const revision = safeRead(frame, 'revision');
  const board = safeRead(frame, 'board');
  const rawCells = safeRecord(board) ? safeRead(board, 'cells') : null;
  const cellCount = safeRecord(board) ? safeRead(board, 'cellCount') : null;
  const rawPlayers = safeRead(frame, 'players');
  if (!safeInteger(revision, 0, Number.MAX_SAFE_INTEGER) || cellCount !== CELL_COUNT ||
      !Array.isArray(rawCells) || rawCells.length !== CELL_COUNT ||
      !Array.isArray(rawPlayers) || rawPlayers.length < MIN_PLAYERS || rawPlayers.length > MAX_PLAYERS) {
    return null;
  }
  const cells = rawCells.map(normalizeCell);
  const players = rawPlayers.map(normalizePlayer);
  const seats = new Set();
  if (cells.some(cell => !cell) || players.some(player => !player) ||
      players.some(player => seats.has(player.seatId) || !seats.add(player.seatId)) ||
      players.some((player, index) => player.seatId !== index) ||
      cells.some(cell => cell.owner >= players.length)) {
    return null;
  }
  const turn = safeRead(frame, 'turn');
  const process = safeRead(frame, 'process');
  const activePlayerId = safeRecord(turn) ? safeRead(turn, 'activePlayerId') : undefined;
  const phase = safeRecord(turn) ? safeRead(turn, 'phase') : undefined;
  const stage = safeRecord(process) ? safeRead(process, 'stage') : undefined;
  const activeSeat = safeInteger(activePlayerId, 0, players.length - 1)
    ? activePlayerId
    : -1;
  const winner = safeRead(frame, 'winnerPlayerId');
  const terminal = safeRead(frame, 'terminal');
  if (activeSeat < 0 || !VALID_TURN_PHASES.has(phase) || !VALID_PROCESS_STAGES.has(stage) ||
      !safeInteger(winner, -1, players.length - 1) || typeof terminal !== 'boolean') return null;
  return {
    revision,
    cells,
    players: players.slice().sort((left, right) => left.seatId - right.seatId),
    activeSeat,
    phase,
    stage,
    terminal,
    winner
  };
}

function readMotion(event, revision) {
  if (!safeRecord(event) || String(safeRead(event, 'type') || '').trim().toLowerCase() !== 'token_moved') return null;
  const eventRevision = safeRead(event, 'revision');
  const actor = safeRead(event, 'actorPlayerId');
  const from = safeRead(event, 'from');
  const to = safeRead(event, 'to');
  const steps = safeRead(event, 'steps');
  const direction = safeRead(event, 'direction');
  const validSteps = Number.isSafeInteger(steps) && (steps === -2 || (steps >= 2 && steps <= 12));
  if (eventRevision !== revision || !safeInteger(actor, 0, MAX_PLAYERS - 1) ||
      !safeInteger(from, 0, CELL_COUNT - 1) || !safeInteger(to, 0, CELL_COUNT - 1) ||
      !validSteps || (steps === -2 && direction !== -1) || (steps >= 2 && direction !== 1) ||
      to !== ((from + steps) % CELL_COUNT + CELL_COUNT) % CELL_COUNT) {
    return null;
  }
  const distance = Math.abs(steps);
  return { actor, from, to, steps: distance, direction };
}

function readTerminal(event, revision) {
  if (!safeRecord(event)) return null;
  const type = String(safeRead(event, 'type') || '').trim().toLowerCase();
  if (type !== 'terminal' && type !== 'result') return null;
  const eventRevision = safeRead(event, 'revision');
  if (eventRevision !== revision) return null;
  const rawWinner = safeRead(event, 'winnerPlayerId') ?? safeRead(event, 'winnerSeat') ?? safeRead(event, 'winner');
  const winner = rawWinner === undefined || rawWinner === null ? -1 : rawWinner;
  if (!safeInteger(winner, -1, MAX_PLAYERS - 1)) return null;
  return { winner };
}

function perimeterPoint(index) {
  const normalized = ((index % CELL_COUNT) + CELL_COUNT) % CELL_COUNT;
  const side = Math.floor(normalized / 6);
  const offset = normalized % 6;
  const span = TRACK_RADIUS * 2;
  const step = span / 6;
  const inset = -TRACK_RADIUS + step * (offset + 0.5);
  if (side === 0) return { x: inset, y: 0, z: -TRACK_RADIUS };
  if (side === 1) return { x: TRACK_RADIUS, y: 0, z: inset };
  if (side === 2) return { x: -inset, y: 0, z: TRACK_RADIUS };
  return { x: -TRACK_RADIUS, y: 0, z: -inset };
}

function stageIndex(stage) {
  return PROCESS_STAGE_INDICES[stage] || 0;
}

export function isMonopoly3DSupported() {
  try {
    return !!WebGL && typeof WebGL.isWebGL2Available === 'function' && WebGL.isWebGL2Available() === true;
  } catch (_error) {
    return false;
  }
}

export function createMonopoly3DAdapter(options) {
  const opts = safeRecord(options) ? options : null;
  if (!opts) throw adapterError('MONOPOLY3D_INVALID_OPTIONS');

  const mountElement = safeRead(opts, 'mountElement');
  if (!mountElement || typeof mountElement.appendChild !== 'function' || typeof mountElement.removeChild !== 'function') {
    throw adapterError('MONOPOLY3D_INVALID_MOUNT_ELEMENT');
  }
  const initialQuality = safeRead(opts, 'quality') === undefined ? 'HIGH' : normalizeQuality(safeRead(opts, 'quality'));
  if (!initialQuality) throw adapterError('MONOPOLY3D_INVALID_QUALITY');
  if (!isMonopoly3DSupported()) throw adapterError('MONOPOLY3D_WEBGL2_UNAVAILABLE');

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
  let initialCameraEntrancePending = true;
  let initialCameraEntrancePrepared = false;
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
  let resizeObserver = null;
  let resizeFallbackWindow = null;
  let contextLossHandler = null;
  let activeMotion = null;
  let motionRevision = null;
  let motionGeneration = 0;
  let animationLoopActive = false;
  let latestProjection = null;
  let latestRevision = null;
  let gsapContext = null;
  let runtimeQualityAdapter = null;
  let applyingRuntimeQuality = false;
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const cellNodes = [];
  const tokenNodes = new Map();
  const cellMaterials = new Map();
  const ownerMaterials = [];
  const tokenMaterials = [];
  const stageMaterials = [];
  let neutralCellMaterial = null;
  let processMaterial = null;
  let tokenGeometry = null;
  let tokenCapGeometry = null;

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

  function fallbackCameraPlan(mode, targetValue) {
    const target = targetValue && typeof targetValue === 'object' ? targetValue : { x: 0, y: 0, z: 0 };
    const scale = reducedMotion || quality === 'LOW' ? 0 : (quality === 'HIGH' ? 1 : .72);
    const plans = {
      overview: { camera: { ...DEFAULT_CAMERA }, aim: { x: 0, y: 0, z: 0 }, duration: .22, ease: 'power2.inOut' },
      entrance: { camera: { x: 0, y: DEFAULT_CAMERA.y + 3.2, z: DEFAULT_CAMERA.z + 4 }, aim: { x: 0, y: .3, z: 0 }, duration: .26, ease: 'power2.out' },
      'turn-focus': { camera: { x: target.x * .18, y: DEFAULT_CAMERA.y - .9, z: DEFAULT_CAMERA.z + target.z * .14 }, aim: { x: target.x, y: target.y || 0, z: target.z }, duration: .22, ease: 'power2.out' },
      'action-follow': { camera: { x: target.x * .2, y: DEFAULT_CAMERA.y - 1, z: DEFAULT_CAMERA.z + target.z * .16 }, aim: { x: target.x, y: target.y || 0, z: target.z }, duration: .24, ease: 'power2.out' },
      impact: { camera: { x: target.x * .14, y: DEFAULT_CAMERA.y - .55, z: DEFAULT_CAMERA.z + target.z * .1 }, aim: { x: target.x, y: (target.y || 0) + .04, z: target.z }, duration: .16, ease: 'power2.out' },
      result: { camera: { x: target.x * .06, y: DEFAULT_CAMERA.y + 1.1, z: DEFAULT_CAMERA.z + 1.35 + target.z * .05 }, aim: { x: target.x, y: (target.y || 0) + .12, z: target.z }, duration: .42, ease: 'power2.inOut' },
      spectator: { camera: { x: 0, y: DEFAULT_CAMERA.y + 1.7, z: DEFAULT_CAMERA.z + 2.1 }, aim: { x: 0, y: 0, z: 0 }, duration: .34, ease: 'power2.inOut' },
      portrait: { camera: { x: target.x * .26, y: DEFAULT_CAMERA.y - 1.8, z: DEFAULT_CAMERA.z + target.z * .2 }, aim: { x: target.x, y: (target.y || 0) + .2, z: target.z }, duration: .3, ease: 'power2.inOut' },
    };
    const selected = plans[mode] || plans.overview;
    return { ...selected, mode, animated: selected.duration * scale > 0, duration: selected.duration * scale };
  }

  function cameraPlan(mode, targetValue) {
    const win = runtimeWindow();
    const rig = win && win.TabletopCameraRig;
    if (rig && typeof rig.plan === 'function') {
      try {
        const planned = rig.plan('monopoly', mode, targetValue, { quality, reducedMotion });
        if (planned && planned.camera && planned.aim && Number.isFinite(planned.duration)) return planned;
      } catch (_error) {}
    }
    return fallbackCameraPlan(mode, targetValue);
  }

  function tweenCamera(timeline, plan, label) {
    if (!timeline || !plan || !plan.animated) return false;
    timeline.to(camera.position, {
      x: plan.camera.x, y: plan.camera.y, z: plan.camera.z, duration: plan.duration, ease: plan.ease,
    }, label).to(cameraAim, {
      x: plan.aim.x, y: plan.aim.y, z: plan.aim.z, duration: plan.duration, ease: plan.ease,
    }, label);
    return true;
  }

  function setReadOnlyCanvas() {
    if (!canvas || !canvas.style) return;
    canvas.style.pointerEvents = 'none';
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
    if (tableBase) tableBase.receiveShadow = high;
    tokenNodes.forEach(token => setObjectShadow(token.group, high));
  }

  function tokenPoint(token, position) {
    const point = perimeterPoint(position);
    const index = token && safeInteger(token.seatId, 0, MAX_PLAYERS - 1) ? token.seatId : 0;
    const offsetAngle = (index / MAX_PLAYERS) * Math.PI * 2;
    const distance = 0.15;
    return {
      x: point.x + Math.cos(offsetAngle) * distance,
      y: 0,
      z: point.z + Math.sin(offsetAngle) * distance
    };
  }

  function settleStaticPose() {
    setCameraDefault();
    tokenNodes.forEach(token => {
      const player = latestProjection && latestProjection.players.find(item => item.seatId === token.seatId);
      const position = player ? player.authorityPosition : token.position;
      const point = tokenPoint(token, position);
      token.position = position;
      token.group.position.set(point.x, point.y, point.z);
      token.group.scale.set(1, 1, 1);
    });
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
    [camera && camera.position, cameraAim, centerIndicator && centerIndicator.scale].filter(Boolean).forEach(target => gsap.killTweensOf(target));
    tokenNodes.forEach(token => {
      gsap.killTweensOf(token.group.position);
      gsap.killTweensOf(token.group.scale);
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

  function playInitialCameraEntrance() {
    if (!initialCameraEntrancePrepared || disposed || contextWasLost || suspended || renderFailed || reducedMotion || quality === 'LOW') return false;
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
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('MONOPOLY3D_CAMERA_ENTRANCE_UNAVAILABLE'));
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

  function cellMaterial(cell) {
    if (cell.owner >= 0) return ownerMaterials[cell.owner] || neutralCellMaterial;
    return cellMaterials.get(cell.type) || neutralCellMaterial;
  }

  function createTable() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101722);
    if (typeof THREE.Fog === 'function') scene.fog = new THREE.Fog(0x101722, 20, 44);
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    cameraAim = new THREE.Vector3(0, 0, 0);
    setCameraDefault();

    const hemisphere = new THREE.HemisphereLight(0xd7ebff, 0x3a2819, 1.32);
    hemisphere.position.set(0, 12, 0);
    directionalLight = new THREE.DirectionalLight(0xfff1d5, 2.15);
    directionalLight.position.set(5.6, 11, 7.7);
    directionalLight.target.position.set(0, 0, 0);
    scene.add(hemisphere, directionalLight, directionalLight.target);
    if (typeof THREE.DirectionalLight === 'function') {
      const rimLight = new THREE.DirectionalLight(0xff96ca, .5);
      rimLight.position.set(-8, 6, -7);
      rimLight.target.position.set(0, 0, 0);
      scene.add(rimLight, rimLight.target);
    }

    tableGroup = new THREE.Group();
    scene.add(tableGroup);
    const baseGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_SIZE, 0.46, BOARD_SIZE));
    const baseMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xe6d5b2, roughness: 0.65, metalness: 0.02 }));
    applySurfaceTexture(baseMaterial, ['#f2d8a9', '#c9945e', '#654b42', '#fff1c8']);
    tableBase = new THREE.Mesh(baseGeometry, baseMaterial);
    tableBase.position.y = -0.25;
    tableGroup.add(tableBase);
    const insetGeometry = ownGeometry(new THREE.BoxGeometry(8.7, 0.12, 8.7));
    const insetMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf8f1e4, roughness: 0.56, metalness: 0.01 }));
    applySurfaceTexture(insetMaterial, ['#e9e8f8', '#a8b5e5', '#28345b', '#ffffff']);
    const inset = new THREE.Mesh(insetGeometry, insetMaterial);
    inset.position.y = 0.02;
    tableGroup.add(inset);

    neutralCellMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf5eee2, roughness: 0.62, metalness: 0.01 }));
    ['go', 'chance', 'prop', 'tax', 'rest'].forEach((type, index) => {
      cellMaterials.set(type, ownMaterial(new THREE.MeshStandardMaterial({
        color: [0xd7ebff, 0xffe1a6, 0xe0efdb, 0xf6c4bd, 0xe7def7][index],
        roughness: 0.58,
        metalness: 0.01
      })));
    });
    SEAT_COLOURS.forEach(colour => {
      ownerMaterials.push(ownMaterial(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.43, metalness: 0.05 })));
      tokenMaterials.push(ownMaterial(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.3, metalness: 0.09 })));
      stageMaterials.push(ownMaterial(new THREE.MeshStandardMaterial({ color: colour, roughness: 0.35, metalness: 0.04 })));
    });
    const horizontalGeometry = ownGeometry(new THREE.BoxGeometry(1.42, 0.14, 0.82));
    const verticalGeometry = ownGeometry(new THREE.BoxGeometry(0.82, 0.14, 1.42));
    for (let index = 0; index < CELL_COUNT; index += 1) {
      const cell = new THREE.Mesh(index < 6 || index >= 12 && index < 18 ? horizontalGeometry : verticalGeometry, neutralCellMaterial);
      const point = perimeterPoint(index);
      cell.position.set(point.x, 0.03, point.z);
      tableGroup.add(cell);
      cellNodes.push(cell);
    }

    const centerGeometry = ownGeometry(new THREE.BoxGeometry(1.18, 1.18, 1.18));
    const centerMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: 0xf5f1e9, roughness: 0.34, metalness: 0.02 }));
    centerIndicator = new THREE.Group();
    centerBody = new THREE.Mesh(centerGeometry, centerMaterial);
    centerIndicator.add(centerBody);
    centerIndicator.position.set(0, 0.73, 0);
    tableGroup.add(centerIndicator);

    tokenGeometry = ownGeometry(new THREE.CylinderGeometry(0.27, 0.34, 0.28, 24));
    tokenCapGeometry = ownGeometry(new THREE.SphereGeometry(0.26, 20, 12));
    processMaterial = stageMaterials[0];
  }

  function createToken(player) {
    const group = new THREE.Group();
    const material = tokenMaterials[player.seatId] || tokenMaterials[0];
    const body = new THREE.Mesh(tokenGeometry, material);
    body.position.y = 0.16;
    const cap = new THREE.Mesh(tokenCapGeometry, material);
    cap.position.y = 0.35;
    cap.scale.set(1, 0.57, 1);
    group.add(body, cap);
    tableGroup.add(group);
    setObjectShadow(group, quality === 'HIGH');
    return { group, seatId: player.seatId, position: player.displayPosition, visible: player.visible };
  }

  function syncCells(projection) {
    projection.cells.forEach((cell, index) => {
      const node = cellNodes[index];
      if (node) node.material = cellMaterial(cell);
    });
  }

  function syncTokens(projection) {
    const next = new Map(projection.players.map(player => [player.seatId, player]));
    tokenNodes.forEach((token, seatId) => {
      if (next.has(seatId)) return;
      tableGroup.remove(token.group);
      tokenNodes.delete(seatId);
    });
    projection.players.forEach(player => {
      let token = tokenNodes.get(player.seatId);
      if (!token) {
        token = createToken(player);
        tokenNodes.set(player.seatId, token);
      }
      token.visible = player.visible;
      token.group.visible = player.visible;
      token.position = player.displayPosition;
      const point = tokenPoint(token, player.displayPosition);
      token.group.position.set(point.x, point.y, point.z);
      token.group.scale.set(1, 1, 1);
    });
  }

  function syncCenter(projection) {
    if (!centerIndicator) return;
    const index = stageIndex(projection.stage);
    processMaterial = stageMaterials[index] || stageMaterials[0];
    if (centerBody) centerBody.material = processMaterial;
    centerIndicator.rotation.set(0, (projection.revision % CELL_COUNT) * Math.PI / 12, 0);
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

  function playTokenMotion(event) {
    const motion = readMotion(event, latestRevision);
    if (!motion) return false;
    const token = tokenNodes.get(motion.actor);
    if (!token || !latestProjection || latestProjection.terminal || !latestProjection.players.some(player => player.seatId === motion.actor && player.visible)) return false;
    if (safeRead(event, 'instant') === true || safeRead(event, 'reducedMotion') === true || reducedMotion || quality === 'LOW') {
      settleStaticPose();
      return renderOnce();
    }

    killMotion(false);
    settleStaticPose();
    const generation = ++motionGeneration;
    const revision = latestRevision;
    const start = tokenPoint(token, motion.from);
    token.group.position.set(start.x, start.y, start.z);
    token.group.scale.set(0.9, 0.9, 0.9);
    const target = tokenPoint(token, motion.to);
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      settleStaticPose();
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    const points = [];
    for (let index = 1; index <= motion.steps; index += 1) {
      const position = ((motion.from + motion.direction * index) % CELL_COUNT + CELL_COUNT) % CELL_COUNT;
      points.push(tokenPoint(token, position));
    }
    points[points.length - 1] = target;
    const worldTarget = new THREE.Vector3(target.x, target.y, target.z);
    const focusPlan = cameraPlan('action-follow', worldTarget);
    const impactPlan = cameraPlan('impact', worldTarget);
    const overviewPlan = cameraPlan('overview', { x: 0, y: 0, z: 0 });
    const pulse = { scale: 1 };
    // The semantic renderer must finish before the retained DOM walk publishes
    // its land frame (280–760ms for 2–12 spaces).  Keep the whole composite
    // finite and bounded instead of letting a later authoritative frame cut
    // off the land/settled labels.
    const stepDuration = Math.max(0.028, 0.14 / points.length);
    const applyPulse = () => {
      token.group.scale.set(pulse.scale, pulse.scale, pulse.scale);
    };
    let timeline = null;
    try {
      timeline = makeMotion(() => {
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto', ease: 'power2.out' }, onComplete: complete });
        if (focusPlan.animated) {
          next.addLabel('focus', 0);
          tweenCamera(next, focusPlan, 'focus');
          next.addLabel('travel', 'focus+=0.02');
        } else {
          next.addLabel('travel', 0);
        }
        points.forEach((point, index) => {
          next.to(token.group.position, {
            x: point.x,
            y: point.y + (index < points.length - 1 ? 0.1 : 0),
            z: point.z,
            duration: stepDuration
          }, index === 0 ? 'travel' : '>');
        });
        next.addLabel('impact', '>');
        if (impactPlan.animated) tweenCamera(next, impactPlan, 'impact');
        next.to(pulse, { scale: 1.16, duration: 0.05, onUpdate: applyPulse }, 'impact')
          .to(pulse, { scale: 1, duration: 0.05, onUpdate: applyPulse }, '>');
        if (overviewPlan.animated) {
          next.addLabel('restore', 'impact+=0.02');
          tweenCamera(next, overviewPlan, 'restore');
        }
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('MONOPOLY3D_MOTION_UNAVAILABLE'));
    activeMotion = timeline;
    motionRevision = revision;
    timeline.play(0);
    startAnimationLoop();
    return true;
  }

  function applyResultPose(plan) {
    tokenNodes.forEach(token => {
      const player = latestProjection && latestProjection.players.find(item => item.seatId === token.seatId);
      const position = player ? player.authorityPosition : token.position;
      const point = tokenPoint(token, position);
      token.position = position;
      token.group.position.set(point.x, point.y, point.z);
      token.group.scale.set(1, 1, 1);
    });
    if (camera && cameraAim && plan) {
      camera.position.set(plan.camera.x, plan.camera.y, plan.camera.z);
      cameraAim.set(plan.aim.x, plan.aim.y, plan.aim.z);
    }
  }

  function playResult(event) {
    if (disposed || contextWasLost || suspended || renderFailed) return false;
    const result = readTerminal(event, latestRevision);
    if (!result || !latestProjection) return false;
    const projectedWinner = result.winner >= 0
      ? latestProjection.players.find(player => player.seatId === result.winner)
      : null;
    const winner = projectedWinner && projectedWinner.visible ? projectedWinner : null;
    const winnerToken = winner ? tokenNodes.get(winner.seatId) : null;
    const target = winnerToken
      ? tokenPoint(winnerToken, winner.authorityPosition)
      : { x: 0, y: 0, z: 0 };
    const plan = cameraPlan('result', target);
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
    let timeline = null;
    try {
      timeline = makeMotion(() => {
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto', ease: 'power2.out' }, onComplete: complete });
        next.addLabel('read', 0);
        tweenCamera(next, plan, 'read');
        if (winnerToken) {
          next.addLabel('podium', 'read+=0.08')
            .to(winnerToken.group.scale, { x: 1.14, y: 1.14, z: 1.14, duration: 0.18, ease: 'back.out(1.25)' }, 'podium')
            .to(winnerToken.group.scale, { x: 1, y: 1, z: 1, duration: 0.16, ease: 'power2.out' }, 'podium+=0.18');
        } else if (centerIndicator) {
          next.addLabel('podium', 'read+=0.08')
            .to(centerIndicator.scale, { x: 1.12, y: 1.12, z: 1.12, duration: 0.16, ease: 'back.out(1.2)' }, 'podium')
            .to(centerIndicator.scale, { x: 1, y: 1, z: 1, duration: 0.14, ease: 'power2.out' }, 'podium+=0.16');
        }
        next.addLabel('settled', '>');
        return next;
      });
    } catch (error) {
      return failRender(error);
    }
    if (!timeline || typeof timeline.play !== 'function') return failRender(adapterError('MONOPOLY3D_RESULT_MOTION_UNAVAILABLE'));
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
      if (!canvas || typeof canvas.addEventListener !== 'function') throw adapterError('MONOPOLY3D_INVALID_CANVAS');
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
      createTable();
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
      throw adapterError('MONOPOLY3D_RENDERER_CONSTRUCTION_FAILED');
    }
  }

  function render(frame) {
    if (disposed || contextWasLost || renderFailed || !mounted) return false;
    const projection = readProjection(frame);
    if (!projection) return false;
    killMotion(false);
    latestProjection = projection;
    latestRevision = projection.revision;
    hasSemanticFrame = true;
    syncCells(projection);
    syncTokens(projection);
    syncCenter(projection);
    return renderOnce();
  }

  function motion(event, context) {
    if (disposed || contextWasLost || renderFailed || suspended || !mounted || !event || typeof event !== 'object') return false;
    const type = String(safeRead(event, 'type') || '').trim().toLowerCase();
    if (!VALID_MOTION.has(type)) return false;
    if (type === 'terminal' || type === 'result') {
      if (context && safeRead(context, 'reducedMotion') === true && safeRead(event, 'reducedMotion') !== true) {
        return playResult({ ...event, reducedMotion: true });
      }
      return playResult(event);
    }
    if (context && safeRead(context, 'reducedMotion') === true && safeRead(event, 'reducedMotion') !== true) {
      return playTokenMotion({ ...event, reducedMotion: true });
    }
    return playTokenMotion(event);
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
    cellNodes.length = 0;
    tokenNodes.clear();
    cellMaterials.clear();
    ownerMaterials.length = 0;
    tokenMaterials.length = 0;
    stageMaterials.length = 0;
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
    latestProjection = null;
    latestRevision = null;
    readyAnnounced = false;
    hasSemanticFrame = false;
    initialCameraEntrancePending = true;
    initialCameraEntrancePrepared = false;
    mounted = false;
    return true;
  }

  return Object.freeze({
    id: 'monopoly-three-r185',
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
