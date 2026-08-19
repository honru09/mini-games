/*
 * FeedbackBus
 *
 * A default-off semantic feedback seam.  It accepts a deliberately small
 * cue vocabulary and synchronously fans immutable cue records out to local
 * adapters.  A stable semantic cue id is deduplicated locally and a bounded
 * receive-time window limits bursts without scheduling work.  Browser
 * capability detection and the actual sound or haptic work stay outside this
 * module, so a failure there cannot affect gameplay.
 */
(function installFeedbackBus(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else if (root) {
    root.FeedbackBus = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createFeedbackBusModule() {
  'use strict';

  var MAX_QUEUE = 16;
  var MAX_LISTENERS = 8;
  var MAX_CUE_IDS = 64;
  var RATE_WINDOW_MS = 1000;
  var MAX_CUES_PER_WINDOW = 32;
  // The vocabulary is deliberately presentation-only.  It is broader than
  // the original T3 pilot so the platform, six games and result surfaces can
  // share one seam without teaching callers about Web Audio or vendors.
  var EVENT_TYPES = Object.freeze([
    'ui_confirm', 'ui_cancel', 'ui_error', 'ui_toggle', 'ui_test',
    'settings_change', 'shop_purchase', 'shop_error', 'equip_change',
    'social_update', 'social_error', 'playline_post', 'playline_error',
    'expression_received', 'match_chat_incoming', 'match_chat_sent', 'daily_claim', 'profile_saved',
    'auth_success', 'auth_error', 'route_enter', 'game_select',
    'room_joined', 'peer_join', 'peer_leave', 'ready', 'host_changed',
    'reconnect_ok', 'reconnect_failed', 'offline_enter', 'online_restore',
    'chat_incoming', 'chat_sent', 'chat_unread',
    'reward_win', 'reward_draw', 'reward_loss', 'coins_gain', 'xp_gain',
    'level_up', 'achievement_unlock',
    'match_countdown', 'match_start', 'turn_self', 'turn_opponent',
    'match_pause', 'match_resume', 'match_timeout', 'match_surrender',
    'match_draw', 'match_win', 'match_loss', 'match_terminal',
    'gomoku_place', 'gomoku_line',
    'ludo_roll', 'ludo_move', 'ludo_capture', 'ludo_home',
    'monopoly_roll', 'monopoly_land', 'monopoly_purchase',
    'monopoly_pay', 'monopoly_auction', 'monopoly_bankrupt',
    'tank_move', 'tank_fire', 'tank_hit', 'tank_ko', 'tank_respawn',
    'tetris_move', 'tetris_rotate', 'tetris_soft_drop', 'tetris_hard_drop',
    'tetris_lock', 'tetris_line_clear', 'tetris_garbage', 'tetris_ko',
    'xiangqi_select', 'xiangqi_move', 'xiangqi_capture', 'xiangqi_check',
    'xiangqi_checkmate', 'xiangqi_clock_low'
  ]);
  var SPATIAL_TYPES = Object.freeze(['tank_fire', 'tank_hit', 'tank_ko']);
  var ENVIRONMENT_FIELDS = Object.freeze([
    'enabled', 'hidden', 'reducedMotion', 'reducedEffects',
    'muted', 'audioEnabled', 'hapticsEnabled'
  ]);
  var EVENT_FIELDS = Object.freeze(['type', 'id', 'intensity', 'pan']);
  var ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
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

  function finiteNumber(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function freeze(value) {
    return Object.freeze(value);
  }

  function baseEnvironment() {
    return {
      enabled: false,
      hidden: false,
      reducedMotion: false,
      reducedEffects: false,
      muted: false,
      audioEnabled: false,
      hapticsEnabled: false
    };
  }

  function copyEnvironment(value) {
    return {
      enabled: value.enabled === true,
      hidden: value.hidden === true,
      reducedMotion: value.reducedMotion === true,
      reducedEffects: value.reducedEffects === true,
      muted: value.muted === true,
      audioEnabled: value.audioEnabled === true,
      hapticsEnabled: value.hapticsEnabled === true
    };
  }

  function sameEnvironment(left, right) {
    for (var index = 0; index < ENVIRONMENT_FIELDS.length; index += 1) {
      var field = ENVIRONMENT_FIELDS[index];
      if (left[field] !== right[field]) return false;
    }
    return true;
  }

  function applyEnvironmentPatch(current, patch) {
    if (!isPlainRecord(patch)) return { ok: false, reason: 'invalid_environment' };
    var names = safeNames(patch);
    if (!names || names.symbols.length) return { ok: false, reason: 'invalid_environment' };
    var next = copyEnvironment(current);
    for (var index = 0; index < names.names.length; index += 1) {
      var key = names.names[index];
      if (!contains(ENVIRONMENT_FIELDS, key)) return { ok: false, reason: sensitiveKey(key) ? 'sensitive_field' : 'invalid_environment' };
      var field = ownData(patch, key);
      if (!field.ok || typeof field.value !== 'boolean') return { ok: false, reason: 'invalid_environment' };
      next[key] = field.value;
    }
    return { ok: true, value: next };
  }

  function normalizeEvent(input) {
    if (!isPlainRecord(input)) return { ok: false, reason: 'invalid_event' };
    var names = safeNames(input);
    if (!names || names.symbols.length) return { ok: false, reason: 'invalid_event' };
    for (var index = 0; index < names.names.length; index += 1) {
      var key = names.names[index];
      if (!contains(EVENT_FIELDS, key)) return { ok: false, reason: sensitiveKey(key) ? 'sensitive_field' : 'unsupported_field' };
    }

    var type = ownData(input, 'type');
    if (!type.ok || typeof type.value !== 'string' || !contains(EVENT_TYPES, type.value)) {
      return { ok: false, reason: 'unsupported_type' };
    }
    var id = ownData(input, 'id');
    if (!id.ok || !id.present || typeof id.value !== 'string' || !ID_PATTERN.test(id.value)) {
      return { ok: false, reason: 'invalid_id' };
    }

    var intensity = ownData(input, 'intensity');
    var intensityValue = 1;
    if (!intensity.ok) return { ok: false, reason: 'invalid_intensity' };
    if (intensity.present) {
      if (!finiteNumber(intensity.value) || intensity.value < 0 || intensity.value > 1) {
        return { ok: false, reason: 'invalid_intensity' };
      }
      intensityValue = intensity.value;
    }

    var pan = ownData(input, 'pan');
    var panValue = 0;
    if (!pan.ok) return { ok: false, reason: 'invalid_pan' };
    if (pan.present) {
      if (!finiteNumber(pan.value) || pan.value < -1 || pan.value > 1) return { ok: false, reason: 'invalid_pan' };
      panValue = pan.value;
    }
    if (!contains(SPATIAL_TYPES, type.value) && panValue !== 0) return { ok: false, reason: 'invalid_pan' };

    return { ok: true, value: freeze({ type: type.value, id: id.value, intensity: intensityValue, pan: panValue }) };
  }

  function inactiveReason(state) {
    if (state.disposed) return 'disposed';
    if (!state.environment.enabled) return 'disabled';
    if (state.environment.hidden) return 'hidden';
    if (state.environment.reducedEffects) return 'reduced_effects';
    if (!state.environment.audioEnabled && !state.environment.hapticsEnabled) return 'silent';
    if (state.environment.muted && !state.environment.hapticsEnabled) return 'silent';
    return null;
  }

  function create(options) {
    var state = {
      disposed: false,
      generation: 0,
      environment: baseEnvironment(),
      queue: [],
      listeners: [],
      draining: false,
      cueIds: [],
      cueTimes: [],
      lastNow: 0
    };
    var initialOptions = isPlainRecord(options) ? options : null;
    var clock = null;
    if (initialOptions) {
      var initialEnvironment = ownData(initialOptions, 'environment');
      if (initialEnvironment.ok && initialEnvironment.present) {
        var parsedInitial = applyEnvironmentPatch(state.environment, initialEnvironment.value);
        if (parsedInitial.ok) state.environment = parsedInitial.value;
      }
      var initialClock = ownData(initialOptions, 'now');
      if (initialClock.ok && typeof initialClock.value === 'function') clock = initialClock.value;
    }
    state.lastNow = readClock(clock, Date.now());

    function now() {
      var candidate = readClock(clock, Date.now());
      if (candidate > state.lastNow) state.lastNow = candidate;
      return state.lastNow;
    }

    function forgetOldCueTimes(currentNow) {
      while (state.cueTimes.length && currentNow - state.cueTimes[0] > RATE_WINDOW_MS) state.cueTimes.shift();
    }

    function rememberCueId(id) {
      state.cueIds.push(id);
      while (state.cueIds.length > MAX_CUE_IDS) state.cueIds.shift();
    }

    function result(accepted, reason, dispatched, failed) {
      return freeze({
        accepted: accepted === true,
        reason: reason || null,
        generation: state.generation,
        dispatched: dispatched || 0,
        failed: failed || 0
      });
    }

    function deliveryFor(event, generation) {
      return freeze({
        type: event.type,
        id: event.id,
        intensity: event.intensity,
        pan: event.pan,
        channels: freeze({
          audio: state.environment.audioEnabled && !state.environment.muted,
          haptic: state.environment.hapticsEnabled
        }),
        reducedMotion: state.environment.reducedMotion,
        generation: generation
      });
    }

    function drain() {
      if (state.draining) return { dispatched: 0, failed: 0 };
      state.draining = true;
      var dispatched = 0;
      var failed = 0;
      try {
        while (state.queue.length && !state.disposed) {
          if (inactiveReason(state)) {
            state.queue.length = 0;
            break;
          }
          var entry = state.queue.shift();
          var entryGeneration = state.generation;
          var listeners = state.listeners.slice();
          var delivery = deliveryFor(entry, entryGeneration);
          for (var index = 0; index < listeners.length; index += 1) {
            if (state.disposed || state.generation !== entryGeneration) {
              state.queue.length = 0;
              break;
            }
            var listener = listeners[index];
            if (state.listeners.indexOf(listener) === -1) continue;
            try {
              listener(delivery);
              dispatched += 1;
            } catch (_error) {
              failed += 1;
            }
          }
          if (state.disposed || state.generation !== entryGeneration) break;
        }
      } finally {
        state.draining = false;
      }
      return { dispatched: dispatched, failed: failed };
    }

    function emit(event) {
      var inactive = inactiveReason(state);
      if (inactive) return result(false, inactive);
      var parsed = normalizeEvent(event);
      if (!parsed.ok) return result(false, parsed.reason);
      var currentNow = now();
      forgetOldCueTimes(currentNow);
      if (state.cueIds.indexOf(parsed.value.id) !== -1) return result(false, 'duplicate');
      if (state.cueTimes.length >= MAX_CUES_PER_WINDOW) return result(false, 'rate_limited');
      if (state.queue.length >= MAX_QUEUE) return result(false, 'queue_full');
      rememberCueId(parsed.value.id);
      state.cueTimes.push(currentNow);
      state.queue.push(parsed.value);
      var drained = drain();
      return result(true, null, drained.dispatched, drained.failed);
    }

    function subscribe(listener) {
      if (state.disposed || typeof listener !== 'function' || state.listeners.length >= MAX_LISTENERS) {
        return function ignoredUnsubscribe() { return false; };
      }
      var active = true;
      state.listeners.push(listener);
      return function unsubscribe() {
        if (!active) return false;
        active = false;
        var index = state.listeners.indexOf(listener);
        if (index !== -1) state.listeners.splice(index, 1);
        return true;
      };
    }

    function setEnvironment(patch) {
      if (state.disposed) return result(false, 'disposed');
      var parsed = applyEnvironmentPatch(state.environment, patch);
      if (!parsed.ok) return result(false, parsed.reason);
      if (!sameEnvironment(state.environment, parsed.value)) {
        state.environment = parsed.value;
        state.generation += 1;
        state.queue.length = 0;
        state.cueIds.length = 0;
        state.cueTimes.length = 0;
      }
      return result(true, null);
    }

    function dispose() {
      if (!state.disposed) {
        state.disposed = true;
        state.generation += 1;
        state.queue.length = 0;
        state.listeners.length = 0;
        state.cueIds.length = 0;
        state.cueTimes.length = 0;
      }
      return freeze({ status: 'disposed', generation: state.generation, queued: 0, listeners: 0 });
    }

    return freeze({ emit: emit, subscribe: subscribe, setEnvironment: setEnvironment, dispose: dispose });
  }

  function readClock(clock, fallback) {
    var value = fallback;
    if (clock) {
      try { value = clock(); } catch (_error) { value = fallback; }
    }
    return typeof value === 'number' && isFinite(value) && value >= 0 ? Math.floor(value) : fallback;
  }

  return freeze({ create: create });
}));
