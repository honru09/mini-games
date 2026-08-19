/* Ghost Game Game Stage status motion: a tiny, lazy GSAP presentation island. */
(function installGhostGameStageMotion(globalScope) {
  'use strict';

  const ENTRY_URL = './game-stage-motion-entry.js';
  let adapter = null;
  let loaderPromise = null;
  let loaderFailed = false;
  let disposed = false;
  let active = null;
  let generation = 0;
  let motionQuery = null;

  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
  function environmentBlocked() { return disposed || reducedMotion() || !!(globalScope.document && globalScope.document.hidden); }
  function clear(node) {
    if (!node || !node.style) return;
    ['transform', 'opacity', 'visibility', 'willChange'].forEach(property => {
      try { node.style[property] = ''; } catch (_) {}
    });
  }
  function safe(fn, ...args) { try { return typeof fn === 'function' ? fn(...args) : undefined; } catch (_) { return undefined; } }
  function importAdapter() {
    if (adapter || loaderFailed || disposed) return Promise.resolve(adapter);
    if (loaderPromise) return loaderPromise;
    loaderPromise = import(ENTRY_URL).then(moduleValue => {
      if (disposed) return null;
      if (!moduleValue || typeof moduleValue.createGameStageMotionAdapter !== 'function') throw new Error('invalid_game_stage_motion_module');
      const created = moduleValue.createGameStageMotionAdapter();
      if (!created || typeof created.run !== 'function' || typeof created.settle !== 'function' || typeof created.dispose !== 'function') throw new Error('invalid_game_stage_motion_adapter');
      adapter = created;
      return adapter;
    }).catch(() => { loaderFailed = true; adapter = null; return null; });
    return loaderPromise;
  }
  function settle(reason) {
    generation += 1;
    const running = active;
    active = null;
    if (running) safe(running.handle && running.handle.kill, reason || 'settle');
    if (adapter) safe(adapter.settle, reason || 'settle');
    if (running) clear(running.node);
  }
  function pulse(node, level) {
    if (!node || disposed) return false;
    const requestGeneration = ++generation;
    const running = active;
    active = null;
    if (running) safe(running.handle && running.handle.kill, 'replace');
    clear(node);
    if (environmentBlocked() || !adapter) {
      if (!adapter && !loaderFailed && !environmentBlocked()) importAdapter();
      return false;
    }
    try {
      const handle = adapter.run({ node, level: String(level || 'neutral'), onComplete() {
        if (!active || active.generation !== requestGeneration || requestGeneration !== generation) return;
        active = null;
        clear(node);
      }});
      active = { generation: requestGeneration, node, handle };
      return true;
    } catch (_) { clear(node); return false; }
  }
  function handleVisibility() { if (globalScope.document && globalScope.document.hidden) settle('document_hidden'); }
  function handleMotionPreference() { if (reducedMotion()) settle('reduced_motion'); }
  function dispose(reason) {
    if (disposed) return;
    disposed = true;
    settle(reason || 'dispose');
    if (adapter) safe(adapter.dispose, reason || 'dispose');
    adapter = null;
    if (globalScope.document && globalScope.document.removeEventListener) globalScope.document.removeEventListener('visibilitychange', handleVisibility);
    if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener('change', handleMotionPreference);
    else if (motionQuery && motionQuery.removeListener) motionQuery.removeListener(handleMotionPreference);
    motionQuery = null;
  }
  if (globalScope.document && globalScope.document.addEventListener) globalScope.document.addEventListener('visibilitychange', handleVisibility);
  if (typeof globalScope.matchMedia === 'function') {
    motionQuery = globalScope.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', handleMotionPreference);
    else if (motionQuery && motionQuery.addListener) motionQuery.addListener(handleMotionPreference);
  }
  globalScope.GhostGameStageMotion = Object.freeze({ pulse, settle, dispose, snapshot: () => Object.freeze({ generation, available: !!adapter, loading: !!(loaderPromise && !adapter && !loaderFailed), loaderFailed, reducedMotion: reducedMotion() }) });
  if (typeof module !== 'undefined' && module.exports) module.exports = globalScope.GhostGameStageMotion;
})(typeof globalThis !== 'undefined' ? globalThis : this);
