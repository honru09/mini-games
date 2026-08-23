import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

gsap.registerPlugin(CSSPlugin);

export function createAudioSpectrumMotionAdapter(options = {}) {
  const root = options.root || null;
  let tween = null;
  let disposed = false;
  const context = gsap.context(() => {}, root || undefined);

  function clear(nodes) {
    if (!nodes || !nodes.length) return;
    gsap.set(nodes, { clearProps: 'transform,opacity,visibility' });
  }

  function settle() {
    const targets = tween && tween.targets ? tween.targets() : [];
    if (tween) tween.kill();
    tween = null;
    clear(targets);
    return true;
  }

  function pulse(payload = {}) {
    if (disposed) return false;
    const bars = Array.isArray(payload.bars) ? payload.bars.filter(Boolean) : [];
    if (!bars.length) return false;
    settle();
    const intensity = Number.isFinite(payload.intensity) ? Math.max(0, Math.min(1, payload.intensity)) : 1;
    context.add(() => {
      gsap.set(bars, { scaleY: 0.72, transformOrigin: '50% 100%', autoAlpha: 0.78 });
      tween = gsap.to(bars, {
        scaleY: index => 1.04 + (Number(payload.levels && payload.levels[index]) || 0.3) * (0.16 + intensity * 0.18),
        autoAlpha: 1,
        duration: 0.18 + intensity * 0.08,
        ease: 'power2.out',
        stagger: { each: 0.014, from: 'center' },
        repeat: 1,
        yoyo: true,
        overwrite: true,
        onComplete() {
          clear(bars);
          tween = null;
          if (typeof payload.onComplete === 'function') payload.onComplete();
        }
      });
    });
    return true;
  }

  function dispose() {
    if (disposed) return true;
    disposed = true;
    settle();
    context.revert();
    return true;
  }

  return Object.freeze({ pulse, settle, dispose });
}
