/*
 * TankSnapshotWireCodec
 *
 * A small, transport-only seam around Tank Authority snapshots.  The
 * authority still produces and consumes `tank-authority-v1` snapshots; this
 * module only turns a trusted canonical snapshot into a bounded v2 keyframe
 * or delta envelope and restores it before presentation sees it.
 *
 * It deliberately has no WebSocket, DOM, Renderer, Reward, Replay, Social or
 * persistence dependency.  The server owns recipient delivery and clients
 * own their lifecycle reset.  Unknown data is rejected rather than copied.
 */
(function installTankSnapshotWireCodec(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  // The deterministic browser VM exposes a CommonJS-shaped `module` while
  // still executing the concatenated browser bundle.  Publish both seams so
  // that environment cannot silently turn a negotiated v2 frame into a drop.
  if (root) root.TankSnapshotWireCodec = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createTankSnapshotWireCodecModule() {
  'use strict';

  var V1_PROTOCOL = 'tank-authority-v1';
  var V2_PROTOCOL = 'tank-snapshot-delta-v2';
  var MAX_SAFE = 9007199254740991;
  var MAX_RECIPIENTS = 64;
  var MAX_FRAMES = 4;
  var DEFAULT_KEYFRAME_TICKS = 20;
  var MAX_KEYFRAME_TICKS = 200;
  var MAX_ENVELOPE_BYTES = 65536;
  var MAX_MATCH_LENGTH = 128;
  var MAX_FINISH_REASON = 40;
  var MAX_PLAYERS = 5;
  var MIN_PLAYERS = 2;
  var MAX_PROJECTILES = 160;
  var MAP_ROWS = 13;
  var MAP_COLUMNS = [15, 17];
  var MATCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var RECIPIENT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,191}$/;
  var SEASONS = Object.freeze(['spring', 'summer', 'autumn', 'winter']);
  var STATUSES = Object.freeze(['running', 'finished', 'stopped']);
  var INPUT_FIELDS = Object.freeze(['up', 'right', 'down', 'left', 'fire']);
  var PLAYER_FIELDS = Object.freeze([
    'id', 'x', 'y', 'd', 'hp', 'alive', 'respawnAt', 'invulnerableUntil',
    'fireReadyAt', 'input', 'kills', 'deaths', 'damage', 'shots', 'hits',
    'placement'
  ]);
  var PROJECTILE_FIELDS = Object.freeze(['id', 'owner', 'x', 'y', 'd', 'ttl']);
  var SNAPSHOT_FIELDS = Object.freeze([
    'protocol', 'matchId', 'serverTick', 'serverNow', 'startedAt', 'endAt',
    'remainingMs', 'status', 'running', 'season', 'players', 'projectiles',
    'destructibles', 'ack', 'finished', 'finishedAt', 'finishReason',
    'stopped', 'stoppedAt', 'stopReason', 'order'
  ]);
  var SCALAR_FIELDS = Object.freeze([
    'serverNow', 'startedAt', 'endAt', 'remainingMs', 'status', 'running',
    'season', 'finished', 'finishedAt', 'finishReason', 'stopped',
    'stoppedAt', 'stopReason'
  ]);
  var PATCH_FIELDS = Object.freeze(['scalars', 'players', 'projectiles', 'destructibles', 'ack', 'order']);
  var PROJECTILE_PATCH_FIELDS = Object.freeze(['upsert', 'remove', 'order']);
  var ENVELOPE_FIELDS = Object.freeze(['protocol', 'matchId', 'frameId', 'baseFrameId', 'serverTick', 'kind', 'payload']);

  function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  function contains(values, value) {
    return values.indexOf(value) !== -1;
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      if (Object.prototype.toString.call(value) !== '[object Object]') return false;
      var proto = Object.getPrototypeOf(value);
      if (proto === null) return true;
      var ctor = hasOwn(proto, 'constructor') && proto.constructor;
      return typeof ctor === 'function' && ctor.name === 'Object';
    } catch (_error) {
      return false;
    }
  }

  function ownData(value, key) {
    try {
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) return { present: false, ok: true, value: undefined };
      if (!hasOwn(descriptor, 'value')) return { present: true, ok: false, value: undefined };
      return { present: true, ok: true, value: descriptor.value };
    } catch (_error) {
      return { present: false, ok: false, value: undefined };
    }
  }

  function ownNames(value) {
    try {
      return {
        names: Object.getOwnPropertyNames(value),
        symbols: typeof Object.getOwnPropertySymbols === 'function' ? Object.getOwnPropertySymbols(value) : []
      };
    } catch (_error) {
      return null;
    }
  }

  function exactFields(value, allowed, required) {
    if (!isPlainRecord(value)) return { ok: false, reason: 'invalid_record' };
    var names = ownNames(value);
    if (!names || names.symbols.length) return { ok: false, reason: 'invalid_record' };
    for (var index = 0; index < names.names.length; index += 1) {
      if (!contains(allowed, names.names[index])) return { ok: false, reason: 'unsupported_field' };
    }
    for (var needed = 0; needed < required.length; needed += 1) {
      var field = ownData(value, required[needed]);
      if (!field.ok || !field.present) return { ok: false, reason: 'missing_field' };
    }
    return { ok: true };
  }

  function finite(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function safeInteger(value, min, max) {
    return finite(value) && Math.floor(value) === value && value >= min && value <= max;
  }

  function finiteIn(value, min, max) {
    return finite(value) && value >= min && value <= max;
  }

  function frozen(value) {
    return Object.freeze(value);
  }

  function copyInput(input) {
    return frozen({ up: input.up, right: input.right, down: input.down, left: input.left, fire: input.fire });
  }

  function readInput(value) {
    var fields = exactFields(value, INPUT_FIELDS, INPUT_FIELDS);
    if (!fields.ok) return fields;
    var out = {};
    for (var index = 0; index < INPUT_FIELDS.length; index += 1) {
      var name = INPUT_FIELDS[index];
      var field = ownData(value, name);
      if (!field.ok || typeof field.value !== 'boolean') return { ok: false, reason: 'invalid_input' };
      out[name] = field.value;
    }
    return { ok: true, value: frozen(out) };
  }

  function readPlayer(value, playerCount, columns) {
    var fields = exactFields(value, PLAYER_FIELDS, PLAYER_FIELDS);
    if (!fields.ok) return fields;
    var id = ownData(value, 'id');
    var x = ownData(value, 'x');
    var y = ownData(value, 'y');
    var direction = ownData(value, 'd');
    var hp = ownData(value, 'hp');
    var alive = ownData(value, 'alive');
    var respawnAt = ownData(value, 'respawnAt');
    var invulnerableUntil = ownData(value, 'invulnerableUntil');
    var fireReadyAt = ownData(value, 'fireReadyAt');
    var input = ownData(value, 'input');
    var kills = ownData(value, 'kills');
    var deaths = ownData(value, 'deaths');
    var damage = ownData(value, 'damage');
    var shots = ownData(value, 'shots');
    var hits = ownData(value, 'hits');
    var placement = ownData(value, 'placement');
    if (![id, x, y, direction, hp, alive, respawnAt, invulnerableUntil, fireReadyAt, input, kills, deaths, damage, shots, hits, placement].every(function everyField(field) { return field.ok; })) {
      return { ok: false, reason: 'invalid_player' };
    }
    if (!safeInteger(id.value, 0, playerCount - 1) || !finiteIn(x.value, 0, columns) || !finiteIn(y.value, 0, MAP_ROWS) ||
        !safeInteger(direction.value, 0, 3) || !safeInteger(hp.value, 0, 3) || typeof alive.value !== 'boolean' ||
        !finiteIn(respawnAt.value, 0, MAX_SAFE) || !finiteIn(invulnerableUntil.value, 0, MAX_SAFE) || !finiteIn(fireReadyAt.value, 0, MAX_SAFE) ||
        !safeInteger(kills.value, 0, MAX_SAFE) || !safeInteger(deaths.value, 0, MAX_SAFE) || !safeInteger(damage.value, 0, MAX_SAFE) ||
        !safeInteger(shots.value, 0, MAX_SAFE) || !safeInteger(hits.value, 0, MAX_SAFE) || !safeInteger(placement.value, 0, playerCount)) {
      return { ok: false, reason: 'invalid_player' };
    }
    var parsedInput = readInput(input.value);
    if (!parsedInput.ok) return parsedInput;
    return {
      ok: true,
      value: frozen({
        id: id.value, x: x.value, y: y.value, d: direction.value, hp: hp.value, alive: alive.value,
        respawnAt: respawnAt.value, invulnerableUntil: invulnerableUntil.value, fireReadyAt: fireReadyAt.value,
        input: parsedInput.value, kills: kills.value, deaths: deaths.value, damage: damage.value,
        shots: shots.value, hits: hits.value, placement: placement.value
      })
    };
  }

  function readProjectile(value, playerCount, columns) {
    var fields = exactFields(value, PROJECTILE_FIELDS, PROJECTILE_FIELDS);
    if (!fields.ok) return fields;
    var id = ownData(value, 'id');
    var owner = ownData(value, 'owner');
    var x = ownData(value, 'x');
    var y = ownData(value, 'y');
    var direction = ownData(value, 'd');
    var ttl = ownData(value, 'ttl');
    if (![id, owner, x, y, direction, ttl].every(function everyField(field) { return field.ok; }) ||
        !safeInteger(id.value, 1, MAX_SAFE) || !safeInteger(owner.value, 0, playerCount - 1) ||
        !finiteIn(x.value, -1, columns + 1) || !finiteIn(y.value, -1, MAP_ROWS + 1) ||
        !safeInteger(direction.value, 0, 3) || !finiteIn(ttl.value, 0, 3000)) {
      return { ok: false, reason: 'invalid_projectile' };
    }
    return { ok: true, value: frozen({ id: id.value, owner: owner.value, x: x.value, y: y.value, d: direction.value, ttl: ttl.value }) };
  }

  function readGrid(value, columns) {
    if (!Array.isArray(value) || value.length !== MAP_ROWS) return { ok: false, reason: 'invalid_grid' };
    var rows = [];
    for (var row = 0; row < MAP_ROWS; row += 1) {
      if (!Array.isArray(value[row]) || value[row].length !== columns) return { ok: false, reason: 'invalid_grid' };
      var cells = [];
      for (var column = 0; column < columns; column += 1) {
        if (!safeInteger(value[row][column], 0, 3) || (value[row][column] !== 0 && value[row][column] !== 2 && value[row][column] !== 3)) {
          return { ok: false, reason: 'invalid_grid' };
        }
        cells.push(value[row][column]);
      }
      rows.push(frozen(cells));
    }
    return { ok: true, value: frozen(rows) };
  }

  function readAck(value, playerCount) {
    if (!Array.isArray(value) || value.length !== playerCount) return { ok: false, reason: 'invalid_ack' };
    var out = [];
    for (var index = 0; index < value.length; index += 1) {
      if (!safeInteger(value[index], 0, MAX_SAFE)) return { ok: false, reason: 'invalid_ack' };
      out.push(value[index]);
    }
    return { ok: true, value: frozen(out) };
  }

  function readOrder(value, playerCount) {
    if (value === null) return { ok: true, value: null };
    if (!Array.isArray(value) || value.length !== playerCount) return { ok: false, reason: 'invalid_order' };
    var out = [], seen = Object.create(null);
    for (var index = 0; index < value.length; index += 1) {
      if (!safeInteger(value[index], 0, playerCount - 1) || seen[value[index]]) return { ok: false, reason: 'invalid_order' };
      seen[value[index]] = true;
      out.push(value[index]);
    }
    return { ok: true, value: frozen(out) };
  }

  function readOptionalTime(field) {
    if (field === null) return { ok: true, value: null };
    if (!finiteIn(field, 0, MAX_SAFE)) return { ok: false, reason: 'invalid_time' };
    return { ok: true, value: field };
  }

  function readOptionalReason(field) {
    if (field === null) return { ok: true, value: null };
    if (typeof field !== 'string' || field.length > MAX_FINISH_REASON) return { ok: false, reason: 'invalid_reason' };
    return { ok: true, value: field };
  }

  function normalizeSnapshot(value) {
    var fields = exactFields(value, SNAPSHOT_FIELDS, SNAPSHOT_FIELDS);
    if (!fields.ok) return fields;
    var protocol = ownData(value, 'protocol');
    var matchId = ownData(value, 'matchId');
    var serverTick = ownData(value, 'serverTick');
    var serverNow = ownData(value, 'serverNow');
    var startedAt = ownData(value, 'startedAt');
    var endAt = ownData(value, 'endAt');
    var remainingMs = ownData(value, 'remainingMs');
    var status = ownData(value, 'status');
    var running = ownData(value, 'running');
    var season = ownData(value, 'season');
    var players = ownData(value, 'players');
    var projectiles = ownData(value, 'projectiles');
    var destructibles = ownData(value, 'destructibles');
    var ack = ownData(value, 'ack');
    var finished = ownData(value, 'finished');
    var finishedAt = ownData(value, 'finishedAt');
    var finishReason = ownData(value, 'finishReason');
    var stopped = ownData(value, 'stopped');
    var stoppedAt = ownData(value, 'stoppedAt');
    var stopReason = ownData(value, 'stopReason');
    var order = ownData(value, 'order');
    if (![protocol, matchId, serverTick, serverNow, startedAt, endAt, remainingMs, status, running, season, players, projectiles, destructibles, ack, finished, finishedAt, finishReason, stopped, stoppedAt, stopReason, order].every(function everyField(field) { return field.ok; })) {
      return { ok: false, reason: 'invalid_snapshot' };
    }
    if (protocol.value !== V1_PROTOCOL || typeof matchId.value !== 'string' || !MATCH_PATTERN.test(matchId.value) || matchId.value.length > MAX_MATCH_LENGTH ||
        !safeInteger(serverTick.value, 0, MAX_SAFE) || !finiteIn(serverNow.value, 0, MAX_SAFE) || !finiteIn(startedAt.value, 0, MAX_SAFE) ||
        !finiteIn(endAt.value, startedAt.value, MAX_SAFE) || !finiteIn(remainingMs.value, 0, Math.max(0, endAt.value - startedAt.value + 1000)) ||
        typeof status.value !== 'string' || !contains(STATUSES, status.value) || typeof running.value !== 'boolean' ||
        typeof season.value !== 'string' || !contains(SEASONS, season.value) || typeof finished.value !== 'boolean' || typeof stopped.value !== 'boolean') {
      return { ok: false, reason: 'invalid_snapshot' };
    }
    if ((status.value === 'running') !== (running.value === true) || (status.value === 'finished') !== (finished.value === true) || (status.value === 'stopped') !== (stopped.value === true) || (finished.value && stopped.value)) {
      return { ok: false, reason: 'invalid_status' };
    }
    if (!Array.isArray(players.value) || players.value.length < MIN_PLAYERS || players.value.length > MAX_PLAYERS) return { ok: false, reason: 'invalid_players' };
    var columns = players.value.length > 4 ? 17 : 15;
    var normalizedPlayers = [], seenPlayers = Object.create(null);
    for (var playerIndex = 0; playerIndex < players.value.length; playerIndex += 1) {
      var parsedPlayer = readPlayer(players.value[playerIndex], players.value.length, columns);
      if (!parsedPlayer.ok || seenPlayers[parsedPlayer.value.id]) return { ok: false, reason: parsedPlayer.reason || 'invalid_players' };
      seenPlayers[parsedPlayer.value.id] = true;
      normalizedPlayers.push(parsedPlayer.value);
    }
    normalizedPlayers.sort(function sortPlayers(left, right) { return left.id - right.id; });
    for (var playerId = 0; playerId < normalizedPlayers.length; playerId += 1) if (normalizedPlayers[playerId].id !== playerId) return { ok: false, reason: 'invalid_players' };
    if (!Array.isArray(projectiles.value) || projectiles.value.length > MAX_PROJECTILES) return { ok: false, reason: 'invalid_projectiles' };
    var normalizedProjectiles = [], seenProjectiles = Object.create(null);
    for (var projectileIndex = 0; projectileIndex < projectiles.value.length; projectileIndex += 1) {
      var parsedProjectile = readProjectile(projectiles.value[projectileIndex], normalizedPlayers.length, columns);
      if (!parsedProjectile.ok || seenProjectiles[parsedProjectile.value.id]) return { ok: false, reason: parsedProjectile.reason || 'invalid_projectiles' };
      seenProjectiles[parsedProjectile.value.id] = true;
      normalizedProjectiles.push(parsedProjectile.value);
    }
    var normalizedGrid = readGrid(destructibles.value, columns);
    if (!normalizedGrid.ok) return normalizedGrid;
    var normalizedAck = readAck(ack.value, normalizedPlayers.length);
    if (!normalizedAck.ok) return normalizedAck;
    var normalizedOrder = readOrder(order.value, normalizedPlayers.length);
    if (!normalizedOrder.ok) return normalizedOrder;
    var normalizedFinishedAt = readOptionalTime(finishedAt.value);
    var normalizedStoppedAt = readOptionalTime(stoppedAt.value);
    var normalizedFinishReason = readOptionalReason(finishReason.value);
    var normalizedStopReason = readOptionalReason(stopReason.value);
    if (!normalizedFinishedAt.ok || !normalizedStoppedAt.ok || !normalizedFinishReason.ok || !normalizedStopReason.ok) {
      return { ok: false, reason: 'invalid_terminal' };
    }
    if ((finished.value && normalizedFinishedAt.value === null) || (!finished.value && normalizedFinishedAt.value !== null) ||
        (stopped.value && normalizedStoppedAt.value === null) || (!stopped.value && normalizedStoppedAt.value !== null) ||
        (finished.value && !normalizedOrder.value) || (!finished.value && normalizedOrder.value !== null)) {
      return { ok: false, reason: 'invalid_terminal' };
    }
    return {
      ok: true,
      value: freezeSnapshot({
        protocol: V1_PROTOCOL, matchId: matchId.value, serverTick: serverTick.value, serverNow: serverNow.value,
        startedAt: startedAt.value, endAt: endAt.value, remainingMs: remainingMs.value, status: status.value,
        running: running.value, season: season.value, players: normalizedPlayers, projectiles: normalizedProjectiles,
        destructibles: normalizedGrid.value, ack: normalizedAck.value, finished: finished.value,
        finishedAt: normalizedFinishedAt.value, finishReason: normalizedFinishReason.value, stopped: stopped.value,
        stoppedAt: normalizedStoppedAt.value, stopReason: normalizedStopReason.value, order: normalizedOrder.value
      })
    };
  }

  function freezeSnapshot(value) {
    var players = value.players.map(function copyPlayer(player) {
      return frozen({
        id: player.id, x: player.x, y: player.y, d: player.d, hp: player.hp, alive: player.alive,
        respawnAt: player.respawnAt, invulnerableUntil: player.invulnerableUntil, fireReadyAt: player.fireReadyAt,
        input: copyInput(player.input), kills: player.kills, deaths: player.deaths, damage: player.damage,
        shots: player.shots, hits: player.hits, placement: player.placement
      });
    });
    var projectiles = value.projectiles.map(function copyProjectile(projectile) {
      return frozen({ id: projectile.id, owner: projectile.owner, x: projectile.x, y: projectile.y, d: projectile.d, ttl: projectile.ttl });
    });
    var grid = value.destructibles.map(function copyRow(row) { return frozen(row.slice()); });
    return frozen({
      protocol: V1_PROTOCOL, matchId: value.matchId, serverTick: value.serverTick, serverNow: value.serverNow,
      startedAt: value.startedAt, endAt: value.endAt, remainingMs: value.remainingMs, status: value.status,
      running: value.running, season: value.season, players: frozen(players), projectiles: frozen(projectiles),
      destructibles: frozen(grid), ack: frozen(value.ack.slice()), finished: value.finished,
      finishedAt: value.finishedAt, finishReason: value.finishReason, stopped: value.stopped,
      stoppedAt: value.stoppedAt, stopReason: value.stopReason, order: value.order === null ? null : frozen(value.order.slice())
    });
  }

  function cloneSnapshot(value) {
    return {
      protocol: V1_PROTOCOL, matchId: value.matchId, serverTick: value.serverTick, serverNow: value.serverNow,
      startedAt: value.startedAt, endAt: value.endAt, remainingMs: value.remainingMs, status: value.status,
      running: value.running, season: value.season,
      players: value.players.map(function clonePlayer(player) { return {
        id: player.id, x: player.x, y: player.y, d: player.d, hp: player.hp, alive: player.alive,
        respawnAt: player.respawnAt, invulnerableUntil: player.invulnerableUntil, fireReadyAt: player.fireReadyAt,
        input: { up: player.input.up, right: player.input.right, down: player.input.down, left: player.input.left, fire: player.input.fire },
        kills: player.kills, deaths: player.deaths, damage: player.damage, shots: player.shots, hits: player.hits, placement: player.placement
      }; }),
      projectiles: value.projectiles.map(function cloneProjectile(projectile) { return { id: projectile.id, owner: projectile.owner, x: projectile.x, y: projectile.y, d: projectile.d, ttl: projectile.ttl }; }),
      destructibles: value.destructibles.map(function cloneRow(row) { return row.slice(); }), ack: value.ack.slice(),
      finished: value.finished, finishedAt: value.finishedAt, finishReason: value.finishReason,
      stopped: value.stopped, stoppedAt: value.stoppedAt, stopReason: value.stopReason,
      order: value.order === null ? null : value.order.slice()
    };
  }

  function equalPrimitive(left, right) {
    return left === right || (left !== left && right !== right);
  }

  function equalArray(left, right) {
    if (left === right) return true;
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
    for (var index = 0; index < left.length; index += 1) if (!equalPrimitive(left[index], right[index])) return false;
    return true;
  }

  function equalInput(left, right) {
    return INPUT_FIELDS.every(function sameInputField(field) { return left[field] === right[field]; });
  }

  function equalPlayer(left, right) {
    return PLAYER_FIELDS.every(function samePlayerField(field) {
      return field === 'input' ? equalInput(left.input, right.input) : equalPrimitive(left[field], right[field]);
    });
  }

  function equalProjectile(left, right) {
    return PROJECTILE_FIELDS.every(function sameProjectileField(field) { return equalPrimitive(left[field], right[field]); });
  }

  function copyPlayerForPatch(player) {
    return {
      id: player.id, x: player.x, y: player.y, d: player.d, hp: player.hp, alive: player.alive,
      respawnAt: player.respawnAt, invulnerableUntil: player.invulnerableUntil, fireReadyAt: player.fireReadyAt,
      input: { up: player.input.up, right: player.input.right, down: player.input.down, left: player.input.left, fire: player.input.fire },
      kills: player.kills, deaths: player.deaths, damage: player.damage, shots: player.shots, hits: player.hits, placement: player.placement
    };
  }

  function copyProjectileForPatch(projectile) {
    return { id: projectile.id, owner: projectile.owner, x: projectile.x, y: projectile.y, d: projectile.d, ttl: projectile.ttl };
  }

  function makePatch(base, next) {
    var patch = {};
    var scalars = {};
    SCALAR_FIELDS.forEach(function copyChangedScalar(field) {
      if (!equalPrimitive(base[field], next[field])) scalars[field] = next[field];
    });
    if (Object.keys(scalars).length) patch.scalars = scalars;

    var changedPlayers = [];
    for (var playerIndex = 0; playerIndex < next.players.length; playerIndex += 1) {
      if (!equalPlayer(base.players[playerIndex], next.players[playerIndex])) changedPlayers.push(copyPlayerForPatch(next.players[playerIndex]));
    }
    if (changedPlayers.length) patch.players = changedPlayers;

    var baseProjectiles = Object.create(null), nextProjectiles = Object.create(null);
    base.projectiles.forEach(function indexBase(projectile) { baseProjectiles[projectile.id] = projectile; });
    next.projectiles.forEach(function indexNext(projectile) { nextProjectiles[projectile.id] = projectile; });
    var upsert = [], remove = [];
    next.projectiles.forEach(function collectUpsert(projectile) {
      if (!baseProjectiles[projectile.id] || !equalProjectile(baseProjectiles[projectile.id], projectile)) upsert.push(copyProjectileForPatch(projectile));
    });
    base.projectiles.forEach(function collectRemove(projectile) { if (!nextProjectiles[projectile.id]) remove.push(projectile.id); });
    var baseProjectileOrder = base.projectiles.map(function projectileId(projectile) { return projectile.id; });
    var nextProjectileOrder = next.projectiles.map(function projectileId(projectile) { return projectile.id; });
    // An Authority implementation is currently stable-order, but the wire
    // format is deliberately lossless if a future valid snapshot reorders
    // existing projectiles without adding or removing one.
    if (upsert.length || remove.length || !equalArray(baseProjectileOrder, nextProjectileOrder)) {
      patch.projectiles = { upsert: upsert, remove: remove, order: nextProjectileOrder };
    }

    var changedRows = [];
    for (var row = 0; row < next.destructibles.length; row += 1) {
      var cells = [];
      for (var column = 0; column < next.destructibles[row].length; column += 1) {
        if (base.destructibles[row][column] !== next.destructibles[row][column]) cells.push([column, next.destructibles[row][column]]);
      }
      if (cells.length) changedRows.push({ row: row, cells: cells });
    }
    if (changedRows.length) patch.destructibles = { rows: changedRows };
    if (!equalArray(base.ack, next.ack)) patch.ack = next.ack.slice();
    if ((base.order === null) !== (next.order === null) || (base.order !== null && !equalArray(base.order, next.order))) patch.order = next.order === null ? null : next.order.slice();
    return patch;
  }

  function patchHasKnownFields(value) {
    var fields = exactFields(value, PATCH_FIELDS, []);
    if (!fields.ok) return fields;
    return { ok: true };
  }

  function applyPatch(base, patch, serverTick) {
    var validPatch = patchHasKnownFields(patch);
    if (!validPatch.ok) return validPatch;
    var next = cloneSnapshot(base);
    next.serverTick = serverTick;

    var scalarField = ownData(patch, 'scalars');
    if (!scalarField.ok) return { ok: false, reason: 'invalid_patch' };
    if (scalarField.present) {
      var scalarFields = exactFields(scalarField.value, SCALAR_FIELDS, []);
      if (!scalarFields.ok) return scalarFields;
      SCALAR_FIELDS.forEach(function copyScalar(field) {
        var candidate = ownData(scalarField.value, field);
        if (candidate.present && candidate.ok) next[field] = candidate.value;
      });
    }

    var playersField = ownData(patch, 'players');
    if (!playersField.ok) return { ok: false, reason: 'invalid_patch' };
    if (playersField.present) {
      if (!Array.isArray(playersField.value) || playersField.value.length > next.players.length) return { ok: false, reason: 'invalid_player_patch' };
      var seenPlayer = Object.create(null);
      for (var index = 0; index < playersField.value.length; index += 1) {
        var player = readPlayer(playersField.value[index], next.players.length, next.destructibles[0].length);
        if (!player.ok || seenPlayer[player.value.id]) return { ok: false, reason: player.reason || 'invalid_player_patch' };
        seenPlayer[player.value.id] = true;
        next.players[player.value.id] = copyPlayerForPatch(player.value);
      }
    }

    var projectilesField = ownData(patch, 'projectiles');
    if (!projectilesField.ok) return { ok: false, reason: 'invalid_patch' };
    if (projectilesField.present) {
      var projectileFields = exactFields(projectilesField.value, PROJECTILE_PATCH_FIELDS, PROJECTILE_PATCH_FIELDS);
      if (!projectileFields.ok || !Array.isArray(projectilesField.value.upsert) || !Array.isArray(projectilesField.value.remove) || !Array.isArray(projectilesField.value.order)) {
        return { ok: false, reason: 'invalid_projectile_patch' };
      }
      var byId = Object.create(null), removed = Object.create(null), listed = Object.create(null);
      next.projectiles.forEach(function indexProjectile(projectile) { byId[projectile.id] = copyProjectileForPatch(projectile); });
      for (var removeIndex = 0; removeIndex < projectilesField.value.remove.length; removeIndex += 1) {
        var removeId = projectilesField.value.remove[removeIndex];
        if (!safeInteger(removeId, 1, MAX_SAFE) || removed[removeId]) return { ok: false, reason: 'invalid_projectile_patch' };
        removed[removeId] = true;
        delete byId[removeId];
      }
      for (var upsertIndex = 0; upsertIndex < projectilesField.value.upsert.length; upsertIndex += 1) {
        var projectile = readProjectile(projectilesField.value.upsert[upsertIndex], next.players.length, next.destructibles[0].length);
        if (!projectile.ok || removed[projectile.value.id]) return { ok: false, reason: projectile.reason || 'invalid_projectile_patch' };
        byId[projectile.value.id] = copyProjectileForPatch(projectile.value);
      }
      if (projectilesField.value.order.length > MAX_PROJECTILES) return { ok: false, reason: 'invalid_projectile_patch' };
      var rebuilt = [];
      for (var orderIndex = 0; orderIndex < projectilesField.value.order.length; orderIndex += 1) {
        var projectileId = projectilesField.value.order[orderIndex];
        if (!safeInteger(projectileId, 1, MAX_SAFE) || listed[projectileId] || !byId[projectileId]) return { ok: false, reason: 'invalid_projectile_patch' };
        listed[projectileId] = true;
        rebuilt.push(byId[projectileId]);
      }
      if (Object.keys(byId).length !== rebuilt.length) return { ok: false, reason: 'invalid_projectile_patch' };
      next.projectiles = rebuilt;
    }

    var destructiblesField = ownData(patch, 'destructibles');
    if (!destructiblesField.ok) return { ok: false, reason: 'invalid_patch' };
    if (destructiblesField.present) {
      var destructibleFields = exactFields(destructiblesField.value, ['rows'], ['rows']);
      if (!destructibleFields.ok || !Array.isArray(destructiblesField.value.rows) || destructiblesField.value.rows.length > MAP_ROWS) return { ok: false, reason: 'invalid_grid_patch' };
      var seenRows = Object.create(null);
      for (var changedRowIndex = 0; changedRowIndex < destructiblesField.value.rows.length; changedRowIndex += 1) {
        var rowPatch = destructiblesField.value.rows[changedRowIndex];
        var rowFields = exactFields(rowPatch, ['row', 'cells'], ['row', 'cells']);
        if (!rowFields.ok || !safeInteger(rowPatch.row, 0, MAP_ROWS - 1) || seenRows[rowPatch.row] || !Array.isArray(rowPatch.cells) || rowPatch.cells.length > next.destructibles[rowPatch.row].length) {
          return { ok: false, reason: 'invalid_grid_patch' };
        }
        seenRows[rowPatch.row] = true;
        var seenColumns = Object.create(null);
        for (var changedCellIndex = 0; changedCellIndex < rowPatch.cells.length; changedCellIndex += 1) {
          var cellPatch = rowPatch.cells[changedCellIndex];
          if (!Array.isArray(cellPatch) || cellPatch.length !== 2 || !safeInteger(cellPatch[0], 0, next.destructibles[rowPatch.row].length - 1) || seenColumns[cellPatch[0]] ||
              !safeInteger(cellPatch[1], 0, 3) || (cellPatch[1] !== 0 && cellPatch[1] !== 2 && cellPatch[1] !== 3)) return { ok: false, reason: 'invalid_grid_patch' };
          seenColumns[cellPatch[0]] = true;
          next.destructibles[rowPatch.row][cellPatch[0]] = cellPatch[1];
        }
      }
    }

    var ackField = ownData(patch, 'ack');
    if (!ackField.ok) return { ok: false, reason: 'invalid_patch' };
    if (ackField.present) {
      var parsedAck = readAck(ackField.value, next.players.length);
      if (!parsedAck.ok) return parsedAck;
      next.ack = parsedAck.value.slice();
    }
    var orderField = ownData(patch, 'order');
    if (!orderField.ok) return { ok: false, reason: 'invalid_patch' };
    if (orderField.present) {
      var parsedOrder = readOrder(orderField.value, next.players.length);
      if (!parsedOrder.ok) return parsedOrder;
      next.order = parsedOrder.value === null ? null : parsedOrder.value.slice();
    }
    return normalizeSnapshot(next);
  }

  function jsonBytes(value) {
    try {
      var text = String(JSON.stringify(value));
      if (typeof Buffer !== 'undefined' && Buffer && typeof Buffer.byteLength === 'function') return Buffer.byteLength(text, 'utf8');
      if (typeof TextEncoder === 'function') return new TextEncoder().encode(text).length;
      return unescape(encodeURIComponent(text)).length;
    } catch (_error) { return MAX_ENVELOPE_BYTES + 1; }
  }

  function envelopeFingerprint(value) {
    try { return JSON.stringify(value); } catch (_error) { return ''; }
  }

  function frameStorePut(state, frameId, snapshot, fingerprint) {
    state.frames.set(frameId, { snapshot: snapshot, fingerprint: fingerprint || '' });
    while (state.frames.size > state.maxFrames) state.frames.delete(state.frames.keys().next().value);
  }

  function result(accepted, reason, extras) {
    var out = { accepted: accepted === true, reason: reason || null };
    if (extras) Object.keys(extras).forEach(function copyExtra(key) { out[key] = extras[key]; });
    return frozen(out);
  }

  function boundedInteger(value, fallback, min, max) {
    return safeInteger(value, min, max) ? value : fallback;
  }

  function create(options) {
    var opts = isPlainRecord(options) ? options : {};
    var maxRecipients = boundedInteger(opts.maxRecipients, MAX_RECIPIENTS, 1, MAX_RECIPIENTS);
    var maxFrames = boundedInteger(opts.maxFramesPerRecipient, MAX_FRAMES, 1, MAX_FRAMES);
    var keyframeEveryTicks = boundedInteger(opts.keyframeEveryTicks, DEFAULT_KEYFRAME_TICKS, 1, MAX_KEYFRAME_TICKS);
    var outgoing = new Map();
    var incoming = { matchId: null, frames: new Map(), lastFrameId: 0, lastServerTick: -1, maxFrames: maxFrames };
    var nextFrameId = 0;
    var disposed = false;

    function trimRecipients() {
      while (outgoing.size > maxRecipients) outgoing.delete(outgoing.keys().next().value);
    }

    function recipientState(recipientKey) {
      var key = String(recipientKey || 'default');
      if (!RECIPIENT_PATTERN.test(key)) return null;
      var current = outgoing.get(key);
      if (!current) {
        current = { matchId: null, frames: new Map(), lastFrameId: 0, lastServerTick: -1, lastKeyframeTick: -1, maxFrames: maxFrames };
        outgoing.set(key, current);
        trimRecipients();
      } else {
        outgoing.delete(key);
        outgoing.set(key, current);
      }
      return current;
    }

    function resetIncoming(matchId, preserveHighWater) {
      var highWaterFrame = preserveHighWater === true ? incoming.lastFrameId : 0;
      var highWaterTick = preserveHighWater === true ? incoming.lastServerTick : -1;
      incoming.matchId = matchId || null;
      incoming.frames.clear();
      incoming.lastFrameId = highWaterFrame;
      incoming.lastServerTick = highWaterTick;
    }

    function reset(config) {
      if (disposed) return result(false, 'disposed');
      var matchId = config && isPlainRecord(config) && hasOwn(config, 'matchId') ? config.matchId : null;
      if (matchId !== null && (typeof matchId !== 'string' || !MATCH_PATTERN.test(matchId))) return result(false, 'invalid_match');
      outgoing.clear();
      resetIncoming(matchId);
      nextFrameId = 0;
      return result(true, null, { matchId: incoming.matchId });
    }

    function forget(recipientKey) {
      if (disposed) return result(false, 'disposed');
      var key = String(recipientKey || '');
      if (!RECIPIENT_PATTERN.test(key)) return result(false, 'invalid_recipient');
      var removed = outgoing.delete(key);
      return result(removed, removed ? null : 'not_found');
    }

    function encode(snapshot, config) {
      if (disposed) return result(false, 'disposed');
      var parsed = normalizeSnapshot(snapshot);
      if (!parsed.ok) return result(false, parsed.reason || 'invalid_snapshot');
      var state = recipientState(config && config.recipientKey);
      if (!state) return result(false, 'invalid_recipient');
      if (state.matchId !== parsed.value.matchId) {
        state.matchId = parsed.value.matchId;
        state.frames.clear();
        state.lastFrameId = 0;
        state.lastServerTick = -1;
        state.lastKeyframeTick = -1;
      }
      if (state.lastServerTick >= 0 && parsed.value.serverTick <= state.lastServerTick) return result(false, 'stale_tick');
      var requestedFrame = config && config.frameId;
      var frameId;
      if (requestedFrame !== undefined) {
        if (!safeInteger(requestedFrame, 1, MAX_SAFE) || requestedFrame <= nextFrameId) return result(false, 'invalid_frame');
        frameId = requestedFrame;
      } else {
        if (nextFrameId >= MAX_SAFE) return result(false, 'frame_exhausted');
        frameId = nextFrameId + 1;
      }
      nextFrameId = frameId;
      var forceKeyframe = !!(config && config.forceKeyframe);
      var baseEntry = state.frames.get(state.lastFrameId);
      var shouldKeyframe = forceKeyframe || !baseEntry || state.lastKeyframeTick < 0 || parsed.value.serverTick < state.lastKeyframeTick ||
        parsed.value.serverTick - state.lastKeyframeTick >= keyframeEveryTicks;
      var keyframe = {
        protocol: V2_PROTOCOL, matchId: parsed.value.matchId, frameId: frameId, baseFrameId: null,
        serverTick: parsed.value.serverTick, kind: 'keyframe', payload: { snapshot: parsed.value }
      };
      var envelope = keyframe, mode = 'keyframe';
      if (!shouldKeyframe) {
        var patch = makePatch(baseEntry.snapshot, parsed.value);
        var delta = {
          protocol: V2_PROTOCOL, matchId: parsed.value.matchId, frameId: frameId, baseFrameId: state.lastFrameId,
          serverTick: parsed.value.serverTick, kind: 'delta', payload: { patch: patch }
        };
        if (jsonBytes(delta) < jsonBytes(keyframe) && jsonBytes(delta) <= MAX_ENVELOPE_BYTES) {
          envelope = delta;
          mode = 'delta';
        }
      }
      if (jsonBytes(envelope) > MAX_ENVELOPE_BYTES) return result(false, 'envelope_too_large');
      frameStorePut(state, frameId, parsed.value, envelopeFingerprint(envelope));
      state.lastFrameId = frameId;
      state.lastServerTick = parsed.value.serverTick;
      if (mode === 'keyframe') state.lastKeyframeTick = parsed.value.serverTick;
      return result(true, null, { mode: mode, envelope: frozen(envelope), frameId: frameId, baseFrameId: envelope.baseFrameId });
    }

    function decode(envelope) {
      if (disposed) return result(false, 'disposed', { needKeyframe: false });
      var fields = exactFields(envelope, ENVELOPE_FIELDS, ENVELOPE_FIELDS);
      if (!fields.ok) return result(false, fields.reason || 'invalid_envelope', { needKeyframe: true });
      var protocol = ownData(envelope, 'protocol');
      var matchId = ownData(envelope, 'matchId');
      var frameId = ownData(envelope, 'frameId');
      var baseFrameId = ownData(envelope, 'baseFrameId');
      var serverTick = ownData(envelope, 'serverTick');
      var kind = ownData(envelope, 'kind');
      var payload = ownData(envelope, 'payload');
      if (![protocol, matchId, frameId, baseFrameId, serverTick, kind, payload].every(function everyField(field) { return field.ok; }) ||
          protocol.value !== V2_PROTOCOL || typeof matchId.value !== 'string' || !MATCH_PATTERN.test(matchId.value) ||
          !safeInteger(frameId.value, 1, MAX_SAFE) || !safeInteger(serverTick.value, 0, MAX_SAFE) ||
          (kind.value !== 'keyframe' && kind.value !== 'delta') || !isPlainRecord(payload.value)) {
        return result(false, 'invalid_envelope', { needKeyframe: true });
      }
      if (incoming.matchId !== null && incoming.matchId !== matchId.value) return result(false, 'match_mismatch', { needKeyframe: true });
      var existing = incoming.frames.get(frameId.value);
      var fingerprint = envelopeFingerprint(envelope);
      if (existing) {
        if (existing.fingerprint === fingerprint) return result(false, 'duplicate_frame', { duplicate: true, needKeyframe: false });
        resetIncoming(incoming.matchId, true);
        return result(false, 'conflicting_frame', { needKeyframe: true });
      }
      if (incoming.lastFrameId && frameId.value <= incoming.lastFrameId) return result(false, 'late_frame', { needKeyframe: false });
      if (incoming.lastServerTick >= 0 && serverTick.value <= incoming.lastServerTick) return result(false, 'stale_tick', { needKeyframe: false });
      var parsed;
      if (kind.value === 'keyframe') {
        if (baseFrameId.value !== null) return result(false, 'invalid_keyframe', { needKeyframe: true });
        var keyframeFields = exactFields(payload.value, ['snapshot'], ['snapshot']);
        if (!keyframeFields.ok) return result(false, 'invalid_keyframe', { needKeyframe: true });
        parsed = normalizeSnapshot(payload.value.snapshot);
        if (!parsed.ok || parsed.value.matchId !== matchId.value || parsed.value.serverTick !== serverTick.value) {
          return result(false, 'invalid_keyframe', { needKeyframe: true });
        }
      } else {
        if (!safeInteger(baseFrameId.value, 1, MAX_SAFE) || baseFrameId.value >= frameId.value) return result(false, 'invalid_delta', { needKeyframe: true });
        var deltaFields = exactFields(payload.value, ['patch'], ['patch']);
        if (!deltaFields.ok) return result(false, 'invalid_delta', { needKeyframe: true });
        var base = incoming.frames.get(baseFrameId.value);
        if (!base) {
          resetIncoming(incoming.matchId, true);
          return result(false, 'missing_base', { needKeyframe: true });
        }
        parsed = applyPatch(base.snapshot, payload.value.patch, serverTick.value);
        if (!parsed.ok || parsed.value.matchId !== matchId.value || parsed.value.serverTick !== serverTick.value) {
          resetIncoming(incoming.matchId, true);
          return result(false, parsed.reason || 'invalid_delta', { needKeyframe: true });
        }
      }
      incoming.matchId = matchId.value;
      frameStorePut(incoming, frameId.value, parsed.value, fingerprint);
      incoming.lastFrameId = frameId.value;
      incoming.lastServerTick = parsed.value.serverTick;
      return result(true, null, { mode: kind.value, snapshot: parsed.value, frameId: frameId.value, baseFrameId: baseFrameId.value, needKeyframe: false });
    }

    function dispose() {
      if (!disposed) {
        disposed = true;
        outgoing.clear();
        resetIncoming(null);
      }
      return frozen({ status: 'disposed' });
    }

    return frozen({ encode: encode, decode: decode, forget: forget, reset: reset, dispose: dispose });
  }

  return frozen({
    V1_PROTOCOL: V1_PROTOCOL,
    V2_PROTOCOL: V2_PROTOCOL,
    create: create,
    normalizeSnapshot: normalizeSnapshot
  });
}));
