/* Ghost Game route motion bridge: synchronous navigation with an optional lazy GSAP adapter. */
(function initGhostRouteMotion(globalScope) {
  'use strict';

  const ROUTES = Object.freeze(['home', 'games', 'playline', 'profile']);
  const ENTRY_URL = './route-motion-entry.js';
  const ROOT_SELECTOR = '#screen-hub';
  const TARGET_SELECTOR = '[data-route-motion-item]';
  const TRANSIENT_CLASSES = ['route-motion-active', 'route-motion-exiting', 'route-motion-entering'];

  let generation = 0;
  let currentRoute = null;
  let active = null;
  let adapter = null;
  let loaderPromise = null;
  let loaderFailed = false;
  let disposed = false;
  let shellActive = false;
  let lastFailure = null;
  let motionQuery = null;
  let listenersInstalled = false;

  function safeCall(fn, ...args) {
    try { return typeof fn === 'function' ? fn(...args) : undefined; }
    catch (error) { lastFailure = String(error && error.message || error || 'route_motion_failure').slice(0, 240); return undefined; }
  }

  function nodes() {
    try { return Array.from(globalScope.document && globalScope.document.querySelectorAll('[data-app-route]') || []); }
    catch (_error) { return []; }
  }

  function routeNode(route) {
    return nodes().find(node => node && node.getAttribute && node.getAttribute('data-app-route') === route) || null;
  }

  function setInteractive(node, visible) {
    if (!node) return;
    node.classList && TRANSIENT_CLASSES.forEach(name => node.classList.remove(name));
    if (visible) {
      node.classList && node.classList.remove('hidden');
      node.removeAttribute && node.removeAttribute('aria-hidden');
      if ('inert' in node) node.inert = false;
      node.removeAttribute && node.removeAttribute('inert');
    } else {
      node.classList && node.classList.add('hidden');
      node.setAttribute && node.setAttribute('aria-hidden', 'true');
      if ('inert' in node) node.inert = true;
      node.setAttribute && node.setAttribute('inert', '');
    }
  }

  function clearInline(node) {
    if (!node) return;
    const targets = [node];
    try { targets.push(...Array.from(node.querySelectorAll && node.querySelectorAll(TARGET_SELECTOR) || [])); }
    catch (_error) {}
    targets.forEach(target => {
      if (!target || !target.style) return;
      ['transform', 'opacity', 'visibility', 'willChange'].forEach(property => {
        try { target.style[property] = ''; }
        catch (_error) {}
      });
    });
  }

  function alignRoutes(route, clearMotion) {
    nodes().forEach(node => {
      const visible = node.getAttribute && node.getAttribute('data-app-route') === route;
      if (clearMotion !== false) clearInline(node);
      setInteractive(node, visible);
    });
  }

  function cancelActive(reason) {
    const running = active;
    active = null;
    if (running && running.handle) safeCall(running.handle.kill, reason || 'superseded');
    if (adapter) safeCall(adapter.settle, currentRoute, reason || 'settle');
    alignRoutes(currentRoute);
  }

  function reducedMotion() {
    return !!(motionQuery && motionQuery.matches);
  }

  function shouldAnimate(from, to) {
    const documentRef = globalScope.document;
    return !disposed && !loaderFailed && !!from && from !== to && !shellActive &&
      !(documentRef && documentRef.hidden) && !reducedMotion() && !!routeNode(from) && !!routeNode(to);
  }

  function importAdapter() {
    if (adapter || loaderFailed || disposed) return Promise.resolve(adapter);
    if (loaderPromise) return loaderPromise;
    loaderPromise = import(ENTRY_URL).then(moduleValue => {
      if (disposed) return null;
      if (!moduleValue || typeof moduleValue.createRouteMotionAdapter !== 'function') throw new Error('invalid_route_motion_module');
      const root = globalScope.document && globalScope.document.querySelector(ROOT_SELECTOR);
      const created = moduleValue.createRouteMotionAdapter({ root, targetSelector: TARGET_SELECTOR });
      if (!created || typeof created.run !== 'function' || typeof created.settle !== 'function' || typeof created.dispose !== 'function') {
        throw new Error('invalid_route_motion_adapter');
      }
      adapter = created;
      return adapter;
    }).catch(error => {
      loaderFailed = true;
      lastFailure = String(error && error.message || error || 'route_motion_load_failed').slice(0, 240);
      adapter = null;
      return null;
    });
    return loaderPromise;
  }

  function settle(reason) {
    generation += 1;
    cancelActive(reason || 'manual');
    alignRoutes(currentRoute);
  }

  function transition(options) {
    const request = options && typeof options === 'object' ? options : {};
    const to = ROUTES.includes(request.to) ? request.to : 'home';
    const from = ROUTES.includes(request.from) ? request.from : currentRoute;
    const commit = typeof request.commit === 'function' ? request.commit : function noop() {};
    const requestGeneration = ++generation;
    let committed = false;
    const commitOnce = preserveMotion => {
      if (committed) return false;
      committed = true;
      safeCall(commit);
      currentRoute = to;
      alignRoutes(to, preserveMotion !== true);
      return true;
    };

    cancelActive('superseded');
    if (!shouldAnimate(from, to)) {
      commitOnce();
      return Object.freeze({ generation: requestGeneration, status: 'settled' });
    }

    commitOnce();
    if (adapter) {
      const toNode = routeNode(to);
      if (!toNode) return Object.freeze({ generation: requestGeneration, status: 'settled' });
      const running = { generation: requestGeneration, to, handle: null };
      active = running;
      try {
        running.handle = adapter.run({
          from,
          to,
          toNode,
          direction: Math.sign(ROUTES.indexOf(to) - ROUTES.indexOf(from)) || 1,
          generation: requestGeneration,
          onComplete() {
            if (requestGeneration !== generation) return;
            active = null;
            adapter.settle(to, 'complete');
            alignRoutes(to);
          }
        });
        return Object.freeze({ generation: requestGeneration, status: 'entering' });
      } catch (error) {
        active = null;
        lastFailure = String(error && error.message || error || 'route_motion_run_failed').slice(0, 240);
        safeCall(adapter.settle, to, 'run_failed');
        alignRoutes(to);
        return Object.freeze({ generation: requestGeneration, status: 'settled' });
      }
    }
    importAdapter().then(() => { if (requestGeneration !== generation) return; alignRoutes(currentRoute); });
    return Object.freeze({ generation: requestGeneration, status: 'loading' });
  }

  function handleVisibility() {
    if (globalScope.document && globalScope.document.hidden) settle('document_hidden');
  }

  function handleShell(event) {
    shellActive = !!(event && event.detail && event.detail.active);
    if (shellActive) settle('game_shell_active');
  }

  function handleMotionPreference() {
    if (reducedMotion()) settle('reduced_motion');
  }

  function installListeners() {
    if (listenersInstalled || !globalScope || !globalScope.addEventListener) return;
    listenersInstalled = true;
    if (globalScope.document && globalScope.document.addEventListener) globalScope.document.addEventListener('visibilitychange', handleVisibility);
    globalScope.addEventListener('ghostgame:shellchange', handleShell);
    if (typeof globalScope.matchMedia === 'function') {
      motionQuery = globalScope.matchMedia('(prefers-reduced-motion: reduce)');
      if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', handleMotionPreference);
      else if (motionQuery && motionQuery.addListener) motionQuery.addListener(handleMotionPreference);
    }
  }

  function dispose(reason) {
    if (disposed) return;
    disposed = true;
    settle(reason || 'dispose');
    if (adapter) safeCall(adapter.dispose, reason || 'dispose');
    adapter = null;
    if (globalScope.document && globalScope.document.removeEventListener) globalScope.document.removeEventListener('visibilitychange', handleVisibility);
    if (globalScope.removeEventListener) globalScope.removeEventListener('ghostgame:shellchange', handleShell);
    if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener('change', handleMotionPreference);
    else if (motionQuery && motionQuery.removeListener) motionQuery.removeListener(handleMotionPreference);
    motionQuery = null;
    listenersInstalled = false;
  }

  function snapshot() {
    return Object.freeze({
      generation,
      currentRoute,
      status: disposed ? 'disposed' : active ? 'animating' : loaderPromise && !adapter && !loaderFailed ? 'loading' : 'idle',
      loading: !!(loaderPromise && !adapter && !loaderFailed),
      available: !!adapter,
      loaderFailed,
      reducedMotion: reducedMotion(),
      hidden: !!(globalScope.document && globalScope.document.hidden),
      shellActive,
      lastFailure
    });
  }

  installListeners();
  const interfaceValue = Object.freeze({ transition, settle, dispose, snapshot });
  globalScope.GhostRouteMotion = interfaceValue;
  if (typeof module !== 'undefined' && module.exports) module.exports = interfaceValue;
})(typeof globalThis !== 'undefined' ? globalThis : this);
