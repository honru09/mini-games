/**
 * RendererQualityAdapter
 *
 * Converts animation-loop frame deltas into bounded, reversible runtime
 * quality changes.  It deliberately owns no DOM, Three.js object, game state,
 * storage, network, or persistence concern: the Renderer adapter remains the
 * final QualityAdapter and may accept or reject every recommendation.
 */
(function installRendererQualityAdapter(root, factory) {
  var api = factory(root);
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root && typeof root === 'object') root.RendererQualityAdapter = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createRendererQualityAdapterModule(root) {
  'use strict';

  var QUALITY = Object.freeze({ HIGH:'HIGH', BALANCED:'BALANCED', LOW:'LOW' });
  var QUALITY_ORDER = Object.freeze([QUALITY.HIGH, QUALITY.BALANCED, QUALITY.LOW]);
  var MAX_FRAME_DELTA_MS = 1000;

  function freeze(value) {
    return Object.freeze(value);
  }

  function isPlainRecord(value) {
    if (!value || typeof value !== 'object' || Object.prototype.toString.call(value) !== '[object Object]') return false;
    var prototype = Object.getPrototypeOf(value);
    if (prototype === null || prototype === Object.prototype) return true;
    try {
      return Object.prototype.hasOwnProperty.call(prototype, 'constructor') &&
        prototype.constructor && prototype.constructor.name === 'Object';
    } catch (error) {
      return false;
    }
  }

  function read(value, key) {
    try {
      return value && value[key];
    } catch (error) {
      return undefined;
    }
  }

  function normalizeQuality(value, fallback) {
    var candidate = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return QUALITY_ORDER.indexOf(candidate) >= 0 ? candidate : fallback;
  }

  function finite(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function clampToCeiling(candidate, ceiling) {
    var candidateIndex = QUALITY_ORDER.indexOf(candidate);
    var ceilingIndex = QUALITY_ORDER.indexOf(ceiling);
    if (candidateIndex < 0 || ceilingIndex < 0) return ceiling;
    return QUALITY_ORDER[Math.max(candidateIndex, ceilingIndex)];
  }

  function create(options) {
    var opts = isPlainRecord(options) ? options : {};
    var governorModule = root && root.RendererRuntimeGovernor;
    if (!governorModule || typeof governorModule.create !== 'function') return null;

    var onQuality = typeof read(opts, 'onQuality') === 'function' ? read(opts, 'onQuality') : null;
    if (!onQuality) return null;

    var ceilingQuality = normalizeQuality(read(opts, 'quality'), QUALITY.BALANCED);
    var effectiveQuality = ceilingQuality;
    var reducedMotion = read(opts, 'reducedMotion') === true;
    var mounted = false;
    var suspended = false;
    var contextLost = false;
    var disposed = false;
    var lastFrameAt = null;
    var recommendationsAccepted = 0;
    var recommendationsRejected = 0;
    var observedFrames = 0;
    var governor = governorModule.create({
      quality: effectiveQuality,
      reducedMotion: reducedMotion || ceilingQuality === QUALITY.LOW,
      dynamicDpr: true,
      policy: isPlainRecord(read(opts, 'policy')) ? read(opts, 'policy') : undefined,
      scheduler: isPlainRecord(read(opts, 'scheduler')) ? read(opts, 'scheduler') : undefined
    });

    function snapshot() {
      return freeze({
        ceilingQuality: ceilingQuality,
        effectiveQuality: effectiveQuality,
        reducedMotion: reducedMotion,
        mounted: mounted,
        suspended: suspended,
        contextLost: contextLost,
        disposed: disposed,
        observedFrames: observedFrames,
        recommendationsAccepted: recommendationsAccepted,
        recommendationsRejected: recommendationsRejected,
        governor: governor && typeof governor.snapshot === 'function' ? governor.snapshot() : null
      });
    }

    function result(accepted, reason, additions) {
      var output = { accepted: accepted === true, reason: reason || null, snapshot: snapshot() };
      if (additions) Object.keys(additions).forEach(function copy(key) { output[key] = additions[key]; });
      return freeze(output);
    }

    function resetFrameClock() {
      lastFrameAt = null;
    }

    function syncGovernorEnvironment() {
      if (!governor) return false;
      return governor.apply({
        type:'environment',
        reducedMotion: reducedMotion || ceilingQuality === QUALITY.LOW
      }).accepted === true;
    }

    function acknowledgeQuality(nextQuality) {
      if (!governor) return false;
      return governor.apply({ type:'quality', quality:nextQuality }).accepted === true;
    }

    function applyRecommendation(candidate, frameMs, at) {
      var nextQuality = clampToCeiling(candidate, ceilingQuality);
      if (nextQuality === effectiveQuality) {
        acknowledgeQuality(effectiveQuality);
        return result(true, 'ceiling_reaffirmed', { changed:false, quality:effectiveQuality, frameMs:frameMs });
      }
      var accepted = false;
      try {
        accepted = onQuality(nextQuality, freeze({
          source:'frame_budget',
          previousQuality:effectiveQuality,
          ceilingQuality:ceilingQuality,
          frameMs:frameMs,
          at:at
        })) !== false;
      } catch (error) {
        accepted = false;
      }
      if (accepted) {
        effectiveQuality = nextQuality;
        recommendationsAccepted += 1;
      } else {
        recommendationsRejected += 1;
      }
      acknowledgeQuality(effectiveQuality);
      return result(accepted, accepted ? 'quality_applied' : 'quality_rejected', {
        changed:accepted,
        quality:effectiveQuality,
        frameMs:frameMs
      });
    }

    function observeFrame(timestamp) {
      if (disposed || !mounted || suspended || contextLost) return result(false, 'inactive');
      if (reducedMotion || ceilingQuality === QUALITY.LOW) {
        resetFrameClock();
        return result(false, 'static_quality');
      }
      if (!finite(timestamp) || timestamp < 0) return result(false, 'invalid_timestamp');
      if (lastFrameAt === null || timestamp <= lastFrameAt) {
        lastFrameAt = timestamp;
        return result(true, 'clock_primed', { sampled:false });
      }
      var frameMs = Math.min(MAX_FRAME_DELTA_MS, timestamp - lastFrameAt);
      lastFrameAt = timestamp;
      observedFrames += 1;
      var observation = governor.observeFrameBudget({ frameMs:frameMs, at:timestamp });
      var recommendation = observation && observation.recommendation;
      var candidate = recommendation && normalizeQuality(recommendation.quality, null);
      if (!candidate) return result(true, 'observed', { sampled:true, changed:false, frameMs:frameMs });
      return applyRecommendation(candidate, frameMs, timestamp);
    }

    function mount() {
      if (disposed) return result(false, 'disposed');
      mounted = true;
      suspended = false;
      contextLost = false;
      resetFrameClock();
      governor.apply({ type:'lifecycle', action:'mount' });
      syncGovernorEnvironment();
      return result(true, 'mounted');
    }

    function setQuality(value) {
      if (disposed) return result(false, 'disposed');
      var normalized = normalizeQuality(value, null);
      if (!normalized) return result(false, 'invalid_quality');
      ceilingQuality = normalized;
      effectiveQuality = normalized;
      resetFrameClock();
      acknowledgeQuality(normalized);
      syncGovernorEnvironment();
      return result(true, 'quality_synced', { quality:normalized });
    }

    function environment(value) {
      if (disposed || !isPlainRecord(value) || typeof read(value, 'reducedMotion') !== 'boolean') return result(false, 'invalid_environment');
      reducedMotion = read(value, 'reducedMotion') === true;
      resetFrameClock();
      syncGovernorEnvironment();
      return result(true, 'environment_synced');
    }

    function suspend() {
      if (disposed) return result(false, 'disposed');
      suspended = true;
      resetFrameClock();
      governor.apply({ type:'lifecycle', action:'suspend' });
      return result(true, 'suspended');
    }

    function resume() {
      if (disposed || contextLost) return result(false, contextLost ? 'context_lost' : 'disposed');
      suspended = false;
      resetFrameClock();
      governor.apply({ type:'lifecycle', action:'resume' });
      return result(true, 'resumed');
    }

    function loseContext() {
      if (disposed) return result(false, 'disposed');
      contextLost = true;
      suspended = true;
      resetFrameClock();
      governor.apply({ type:'lifecycle', action:'context-lost' });
      return result(true, 'context_lost');
    }

    function dispose() {
      if (!disposed) {
        disposed = true;
        mounted = false;
        suspended = true;
        resetFrameClock();
        if (governor) governor.dispose();
      }
      return snapshot();
    }

    return freeze({
      mount:mount,
      observeFrame:observeFrame,
      setQuality:setQuality,
      environment:environment,
      suspend:suspend,
      resume:resume,
      contextLost:loseContext,
      dispose:dispose,
      snapshot:snapshot
    });
  }

  return freeze({ create:create, QUALITY:QUALITY });
}));
