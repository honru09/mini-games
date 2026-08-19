#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(ROOT, 'public', 'src', 'core', '13-renderer-runtime-governor.js');
const SOURCE = fs.readFileSync(MODULE_PATH, 'utf8').replace(/^\uFEFF/, '');
const Governor = require(MODULE_PATH);
let failures = 0;

function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

function sameKeys(value, keys) {
  return Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
}

function makeScheduler() {
  let now = 0;
  let nextId = 0;
  let maxPending = 0;
  const pending = new Map();
  const cancelled = new Map();
  return {
    requestFrame(callback) {
      const id = ++nextId;
      pending.set(id, callback);
      maxPending = Math.max(maxPending, pending.size);
      return id;
    },
    cancelFrame(id) {
      const callback = pending.get(id);
      if (callback) {
        pending.delete(id);
        cancelled.set(id, callback);
      }
    },
    now() {
      return now;
    },
    step(at) {
      now = at;
      const entry = pending.entries().next().value;
      if (!entry) return null;
      const [id, callback] = entry;
      pending.delete(id);
      callback(at);
      return id;
    },
    fireCancelled(id, at) {
      now = at;
      const callback = cancelled.get(id);
      if (callback) callback(at);
    },
    pendingCount() {
      return pending.size;
    },
    firstPendingId() {
      const entry = pending.keys().next();
      return entry.done ? null : entry.value;
    },
    maxPending() {
      return maxPending;
    }
  };
}

check('module exports the narrow public seam', sameKeys(Governor, ['create', 'QUALITY']));
check('quality ladder remains compatible with Ghost3D static adapters', Object.keys(Governor.QUALITY).join(',') === 'HIGH,BALANCED,LOW,FALLBACK');
check('governor stays renderer- and persistence-free', !/\b(?:THREE|WebGL|localStorage|sessionStorage|fetch|XMLHttpRequest|navigator|document)\b/.test(SOURCE));

let browserGlobalPass = false;
try {
  const browserGlobal = {};
  vm.runInNewContext(SOURCE, { globalThis: browserGlobal, Date, Object, Set, Number, Math });
  browserGlobalPass = sameKeys(browserGlobal.RendererRuntimeGovernor, ['create', 'QUALITY']);
} catch (_error) {}
check('browser-global build exposes only the governor seam', browserGlobalPass);
const crossRealmGovernor = Governor.create({ scheduler: makeScheduler() });
const crossRealmLifecycle = vm.runInNewContext("({ type: 'lifecycle', action: 'mount' })");
check('pure lifecycle signals accept cross-realm records', crossRealmGovernor.apply(crossRealmLifecycle).accepted && crossRealmGovernor.snapshot().mounted);

const staticScheduler = makeScheduler();
const staticResizes = [];
const staticGovernor = Governor.create({
  scheduler: staticScheduler,
  onResize: context => staticResizes.push(context)
});
check('instance owns only apply/observe/dispose/snapshot', sameKeys(staticGovernor, ['apply', 'observeFrameBudget', 'dispose', 'snapshot']));
check('default quality is static HIGH with the legacy DPR cap', staticGovernor.snapshot().quality === 'HIGH' && staticGovernor.snapshot().dprCap === 2 && !staticGovernor.snapshot().dynamicDpr);
staticGovernor.apply({ type: 'lifecycle', action: 'mount' });
staticGovernor.apply({ type: 'resize', width: 101, height: 55, devicePixelRatio: 3 });
staticGovernor.apply({ type: 'resize', width: 202, height: 111, devicePixelRatio: 3 });
staticGovernor.apply({ type: 'resize', width: 303, height: 222, devicePixelRatio: 3 });
check('resize bursts own one pending callback', staticScheduler.pendingCount() === 1 && staticGovernor.snapshot().diagnostics.resizeRequests === 3);
staticScheduler.step(10);
check('resize coalescing forwards only the latest numeric surface', staticResizes.length === 1 && staticResizes[0].width === 303 && staticResizes[0].height === 222 && staticResizes[0].pixelRatio === 2 && Object.isFrozen(staticResizes[0]));
const staticObservation = staticGovernor.observeFrameBudget({ frameMs: 900, at: 11 });
check('default observation preserves static DPR behavior', staticObservation.accepted && staticObservation.recommendation.quality === null && !staticObservation.recommendation.changed && staticGovernor.snapshot().quality === 'HIGH');
staticGovernor.apply({ type: 'quality', quality: 'BALANCED' });
staticScheduler.step(12);
staticGovernor.apply({ type: 'quality', quality: 'LOW' });
staticScheduler.step(13);
check('legacy DPR caps stay exact for BALANCED and LOW', staticResizes[1].pixelRatio === 1.5 && staticResizes[2].pixelRatio === 1);

const adaptiveScheduler = makeScheduler();
const adaptive = Governor.create({
  scheduler: adaptiveScheduler,
  dynamicDpr: true,
  policy: {
    downgradeFrameMs: 20,
    upgradeFrameMs: 10,
    downgradeSamples: 2,
    upgradeSamples: 2,
    cooldownMs: 100
  }
});
adaptive.apply({ type: 'lifecycle', action: 'mount' });
const slowOne = adaptive.observeFrameBudget({ frameMs: 25, at: 0 });
const slowTwo = adaptive.observeFrameBudget({ frameMs: 25, at: 1 });
check('dynamic DPR uses a hysteresis streak before a downgrade suggestion', slowOne.recommendation.quality === null && slowTwo.recommendation.changed && slowTwo.recommendation.quality === 'BALANCED' && slowTwo.recommendation.dprCap === 1.5);
check('governor never applies its own quality suggestion', adaptive.snapshot().quality === 'HIGH' && adaptive.snapshot().suggestedQuality === 'BALANCED');
adaptive.apply({ type: 'quality', quality: 'BALANCED' });
const cooldownObservation = adaptive.observeFrameBudget({ frameMs: 5, at: 50 });
const fastOne = adaptive.observeFrameBudget({ frameMs: 5, at: 101 });
const fastTwo = adaptive.observeFrameBudget({ frameMs: 5, at: 102 });
check('quality changes enforce cooldown before a separate upgrade streak', cooldownObservation.recommendation.quality === null && fastOne.recommendation.quality === null && fastTwo.recommendation.changed && fastTwo.recommendation.quality === 'HIGH');
const rejectedScheduler = makeScheduler();
const rejectedRecommendation = Governor.create({
  scheduler: rejectedScheduler,
  dynamicDpr: true,
  policy: { downgradeFrameMs: 20, upgradeFrameMs: 10, downgradeSamples: 1, upgradeSamples: 2, cooldownMs: 100 }
});
rejectedRecommendation.apply({ type: 'lifecycle', action: 'mount' });
rejectedRecommendation.observeFrameBudget({ frameMs: 30, at: 0 });
rejectedRecommendation.apply({ type: 'quality', quality: 'HIGH' });
check('QualityAdapter can explicitly reject a recommendation by reaffirming current quality', rejectedRecommendation.snapshot().quality === 'HIGH' && rejectedRecommendation.snapshot().suggestedQuality === null);

const lifecycleScheduler = makeScheduler();
const frames = [];
const lifecycleResizes = [];
const lifecycle = Governor.create({
  scheduler: lifecycleScheduler,
  onFrame: context => frames.push(context),
  onResize: context => lifecycleResizes.push(context)
});
lifecycle.apply({ type: 'lifecycle', action: 'mount' });
lifecycle.apply({ type: 'lifecycle', action: 'mount' });
check('loop ownership schedules at most one frame after repeated mounts', lifecycleScheduler.pendingCount() === 1 && lifecycleScheduler.maxPending() === 1);
lifecycle.apply({ type: 'resize', width: 640, height: 360, devicePixelRatio: 2 });
lifecycleScheduler.step(20);
check('a shared callback flushes resize before one owned frame', lifecycleResizes.length === 1 && frames.length === 1 && lifecycleScheduler.pendingCount() === 1 && frames[0].generation === 0);
const cancelledLoopId = lifecycleScheduler.firstPendingId();
lifecycle.apply({ type: 'lifecycle', action: 'hidden' });
lifecycle.apply({ type: 'resize', width: 800, height: 450, devicePixelRatio: 2 });
lifecycleScheduler.fireCancelled(cancelledLoopId, 21);
check('hidden state cancels the loop and stale callbacks cannot render', lifecycleScheduler.pendingCount() === 0 && frames.length === 1 && lifecycle.snapshot().diagnostics.staleCallbacks === 1 && lifecycle.snapshot().pendingResize.width === 800);
lifecycle.apply({ type: 'lifecycle', action: 'visible' });
lifecycle.apply({ type: 'environment', reducedMotion: true });
lifecycleScheduler.step(22);
check('reduced motion flushes the retained resize without continuing the loop', lifecycleResizes.length === 2 && frames.length === 1 && lifecycleScheduler.pendingCount() === 0 && lifecycle.snapshot().reducedMotion);
lifecycle.apply({ type: 'environment', reducedMotion: false });
check('clearing reduced motion reclaims exactly one loop callback', lifecycleScheduler.pendingCount() === 1 && lifecycleScheduler.maxPending() === 1);
lifecycle.apply({ type: 'resize', width: 1024, height: 576, devicePixelRatio: 2 });
const generationBeforeLoss = lifecycle.snapshot().generation;
const activeLoopId = lifecycleScheduler.firstPendingId();
lifecycle.apply({ type: 'lifecycle', action: 'context-lost' });
lifecycleScheduler.fireCancelled(activeLoopId, 23);
check('context loss only advances generation and fail-safes scheduled work', lifecycle.snapshot().contextLost && lifecycle.snapshot().generation === generationBeforeLoss + 1 && lifecycleScheduler.pendingCount() === 0 && frames.length === 1 && lifecycle.snapshot().pendingResize.width === 1024);
lifecycle.apply({ type: 'lifecycle', action: 'context-restored' });
check('context restoration advances a fresh generation without invoking renderer recovery', !lifecycle.snapshot().contextLost && lifecycle.snapshot().generation === generationBeforeLoss + 2 && lifecycleScheduler.pendingCount() === 1);
lifecycleScheduler.step(24);
check('the fresh generation alone consumes retained resize work after restoration', lifecycleResizes.length === 3 && lifecycleResizes[2].generation === generationBeforeLoss + 2 && frames.length === 2);
lifecycle.apply({ type: 'lifecycle', action: 'suspend' });
check('suspend cancels the owned loop', lifecycleScheduler.pendingCount() === 0 && lifecycle.snapshot().suspended);
lifecycle.apply({ type: 'lifecycle', action: 'resume' });
check('resume owns exactly one new loop callback', lifecycleScheduler.pendingCount() === 1 && lifecycleScheduler.maxPending() === 1);
const disposeLoopId = lifecycleScheduler.firstPendingId();
lifecycle.dispose();
lifecycleScheduler.fireCancelled(disposeLoopId, 24);
check('dispose is idempotent and stale callbacks stay inert', lifecycle.dispose().disposed && lifecycleScheduler.pendingCount() === 0 && frames.length === 2 && !lifecycle.apply({ type: 'resize', width: 1, height: 1 }).accepted);

const failingScheduler = makeScheduler();
const failing = Governor.create({
  scheduler: failingScheduler,
  onFrame() {
    throw new Error('intentional test callback failure');
  }
});
failing.apply({ type: 'lifecycle', action: 'mount' });
failingScheduler.step(30);
check('callback failure stops the finite loop without retaining error text', failing.snapshot().diagnostics.callbackFailures === 1 && failingScheduler.pendingCount() === 0 && !failing.snapshot().loopActive);

const diagnosticSnapshot = staticGovernor.snapshot().diagnostics;
check('diagnostics contain finite numeric values only', Object.values(diagnosticSnapshot).every(value => typeof value === 'number' && Number.isFinite(value)));

if (failures) {
  console.error(`RENDERER_RUNTIME_GOVERNOR_FAILURES=${failures}`);
  process.exitCode = 1;
} else {
  console.log('RENDERER_RUNTIME_GOVERNOR_ALL_PASS');
}
