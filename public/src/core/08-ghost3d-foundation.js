(function ghost3dFoundation(root, factory) {
  if (typeof module === 'object' && module && module.exports) {
    module.exports = factory();
  } else {
    root.Ghost3DFoundation = factory();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createFoundationModule() {
  'use strict';

  var QUALITY = Object.freeze({
    HIGH: 'HIGH',
    BALANCED: 'BALANCED',
    LOW: 'LOW',
    FALLBACK: 'FALLBACK'
  });
  var QUALITY_SET = new Set([QUALITY.HIGH, QUALITY.BALANCED, QUALITY.LOW, QUALITY.FALLBACK]);
  var TERMINAL_VALUES = new Set(['terminal', 'complete', 'completed', 'finished', 'game_over']);
  var NAME_PATTERN = /^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
  var MAX_DEPTH = 10;
  var MAX_KEYS = 256;
  var MAX_ARRAY = 512;
  var DENIED_DATA_KEYS = new Set([
    'adapter', 'renderer', 'canvas', 'element', 'node', 'mesh', 'material', 'texture', 'engine'
  ]);

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

  function read(value, key) {
    try {
      return { ok: true, value: value[key] };
    } catch (error) {
      return { ok: false, value: undefined };
    }
  }

  function safeInteger(value) {
    var safe = typeof Number.isSafeInteger === 'function'
      ? Number.isSafeInteger(value)
      : Number.isFinite(value) && Math.floor(value) === value && Math.abs(value) <= 9007199254740991;
    return typeof value === 'number' && safe && value >= 0 ? value : null;
  }

  function normalizeQuality(value, fallback) {
    var candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return QUALITY_SET.has(candidate) ? candidate : fallback;
  }

  function normalizeName(value) {
    var candidate = typeof value === 'string' ? value.trim() : '';
    return NAME_PATTERN.test(candidate) ? candidate : null;
  }

  function project(value, depth, seen) {
    if (depth > MAX_DEPTH) return undefined;
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;

    if (Array.isArray(value)) {
      if (seen.has(value)) return undefined;
      seen.add(value);
      var array = [];
      var arrayLength = Math.min(value.length, MAX_ARRAY);
      for (var index = 0; index < arrayLength; index += 1) {
        var item;
        try {
          item = project(value[index], depth + 1, seen);
        } catch (error) {
          item = undefined;
        }
        array.push(item === undefined ? null : item);
      }
      seen.delete(value);
      return Object.freeze(array);
    }

    if (!isPlainRecord(value) || seen.has(value)) return undefined;
    seen.add(value);
    var output = {};
    var keys;
    try {
      keys = Object.keys(value).slice(0, MAX_KEYS);
    } catch (error) {
      seen.delete(value);
      return undefined;
    }
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      var key = keys[keyIndex];
      var lowerKey = String(key).toLowerCase();
      if (key === '__proto__' || key === 'prototype' || key === 'constructor' || DENIED_DATA_KEYS.has(lowerKey)) continue;
      var child;
      try {
        child = project(value[key], depth + 1, seen);
      } catch (error) {
        child = undefined;
      }
      if (child !== undefined) output[key] = child;
    }
    seen.delete(value);
    return Object.freeze(output);
  }

  function projectedRecord(value) {
    var result;
    try {
      result = project(value, 0, new Set());
    } catch (error) {
      return null;
    }
    return result && isPlainRecord(result) ? result : null;
  }

  function frozenCopy(record, additions) {
    var copy = {};
    Object.keys(record).forEach(function copyValue(key) {
      copy[key] = record[key];
    });
    if (additions) {
      Object.keys(additions).forEach(function copyAddition(key) {
        copy[key] = additions[key];
      });
    }
    return Object.freeze(copy);
  }

  function adapterMethod(adapter, name) {
    if (!isObject(adapter)) return null;
    try {
      return typeof adapter[name] === 'function' ? adapter[name] : null;
    } catch (error) {
      return null;
    }
  }

  function validAdapter(adapter) {
    return !!adapterMethod(adapter, 'mount') && !!adapterMethod(adapter, 'render');
  }

  function adapterName(adapter) {
    if (!adapter) return 'programmatic-fallback';
    var candidates = ['id', 'adapterId', 'name', 'kind'];
    for (var index = 0; index < candidates.length; index += 1) {
      var candidate = read(adapter, candidates[index]);
      if (candidate.ok && typeof candidate.value === 'string' && candidate.value) {
        return candidate.value.slice(0, 96);
      }
    }
    return 'renderer-adapter';
  }

  function thenable(value) {
    try {
      return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function';
    } catch (error) {
      return false;
    }
  }

  function errorInfo(value, phase) {
    var name = 'Error';
    var message = '';
    try {
      if (value && typeof value === 'object') {
        if (typeof value.name === 'string' && value.name) name = value.name;
        if (typeof value.message === 'string' && value.message) message = value.message;
        else if (typeof value.error === 'string' && value.error) message = value.error;
      } else if (typeof value === 'string') {
        message = value;
      } else if (value !== undefined && value !== null) {
        message = String(value);
      }
    } catch (error) {}
    if (!message) message = 'Adapter failure';
    return Object.freeze({
      name: String(name).slice(0, 80),
      message: String(message).slice(0, 512),
      phase: String(phase || 'adapter').slice(0, 96)
    });
  }

  function isErrorLike(value) {
    if (value instanceof Error || typeof value === 'string') return true;
    if (!value || typeof value !== 'object') return false;
    try {
      return value.ok === false || !!value.error || (typeof value.name === 'string' && /Error$/.test(value.name));
    } catch (error) {
      return true;
    }
  }

  function makeProgrammaticFallback() {
    var disposed = false;
    var suspended = false;
    return {
      id: 'programmatic-fallback',
      mount: function mount() {
        return !disposed;
      },
      render: function render() {
        return !disposed;
      },
      motion: function motion() {
        return !disposed && !suspended;
      },
      setQuality: function setQuality() {
        return !disposed;
      },
      environment: function environment() {
        return !disposed;
      },
      suspend: function suspend() {
        suspended = true;
        return !disposed;
      },
      resume: function resume() {
        suspended = false;
        return !disposed;
      },
      contextLost: function contextLost() {
        suspended = true;
        return !disposed;
      },
      dispose: function dispose() {
        disposed = true;
        suspended = true;
        return true;
      }
    };
  }

  function create(options) {
    var opts = isPlainRecord(options) ? options : {};
    var optionQuality = read(opts, 'quality');
    var requestedQuality = normalizeQuality(optionQuality.ok ? optionQuality.value : undefined, QUALITY.HIGH);
    var optionMotion = read(opts, 'reducedMotion');
    var optionInput = read(opts, 'onInput');
    var optionFailure = read(opts, 'onFailure');
    var onInput = optionInput.ok && typeof optionInput.value === 'function' ? optionInput.value : null;
    var onFailure = optionFailure.ok && typeof optionFailure.value === 'function' ? optionFailure.value : null;
    var lastNonFallbackQuality = requestedQuality === QUALITY.FALLBACK ? QUALITY.HIGH : requestedQuality;
    var state = {
      status: 'active',
      quality: QUALITY.FALLBACK,
      requestedQuality: requestedQuality,
      usingFallback: true,
      fallbackReason: 'no_adapter',
      contextLost: false,
      reducedMotion: optionMotion.ok && optionMotion.value === true,
      hidden: false,
      suspended: false,
      revision: null,
      terminal: false,
      frame: null,
      lastRenderedRevision: null,
      lastFailure: null,
      adapter: 'programmatic-fallback'
    };
    var activeAdapter = null;
    var adapterReady = false;
    var adapterGeneration = 0;
    var renderSequence = 0;
    var liveRenderSequence = 0;
    var motionSequence = 0;
    var liveMotionSequence = 0;
    var lifecycleSequence = 0;
    var liveLifecycleSequence = 0;
    var qualitySequence = 0;
    var liveQualitySequence = 0;
    var environmentSequence = 0;
    var liveEnvironmentSequence = 0;
    var deliveredQualitySequence = null;
    var deliveredEnvironmentSequence = null;
    var configurationReady = false;
    var mountConfigurationReady = false;
    var resumePending = false;
    var suspendReasons = new Set();
    var disposedAdapters = new Set();

    function snapshot() {
      return Object.freeze({
        status: state.status,
        quality: state.quality,
        requestedQuality: state.requestedQuality,
        usingFallback: state.usingFallback,
        fallbackReason: state.fallbackReason,
        contextLost: state.contextLost,
        reducedMotion: state.reducedMotion,
        hidden: state.hidden,
        suspended: state.suspended,
        revision: state.revision,
        terminal: state.terminal,
        frame: state.frame,
        adapterReady: adapterReady,
        lastRenderedRevision: state.lastRenderedRevision,
        lastFailure: state.lastFailure,
        adapter: state.adapter
      });
    }

    function accepted(details) {
      var result = { accepted: true };
      if (details) {
        Object.keys(details).forEach(function copyDetail(key) {
          result[key] = details[key];
        });
      }
      result.snapshot = snapshot();
      return Object.freeze(result);
    }

    function rejected(reason, details) {
      var result = { accepted: false, reason: reason };
      if (details) {
        Object.keys(details).forEach(function copyDetail(key) {
          result[key] = details[key];
        });
      }
      result.snapshot = snapshot();
      return Object.freeze(result);
    }

    function noteFailure(error, phase) {
      state.lastFailure = errorInfo(error, phase);
      if (onFailure && state.status !== 'disposed') {
        try {
          onFailure(state.lastFailure, snapshot());
        } catch (callbackError) {}
      }
      return state.lastFailure;
    }

    function adapterContext() {
      return Object.freeze({
        quality: state.quality,
        requestedQuality: state.requestedQuality,
        reducedMotion: state.reducedMotion,
        suspended: state.suspended || resumePending,
        hidden: state.hidden,
        revision: state.revision,
        terminal: state.terminal,
        contextLost: state.contextLost,
        usingFallback: state.usingFallback,
        generation: adapterGeneration
      });
    }

    function invalidateRender() {
      liveRenderSequence = ++renderSequence;
    }

    function invalidateMotion() {
      liveMotionSequence = ++motionSequence;
    }

    function invalidateLifecycle() {
      liveLifecycleSequence = ++lifecycleSequence;
    }

    function invalidateQuality() {
      liveQualitySequence = ++qualitySequence;
    }

    function invalidateEnvironment() {
      liveEnvironmentSequence = ++environmentSequence;
    }

    function invalidatePending() {
      invalidateRender();
      invalidateMotion();
      invalidateLifecycle();
      invalidateQuality();
      invalidateEnvironment();
    }

    function current(meta) {
      if (state.status === 'disposed' || !meta || meta.generation !== adapterGeneration) return false;
      if (meta.renderSequence !== undefined && meta.renderSequence !== liveRenderSequence) return false;
      if (meta.motionSequence !== undefined && meta.motionSequence !== liveMotionSequence) return false;
      if (meta.lifecycleSequence !== undefined && meta.lifecycleSequence !== liveLifecycleSequence) return false;
      if (meta.qualitySequence !== undefined && meta.qualitySequence !== liveQualitySequence) return false;
      if (meta.environmentSequence !== undefined && meta.environmentSequence !== liveEnvironmentSequence) return false;
      return meta.revision === undefined || meta.revision === state.revision;
    }

    function invoke(adapter, name, args, meta, done) {
      var method = adapterMethod(adapter, name);
      if (!method) {
        done(null, { unsupported: true });
        return false;
      }
      var settled = false;
      function settle(first, second) {
        if (settled) return;
        settled = true;
        if (!current(meta)) return;
        var error = null;
        var value;
        if (arguments.length > 1) {
          error = first;
          value = second;
        } else if (isErrorLike(first)) {
          error = first;
        } else {
          value = first;
        }
        if (!error && (value === false || (value && typeof value === 'object' && value.ok === false))) {
          error = value && value.error ? value.error : new Error('adapter_rejected_' + name);
        }
        done(error, value);
      }
      function completion() {
        settle.apply(null, arguments);
      }
      var result;
      try {
        result = method.apply(adapter, args.concat(completion));
      } catch (error) {
        settle(error);
        return true;
      }
      if (thenable(result)) {
        try {
          result.then(function resolved(value) {
            settle(null, value);
          }, function rejectedPromise(error) {
            settle(error);
          });
        } catch (error) {
          settle(error);
        }
      } else if (result !== undefined || method.length <= args.length) {
        settle(null, result);
      }
      return true;
    }

    function disposeAdapter(adapter) {
      if (!adapter || disposedAdapters.has(adapter)) return;
      disposedAdapters.add(adapter);
      var method = adapterMethod(adapter, 'dispose');
      if (!method) return;
      try {
        var result = method.call(adapter, adapterContext(), function ignoreDisposeCompletion() {});
        if (thenable(result)) result.then(function ignored() {}, function ignoredFailure() {});
      } catch (error) {}
    }

    function failIntoFallback(error, phase) {
      if (state.status === 'disposed') return;
      if (state.usingFallback) {
        noteFailure(error, 'fallback_' + phase);
        return;
      }
      noteFailure(error, phase);
      activateFallback('adapter_failure:' + phase);
    }

    function renderLatest() {
      if (state.status === 'disposed' || state.suspended || resumePending || !adapterReady || !configurationReady || !state.frame) return false;
      var generation = adapterGeneration;
      var sequence = ++renderSequence;
      liveRenderSequence = sequence;
      var revision = state.revision;
      invoke(activeAdapter, 'render', [state.frame, adapterContext()], {
        generation: generation,
        renderSequence: sequence,
        revision: revision
      }, function rendered(error) {
        if (error) {
          failIntoFallback(error, 'render');
          return;
        }
        state.lastRenderedRevision = revision;
      });
      return true;
    }

    function configurationIsCurrent() {
      return adapterReady &&
        deliveredQualitySequence === liveQualitySequence &&
        deliveredEnvironmentSequence === liveEnvironmentSequence;
    }

    function finishConfiguration() {
      if (!configurationIsCurrent()) return;
      configurationReady = true;
      if (!mountConfigurationReady) {
        mountConfigurationReady = true;
        if (state.suspended) {
          callSuspend();
          return;
        }
      }
      if (state.suspended || resumePending) return;
      renderLatest();
    }

    function configureQuality() {
      if (!adapterReady) return;
      var generation = adapterGeneration;
      var sequence = liveQualitySequence;
      var quality = state.quality;
      invoke(activeAdapter, 'setQuality', [quality, adapterContext()], {
        generation: generation,
        qualitySequence: sequence
      }, function qualityConfigured(error) {
        if (error) {
          failIntoFallback(error, 'quality');
          return;
        }
        deliveredQualitySequence = sequence;
        finishConfiguration();
      });
    }

    function configureEnvironment() {
      if (!adapterReady) return;
      var generation = adapterGeneration;
      var sequence = liveEnvironmentSequence;
      var environment = Object.freeze({ reducedMotion: state.reducedMotion });
      invoke(activeAdapter, 'environment', [environment, adapterContext()], {
        generation: generation,
        environmentSequence: sequence
      }, function environmentConfigured(error) {
        if (error) {
          failIntoFallback(error, 'environment');
          return;
        }
        deliveredEnvironmentSequence = sequence;
        finishConfiguration();
      });
    }

    function configureMountedAdapter() {
      var generation = adapterGeneration;
      configurationReady = false;
      configureQuality();
      if (generation !== adapterGeneration || !adapterReady) return;
      configureEnvironment();
    }

    function callSuspend() {
      if (!adapterReady) return;
      var generation = adapterGeneration;
      var sequence = ++lifecycleSequence;
      liveLifecycleSequence = sequence;
      invoke(activeAdapter, 'suspend', [adapterContext()], {
        generation: generation,
        lifecycleSequence: sequence
      }, function suspended(error) {
        if (error) failIntoFallback(error, 'suspend');
      });
    }

    function callResume() {
      if (!adapterReady) {
        resumePending = false;
        renderLatest();
        return;
      }
      var generation = adapterGeneration;
      var sequence = ++lifecycleSequence;
      liveLifecycleSequence = sequence;
      invoke(activeAdapter, 'resume', [adapterContext()], {
        generation: generation,
        lifecycleSequence: sequence
      }, function resumed(error) {
        if (error) {
          resumePending = false;
          failIntoFallback(error, 'resume');
          return;
        }
        resumePending = false;
        renderLatest();
      });
    }

    function mountActive() {
      var generation = adapterGeneration;
      var mountedAdapter = activeAdapter;
      invoke(mountedAdapter, 'mount', [adapterContext()], { generation: generation }, function mounted(error) {
        if (error) {
          if (state.usingFallback) {
            noteFailure(error, 'fallback_mount');
            return;
          }
          failIntoFallback(error, 'mount');
          return;
        }
        adapterReady = true;
        configureMountedAdapter();
      });
    }

    function activate(adapter, usingFallback, fallbackReason) {
      if (state.status === 'disposed') return false;
      var previous = activeAdapter;
      adapterGeneration += 1;
      invalidatePending();
      resumePending = false;
      activeAdapter = adapter;
      adapterReady = false;
      configurationReady = false;
      mountConfigurationReady = false;
      deliveredQualitySequence = null;
      deliveredEnvironmentSequence = null;
      state.usingFallback = usingFallback;
      state.quality = usingFallback ? QUALITY.FALLBACK : state.requestedQuality;
      state.fallbackReason = usingFallback ? String(fallbackReason || 'fallback') : null;
      state.adapter = adapterName(adapter);
      state.lastRenderedRevision = null;
      if (previous && previous !== adapter) disposeAdapter(previous);
      mountActive();
      return true;
    }

    function activateFallback(reason) {
      return activate(makeProgrammaticFallback(), true, reason);
    }

    function preferredAdapter() {
      var optionAdapter = read(opts, 'adapter');
      return optionAdapter.ok ? optionAdapter.value : null;
    }

    function transitionSuspension(message, action) {
      var wasSuspended = state.suspended;
      var reasonValue = read(message, 'reason');
      var reason = reasonValue.ok && typeof reasonValue.value === 'string' && reasonValue.value.trim()
        ? reasonValue.value.trim().slice(0, 96)
        : 'manual';
      if (action === 'hidden') {
        state.hidden = true;
        suspendReasons.add('hidden');
      } else if (action === 'visible') {
        state.hidden = false;
        suspendReasons.delete('hidden');
      } else if (action === 'suspend') {
        suspendReasons.add('manual:' + reason);
      } else {
        suspendReasons.delete('manual:' + reason);
      }
      state.suspended = suspendReasons.size > 0;
      state.status = state.suspended ? 'suspended' : 'active';
      if (state.suspended && !wasSuspended) {
        resumePending = false;
        invalidateRender();
        invalidateMotion();
        callSuspend();
      } else if (!state.suspended && wasSuspended) {
        resumePending = true;
        invalidateRender();
        invalidateMotion();
        callResume();
      }
      return accepted({ lifecycle: action, suspended: state.suspended });
    }

    function applyFrame(message) {
      var frameValue = read(message, 'frame');
      if (!frameValue.ok || !isPlainRecord(frameValue.value)) return rejected('invalid_frame');
      if (state.terminal) return rejected('terminal');
      var original = frameValue.value;
      var explicitRevision = hasOwn(original, 'revision');
      var originalRevision = explicitRevision ? read(original, 'revision') : { ok: true, value: undefined };
      if (!originalRevision.ok) return rejected('invalid_revision');
      var revision = explicitRevision ? safeInteger(originalRevision.value) : (state.revision === null ? 0 : state.revision + 1);
      if (revision === null) return rejected('invalid_revision');
      if (state.revision !== null && revision <= state.revision) return rejected('stale_revision', { revision: state.revision });
      var frame = projectedRecord(original);
      if (!frame) return rejected('invalid_frame');
      var terminal = frame.terminal === true ||
        (typeof frame.phase === 'string' && TERMINAL_VALUES.has(frame.phase.toLowerCase())) ||
        (typeof frame.status === 'string' && TERMINAL_VALUES.has(frame.status.toLowerCase()));
      state.frame = frozenCopy(frame, { revision: revision, terminal: terminal });
      state.revision = revision;
      state.terminal = state.terminal || terminal;
      invalidateMotion();
      renderLatest();
      return accepted({ revision: revision, terminal: state.terminal });
    }

    function applyInput(message) {
      if (!state.frame) return rejected('no_frame');
      if (state.terminal) return rejected('terminal');
      if (state.suspended || resumePending) return rejected('suspended');
      var commandValue = read(message, 'command');
      if (!commandValue.ok || !isPlainRecord(commandValue.value)) return rejected('invalid_input');
      var original = commandValue.value;
      var typeValue = read(original, 'type');
      var type = typeValue.ok ? normalizeName(typeValue.value) : null;
      if (!type) return rejected('invalid_input_type');
      var explicitRevision = hasOwn(original, 'revision');
      var revisionValue = explicitRevision ? read(original, 'revision') : { ok: true, value: state.revision };
      var revision = revisionValue.ok ? safeInteger(revisionValue.value) : null;
      if (revision === null) return rejected('invalid_input_revision');
      if (revision < state.revision) return rejected('stale_input_revision');
      if (revision > state.revision) return rejected('future_input_revision');
      var command = projectedRecord(original);
      if (!command) return rejected('invalid_input');
      command = frozenCopy(command, { type: type, revision: revision });
      if (onInput) {
        try {
          if (onInput(command, snapshot()) === false) return rejected('input_rejected');
        } catch (error) {
          noteFailure(error, 'input');
          return rejected('input_callback_failure');
        }
      }
      return accepted({ command: command });
    }

    function applyMotion(message) {
      if (!state.frame) return rejected('no_frame');
      if (state.suspended || resumePending) return rejected('suspended');
      var eventValue = read(message, 'event');
      if (!eventValue.ok || !isPlainRecord(eventValue.value)) return rejected('invalid_motion');
      var original = eventValue.value;
      var typeValue = read(original, 'type');
      var type = typeValue.ok ? normalizeName(typeValue.value) : null;
      if (!type) return rejected('invalid_motion_type');
      var explicitRevision = hasOwn(original, 'revision');
      var revisionValue = explicitRevision ? read(original, 'revision') : { ok: true, value: state.revision };
      var revision = revisionValue.ok ? safeInteger(revisionValue.value) : null;
      if (revision === null) return rejected('invalid_motion_revision');
      if (revision < state.revision) return rejected('stale_motion_revision');
      if (revision > state.revision) return rejected('future_motion_revision');
      var event = projectedRecord(original);
      if (!event) return rejected('invalid_motion');
      event = frozenCopy(event, {
        type: type,
        revision: revision,
        reducedMotion: state.reducedMotion,
        instant: state.reducedMotion
      });
      var generation = adapterGeneration;
      var sequence = ++motionSequence;
      liveMotionSequence = sequence;
      var forwarded = false;
      if (adapterReady && configurationReady && !state.suspended && !resumePending) {
        forwarded = invoke(activeAdapter, 'motion', [event, adapterContext()], {
          generation: generation,
          motionSequence: sequence,
          revision: revision
        }, function motionForwarded(error) {
          if (error) failIntoFallback(error, 'motion');
        });
      }
      return accepted({ event: event, forwarded: forwarded });
    }

    function applyLifecycle(message) {
      var actionValue = read(message, 'action');
      var action = actionValue.ok && typeof actionValue.value === 'string' ? actionValue.value : '';
      if (action !== 'suspend' && action !== 'resume' && action !== 'hidden' && action !== 'visible') {
        return rejected('invalid_lifecycle');
      }
      return transitionSuspension(message, action);
    }

    function applyQuality(message) {
      var value = read(message, 'quality');
      var quality = value.ok ? normalizeQuality(value.value, null) : null;
      if (!quality) return rejected('invalid_quality');
      state.requestedQuality = quality;
      if (quality !== QUALITY.FALLBACK) lastNonFallbackQuality = quality;
      if (quality === QUALITY.FALLBACK) {
        if (!state.usingFallback) activateFallback('requested');
        else state.fallbackReason = 'requested';
        return accepted({ quality: state.quality });
      }
      if (state.usingFallback) return accepted({ quality: state.quality });
      state.quality = quality;
      configurationReady = false;
      invalidateRender();
      invalidateQuality();
      if (adapterReady) configureQuality();
      return accepted({ quality: state.quality });
    }

    function applyEnvironment(message) {
      var value = read(message, 'reducedMotion');
      if (!value.ok || typeof value.value !== 'boolean') return rejected('invalid_environment');
      state.reducedMotion = value.value;
      if (state.usingFallback) return accepted({ reducedMotion: state.reducedMotion });
      configurationReady = false;
      invalidateRender();
      invalidateEnvironment();
      if (adapterReady) configureEnvironment();
      return accepted({ reducedMotion: state.reducedMotion });
    }

    function applyContextLost(message) {
      if (state.contextLost && state.usingFallback) return accepted({ fallback: true });
      state.contextLost = true;
      var previous = activeAdapter;
      var method = adapterMethod(previous, 'contextLost');
      if (method) {
        try {
          var result = method.call(previous, adapterContext(), function ignoreContextLossCompletion() {});
          if (thenable(result)) result.then(function ignored() {}, function ignoredFailure() {});
        } catch (error) {
          noteFailure(error, 'context_lost');
        }
      }
      var reasonValue = read(message, 'reason');
      var reason = reasonValue.ok && typeof reasonValue.value === 'string' && reasonValue.value
        ? reasonValue.value.slice(0, 96)
        : 'unknown';
      activateFallback('context_loss:' + reason);
      return accepted({ fallback: true });
    }

    function applyRecover(message) {
      var adapterValue = read(message, 'adapter');
      var adapter = adapterValue.ok ? adapterValue.value : null;
      if (disposedAdapters.has(adapter)) return rejected('adapter_not_fresh');
      if (!validAdapter(adapter)) return rejected('invalid_adapter');
      if (state.requestedQuality === QUALITY.FALLBACK) state.requestedQuality = lastNonFallbackQuality;
      state.contextLost = false;
      activate(adapter, false, null);
      return accepted({ adapter: state.adapter });
    }

    function apply(message) {
      if (state.status === 'disposed') return rejected('disposed');
      if (!isPlainRecord(message)) return rejected('invalid_message');
      var typeValue = read(message, 'type');
      var type = typeValue.ok && typeof typeValue.value === 'string' ? typeValue.value : '';
      if (type === 'frame') return applyFrame(message);
      if (type === 'input') return applyInput(message);
      if (type === 'motion') return applyMotion(message);
      if (type === 'lifecycle') return applyLifecycle(message);
      if (type === 'quality') return applyQuality(message);
      if (type === 'context-lost') return applyContextLost(message);
      if (type === 'recover') return applyRecover(message);
      if (type === 'environment') return applyEnvironment(message);
      return rejected('unknown_message');
    }

    function dispose() {
      if (state.status === 'disposed') return snapshot();
      state.status = 'disposed';
      state.suspended = true;
      state.hidden = false;
      adapterReady = false;
      resumePending = false;
      suspendReasons.clear();
      adapterGeneration += 1;
      invalidatePending();
      disposeAdapter(activeAdapter);
      activeAdapter = null;
      state.frame = null;
      state.lastRenderedRevision = null;
      return snapshot();
    }

    var initialAdapter = preferredAdapter();
    if (requestedQuality !== QUALITY.FALLBACK && validAdapter(initialAdapter)) {
      activate(initialAdapter, false, null);
    } else {
      activateFallback(requestedQuality === QUALITY.FALLBACK ? 'requested' : (initialAdapter ? 'invalid_adapter' : 'no_adapter'));
    }

    return Object.freeze({
      apply: apply,
      dispose: dispose,
      snapshot: snapshot
    });
  }

  return Object.freeze({
    create: create,
    QUALITY: QUALITY
  });
}));
