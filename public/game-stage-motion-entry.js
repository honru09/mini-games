import { gsap, CSSPlugin } from './vendor/gsap/3.15.0/esm/index.js';

export const VERSIONS = Object.freeze({ gsap: '3.15.0', adapter: 'game-stage-status-p1' });

export function createGameStageMotionAdapter() {
  if (!CSSPlugin) throw new Error('GAME_STAGE_MOTION_CSS_PLUGIN_UNAVAILABLE');
  let timeline = null;
  let disposed = false;
  function clear(node) {
    if (!node) return;
    gsap.set(node, { clearProps: 'transform,opacity,visibility,will-change' });
  }
  function kill() { if (timeline) { timeline.kill(); timeline = null; } }
  function run(request = {}) {
    if (disposed) throw new Error('GAME_STAGE_MOTION_DISPOSED');
    const node = request.node;
    if (!node) throw new Error('GAME_STAGE_MOTION_MISSING_TARGET');
    kill();
    timeline = gsap.timeline({ defaults: { overwrite: 'auto' }, onComplete() { clear(node); timeline = null; if (typeof request.onComplete === 'function') request.onComplete(); } });
    timeline.fromTo(node, { y: 4, scale: 0.992, autoAlpha: 0.78 }, { y: 0, scale: 1, autoAlpha: 1, duration: request.level === 'win' ? 0.3 : 0.2, ease: request.level === 'win' ? 'back.out(1.35)' : 'power2.out', immediateRender: true });
    return Object.freeze({ kill() { kill(); clear(node); } });
  }
  function settle() { kill(); }
  function dispose() { if (disposed) return; disposed = true; kill(); }
  return Object.freeze({ run, settle, dispose });
}
