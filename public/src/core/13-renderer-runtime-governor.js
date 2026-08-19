/**
 * RendererRuntimeGovernor
 *
 * A renderer-local control module. It owns only numeric runtime signals,
 * one coalesced resize dispatch, and at most one scheduled frame callback.
 * It deliberately does not know about a canvas, DOM listeners, Three.js,
 * game state, or the Ghost3DFoundation Interface.
 *
 * The module is default-static: dynamic DPR recommendations are opt-in and
 * never apply a renderer setting themselves. A future QualityAdapter may
 * acknowledge a recommendation with `apply({ type: 'quality', quality })`.
 *
 * Interface: `apply()` accepts only numeric resize data, a quality enum, the
 * reduced-motion boolean, or lifecycle actions (mount/unmount,
 * suspend/resume, hidden/visible, context-lost/context-restored).
 * `observeFrameBudget()` consumes only `{ frameMs, at? }` and returns a
 * quality suggestion. No raw input, user data, error text, or network state
 * crosses this seam.
 */
(function installRendererRuntimeGovernor(root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) {
    module.exports = api;
  } else if (root) {
    root.RendererRuntimeGovernor = api;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function createRendererRuntimeGovernorModule(root) {
  'use strict';

  var QUALITY = Object.freeze({
    HIGH: 'HIGH',
    BALANCED: 'BALANCED',
    LOW: 'LOW',
    FALLBACK: 'FALLBACK'
  });
  var QUALITY_SET = new Set([QUALITY.HIGH, QUALITY.BALANCED, QUALITY.LOW, QUALITY.FALLBACK]);
  var DYNAMIC_QUALITY_ORDER = [QUALITY.HIGH, QUALITY.BALANCED, QUALITY.LOW];
  var DPR_CAPS = Object.freeze({
    HIGH: 2,
    BALANCED: 1.5,
    LOW: 1,
    FALLBACK: 1
  });
  var DEFAULT_POLICY = Object.freeze({
    downgradeFrameMs: 25,
    upgradeFrameMs: 16,
    downgradeSamples: 8,
    upgradeSamples: 90,
    cooldownMs: 4000
  });
  var MAX_DIMENSION = 32768;
  var MAX_DEVICE_PIXEL_RATIO = 8;
  var MAX_FRAME_DELTA_MS = 1000;

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try {
      var prototype = Object.getPrototypeOf(value);
      if (Object.prototype.toString.call(value) !== '[object Object]') return false;
      if (prototype === null) return true;
      var constructor = Object.prototype.hasOwnProperty.call(prototype, 'constructor') && prototype.constructor;
      return typeof constructor === 'function' && constructor.name === 'Object';
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

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function nonNegative(value, fallback) {
    return finite(value) && value >= 0 ? value : fallback;
  }

  function boundedInteger(value, minimum, maximum, fallback) {
    if (!finite(value)) return fallback;
    var normalized = Math.floor(value);
    return normalized >= minimum && normalized <= maximum ? normalized : fallback;
  }

  function boundedNumber(value, minimum, maximum, fallback) {
    return finite(value) && value >= minimum && value <= maximum ? value : fallback;
  }

  function normalizeQuality(value, fallback) {
    var candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return QUALITY_SET.has(candidate) ? candidate : fallback;
  }

  function dprCapForQuality(quality) {
    return DPR_CAPS[normalizeQuality(quality, QUALITY.HIGH)] || DPR_CAPS.HIGH;
  }

  function normalizedDevicePixelRatio(value) {
    return boundedNumber(value, 0, MAX_DEVICE_PIXEL_RATIO, 1) || 1;
  }

  function effectivePixelRatio(quality, devicePixelRatio) {
    return Math.max(1, Math.min(dprCapForQuality(quality), normalizedDevicePixelRatio(devicePixelRatio)));
  }

  function freeze(record) {
    return Object.freeze(record);
  }

  function optionFunction(options, key) {
    var candidate = read(options, key);
    return candidate.ok && typeof candidate.value === 'function' ? candidate.value : null;
  }

  function defaultScheduler(global) {
    var request = null;
    var cancel = null;
    var now = null;
    try {
      if (global && typeof global.requestAnimationFrame === 'function') request = global.requestAnimationFrame;
      if (global && typeof global.cancelAnimationFrame === 'function') cancel = global.cancelAnimationFrame;
      if (global && global.performance && typeof global.performance.now === 'function') now = global.performance.now;
    } catch (error) {}
    if (!now) now = Date.now;
    return {
      owner: global || null,
      requestFrame: request,
      cancelFrame: cancel,
      now: now
    };
  }

  function normalizeScheduler(options, global) {
    var configured = read(options, 'scheduler');
    var source = configured.ok && isPlainRecord(configured.value) ? configured.value : null;
    if (!source) return defaultScheduler(global);
    return {
      owner: source,
      requestFrame: optionFunction(source, 'requestFrame'),
      cancelFrame: optionFunction(source, 'cancelFrame'),
      now: optionFunction(source, 'now') || Date.now
    };
  }

  function normalizePolicy(options) {
    var configured = read(options, 'policy');
    var source = configured.ok && isPlainRecord(configured.value) ? configured.value : {};
    var downgradeFrameMs = boundedNumber(read(source, 'downgradeFrameMs').value, 1, MAX_FRAME_DELTA_MS, DEFAULT_POLICY.downgradeFrameMs);
    var upgradeFrameMs = boundedNumber(read(source, 'upgradeFrameMs').value, 1, MAX_FRAME_DELTA_MS, DEFAULT_POLICY.upgradeFrameMs);
    if (upgradeFrameMs >= downgradeFrameMs) {
      downgradeFrameMs = DEFAULT_POLICY.downgradeFrameMs;
      upgradeFrameMs = DEFAULT_POLICY.upgradeFrameMs;
    }
    return freeze({
      downgradeFrameMs: downgradeFrameMs,
      upgradeFrameMs: upgradeFrameMs,
      downgradeSamples: boundedInteger(read(source, 'downgradeSamples').value, 1, 600, DEFAULT_POLICY.downgradeSamples),
      upgradeSamples: boundedInteger(read(source, 'upgradeSamples').value, 1, 600, DEFAULT_POLICY.upgradeSamples),
      cooldownMs: boundedInteger(read(source, 'cooldownMs').value, 0, 60000, DEFAULT_POLICY.cooldownMs)
    });
  }

  function create(options) {
    var opts = isPlainRecord(options) ? options : {};
    var configuredQuality = read(opts, 'quality');
    var configuredMotion = read(opts, 'reducedMotion');
    var configuredDynamicDpr = read(opts, 'dynamicDpr');
    var scheduler = normalizeScheduler(opts, root);
    var policy = normalizePolicy(opts);
    var onFrame = optionFunction(opts, 'onFrame');
    var onResize = optionFunction(opts, 'onResize');
    var quality = normalizeQuality(configuredQuality.ok ? configuredQuality.value : undefined, QUALITY.HIGH);
    var reducedMotion = configuredMotion.ok && configuredMotion.value === true;
    var dynamicDpr = configuredDynamicDpr.ok && configuredDynamicDpr.value === true;
    var mounted = false;
    var manuallySuspended = false;
    var hidden = false;
    var contextLost = false;
    var disposed = false;
    var callbackFaulted = false;
    var schedulerFaulted = false;
    var generation = 0;
    var pendingResize = null;
    var suggestedQuality = null;
    var cooldownUntil = 0;
    var lastClock = 0;
    var lastFrameTimestamp = null;
    var slowSamples = 0;
    var fastSamples = 0;
    var scheduled = false;
    var scheduledTicket = null;
    var scheduledToken = 0;
    var scheduleTokenCounter = 0;
    var diagnostics = {
      frameBudgetSamples: 0,
      resizeRequests: 0,
      resizeApplied: 0,
      frameCallbacks: 0,
      scheduleRequests: 0,
      scheduleCancels: 0,
      staleCallbacks: 0,
      callbackFailures: 0,
      schedulerFailures: 0,
      recommendations: 0,
      lastObservedFrameMs: 0,
      lastFrameDeltaMs: 0,
      lastResizeWidth: 0,
      lastResizeHeight: 0,
      lastDevicePixelRatio: 1,
      lastPixelRatio: effectivePixelRatio(quality, 1)
    };

    function monotonicNow(candidate) {
      var value = finite(candidate) && candidate >= 0 ? candidate : null;
      if (value === null) {
        try {
          value = scheduler.now ? scheduler.now.call(scheduler.owner) : Date.now();
        } catch (error) {
          diagnostics.schedulerFailures += 1;
          schedulerFaulted = true;
          value = lastClock;
        }
      }
      value = nonNegative(value, lastClock);
      if (value < lastClock) value = lastClock;
      lastClock = value;
      return value;
    }

    function cooldownRemaining(now) {
      return Math.max(0, cooldownUntil - (finite(now) ? now : lastClock));
    }

    function resetSampleStreaks() {
      slowSamples = 0;
      fastSamples = 0;
    }

    function canFlushResize() {
      return !disposed && mounted && !manuallySuspended && !hidden && !contextLost && !callbackFaulted && quality !== QUALITY.FALLBACK;
    }

    function canRunLoop() {
      return canFlushResize() && !reducedMotion && !!onFrame;
    }

    function shouldSchedule() {
      return (pendingResize !== null && canFlushResize()) || canRunLoop();
    }

    function resizeContext(surface) {
      var cap = dprCapForQuality(quality);
      var pixelRatio = effectivePixelRatio(quality, surface.devicePixelRatio);
      return freeze({
        width: surface.width,
        height: surface.height,
        devicePixelRatio: surface.devicePixelRatio,
        pixelRatio: pixelRatio,
        dprCap: cap,
        generation: generation,
        quality: quality
      });
    }

    function frameContext(timestamp) {
      var current = monotonicNow(timestamp);
      var delta = lastFrameTimestamp === null ? 0 : Math.max(0, Math.min(MAX_FRAME_DELTA_MS, current - lastFrameTimestamp));
      lastFrameTimestamp = current;
      diagnostics.lastFrameDeltaMs = delta;
      return freeze({
        timestamp: current,
        deltaMs: delta,
        generation: generation,
        quality: quality,
        dprCap: dprCapForQuality(quality),
        reducedMotion: reducedMotion
      });
    }

    function cancelScheduledFrame() {
      if (!scheduled) return;
      var ticket = scheduledTicket;
      scheduled = false;
      scheduledTicket = null;
      scheduledToken = 0;
      diagnostics.scheduleCancels += 1;
      if (!scheduler.cancelFrame) return;
      try {
        scheduler.cancelFrame.call(scheduler.owner, ticket);
      } catch (error) {
        diagnostics.schedulerFailures += 1;
        schedulerFaulted = true;
      }
    }

    function invokeResize() {
      if (!pendingResize || !canFlushResize()) return false;
      var surface = pendingResize;
      pendingResize = null;
      var context = resizeContext(surface);
      diagnostics.resizeApplied += 1;
      diagnostics.lastResizeWidth = context.width;
      diagnostics.lastResizeHeight = context.height;
      diagnostics.lastDevicePixelRatio = context.devicePixelRatio;
      diagnostics.lastPixelRatio = context.pixelRatio;
      if (!onResize) return true;
      try {
        onResize(context);
        return true;
      } catch (error) {
        diagnostics.callbackFailures += 1;
        callbackFaulted = true;
        return false;
      }
    }

    function invokeFrame(timestamp) {
      if (!canRunLoop()) return false;
      diagnostics.frameCallbacks += 1;
      try {
        onFrame(frameContext(timestamp));
        return true;
      } catch (error) {
        diagnostics.callbackFailures += 1;
        callbackFaulted = true;
        return false;
      }
    }

    function runScheduledFrame(token, timestamp) {
      if (!scheduled || token !== scheduledToken) {
        diagnostics.staleCallbacks += 1;
        return;
      }
      scheduled = false;
      scheduledTicket = null;
      scheduledToken = 0;
      if (disposed) return;
      invokeResize();
      if (!disposed) invokeFrame(timestamp);
      if (!disposed) refreshSchedule();
    }

    function requestScheduledFrame() {
      if (scheduled || !shouldSchedule()) return;
      if (!scheduler.requestFrame || schedulerFaulted) {
        if (pendingResize !== null && canFlushResize()) invokeResize();
        return;
      }
      var token = ++scheduleTokenCounter;
      scheduled = true;
      scheduledToken = token;
      diagnostics.scheduleRequests += 1;
      try {
        var ticket = scheduler.requestFrame.call(scheduler.owner, function scheduledFrame(timestamp) {
          runScheduledFrame(token, timestamp);
        });
        if (scheduled && scheduledToken === token) scheduledTicket = ticket;
      } catch (error) {
        if (scheduled && scheduledToken === token) {
          scheduled = false;
          scheduledTicket = null;
          scheduledToken = 0;
        }
        diagnostics.schedulerFailures += 1;
        schedulerFaulted = true;
        if (pendingResize !== null && canFlushResize()) invokeResize();
      }
    }

    function refreshSchedule() {
      if (disposed || !shouldSchedule()) {
        cancelScheduledFrame();
        return;
      }
      requestScheduledFrame();
    }

    function snapshot() {
      var cap = dprCapForQuality(quality);
      var pending = pendingResize ? freeze({
        width: pendingResize.width,
        height: pendingResize.height,
        devicePixelRatio: pendingResize.devicePixelRatio
      }) : null;
      var numericDiagnostics = freeze({
        frameBudgetSamples: diagnostics.frameBudgetSamples,
        resizeRequests: diagnostics.resizeRequests,
        resizeApplied: diagnostics.resizeApplied,
        frameCallbacks: diagnostics.frameCallbacks,
        scheduleRequests: diagnostics.scheduleRequests,
        scheduleCancels: diagnostics.scheduleCancels,
        staleCallbacks: diagnostics.staleCallbacks,
        callbackFailures: diagnostics.callbackFailures,
        schedulerFailures: diagnostics.schedulerFailures,
        recommendations: diagnostics.recommendations,
        lastObservedFrameMs: diagnostics.lastObservedFrameMs,
        lastFrameDeltaMs: diagnostics.lastFrameDeltaMs,
        lastResizeWidth: diagnostics.lastResizeWidth,
        lastResizeHeight: diagnostics.lastResizeHeight,
        lastDevicePixelRatio: diagnostics.lastDevicePixelRatio,
        lastPixelRatio: diagnostics.lastPixelRatio,
        slowSamples: slowSamples,
        fastSamples: fastSamples,
        cooldownRemainingMs: cooldownRemaining(lastClock)
      });
      return freeze({
        quality: quality,
        suggestedQuality: suggestedQuality,
        dprCap: cap,
        dynamicDpr: dynamicDpr,
        generation: generation,
        mounted: mounted,
        suspended: manuallySuspended,
        hidden: hidden,
        reducedMotion: reducedMotion,
        contextLost: contextLost,
        disposed: disposed,
        loopActive: scheduled && canRunLoop(),
        pendingResize: pending,
        diagnostics: numericDiagnostics
      });
    }

    function result(accepted, additions) {
      var output = { accepted: accepted === true, snapshot: snapshot() };
      if (isPlainRecord(additions)) {
        Object.keys(additions).forEach(function addResult(key) {
          output[key] = additions[key];
        });
      }
      return freeze(output);
    }

    function normalizeSurface(message) {
      var width = read(message, 'width');
      var height = read(message, 'height');
      var devicePixelRatio = read(message, 'devicePixelRatio');
      if (!width.ok || !height.ok || !finite(width.value) || !finite(height.value) || width.value <= 0 || height.value <= 0) return null;
      return freeze({
        width: Math.max(1, Math.min(MAX_DIMENSION, Math.floor(width.value))),
        height: Math.max(1, Math.min(MAX_DIMENSION, Math.floor(height.value))),
        devicePixelRatio: normalizedDevicePixelRatio(devicePixelRatio.ok ? devicePixelRatio.value : 1)
      });
    }

    function applyResize(message) {
      var surface = normalizeSurface(message);
      if (!surface) return result(false);
      pendingResize = surface;
      diagnostics.resizeRequests += 1;
      refreshSchedule();
      return result(true, { queued: pendingResize !== null });
    }

    function applyQuality(message) {
      var requested = read(message, 'quality');
      var nextQuality = requested.ok ? normalizeQuality(requested.value, null) : null;
      if (!nextQuality) return result(false);
      var changed = quality !== nextQuality;
      quality = nextQuality;
      // A QualityAdapter owns the final decision. Re-applying the current
      // quality is therefore also a valid acknowledgement/rejection path.
      suggestedQuality = null;
      if (changed) {
        cooldownUntil = monotonicNow() + policy.cooldownMs;
        resetSampleStreaks();
        if (pendingResize === null && mounted && diagnostics.lastResizeWidth > 0 && diagnostics.lastResizeHeight > 0) {
          pendingResize = freeze({
            width: Math.max(1, diagnostics.lastResizeWidth || 1),
            height: Math.max(1, diagnostics.lastResizeHeight || 1),
            devicePixelRatio: normalizedDevicePixelRatio(diagnostics.lastDevicePixelRatio)
          });
        }
      }
      refreshSchedule();
      return result(true, { changed: changed });
    }

    function applyEnvironment(message) {
      var value = read(message, 'reducedMotion');
      if (!value.ok || typeof value.value !== 'boolean') return result(false);
      reducedMotion = value.value;
      if (reducedMotion) lastFrameTimestamp = null;
      refreshSchedule();
      return result(true);
    }

    function applyLifecycle(message) {
      var action = read(message, 'action');
      if (!action.ok || typeof action.value !== 'string') return result(false);
      var now;
      if (action.value === 'mount') {
        mounted = true;
      } else if (action.value === 'unmount') {
        mounted = false;
        lastFrameTimestamp = null;
      } else if (action.value === 'suspend') {
        manuallySuspended = true;
        lastFrameTimestamp = null;
      } else if (action.value === 'resume') {
        manuallySuspended = false;
      } else if (action.value === 'hidden') {
        hidden = true;
        lastFrameTimestamp = null;
      } else if (action.value === 'visible') {
        hidden = false;
      } else if (action.value === 'context-lost') {
        if (!contextLost) {
          contextLost = true;
          generation += 1;
          suggestedQuality = null;
          lastFrameTimestamp = null;
          resetSampleStreaks();
        }
      } else if (action.value === 'context-restored') {
        if (contextLost) {
          contextLost = false;
          generation += 1;
          resetSampleStreaks();
        }
      } else {
        return result(false);
      }
      now = monotonicNow();
      if (action.value === 'context-lost' || action.value === 'context-restored') cooldownUntil = Math.max(cooldownUntil, now);
      refreshSchedule();
      return result(true);
    }

    function observeFrameBudget(sample) {
      if (disposed || !isPlainRecord(sample)) return result(false, { recommendation: freeze({ quality: null, dprCap: dprCapForQuality(quality), changed: false, cooldownRemainingMs: cooldownRemaining(lastClock) }) });
      var frameMs = read(sample, 'frameMs');
      var observedAt = read(sample, 'at');
      if (!frameMs.ok || !finite(frameMs.value) || frameMs.value < 0 || frameMs.value > MAX_FRAME_DELTA_MS) {
        return result(false, { recommendation: freeze({ quality: suggestedQuality, dprCap: dprCapForQuality(suggestedQuality || quality), changed: false, cooldownRemainingMs: cooldownRemaining(lastClock) }) });
      }
      var now = monotonicNow(observedAt.ok ? observedAt.value : undefined);
      diagnostics.frameBudgetSamples += 1;
      diagnostics.lastObservedFrameMs = frameMs.value;
      var changed = false;
      if (dynamicDpr && mounted && !manuallySuspended && !hidden && !contextLost && !reducedMotion && quality !== QUALITY.FALLBACK && !callbackFaulted && !suggestedQuality && now >= cooldownUntil) {
        var nextQuality = null;
        if (frameMs.value >= policy.downgradeFrameMs) {
          slowSamples += 1;
          fastSamples = 0;
          if (slowSamples >= policy.downgradeSamples) {
            var lowerIndex = DYNAMIC_QUALITY_ORDER.indexOf(quality) + 1;
            nextQuality = DYNAMIC_QUALITY_ORDER[lowerIndex] || null;
          }
        } else if (frameMs.value <= policy.upgradeFrameMs) {
          fastSamples += 1;
          slowSamples = 0;
          if (fastSamples >= policy.upgradeSamples) {
            var higherIndex = DYNAMIC_QUALITY_ORDER.indexOf(quality) - 1;
            nextQuality = higherIndex >= 0 ? DYNAMIC_QUALITY_ORDER[higherIndex] : null;
          }
        } else {
          resetSampleStreaks();
        }
        if (nextQuality && nextQuality !== quality) {
          suggestedQuality = nextQuality;
          cooldownUntil = now + policy.cooldownMs;
          diagnostics.recommendations += 1;
          resetSampleStreaks();
          changed = true;
        }
      }
      return result(true, { recommendation: freeze({
        quality: suggestedQuality,
        dprCap: dprCapForQuality(suggestedQuality || quality),
        changed: changed,
        cooldownRemainingMs: cooldownRemaining(now)
      }) });
    }

    function apply(message) {
      if (disposed || !isPlainRecord(message)) return result(false);
      var type = read(message, 'type');
      if (!type.ok || typeof type.value !== 'string') return result(false);
      if (type.value === 'resize') return applyResize(message);
      if (type.value === 'quality') return applyQuality(message);
      if (type.value === 'environment') return applyEnvironment(message);
      if (type.value === 'lifecycle') return applyLifecycle(message);
      return result(false);
    }

    function dispose() {
      if (!disposed) {
        disposed = true;
        mounted = false;
        pendingResize = null;
        suggestedQuality = null;
        cancelScheduledFrame();
      }
      return snapshot();
    }

    return freeze({
      apply: apply,
      observeFrameBudget: observeFrameBudget,
      dispose: dispose,
      snapshot: snapshot
    });
  }

  return freeze({
    create: create,
    QUALITY: QUALITY
  });
}));
