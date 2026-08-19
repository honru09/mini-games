/* ================= Tetris Ghost3D presenter =================
 *
 * This is a deliberately one-way, explicitly opted-in presentation Module. Its
 * Interface is intentionally small: create(readModel) -> commit/snapshot/
 * dispose.  `readModel` is called only after the DOM game's existing local
 * commit or strict tetris-rule-v3 acceptance; no Rule, input, socket, reward,
 * replay, or persistence object crosses this seam.
 *
 * The reader's stable presentation vocabulary is deliberately data-only:
 * mountElement, waveBActive, online/committed or accepted/fullRuleAuthority,
 * protocol/source/matchId/expectedMatchId/authorityRevision/stateHash,
 * resetEpoch/sourceEpoch, viewPlayer/playerCount, state{well,active,alive,
 * placementSeq,lastEvent}, terminal/winner, trustedLock, quality, and
 * reducedMotion.  Everything else stays hidden behind this Module.
 */
(function installTetrisGhost3DPresenter(root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else if (root) root.TetrisGhost3DPresenter = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createTetrisGhost3DPresenter(root) {
  'use strict';

  var ROWS = 18;
  var COLS = 10;
  var WAVE_B_STORAGE_KEY = 'mg_art_game_stage_wave_b_v1';
  var ENABLE_STORAGE_KEY = 'mg_ghost3d_tetris_v1';
  // Kept as a diagnostic identity for the Loader seam; the actual import is
  // resolved only by GameModuleLoader from its fixed hash-pinned manifest.
  var IMPORT_PATH = './three/tetris-entry.js?v=sha256-ce7c38dec42b212f';
  var QUALITY_SET = new Set(['HIGH', 'BALANCED', 'LOW']);
  var ONLINE_SOURCES = new Set(['live', 'room-restored', 'reconnect', 'spectator-bootstrap', 'reconcile']);
  var STATIC_ONLINE_SOURCES = new Set(['room-restored', 'reconnect', 'spectator-bootstrap', 'reconcile']);
  // This is a presentation-only copy of the canonical Rule Core bases and
  // clockwise rotation. It is used only to prove that a trusted lock fact can
  // explain the frozen before/after wells; the Rule Core itself never crosses
  // this renderer boundary.
  var TETROMINO_SHAPES = Object.freeze([
    Object.freeze([Object.freeze([1, 1, 1, 1])]),
    Object.freeze([Object.freeze([1, 1]), Object.freeze([1, 1])]),
    Object.freeze([Object.freeze([1, 0, 0]), Object.freeze([1, 1, 1])]),
    Object.freeze([Object.freeze([0, 0, 1]), Object.freeze([1, 1, 1])]),
    Object.freeze([Object.freeze([0, 1, 1]), Object.freeze([1, 1, 0])]),
    Object.freeze([Object.freeze([1, 1, 0]), Object.freeze([0, 1, 1])]),
    Object.freeze([Object.freeze([0, 1, 0]), Object.freeze([1, 1, 1])]),
  ]);
  var sharedRendererModule = null;
  var sharedRendererPromise = null;
  var sharedRendererFailed = false;

  function gameModuleLoader() {
    var candidate = null;
    try { candidate = root && root.GameModuleLoader; } catch (_error) { candidate = null; }
    return candidate && typeof candidate.load === 'function' ? candidate : null;
  }

  function safeRead(value, key) {
    try { return { ok:true, value:value && value[key] }; } catch (_error) { return { ok:false, value:undefined }; }
  }

  function own(value, key) {
    try { return !!value && Object.prototype.hasOwnProperty.call(value, key); } catch (_error) { return false; }
  }

  function plainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      var tag = Object.prototype.toString.call(value);
      if (tag !== '[object Object]') return false;
      var prototype = Object.getPrototypeOf(value);
      if (prototype === null || prototype === Object.prototype) return true;
      var constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function' && constructor.name === 'Object';
    } catch (_error) { return false; }
  }

  function integer(value, minimum, maximum) {
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
  }

  function nonEmptyString(value, maximum) {
    return typeof value === 'string' && value.length > 0 && value.length <= (maximum || 160) ? value : null;
  }

  function normalizeQuality(value) {
    var normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return QUALITY_SET.has(normalized) ? normalized : 'BALANCED';
  }

  function freeze(value) {
    if (Array.isArray(value)) return Object.freeze(value.map(freeze));
    if (value && typeof value === 'object') {
      var copy = {};
      Object.keys(value).forEach(function copyKey(key) { copy[key] = freeze(value[key]); });
      return Object.freeze(copy);
    }
    return value;
  }

  function copyWell(value) {
    if (!Array.isArray(value) || value.length !== ROWS) return null;
    var copied = [];
    for (var row = 0; row < ROWS; row += 1) {
      if (!Array.isArray(value[row]) || value[row].length !== COLS) return null;
      var next = [];
      for (var column = 0; column < COLS; column += 1) {
        if (value[row][column] !== 0 && value[row][column] !== 1) return null;
        next.push(value[row][column]);
      }
      copied.push(next);
    }
    return copied;
  }

  function copyActive(value) {
    if (value === null) return null;
    if (!plainRecord(value)) return null;
    var kind = integer(value.kind, 0, 6);
    var rotation = integer(value.rotation, 0, 3);
    var x = integer(value.x, -3, 9);
    var y = integer(value.y, -4, 17);
    if (kind === null || rotation === null || x === null || y === null) return null;
    return { kind:kind, rotation:rotation, x:x, y:y };
  }

  function rotateClockwise(matrix) {
    var rows = matrix.length;
    var columns = matrix[0].length;
    var rotated = [];
    for (var column = 0; column < columns; column += 1) {
      var next = [];
      for (var row = 0; row < rows; row += 1) next.push(matrix[rows - 1 - row][column]);
      rotated.push(next);
    }
    return rotated;
  }

  function shapeCells(kind, rotation) {
    var shape = TETROMINO_SHAPES[kind];
    if (!shape) return null;
    for (var turn = 0; turn < rotation; turn += 1) shape = rotateClockwise(shape);
    var cells = [];
    for (var row = 0; row < shape.length; row += 1) {
      for (var column = 0; column < shape[row].length; column += 1) {
        if (shape[row][column]) cells.push({ x:column, y:row });
      }
    }
    return cells.length === 4 ? cells : null;
  }

  function collidesAt(well, cells, x, y) {
    for (var index = 0; index < cells.length; index += 1) {
      var row = y + cells[index].y;
      var column = x + cells[index].x;
      if (column < 0 || column >= COLS || row >= ROWS || (row >= 0 && well[row][column] === 1)) return true;
    }
    return false;
  }

  function sameWell(left, right) {
    for (var row = 0; row < ROWS; row += 1) {
      for (var column = 0; column < COLS; column += 1) {
        if (left[row][column] !== right[row][column]) return false;
      }
    }
    return true;
  }

  function lockTransitionMatches(previous, target, lock) {
    if (!previous || !target || !lock || !previous.active) return false;
    var active = previous.active;
    if (active.kind !== lock.kind || active.rotation !== lock.rotation || active.x !== lock.x || lock.y < active.y) return false;
    var cells = shapeCells(lock.kind, lock.rotation);
    if (!cells || collidesAt(previous.well, cells, lock.x, lock.y) || !collidesAt(previous.well, cells, lock.x, lock.y + 1)) return false;
    // A hard drop may traverse several cells between two committed frames. It
    // still must be a monotonic collision-free descent from the last committed
    // active piece, rather than a guessed move, rotation, or teleport.
    for (var y = active.y; y <= lock.y; y += 1) {
      if (collidesAt(previous.well, cells, lock.x, y)) return false;
    }
    var projected = copyWell(previous.well);
    if (!projected) return false;
    for (var cellIndex = 0; cellIndex < cells.length; cellIndex += 1) {
      var row = lock.y + cells[cellIndex].y;
      var column = lock.x + cells[cellIndex].x;
      if (row < 0 || row >= ROWS || column < 0 || column >= COLS || projected[row][column] !== 0) return false;
      projected[row][column] = 1;
    }
    var cleared = 0;
    var survivors = [];
    for (var projectedRow = 0; projectedRow < ROWS; projectedRow += 1) {
      var full = true;
      for (var projectedColumn = 0; projectedColumn < COLS; projectedColumn += 1) {
        if (projected[projectedRow][projectedColumn] !== 1) { full = false; break; }
      }
      if (full) cleared += 1;
      else survivors.push(projected[projectedRow]);
    }
    if (cleared !== lock.cleared || cleared > 4) return false;
    while (survivors.length < ROWS) survivors.unshift(Array(COLS).fill(0));
    return sameWell(survivors, target.well);
  }

  function readStorage() {
    var storage = null;
    try {
      storage = root && root.localStorage;
      if (!storage && root && root.window) storage = root.window.localStorage;
    } catch (_error) { storage = null; }
    return storage && typeof storage.getItem === 'function' ? storage : null;
  }

  // Missing storage keys are the shipped default. Only an exact "0" is the
  // reversible local rollback; unavailable storage fails closed to DOM paint.
  function exactFeatureEnabled() {
    var storage = readStorage();
    if (!storage) return false;
    try {
      return storage.getItem(WAVE_B_STORAGE_KEY) !== '0' && storage.getItem(ENABLE_STORAGE_KEY) === '1';
    } catch (_error) { return false; }
  }

  function viewState(model) {
    if (!plainRecord(model)) return null;
    var candidates = ['viewState', 'currentState', 'state'];
    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = safeRead(model, candidates[index]);
      if (candidate.ok && plainRecord(candidate.value)) return candidate.value;
    }
    return model;
  }

  function mountFrom(model) {
    if (!plainRecord(model)) return null;
    var names = ['mountElement', 'mainWellRoot', 'mount', 'root'];
    for (var index = 0; index < names.length; index += 1) {
      var candidate = safeRead(model, names[index]);
      if (candidate.ok && candidate.value && typeof candidate.value.appendChild === 'function') return candidate.value;
    }
    return null;
  }

  function sourceFrom(model, online) {
    var source = safeRead(model, 'source');
    var value = source.ok && typeof source.value === 'string' ? source.value : (online ? '' : 'local');
    if (online) return ONLINE_SOURCES.has(value) ? value : null;
    return value === 'local' ? 'local' : null;
  }

  function lockFrom(model, state) {
    var candidates = ['trustedLock', 'lock', 'lastEvent'];
    var value = null;
    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = safeRead(model, candidates[index]);
      if (candidate.ok && plainRecord(candidate.value)) { value = candidate.value; break; }
    }
    if (!value && state) {
      var nested = safeRead(state, 'lastEvent');
      if (nested.ok && plainRecord(nested.value)) value = nested.value;
    }
    if (!plainRecord(value) || value.type !== 'lock') return null;
    var kind = integer(own(value, 'kind') ? value.kind : value.piece, 0, 6);
    var rotation = integer(value.rotation, 0, 3);
    var x = integer(value.x, -3, 9);
    var y = integer(value.y, -4, 17);
    var cleared = integer(value.cleared, 0, 4);
    if (kind === null || rotation === null || x === null || y === null || cleared === null) return null;
    var placement = own(value, 'placementSeq') ? integer(value.placementSeq, 0, Number.MAX_SAFE_INTEGER) : null;
    return { kind:kind, rotation:rotation, x:x, y:y, cleared:cleared, placementSeq:placement };
  }

  function buildCandidate(model) {
    if (!plainRecord(model) || model.waveBActive !== true) return { ok:false, reason:'wave_b_inactive' };
    var online = model.online === true;
    var source = sourceFrom(model, online);
    if (!source) return { ok:false, reason:'invalid_source' };
    if (!online && model.committed !== true) return { ok:false, reason:'uncommitted_local' };
    if (online && (model.accepted !== true || model.fullRuleAuthority !== true || model.protocol !== 'tetris-rule-v3')) {
      return { ok:false, reason:'untrusted_online' };
    }
    var playerCount = integer(model.playerCount, 2, 5);
    var viewPlayer = integer(model.viewPlayer, 0, 4);
    if (playerCount === null || viewPlayer === null || viewPlayer >= playerCount) return { ok:false, reason:'invalid_focus' };
    var state = viewState(model);
    if (!state) return { ok:false, reason:'invalid_state' };
    var well = copyWell(state.well);
    var active = copyActive(state.active);
    if (!well || (state.active !== null && !active) || typeof state.alive !== 'boolean') return { ok:false, reason:'invalid_well' };
    var placementSeq = integer(state.placementSeq, 0, Number.MAX_SAFE_INTEGER);
    var terminal = model.terminal === true;
    var winner = integer(model.winner, -1, 4);
    if (placementSeq === null || winner === null || (winner >= playerCount && winner !== -1)) return { ok:false, reason:'invalid_terminal' };
    var origin = { source:source };
    var authorityRevision = null;
    var matchId = null;
    var stateHash = null;
    if (online) {
      matchId = nonEmptyString(model.matchId, 160);
      var expectedMatchId = nonEmptyString(model.expectedMatchId, 160);
      authorityRevision = integer(model.authorityRevision, 0, Number.MAX_SAFE_INTEGER);
      stateHash = nonEmptyString(model.stateHash, 160);
      if (!matchId || !expectedMatchId || matchId !== expectedMatchId || authorityRevision === null || !stateHash) {
        return { ok:false, reason:'invalid_authority' };
      }
      origin.matchId = matchId;
      origin.authorityRevision = authorityRevision;
      origin.stateHash = stateHash;
    }
    var frame = {
      kind:'tetris-3d-frame-v1',
      origin:origin,
      viewPlayer:viewPlayer,
      playerCount:playerCount,
      well:well,
      active:active,
      alive:state.alive === true,
      placementSeq:placementSeq,
      terminal:terminal,
      winner:winner,
    };
    var fingerprint = JSON.stringify({
      origin:origin, viewPlayer:viewPlayer, playerCount:playerCount, well:well, active:active,
      alive:frame.alive, placementSeq:placementSeq, terminal:terminal, winner:winner,
    });
    return {
      ok:true,
      online:online,
      source:source,
      frame:frame,
      fingerprint:fingerprint,
      authorityRevision:authorityRevision,
      matchId:matchId,
      lock:lockFrom(model, state),
      mount:mountFrom(model),
      resetEpoch:integer(model.resetEpoch, 0, Number.MAX_SAFE_INTEGER),
      sourceEpoch:integer(model.sourceEpoch, 0, Number.MAX_SAFE_INTEGER),
      quality:normalizeQuality(model.quality),
      reducedMotion:model.reducedMotion === true,
      hidden:model.hidden === true,
      shellActive:model.shellActive !== false,
    };
  }

  function documentFor(mount) {
    try {
      if (mount && mount.ownerDocument && typeof mount.ownerDocument.createElement === 'function') return mount.ownerDocument;
      if (root && root.document && typeof root.document.createElement === 'function') return root.document;
      if (root && root.window && root.window.document && typeof root.window.document.createElement === 'function') return root.window.document;
    } catch (_error) {}
    return null;
  }

  function createSlot(mount) {
    var document = documentFor(mount);
    if (!document) return null;
    var slot;
    try { slot = document.createElement('div'); } catch (_error) { return null; }
    if (!slot) return null;
    slot.className = 'tetris-ghost3d-slot';
    if (typeof slot.setAttribute === 'function') {
      slot.setAttribute('aria-hidden', 'true');
      slot.setAttribute('role', 'presentation');
      slot.setAttribute('tabindex', '-1');
    }
    if (slot.dataset) slot.dataset.ghost3dReady = 'false';
    if (slot.style) {
      slot.style.cssText = 'position:absolute;inset:0;z-index:3;overflow:hidden;pointer-events:none;';
      slot.style.zIndex = '3';
      slot.style.pointerEvents = 'none';
    }
    return slot;
  }

  function appendSlot(slot, mount) {
    if (!slot || !mount || typeof mount.appendChild !== 'function') return false;
    try {
      if (slot.parentNode !== mount) mount.appendChild(slot);
      return true;
    } catch (_error) { return false; }
  }

  function removeSlot(slot) {
    if (!slot) return;
    try {
      if (typeof slot.remove === 'function') slot.remove();
      else if (slot.parentNode && typeof slot.parentNode.removeChild === 'function') slot.parentNode.removeChild(slot);
    } catch (_error) {}
  }

  function rendererImport() {
    if (sharedRendererModule) return Promise.resolve(sharedRendererModule);
    if (sharedRendererFailed) return Promise.reject(new Error('tetris_3d_import_failed'));
    if (sharedRendererPromise) return sharedRendererPromise;
    var loader = gameModuleLoader();
    if (!loader) {
      sharedRendererFailed = true;
      return Promise.reject(new Error('game_module_loader_unavailable'));
    }
    try {
      if (typeof loader.prefetch === 'function') loader.prefetch('tetris');
      sharedRendererPromise = Promise.resolve(loader.load('tetris', { resource:'renderer' })).then(function loaderResult(result) {
        if (!result || result.ok !== true || !result.module) throw new Error('tetris_3d_module_unavailable');
        return result.module;
      });
    } catch (error) {
      sharedRendererFailed = true;
      return Promise.reject(error);
    }
    sharedRendererPromise = Promise.resolve(sharedRendererPromise).then(function remembered(module) {
      sharedRendererModule = module;
      return module;
    }, function failed(error) {
      sharedRendererFailed = true;
      throw error;
    });
    return sharedRendererPromise;
  }

  function create(readModel) {
    var reader = typeof readModel === 'function' ? readModel : null;
    var state = {
      disposed:false,
      enabled:false,
      generation:0,
      adapterEpoch:0,
      presentationRevision:0,
      mount:null,
      slot:null,
      host:null,
      hostGeneration:0,
      lastFingerprint:'',
      lastFact:null,
      lastOnline:null,
      optimisticBlocked:null,
      resetEpoch:null,
      staticSourceToken:'',
      online:null,
      matchId:'',
      viewPlayer:null,
      terminal:false,
      quality:'BALANCED',
      reducedMotion:false,
      ready:false,
      fallback:true,
      lastReason:reader ? 'idle' : 'invalid_reader',
      lastMotionId:'',
      lastMotionType:null,
      adapterSignal:false,
      adapterActive:false,
      recoveryBlocked:false,
      rendererBlocked:false,
      recoverQueued:false,
      contextRecoveryPending:false,
      contextRecoveryQueued:false,
      contextRecoveryToken:0,
      listeners:[],
      media:null,
      documentHidden:false,
      shellActive:true,
    };

    function diagnostic() {
      return Object.freeze({
        status:state.disposed ? 'disposed' : (state.enabled ? 'active' : 'dom-fallback'),
        enabled:state.enabled,
        generation:state.generation,
        adapterEpoch:state.adapterEpoch,
        revision:state.presentationRevision,
        ready:state.ready,
        fallback:state.fallback,
        terminal:state.terminal,
        quality:state.quality,
        reducedMotion:state.reducedMotion,
        source:state.lastFact ? state.lastFact.source : null,
        reason:state.lastReason,
        motion:state.lastMotionId ? state.lastMotionType : null,
      });
    }

    function result(accepted, reason) {
      return Object.freeze({ accepted:accepted === true, reason:reason || null, snapshot:diagnostic() });
    }

    function current(generation, adapterEpoch) {
      if (state.disposed || generation !== state.generation) return false;
      return adapterEpoch === undefined || adapterEpoch === state.adapterEpoch;
    }

    function setReady(value, generation) {
      if (!current(generation)) return false;
      state.ready = value === true;
      var ready = state.ready ? 'true' : 'false';
      if (state.slot && state.slot.dataset) state.slot.dataset.ghost3dReady = ready;
      if (state.mount && state.mount.dataset) state.mount.dataset.ghost3dReady = ready;
      return state.ready;
    }

    function disposeHost() {
      var host = state.host;
      state.host = null;
      state.hostGeneration = 0;
      if (host && typeof host.dispose === 'function') {
        try { host.dispose(); } catch (_error) {}
      }
      state.fallback = true;
      state.adapterActive = false;
      setReady(false, state.generation);
    }

    function detachListeners() {
      state.listeners.forEach(function detach(listener) {
        if (!listener || !listener.target) return;
        try {
          if (listener.legacy && typeof listener.target.removeListener === 'function') listener.target.removeListener(listener.handler);
          else if (!listener.legacy && typeof listener.target.removeEventListener === 'function') listener.target.removeEventListener(listener.type, listener.handler, listener.options);
        } catch (_error) {}
      });
      state.listeners = [];
      state.media = null;
    }

    function listen(target, type, handler, options) {
      if (!target) return;
      try {
        if (typeof target.addEventListener === 'function') {
          target.addEventListener(type, handler, options);
          state.listeners.push({ target:target, type:type, handler:handler, options:options, legacy:false });
        } else if (type === 'change' && typeof target.addListener === 'function') {
          target.addListener(handler);
          state.listeners.push({ target:target, type:type, handler:handler, legacy:true });
        }
      } catch (_error) {}
    }

    function hostApply(message) {
      if (!state.host || typeof state.host.apply !== 'function') return null;
      try { return state.host.apply(message); } catch (_error) { return null; }
    }

    function applyLifecycleFacts() {
      if (!state.host) return;
      hostApply({ type:'lifecycle', action:state.documentHidden ? 'hidden' : 'visible', reason:'document' });
      hostApply({ type:'lifecycle', action:state.shellActive ? 'resume' : 'suspend', reason:'shell' });
    }

    function syncLifecycle(hidden, shellActive) {
      state.documentHidden = hidden === true;
      state.shellActive = shellActive !== false;
      applyLifecycleFacts();
    }

    function syncEnvironment(reducedMotion) {
      if (!state.host) return;
      hostApply({ type:'environment', reducedMotion:reducedMotion === true });
    }

    function installListeners(generation) {
      if (state.listeners.length || !current(generation)) return;
      var document = null;
      var window = null;
      try {
        document = root && (root.document || (root.window && root.window.document));
        window = root && (typeof root.addEventListener === 'function' ? root : root.window);
      } catch (_error) {}
      listen(document, 'visibilitychange', function onVisibility() {
        if (!current(generation)) return;
        state.documentHidden = !!(document && document.hidden);
        applyLifecycleFacts();
      });
      listen(window, 'ghostgame:shellchange', function onShell(event) {
        if (!current(generation)) return;
        var detail = event && event.detail;
        state.shellActive = !!(detail && detail.active === true && detail.gameId === 'tetris');
        applyLifecycleFacts();
      });
      var media = null;
      try { media = window && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (_error) { media = null; }
      if (media) {
        state.media = media;
        listen(media, 'change', function onMotionPreference(event) {
          if (!current(generation)) return;
          state.reducedMotion = !!(event && typeof event.matches === 'boolean' ? event.matches : media.matches);
          syncEnvironment(state.reducedMotion);
        });
      }
    }

    function hostFailed(generation) {
      if (!current(generation) || state.hostGeneration !== generation) return;
      state.adapterEpoch += 1;
      state.adapterSignal = false;
      state.adapterActive = false;
      state.recoveryBlocked = true;
      state.rendererBlocked = true;
      state.fallback = true;
      state.lastReason = 'host_failure';
      setReady(false, generation);
    }

    function adapterFailed(generation, adapterEpoch, reason) {
      if (!current(generation, adapterEpoch)) return;
      state.adapterEpoch += 1;
      state.adapterSignal = false;
      state.adapterActive = false;
      state.recoveryBlocked = true;
      state.rendererBlocked = true;
      state.fallback = true;
      state.lastReason = reason || 'adapter_failure';
      setReady(false, generation);
      hostApply({ type:'context-lost', reason:state.lastReason });
    }

    function adapterContextLost(generation, adapterEpoch, reason) {
      if (!current(generation, adapterEpoch)) return;
      var wasActive = state.adapterActive;
      // A constructor-time callback is not a usable context to recover. It
      // stays fail-closed like every other mount failure.
      if (!wasActive) {
        adapterFailed(generation, adapterEpoch, 'context_loss');
        return;
      }
      // Context recovery is a new presentation generation, never an adapter
      // swap inside the old one. Clear every old frame/revision guard before
      // disposing the host so old Adapter callbacks, host failures, queued
      // imports, and motion completions cannot revive it.
      state.adapterEpoch += 1;
      state.adapterSignal = false;
      state.adapterActive = false;
      state.recoveryBlocked = true;
      state.rendererBlocked = false;
      state.fallback = true;
      state.lastReason = typeof reason === 'string' ? 'context_loss' : 'context_loss';
      state.presentationRevision = 0;
      state.lastFingerprint = '';
      state.lastFact = null;
      state.lastOnline = null;
      state.optimisticBlocked = null;
      state.staticSourceToken = '';
      state.terminal = false;
      state.lastMotionId = '';
      state.lastMotionType = null;
      state.recoverQueued = false;
      state.contextRecoveryPending = true;
      state.contextRecoveryToken += 1;
      disposeHost();
      detachListeners();
      queueContextRecovery();
    }

    function adapterReady(generation, adapterEpoch) {
      if (!current(generation, adapterEpoch)) return;
      state.adapterSignal = true;
      if (!state.lastFact) return;
      var snapshot = null;
      try { snapshot = state.host && typeof state.host.snapshot === 'function' ? state.host.snapshot() : null; } catch (_error) {}
      if (snapshot && (snapshot.usingFallback === true || snapshot.adapterReady === false)) return;
      state.fallback = false;
      setReady(true, generation);
    }

    function rendererSupported(module) {
      if (!module || typeof module.isTetris3DSupported !== 'function') return false;
      try { return module.isTetris3DSupported() === true; } catch (_error) { return false; }
    }

    function createAdapter(module, generation) {
      if (!current(generation) || !state.slot || !module || typeof module.createTetris3DAdapter !== 'function') return null;
      var adapterEpoch = ++state.adapterEpoch;
      state.adapterSignal = false;
      var adapter;
      try {
        adapter = module.createTetris3DAdapter({
          mountElement:state.slot,
          quality:state.quality,
          reducedMotion:state.reducedMotion,
          onReady:function onReady() { adapterReady(generation, adapterEpoch); },
          onError:function onError() { adapterFailed(generation, adapterEpoch, 'adapter_error'); },
          onContextLost:function onContextLost(reason) { adapterContextLost(generation, adapterEpoch, reason); },
        });
      } catch (_error) { return null; }
      return { adapter:adapter, epoch:adapterEpoch };
    }

    function recoverWith(module, generation) {
      if (!current(generation) || !state.host || state.rendererBlocked || !rendererSupported(module)) return false;
      if (state.recoveryBlocked) return false;
      if (state.adapterActive) return true;
      var created = createAdapter(module, generation);
      var adapterEpoch = created && created.epoch;
      var adapter = created && created.adapter;
      if (!created || !adapter) {
        adapterFailed(generation, adapterEpoch, 'adapter_create');
        return false;
      }
      // Factory callbacks are allowed to fail synchronously.  They close the
      // epoch before the factory returns, so this exact epoch check is needed
      // before a failed adapter can ever reach Foundation.recover().
      if (!current(generation, adapterEpoch)) {
        try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (_error) {}
        return false;
      }
      var recovered = hostApply({ type:'recover', adapter:adapter });
      if (!recovered || recovered.accepted !== true) {
        if (current(generation, adapterEpoch)) state.adapterEpoch += 1;
        try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (_error) {}
        setReady(false, generation);
        state.fallback = true;
        state.lastReason = 'adapter_recover';
        return false;
      }
      // Foundation may synchronously fail the mount and call onFailure before
      // recover() returns.  Do not let this stale success path mark that
      // already-failed Adapter as active again.
      if (!current(generation, adapterEpoch)) return false;
      var hostSnapshot = null;
      try { hostSnapshot = state.host && typeof state.host.snapshot === 'function' ? state.host.snapshot() : null; } catch (_error) {}
      if (hostSnapshot && hostSnapshot.usingFallback === true) return false;
      state.adapterActive = true;
      return true;
    }

    function queueRecovery() {
      if (state.disposed || state.recoverQueued || state.recoveryBlocked || state.rendererBlocked || !state.host || !state.lastFact) return;
      var generation = state.generation;
      state.recoverQueued = true;
      Promise.resolve().then(function recoverLater() {
        state.recoverQueued = false;
        if (!current(generation) || !state.host || !state.lastFact) return;
        if (sharedRendererModule) recoverWith(sharedRendererModule, generation);
      });
    }

    function queueContextRecovery() {
      if (state.disposed || !reader || !state.contextRecoveryPending || state.contextRecoveryQueued) return;
      var token = ++state.contextRecoveryToken;
      state.contextRecoveryQueued = true;
      Promise.resolve().then(function recoverFreshGeneration() {
        if (state.disposed || !state.contextRecoveryPending || token !== state.contextRecoveryToken) return;
        state.contextRecoveryQueued = false;
        // commit() reads the latest in-process accepted/committed fact. With
        // the host cleared above it must create a fresh generation, whose
        // first frame has no predecessor and therefore always reconciles
        // statically.
        commit();
      });
    }

    function loadRenderer(generation) {
      if (!current(generation) || state.recoveryBlocked || state.rendererBlocked || !state.host || sharedRendererFailed) return;
      if (sharedRendererModule) { recoverWith(sharedRendererModule, generation); return; }
      rendererImport().then(function moduleReady(module) {
        if (!current(generation) || !state.host) return;
        if (!rendererSupported(module)) {
          state.lastReason = 'unsupported_renderer';
          state.recoveryBlocked = true;
          state.rendererBlocked = true;
          setReady(false, generation);
          return;
        }
        recoverWith(module, generation);
      }, function importFailed() {
        if (!current(generation)) return;
        state.lastReason = 'import_failure';
        state.recoveryBlocked = true;
        state.rendererBlocked = true;
        state.fallback = true;
        setReady(false, generation);
      });
    }

    function startGeneration(candidate, reason) {
      // Listener closures are generation-bound.  Remove old ones before the
      // generation changes so the fresh host receives its own visibility,
      // shell, and reduced-motion observers instead of inert old closures.
      detachListeners();
      state.contextRecoveryPending = false;
      state.contextRecoveryQueued = false;
      state.contextRecoveryToken += 1;
      state.generation += 1;
      state.adapterEpoch += 1;
      state.presentationRevision = 0;
      state.lastFingerprint = '';
      state.lastFact = null;
      state.lastOnline = null;
      state.optimisticBlocked = null;
      state.staticSourceToken = '';
      state.terminal = false;
      state.lastMotionId = '';
      state.lastMotionType = null;
      state.adapterSignal = false;
      state.adapterActive = false;
      state.recoveryBlocked = false;
      state.rendererBlocked = false;
      state.documentHidden = candidate.hidden === true;
      state.shellActive = candidate.shellActive !== false;
      state.mount = candidate.mount;
      state.resetEpoch = candidate.resetEpoch;
      state.online = candidate.online;
      state.matchId = candidate.matchId || '';
      state.viewPlayer = candidate.frame.viewPlayer;
      state.quality = candidate.quality;
      state.reducedMotion = candidate.reducedMotion;
      state.lastReason = reason || 'generation';
      disposeHost();
      if (!state.slot) state.slot = createSlot(candidate.mount);
      if (!appendSlot(state.slot, candidate.mount)) {
        state.lastReason = 'slot_mount_failure';
        state.enabled = false;
        return false;
      }
      if (state.slot && state.slot.dataset) state.slot.dataset.ghost3dGeneration = String(state.generation);
      var factory = null;
      try { factory = root && root.Ghost3DFoundation; } catch (_error) { factory = null; }
      if (!factory || typeof factory.create !== 'function') {
        state.lastReason = 'foundation_unavailable';
        state.enabled = false;
        return false;
      }
      var generation = state.generation;
      state.hostGeneration = generation;
      try {
        state.host = factory.create({
          quality:state.quality,
          reducedMotion:state.reducedMotion,
          onFailure:function onFailure() { hostFailed(generation); },
        });
      } catch (_error) { state.host = null; }
      if (!state.host || typeof state.host.apply !== 'function') {
        state.hostGeneration = 0;
        state.lastReason = 'foundation_create_failure';
        state.enabled = false;
        return false;
      }
      state.enabled = true;
      installListeners(generation);
      syncEnvironment(state.reducedMotion);
      syncLifecycle(candidate.hidden, candidate.shellActive);
      loadRenderer(generation);
      return true;
    }

    function failClosed(reason) {
      state.contextRecoveryPending = false;
      state.contextRecoveryQueued = false;
      state.contextRecoveryToken += 1;
      state.lastReason = reason || 'untrusted_state';
      state.fallback = true;
      state.adapterEpoch += 1;
      state.adapterActive = false;
      state.recoveryBlocked = true;
      setReady(false, state.generation);
      hostApply({ type:'context-lost', reason:state.lastReason });
      return result(false, state.lastReason);
    }

    function stopped(reason) {
      state.enabled = false;
      state.contextRecoveryPending = false;
      state.contextRecoveryQueued = false;
      state.contextRecoveryToken += 1;
      state.generation += 1;
      state.adapterEpoch += 1;
      state.lastReason = reason || 'disabled';
      state.lastFact = null;
      state.lastOnline = null;
      state.optimisticBlocked = null;
      state.lastFingerprint = '';
      state.terminal = false;
      state.lastMotionId = '';
      state.lastMotionType = null;
      disposeHost();
      detachListeners();
      removeSlot(state.slot);
      state.slot = null;
      state.mount = null;
      return result(false, state.lastReason);
    }

    function requiresGeneration(candidate) {
      if (!state.host || !state.slot || !state.enabled) return true;
      if (state.mount !== candidate.mount || state.resetEpoch !== candidate.resetEpoch) return true;
      if (state.online !== candidate.online || state.matchId !== (candidate.matchId || '')) return true;
      if (state.viewPlayer !== candidate.frame.viewPlayer) return true;
      if (state.terminal && !candidate.frame.terminal) return true;
      if (STATIC_ONLINE_SOURCES.has(candidate.source)) {
        var token = candidate.source + ':' + (candidate.sourceEpoch === null ? candidate.authorityRevision : candidate.sourceEpoch) + ':' + (candidate.matchId || '');
        if (token !== state.staticSourceToken) return true;
      }
      return false;
    }

    function noteStaticSource(candidate) {
      if (!STATIC_ONLINE_SOURCES.has(candidate.source)) return;
      state.staticSourceToken = candidate.source + ':' + (candidate.sourceEpoch === null ? candidate.authorityRevision : candidate.sourceEpoch) + ':' + (candidate.matchId || '');
    }

    function onlineTrustFailure(candidate) {
      if (!candidate.online) return null;
      if (state.optimisticBlocked && state.optimisticBlocked.matchId === candidate.matchId) {
        if (candidate.authorityRevision <= state.optimisticBlocked.authorityRevision) return 'optimistic_pending';
        state.optimisticBlocked = null;
      }
      if (!state.lastOnline || state.lastOnline.matchId !== candidate.matchId) return null;
      if (candidate.authorityRevision < state.lastOnline.authorityRevision) return 'stale_authority';
      if (candidate.authorityRevision === state.lastOnline.authorityRevision && candidate.fingerprint !== state.lastOnline.fingerprint) {
        state.optimisticBlocked = { matchId:candidate.matchId, authorityRevision:candidate.authorityRevision };
        return 'optimistic_mismatch';
      }
      return null;
    }

    function nextFrame(candidate) {
      var revision = state.presentationRevision + 1;
      if (!Number.isSafeInteger(revision)) return null;
      return freeze({
        kind:candidate.frame.kind,
        revision:revision,
        origin:candidate.frame.origin,
        viewPlayer:candidate.frame.viewPlayer,
        playerCount:candidate.frame.playerCount,
        well:candidate.frame.well,
        active:candidate.frame.active,
        alive:candidate.frame.alive,
        placementSeq:candidate.frame.placementSeq,
        terminal:candidate.frame.terminal,
        winner:candidate.frame.winner,
      });
    }

    function motionFor(previous, candidate, frame) {
      if (!previous || !frame || candidate.source !== 'local' && candidate.source !== 'live') return null;
      if (previous.source !== candidate.source || previous.online !== candidate.online) return null;
      if (previous.frame.viewPlayer !== frame.viewPlayer || previous.frame.playerCount !== frame.playerCount ||
          previous.frame.terminal || frame.terminal || !frame.alive ||
          frame.placementSeq !== previous.frame.placementSeq + 1) return null;
      if (candidate.online && (!previous.online || previous.matchId !== candidate.matchId ||
          candidate.authorityRevision !== previous.authorityRevision + 1)) return null;
      var lock = candidate.lock;
      if (!lock || (lock.placementSeq !== null && lock.placementSeq !== frame.placementSeq)) return null;
      if (!lockTransitionMatches(previous.frame, frame, lock)) return null;
      return Object.freeze({
        type:'piece_locked',
        revision:frame.revision,
        eventId:state.generation + ':' + frame.revision + ':' + frame.viewPlayer + ':' + frame.placementSeq,
        player:frame.viewPlayer,
        kind:lock.kind,
        rotation:lock.rotation,
        x:lock.x,
        y:lock.y,
        cleared:lock.cleared,
      });
    }

    function terminalMotionFor(previous, candidate, frame) {
      if (!previous || !frame || !frame.terminal || previous.frame.terminal ||
          candidate.source !== 'local' && candidate.source !== 'live' || previous.source !== candidate.source ||
          previous.online !== candidate.online || previous.frame.viewPlayer !== frame.viewPlayer ||
          previous.frame.playerCount !== frame.playerCount) return null;
      if (candidate.online && (!previous.online || previous.matchId !== candidate.matchId ||
          candidate.authorityRevision !== previous.authorityRevision + 1)) return null;
      return Object.freeze({
        type:'terminal',
        revision:frame.revision,
        winner:frame.winner,
        outcome:frame.winner >= 0 ? 'win' : 'draw',
        eventId:state.generation + ':' + frame.revision + ':terminal',
      });
    }

    function rendererCanReceiveMotion() {
      if (!state.ready) return false;
      var snapshot = null;
      try { snapshot = state.host && typeof state.host.snapshot === 'function' ? state.host.snapshot() : null; } catch (_error) {}
      return !!state.host && (!snapshot || (snapshot.usingFallback !== true && snapshot.suspended !== true && snapshot.adapterReady !== false));
    }

    function canLockMotion() {
      return !state.reducedMotion && state.quality !== 'LOW' && rendererCanReceiveMotion();
    }

    function commit() {
      if (state.disposed) return result(false, 'disposed');
      if (!reader) return stopped('invalid_reader');
      if (!exactFeatureEnabled()) return stopped('feature_disabled');
      var model;
      try { model = reader(); } catch (_error) { return failClosed('reader_failure'); }
      var candidate = buildCandidate(model);
      if (!candidate.ok) {
        // The DOM caller deliberately withholds a v3 frame while an online
        // action has changed the locally painted well at an unchanged accepted
        // authority revision.  Remember that guard here as well as in the
        // complete-frame path, so a later duplicate of the old snapshot
        // cannot revive the optional canvas before a newer revision arrives.
        if (candidate.reason === 'untrusted_online' && plainRecord(model) && model.online === true && model.optimistic === true && state.lastOnline) {
          state.optimisticBlocked = {
            matchId:state.lastOnline.matchId,
            authorityRevision:state.lastOnline.authorityRevision,
          };
        }
        return failClosed(candidate.reason);
      }
      if (!candidate.mount) return failClosed('missing_mount');
      if (requiresGeneration(candidate) && !startGeneration(candidate, 'generation_reset')) return failClosed(state.lastReason);
      if (!appendSlot(state.slot, candidate.mount)) return failClosed('slot_rebuild_failure');
      state.enabled = true;
      if (state.host && state.quality !== candidate.quality) hostApply({ type:'quality', quality:candidate.quality });
      state.quality = candidate.quality;
      state.reducedMotion = candidate.reducedMotion;
      syncEnvironment(state.reducedMotion);
      // Runtime visibility/shell events own their facts for an active
      // generation.  A later render commit must not turn an already-inactive
      // Hub shell back into Tetris just because its read model is unchanged.
      // Candidate facts are installed by startGeneration() only.
      applyLifecycleFacts();
      var trustFailure = onlineTrustFailure(candidate);
      if (trustFailure) return failClosed(trustFailure);
      if (candidate.online && state.lastOnline && state.lastOnline.matchId === candidate.matchId &&
          candidate.authorityRevision === state.lastOnline.authorityRevision && candidate.fingerprint === state.lastOnline.fingerprint) {
        state.lastReason = 'duplicate_authority';
        return result(true, 'duplicate_authority');
      }
      if (candidate.fingerprint === state.lastFingerprint) {
        state.lastReason = 'duplicate_frame';
        if (state.fallback) queueRecovery();
        return result(true, 'duplicate_frame');
      }
      var frame = nextFrame(candidate);
      if (!frame) return failClosed('revision_overflow');
      var applied = hostApply({ type:'frame', frame:frame });
      if (!applied || applied.accepted !== true) return failClosed('frame_rejected');
      var previous = state.lastFact;
      state.presentationRevision = frame.revision;
      state.lastFingerprint = candidate.fingerprint;
      state.lastFact = { frame:frame, online:candidate.online, source:candidate.source, matchId:candidate.matchId, authorityRevision:candidate.authorityRevision };
      if (candidate.online) state.lastOnline = { matchId:candidate.matchId, authorityRevision:candidate.authorityRevision, fingerprint:candidate.fingerprint };
      state.terminal = frame.terminal === true;
      state.lastReason = 'frame';
      if (!state.rendererBlocked) state.recoveryBlocked = false;
      noteStaticSource(candidate);
      if (state.adapterSignal) adapterReady(state.generation, state.adapterEpoch);
      var motion = terminalMotionFor(previous, candidate, frame) || motionFor(previous, candidate, frame);
      // Runtime lifecycle events, not a possibly stale caller projection, own
      // whether this generation may animate.  Foundation also rejects motion
      // while suspended, but keeping the guard here avoids even attempting a
      // presentation event after the Shell has moved back to the Hub.
      var rendererMayReceive = motion && motion.type === 'terminal' ? rendererCanReceiveMotion() : canLockMotion();
      if (motion && !state.documentHidden && state.shellActive && rendererMayReceive) {
        var motionResult = hostApply({ type:'motion', event:motion });
        if (motionResult && motionResult.accepted === true) {
          state.lastMotionId = motion.eventId;
          state.lastMotionType = motion.type;
        }
      }
      if (state.fallback) loadRenderer(state.generation);
      return result(true, 'frame');
    }

    function dispose() {
      if (state.disposed) return diagnostic();
      if (state.mount && state.mount.dataset) state.mount.dataset.ghost3dReady = 'false';
      state.disposed = true;
      state.enabled = false;
      state.contextRecoveryPending = false;
      state.contextRecoveryQueued = false;
      state.contextRecoveryToken += 1;
      state.generation += 1;
      state.adapterEpoch += 1;
      state.lastReason = 'disposed';
      state.lastFact = null;
      state.lastOnline = null;
      disposeHost();
      detachListeners();
      removeSlot(state.slot);
      state.slot = null;
      state.mount = null;
      return diagnostic();
    }

    return Object.freeze({ commit:commit, snapshot:diagnostic, dispose:dispose });
  }

  return Object.freeze({ create:create });
}));
