'use strict';

/* Contract for the visible P1 repair layer. The CDP audit remains the real
   geometry loop; this fast contract prevents a later stylesheet refactor from
   silently dropping the fixes from the built shell. */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public', 'styles', '99-visual-repair-p1.css'), 'utf8');
const manifest = fs.readFileSync(path.join(root, 'public', 'ghost-layout.css'), 'utf8');
const required = [
  'data-shell-game="gomoku"',
  '--stage-command-size: 132px',
  'width: min(78vh',
  '.honru-edge-guide',
  'inset-block-end:',
  '@keyframes honruPeekBreathe',
  'avatar-frame-art-ready::before',
  'avatar-effect-art-ready::after',
  '@keyframes identityEffectOrbit',
  'premium-background-motion-layer.is-active',
  '@keyframes premiumMotionDrift',
  '@media (prefers-reduced-motion: reduce)',
];
for (const token of required) {
  if (!css.includes(token)) throw new Error('visual repair contract missing: ' + token);
}
if (!manifest.includes('./styles/99-visual-repair-p1.css')) {
  throw new Error('visual repair stylesheet is not the final layout import');
}
const assets = fs.readFileSync(path.join(root, 'public', 'src', 'core', '06-assets.js'), 'utf8');
for (const token of [
  'initialVisibilityTimer',
  'getBoundingClientRect',
  'IntersectionObserver',
  'element._premiumBackgroundCleanup = () => {',
  'if (initialVisibilityTimer) clearTimeout(initialVisibilityTimer);',
  'else if (next && loader)',
  'would remove src and create a poster-only deadlock',
]) {
  if (!assets.includes(token)) throw new Error('animated background visibility fallback contract missing: ' + token);
}
console.log('VISUAL_DEFECTS_REPAIR_P1_CONTRACT_PASS');
