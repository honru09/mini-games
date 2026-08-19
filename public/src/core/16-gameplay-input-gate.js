/*
 * GameplayInputGate
 *
 * A default-off, memory-only gate for already-mapped Tetris and Tank intents.
 * The caller owns controls, rules, authority, and the final action callback.
 * This module only bounds short-lived ordering, duplicate suppression, and
 * lifecycle generations at one local seam.  reset() binds one match and
 * revision to that generation.  `bufferMs` is a maximum retained age checked
 * by submit() and flush(); the caller chooses when to flush and this module
 * never schedules a delayed action.
 */
(function installGameplayInputGate(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else if (root) {
    root.GameplayInputGate = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createGameplayInputGateModule() {
  'use strict';

  var MIN_BUFFER_MS = 50;
  var MAX_BUFFER_MS = 100;
  var DEFAULT_BUFFER_MS = 75;
  var MAX_QUEUE = 16;
  var MAX_SEEN_IDS = 64;
  var GAME_IDS = Object.freeze(['tetris', 'tank']);
  var TETRIS_TYPES = Object.freeze(['move_left', 'move_right', 'soft_drop', 'hard_drop', 'rotate_cw', 'rotate_ccw', 'hold']);
  var TANK_TYPES = Object.freeze(['control_state']);
  var DIRECTIONS = Object.freeze(['neutral', 'up', 'down', 'left', 'right', 'up_left', 'up_right', 'down_left', 'down_right']);
  var INTENT_FIELDS = Object.freeze(['gameId', 'type', 'direction', 'firing', 'id', 'sequence', 'generation']);
  var RESET_FIELDS = Object.freeze(['gameId', 'matchId', 'revision', 'enabled', 'bufferMs']);
  var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
  var MATCH_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
  var SENSITIVE_KEY_PATTERN = /(?:^|[_-])(?:token|secret|password|passcode|pin|authorization|cookie|credential|session|email|mail|phone|address|message|stack|body|text|content|chat|payload|trace|prompt|url|uri|username|user)(?:$|[_-])/i;

  function contains(values, value) {
    return values.indexOf(value) !== -1;
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
    try {
      var descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor) return { present: false, ok: true, value: undefined };
      if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) return { present: true, ok: false, value: undefined };
      return { present: true, ok: true, value: descriptor.value };
    } catch (_error) {
      return { present: false, ok: false, value: undefined };
    }
  }

  function safeNames(value) {
    try {
      return {
        names: Object.getOwnPropertyNames(value),
        symbols: typeof Object.getOwnPropertySymbols === 'function' ? Object.getOwnPropertySymbols(value) : []
      };
    } catch (_error) {
      return null;
    }
  }

  function normalizedKey(value) {
    return String(value).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  function sensitiveKey(key) {
    return SENSITIVE_KEY_PATTERN.test(normalizedKey(key));
  }

  function safeInteger(value) {
    return typeof value === 'number' && isFinite(value) && Math.floor(value) === value && value >= 0 && value <= 9007199254740991;
  }

  function validBuffer(value) {
    return safeInteger(value) && value >= MIN_BUFFER_MS && value <= MAX_BUFFER_MS;
  }

  function freeze(value) {
    return Object.freeze(value);
  }

  function readClock(clock, fallback) {
    var value = fallback;
    if (clock) {
      try { value = clock(); } catch (_error) { value = fallback; }
    }
    return typeof value === 'number' && isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  }

  function validateFieldNames(input, allowed) {
    var names = safeNames(input);
    if (!names || names.symbols.length) return { ok: false, reason: 'invalid_record' };
    for (var index = 0; index < names.names.length; index += 1) {
      var key = names.names[index];
      if (!contains(allowed, key)) return { ok: false, reason: sensitiveKey(key) ? 'sensitive_field' : 'unsupported_field' };
    }
    return { ok: true };
  }

  function parseReset(input, defaultBuffer) {
    if (!isPlainRecord(input)) return { ok: false, reason: 'invalid_reset' };
    var fields = validateFieldNames(input, RESET_FIELDS);
    if (!fields.ok) return fields;
    var enabled = ownData(input, 'enabled');
    if (!enabled.ok || (enabled.present && typeof enabled.value !== 'boolean')) return { ok: false, reason: 'invalid_reset' };
    var gameId = ownData(input, 'gameId');
    if (!gameId.ok) return { ok: false, reason: 'invalid_reset' };
    var matchId = ownData(input, 'matchId');
    var revision = ownData(input, 'revision');
    if (!matchId.ok || !revision.ok) return { ok: false, reason: 'invalid_reset' };
    var wantsEnabled = enabled.present ? enabled.value : gameId.present;
    if (wantsEnabled) {
      if (!gameId.present || typeof gameId.value !== 'string' || !contains(GAME_IDS, gameId.value)) {
        return { ok: false, reason: 'invalid_game' };
      }
      if (!matchId.present || typeof matchId.value !== 'string' || !MATCH_ID_PATTERN.test(matchId.value)) {
        return { ok: false, reason: 'invalid_match' };
      }
      if (!revision.present || !safeInteger(revision.value)) return { ok: false, reason: 'invalid_revision' };
    } else if (gameId.present && (typeof gameId.value !== 'string' || !contains(GAME_IDS, gameId.value))) {
      return { ok: false, reason: 'invalid_game' };
    } else if (matchId.present || revision.present) {
      return { ok: false, reason: 'invalid_reset' };
    }
    var buffer = ownData(input, 'bufferMs');
    if (!buffer.ok || (buffer.present && !validBuffer(buffer.value))) return { ok: false, reason: 'invalid_buffer' };
    return {
      ok: true,
      value: {
        enabled: wantsEnabled,
        gameId: wantsEnabled ? gameId.value : null,
        matchId: wantsEnabled ? matchId.value : null,
        revision: wantsEnabled ? revision.value : null,
        bufferMs: buffer.present ? buffer.value : defaultBuffer
      }
    };
  }

  function parseIntent(input, state) {
    if (!isPlainRecord(input)) return { ok: false, reason: 'invalid_intent' };
    var fields = validateFieldNames(input, INTENT_FIELDS);
    if (!fields.ok) return fields;

    var generation = ownData(input, 'generation');
    if (!generation.ok || !generation.present || !safeInteger(generation.value) || generation.value !== state.generation) {
      return { ok: false, reason: 'stale_generation' };
    }
    var gameId = ownData(input, 'gameId');
    if (!gameId.ok || !gameId.present || typeof gameId.value !== 'string' || gameId.value !== state.gameId) {
      return { ok: false, reason: 'wrong_game' };
    }
    var id = ownData(input, 'id');
    if (!id.ok || !id.present || typeof id.value !== 'string' || !ID_PATTERN.test(id.value)) {
      return { ok: false, reason: 'invalid_id' };
    }
    var sequence = ownData(input, 'sequence');
    if (!sequence.ok || !sequence.present || !safeInteger(sequence.value)) return { ok: false, reason: 'invalid_sequence' };
    var type = ownData(input, 'type');
    if (!type.ok || !type.present || typeof type.value !== 'string') return { ok: false, reason: 'invalid_type' };
    var direction = ownData(input, 'direction');
    if (!direction.ok) return { ok: false, reason: 'invalid_direction' };

    if (state.gameId === 'tetris') {
      var tetrisFiring = ownData(input, 'firing');
      if (!tetrisFiring.ok || !contains(TETRIS_TYPES, type.value) || direction.present || tetrisFiring.present) {
        return { ok: false, reason: 'invalid_type' };
      }
      return { ok: true, value: freeze({ gameId: state.gameId, matchId: state.matchId, revision: state.revision, type: type.value, id: id.value, sequence: sequence.value, generation: state.generation }) };
    }
    if (!contains(TANK_TYPES, type.value)) return { ok: false, reason: 'invalid_type' };
    if (!direction.present || typeof direction.value !== 'string' || !contains(DIRECTIONS, direction.value)) {
      return { ok: false, reason: 'invalid_direction' };
    }
    var firing = ownData(input, 'firing');
    if (!firing.ok || !firing.present || typeof firing.value !== 'boolean') return { ok: false, reason: 'invalid_firing' };
    return {
      ok: true,
      value: freeze({
        gameId: state.gameId,
        matchId: state.matchId,
        revision: state.revision,
        type: type.value,
        direction: direction.value,
        firing: firing.value,
        id: id.value,
        sequence: sequence.value,
        generation: state.generation
      })
    };
  }

  function create(options) {
    var opts = isPlainRecord(options) ? options : {};
    var clockField = ownData(opts, 'now');
    var callbackField = ownData(opts, 'onIntent');
    var bufferField = ownData(opts, 'bufferMs');
    var clock = clockField.ok && typeof clockField.value === 'function' ? clockField.value : null;
    var onIntent = callbackField.ok && typeof callbackField.value === 'function' ? callbackField.value : null;
    var initialBuffer = bufferField.ok && validBuffer(bufferField.value) ? bufferField.value : DEFAULT_BUFFER_MS;
    var initialNow = readClock(clock, Date.now());
    var state = {
      disposed: false,
      enabled: false,
      gameId: null,
      matchId: null,
      revision: null,
      generation: 0,
      bufferMs: initialBuffer,
      queue: [],
      seenIds: [],
      lastSequence: -1,
      flushing: false,
      lastNow: initialNow
    };

    function now() {
      var candidate = readClock(clock, Date.now());
      if (candidate > state.lastNow) state.lastNow = candidate;
      return state.lastNow;
    }

    function result(accepted, reason, additions) {
      var output = {
        accepted: accepted === true,
        reason: reason || null,
        generation: state.generation
      };
      if (additions) {
        Object.keys(additions).forEach(function copyResult(key) { output[key] = additions[key]; });
      }
      return freeze(output);
    }

    function forgetExpired(currentNow) {
      var dropped = 0;
      while (state.queue.length && currentNow - state.queue[0].acceptedAt > state.bufferMs) {
        state.queue.shift();
        dropped += 1;
      }
      return dropped;
    }

    function seen(id) {
      return state.seenIds.indexOf(id) !== -1;
    }

    function remember(id) {
      state.seenIds.push(id);
      while (state.seenIds.length > MAX_SEEN_IDS) state.seenIds.shift();
    }

    function submit(intent) {
      if (state.disposed) return result(false, 'disposed');
      if (!state.enabled) return result(false, 'disabled');
      forgetExpired(now());
      var parsed = parseIntent(intent, state);
      if (!parsed.ok) return result(false, parsed.reason);
      if (seen(parsed.value.id)) return result(false, 'duplicate');
      if (parsed.value.sequence <= state.lastSequence) return result(false, 'out_of_order');
      if (state.queue.length >= MAX_QUEUE) return result(false, 'queue_full');
      remember(parsed.value.id);
      state.lastSequence = parsed.value.sequence;
      state.queue.push({ intent: parsed.value, acceptedAt: state.lastNow });
      return result(true, null, { queued: state.queue.length });
    }

    function flush() {
      if (state.disposed) return result(false, 'disposed', { delivered: 0, droppedExpired: 0 });
      if (!state.enabled) return result(false, 'disabled', { delivered: 0, droppedExpired: 0 });
      if (state.flushing) return result(false, 'busy', { delivered: 0, droppedExpired: 0 });
      var dropped = forgetExpired(now());
      if (!state.queue.length) {
        return result(dropped === 0, dropped ? 'expired' : null, { delivered: 0, droppedExpired: dropped });
      }
      if (!onIntent) {
        state.queue.length = 0;
        return result(false, 'no_adapter', { delivered: 0, droppedExpired: dropped });
      }

      state.flushing = true;
      var delivered = 0;
      var reason = null;
      try {
        while (state.queue.length && !state.disposed) {
          var entry = state.queue.shift();
          var entryGeneration = state.generation;
          try {
            onIntent(entry.intent);
            delivered += 1;
          } catch (_error) {
            state.queue.length = 0;
            reason = 'adapter_failed';
            break;
          }
          if (state.disposed || state.generation !== entryGeneration) {
            state.queue.length = 0;
            reason = 'generation_changed';
            break;
          }
        }
      } finally {
        state.flushing = false;
      }
      return result(reason === null, reason, { delivered: delivered, droppedExpired: dropped });
    }

    function reset(config) {
      if (state.disposed) return result(false, 'disposed', { cleared: 0 });
      var parsed = parseReset(config, state.bufferMs);
      if (!parsed.ok) return result(false, parsed.reason, { cleared: 0 });
      var cleared = state.queue.length;
      state.queue.length = 0;
      state.seenIds.length = 0;
      state.lastSequence = -1;
      state.generation += 1;
      state.enabled = parsed.value.enabled;
      state.gameId = parsed.value.gameId;
      state.matchId = parsed.value.matchId;
      state.revision = parsed.value.revision;
      state.bufferMs = parsed.value.bufferMs;
      return result(true, null, { cleared: cleared, gameId: state.gameId, matchId: state.matchId, revision: state.revision, bufferMs: state.bufferMs });
    }

    function dispose() {
      if (!state.disposed) {
        state.disposed = true;
        state.enabled = false;
        state.gameId = null;
        state.matchId = null;
        state.revision = null;
        state.generation += 1;
        state.queue.length = 0;
        state.seenIds.length = 0;
        state.lastSequence = -1;
      }
      return freeze({ status: 'disposed', generation: state.generation, queued: 0 });
    }

    return freeze({ submit: submit, flush: flush, reset: reset, dispose: dispose });
  }

  return freeze({ create: create });
}));
