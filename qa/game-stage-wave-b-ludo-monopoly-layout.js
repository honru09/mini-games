'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'public', 'index-template.html'), 'utf8');
const ludo = fs.readFileSync(path.join(root, 'public', 'src', 'games', 'ludo.js'), 'utf8');
const monopoly = fs.readFileSync(path.join(root, 'public', 'src', 'games', 'monopoly.js'), 'utf8');
const marker = '/* ================= Game Stage Wave B · Ludo / Monopoly =================';
const start = template.indexOf(marker);
const end = template.indexOf('</style>', start);
const css = start >= 0 && end > start ? template.slice(start, end) : '';
let failures = 0;
function check(name, value) {
  console.log((value ? 'PASS  ' : 'FAIL  ') + name);
  if (!value) failures++;
}

check('shared Ludo/Monopoly Wave B layout block exists', !!css);
check('Ludo layout consumes board, status, rankings and command seams', [
  'ludo-wave-b-stage', 'ludo-wave-b-board-frame', 'ludo-wave-b-meta',
  'ludo-wave-b-turn', 'ludo-wave-b-state', 'ludo-wave-b-rankings',
  'ludo-wave-b-command', 'ludo-wave-b-dice',
].every(token => css.includes(token)));
check('Monopoly layout consumes board, meta states and command seams', [
  'monopoly-wave-b-stage', 'monopoly-wave-b-board-frame', 'monopoly-wave-b-meta',
  'monopoly-wave-b-turn', 'monopoly-wave-b-state', 'monopoly-wave-b-property',
  'monopoly-wave-b-chance', 'monopoly-wave-b-auction', 'monopoly-wave-b-trade',
  'monopoly-wave-b-command', 'monopoly-wave-b-dice',
].every(token => css.includes(token)));
check('selectors are scoped to the two game shells',
  css.includes('[data-shell-game="ludo"]') && css.includes('[data-shell-game="monopoly"]'));
check('mobile portrait and low-height landscape layouts are explicit',
  css.includes('@media(max-width:720px)') && css.includes('@media(max-width:420px)') && css.includes('@media(max-height:600px) and (orientation:landscape)'));
check('reduced motion disables presentation animation hints', css.includes('@media(prefers-reduced-motion:reduce)') && css.includes('will-change:auto'));
check('layout has no image or remote asset dependency', !/url\s*\(/i.test(css));
check('Ludo source exposes strict flag and stable seams',
  ludo.includes("mg_art_game_stage_wave_b_v1") && ['ludo-wave-b-stage','ludo-wave-b-board-frame','ludo-wave-b-rankings'].every(token => ludo.includes(token)));
check('Monopoly source exposes strict flag and read-only state seams',
  monopoly.includes("mg_art_game_stage_wave_b_v1") && ['monopoly-wave-b-stage','monopoly-wave-b-board-frame','monopoly-wave-b-property','monopoly-wave-b-trade'].every(token => monopoly.includes(token)));
check('neither source puts Wave B markers into snapshots or wire payloads',
  !/snapshot\(\)[\s\S]{0,700}wave-b/i.test(ludo) && !/snapshot\(\)[\s\S]{0,900}wave-b/i.test(monopoly));

if (failures) {
  console.error('GAME_STAGE_WAVE_B_LUDO_MONOPOLY_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('GAME_STAGE_WAVE_B_LUDO_MONOPOLY_LAYOUT_ALL_PASS');
}
