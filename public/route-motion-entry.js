import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

export const VERSIONS = Object.freeze({ gsap: '3.15.0', adapter: 'route-motion-p1' });

export function createRouteMotionAdapter(options = {}) {
  const root = options.root;
  const targetSelector = typeof options.targetSelector === 'string' ? options.targetSelector : '[data-route-motion-item]';
  if (!root || typeof root.querySelectorAll !== 'function') throw new Error('ROUTE_MOTION_INVALID_ROOT');
  if (!CSSPlugin) throw new Error('ROUTE_MOTION_CSS_PLUGIN_UNAVAILABLE');

  let timeline = null;
  let context = gsap.context(() => {}, root);
  let disposed = false;

  function targets(node) {
    const selected = Array.from(node && node.querySelectorAll ? node.querySelectorAll(targetSelector) : []).slice(0, 11);
    return selected.length ? selected : node ? [node] : [];
  }

  function clearNode(node) {
    if (!node) return;
    gsap.set([node, ...targets(node)], { clearProps: 'transform,opacity,visibility,will-change' });
    node.classList && node.classList.remove('route-motion-active', 'route-motion-exiting', 'route-motion-entering');
  }

  function kill(reason) {
    if (timeline) { timeline.kill(); timeline = null; }
    if (reason === 'dispose' && context) { context.revert(); context = null; }
  }

  function settle(route, reason) {
    kill(reason);
    const node = root.querySelector('[data-app-route="' + String(route || '').replace(/[^a-z-]/g, '') + '"]');
    clearNode(node);
  }

  function run(request = {}) {
    if (disposed) throw new Error('ROUTE_MOTION_DISPOSED');
    kill('replace');
    const node = request.toNode;
    if (!node) throw new Error('ROUTE_MOTION_MISSING_TARGET');
    const list = targets(node);
    const direction = request.direction < 0 ? -1 : 1;
    node.classList && node.classList.add('route-motion-active', 'route-motion-entering');
    list.forEach(target => { if (target && target.style) target.style.willChange = 'transform, opacity'; });

    let ownedTimeline = null;
    const buildTimeline = () => {
      if (disposed) return;
      ownedTimeline = timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete() {
          const done = request.onComplete;
          clearNode(node);
          if (timeline === ownedTimeline) timeline = null;
          if (typeof done === 'function') done();
        }
      });
    };
    if (context && typeof context.add === 'function') context.add(buildTimeline);
    else buildTimeline();
    if (!ownedTimeline) throw new Error('ROUTE_MOTION_TIMELINE_UNAVAILABLE');
    timeline.addLabel('committed', 0)
      .addLabel('enter', 0)
      .fromTo(node,
        { x: direction * 8, scale: 0.992, autoAlpha: 0.84 },
        { x: 0, scale: 1, autoAlpha: 1, duration: 0.26, ease: 'power3.out', immediateRender: true },
        'enter')
      .fromTo(list,
        { y: 12, opacity: 0.15 },
        { y: 0, opacity: 1, duration: 0.24, ease: 'power3.out', stagger: { amount: 0.08, from: 'start' }, immediateRender: true },
        'enter+=0.02')
      .addLabel('settled', 0.36);

    const handle = Object.freeze({
      kill() {
        if (ownedTimeline) ownedTimeline.kill();
        if (timeline === ownedTimeline) timeline = null;
        clearNode(node);
      }
    });
    return handle;
  }

  function dispose(reason) {
    if (disposed) return;
    disposed = true;
    kill('dispose');
  }

  return Object.freeze({ run, settle, dispose });
}
