const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const gomoku = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
const tetris = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris.js'), 'utf8');
let failures = 0;

function check(name, value){
  if (value) console.log('PASS  ' + name);
  else { failures++; console.error('FAIL  ' + name); }
}

check('Wave C shared CSS owns both process rails without changing game rules',
  template.includes('.gomoku-wave-c-process,#screen-game.game-stage[data-shell-game="tetris"] .tetris-wave-c-process') &&
  template.includes('.gomoku-wave-c-process-label,#screen-game.game-stage[data-shell-game="tetris"] .tetris-wave-c-process-label'));
check('Gomoku process rail exposes all seven stages in a stable track',
  gomoku.includes("['turn','aim','select','place','impact','line','terminal']") &&
  template.includes('.gomoku-wave-c-process-track{grid-template-columns:repeat(7,minmax(0,1fr))}'));
check('Tetris process rail exposes all twelve stages in a stable track',
  tetris.includes("['spawn','fall','move','rotate','lock','line-clear','combo','b2b','t-spin','perfect-clear','garbage','terminal']") &&
  template.includes('.tetris-wave-c-process-track{grid-template-columns:repeat(12,minmax(0,1fr))}'));
check('Gomoku desktop uses a board plus process region and mobile collapses to one column',
  template.includes('grid-template-areas:"board process"') &&
  template.includes('grid-template-areas:"board" "process"'));
check('low-height landscape keeps the process rail beside the Gomoku board',
  /@media\(max-height:600px\) and \(orientation:landscape\)[\s\S]*gomoku-wave-b-stage:has\(\.gomoku-wave-c-process\)[^}]*grid-template-areas:"board process"/.test(template));
check('active process feedback uses transform and color rather than layout dimensions',
  template.includes('[data-gomoku-process-active="true"]') &&
  template.includes('[data-tetris-process-active="true"]') &&
  !/process-step[^}]*transition:[^;}]*(?:width|height|top|left)/.test(template));
check('Gomoku impact and Tetris lock feedback target their actual stable board nodes',
  template.includes('.gomoku-wave-b-stage[data-gomoku-process="impact"] .gomoku-wave-b-board-frame') &&
  template.includes('.tetris-wave-b-main-well[data-tetris-process="lock"]'));
check('reduced motion removes process transitions and board transforms',
  /@media\(prefers-reduced-motion:reduce\)[\s\S]*gomoku-wave-c-process[\s\S]*tetris-wave-c-process[\s\S]*transition:none!important[\s\S]*gomoku-wave-b-board-frame[\s\S]*tetris-wave-b-main-well[\s\S]*transform:translateZ\(0\)!important/.test(template));
check('Wave C remains free of ScrollTrigger and remote art dependencies',
  !/ScrollTrigger/.test(gomoku) && !/ScrollTrigger/.test(tetris) &&
  !/https?:\/\//.test(gomoku.slice(0, gomoku.indexOf('function snapshot(){'))) &&
  !/https?:\/\//.test(tetris.slice(0, tetris.indexOf('function snapshot(){'))));

if (failures){
  console.error('GAME_STAGE_WAVE_C_LAYOUT_FAILURES=' + failures);
  process.exitCode = 1;
} else console.log('GAME_STAGE_WAVE_C_LAYOUT_ALL_PASS');
