'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const SOURCE = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
let failures = 0;

function check(name, value, detail) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name + (value || !detail ? '' : ' :: ' + detail));
  if (!value) failures++;
}

const slotCss = /\.gomoku-ghost3d-slot\{[^}]*position:absolute[^}]*inset:0[^}]*z-index:1[^}]*pointer-events:none/.test(TEMPLATE);
const readyCss = /\.gomoku-ghost3d-slot\[data-ghost3d-ready="true"\]\{[^}]*pointer-events:auto/.test(TEMPLATE);
const canvasCss = /\.gomoku-ghost3d-slot canvas\{[^}]*width:100%[^}]*height:100%[^}]*border-radius:inherit/.test(TEMPLATE);
const fallbackCss = /\.gomoku-wave-b-board-frame\[data-ghost3d-ready="true"\] \.gomoku-wave-b-board\{[^}]*pointer-events:none/.test(TEMPLATE);
const metaCss = /\.gomoku-wave-b-meta\{[^}]*position:absolute[^}]*z-index:2/.test(TEMPLATE);

check('3D overlay is an absolute z1 board-frame layer with a strict pointer fallback', slotCss && readyCss && fallbackCss);
check('overlay canvas fills its inherited rounded board frame without changing the Wave B canvas contract', canvasCss && /\.gomoku-wave-b-board\{[^}]*width:100%!important[^}]*height:auto!important/.test(TEMPLATE));
check('Wave B meta remains above the overlay at z2', metaCss);
check('mobile and compact-landscape overlay rules keep the absolute layer clipped inside the board',
  /@media\(max-width:720px\)\{[\s\S]{0,560}\.gomoku-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE) &&
  /@media\(max-height:600px\) and \(orientation:landscape\)\{[\s\S]{0,620}\.gomoku-ghost3d-slot\{inset:0;overflow:hidden\}/.test(TEMPLATE));
check('reduced-motion CSS adds no overlay animation or transition work',
  /@media\(prefers-reduced-motion:reduce\)\{[\s\S]{0,380}\.gomoku-ghost3d-slot,[\s\S]{0,180}animation:none!important;transition:none!important/.test(TEMPLATE));
check('slot is inserted after the retained canvas and before the meta layer',
  /gomokuWaveBFrame\.appendChild\(canvas\);\s*mountGomokuGhost3DSlot\(\);\s*gomokuWaveBFrame\.appendChild\(gomokuWaveBMeta\);/.test(SOURCE));
check('the retained Wave B canvas remains focusable grid input and the D-pad stays mounted',
  /canvas\.setAttribute\('tabindex', '0'\)/.test(SOURCE) && /canvas\.setAttribute\('role', 'grid'\)/.test(SOURCE) &&
  /canvas\.setAttribute\('aria-rowcount', String\(N\)\)/.test(SOURCE) && /mountGomokuTouchControls\(\)/.test(SOURCE) && /gomoku-touch-controls/.test(SOURCE));
check('disabled, unavailable, or failed overlay state preserves the Wave B pointer surface',
  /slot\.dataset\.ghost3dReady = 'false'/.test(SOURCE) && /gomokuGhost3DSetReady\(false/.test(SOURCE) && /if \(!gomokuWaveBActive\) return false;/.test(SOURCE));

if (failures) {
  console.error('GOMOKU_GHOST3D_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GOMOKU_GHOST3D_LAYOUT_ALL_PASS');
}
