import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

export const VERSIONS = Object.freeze({ gsap: '3.15.0', adapter: 'surface-motion-p1' });

export function createSurfaceMotionAdapter() {
  if (!CSSPlugin) throw new Error('SURFACE_MOTION_CSS_PLUGIN_UNAVAILABLE');
  let timeline = null;
  let context = null;
  let disposed = false;

  function uniqueNodes(request) {
    return [...new Set([request.root, request.panel, request.from, request.to].filter(Boolean))];
  }

  function clear(request) {
    const nodes = uniqueNodes(request || {});
    if (nodes.length) gsap.set(nodes, { clearProps: 'transform,opacity,visibility,will-change' });
  }

  function kill() {
    if (timeline) { timeline.kill(); timeline = null; }
    if (context) { context.revert(); context = null; }
  }

  function settle(_surface, _reason) { kill(); }

  function run(request = {}) {
    if (disposed) throw new Error('SURFACE_MOTION_DISPOSED');
    kill();
    const panel = request.panel;
    const root = request.root;
    if (!panel || !root) throw new Error('SURFACE_MOTION_MISSING_TARGET');
    const nodes = uniqueNodes(request);
    nodes.forEach(node => { if (node && node.style) node.style.willChange = 'transform, opacity'; });
    let ownedTimeline = null;
    context = gsap.context(() => {
      ownedTimeline = timeline = gsap.timeline({
        defaults: { overwrite: 'auto' },
        onComplete() {
          clear(request);
          if (timeline === ownedTimeline) timeline = null;
          if (typeof request.onComplete === 'function') request.onComplete();
        }
      });
      timeline.addLabel('committed', 0);
      if (request.phase === 'open') {
        timeline.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.18, ease: 'power2.out', immediateRender: true }, 'committed')
          .fromTo(panel, { y: 18, scale: 0.975, opacity: 0 }, { y: 0, scale: 1, opacity: 1, duration: 0.26, ease: 'power3.out', immediateRender: true }, 'committed');
      } else if (request.phase === 'close') {
        timeline.to(panel, { y: 12, scale: 0.985, opacity: 0, duration: 0.18, ease: 'power2.in' }, 'committed')
          .to(root, { opacity: 0, duration: 0.16, ease: 'power1.in' }, 'committed+=0.02');
      } else {
        const direction = request.phase === 'back' ? -1 : 1;
        if (request.from) timeline.to(request.from, { x: -direction * 10, opacity: 0.72, duration: 0.14, ease: 'power1.out' }, 'committed');
        if (request.to) timeline.fromTo(request.to, { x: direction * 18, opacity: 0 }, { x: 0, opacity: 1, duration: 0.22, ease: 'power3.out', immediateRender: true }, 'committed+=0.02');
      }
      timeline.addLabel('settled', 0.28);
    }, root);
    if (!ownedTimeline) throw new Error('SURFACE_MOTION_TIMELINE_UNAVAILABLE');
    return Object.freeze({ kill() { if (ownedTimeline) ownedTimeline.kill(); clear(request); } });
  }

  function dispose(_reason) {
    if (disposed) return;
    disposed = true;
    kill();
  }

  return Object.freeze({ run, settle, dispose });
}
