/*
 * TankPredictionAdapter
 *
 * A default-off presentation seam for the local Tank player.  It accepts a
 * canonical authority receipt, keeps a fixed-size list of unacknowledged
 * local movement states, and returns a small visual projection.  The caller
 * still owns input delivery, authority snapshots, rules, DOM state, and any
 * animation.  This module has no timer, transport, storage, or platform
 * dependency.
 *
 * Interface:
 *   TankPredictionAdapter.create(config)
 *   instance.submitLocalInput(command)
 *   instance.acceptAuthority(snapshot)
 *   instance.reset(reason)
 *   instance.dispose()
 */
(function installTankPredictionAdapter(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  }
  // Deterministic browser VMs may expose a CommonJS-shaped `module` while
  // still consuming the concatenated browser bundle. Publish both seams.
  if (root) root.TankPredictionAdapter = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createTankPredictionAdapterModule() {
  'use strict';

  var AUTHORITY_PROTOCOL = 'tank-authority-v1';
  var MAX_SAFE = 9007199254740991;
  var MAX_PLAYERS = 5;
  var FIXED_STEP_SECONDS = 0.05;
  var MOVE_SPEED = 2.65;
  var DEFAULT_MAX_UNACKED = 8;
  var MAX_UNACKED = 8;
  var DEFAULT_SMOOTHING_MS = 100;
  var MAX_SMOOTHING_MS = 250;
  var MAX_SMOOTH_DELTA = 1.25;
  var MATCH_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var OPTION_FIELDS = Object.freeze(['enabled', 'matchId', 'playerIndex', 'generation', 'maxUnacked', 'smoothingMs']);
  var COMMAND_FIELDS = Object.freeze(['matchId', 'generation', 'seq', 'clientTick', 'input']);
  var INPUT_FIELDS = Object.freeze(['up', 'right', 'down', 'left', 'fire']);
  var SNAPSHOT_GENERATION_FIELDS = Object.freeze(['predictionGeneration', 'matchGeneration', 'generation']);

  function freeze(value) {
    return Object.freeze(value);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function safeInteger(value, minimum, maximum) {
    return isFiniteNumber(value) && Math.floor(value) === value && value >= minimum && value <= maximum;
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      if (Object.prototype.toString.call(value) !== '[object Object]') return false;
      var prototype = Object.getPrototypeOf(value);
      if (prototype === null) return true;
      var constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function' && constructor.name === 'Object';
    } catch (_error) {
      return false;
    }
  }

  function ownData(value, key) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
      return { present: false, ok: false, value: undefined };
    }
    try {
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) return { present: false, ok: true, value: undefined };
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
        return { present: true, ok: false, value: undefined };
      }
      return { present: true, ok: true, value: descriptor.value };
    } catch (_error) {
      return { present: false, ok: false, value: undefined };
    }
  }

  function propertyNames(value) {
    try {
      return {
        names: Object.getOwnPropertyNames(value),
        symbols: typeof Object.getOwnPropertySymbols === 'function' ? Object.getOwnPropertySymbols(value) : []
      };
    } catch (_error) {
      return null;
    }
  }

  function exactNames(value, allowed) {
    var names = propertyNames(value);
    if (!names || names.symbols.length) return false;
    for (var index = 0; index < names.names.length; index += 1) {
      if (allowed.indexOf(names.names[index]) === -1) return false;
    }
    return true;
  }

  function readRequired(value, key) {
    var field = ownData(value, key);
    return field.ok && field.present ? field : { present: false, ok: false, value: undefined };
  }

  function readArrayAt(value, index) {
    if (!Array.isArray(value)) return { present: false, ok: false, value: undefined };
    return readRequired(value, String(index));
  }

  function validArrayLength(value, minimum, maximum) {
    if (!Array.isArray(value)) return false;
    try {
      return safeInteger(value.length, minimum, maximum);
    } catch (_error) {
      return false;
    }
  }

  function normalizeInput(value) {
    if (!isPlainRecord(value) || !exactNames(value, INPUT_FIELDS)) return { ok: false, reason: 'invalid_input' };
    var input = {};
    for (var index = 0; index < INPUT_FIELDS.length; index += 1) {
      var key = INPUT_FIELDS[index];
      var field = readRequired(value, key);
      if (!field.ok || typeof field.value !== 'boolean') return { ok: false, reason: 'invalid_input' };
      input[key] = field.value;
    }
    if (input.up && input.down) {
      input.up = false;
      input.down = false;
    }
    if (input.left && input.right) {
      input.left = false;
      input.right = false;
    }
    var dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    var dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    return { ok: true, value: freeze({ dx: dx, dy: dy }) };
  }

  function parseOptions(value) {
    if (value === undefined) {
      return { ok: true, value: { enabled: false, matchId: null, playerIndex: 0, generation: 0, maxUnacked: DEFAULT_MAX_UNACKED, smoothingMs: DEFAULT_SMOOTHING_MS } };
    }
    if (!isPlainRecord(value) || !exactNames(value, OPTION_FIELDS)) return { ok: false };
    var enabledField = ownData(value, 'enabled');
    if (!enabledField.ok || (enabledField.present && typeof enabledField.value !== 'boolean')) return { ok: false };
    var enabled = enabledField.present ? enabledField.value : false;
    var matchField = ownData(value, 'matchId');
    var playerField = ownData(value, 'playerIndex');
    var generationField = ownData(value, 'generation');
    var limitField = ownData(value, 'maxUnacked');
    var smoothingField = ownData(value, 'smoothingMs');
    if (![matchField, playerField, generationField, limitField, smoothingField].every(function everyField(field) { return field.ok; })) return { ok: false };
    if (matchField.present && (typeof matchField.value !== 'string' || !MATCH_ID_PATTERN.test(matchField.value))) return { ok: false };
    if (playerField.present && !safeInteger(playerField.value, 0, MAX_PLAYERS - 1)) return { ok: false };
    if (generationField.present && !safeInteger(generationField.value, 0, MAX_SAFE - 1)) return { ok: false };
    if (limitField.present && !safeInteger(limitField.value, 1, MAX_UNACKED)) return { ok: false };
    if (smoothingField.present && !safeInteger(smoothingField.value, 0, MAX_SMOOTHING_MS)) return { ok: false };
    if (enabled && (!matchField.present || !playerField.present)) return { ok: false };
    return {
      ok: true,
      value: {
        enabled: enabled,
        matchId: matchField.present ? matchField.value : null,
        playerIndex: playerField.present ? playerField.value : 0,
        generation: generationField.present ? generationField.value : 0,
        maxUnacked: limitField.present ? limitField.value : DEFAULT_MAX_UNACKED,
        smoothingMs: smoothingField.present ? smoothingField.value : DEFAULT_SMOOTHING_MS
      }
    };
  }

  function parseCommand(value) {
    if (!isPlainRecord(value) || !exactNames(value, COMMAND_FIELDS)) return { ok: false, reason: 'invalid_command' };
    var matchId = readRequired(value, 'matchId');
    var generation = readRequired(value, 'generation');
    var sequence = readRequired(value, 'seq');
    var tick = readRequired(value, 'clientTick');
    var input = readRequired(value, 'input');
    if (!matchId.ok || typeof matchId.value !== 'string' || !MATCH_ID_PATTERN.test(matchId.value)) return { ok: false, reason: 'invalid_command' };
    if (!generation.ok || !safeInteger(generation.value, 0, MAX_SAFE)) return { ok: false, reason: 'invalid_command' };
    if (!sequence.ok || !safeInteger(sequence.value, 1, MAX_SAFE)) return { ok: false, reason: 'invalid_command' };
    if (!tick.ok || !safeInteger(tick.value, 0, MAX_SAFE)) return { ok: false, reason: 'invalid_command' };
    var movement = normalizeInput(input.value);
    if (!movement.ok) return movement;
    return { ok: true, value: freeze({ matchId: matchId.value, generation: generation.value, seq: sequence.value, clientTick: tick.value, movement: movement.value }) };
  }

  function parseAuthorityPlayer(value, expectedIndex) {
    if (!isPlainRecord(value)) return { ok: false, reason: 'invalid_snapshot' };
    var id = readRequired(value, 'id');
    var x = readRequired(value, 'x');
    var y = readRequired(value, 'y');
    var direction = readRequired(value, 'd');
    var alive = readRequired(value, 'alive');
    if (!id.ok || id.value !== expectedIndex || !x.ok || !isFiniteNumber(x.value) || x.value < -1 || x.value > 20 ||
        !y.ok || !isFiniteNumber(y.value) || y.value < -1 || y.value > 20 ||
        !direction.ok || !safeInteger(direction.value, 0, 3) || !alive.ok || typeof alive.value !== 'boolean') {
      return { ok: false, reason: 'invalid_snapshot' };
    }
    return { ok: true, value: freeze({ x: x.value, y: y.value, d: direction.value, alive: alive.value }) };
  }

  function parseSnapshotGeneration(value) {
    var found = null;
    for (var index = 0; index < SNAPSHOT_GENERATION_FIELDS.length; index += 1) {
      var field = ownData(value, SNAPSHOT_GENERATION_FIELDS[index]);
      if (!field.ok) return { ok: false };
      if (!field.present) continue;
      if (!safeInteger(field.value, 0, MAX_SAFE)) return { ok: false };
      if (found !== null && found !== field.value) return { ok: false };
      found = field.value;
    }
    return { ok: true, value: found };
  }

  function parseAuthoritySnapshot(value, expectedPlayerIndex) {
    if (!isPlainRecord(value)) return { ok: false, reason: 'invalid_snapshot' };
    var protocol = readRequired(value, 'protocol');
    var matchId = readRequired(value, 'matchId');
    var tick = readRequired(value, 'serverTick');
    var acknowledgements = readRequired(value, 'ack');
    var players = readRequired(value, 'players');
    if (!protocol.ok || protocol.value !== AUTHORITY_PROTOCOL || !matchId.ok || typeof matchId.value !== 'string' || !MATCH_ID_PATTERN.test(matchId.value) ||
        !tick.ok || !safeInteger(tick.value, 0, MAX_SAFE) || !acknowledgements.ok || !validArrayLength(acknowledgements.value, 2, MAX_PLAYERS) ||
        !players.ok || !validArrayLength(players.value, 2, MAX_PLAYERS) || acknowledgements.value.length !== players.value.length ||
        expectedPlayerIndex >= acknowledgements.value.length || expectedPlayerIndex >= players.value.length) {
      return { ok: false, reason: 'invalid_snapshot' };
    }
    for (var index = 0; index < acknowledgements.value.length; index += 1) {
      var acknowledgement = readArrayAt(acknowledgements.value, index);
      if (!acknowledgement.ok || !safeInteger(acknowledgement.value, 0, MAX_SAFE)) return { ok: false, reason: 'invalid_snapshot' };
    }
    var player = readArrayAt(players.value, expectedPlayerIndex);
    if (!player.ok) return { ok: false, reason: 'invalid_snapshot' };
    var parsedPlayer = parseAuthorityPlayer(player.value, expectedPlayerIndex);
    if (!parsedPlayer.ok) return parsedPlayer;
    var parsedGeneration = parseSnapshotGeneration(value);
    if (!parsedGeneration.ok) return { ok: false, reason: 'invalid_snapshot' };
    return {
      ok: true,
      value: freeze({
        matchId: matchId.value,
        serverTick: tick.value,
        ack: readArrayAt(acknowledgements.value, expectedPlayerIndex).value,
        player: parsedPlayer.value,
        generation: parsedGeneration.value
      })
    };
  }

  function movementDirection(dx, dy, fallback) {
    if (!dx && !dy) return fallback;
    if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 1 : 3;
    return dy > 0 ? 2 : 0;
  }

  function create(options) {
    var parsedOptions = parseOptions(options);
    var settings = parsedOptions.ok ? parsedOptions.value : { enabled: false, matchId: null, playerIndex: 0, generation: 0, maxUnacked: DEFAULT_MAX_UNACKED, smoothingMs: DEFAULT_SMOOTHING_MS };
    var state = {
      disposed: false,
      valid: parsedOptions.ok,
      enabled: settings.enabled === true,
      matchId: settings.matchId,
      playerIndex: settings.playerIndex,
      generation: settings.generation,
      maxUnacked: settings.maxUnacked,
      smoothingMs: settings.smoothingMs,
      ready: false,
      rebasing: false,
      minimumTick: -1,
      lastAuthorityTick: -1,
      lastAck: -1,
      lastSubmitted: -1,
      base: null,
      pending: [],
      lastProjection: null
    };

    function response(accepted, reason, additions) {
      var output = { accepted: accepted === true, reason: reason || null, generation: state.generation };
      if (additions) {
        Object.keys(additions).forEach(function copyAddition(key) { output[key] = additions[key]; });
      }
      return freeze(output);
    }

    function project(source) {
      var x = state.base.x;
      var y = state.base.y;
      var direction = state.base.d;
      var replayed = 0;
      if (state.base.alive) {
        // Tank commands are complete control states rather than impulses. If
        // several changes were issued against one Authority tick, only the
        // final state for that tick may move the presentation.
        var replayStates = [];
        state.pending.forEach(function collect(command) {
          var previous = replayStates[replayStates.length - 1];
          if (previous && previous.clientTick === command.clientTick) replayStates[replayStates.length - 1] = command;
          else replayStates.push(command);
        });
        replayStates.forEach(function replay(command) {
          var dx = command.movement.dx;
          var dy = command.movement.dy;
          if (!dx && !dy) return;
          var length = Math.sqrt(dx * dx + dy * dy) || 1;
          x += (dx / length) * MOVE_SPEED * FIXED_STEP_SECONDS;
          y += (dy / length) * MOVE_SPEED * FIXED_STEP_SECONDS;
          direction = movementDirection(dx, dy, direction);
          replayed += 1;
        });
      }
      var previous = state.lastProjection;
      var distance = previous ? Math.hypot(x - previous.x, y - previous.y) : Infinity;
      var transitionMode = source === 'authority' && previous && distance <= MAX_SMOOTH_DELTA ? 'smooth' : 'snap';
      var presentation = freeze({
        playerIndex: state.playerIndex,
        serverTick: state.lastAuthorityTick,
        acknowledgedSeq: state.lastAck,
        x: x,
        y: y,
        d: direction,
        replayed: replayed,
        transition: freeze({
          mode: transitionMode,
          fromX: transitionMode === 'smooth' ? previous.x : x,
          fromY: transitionMode === 'smooth' ? previous.y : y,
          toX: x,
          toY: y,
          durationMs: transitionMode === 'smooth' ? state.smoothingMs : 0
        })
      });
      state.lastProjection = { x: x, y: y, d: direction };
      return presentation;
    }

    function submitLocalInput(command) {
      if (state.disposed) return response(false, 'disposed');
      if (!state.valid) return response(false, 'invalid_config');
      if (!state.enabled) return response(false, 'disabled');
      if (!state.ready || !state.base) return response(false, 'no_authority');
      var parsed = parseCommand(command);
      if (!parsed.ok) return response(false, parsed.reason);
      if (parsed.value.matchId !== state.matchId) return response(false, 'wrong_match');
      if (parsed.value.generation !== state.generation) return response(false, 'stale_generation');
      if (parsed.value.clientTick !== state.lastAuthorityTick) return response(false, 'stale_tick');
      if (parsed.value.seq <= state.lastAck || parsed.value.seq <= state.lastSubmitted) return response(false, 'stale_sequence');
      if (state.pending.length >= state.maxUnacked) return response(false, 'queue_full');
      state.pending.push(parsed.value);
      state.lastSubmitted = parsed.value.seq;
      return response(true, null, { presentation: project('local') });
    }

    function acceptAuthority(snapshot) {
      if (state.disposed) return response(false, 'disposed');
      if (!state.valid) return response(false, 'invalid_config');
      if (!state.enabled) return response(false, 'disabled');
      var parsed = parseAuthoritySnapshot(snapshot, state.playerIndex);
      if (!parsed.ok) return response(false, parsed.reason);
      if (parsed.value.matchId !== state.matchId) return response(false, 'wrong_match');
      if (parsed.value.generation !== null && parsed.value.generation !== state.generation) return response(false, 'stale_generation');
      if (state.lastAck >= 0 && parsed.value.ack < state.lastAck) return response(false, 'stale_ack');
      if (state.rebasing) {
        if (parsed.value.serverTick < state.minimumTick) return response(false, 'stale_tick');
      } else if (state.ready && parsed.value.serverTick <= state.lastAuthorityTick) {
        return response(false, 'stale_tick');
      }
      var resynchronized = !state.rebasing && state.ready && parsed.value.ack > state.lastSubmitted;
      if (!state.ready || state.rebasing || resynchronized) {
        state.pending.length = 0;
        state.lastSubmitted = parsed.value.ack;
      } else {
        state.pending = state.pending.filter(function keepUnacknowledged(command) { return command.seq > parsed.value.ack; });
      }
      state.lastAck = parsed.value.ack;
      state.lastAuthorityTick = parsed.value.serverTick;
      state.minimumTick = parsed.value.serverTick;
      state.base = parsed.value.player;
      state.ready = true;
      state.rebasing = false;
      return response(true, null, { presentation: project('authority'), resynchronized: resynchronized });
    }

    function reset(_reason) {
      if (state.disposed) return response(false, 'disposed', { cleared: 0 });
      if (state.generation >= MAX_SAFE) return response(false, 'generation_exhausted', { cleared: 0 });
      var cleared = state.pending.length;
      state.pending.length = 0;
      state.generation += 1;
      state.minimumTick = Math.max(state.minimumTick, state.lastAuthorityTick);
      state.ready = false;
      state.rebasing = true;
      state.base = null;
      state.lastProjection = null;
      state.lastSubmitted = state.lastAck;
      return response(true, null, { cleared: cleared });
    }

    function dispose() {
      if (!state.disposed) {
        state.disposed = true;
        state.enabled = false;
        state.pending.length = 0;
        state.base = null;
        state.lastProjection = null;
      }
      return freeze({ status: 'disposed', generation: state.generation, queued: 0 });
    }

    return freeze({
      submitLocalInput: submitLocalInput,
      acceptAuthority: acceptAuthority,
      reset: reset,
      dispose: dispose
    });
  }

  return freeze({ create: create });
}));
