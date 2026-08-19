/*
 * LocalFeedbackAdapter
 *
 * A deliberately small, default-off presentation adapter for Tank semantic
 * cues.  The caller supplies a FeedbackBus and the platform primitives; this
 * module never discovers a platform, owns game state, or retains cue data.
 * AudioContext creation and resume happen only from the explicit unlock()
 * call, which the caller must make from a user gesture.
 *
 * Interface:
 *   LocalFeedbackAdapter.create({ enabled, bus, audioContextFactory, vibrate })
 *   instance.unlock(), instance.snapshot(), instance.dispose()
 */
(function installLocalFeedbackAdapter(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else if (root) {
    root.LocalFeedbackAdapter = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createLocalFeedbackAdapterModule() {
  'use strict';

  var MAX_ACTIVE_VOICES = 8;
  var MAX_COUNTER = 999999;
  var FIRE_TONE = Object.freeze({ frequency: 220, duration: 0.065, gain: 0.13, hapticMs: 16 });
  var HIT_TONE = Object.freeze({ frequency: 110, duration: 0.12, gain: 0.19, hapticMs: 28 });

  function freeze(value) {
    return Object.freeze(value);
  }

  function isObject(value) {
    return value !== null && typeof value === 'object';
  }

  function isPlainRecord(value) {
    if (!isObject(value) || Array.isArray(value)) return false;
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
    if (!isObject(value)) return { present: false, ok: false, value: undefined };
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

  // Web Audio attributes are WebIDL accessors on prototypes in real
  // browsers (for example AudioParam.gain and StereoPannerNode.pan). Keep
  // option/cue reads descriptor-only, but use this guarded accessor for the
  // injected platform objects so prototype-backed attributes still work.
  function readProperty(value, key) {
    var own = ownData(value, key);
    if (own.present && own.ok) return own;
    if (!own.ok && !own.present) return own;
    try {
      return { present: true, ok: true, value: value[key] };
    } catch (_error) {
      return { present: true, ok: false, value: undefined };
    }
  }

  function finite(value) {
    return typeof value === 'number' && isFinite(value);
  }

  function clamp(value, minimum, maximum, fallback) {
    if (!finite(value)) return fallback;
    if (value < minimum) return minimum;
    if (value > maximum) return maximum;
    return value;
  }

  function increment(state, field) {
    if (state[field] < MAX_COUNTER) state[field] += 1;
  }

  function safeInvoke(fn, receiver, args) {
    if (typeof fn !== 'function') return { ok: false, value: undefined };
    try {
      return { ok: true, value: fn.apply(receiver, args || []) };
    } catch (_error) {
      return { ok: false, value: undefined };
    }
  }

  function safeDisconnect(node) {
    var disconnect = readProperty(node, 'disconnect');
    if (!disconnect.ok || !disconnect.present || typeof disconnect.value !== 'function') return;
    safeInvoke(disconnect.value, node, []);
  }

  function safeStop(node, when) {
    var stop = readProperty(node, 'stop');
    if (!stop.ok || !stop.present || typeof stop.value !== 'function') return;
    var result = safeInvoke(stop.value, node, [when]);
    if (!result.ok) safeInvoke(stop.value, node, []);
  }

  function safeClose(context) {
    var close = readProperty(context, 'close');
    if (!close.ok || !close.present || typeof close.value !== 'function') return;
    var result = safeInvoke(close.value, context, []);
    if (result.ok && result.value && typeof result.value.then === 'function') {
      // A rejected close promise must not become an unhandled gameplay error.
      safeInvoke(result.value.catch, result.value, [function ignoreCloseFailure() {}]);
    }
  }

  function safeResume(context) {
    var resume = readProperty(context, 'resume');
    if (!resume.ok || !resume.present || typeof resume.value !== 'function') return true;
    var result = safeInvoke(resume.value, context, []);
    if (result.ok && result.value && typeof result.value.then === 'function') {
      safeInvoke(result.value.catch, result.value, [function ignoreResumeFailure() {}]);
    }
    return result.ok;
  }

  function setParam(param, value, at) {
    if (!param) return false;
    if (typeof param.setValueAtTime === 'function') {
      var scheduled = safeInvoke(param.setValueAtTime, param, [value, at]);
      if (scheduled.ok) return true;
    }
    try {
      param.value = value;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function toneFor(type) {
    return type === 'tank_hit' ? HIT_TONE : FIRE_TONE;
  }

  function result(accepted, reason, snapshot) {
    return freeze({
      accepted: accepted === true,
      reason: reason || null,
      snapshot: snapshot || null
    });
  }

  function create(options) {
    var opts = isPlainRecord(options) ? options : {};
    var enabledField = ownData(opts, 'enabled');
    var busField = ownData(opts, 'bus');
    var factoryField = ownData(opts, 'audioContextFactory');
    var vibrateField = ownData(opts, 'vibrate');

    // The adapter is operational only when both explicit opt-in and a valid
    // semantic source are supplied.  No source means no subscription.
    var explicitlyEnabled = enabledField.ok && enabledField.present && enabledField.value === true;
    var bus = busField.ok && busField.present && busField.value && typeof busField.value.subscribe === 'function'
      ? busField.value
      : null;
    var state = {
      enabled: explicitlyEnabled && !!bus,
      disposed: false,
      subscribed: false,
      unsubscribe: null,
      audioContextFactory: factoryField.ok && factoryField.present && typeof factoryField.value === 'function'
        ? factoryField.value
        : null,
      vibrate: vibrateField.ok && vibrateField.present && typeof vibrateField.value === 'function'
        ? vibrateField.value
        : null,
      context: null,
      contextOwned: false,
      unlocked: false,
      voices: [],
      unlockAttempts: 0,
      audioStarted: 0,
      audioSkipped: 0,
      audioFailures: 0,
      hapticCalls: 0,
      hapticFailures: 0
    };

    function snapshot() {
      var panners = 0;
      var index;
      for (index = 0; index < state.voices.length; index += 1) {
        if (state.voices[index].panner) panners += 1;
      }
      return freeze({
        enabled: state.enabled,
        disposed: state.disposed,
        subscribed: state.subscribed,
        unlocked: state.unlocked,
        contextReady: !!state.context,
        activeVoices: state.voices.length,
        activeOscillators: state.voices.length,
        activeGains: state.voices.length,
        activePanners: panners,
        maxActiveVoices: MAX_ACTIVE_VOICES,
        unlockAttempts: state.unlockAttempts,
        audioStarted: state.audioStarted,
        audioSkipped: state.audioSkipped,
        audioFailures: state.audioFailures,
        hapticCalls: state.hapticCalls,
        hapticFailures: state.hapticFailures
      });
    }

    function removeVoice(voice) {
      if (!voice || voice.released) return;
      voice.released = true;
      var index = state.voices.indexOf(voice);
      if (index !== -1) state.voices.splice(index, 1);
      safeDisconnect(voice.panner);
      safeDisconnect(voice.gain);
      safeDisconnect(voice.oscillator);
    }

    function stopVoice(voice) {
      if (!voice || voice.released) return;
      safeStop(voice.oscillator);
      removeVoice(voice);
    }

    function createPanner(context, pan) {
      var factory = readProperty(context, 'createStereoPanner');
      if (!factory.ok || !factory.present || typeof factory.value !== 'function') return null;
      var created = safeInvoke(factory.value, context, []);
      if (!created.ok || !created.value) return null;
      var panner = created.value;
      var boundedPan = clamp(pan, -1, 1, 0);
      var panParam = readProperty(panner, 'pan');
      var configured = panParam.ok && panParam.present && setParam(panParam.value, boundedPan, readCurrentTime(context));
      if (!configured) {
        // A broken panner is treated as an unavailable spatial node; the
        // caller still receives a centered tone through the gain node.
        safeDisconnect(panner);
        return null;
      }
      return panner;
    }

    function readCurrentTime(context) {
      var current = readProperty(context, 'currentTime');
      return current.ok && current.present && finite(current.value) && current.value >= 0 ? current.value : 0;
    }

    function playTone(type, intensity, pan) {
      if (!state.context || state.voices.length >= MAX_ACTIVE_VOICES) {
        if (state.context) increment(state, 'audioSkipped');
        return false;
      }
      var context = state.context;
      var spec = toneFor(type);
      var voice = { oscillator: null, gain: null, panner: null, released: false };
      var now = readCurrentTime(context);
      var oscillatorFactory = readProperty(context, 'createOscillator');
      var gainFactory = readProperty(context, 'createGain');
      var oscillatorResult = oscillatorFactory.ok && oscillatorFactory.present
        ? safeInvoke(oscillatorFactory.value, context, [])
        : { ok: false, value: undefined };
      var gainResult = gainFactory.ok && gainFactory.present
        ? safeInvoke(gainFactory.value, context, [])
        : { ok: false, value: undefined };
      if (!oscillatorResult.ok || !gainResult.ok || !oscillatorResult.value || !gainResult.value) {
        increment(state, 'audioFailures');
        safeDisconnect(oscillatorResult.value);
        safeDisconnect(gainResult.value);
        return false;
      }
      voice.oscillator = oscillatorResult.value;
      voice.gain = gainResult.value;
      voice.panner = createPanner(context, pan);

      var oscillatorFrequency = readProperty(voice.oscillator, 'frequency');
      var gainParam = readProperty(voice.gain, 'gain');
      if (oscillatorFrequency.ok && oscillatorFrequency.present) {
        setParam(oscillatorFrequency.value, spec.frequency, now);
      }
      if (gainParam.ok && gainParam.present) {
        setParam(gainParam.value, clamp(intensity, 0, 1, 1) * spec.gain, now);
      }
      try { voice.oscillator.type = 'sine'; } catch (_error) {}

      // Connect in a fixed chain.  Every operation is isolated; a partial
      // graph is immediately detached and does not escape this adapter.
      var connected = true;
      var oscillatorConnect = readProperty(voice.oscillator, 'connect');
      var gainConnect = readProperty(voice.gain, 'connect');
      if (!oscillatorConnect.ok || !oscillatorConnect.present || typeof oscillatorConnect.value !== 'function' ||
          !gainConnect.ok || !gainConnect.present || typeof gainConnect.value !== 'function') {
        connected = false;
      } else {
        connected = safeInvoke(oscillatorConnect.value, voice.oscillator, [voice.gain]).ok;
        if (connected && voice.panner) {
          connected = safeInvoke(gainConnect.value, voice.gain, [voice.panner]).ok;
          var destination = readProperty(context, 'destination');
          if (connected) {
            var pannerConnect = readProperty(voice.panner, 'connect');
            connected = destination.ok && destination.present && pannerConnect.ok && pannerConnect.present &&
              typeof pannerConnect.value === 'function' && safeInvoke(pannerConnect.value, voice.panner, [destination.value]).ok;
          }
        } else if (connected) {
          var gainDestination = readProperty(context, 'destination');
          connected = gainDestination.ok && gainDestination.present && safeInvoke(gainConnect.value, voice.gain, [gainDestination.value]).ok;
        }
      }
      if (!connected) {
        increment(state, 'audioFailures');
        removeVoice(voice);
        return false;
      }

      state.voices.push(voice);
      try {
        voice.oscillator.onended = function onEnded() { removeVoice(voice); };
      } catch (_error) {
        // Disposal remains the final cleanup path when a node rejects the
        // callback assignment; no platform exception may escape the bus.
        increment(state, 'audioFailures');
      }
      var startMethod = readProperty(voice.oscillator, 'start');
      var started = startMethod.ok && startMethod.present
        ? safeInvoke(startMethod.value, voice.oscillator, [])
        : { ok: false, value: undefined };
      if (!started.ok) {
        increment(state, 'audioFailures');
        removeVoice(voice);
        return false;
      }
      var stopAt = now + spec.duration;
      var stopMethod = readProperty(voice.oscillator, 'stop');
      var stopped = stopMethod.ok && stopMethod.present
        ? safeInvoke(stopMethod.value, voice.oscillator, [stopAt])
        : { ok: false, value: undefined };
      if (!stopped.ok) {
        // Some test doubles and older implementations accept stop() without
        // an argument.  The fallback remains a short one-shot tone.
        var fallbackStopped = stopMethod.ok && stopMethod.present
          ? safeInvoke(stopMethod.value, voice.oscillator, [])
          : { ok: false, value: undefined };
        if (!fallbackStopped.ok) {
          increment(state, 'audioFailures');
          removeVoice(voice);
          return false;
        }
      }
      increment(state, 'audioStarted');
      return true;
    }

    function emitHaptic(type, intensity, reducedMotion) {
      if (reducedMotion || !state.vibrate) return false;
      var spec = toneFor(type);
      var duration = Math.max(1, Math.round(spec.hapticMs * clamp(intensity, 0, 1, 1)));
      var output = safeInvoke(state.vibrate, null, [duration]);
      if (output.ok) increment(state, 'hapticCalls');
      else increment(state, 'hapticFailures');
      return output.ok;
    }

    function onCue(cue) {
      if (!state.enabled || state.disposed || !isPlainRecord(cue)) return;
      var typeField = ownData(cue, 'type');
      if (!typeField.ok || !typeField.present || (typeField.value !== 'tank_fire' && typeField.value !== 'tank_hit')) return;
      var intensityField = ownData(cue, 'intensity');
      var panField = ownData(cue, 'pan');
      var reducedField = ownData(cue, 'reducedMotion');
      var channelsField = ownData(cue, 'channels');
      if (!channelsField.ok || !channelsField.present || !isPlainRecord(channelsField.value)) return;
      var audioField = ownData(channelsField.value, 'audio');
      var hapticField = ownData(channelsField.value, 'haptic');
      var intensity = intensityField.ok && intensityField.present ? clamp(intensityField.value, 0, 1, 1) : 1;
      var pan = panField.ok && panField.present ? clamp(panField.value, -1, 1, 0) : 0;
      var reducedMotion = reducedField.ok && reducedField.present && reducedField.value === true;
      if (audioField.ok && audioField.present && audioField.value === true) playTone(typeField.value, intensity, pan);
      if (hapticField.ok && hapticField.present && hapticField.value === true) emitHaptic(typeField.value, intensity, reducedMotion);
    }

    function unlock() {
      if (state.disposed) return result(false, 'disposed', snapshot());
      if (!state.enabled) return result(false, 'disabled', snapshot());
      if (!state.audioContextFactory) return result(false, 'audio_unavailable', snapshot());
      increment(state, 'unlockAttempts');
      if (!state.context) {
        var created = safeInvoke(state.audioContextFactory, null, []);
        if (!created.ok || !created.value) return result(false, 'audio_unavailable', snapshot());
        state.context = created.value;
        state.contextOwned = true;
      }
      var resumed = safeResume(state.context);
      state.unlocked = true;
      return result(true, resumed ? null : 'resume_failed', snapshot());
    }

    function dispose() {
      if (state.disposed) return snapshot();
      state.disposed = true;
      state.enabled = false;
      if (typeof state.unsubscribe === 'function') safeInvoke(state.unsubscribe, null, []);
      state.unsubscribe = null;
      state.subscribed = false;
      while (state.voices.length) stopVoice(state.voices[state.voices.length - 1]);
      if (state.contextOwned && state.context) safeClose(state.context);
      state.context = null;
      state.contextOwned = false;
      state.unlocked = false;
      return snapshot();
    }

    if (state.enabled) {
      var subscription = safeInvoke(bus.subscribe, bus, [onCue]);
      if (subscription.ok && typeof subscription.value === 'function') {
        state.unsubscribe = subscription.value;
        state.subscribed = true;
      }
    }

    return freeze({ unlock: unlock, snapshot: snapshot, dispose: dispose });
  }

  return freeze({ create: create });
}));
