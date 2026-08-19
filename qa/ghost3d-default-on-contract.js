'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

const games = {
  gomoku: read('public/src/games/gomoku.js'),
  ludo: read('public/src/games/ludo.js'),
  monopoly: read('public/src/games/monopoly.js'),
  xiangqi: read('public/src/games/xiangqi.js'),
  tetris: read('public/src/games/tetris.js'),
  tank: read('public/src/games/tank.js'),
};
const presenters = {
  tetris: read('public/src/games/tetris-ghost3d-presenter.js'),
  tank: read('public/src/games/tank-ghost3d-presenter.js'),
};
const template = read('public/index-template.html');

const gates = {
  gomoku: /getItem\('mg_ghost3d_gomoku_v1'\)\s*===\s*'1'/,
  ludo: /getItem\(LUDO_GHOST3D_STORAGE_KEY\)\s*===\s*'1'/,
  monopoly: /getItem\(MONOPOLY_GHOST3D_STORAGE_KEY\)\s*===\s*'1'/,
  xiangqi: /getItem\(XIANGQI_GHOST3D_STORAGE_KEY\)\s*===\s*'1'/,
  tetris: /getItem\(TETRIS_GHOST3D_STORAGE_KEY\)\s*===\s*'1'/,
  tank: /getItem\(TANK_GHOST3D_STORAGE_KEY\)\s*===\s*'1'/,
};

for (const [gameId, pattern] of Object.entries(gates)) {
  assert.match(games[gameId], pattern,
    `${gameId} must keep Ghost3D frozen behind exact local one opt-in`);
  assert.match(games[gameId], /catch\s*\(_error\)\s*\{\s*return false;\s*\}/,
    `${gameId} must fail closed to its retained DOM/canvas renderer when storage is unavailable`);
}

assert.match(presenters.tetris,
  /getItem\(WAVE_B_STORAGE_KEY\)\s*!==\s*'0'\s*&&\s*storage\.getItem\(ENABLE_STORAGE_KEY\)\s*===\s*'1'/,
  'Tetris Presenter must agree with the caller exact opt-in semantics');
assert.match(presenters.tank,
  /getItem\('mg_art_game_stage_wave_b_v1'\)\s*!==\s*'0'\s*&&\s*storage\.getItem\('mg_ghost3d_tank_v1'\)\s*===\s*'1'/,
  'Tank Presenter must agree with the caller exact opt-in semantics');

const combinedPresentationSource = Object.values(games).concat(Object.values(presenters)).join('\n');
assert.doesNotMatch(combinedPresentationSource,
  /getItem\([^\n)]*mg_ghost3d_[^\n)]*\)\s*!==\s*['"]0['"]/,
  'no shipped Ghost3D game gate may regress to missing-key default-on');

const readyReplacementSelectors = [
  /\.gomoku-wave-b-board-frame\[data-ghost3d-ready="true"\] \.gomoku-wave-b-board\{[^}]*opacity:0[^}]*pointer-events:none/,
  /\.ludo-wave-b-board-frame\[data-ghost3d-ready="true"\] \.ludo-wave-b-board\{[^}]*opacity:0[^}]*pointer-events:none/,
  /\.monopoly-wave-b-board-frame\[data-ghost3d-ready="true"\] \.monopoly-wave-b-board\{[^}]*opacity:0[^}]*pointer-events:none/,
  /\.xiangqi-board\[data-ghost3d-ready="true"\]:has\([^}]+\) \.xq-cell\{opacity:0\}/,
  /\.tetris-wave-b-main-well\[data-ghost3d-ready="true"\] \.tetris-cell\{opacity:0\}/,
  /\.tank-board\[data-ghost3d-ready="true"\] \.tank-ghost3d-dom-paint\{visibility:hidden\}/,
];
for (const pattern of readyReplacementSelectors) {
  assert.match(template, pattern,
    '3D may replace legacy paint only after the renderer marks its semantic first frame ready');
}

const forbiddenLayers = [
  'server',
  'shared',
  'public/src/online',
  'public/src/shop',
  'public/src/ui',
];
function sourceFiles(relative) {
  const absolute = path.join(ROOT, relative);
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes:true })) {
    const child = path.join(absolute, entry.name);
    if (entry.isDirectory()) result.push(...sourceFiles(path.relative(ROOT, child)));
    else if (/\.(?:js|json|sql)$/.test(entry.name)) result.push(child);
  }
  return result;
}
for (const layer of forbiddenLayers) {
  for (const file of sourceFiles(layer)) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /mg_ghost3d_|ghost3dReady/,
      `${path.relative(ROOT, file)} must not receive presentation flags or renderer readiness`);
  }
}

console.log('GHOST3D_FROZEN_OPTIONAL_CONTRACT_ALL_PASS games=6 optin=exact-one fallback=retained');
