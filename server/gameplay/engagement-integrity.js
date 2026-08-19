'use strict';

/*
 * EngagementIntegrityAnalyzer
 *
 * This is deliberately a small, inert observation seam.  A caller gives it
 * only a summary of an action that has already been accepted elsewhere.  The
 * summary is copied into a bounded in-memory window and the returned values
 * are descriptive measurements; this module has no authority over gameplay.
 *
 * The implementation is defensive at the boundary: accessors, proxies,
 * malformed records and a broken clock are treated as data-quality failures
 * and never escape as exceptions.  The analyzer therefore remains usable when
 * an optional observation path is unhealthy.
 */

const MAX_SAFE_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
const DEFAULT_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CAPACITY = 256;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CAPACITY = 2048;
const MAX_TOKEN_LENGTH = 48;

const SUMMARY_FIELDS = Object.freeze([
  'gameId',
  'mode',
  'actorSlot',
  'actorClass',
  'sourceClass',
  'actionClass',
  'acceptedAt',
  'sequenceClass',
  'reconnectEpoch',
  'inputModality',
]);
const SUMMARY_FIELD_SET = new Set(SUMMARY_FIELDS);

// These sets are intentionally categorical.  Unknown future categories can
// still pass when they are bounded identifier tokens; free-form text cannot.
const ACTOR_CLASSES = new Set(['human', 'ai', 'test-admin', 'spectator']);
const INPUT_ALIASES = Object.freeze({
  mouse: 'pointer',
  controller: 'gamepad',
  joystick: 'gamepad',
  'screen-reader': 'assistive',
  'screen_reader': 'assistive',
  keyboard: 'keyboard',
  pointer: 'pointer',
  touch: 'touch',
  gamepad: 'gamepad',
  assistive: 'assistive',
  voice: 'voice',
  synthetic: 'synthetic',
  server: 'server',
  unknown: 'unknown',
});
const SEQUENCE_ALIASES = Object.freeze({
  first: 'first',
  initial: 'first',
  accepted: 'monotonic',
  normal: 'monotonic',
  ordered: 'monotonic',
  in_order: 'monotonic',
  'in-order': 'monotonic',
  monotonic: 'monotonic',
  duplicate: 'duplicate',
  repeat: 'duplicate',
  replay: 'replay',
  reordered: 'reordered',
  'out-of-order': 'reordered',
  out_of_order: 'reordered',
  gap: 'gap',
  reset: 'reset',
  reconnect: 'reconnect',
  unknown: 'unknown',
});

const SENSITIVE_KEY_PATTERN = /(?:^|[_-])(?:uid|user|account|session|token|secret|password|passcode|pin|credential|auth|match|room|payload|body|text|content|message|chat|prompt|trace|stack|coordinate|coords?|position|point|row|column|col|from|to|x|y|z)(?:$|[_-])/i;
const TOKEN_PATTERN = /^[a-z][a-z0-9._:-]{0,47}$/;

function hasOwn(value, key) {
  try {
    return Object.prototype.hasOwnProperty.call(value, key);
  } catch (_error) {
    return false;
  }
}

function isPlainRecord(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  try {
    if (Object.prototype.toString.call(value) !== '[object Object]') return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const constructor = hasOwn(prototype, 'constructor') ? prototype.constructor : null;
    return typeof constructor === 'function' && constructor.name === 'Object';
  } catch (_error) {
    return false;
  }
}

function ownNames(value) {
  try {
    return {
      names: Object.getOwnPropertyNames(value),
      symbols: typeof Object.getOwnPropertySymbols === 'function'
        ? Object.getOwnPropertySymbols(value)
        : [],
    };
  } catch (_error) {
    return null;
  }
}

function ownData(value, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor) return { present: false, ok: true, value: undefined };
    if (!hasOwn(descriptor, 'value')) return { present: true, ok: false, value: undefined };
    return { present: true, ok: true, value: descriptor.value };
  } catch (_error) {
    return { present: true, ok: false, value: undefined };
  }
}

function finiteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeInteger(value, minimum, maximum) {
  return finiteNumber(value)
    && Math.floor(value) === value
    && value >= minimum
    && value <= maximum;
}

function normalizeToken(value, field) {
  if (typeof value !== 'string' || value.length < 1 || value.length > MAX_TOKEN_LENGTH) return null;
  const token = value.trim().toLowerCase();
  if (token !== value || !TOKEN_PATTERN.test(token)) return null;
  if (field === 'actorClass') {
    const normalized = token.replace(/_/g, '-');
    return ACTOR_CLASSES.has(normalized) ? normalized : null;
  }
  return token;
}

function normalizeInputModality(value) {
  const token = normalizeToken(value, 'inputModality');
  if (!token) return null;
  return hasOwn(INPUT_ALIASES, token) ? INPUT_ALIASES[token] : token;
}

function normalizeSequenceClass(value) {
  const token = normalizeToken(value, 'sequenceClass');
  if (!token) return null;
  return hasOwn(SEQUENCE_ALIASES, token) ? SEQUENCE_ALIASES[token] : token;
}

function normalizedKey(value) {
  return String(value).replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase();
}

function readOption(options, key) {
  const field = ownData(options, key);
  return field.ok && field.present ? field.value : undefined;
}

function boundedOption(value, minimum, maximum, fallback) {
  if (!safeInteger(value, minimum, maximum)) return fallback;
  return value;
}

function freeze(value) {
  try {
    return Object.freeze(value);
  } catch (_error) {
    return value;
  }
}

function result(accepted, reason, extra) {
  const output = { accepted: accepted === true, reason: reason || null };
  if (extra && typeof extra === 'object') {
    Object.keys(extra).forEach(key => { output[key] = extra[key]; });
  }
  return freeze(output);
}

function tokenKey(event) {
  return [
    event.gameId,
    event.mode,
    event.actorSlot,
    event.actorClass,
    event.sourceClass,
    event.inputModality,
    event.reconnectEpoch,
  ].join('|');
}

function create(options) {
  const supplied = isPlainRecord(options) ? options : {};
  const enabled = readOption(supplied, 'enabled') === true;
  const capacity = boundedOption(
    readOption(supplied, 'capacity') !== undefined
      ? readOption(supplied, 'capacity')
      : readOption(supplied, 'maxEvents'),
    1,
    MAX_CAPACITY,
    DEFAULT_CAPACITY,
  );
  const ttlMs = boundedOption(
    readOption(supplied, 'ttlMs') !== undefined
      ? readOption(supplied, 'ttlMs')
      : readOption(supplied, 'retentionMs'),
    1,
    MAX_TTL_MS,
    DEFAULT_TTL_MS,
  );
  const configuredClock = readOption(supplied, 'now');
  const clock = typeof configuredClock === 'function' ? configuredClock : Date.now;

  const state = {
    enabled,
    capacity,
    ttlMs,
    clock,
    disposed: false,
    events: [],
    saturated: false,
    totalAccepted: 0,
    totalRejected: 0,
    lastClock: null,
    lastAcceptedAt: null,
    flags: new Set(),
  };

  function readClock() {
    let candidate;
    try {
      candidate = clock();
    } catch (_error) {
      state.flags.add('clock_error');
      candidate = Date.now();
    }
    if (!finiteNumber(candidate) || candidate < 0 || candidate > MAX_SAFE_INTEGER) {
      state.flags.add('clock_error');
      try { candidate = Date.now(); } catch (_error) { candidate = 0; }
    }
    if (!finiteNumber(candidate) || candidate < 0) candidate = 0;
    if (state.lastClock !== null && candidate < state.lastClock) {
      state.flags.add('clock_rollback');
      candidate = state.lastClock;
    }
    if (state.lastClock === null || candidate > state.lastClock) state.lastClock = candidate;
    return state.lastClock;
  }

  function prune(now) {
    let removed = 0;
    while (state.events.length > 0 && now - state.events[0].retainedAt >= state.ttlMs) {
      state.events.shift();
      removed += 1;
    }
    if (removed > 0) state.flags.add('ttl_pruned');
    return removed;
  }

  function parseSummary(input) {
    if (!isPlainRecord(input)) return { ok: false, reason: 'invalid_record' };
    const properties = ownNames(input);
    if (!properties || properties.symbols.length > 0) return { ok: false, reason: 'unsupported_field' };
    for (const key of properties.names) {
      if (!SUMMARY_FIELD_SET.has(key)) {
        return {
          ok: false,
          reason: SENSITIVE_KEY_PATTERN.test(normalizedKey(key)) ? 'sensitive_field' : 'unsupported_field',
        };
      }
    }
    for (const key of SUMMARY_FIELDS) {
      const field = ownData(input, key);
      if (!field.ok || !field.present) return { ok: false, reason: field.ok ? 'missing_field' : 'unreadable_field' };
    }

    const gameId = normalizeToken(ownData(input, 'gameId').value, 'gameId');
    const mode = normalizeToken(ownData(input, 'mode').value, 'mode');
    const actorClass = normalizeToken(ownData(input, 'actorClass').value, 'actorClass');
    const sourceClass = normalizeToken(ownData(input, 'sourceClass').value, 'sourceClass');
    const actionClass = normalizeToken(ownData(input, 'actionClass').value, 'actionClass');
    const sequenceClass = normalizeSequenceClass(ownData(input, 'sequenceClass').value);
    const inputModality = normalizeInputModality(ownData(input, 'inputModality').value);
    const actorSlot = ownData(input, 'actorSlot').value;
    const acceptedAt = ownData(input, 'acceptedAt').value;
    const reconnectEpoch = ownData(input, 'reconnectEpoch').value;

    if (!gameId || !mode || !actorClass || !sourceClass || !actionClass || !sequenceClass || !inputModality) {
      return { ok: false, reason: 'invalid_category' };
    }
    if (!safeInteger(actorSlot, -1, 5)) return { ok: false, reason: 'invalid_actor_slot' };
    if (!finiteNumber(acceptedAt) || acceptedAt < 0 || acceptedAt > MAX_SAFE_INTEGER) {
      return { ok: false, reason: 'invalid_timestamp' };
    }
    if (!safeInteger(reconnectEpoch, 0, MAX_SAFE_INTEGER)) return { ok: false, reason: 'invalid_reconnect_epoch' };

    return {
      ok: true,
      value: freeze({
        gameId,
        mode,
        actorSlot,
        actorClass,
        sourceClass,
        actionClass,
        acceptedAt,
        sequenceClass,
        reconnectEpoch,
        inputModality,
      }),
    };
  }

  function record(input) {
    if (state.disposed) return result(false, 'disposed');
    if (!state.enabled) return result(false, 'disabled');
    try {
      const now = readClock();
      prune(now);
      const parsed = parseSummary(input);
      if (!parsed.ok) {
        state.totalRejected += 1;
        return result(false, parsed.reason);
      }

      const summary = parsed.value;
      let effectiveAcceptedAt = summary.acceptedAt;
      if (state.lastAcceptedAt !== null && effectiveAcceptedAt < state.lastAcceptedAt) {
        state.flags.add('clock_rollback');
        effectiveAcceptedAt = state.lastAcceptedAt;
      }
      if (state.lastAcceptedAt === null || effectiveAcceptedAt > state.lastAcceptedAt) {
        state.lastAcceptedAt = effectiveAcceptedAt;
      }
      const event = freeze({
        gameId: summary.gameId,
        mode: summary.mode,
        actorSlot: summary.actorSlot,
        actorClass: summary.actorClass,
        sourceClass: summary.sourceClass,
        actionClass: summary.actionClass,
        acceptedAt: effectiveAcceptedAt,
        sequenceClass: summary.sequenceClass,
        reconnectEpoch: summary.reconnectEpoch,
        inputModality: summary.inputModality,
        retainedAt: now,
      });
      if (state.events.length >= state.capacity) {
        state.events.shift();
        state.saturated = true;
        state.flags.add('capacity_saturated');
      }
      state.events.push(event);
      state.totalAccepted += 1;
      return result(true, null, { summary });
    } catch (_error) {
      // Observation is intentionally non-blocking.  A malformed host object
      // must not make the gameplay caller fail.
      state.flags.add('observation_error');
      state.totalRejected += 1;
      return result(false, 'observation_error');
    }
  }

  function metricReasonList(eventCount, transitions, repeatTransitions, entropyApplicable) {
    const reasons = [];
    if (eventCount === 0) reasons.push('no_observations');
    if (!entropyApplicable) reasons.push('entropy_not_applicable');
    if (state.flags.has('ttl_pruned')) reasons.push('ttl_pruned');
    if (state.flags.has('capacity_saturated')) reasons.push('capacity_saturated');
    if (state.flags.has('clock_rollback')) reasons.push('clock_rollback');
    if (state.flags.has('clock_error')) reasons.push('clock_error');
    if (state.flags.has('observation_error')) reasons.push('observation_error');
    if (transitions === 0 && eventCount > 1 && repeatTransitions === 0) reasons.push('no_transitions');
    return reasons;
  }

  function snapshot() {
    try {
      if (state.disposed) {
        return freeze({
          auditOnly: true,
          enabled: false,
          status: 'disposed',
          capacity: state.capacity,
          ttlMs: state.ttlMs,
          saturated: false,
          acceptedCount: 0,
          transitionCount: 0,
          repeatRatio: 0,
          observedMs: 0,
          APM: 0,
          entropy: 0,
          entropyApplicable: false,
          confidence: 0,
          reasons: freeze(['disposed']),
        });
      }
      const now = readClock();
      prune(now);
      const events = state.events;
      const acceptedCount = events.length;
      let transitionCount = 0;
      let repeatTransitions = 0;
      let firstAt = null;
      let lastAt = null;
      const counts = new Map();
      for (let index = 0; index < events.length; index += 1) {
        const event = events[index];
        if (firstAt === null || event.acceptedAt < firstAt) firstAt = event.acceptedAt;
        if (lastAt === null || event.acceptedAt > lastAt) lastAt = event.acceptedAt;
        counts.set(event.actionClass, (counts.get(event.actionClass) || 0) + 1);
        if (index === 0) continue;
        const previous = events[index - 1];
        const sameContext = tokenKey(previous) === tokenKey(event);
        const reconnectBoundary = previous.reconnectEpoch !== event.reconnectEpoch
          || previous.sequenceClass === 'reconnect'
          || event.sequenceClass === 'reconnect'
          || previous.sourceClass === 'reconnect'
          || event.sourceClass === 'reconnect';
        if (!sameContext || reconnectBoundary) {
          if (reconnectBoundary) state.flags.add('reconnect_boundary');
          continue;
        }
        if (previous.actionClass === event.actionClass) repeatTransitions += 1;
        else transitionCount += 1;
      }

      const observedMs = firstAt === null || lastAt === null ? 0 : Math.max(0, lastAt - firstAt);
      const denominator = Math.max(0, acceptedCount - 1);
      const repeatRatio = denominator > 0 ? repeatTransitions / denominator : 0;
      const entropyApplicable = acceptedCount >= 2;
      let entropy = 0;
      if (entropyApplicable && acceptedCount > 0) {
        counts.forEach(count => {
          const probability = count / acceptedCount;
          entropy -= probability * Math.log2(probability);
        });
      }
      const APM = observedMs > 0 ? Math.min(100000, (acceptedCount * 60000) / observedMs) : 0;
      let confidence = Math.min(1, acceptedCount / 20);
      if (observedMs < 1000 && acceptedCount > 0) confidence *= 0.75;
      if (state.saturated) confidence *= 0.8;
      if (state.flags.has('clock_rollback') || state.flags.has('clock_error')) confidence *= 0.75;
      confidence = Math.max(0, Math.min(1, confidence));
      const reasons = metricReasonList(acceptedCount, transitionCount, repeatTransitions, entropyApplicable);
      const output = {
        auditOnly: true,
        enabled: state.enabled,
        status: state.enabled ? 'enabled' : 'disabled',
        capacity: state.capacity,
        ttlMs: state.ttlMs,
        saturated: state.saturated,
        acceptedCount,
        transitionCount,
        repeatRatio,
        observedMs,
        APM,
        entropy,
        entropyApplicable,
        confidence,
        reasons: freeze(reasons),
      };
      // Keep a richer interval available to callers without changing the
      // deliberately small enumerable report shape.
      Object.defineProperty(output, 'confidenceInterval', {
        value: freeze({ lower: Math.max(0, confidence - 0.1), upper: Math.min(1, confidence + 0.1) }),
        enumerable: false,
        configurable: false,
        writable: false,
      });
      Object.defineProperty(output, 'totalAccepted', {
        value: state.totalAccepted,
        enumerable: false,
        configurable: false,
        writable: false,
      });
      return freeze(output);
    } catch (_error) {
      // Keep the fail-open contract even if a host replaces a built-in.
      state.flags.add('observation_error');
      return freeze({
        auditOnly: true,
        enabled: state.enabled,
        status: state.enabled ? 'enabled' : 'disabled',
        capacity: state.capacity,
        ttlMs: state.ttlMs,
        saturated: state.saturated,
        acceptedCount: 0,
        transitionCount: 0,
        repeatRatio: 0,
        observedMs: 0,
        APM: 0,
        entropy: 0,
        entropyApplicable: false,
        confidence: 0,
        reasons: freeze(['observation_error']),
      });
    }
  }

  function reset() {
    if (state.disposed) return result(false, 'disposed');
    const cleared = state.events.length;
    state.events.length = 0;
    state.saturated = false;
    state.totalAccepted = 0;
    state.totalRejected = 0;
    state.lastAcceptedAt = null;
    state.flags.clear();
    // Preserve a monotonic wall clock across reset; callers may reuse a
    // deterministic clock and should not get a negative TTL interval.
    return result(true, null, { cleared });
  }

  function dispose() {
    if (!state.disposed) {
      state.disposed = true;
      state.enabled = false;
      state.events.length = 0;
      state.saturated = false;
      state.totalAccepted = 0;
      state.totalRejected = 0;
      state.lastAcceptedAt = null;
      state.flags.clear();
    }
    return freeze({ status: 'disposed' });
  }

  const api = { record, snapshot, reset, dispose };
  // Non-enumerable aliases make migration from adjacent naming conventions
  // harmless while keeping one intentionally narrow visible interface.
  Object.defineProperties(api, {
    observe: { value: record },
    accept: { value: record },
    ingest: { value: record },
    analyze: { value: record },
    report: { value: snapshot },
    clear: { value: reset },
  });
  return freeze(api);
}

const exported = { create };
Object.defineProperties(exported, {
  createEngagementIntegrityAnalyzer: { value: create },
  EngagementIntegrityAnalyzer: { value: create },
  SUMMARY_FIELDS: { value: SUMMARY_FIELDS },
  DEFAULT_TTL_MS: { value: DEFAULT_TTL_MS },
  DEFAULT_CAPACITY: { value: DEFAULT_CAPACITY },
});

module.exports = freeze(exported);
