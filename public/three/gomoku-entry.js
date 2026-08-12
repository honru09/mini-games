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

function runtimeWindow() {
  if (typeof window !== 'undefined') return window;
  return typeof globalThis !== 'undefined' ? globalThis : null;
}

function devicePixelRatioCap(quality) {
  const win = runtimeWindow();
  const dpr = win && Number.isFinite(win.devicePixelRatio) ? win.devicePixelRatio : 1;
  const cap = quality === 'HIGH' ? 2 : (quality === 'BALANCED' ? 1.5 : 1);
  return Math.max(1, Math.min(cap, dpr));
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

  const stones = new Map();
  const ownedGeometries = new Set();
  const ownedMaterials = new Set();
  const pointerListeners = [];

  function reportError(error) {
    try {
      onError(error);
    } catch (_error) {}
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

  function settleStaticPose() {
    setCameraDefault();
    stones.forEach(stone => {
      if (!stone || !stone.group) return;
      stone.group.position.y = 0;
      stone.group.scale.set(1, 1, 1);
    });
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
    const high = quality === 'HIGH';
    renderer.setPixelRatio(devicePixelRatioCap(quality));
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = high;
      if (high && THREE.PCFSoftShadowMap !== undefined) renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    if (directionalLight) {
      directionalLight.castShadow = high;
      if (high && directionalLight.shadow && directionalLight.shadow.mapSize && typeof directionalLight.shadow.mapSize.set === 'function') {
        directionalLight.shadow.mapSize.set(1024, 1024);
      }
    }
    if (boardBase) boardBase.receiveShadow = high;
    stones.forEach(stone => setObjectShadow(stone.group, high));
  }

  function prepareInitialCameraEntrance() {
    if (!initialCameraEntrancePending || !hasSemanticFrame || !camera || !cameraAim) return false;
    initialCameraEntrancePending = false;
    if (quality !== 'HIGH' || reducedMotion) {
      settleStaticPose();
      return false;
    }
    camera.position.set(DEFAULT_CAMERA.x * 0.72, DEFAULT_CAMERA.y + 3.4, DEFAULT_CAMERA.z + 4.2);
    cameraAim.set(0, 0.36, 0);
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
    if (!initialCameraEntrancePrepared || disposed || contextWasLost || suspended || renderFailed || reducedMotion || quality !== 'HIGH') return false;
    initialCameraEntrancePrepared = false;
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
        const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' }, onComplete: complete });
        next.addLabel('entrance', 0)
          .to(camera.position, { x: DEFAULT_CAMERA.x, y: DEFAULT_CAMERA.y, z: DEFAULT_CAMERA.z, duration: 0.26, ease: 'power2.out' }, 'entrance')
          .to(cameraAim, { x: 0, y: 0, z: 0, duration: 0.26, ease: 'power2.out' }, 'entrance')
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

  function animationTick() {
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
    stones.forEach(stone => gsap.killTweensOf(stone.group));
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

  function createBoard() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101722);
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

    boardGroup = new THREE.Group();
    scene.add(boardGroup);

    const boardGeometry = ownGeometry(new THREE.BoxGeometry(BOARD_SIZE, BOARD_THICKNESS, BOARD_SIZE));
    const boardMaterial = ownMaterial(new THREE.MeshStandardMaterial({
      color: 0xb68148,
      roughness: 0.61,
      metalness: 0.04
    }));
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
    const drop = { y: 0.86, scale: 0.88 };
    stone.group.position.y = drop.y;
    stone.group.scale.set(drop.scale, drop.scale, drop.scale);
    const applyDrop = () => {
      stone.group.position.y = drop.y;
      stone.group.scale.set(drop.scale, drop.scale, drop.scale);
    };
    const complete = () => {
      if (disposed || contextWasLost || generation !== motionGeneration) return;
      stone.group.position.y = 0;
      stone.group.scale.set(1, 1, 1);
      activeMotion = null;
      motionRevision = null;
      stopAnimationLoop();
      renderOnce();
    };
    const timeline = makeMotion(() => {
      const next = gsap.timeline({ paused: true, defaults: { overwrite: 'auto' }, onComplete: complete });
      if (quality === 'HIGH') {
        const cameraEnd = {
          x: worldTarget.x * 0.22,
          y: DEFAULT_CAMERA.y - 1.1,
          z: DEFAULT_CAMERA.z + worldTarget.z * 0.18
        };
        next.addLabel('focus', 0)
          .to(camera.position, { x: cameraEnd.x, y: cameraEnd.y, z: cameraEnd.z, duration: 0.26, ease: 'power2.out' }, 'focus')
          .to(cameraAim, { x: worldTarget.x, y: worldTarget.y, z: worldTarget.z, duration: 0.26, ease: 'power2.out' }, 'focus')
          .addLabel('place', 'focus+=0.06')
          .to(drop, { y: 0, scale: 1, duration: 0.18, ease: 'power2.out', onUpdate: applyDrop }, 'place')
          .addLabel('settled', '>');
      } else {
        next.addLabel('place', 0)
          .to(drop, { y: 0, scale: 1, duration: 0.18, ease: 'power2.out', onUpdate: applyDrop }, 'place')
          .addLabel('settled', '>');
      }
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
      renderer = new THREE.WebGLRenderer({ antialias: quality !== 'LOW', alpha: true });
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
    return renderOnce();
  }

  function motion(event, context) {
    if (disposed || contextWasLost || renderFailed || suspended || !mounted || !event || typeof event !== 'object') return false;
    const revision = safeRead(event, 'revision');
    if (revision !== undefined && (!isFiniteInteger(revision) || (latestRevision !== null && revision !== latestRevision))) return false;
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
    renderOnce();
    return true;
  }

  function suspend() {
    if (disposed || contextWasLost || renderFailed) return false;
    suspended = true;
    setPointerAccess(false);
    if (activeMotion && typeof activeMotion.pause === 'function') activeMotion.pause();
    stopAnimationLoop();
    return true;
  }

  function resume() {
    if (disposed || contextWasLost || renderFailed) return false;
    suspended = false;
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
    return notifyContextLost('foundation');
  }

  function dispose() {
    if (disposed) return true;
    disposed = true;
    suspended = true;
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
