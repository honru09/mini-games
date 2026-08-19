/*
 * GhostAudioRuntime
 *
 * Browser-owned lifecycle bridge for the presentation-only audio seam.
 * FeedbackBus remains the only event vocabulary and UnifiedFeedbackAdapter
 * remains the only WebAudio implementation.  This module owns no game,
 * authority, replay, reward, chat or server state.
 */
(function installGhostAudioRuntime(root) {
  'use strict';

  var STORAGE_KEYS = Object.freeze([
    'mg_audio_sfx', 'mg_audio_music', 'mg_audio_haptics',
    'mg_audio_spatial', 'mg_audio_reduced_effects',
    'mg_audio_sfx_volume', 'mg_audio_music_volume',
    'mg_audio_haptics_volume', 'mg_audio_master_volume'
  ]);
  var DEFAULTS = Object.freeze({
    mg_audio_sfx: true,
    mg_audio_music: false,
    mg_audio_haptics: true,
    mg_audio_spatial: true,
    mg_audio_reduced_effects: false,
    mg_audio_sfx_volume: 0.72,
    mg_audio_music_volume: 0.22,
    mg_audio_haptics_volume: 1,
    mg_audio_master_volume: 1
  });
  var BOOLEAN_KEYS = Object.freeze([
    'mg_audio_sfx', 'mg_audio_music', 'mg_audio_haptics',
    'mg_audio_spatial', 'mg_audio_reduced_effects'
  ]);
  var NUMBER_KEYS = Object.freeze([
    'mg_audio_sfx_volume', 'mg_audio_music_volume',
    'mg_audio_haptics_volume', 'mg_audio_master_volume'
  ]);
  var TRACKS = Object.freeze({ home: true, game: true, result: true });
  var runtime = null;

  function freeze(value) { return Object.freeze(value); }
  function finite(value) { return typeof value === 'number' && isFinite(value); }
  function clamp(value, lo, hi, fallback) {
    return finite(value) ? Math.max(lo, Math.min(hi, value)) : fallback;
  }
  function thenable(value) {
    return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
  }
  function safeStorage() {
    try {
      return typeof localStorage !== 'undefined' && localStorage ? localStorage : null;
    } catch (_error) { return null; }
  }
  function readSettings() {
    var result = {};
    STORAGE_KEYS.forEach(function (key) { result[key] = DEFAULTS[key]; });
    var storage = safeStorage();
    if (!storage) return result;
    BOOLEAN_KEYS.forEach(function (key) {
      try {
        var value = storage.getItem(key);
        if (value === '1' || value === 'true') result[key] = true;
        else if (value === '0' || value === 'false') result[key] = false;
      } catch (_error) {}
    });
    NUMBER_KEYS.forEach(function (key) {
      try {
        var raw = storage.getItem(key);
        if (raw !== null && raw !== '') {
          var value = Number(raw);
           // Persisted preferences are a trust boundary.  An out-of-range or
           // non-finite value is malformed and falls back atomically; it is not
           // silently repaired by clamping (which could turn corruption into a
           // valid but unintended preference).
           if (finite(value) && value >= 0 && value <= 1) result[key] = value;
        }
      } catch (_error) {}
    });
    return result;
  }
  function saveSettings(settings) {
    var storage = safeStorage();
    if (!storage) return false;
    try {
      STORAGE_KEYS.forEach(function (key) {
        var value = settings[key];
        storage.setItem(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      });
      return true;
    } catch (_error) { return false; }
  }
  function copySettings(settings) {
    var result = {};
    STORAGE_KEYS.forEach(function (key) { result[key] = settings[key]; });
    return result;
  }
  function normalizePatch(patch, current) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return null;
    var next = copySettings(current);
    var keys = Object.keys(patch);
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (STORAGE_KEYS.indexOf(key) === -1) continue;
      var value = patch[key];
      if (BOOLEAN_KEYS.indexOf(key) !== -1) {
        if (typeof value !== 'boolean') return null;
        next[key] = value;
      } else {
        if (!finite(value) || value < 0 || value > 1) return null;
        next[key] = value;
      }
    }
    return next;
  }
  function reducedMotion() {
    try {
      return typeof matchMedia === 'function' && !!matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_error) { return false; }
  }
  function contextFactory() {
    try {
      var AC = (typeof AudioContext !== 'undefined' && AudioContext) ||
        (typeof webkitAudioContext !== 'undefined' && webkitAudioContext);
      return AC ? new AC() : null;
    } catch (_error) { return null; }
  }
  function vibrate(duration) {
    try {
      return typeof navigator !== 'undefined' && navigator && typeof navigator.vibrate === 'function'
        ? navigator.vibrate(duration)
        : false;
    } catch (_error) { return false; }
  }
  function safeCall(fn) {
    try { return typeof fn === 'function' ? fn() : null; } catch (_error) { return null; }
  }

  function createRuntime(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var settings = readSettings();
    var bus = null;
    var adapter = null;
    var cueSequence = 0;
    var initialized = false;
    var unlocked = false;
    var currentTrack = null;
    var listeners = [];
    var mediaQuery = null;

    function busEnvironment(hidden) {
      return {
        enabled: true,
        hidden: hidden === true,
        reducedMotion: reducedMotion(),
         // FeedbackBus remains able to deliver critical cues while the
         // adapter applies the selective Reduced Effects policy.  Setting this
         // true on the bus would drop errors/terminal/result cues globally.
         reducedEffects: false,
        muted: false,
        audioEnabled: settings.mg_audio_sfx === true || settings.mg_audio_music === true,
        hapticsEnabled: settings.mg_audio_haptics === true
      };
    }
    function adapterSettings(environment) {
      var lifecycle = environment || busEnvironment(false);
      return {
        mg_audio_sfx: settings.mg_audio_sfx,
        mg_audio_music: settings.mg_audio_music,
        mg_audio_haptics: settings.mg_audio_haptics,
        mg_audio_spatial: settings.mg_audio_spatial,
        mg_audio_reduced_effects: settings.mg_audio_reduced_effects,
        hidden: lifecycle.hidden,
        reducedMotion: lifecycle.reducedMotion,
        reducedEffects: settings.mg_audio_reduced_effects === true,
        muted: lifecycle.muted,
        audioEnabled: lifecycle.audioEnabled,
        hapticsEnabled: lifecycle.hapticsEnabled,
        sfxVolume: settings.mg_audio_sfx_volume,
        musicVolume: settings.mg_audio_music_volume,
        hapticsVolume: settings.mg_audio_haptics_volume,
        masterVolume: settings.mg_audio_master_volume
      };
    }
    function ensure() {
      if (initialized) return !!bus && !!adapter;
      initialized = true;
      if (typeof FeedbackBus === 'undefined' || !FeedbackBus || typeof FeedbackBus.create !== 'function' ||
          typeof UnifiedFeedbackAdapter === 'undefined' || !UnifiedFeedbackAdapter ||
          typeof UnifiedFeedbackAdapter.create !== 'function') return false;
      try {
        bus = FeedbackBus.create({ environment: busEnvironment(false) });
        adapter = UnifiedFeedbackAdapter.create({
          enabled: true,
          bus: bus,
          settings: settings,
          audioContextFactory: opts.audioContextFactory || contextFactory,
          vibrate: opts.vibrate || vibrate
        });
      } catch (_error) {
        bus = null; adapter = null; return false;
      }
      return !!bus && !!adapter;
    }
    function addListener(target, event, handler, options) {
      if (!target || typeof target.addEventListener !== 'function') return;
      target.addEventListener(event, handler, options);
      listeners.push(function remove() {
        try { target.removeEventListener(event, handler, options); } catch (_error) {}
      });
    }
    function unlock() {
      if (!ensure() || !adapter || typeof adapter.unlock !== 'function') return freeze({ accepted: false, reason: 'unavailable' });
      var expectedAdapter = adapter;
      var result = safeCall(function () { return adapter.unlock(); });
      function settle(outcome) {
        if (!outcome || outcome.accepted !== true) {
          unlocked = false;
          return outcome || freeze({ accepted: false, reason: 'unavailable' });
        }
        if (adapter !== expectedAdapter || !initialized) return freeze({ accepted: false, reason: 'stale_unlock' });
        unlocked = true;
        var hidden = typeof document !== 'undefined' && document.hidden === true;
        if (!hidden && currentTrack && settings.mg_audio_music) safeCall(function () { return adapter.playMusic(currentTrack); });
        return outcome;
      }
      if (thenable(result)) {
        try {
          var pending = result.then(settle, function () { unlocked = false; return freeze({ accepted: false, reason: 'resume_failed' }); });
          try { pending.accepted = false; pending.reason = 'resume_pending'; } catch (_pendingMutationError) {}
          return pending;
        }
        catch (_error) { unlocked = false; return freeze({ accepted: false, reason: 'resume_failed' }); }
      }
      return settle(result);
    }
    function sync(hidden) {
      if (!ensure()) return false;
      var environment = busEnvironment(hidden);
      safeCall(function () { return bus.setEnvironment(environment); });
      safeCall(function () { return adapter.setLifecycle(adapterSettings(environment)); });
      return true;
    }
    function stopMusicVoice() {
      if (!adapter) return freeze({ accepted: true, reason: null });
      return safeCall(function () { return adapter.stopMusic(); }) || freeze({ accepted: false, reason: 'error' });
    }
    function setPreferences(patch) {
      if (!ensure()) return freeze({ accepted: false, reason: 'unavailable' });
      var next = normalizePatch(patch, settings);
      if (!next) return freeze({ accepted: false, reason: 'invalid_preferences' });
      settings = next;
      saveSettings(settings);
      var hidden = typeof document !== 'undefined' && document.hidden === true;
      sync(hidden);
      if (!settings.mg_audio_music) stopMusicVoice();
      else if (!hidden && unlocked && currentTrack) safeCall(function () { return adapter.playMusic(currentTrack); });
      return freeze({ accepted: true, settings: freeze(copySettings(settings)) });
    }
    function emit(type, options) {
      if (!ensure() || !bus || typeof bus.emit !== 'function') return freeze({ accepted: false, reason: 'unavailable' });
      var opts = options && typeof options === 'object' ? options : {};
      var id = typeof opts.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/.test(opts.id)
        ? opts.id : 'audio-' + (++cueSequence);
      var event = { type: String(type || ''), id: id };
      if (finite(opts.intensity)) event.intensity = Math.max(0, Math.min(1, opts.intensity));
      if (finite(opts.pan) && settings.mg_audio_spatial) event.pan = Math.max(-1, Math.min(1, opts.pan));
      return safeCall(function () { return bus.emit(event); }) || freeze({ accepted: false, reason: 'error' });
    }
    function testTone() {
      var unlockedResult = unlock();
      function emitAfterUnlock(outcome) {
        if (!outcome || outcome.accepted !== true) return outcome || freeze({ accepted: false, reason: 'unavailable' });
        return emit('ui_test', { id: 'audio-test-' + (++cueSequence), intensity: .8 });
      }
      if (thenable(unlockedResult)) {
        try {
          var pending = unlockedResult.then(emitAfterUnlock);
          try { pending.accepted = false; pending.reason = 'resume_pending'; } catch (_pendingMutationError2) {}
          return pending;
        }
        catch (_error) { return freeze({ accepted: false, reason: 'resume_failed' }); }
      }
      return emitAfterUnlock(unlockedResult);
    }
    function playMusic(track) {
      var safeTrack = TRACKS[track] ? track : 'home';
      currentTrack = safeTrack;
      if (!ensure() || !settings.mg_audio_music || !unlocked) return freeze({ accepted: false, reason: 'inactive' });
      return safeCall(function () { return adapter.playMusic(safeTrack); }) || freeze({ accepted: false, reason: 'error' });
    }
    function stopMusic() {
      currentTrack = null;
      return stopMusicVoice();
    }
    function reset() {
      if (!ensure() || !adapter || !bus) return freeze({ accepted: false, reason: 'unavailable' });
      // Keep lifecycle listeners and the current AudioContext retry path, but
      // clear both presentation state and FeedbackBus's bounded queue/dedupe
      // window.  A brief disabled generation is the narrow public reset seam;
      // it does not touch game rules, authority, protocol, reward or replay.
      safeCall(function () { return adapter.reset && adapter.reset(); });
      var hidden = typeof document !== 'undefined' && document.hidden === true;
      safeCall(function () { return bus.setEnvironment({ enabled: false }); });
      safeCall(function () { return bus.setEnvironment(busEnvironment(hidden)); });
      safeCall(function () { return adapter.setLifecycle(adapterSettings(busEnvironment(hidden))); });
      currentTrack = null;
      cueSequence = 0;
      var adapterState = adapter && typeof adapter.snapshot === 'function' ? adapter.snapshot() : null;
      unlocked = !!(adapterState && adapterState.unlocked === true);
      return freeze({ accepted: true, reason: null });
    }
    function setLifecycle(hidden) {
      if (!ensure()) return false;
      sync(hidden === true);
      if (hidden === true) stopMusicVoice();
      else if (unlocked && settings.mg_audio_music && currentTrack) playMusic(currentTrack);
      return true;
    }
    function installLifecycle() {
      if (typeof document !== 'undefined') {
        addListener(document, 'pointerdown', function onFirstPointer() { unlock(); }, { capture: true, passive: true });
        addListener(document, 'touchstart', function onFirstTouch() { unlock(); }, { capture: true, passive: true });
        addListener(document, 'keydown', function onFirstKey() { unlock(); }, { capture: true });
        addListener(document, 'visibilitychange', function onVisibility() { setLifecycle(document.hidden === true); });
      }
      if (typeof window !== 'undefined') {
        addListener(window, 'pageshow', function onPageShow() { setLifecycle(false); });
        addListener(window, 'pagehide', function onPageHide() { setLifecycle(true); });
      }
      try {
        if (typeof matchMedia === 'function') {
          mediaQuery = matchMedia('(prefers-reduced-motion: reduce)');
          if (mediaQuery && typeof mediaQuery.addEventListener === 'function') {
            var onMedia = function () { sync(typeof document !== 'undefined' && document.hidden === true); };
            mediaQuery.addEventListener('change', onMedia);
            listeners.push(function () { try { mediaQuery.removeEventListener('change', onMedia); } catch (_error) {} });
          }
        }
      } catch (_error) {}
    }
    function init() {
      ensure();
      if (initialized && listeners.length === 0) installLifecycle();
      sync(typeof document !== 'undefined' && document.hidden === true);
      return snapshot();
    }
    function snapshot() {
      return freeze({
        initialized: initialized,
        unlocked: unlocked,
        track: currentTrack,
        settings: freeze(copySettings(settings)),
        adapter: adapter && typeof adapter.snapshot === 'function' ? adapter.snapshot() : null
      });
    }
    function dispose() {
      listeners.splice(0).forEach(function (remove) { safeCall(remove); });
      if (adapter && typeof adapter.dispose === 'function') safeCall(function () { return adapter.dispose(); });
      if (bus && typeof bus.dispose === 'function') safeCall(function () { return bus.dispose(); });
      adapter = null; bus = null; initialized = false; unlocked = false; currentTrack = null; mediaQuery = null;
      return snapshot();
    }
    return freeze({ init: init, unlock: unlock, emit: emit, testTone: testTone, setPreferences: setPreferences,
      getPreferences: function () { return freeze(copySettings(settings)); }, setLifecycle: setLifecycle,
      playMusic: playMusic, stopMusic: stopMusic, reset: reset, snapshot: snapshot, dispose: dispose });
  }

  function getRuntime() {
    if (!runtime) runtime = createRuntime({});
    return runtime;
  }
  root.GhostAudioRuntime = freeze({
    create: createRuntime,
    init: function () { return getRuntime().init(); },
    unlock: function () { return getRuntime().unlock(); },
    emit: function (type, options) { return getRuntime().emit(type, options); },
    testTone: function () { return getRuntime().testTone(); },
    setPreferences: function (patch) { return getRuntime().setPreferences(patch); },
    getPreferences: function () { return getRuntime().getPreferences(); },
    setLifecycle: function (hidden) { return getRuntime().setLifecycle(hidden); },
    playMusic: function (track) { return getRuntime().playMusic(track); },
    stopMusic: function () { return getRuntime().stopMusic(); },
    reset: function () { return getRuntime().reset(); },
    snapshot: function () { return getRuntime().snapshot(); },
    dispose: function () { return getRuntime().dispose(); }
  });
  root.initUnifiedAudioRuntime = function initUnifiedAudioRuntime() { return root.GhostAudioRuntime.init(); };
  root.audioUnlock = function audioUnlock() { return root.GhostAudioRuntime.unlock(); };
  root.emitAudioCue = function emitAudioCue(type, options) { return root.GhostAudioRuntime.emit(type, options); };
  root.testUnifiedAudio = function testUnifiedAudio() { return root.GhostAudioRuntime.testTone(); };
  root.setUnifiedAudioPreferences = function setUnifiedAudioPreferences(patch) { return root.GhostAudioRuntime.setPreferences(patch); };
  root.getUnifiedAudioPreferences = function getUnifiedAudioPreferences() { return root.GhostAudioRuntime.getPreferences(); };
}(typeof globalThis !== 'undefined' ? globalThis : this));
