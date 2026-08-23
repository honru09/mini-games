'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');

function filesBelow(relative) {
  const root = path.join(ROOT, relative);
  if (!fs.existsSync(root)) return [];
  const pending = [root], files = [];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes:true })) {
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) pending.push(target); else files.push(target);
    }
  }
  return files;
}
assert.deepStrictEqual(filesBelow('public/three'), [], 'retired Three renderer entries must not remain');
assert.deepStrictEqual(filesBelow('public/vendor/three'), [], 'vendored Three runtime files must not remain');

const build = read('scripts/build.js');
for (const moduleName of [
  'core/23-depth-scene.js',
  'core/25-camera-system.js',
  'core/26-ghost-mascot-motion.js',
  'core/27-page-transition.js',
  'core/28-game-stage-2_5d.js',
]) assert.ok(build.includes(moduleName), '2.5D build module missing: ' + moduleName);

const runtimeFiles = [
  'scripts/build.js',
  'public/sw.js',
  'public/index-template.html',
  'public/src/games/gomoku.js',
  'public/src/games/ludo.js',
  'public/src/games/monopoly.js',
  'public/src/games/xiangqi.js',
  'public/src/games/tetris.js',
  'public/src/games/tank.js',
];
const retiredPattern = /ghost3d|Ghost3D|GHOST3D|GameModuleLoader|RENDERER_CACHE_VERSION|RENDERER_ENTRY_ALLOWLIST|vendor\/three|public\/three/;
for (const relative of runtimeFiles) {
  assert.doesNotMatch(read(relative), retiredPattern, relative + ' still exposes retired 3D runtime');
}

const packageJson = read('package.json');
const qualityGates = read('scripts/quality-gates.js');
assert.doesNotMatch(packageJson, /ghost3d|tabletop-camera-rig|renderer-(?:device-profile|runtime-governor|quality-adapter)|game-module-loader|sw-game-module-preheat/i);
assert.doesNotMatch(qualityGates, /ghost3d|tabletop-camera-rig|renderer-(?:device-profile|runtime-governor|quality-adapter)|game-module-loader|sw-game-module-preheat/i);

console.log('VISUAL_25D_ONLY_RUNTIME_ALL_PASS');
