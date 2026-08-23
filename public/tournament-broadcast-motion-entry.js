import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

gsap.registerPlugin(CSSPlugin);

export const VERSIONS = Object.freeze({ gsap: '3.15.0', adapter: 'tournament-broadcast-overlay-v1' });

export function createTournamentBroadcastMotionAdapter(options = {}) {
  const root = options.root || null;
  let timeline = null;
  let disposed = false;
  let touched = [];
  const context = gsap.context(() => {}, root || undefined);

  function clear() {
    if (touched.length) gsap.set(touched, { clearProps: 'transform,opacity,visibility,will-change' });
    touched = [];
  }
  function settle() {
    if (timeline) timeline.kill();
    timeline = null;
    clear();
    return true;
  }
  function intro(payload = {}) {
    if (disposed || !payload.shell) return null;
    settle();
    const items = Array.from(payload.items || []).filter(Boolean);
    const dot = payload.dot || null;
    touched = [payload.shell, ...items, dot].filter(Boolean);
    timeline = context.add(() => {
      const next = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onStart() { gsap.set(touched, { willChange: 'transform,opacity' }); },
      onComplete() { timeline = null; clear(); if (typeof payload.onComplete === 'function') payload.onComplete(); }
      })
      .addLabel('signal', 0)
      .fromTo(payload.shell, { y: 8, autoAlpha: .82 }, { y: 0, autoAlpha: 1, duration: .24, ease: 'power2.out' }, 'signal')
      .fromTo(items, { y: 7, autoAlpha: .72 }, { y: 0, autoAlpha: 1, duration: .22, ease: 'power2.out', stagger: { amount: .12, from: 'start' } }, 'signal+=.05');
      if (dot) next.fromTo(dot, { scale: .72, autoAlpha: .62 }, { scale: 1.18, autoAlpha: 1, duration: .28, ease: 'power2.out', repeat: 3, yoyo: true }, 'signal');
      return next;
    });
    return Object.freeze({ kill: settle });
  }
  function dispose() {
    if (disposed) return true;
    disposed = true; settle(); context.revert(); return true;
  }
  return Object.freeze({ intro, settle, dispose });
}
