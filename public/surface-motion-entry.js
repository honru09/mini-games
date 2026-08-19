import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

export const VERSIONS = Object.freeze({ gsap: '3.15.0', adapter: 'surface-motion-p1' });

export function createSurfaceMotionAdapter() {
  if (!CSSPlugin) throw new Error('SURFACE_MOTION_CSS_PLUGIN_UNAVAILABLE');
  let timeline = null;
  let context = null;
  let activeRequest = null;
  let disposed = false;

  function requestItems(request) {
    const value = request && request.items;
    if (!value || typeof value === 'string') return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    if (value.nodeType || value.style) return [value];
    try { return Array.from(value).filter(Boolean); } catch (_error) { return []; }
  }

  function uniqueNodes(request) {
    return [...new Set([request.root, request.panel, request.from, request.to, ...requestItems(request)].filter(Boolean))];
  }

  function clear(request) {
    const nodes = uniqueNodes(request || {});
    if (nodes.length) gsap.set(nodes, { clearProps: 'transform,opacity,visibility,will-change' });
  }

  function kill(clearActive) {
    const request = activeRequest;
    const activeTimeline = timeline;
    const activeContext = context;
    timeline = null;
    context = null;
    activeRequest = null;
    if (activeTimeline) activeTimeline.kill();
    if (activeContext) activeContext.revert();
    if (clearActive && request) clear(request);
  }

  function settle(surface, _reason) {
    const normalized = String(surface || 'all');
    if (normalized === 'all' || (activeRequest && activeRequest.surface === normalized)) kill(true);
  }

  function dialogItems(request, root, panel) {
    if (!request || !/-dialog$/.test(String(request.surface || ''))) return [];
    return [...new Set(requestItems(request).filter(node => node !== root && node !== panel && node !== request.from && node !== request.to))];
  }

  function appendItems(timelineValue, phase, items, position) {
    if (!items.length) return;
    if (phase === 'close') {
      timelineValue.to(items, {
        y: 6,
        autoAlpha: 0,
        duration: 0.1,
        ease: 'power1.in',
        stagger: { each: 0.025, from: 'end' }
      }, position);
      return;
    }
    timelineValue.fromTo(items,
      { y: 10, autoAlpha: 0 },
      {
        y: 0,
        autoAlpha: 1,
        duration: 0.18,
        ease: 'power2.out',
        stagger: { each: 0.035, from: 'start' },
        immediateRender: true
      },
      position);
  }

  function run(request = {}) {
    if (disposed) throw new Error('SURFACE_MOTION_DISPOSED');
    kill(true);
    const panel = request.panel;
    const root = request.root;
    if (!panel || !root) throw new Error('SURFACE_MOTION_MISSING_TARGET');
    const nodes = uniqueNodes(request);
    const items = dialogItems(request, root, panel);
    nodes.forEach(node => { if (node && node.style) node.style.willChange = 'transform, opacity'; });
    let ownedTimeline = null;
    activeRequest = request;
    context = gsap.context(() => {
      ownedTimeline = timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete() {
          if (activeRequest !== request || timeline !== ownedTimeline) return;
          clear(request);
          timeline = null;
          activeRequest = null;
          if (context) { const completedContext = context; context = null; completedContext.revert(); }
          if (typeof request.onComplete === 'function') request.onComplete();
        }
      });
      timeline.addLabel('committed', 0);
      if (request.phase === 'open') {
        timeline.fromTo(root, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.18, ease: 'power2.out', immediateRender: true }, 'committed')
          .fromTo(panel, { y: 18, scale: 0.975, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.26, ease: 'power3.out', immediateRender: true }, 'committed');
        appendItems(timeline, request.phase, items, 'committed+=0.08');
      } else if (request.phase === 'close') {
        appendItems(timeline, request.phase, items, 'committed');
        timeline.to(panel, { y: 12, scale: 0.985, autoAlpha: 0, duration: 0.18, ease: 'power2.in' }, 'committed')
          .to(root, { autoAlpha: 0, duration: 0.16, ease: 'power1.in' }, 'committed+=0.02');
      } else {
        const direction = request.phase === 'back' ? -1 : 1;
        if (request.from) timeline.to(request.from, { x: -direction * 10, autoAlpha: 0.72, duration: 0.14, ease: 'power1.out' }, 'committed');
        if (request.to) timeline.fromTo(request.to, { x: direction * 18, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.22, ease: 'power3.out', immediateRender: true }, 'committed+=0.02');
        appendItems(timeline, request.phase, items, 'committed+=0.04');
      }
      timeline.addLabel('settled', 0.28);
    }, root);
    if (!ownedTimeline) throw new Error('SURFACE_MOTION_TIMELINE_UNAVAILABLE');
    return Object.freeze({ kill() { if (ownedTimeline === timeline && activeRequest === request) kill(true); } });
  }

  function dispose(_reason) {
    if (disposed) return;
    disposed = true;
    kill(true);
  }

  return Object.freeze({ run, settle, dispose });
}
