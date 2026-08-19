/* ================= Tank Ghost3D presenter =================
 *
 * A default-off, one-way presentation Module for the real-time Tank arena.
 * Its deliberately small Interface is:
 *
 *   TankGhost3DPresenter.create(readModel) -> commit/snapshot/dispose
 *
 * `readModel` belongs to tank.js and is called after a local committed
 * simulation step or after a raw tank-authority-v1 receipt has been accepted.
 * The Module never receives an input callback, socket, Rule/Authority object,
 * scoring/history object, or Renderer value from its caller.
 */
(function installTankGhost3DPresenter(root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else if (root) root.TankGhost3DPresenter = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createTankGhost3DPresenter(root) {
  'use strict';

  var WAVE_B_STORAGE_KEY = 'mg_art_game_stage_wave_b_v1';
  var ENABLE_STORAGE_KEY = 'mg_ghost3d_tank_v1';
  var QUALITY_STORAGE_KEY = 'mg_ghost3d_tank_quality_v1';
  var IMPORT_PATH = './three/tank-entry.js?v=sha256-5858d98dd19650f7';
  var IMPORT_RETRY_PATH = './three/tank-entry.js?v=sha256-5858d98dd19650f7-retry1';
  var AUTHORITY_PROTOCOL = 'tank-authority-v1';
  var QUALITY_SET = new Set(['HIGH', 'BALANCED', 'LOW']);
  var SOURCE_SET = new Set(['local', 'live', 'reconcile']);
  var SEASON_SET = new Set(['spring', 'summer', 'autumn', 'winter']);
  var MAX_TANKS = 5;
  var MAX_PROJECTILES_SOURCE = 160;
  var MAX_PROJECTILES_VISIBLE = 128;
  var ARENA_HEIGHT = 13;
  var sharedRendererModule = null;
  var sharedRendererPromise = null;
  var sharedRendererPromisePath = '';

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
      if (Object.prototype.toString.call(value) !== '[object Object]') return false;
      var prototype = Object.getPrototypeOf(value);
      if (prototype === null || prototype === Object.prototype) return true;
      var constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function' && constructor.name === 'Object';
    } catch (_error) { return false; }
  }

  function integer(value, minimum, maximum) {
    return Number.isSafeInteger(value) && value >= minimum && value <= maximum ? value : null;
  }

  function finite(value, minimum, maximum) {
    return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
  }

  function nonEmptyString(value, maximum) {
    return typeof value === 'string' && value.length > 0 && value.length <= (maximum || 160) ? value : null;
  }

  function normalizeQuality(value) {
    var candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return QUALITY_SET.has(candidate) ? candidate : 'BALANCED';
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
      return storage.getItem('mg_art_game_stage_wave_b_v1') !== '0' && storage.getItem('mg_ghost3d_tank_v1') === '1';
    } catch (_error) { return false; }
  }

  function qualityFromStorage() {
    var storage = readStorage();
    if (!storage) return 'BALANCED';
    try { return normalizeQuality(storage.getItem(QUALITY_STORAGE_KEY)); } catch (_error) { return 'BALANCED'; }
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
    var slot = null;
    try { slot = document.createElement('div'); } catch (_error) { return null; }
    if (!slot) return null;
    slot.className = 'tank-ghost3d-slot';
    if (typeof slot.setAttribute === 'function') {
      slot.setAttribute('aria-hidden', 'true');
      slot.setAttribute('role', 'presentation');
      slot.setAttribute('tabindex', '-1');
    }
    if (slot.dataset) slot.dataset.ghost3dReady = 'false';
    if (slot.style) {
      slot.style.cssText = 'position:absolute;inset:0;z-index:7;overflow:hidden;pointer-events:none;';
      slot.style.pointerEvents = 'none';
      slot.style.zIndex = '7';
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

  function readMount(model) {
    if (!plainRecord(model)) return null;
    var candidates = ['mountElement', 'arenaRoot', 'mount', 'root'];
    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = safeRead(model, candidates[index]);
      if (candidate.ok && candidate.value && typeof candidate.value.appendChild === 'function') return candidate.value;
    }
    return null;
  }

  function copyCells(value, width) {
    if (!Array.isArray(value) || value.length !== ARENA_HEIGHT) return null;
    var copied = [];
    for (var row = 0; row < ARENA_HEIGHT; row += 1) {
      if (!Array.isArray(value[row]) || value[row].length !== width) return null;
      var next = [];
      for (var column = 0; column < width; column += 1) {
        var cell = value[row][column];
        if (cell !== 0 && cell !== 2 && cell !== 3) return null;
        next.push(cell);
      }
      copied.push(next);
    }
    return copied;
  }

  function readCounter(value) {
    return integer(value, 0, Number.MAX_SAFE_INTEGER);
  }

  function copyTanks(value, playerCount, width, sampledAt) {
    if (!Array.isArray(value) || value.length !== playerCount || playerCount < 2 || playerCount > MAX_TANKS) return null;
    var tanks = [];
    var signals = [];
    for (var index = 0; index < playerCount; index += 1) {
      var source = value[index];
      if (!plainRecord(source)) return null;
      var id = own(source, 'id') ? integer(source.id, 0, playerCount - 1) : index;
      var x = finite(source.x, 0.5, width - 0.5);
      var y = finite(source.y, 0.5, ARENA_HEIGHT - 0.5);
      var direction = integer(source.d, 0, 3);
      var hp = integer(source.hp, 0, 3);
      var alive = source.alive === true;
      var shots = readCounter(source.shots);
      var hits = readCounter(source.hits);
      var kills = readCounter(source.kills);
      var deaths = readCounter(source.deaths);
      var damage = readCounter(source.damage);
      if (id === null || id !== index || x === null || y === null || direction === null || hp === null ||
          shots === null || hits === null || kills === null || deaths === null || damage === null) return null;
      var invulnerableUntil = finite(source.invulnerableUntil, 0, Number.MAX_SAFE_INTEGER);
      var shielded = invulnerableUntil !== null && finite(sampledAt, 0, Number.MAX_SAFE_INTEGER) !== null && invulnerableUntil > sampledAt;
      tanks.push({ id:id, x:x, y:y, direction:direction, hp:hp, alive:alive, shielded:shielded });
      signals.push({ id:id, x:x, y:y, direction:direction, hp:hp, alive:alive, shots:shots, hits:hits, kills:kills, deaths:deaths, damage:damage });
    }
    return { tanks:tanks, signals:signals };
  }

  function copyProjectiles(value, playerCount, width) {
    if (!Array.isArray(value) || value.length > MAX_PROJECTILES_SOURCE) return null;
    var projectiles = [];
    for (var index = 0; index < value.length; index += 1) {
      var source = value[index];
      if (!plainRecord(source)) return null;
      var id = integer(source.id, 1, Number.MAX_SAFE_INTEGER);
      var owner = integer(source.owner, 0, playerCount - 1);
      var x = finite(source.x, 0.01, width - 0.01);
      var y = finite(source.y, 0.01, ARENA_HEIGHT - 0.01);
      var direction = integer(source.d, 0, 3);
      if (id === null || owner === null || x === null || y === null || direction === null) return null;
      projectiles.push({ id:id, owner:owner, x:x, y:y, direction:direction });
    }
    projectiles.sort(function compareProjectile(left, right) { return left.id - right.id; });
    return projectiles.slice(0, MAX_PROJECTILES_VISIBLE);
  }

  function validOrder(value, playerCount) {
    if (!Array.isArray(value) || value.length !== playerCount) return null;
    var seen = new Set();
    for (var index = 0; index < value.length; index += 1) {
      var id = integer(value[index], 0, playerCount - 1);
      if (id === null || seen.has(id)) return null;
      seen.add(id);
    }
    return value.slice();
  }

  function readArena(value, cellsKey, playersKey, projectilesKey, playerCount, sampledAt) {
    if (!plainRecord(value)) return null;
    var width = integer(value.width, 15, 17);
    if (width === null || (width !== 15 && width !== 17) || value.height !== undefined && value.height !== ARENA_HEIGHT) return null;
    var season = typeof value.season === 'string' && SEASON_SET.has(value.season) ? value.season : null;
    var cells = copyCells(value[cellsKey], width);
    var players = copyTanks(value[playersKey], playerCount, width, sampledAt);
    var projectiles = copyProjectiles(value[projectilesKey], playerCount, width);
    if (!season || !cells || !players || !projectiles) return null;
    return {
      arena:{ width:width, height:ARENA_HEIGHT, season:season, cells:cells },
      tanks:players.tanks,
      signals:players.signals,
      projectiles:projectiles
    };
  }

  function localCandidate(model) {
    if (model.committed !== true || model.isReplaying === true) return { ok:false, reason:model.isReplaying === true ? 'history_dom_only' : 'uncommitted_local' };
    var state = safeRead(model, 'localState');
    if (!state.ok || !plainRecord(state.value)) return { ok:false, reason:'invalid_local_state' };
    var playerCount = integer(model.playerCount, 2, MAX_TANKS);
    var localEpoch = integer(model.localEpoch, 0, Number.MAX_SAFE_INTEGER);
    if (playerCount === null || localEpoch === null) return { ok:false, reason:'invalid_local_epoch' };
    var local = state.value;
    var adapted = {
      width:local.width,
      height:local.height,
      season:local.season,
      cells:local.cells,
      players:local.tanks,
      projectiles:local.projectiles
    };
    var arena = readArena(adapted, 'cells', 'players', 'projectiles', playerCount, Date.now());
    var terminal = local.terminal === true;
    var winner = integer(local.winner, -1, playerCount - 1);
    if (!arena || winner === null) return { ok:false, reason:'invalid_local_projection' };
    return {
      ok:true,
      online:false,
      source:'local',
      localEpoch:localEpoch,
      authorityTick:null,
      sourceEpoch:integer(model.sourceEpoch, 0, Number.MAX_SAFE_INTEGER),
      frame:{
        kind:'tank-3d-frame-v1',
        origin:{ source:'local', continuity:'snap' },
        arena:arena.arena,
        playerCount:playerCount,
        tanks:arena.tanks,
        projectiles:arena.projectiles,
        terminal:terminal,
        winner:winner
      },
      signals:arena.signals,
      mount:readMount(model),
      resetEpoch:integer(model.resetEpoch, 0, Number.MAX_SAFE_INTEGER),
      quality:normalizeQuality(model.quality),
      reducedMotion:model.reducedMotion === true,
      hidden:model.hidden === true,
      shellActive:model.shellActive !== false
    };
  }

  function onlineCandidate(model) {
    if (model.authorityMode !== true) return { ok:false, reason:'legacy_relay_dom_only' };
    if (model.isReplaying === true) return { ok:false, reason:'history_dom_only' };
    var receiptValue = safeRead(model, 'receipt');
    var receipt = receiptValue.ok ? receiptValue.value : null;
    if (!plainRecord(receipt) || model.accepted !== true || receipt.protocol !== AUTHORITY_PROTOCOL) return { ok:false, reason:'unaccepted_authority' };
    var source = typeof model.source === 'string' ? model.source : 'live';
    if (source !== 'live' && source !== 'reconcile') return { ok:false, reason:'invalid_source' };
    var playerCount = integer(model.playerCount, 2, MAX_TANKS);
    var matchId = nonEmptyString(receipt.matchId, 160);
    var expectedMatchId = nonEmptyString(model.expectedMatchId, 160);
    var serverTick = integer(receipt.serverTick, 0, Number.MAX_SAFE_INTEGER);
    var receiptEpoch = integer(model.receiptEpoch, 0, Number.MAX_SAFE_INTEGER);
    var sampledAt = finite(receipt.serverNow, 0, Number.MAX_SAFE_INTEGER);
    if (playerCount === null || !matchId || !expectedMatchId || matchId !== expectedMatchId || serverTick === null || receiptEpoch === null) {
      return { ok:false, reason:'invalid_authority' };
    }
    var adapted = {
      width:receipt.width === undefined ? (playerCount > 4 ? 17 : 15) : receipt.width,
      height:receipt.height === undefined ? ARENA_HEIGHT : receipt.height,
      season:receipt.season,
      cells:receipt.destructibles,
      players:receipt.players,
      projectiles:receipt.projectiles
    };
    var arena = readArena(adapted, 'cells', 'players', 'projectiles', playerCount, sampledAt === null ? 0 : sampledAt);
    var status = receipt.status;
    if (status !== undefined && status !== 'running' && status !== 'finished') return { ok:false, reason:'invalid_authority_status' };
    var terminal = status === 'finished' || receipt.finished === true;
    var order = terminal ? validOrder(receipt.order, playerCount) : null;
    if (!arena || terminal && !order) return { ok:false, reason:'invalid_authority_projection' };
    return {
      ok:true,
      online:true,
      source:source,
      localEpoch:null,
      authorityTick:serverTick,
      sourceEpoch:receiptEpoch,
      matchId:matchId,
      frame:{
        kind:'tank-3d-frame-v1',
        origin:{ source:source, matchId:matchId, serverTick:serverTick, continuity:'snap' },
        arena:arena.arena,
        playerCount:playerCount,
        tanks:arena.tanks,
        projectiles:arena.projectiles,
        terminal:terminal,
        winner:terminal && order ? order[0] : -1
      },
      signals:arena.signals,
      mount:readMount(model),
      resetEpoch:integer(model.resetEpoch, 0, Number.MAX_SAFE_INTEGER),
      quality:normalizeQuality(model.quality),
      reducedMotion:model.reducedMotion === true,
      hidden:model.hidden === true,
      shellActive:model.shellActive !== false
    };
  }

  function buildCandidate(model) {
    if (!plainRecord(model) || model.waveBActive !== true) return { ok:false, reason:'wave_b_inactive' };
    var candidate = model.online === true ? onlineCandidate(model) : localCandidate(model);
    if (!candidate.ok) return candidate;
    if (!candidate.mount || candidate.resetEpoch === null || candidate.sourceEpoch === null) return { ok:false, reason:'invalid_mount_or_epoch' };
    return candidate;
  }

  function fingerprint(candidate) {
    var frame = candidate.frame;
    return JSON.stringify([
      frame.arena.width, frame.arena.height, frame.arena.season, frame.arena.cells,
      frame.playerCount,
      frame.tanks.map(function tankValue(tank) { return [tank.id, tank.x, tank.y, tank.direction, tank.hp, tank.alive, tank.shielded]; }),
      frame.projectiles.map(function projectileValue(projectile) { return [projectile.id, projectile.owner, projectile.x, projectile.y, projectile.direction]; }),
      frame.terminal, frame.winner
    ]);
  }

  function signalFingerprint(candidate) {
    return JSON.stringify(candidate.signals.map(function signalValue(signal) {
      return [signal.id, signal.x, signal.y, signal.direction, signal.hp, signal.alive, signal.shots, signal.hits, signal.kills, signal.deaths, signal.damage];
    }));
  }

  function cloneFrame(candidate, revision, continuity) {
    var frame = candidate.frame;
    var origin = { source:frame.origin.source, continuity:continuity };
    if (candidate.online) {
      origin.matchId = candidate.matchId;
      origin.serverTick = candidate.authorityTick;
    }
    return freeze({
      kind:'tank-3d-frame-v1',
      revision:revision,
      origin:origin,
      arena:{
        width:frame.arena.width,
        height:frame.arena.height,
        season:frame.arena.season,
        cells:frame.arena.cells.map(function copyRow(row) { return row.slice(); })
      },
      playerCount:frame.playerCount,
      tanks:frame.tanks.map(function copyTank(tank) {
        return { id:tank.id, x:tank.x, y:tank.y, direction:tank.direction, hp:tank.hp, alive:tank.alive, shielded:tank.shielded };
      }),
      projectiles:frame.projectiles.map(function copyProjectile(projectile) {
        return { id:projectile.id, owner:projectile.owner, x:projectile.x, y:projectile.y, direction:projectile.direction };
      }),
      terminal:frame.terminal,
      winner:frame.winner
    });
  }

  function semanticEvent(previous, candidate, frame, generation) {
    if (!frame) return null;
    if (candidate.frame.terminal && (!previous || (candidate.source === previous.source && !previous.frame.terminal))) {
      var terminalWinner = candidate.frame.winner;
      var terminalTank = candidate.frame.tanks.find(function findWinner(tank) { return tank.id === terminalWinner; });
      if (!terminalTank) return null;
      return freeze({
        type:'terminal',
        revision:frame.revision,
        eventId:generation + ':' + frame.revision + ':terminal:' + terminalWinner + ':' + (candidate.online ? candidate.authorityTick : candidate.localEpoch),
        winner:terminalWinner,
        position:{ x:terminalTank.x, y:terminalTank.y }
      });
    }
    if (!previous || candidate.source !== previous.source || candidate.frame.terminal || previous.frame.terminal) return null;
    if (candidate.online) {
      var serverTick = candidate.authorityTick;
      if (!previous.online || previous.matchId !== candidate.matchId) return null;
      if (serverTick === previous.authorityTick + 2) {
        // The normal Authority broadcast cadence is exactly two simulation
        // ticks. Larger gaps are intentionally static reconciliations.
      } else return null;
    } else if (previous.online || candidate.localEpoch !== previous.localEpoch + 1) {
      return null;
    }
    if (frame.origin.continuity !== 'interpolate') return null;

    var events = [];
    var movements = [];
    var priorById = new Map();
    previous.signals.forEach(function remember(signal) { priorById.set(signal.id, signal); });
    var nextById = new Map();
    candidate.signals.forEach(function remember(signal) { nextById.set(signal.id, signal); });
    var newProjectiles = new Map();
    frame.projectiles.forEach(function remember(projectile) { newProjectiles.set(projectile.id, projectile); });
    previous.frame.projectiles.forEach(function removeOld(projectile) { newProjectiles.delete(projectile.id); });

    candidate.signals.forEach(function inspect(next) {
      var prior = priorById.get(next.id);
      if (!prior) return;
      if (prior.alive && next.alive && Math.hypot(next.x - prior.x, next.y - prior.y) > .04) {
        movements.push({ type:'tank_move', seat:next.id, x:next.x, y:next.y, direction:null });
      }
      if (prior.alive && !next.alive && next.hp === 0 && prior.hp >= 1 && next.deaths === prior.deaths + 1) {
        events.push({ type:'tank_ko', seat:next.id, x:next.x, y:next.y, direction:null });
      } else if (prior.alive && next.alive && next.hp === prior.hp - 1 && next.hits >= prior.hits && next.deaths === prior.deaths) {
        events.push({ type:'tank_hit', seat:next.id, x:next.x, y:next.y, direction:null });
      } else if (!prior.alive && next.alive && next.hp === 3 && next.deaths === prior.deaths) {
        events.push({ type:'tank_spawn', seat:next.id, x:next.x, y:next.y, direction:null });
      }
      if (next.shots === prior.shots + 1) {
        var projectile = null;
        newProjectiles.forEach(function select(candidateProjectile) {
          if (!projectile && candidateProjectile.owner === next.id) projectile = candidateProjectile;
        });
        if (projectile) events.push({ type:'tank_fire', seat:next.id, x:projectile.x, y:projectile.y, direction:projectile.direction });
      }
    });
    // Any ambiguous/multiple change is static.  The priority documents the
    // deterministic choice once exactly one semantic fact remains.
    if (events.length === 0 && movements.length === 1) events.push(movements[0]);
    if (events.length !== 1) return null;
    var event = events[0];
    var priority = { tank_ko:5, tank_hit:4, tank_fire:3, tank_spawn:2, tank_move:1 };
    if (!priority[event.type]) return null;
    return freeze({
      type:event.type,
      revision:frame.revision,
      eventId:generation + ':' + frame.revision + ':' + event.type + ':' + event.seat + ':' + (candidate.online ? candidate.authorityTick : candidate.localEpoch),
      seat:event.seat,
      position:{ x:event.x, y:event.y },
      direction:event.direction === null ? undefined : event.direction
    });
  }

  function rendererImport(retry) {
    if (sharedRendererModule) return Promise.resolve(sharedRendererModule);
    var variant = retry === true ? 'retry1' : 'primary';
    var importPath = variant === 'retry1' ? IMPORT_RETRY_PATH : IMPORT_PATH;
    if (sharedRendererPromise && sharedRendererPromisePath === importPath) return sharedRendererPromise;
    var loader = gameModuleLoader();
    if (!loader) return Promise.reject(new Error('game_module_loader_unavailable'));
    var imported = null;
    try {
      if (typeof loader.prefetch === 'function') loader.prefetch('tank');
      imported = loader.load('tank', { resource:'renderer', variant:variant });
    } catch (error) {
      return Promise.reject(error);
    }
    var promise = Promise.resolve(imported).then(function remembered(result) {
      if (!result || result.ok !== true || !result.module) throw new Error('tank_3d_module_unavailable');
      sharedRendererModule = result.module;
      return result.module;
    }, function failed(error) {
      if (sharedRendererPromise === promise) {
        sharedRendererPromise = null;
        sharedRendererPromisePath = '';
      }
      throw error;
    });
    sharedRendererPromise = promise;
    sharedRendererPromisePath = importPath;
    return promise;
  }

  function create(readModel) {
    var reader = typeof readModel === 'function' ? readModel : null;
    var state = {
      disposed:false,
      enabled:false,
      fallback:true,
      ready:false,
      generation:0,
      adapterEpoch:0,
      revision:0,
      mount:null,
      slot:null,
      host:null,
      hostGeneration:0,
      adapterActive:false,
      adapterSignal:false,
      importPending:false,
      importRetry:false,
      recoverQueued:false,
      contextRecoveryQueued:false,
      stickyFailure:false,
      forceGeneration:false,
      lastFingerprint:'',
      lastSignalsFingerprint:'',
      lastFact:null,
      lastOnline:null,
      resetEpoch:null,
      sourceEpoch:null,
      online:false,
      matchId:'',
      source:'',
      width:0,
      terminal:false,
      quality:qualityFromStorage(),
      reducedMotion:false,
      hidden:false,
      shellActive:true,
      listeners:[],
      media:null,
      failureClass:null,
      lastReason:reader ? 'idle' : 'invalid_reader',
      lastMotion:null
    };

    function diagnostic() {
      return Object.freeze({
        status:state.disposed ? 'disposed' : (state.enabled ? 'active' : 'dom-fallback'),
        enabled:state.enabled,
        generation:state.generation,
        adapterEpoch:state.adapterEpoch,
        revision:state.revision,
        ready:state.ready,
        fallback:state.fallback,
        source:state.lastFact ? state.lastFact.source : null,
        authorityTick:state.lastFact && state.lastFact.online ? state.lastFact.authorityTick : null,
        quality:state.quality,
        reducedMotion:state.reducedMotion,
        terminal:state.terminal,
        motion:state.lastMotion,
        reason:state.lastReason
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

    function hostApply(message) {
      if (!state.host || typeof state.host.apply !== 'function') return null;
      try { return state.host.apply(message); } catch (_error) { return null; }
    }

    function disposeHost() {
      var host = state.host;
      state.host = null;
      state.hostGeneration = 0;
      state.adapterActive = false;
      state.adapterSignal = false;
      if (host && typeof host.dispose === 'function') {
        try { host.dispose(); } catch (_error) {}
      }
      state.fallback = true;
      if (state.slot && state.slot.dataset) state.slot.dataset.ghost3dReady = 'false';
      if (state.mount && state.mount.dataset) state.mount.dataset.ghost3dReady = 'false';
      state.ready = false;
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

    function applyLifecycleFacts() {
      if (!state.host) return;
      hostApply({ type:'lifecycle', action:state.hidden ? 'hidden' : 'visible', reason:'document' });
      hostApply({ type:'lifecycle', action:state.shellActive ? 'resume' : 'suspend', reason:'shell' });
    }

    function installListeners(generation) {
      if (!current(generation) || state.listeners.length) return;
      var document = null;
      var window = null;
      try {
        document = root && (root.document || (root.window && root.window.document));
        window = root && (typeof root.addEventListener === 'function' ? root : root.window);
      } catch (_error) {}
      listen(document, 'visibilitychange', function onVisibility() {
        if (!current(generation)) return;
        state.hidden = !!(document && (document.hidden || document.visibilityState === 'hidden'));
        applyLifecycleFacts();
      });
      listen(window, 'ghostgame:shellchange', function onShell(event) {
        if (!current(generation)) return;
        var detail = event && event.detail;
        state.shellActive = !!(detail && detail.active === true && detail.gameId === 'tank');
        applyLifecycleFacts();
      });
      var media = null;
      try { media = window && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null; } catch (_error) { media = null; }
      if (media) {
        state.media = media;
        listen(media, 'change', function onMotionPreference(event) {
          if (!current(generation)) return;
          state.reducedMotion = !!(event && typeof event.matches === 'boolean' ? event.matches : media.matches);
          hostApply({ type:'environment', reducedMotion:state.reducedMotion });
        });
      }
    }

    function hostFailed(generation) {
      if (!current(generation)) return;
      state.adapterEpoch += 1;
      state.adapterActive = false;
      state.adapterSignal = false;
      state.fallback = true;
      state.stickyFailure = true;
      state.failureClass = 'renderer';
      state.lastReason = 'host_failure';
      setReady(false, generation);
    }

    function adapterFailed(generation, adapterEpoch, reason) {
      if (!current(generation, adapterEpoch)) return;
      state.adapterEpoch += 1;
      state.adapterActive = false;
      state.adapterSignal = false;
      state.fallback = true;
      state.stickyFailure = true;
      state.failureClass = 'renderer';
      state.lastReason = reason || 'adapter_failure';
      setReady(false, generation);
      hostApply({ type:'context-lost', reason:state.lastReason });
    }

    function queueContextRecovery() {
      if (state.disposed || state.contextRecoveryQueued) return;
      var generation = state.generation;
      state.contextRecoveryQueued = true;
      Promise.resolve().then(function recover() {
        state.contextRecoveryQueued = false;
        if (!current(generation)) return;
        state.forceGeneration = true;
        state.stickyFailure = false;
        state.failureClass = null;
        commit();
      });
    }

    function adapterContextLost(reason, generation, adapterEpoch) {
      if (!current(generation, adapterEpoch)) return;
      state.adapterEpoch += 1;
      state.adapterActive = false;
      state.adapterSignal = false;
      state.fallback = true;
      state.stickyFailure = false;
      state.failureClass = null;
      state.lastReason = typeof reason === 'string' ? 'context_loss' : 'context_loss';
      setReady(false, generation);
      hostApply({ type:'context-lost', reason:state.lastReason });
      queueContextRecovery();
    }

    function rendererSupported(module) {
      if (!module || typeof module.isTank3DSupported !== 'function') return false;
      try { return module.isTank3DSupported() === true; } catch (_error) { return false; }
    }

    function adapterReady(generation, adapterEpoch) {
      if (!current(generation, adapterEpoch) || !state.lastFact) return;
      var hostSnapshot = null;
      try { hostSnapshot = state.host && typeof state.host.snapshot === 'function' ? state.host.snapshot() : null; } catch (_error) {}
      if (hostSnapshot && (hostSnapshot.usingFallback === true || hostSnapshot.adapterReady === false)) return;
      state.adapterSignal = true;
      state.fallback = false;
      setReady(true, generation);
    }

    function createAdapter(module, generation) {
      if (!current(generation) || !state.slot || !module || typeof module.createTank3DAdapter !== 'function') return null;
      var adapterEpoch = ++state.adapterEpoch;
      state.adapterSignal = false;
      var adapter = null;
      try {
        adapter = module.createTank3DAdapter({
          mountElement:state.slot,
          quality:state.quality,
          reducedMotion:state.reducedMotion,
          onReady:function onReady() { adapterReady(generation, adapterEpoch); },
          onError:function onError() { adapterFailed(generation, adapterEpoch, 'adapter_error'); },
          onContextLost:function onContextLost(reason) { adapterContextLost(reason, generation, adapterEpoch); }
        });
      } catch (_error) { return { adapter:null, epoch:adapterEpoch }; }
      return { adapter:adapter, epoch:adapterEpoch };
    }

    function recoverWith(module, generation) {
      if (!current(generation) || !state.host || state.stickyFailure || state.adapterActive || !rendererSupported(module)) return false;
      var created = createAdapter(module, generation);
      var adapter = created && created.adapter;
      var adapterEpoch = created && created.epoch;
      if (!adapter) {
        adapterFailed(generation, adapterEpoch, 'adapter_create');
        return false;
      }
      if (!current(generation, adapterEpoch)) {
        try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (_error) {}
        return false;
      }
      var recovered = hostApply({ type:'recover', adapter:adapter });
      if (!recovered || recovered.accepted !== true || !current(generation, adapterEpoch)) {
        if (current(generation, adapterEpoch)) state.adapterEpoch += 1;
        try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (_error) {}
        state.fallback = true;
        state.stickyFailure = true;
        state.failureClass = 'renderer';
        state.lastReason = 'adapter_recover';
        setReady(false, generation);
        return false;
      }
      var hostSnapshot = null;
      try { hostSnapshot = state.host && typeof state.host.snapshot === 'function' ? state.host.snapshot() : null; } catch (_error) {}
      if (hostSnapshot && hostSnapshot.usingFallback === true) {
        state.adapterEpoch += 1;
        try { if (typeof adapter.dispose === 'function') adapter.dispose(); } catch (_error) {}
        state.adapterActive = false;
        state.fallback = true;
        state.stickyFailure = true;
        state.failureClass = 'renderer';
        state.lastReason = 'adapter_fallback';
        setReady(false, generation);
        return false;
      }
      state.adapterActive = true;
      return true;
    }

    function queueRecovery() {
      if (state.disposed || state.recoverQueued || state.stickyFailure || !state.host || !state.lastFact) return;
      var generation = state.generation;
      state.recoverQueued = true;
      Promise.resolve().then(function recoverLater() {
        state.recoverQueued = false;
        if (!current(generation) || !state.host || !state.lastFact || state.stickyFailure) return;
        if (sharedRendererModule) recoverWith(sharedRendererModule, generation);
      });
    }

    function loadRenderer(generation) {
      if (!current(generation) || !state.host || state.stickyFailure) return;
      if (sharedRendererModule) { queueRecovery(); return; }
      if (state.importPending) return;
      state.importPending = true;
      rendererImport(state.importRetry).then(function moduleReady(module) {
        state.importPending = false;
        if (!current(generation) || !state.host) return;
        if (!rendererSupported(module)) {
          state.stickyFailure = true;
          state.failureClass = 'renderer';
          state.fallback = true;
          state.lastReason = 'unsupported_renderer';
          setReady(false, generation);
          return;
        }
        queueRecovery();
      }, function importFailed() {
        state.importPending = false;
        if (!current(generation)) return;
        state.importRetry = true;
        state.stickyFailure = true;
        state.failureClass = 'renderer';
        state.fallback = true;
        state.lastReason = 'import_failure';
        setReady(false, generation);
      });
    }

    function startGeneration(candidate, reason) {
      detachListeners();
      var priorMount = state.mount;
      disposeHost();
      state.generation += 1;
      state.adapterEpoch += 1;
      state.revision = 0;
      state.lastFingerprint = '';
      state.lastSignalsFingerprint = '';
      state.lastFact = null;
      state.lastOnline = null;
      state.lastMotion = null;
      state.stickyFailure = false;
      state.forceGeneration = false;
      state.failureClass = null;
      state.mount = candidate.mount;
      state.resetEpoch = candidate.resetEpoch;
      state.sourceEpoch = candidate.sourceEpoch;
      state.online = candidate.online;
      state.matchId = candidate.matchId || '';
      state.source = candidate.source;
      state.width = candidate.frame.arena.width;
      state.terminal = false;
      state.quality = candidate.quality;
      state.reducedMotion = candidate.reducedMotion;
      state.hidden = candidate.hidden;
      state.shellActive = candidate.shellActive;
      state.lastReason = reason || 'generation';
      if (state.slot && priorMount !== candidate.mount) {
        removeSlot(state.slot);
        state.slot = null;
      }
      if (!state.slot) state.slot = createSlot(candidate.mount);
      if (!appendSlot(state.slot, candidate.mount)) {
        state.lastReason = 'slot_mount_failure';
        state.enabled = false;
        return false;
      }
      if (state.slot && state.slot.dataset) state.slot.dataset.ghost3dGeneration = String(state.generation);
      var foundation = null;
      try { foundation = root && root.Ghost3DFoundation; } catch (_error) { foundation = null; }
      if (!foundation || typeof foundation.create !== 'function') {
        state.lastReason = 'foundation_unavailable';
        state.enabled = false;
        return false;
      }
      var generation = state.generation;
      try {
        state.host = foundation.create({
          quality:state.quality,
          reducedMotion:state.reducedMotion,
          onFailure:function onFailure() { hostFailed(generation); }
        });
      } catch (_error) { state.host = null; }
      if (!state.host || typeof state.host.apply !== 'function') {
        state.host = null;
        state.lastReason = 'foundation_create_failure';
        state.enabled = false;
        return false;
      }
      state.hostGeneration = generation;
      state.enabled = true;
      installListeners(generation);
      hostApply({ type:'environment', reducedMotion:state.reducedMotion });
      applyLifecycleFacts();
      return true;
    }

    function stopped(reason) {
      state.enabled = false;
      state.generation += 1;
      state.adapterEpoch += 1;
      state.lastFact = null;
      state.lastOnline = null;
      state.lastFingerprint = '';
      state.lastSignalsFingerprint = '';
      state.lastMotion = null;
      state.terminal = false;
      state.failureClass = null;
      state.lastReason = reason || 'disabled';
      disposeHost();
      detachListeners();
      removeSlot(state.slot);
      state.slot = null;
      state.mount = null;
      state.source = '';
      return result(false, state.lastReason);
    }

    function failClosed(reason, failureClass) {
      state.lastReason = reason || 'untrusted_state';
      state.fallback = true;
      state.ready = false;
      state.adapterEpoch += 1;
      state.adapterActive = false;
      state.stickyFailure = true;
      state.forceGeneration = false;
      state.failureClass = failureClass || 'trust';
      setReady(false, state.generation);
      hostApply({ type:'context-lost', reason:state.lastReason });
      return result(false, state.lastReason);
    }

    function sameSemanticIdentity(candidate) {
      if (state.mount !== candidate.mount || state.resetEpoch !== candidate.resetEpoch || state.online !== candidate.online) return false;
      if (state.matchId !== (candidate.matchId || '') || state.width !== candidate.frame.arena.width) return false;
      if (state.source !== candidate.source) return false;
      if (candidate.source === 'reconcile' && state.sourceEpoch !== candidate.sourceEpoch) return false;
      return true;
    }

    function newerTrustedSemanticFact(candidate) {
      var previous = state.lastFact;
      if (!previous || candidate.source !== previous.source || candidate.online !== previous.online) return false;
      if (candidate.online) return candidate.matchId === previous.matchId && candidate.authorityTick > previous.authorityTick;
      return candidate.localEpoch > previous.localEpoch;
    }

    function continuityFor(candidate, nextFingerprint, nextSignalsFingerprint) {
      if (!state.lastFact) return { kind:'snap' };
      var previous = state.lastFact;
      if (candidate.online !== previous.online || candidate.source !== previous.source) return { kind:'snap' };
      if (candidate.online) {
        if (candidate.matchId !== previous.matchId) return { kind:'snap' };
        if (candidate.authorityTick < previous.authorityTick) return { kind:'stale' };
        if (candidate.authorityTick === previous.authorityTick) {
          return previous.fingerprint === nextFingerprint && previous.signalsFingerprint === nextSignalsFingerprint ? { kind:'duplicate' } : { kind:'conflict' };
        }
        if (previous.fingerprint === nextFingerprint && previous.signalsFingerprint === nextSignalsFingerprint) return { kind:'duplicate' };
        return { kind:candidate.authorityTick === previous.authorityTick + 2 ? 'interpolate' : 'snap' };
      }
      if (candidate.localEpoch < previous.localEpoch) return { kind:'stale' };
      if (candidate.localEpoch === previous.localEpoch) return previous.fingerprint === nextFingerprint && previous.signalsFingerprint === nextSignalsFingerprint ? { kind:'duplicate' } : { kind:'conflict' };
      if (previous.fingerprint === nextFingerprint && previous.signalsFingerprint === nextSignalsFingerprint) return { kind:'duplicate' };
      return { kind:candidate.localEpoch === previous.localEpoch + 1 ? 'interpolate' : 'snap' };
    }

    function requiresGeneration(candidate) {
      if (!sameSemanticIdentity(candidate)) return true;
      if (state.terminal && !candidate.frame.terminal) return true;
      // Only context loss requests an automatic fresh renderer generation.
      if (state.forceGeneration) return true;
      if (state.stickyFailure) return state.failureClass === 'trust' && newerTrustedSemanticFact(candidate);
      return !state.host || !state.slot || !state.enabled;
    }

    function canMotion() {
      if (!state.ready || state.reducedMotion || state.quality === 'LOW' || !state.host) return false;
      var snapshot = null;
      try { snapshot = typeof state.host.snapshot === 'function' ? state.host.snapshot() : null; } catch (_error) {}
      return !snapshot || (snapshot.usingFallback !== true && snapshot.suspended !== true && snapshot.adapterReady !== false);
    }

    function publish(candidate, candidateFingerprint, candidateSignalsFingerprint, continuity) {
      var revision = state.revision + 1;
      if (!Number.isSafeInteger(revision)) return failClosed('revision_overflow');
      var frame = cloneFrame(candidate, revision, continuity);
      var applied = hostApply({ type:'frame', frame:frame });
      if (!applied || applied.accepted !== true) return failClosed('frame_rejected');
      var prior = state.lastFact;
      state.revision = revision;
      state.lastFingerprint = candidateFingerprint;
      state.lastSignalsFingerprint = candidateSignalsFingerprint;
      state.lastFact = {
        online:candidate.online,
        source:candidate.source,
        matchId:candidate.matchId || '',
        authorityTick:candidate.authorityTick,
        localEpoch:candidate.localEpoch,
        sourceEpoch:candidate.sourceEpoch,
        fingerprint:candidateFingerprint,
        signalsFingerprint:candidateSignalsFingerprint,
        frame:frame,
        signals:candidate.signals
      };
      if (candidate.online) state.lastOnline = { matchId:candidate.matchId, authorityTick:candidate.authorityTick, fingerprint:candidateFingerprint };
      state.sourceEpoch = candidate.sourceEpoch;
      state.terminal = frame.terminal === true;
      state.lastMotion = null;
      loadRenderer(state.generation);
      queueRecovery();
      var event = semanticEvent(prior, candidate, frame, state.generation);
      if (event && canMotion()) {
        var motionResult = hostApply({ type:'motion', event:event });
        if (motionResult && motionResult.accepted === true && motionResult.forwarded === true) state.lastMotion = event.type;
      }
      return result(true, null);
    }

    function commit() {
      if (state.disposed) return result(false, 'disposed');
      if (!reader) return stopped('invalid_reader');
      if (!exactFeatureEnabled()) return stopped('feature_disabled');
      var model = null;
      try { model = reader(); } catch (_error) { return failClosed('reader_failure'); }
      var candidate = buildCandidate(model);
      if (!candidate.ok) {
        if (candidate.reason === 'legacy_relay_dom_only' || candidate.reason === 'history_dom_only' || candidate.reason === 'wave_b_inactive') return stopped(candidate.reason);
        return failClosed(candidate.reason);
      }
      var candidateFingerprint = fingerprint(candidate);
      var candidateSignalsFingerprint = signalFingerprint(candidate);
      var needsGeneration = requiresGeneration(candidate);
      if (state.stickyFailure && state.failureClass === 'trust' && !needsGeneration) return result(false, 'sticky_trust_failure');
      if (state.stickyFailure && state.failureClass === 'renderer' && !needsGeneration && (!state.host || !state.slot || !state.enabled)) return result(false, 'sticky_renderer_failure');
      var continuity = needsGeneration ? { kind:'snap' } : continuityFor(candidate, candidateFingerprint, candidateSignalsFingerprint);
      if (continuity.kind === 'duplicate') return result(false, 'duplicate_frame');
      if (continuity.kind === 'stale') return result(false, candidate.online ? 'stale_authority' : 'stale_local');
      if (continuity.kind === 'conflict') return failClosed(candidate.online ? 'authority_tick_conflict' : 'local_epoch_conflict');
      if (needsGeneration && !startGeneration(candidate, 'generation_reset')) return failClosed(state.lastReason, 'renderer');
      if (!appendSlot(state.slot, candidate.mount)) return failClosed('slot_rebuild_failure', 'renderer');
      state.quality = candidate.quality;
      state.reducedMotion = candidate.reducedMotion;
      hostApply({ type:'quality', quality:state.quality });
      hostApply({ type:'environment', reducedMotion:state.reducedMotion });
      return publish(candidate, candidateFingerprint, candidateSignalsFingerprint, continuity.kind);
    }

    function dispose() {
      if (state.disposed) return diagnostic();
      state.disposed = true;
      state.enabled = false;
      state.generation += 1;
      state.adapterEpoch += 1;
      disposeHost();
      detachListeners();
      removeSlot(state.slot);
      state.slot = null;
      state.mount = null;
      state.lastFact = null;
      state.lastOnline = null;
      state.lastFingerprint = '';
      return diagnostic();
    }

    return Object.freeze({ commit:commit, snapshot:diagnostic, dispose:dispose });
  }

  return Object.freeze({
    create:create,
    QUALITY:Object.freeze({ HIGH:'HIGH', BALANCED:'BALANCED', LOW:'LOW' })
  });
}));
