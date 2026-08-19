(function clientDiagnosticsRingModule(root, factory) {
  if (typeof module === 'object' && module && module.exports) {
    module.exports = factory();
  } else {
    root.ClientDiagnosticsRing = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createClientDiagnosticsRingModule() {
  'use strict';

  var CAPACITY = 64;
  var RETENTION_MS = 5 * 60 * 1000;
  var MAX_IDENTIFIER_LENGTH = 256;
  var MAX_LABEL_LENGTH = 64;
  var EVENT_TYPES = new Set(['desync', 'protocol_error', 'unhandled_exception']);
  var GAME_IDS = new Set(['platform', 'gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi']);
  var REASONS = Object.freeze({
    desync: new Set([
      'snapshot_mismatch', 'revision_gap', 'sequence_gap', 'base_missing', 'authority_rejected',
      'state_mismatch', 'timeout', 'unknown'
    ]),
    protocol_error: new Set([
      'invalid_envelope', 'invalid_payload', 'unsupported_protocol', 'version_mismatch',
      'capability_mismatch', 'malformed_message', 'stale_message', 'authority_rejected',
      'reconnect_failed', 'timeout', 'unknown'
    ]),
    unhandled_exception: new Set([
      'uncaught', 'unhandled_rejection', 'type_error', 'range_error', 'syntax_error',
      'state_error', 'abort_error', 'network_error', 'unknown'
    ])
  });
  var ERROR_CATEGORIES = new Set(['abort', 'network', 'range', 'syntax', 'state', 'type', 'unknown']);
  var PROTOCOLS = new Set([
    'unknown', 'gomoku-v1', 'ludo-v1', 'room-v1', 'auth-v2', 'direct-chat-v1', 'match-chat-v1',
    'playline-v1', 'tank-authority-v1', 'tetris-coordination-v1', 'tetris-rule-v1', 'tetris-rule-v2',
    'tetris-rule-v3', 'xiangqi-rule-v2', 'monopoly-rule-v2', 'tournament-orchestrator-v1.1'
  ]);
  var ALLOWED_FIELDS = new Set([
    'type', 'gameId', 'reason', 'protocol', 'revision', 'sequence', 'baseRevision', 'status',
    'matchId', 'roomId', 'playerId', 'requestId', 'errorCategory'
  ]);
  // Any field that could carry a credential, free-form user content, a URL,
  // or an execution trace is rejected before the allowlist result is built.
  // Keep this broader than the allowlist so future callers fail closed with a
  // privacy-specific reason instead of silently treating a sensitive key as
  // an ordinary unsupported diagnostic.
  var SENSITIVE_KEY_PATTERN = /(?:^|[_-])(?:token|secret|password|passcode|pin|authorization|cookie|credential|session|email|mail|phone|address|message|stack|body|text|content|chat|payload|trace|prompt|url|uri|username|user)(?:$|[_-])/i;
  var LABEL_PATTERN = /^[a-z][a-z0-9_.:-]{0,63}$/;

  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function isPlainRecord(value) {
    if (!isObject(value)) return false;
    try {
      if (Object.prototype.toString.call(value) !== '[object Object]') return false;
      var prototype = Object.getPrototypeOf(value);
      if (prototype === null) return true;
      var constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function' && constructor.name === 'Object';
    } catch (error) {
      return false;
    }
  }

  function hasOwn(value, key) {
    try {
      return Object.prototype.hasOwnProperty.call(value, key);
    } catch (error) {
      return false;
    }
  }

  function readOwn(value, key) {
    if (!hasOwn(value, key)) return { present: false, ok: true, value: undefined };
    try {
      return { present: true, ok: true, value: value[key] };
    } catch (error) {
      return { present: true, ok: false, value: undefined };
    }
  }

  function safePropertyNames(value) {
    try {
      return {
        names: Object.getOwnPropertyNames(value),
        symbols: typeof Object.getOwnPropertySymbols === 'function' ? Object.getOwnPropertySymbols(value) : []
      };
    } catch (error) {
      return null;
    }
  }

  function normalizedKey(value) {
    return String(value).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
  }

  function sensitiveKey(key) {
    return SENSITIVE_KEY_PATTERN.test(normalizedKey(key));
  }

  function safeInteger(value, upperBound) {
    var isSafe = typeof Number.isSafeInteger === 'function'
      ? Number.isSafeInteger(value)
      : typeof value === 'number' && Number.isFinite(value) && Math.floor(value) === value && Math.abs(value) <= 9007199254740991;
    return isSafe && value >= 0 && value <= upperBound ? value : null;
  }

  function normalizedLabel(value) {
    if (typeof value !== 'string') return null;
    var result = value.trim().toLowerCase().slice(0, MAX_LABEL_LENGTH);
    return LABEL_PATTERN.test(result) ? result : null;
  }

  function normalizedProtocol(value) {
    if (typeof value !== 'string') return null;
    var result = value.trim().toLowerCase().slice(0, 48);
    return PROTOCOLS.has(result) ? result : null;
  }

  function randomSeed(now) {
    var random = 0;
    try { random = Math.floor(Math.random() * 4294967295); } catch (error) {}
    return ((random >>> 0) ^ (now >>> 0) ^ ((now / 4294967296) >>> 0)) >>> 0;
  }

  function hashPart(value, seed) {
    var hash = (2166136261 ^ seed) >>> 0;
    for (var index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return ('00000000' + hash.toString(16)).slice(-8);
  }

  function opaqueIdentifier(category, value, seedA, seedB) {
    return category + '-' + hashPart(value, seedA) + hashPart(value, seedB);
  }

  function statusFor(state) {
    if (state.disposed) return 'disposed';
    return state.enabled ? 'enabled' : 'disabled';
  }

  function frozenResult(accepted, reason, record) {
    var result = { accepted: accepted === true, reason: reason || null };
    if (record) result.record = record;
    return Object.freeze(result);
  }

  function create(options) {
    var settings = isPlainRecord(options) ? options : {};
    var enabledValue = readOwn(settings, 'enabled');
    var nowValue = readOwn(settings, 'now');
    var suppliedClock = nowValue.ok && typeof nowValue.value === 'function' ? nowValue.value : null;
    var initialNow = readClock(suppliedClock, Date.now());
    var state = {
      disposed: false,
      enabled: enabledValue.ok && enabledValue.value === true,
      entries: [],
      lastNow: initialNow,
      seedA: randomSeed(initialNow),
      seedB: randomSeed(initialNow ^ 2654435769)
    };

    function now() {
      var candidate = readClock(suppliedClock, Date.now());
      if (candidate > state.lastNow) state.lastNow = candidate;
      return state.lastNow;
    }

    function prune(currentTime) {
      if (!state.entries.length) return;
      var keepFrom = 0;
      while (keepFrom < state.entries.length && currentTime - state.entries[keepFrom].at > RETENTION_MS) keepFrom += 1;
      if (keepFrom > 0) state.entries.splice(0, keepFrom);
    }

    function snapshot() {
      if (!state.disposed) prune(now());
      return Object.freeze({
        status: statusFor(state),
        enabled: !state.disposed && state.enabled,
        capacity: CAPACITY,
        retentionMs: RETENTION_MS,
        size: state.entries.length,
        records: Object.freeze(state.entries.slice())
      });
    }

    function readField(input, key) {
      var value = readOwn(input, key);
      return value.ok ? value : null;
    }

    function validateIdentifier(input, key) {
      var field = readField(input, key);
      if (!field) return { ok: false, reason: 'unreadable_field' };
      if (!field.present) return { ok: true, value: null };
      if (typeof field.value !== 'string' || field.value.length < 1 || field.value.length > MAX_IDENTIFIER_LENGTH) {
        return { ok: false, reason: 'invalid_identifier' };
      }
      return { ok: true, value: field.value };
    }

    function parse(input) {
      if (!isPlainRecord(input)) return { ok: false, reason: 'invalid_record' };
      var properties = safePropertyNames(input);
      if (!properties) return { ok: false, reason: 'invalid_record' };
      if (properties.symbols.length) return { ok: false, reason: 'unsupported_field' };
      for (var index = 0; index < properties.names.length; index += 1) {
        var key = properties.names[index];
        if (!ALLOWED_FIELDS.has(key)) {
          return { ok: false, reason: sensitiveKey(key) ? 'sensitive_field' : 'unsupported_field' };
        }
      }

      var typeField = readField(input, 'type');
      if (!typeField || typeof typeField.value !== 'string' || !EVENT_TYPES.has(typeField.value)) {
        return { ok: false, reason: 'unsupported_type' };
      }
      var type = typeField.value;
      var record = { at: now(), type: type, game: 'platform', reason: 'unknown' };

      var gameField = readField(input, 'gameId');
      if (!gameField) return { ok: false, reason: 'unreadable_field' };
      if (gameField.present) {
        if (typeof gameField.value !== 'string' || !GAME_IDS.has(gameField.value)) return { ok: false, reason: 'invalid_game' };
        record.game = gameField.value;
      }

      var reasonField = readField(input, 'reason');
      if (!reasonField) return { ok: false, reason: 'unreadable_field' };
      if (reasonField.present) {
        var reason = normalizedLabel(reasonField.value);
        if (!reason || !REASONS[type].has(reason)) return { ok: false, reason: 'invalid_reason' };
        record.reason = reason;
      }

      var protocolField = readField(input, 'protocol');
      if (!protocolField) return { ok: false, reason: 'unreadable_field' };
      if (protocolField.present) {
        var protocol = normalizedProtocol(protocolField.value);
        if (!protocol) return { ok: false, reason: 'invalid_protocol' };
        record.protocol = protocol;
      }

      var numericFields = [
        ['revision', 9007199254740991], ['sequence', 9007199254740991],
        ['baseRevision', 9007199254740991], ['status', 999]
      ];
      for (var numericIndex = 0; numericIndex < numericFields.length; numericIndex += 1) {
        var numeric = numericFields[numericIndex];
        var numericField = readField(input, numeric[0]);
        if (!numericField) return { ok: false, reason: 'unreadable_field' };
        if (!numericField.present) continue;
        var normalizedNumber = safeInteger(numericField.value, numeric[1]);
        if (normalizedNumber === null) return { ok: false, reason: 'invalid_number' };
        record[numeric[0]] = normalizedNumber;
      }

      var errorField = readField(input, 'errorCategory');
      if (!errorField) return { ok: false, reason: 'unreadable_field' };
      if (errorField.present) {
        if (type !== 'unhandled_exception' || typeof errorField.value !== 'string' || !ERROR_CATEGORIES.has(errorField.value)) {
          return { ok: false, reason: 'invalid_error_category' };
        }
        record.error = errorField.value;
      }

      var identifiers = [
        ['matchId', 'match'], ['roomId', 'room'], ['playerId', 'player'], ['requestId', 'request']
      ];
      for (var identifierIndex = 0; identifierIndex < identifiers.length; identifierIndex += 1) {
        var identifier = identifiers[identifierIndex];
        var checked = validateIdentifier(input, identifier[0]);
        if (!checked.ok) return checked;
        if (checked.value !== null) record[identifier[1]] = opaqueIdentifier(identifier[1], checked.value, state.seedA, state.seedB);
      }

      return { ok: true, record: Object.freeze(record) };
    }

    function record(input) {
      if (state.disposed) return frozenResult(false, 'disposed');
      if (!state.enabled) return frozenResult(false, 'disabled');
      prune(now());
      var parsed = parse(input);
      if (!parsed.ok) return frozenResult(false, parsed.reason);
      state.entries.push(parsed.record);
      while (state.entries.length > CAPACITY) state.entries.shift();
      return frozenResult(true, null, parsed.record);
    }

    function clear() {
      var cleared = state.entries.length;
      state.entries.length = 0;
      return Object.freeze({ cleared: cleared, status: statusFor(state) });
    }

    function dispose() {
      if (!state.disposed) {
        state.entries.length = 0;
        state.disposed = true;
        state.enabled = false;
      }
      return snapshot();
    }

    return Object.freeze({ record: record, snapshot: snapshot, clear: clear, dispose: dispose });
  }

  function readClock(clock, fallback) {
    var value = fallback;
    if (clock) {
      try { value = clock(); } catch (error) { value = fallback; }
    }
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  }

  return Object.freeze({ create: create });
}));
