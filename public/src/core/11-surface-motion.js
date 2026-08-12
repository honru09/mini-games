/* Ghost Game finite overlay motion: synchronous product state, optional lazy GSAP presentation. */
(function installGhostSurfaceMotion(globalScope) {
  'use strict';

  const ENTRY_URL = './surface-motion-entry.js';
  const PHASES = Object.freeze(['open', 'thread', 'back', 'close']);
  let generation = 0;
  let adapter = null;
  let loaderPromise = null;
  let loaderFailed = false;
  let active = null;
  let disposed = false;
  let shellActive = false;
  let motionQuery = null;
  let lastFailure = null;

  function safeCall(fn, ...args) {
    try { return typeof fn === 'function' ? fn(...args) : undefined; }
    catch (error) { lastFailure = String(error && error.message || error || 'surface_motion_failure').slice(0, 240); return undefined; }
  }

  function clearInline(request) {
    const values = request ? [request.root, request.panel, request.from, request.to] : [];
    values.filter(Boolean).forEach(node => {
      if (!node || !node.style) return;
      ['transform', 'opacity', 'visibility', 'willChange'].forEach(property => {
        try { node.style[property] = ''; } catch (_error) {}
      });
    });
  }

  function reducedMotion() { return !!(motionQuery && motionQuery.matches); }
  function environmentBlocksMotion() {
    const documentRef = globalScope && globalScope.document;
    return disposed || shellActive || reducedMotion() || !!(documentRef && documentRef.hidden);
  }
  function shouldAnimate(request) {
    return !loaderFailed && !!adapter && !environmentBlocksMotion() && request && request.root && request.panel;
  }

  function importAdapter() {
    if (adapter || loaderFailed || disposed) return Promise.resolve(adapter);
    if (loaderPromise) return loaderPromise;
    loaderPromise = import(ENTRY_URL).then(moduleValue => {
      if (disposed) return null;
      if (!moduleValue || typeof moduleValue.createSurfaceMotionAdapter !== 'function') throw new Error('invalid_surface_motion_module');
      const created = moduleValue.createSurfaceMotionAdapter();
      if (!created || typeof created.run !== 'function' || typeof created.settle !== 'function' || typeof created.dispose !== 'function') {
        throw new Error('invalid_surface_motion_adapter');
      }
      adapter = created;
      return adapter;
    }).catch(error => {
      loaderFailed = true;
      adapter = null;
      lastFailure = String(error && error.message || error || 'surface_motion_load_failed').slice(0, 240);
      return null;
    });
    return loaderPromise;
  }

  function cancelActive(reason, complete) {
    const running = active;
    active = null;
    if (!running) return;
    safeCall(running.handle && running.handle.kill, reason || 'cancel');
    safeCall(adapter && adapter.settle, running.request.surface, reason || 'cancel');
    clearInline(running.request);
    if (complete) safeCall(running.request.onComplete, reason || 'settled');
  }

  function run(options) {
    const request = options && typeof options === 'object' ? options : {};
    const phase = PHASES.includes(request.phase) ? request.phase : null;
    const surface = String(request.surface || '').replace(/[^a-z0-9-]/gi, '').slice(0, 40);
    const requestGeneration = ++generation;
    cancelActive('superseded', false);
    if (!phase || !surface || !request.root || !request.panel) {
      clearInline(request);
      safeCall(request.onComplete, 'invalid');
      return Object.freeze({ generation: requestGeneration, status: 'settled' });
    }
    if (!shouldAnimate(request)) {
      clearInline(request);
      const canPreheat = !adapter && !loaderFailed && !environmentBlocksMotion();
      const fallbackReason = loaderFailed ? 'unavailable' : canPreheat ? 'loading' : 'static';
      safeCall(request.onComplete, fallbackReason);
      if (canPreheat) importAdapter();
      return Object.freeze({ generation: requestGeneration, status: canPreheat ? 'loading' : 'settled' });
    }
    try {
      const running = { generation: requestGeneration, request, handle: null };
      active = running;
      running.handle = adapter.run({
        surface,
        phase,
        root: request.root,
        panel: request.panel,
        from: request.from || null,
        to: request.to || null,
        onComplete() {
          if (!active || active.generation !== requestGeneration || requestGeneration !== generation) return;
          active = null;
          safeCall(adapter && adapter.settle, surface, 'complete');
          clearInline(request);
          safeCall(request.onComplete, 'complete');
        }
      });
      return Object.freeze({ generation: requestGeneration, status: 'animating' });
    } catch (error) {
      active = null;
      lastFailure = String(error && error.message || error || 'surface_motion_run_failed').slice(0, 240);
      safeCall(adapter && adapter.settle, surface, 'run_failed');
      clearInline(request);
      safeCall(request.onComplete, 'run_failed');
      return Object.freeze({ generation: requestGeneration, status: 'settled' });
    }
  }

  function settle(surface, reason) {
    generation += 1;
    const normalized = String(surface || 'all');
    if (active && (normalized === 'all' || active.request.surface === normalized)) cancelActive(reason || 'settle', true);
    if (adapter) safeCall(adapter.settle, normalized, reason || 'settle');
    return true;
  }

  function dispose(reason) {
    if (disposed) return;
    disposed = true;
    settle('all', reason || 'dispose');
    if (adapter) safeCall(adapter.dispose, reason || 'dispose');
    adapter = null;
    if (globalScope.document && globalScope.document.removeEventListener) globalScope.document.removeEventListener('visibilitychange', handleVisibility);
    if (globalScope.removeEventListener) globalScope.removeEventListener('ghostgame:shellchange', handleShell);
    if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener('change', handleMotionPreference);
    else if (motionQuery && motionQuery.removeListener) motionQuery.removeListener(handleMotionPreference);
    motionQuery = null;
  }

  function snapshot() {
    return Object.freeze({ generation, status: disposed ? 'disposed' : active ? 'animating' : 'idle', available: !!adapter,
      loading: !!(loaderPromise && !adapter && !loaderFailed), loaderFailed, reducedMotion: reducedMotion(), shellActive,
      hidden: !!(globalScope.document && globalScope.document.hidden), lastFailure });
  }

  function handleVisibility() { if (globalScope.document && globalScope.document.hidden) settle('all', 'document_hidden'); }
  function handleShell(event) { shellActive = !!(event && event.detail && event.detail.active); if (shellActive) settle('all', 'game_shell_active'); }
  function handleMotionPreference() { if (reducedMotion()) settle('all', 'reduced_motion'); }

  if (globalScope.document && globalScope.document.addEventListener) globalScope.document.addEventListener('visibilitychange', handleVisibility);
  if (globalScope.addEventListener) globalScope.addEventListener('ghostgame:shellchange', handleShell);
  if (typeof globalScope.matchMedia === 'function') {
    motionQuery = globalScope.matchMedia('(prefers-reduced-motion: reduce)');
    if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', handleMotionPreference);
    else if (motionQuery && motionQuery.addListener) motionQuery.addListener(handleMotionPreference);
  }

  const interfaceValue = Object.freeze({ run, settle, dispose, snapshot });
  globalScope.GhostSurfaceMotion = interfaceValue;
  if (typeof module !== 'undefined' && module.exports) module.exports = interfaceValue;
})(typeof globalThis !== 'undefined' ? globalThis : this);
