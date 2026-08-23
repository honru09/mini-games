/*
 * Ghost Audio Spectrum Art
 *
 * A presentation-only, code-native spectrum for the Settings audio surface.
 * It consumes GhostAudioRuntime's detached visual envelopes; it never reads an
 * AudioNode, microphone, rule event, protocol packet, replay, reward or chat.
 */
(function installAudioSpectrumArt(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else if (root) root.GhostAudioSpectrumArt = api.create({ root: root });
}(typeof globalThis !== 'undefined' ? globalThis : this, function createAudioSpectrumArtModule() {
  'use strict';

  var BAR_COUNT = 12;
  var RETURN_DELAY_MS = 680;
  var STATUS_KEYS = Object.freeze({
    silent: 'audio_spectrum_silent',
    paused: 'audio_spectrum_paused',
    locked: 'audio_spectrum_locked',
    music: 'audio_spectrum_music',
    live: 'audio_spectrum_live',
    ready: 'audio_spectrum_ready'
  });

  function clamp(value, low, high, fallback) {
    return typeof value === 'number' && isFinite(value) ? Math.max(low, Math.min(high, value)) : fallback;
  }
  function cueSeed(type) {
    var source = String(type || 'ready');
    var hash = 2166136261;
    for (var index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function levelsFor(type, intensity, pan, track) {
    var seed = cueSeed(type || track || 'ready');
    var strength = clamp(intensity, 0, 1, track ? .42 : .28);
    var balance = clamp(pan, -1, 1, 0);
    var result = [];
    for (var index = 0; index < BAR_COUNT; index += 1) {
      var center = 1 - Math.abs(index - (BAR_COUNT - 1) / 2) / ((BAR_COUNT - 1) / 2);
      var texture = ((seed >>> (index % 16)) & 7) / 7;
      var side = index < BAR_COUNT / 2 ? -1 : 1;
      var directional = 1 + side * balance * .22;
      result.push(clamp((.16 + center * .38 + texture * .24 + strength * .32) * directional, .14, 1, .35));
    }
    return result;
  }
  function safeTranslate(root, key) {
    try { return root && typeof root.t === 'function' ? root.t(key) : key; }
    catch (_error) { return key; }
  }
  function setStatus(root, host, key) {
    var node = host && host.querySelector && host.querySelector('[data-audio-spectrum-status]');
    if (!node) return;
    node.setAttribute('data-i18n', key);
    node.textContent = safeTranslate(root, key);
  }
  function disconnected(host) {
    return !host || host.isConnected === false;
  }

  function create(options) {
    var opts = options && typeof options === 'object' ? options : {};
    var root = opts.root || (typeof globalThis !== 'undefined' ? globalThis : null);
    var runtime = opts.runtime || (root && root.GhostAudioRuntime) || null;
    var mounts = [];
    var loader = typeof opts.loadAdapter === 'function'
      ? opts.loadAdapter
      : function loadDefaultAdapter() { return import('./audio-spectrum-motion-entry.js'); };

    function enabled() {
      if (typeof opts.enabled === 'boolean') return opts.enabled;
      try { return !root || typeof root.audioSpectrumArtEnabled !== 'function' || root.audioSpectrumArtEnabled(); }
      catch (_error) { return true; }
    }

    function mount(host) {
      if (!enabled() || !host || typeof host.querySelectorAll !== 'function') return null;
      var bars = Array.prototype.slice.call(host.querySelectorAll('[data-audio-spectrum-bar]'));
      if (bars.length !== BAR_COUNT) return null;
      var destroyed = false;
      var generation = 0;
      var returnTimer = null;
      var adapter = null;
      var adapterPromise = null;
      var lastEnvelope = null;
      var unsubscribe = null;

      function clearReturnTimer() {
        if (returnTimer !== null) {
          try { (root && root.clearTimeout || clearTimeout)(returnTimer); } catch (_error) {}
          returnTimer = null;
        }
      }
      function settleMotion() {
        if (adapter && typeof adapter.settle === 'function') {
          try { adapter.settle(); } catch (_error) {}
        }
        host.classList && host.classList.remove('audio-spectrum-motion-active');
      }
      function staticLevels(levels) {
        bars.forEach(function (bar, index) {
          if (bar && bar.style && typeof bar.style.setProperty === 'function') {
            bar.style.setProperty('--spectrum-level', String(clamp(levels[index], .12, 1, .3)));
          }
        });
      }
      function reduced(envelope) {
        if (envelope && envelope.reducedMotion === true) return true;
        try { return !!(root && typeof root.matchMedia === 'function' && root.matchMedia('(prefers-reduced-motion: reduce)').matches); }
        catch (_error) { return false; }
      }
      function loadMotion() {
        if (adapter) return Promise.resolve(adapter);
        if (!adapterPromise) {
          adapterPromise = Promise.resolve().then(loader).then(function (moduleValue) {
            if (!moduleValue || typeof moduleValue.createAudioSpectrumMotionAdapter !== 'function') return null;
            return moduleValue.createAudioSpectrumMotionAdapter({ root: host });
          }).then(function (value) {
            if (destroyed) {
              if (value && typeof value.dispose === 'function') { try { value.dispose(); } catch (_error) {} }
              return null;
            }
            adapter = value;
            return value;
          }).catch(function () { return null; });
        }
        return adapterPromise;
      }
      function baseStatus(envelope) {
        if (!envelope || (envelope.sfxAudible !== true && envelope.musicAudible !== true)) return 'silent';
        if (envelope.hidden === true) return 'paused';
        if (envelope.unlocked !== true) return 'locked';
        if (envelope.musicActive === true) return 'music';
        return 'ready';
      }
      function applyBase(envelope) {
        if (destroyed || !envelope) return;
        var state = baseStatus(envelope);
        host.dataset.audioSpectrumState = state;
        host.dataset.audioSpectrumTrack = envelope.track || 'none';
        setStatus(root, host, STATUS_KEYS[state]);
        staticLevels(levelsFor(state, state === 'music' ? .42 : .16, 0, envelope.track));
      }
      function pulse(envelope) {
        var request = ++generation;
        var levels = levelsFor(envelope.cueType, envelope.intensity, envelope.pan, envelope.track);
        staticLevels(levels);
        host.dataset.audioSpectrumState = 'live';
        host.dataset.audioSpectrumCue = envelope.cueType || 'cue';
        setStatus(root, host, STATUS_KEYS.live);
        clearReturnTimer();
        returnTimer = (root && root.setTimeout || setTimeout)(function () {
          returnTimer = null;
          if (destroyed || request !== generation) return;
          delete host.dataset.audioSpectrumCue;
          applyBase(lastEnvelope || envelope);
        }, RETURN_DELAY_MS);
        if (envelope.hidden === true || reduced(envelope) || disconnected(host)) {
          settleMotion();
          return;
        }
        host.classList && host.classList.add('audio-spectrum-motion-active');
        loadMotion().then(function (motion) {
          if (destroyed || request !== generation || disconnected(host) || !motion || typeof motion.pulse !== 'function') {
            host.classList && host.classList.remove('audio-spectrum-motion-active');
            return;
          }
          motion.pulse({ bars: bars, levels: levels, intensity: envelope.intensity, onComplete: function () {
            if (!destroyed && request === generation) host.classList && host.classList.remove('audio-spectrum-motion-active');
          } });
        });
      }
      function consume(envelope) {
        if (destroyed || !envelope || envelope.version !== '1.0') return false;
        lastEnvelope = envelope;
        if (envelope.kind === 'cue' && envelope.sfxAudible === true && envelope.hidden !== true) pulse(envelope);
        else {
          generation += 1;
          clearReturnTimer();
          settleMotion();
          applyBase(envelope);
        }
        return true;
      }
      function destroy() {
        if (destroyed) return false;
        destroyed = true;
        generation += 1;
        clearReturnTimer();
        if (typeof unsubscribe === 'function') { try { unsubscribe(); } catch (_error) {} }
        unsubscribe = null;
        if (adapter && typeof adapter.dispose === 'function') { try { adapter.dispose(); } catch (_error) {} }
        adapter = null;
        host.classList && host.classList.remove('audio-spectrum-motion-active');
        var index = mounts.indexOf(instance);
        if (index !== -1) mounts.splice(index, 1);
        return true;
      }
      var instance = Object.freeze({ consume: consume, destroy: destroy, snapshot: function () {
        return Object.freeze({ destroyed: destroyed, generation: generation, state: host.dataset.audioSpectrumState || 'idle', adapterLoaded: !!adapter });
      } });
      mounts.push(instance);
      if (runtime && typeof runtime.subscribeVisual === 'function') {
        try { unsubscribe = runtime.subscribeVisual(consume); } catch (_error) { unsubscribe = null; }
      }
      if (!lastEnvelope) applyBase({ sfxEnabled: false, musicEnabled: false, unlocked: false, hidden: false, track: null });
      return instance;
    }

    function destroyAll() {
      mounts.slice().forEach(function (instance) { instance.destroy(); });
      return true;
    }

    return Object.freeze({ mount: mount, destroyAll: destroyAll, snapshot: function () {
      return Object.freeze({ mounted: mounts.length, enabled: enabled() });
    } });
  }

  return Object.freeze({ create: create });
}));
