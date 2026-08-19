'use strict';

const fs = require('fs');
const path = require('path');

const template = fs.readFileSync(path.join(__dirname, '..', 'public', 'index-template.html'), 'utf8');
const marker = '/* ================= Game Stage Wave B · Gomoku / Tetris =================';
const start = template.indexOf(marker);
const end = template.indexOf('</style>', start);
const css = start >= 0 && end > start ? template.slice(start, end) : '';
let failures = 0;

function check(name, value) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name);
  if (!value) failures++;
}

check('Wave B shared layout block exists inside the stylesheet', !!css);
check('Gomoku layout consumes every stable Wave B seam', [
  'gomoku-wave-b-arena', 'gomoku-wave-b-stage', 'gomoku-wave-b-board-frame',
  'gomoku-wave-b-meta', 'gomoku-wave-b-state', 'gomoku-wave-b-last-move', 'gomoku-wave-b-board',
].every(token => css.includes(token)));
check('Tetris layout consumes HUD, preview, opponents and all control seams', [
  'tetris-wave-b-layout', 'tetris-wave-b-main-well', 'tetris-wave-b-preview-deck',
  'tetris-preview-slot', 'tetris-wave-b-opponents', 'tetris-wave-b-opponent-card',
  'tetris-wave-b-hud', 'tetris-wave-b-controls', 'data-tetris-control',
].every(token => css.includes(token)));
check('Wave B selectors are game-scoped and do not restyle the generic Arena on rollback',
  css.includes('[data-shell-game="gomoku"]') && css.includes('[data-shell-game="tetris"]') &&
  !/\[data-shell-game="(?:gomoku|tetris)"\]\s+\.game-stage-arena\s*\{/.test(css));
check('Gomoku command styling is conditional on an active Wave B stage', css.includes(':has(.gomoku-wave-b-stage) .gomoku-turn-hud'));
check('Tetris seven-button grid preserves the 44px touch minimum', /tetris-wave-b-control\{[^}]*min-width:44px!important;[^}]*min-height:44px!important/.test(css));
check('Phone portrait and low-height landscape receive explicit layouts', css.includes('@media(max-width:720px)') && css.includes('@media(max-height:600px) and (orientation:landscape)'));
check('Reduced motion is explicitly supported', css.includes('@media(prefers-reduced-motion:reduce)'));
check('Wave B layout adds no image or remote asset dependency', !/url\s*\(/i.test(css));

if (failures) {
  console.error('GAME_STAGE_WAVE_B_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_WAVE_B_LAYOUT_ALL_PASS');
}
