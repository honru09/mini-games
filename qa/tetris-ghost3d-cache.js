'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME_ID = 'tetris';
const ENTRY_FILE = 'tetris-entry.js';
const ENTRY_EXPORTS = ['isTetris3DSupported', 'createTetris3DAdapter'];
const serviceWorker = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const loader = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '14-game-module-loader.js'), 'utf8');
const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build.js'), 'utf8');
const presenter = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tetris-ghost3d-presenter.js'), 'utf8');
const entry = fs.readFileSync(path.join(ROOT, 'public', 'three', ENTRY_FILE));
const sha256 = crypto.createHash('sha256').update(entry).digest('hex');
const rendererUrl = `./three/${ENTRY_FILE}?v=sha256-${sha256.slice(0, 16)}`;

assert.ok(build.indexOf("'games/tetris-ghost3d-presenter.js'") >= 0,
  'Tetris Presenter is included in the deterministic build');
assert.ok(build.indexOf("'games/tetris-ghost3d-presenter.js'") < build.indexOf("'games/tetris.js'"),
  'Presenter is concatenated before its Tetris caller');
assert.match(serviceWorker, /const CACHE_VERSION='ghost-game-shell-v14-20260816';/,
  'the shell cache must advance with the T2 renderer identity generation');
assert.match(serviceWorker, /const RENDERER_CACHE_VERSION='ghost-game-renderer-v17-20260819';/,
  'Tetris renderer entries must use the dedicated verified renderer cache');
assert.ok(serviceWorker.includes(`gameId:'${GAME_ID}'`) && serviceWorker.includes(`url:'${rendererUrl}'`) &&
  serviceWorker.includes(`sha256:'${sha256}'`) && serviceWorker.includes(`exports:Object.freeze(['${ENTRY_EXPORTS[0]}','${ENTRY_EXPORTS[1]}'])`),
  'the Tetris SW descriptor must bind its exact version URL, full digest, and Adapter Interface');
assert.ok(loader.includes(`sha256: '${sha256}'`) && loader.includes(`primary: '${rendererUrl}'`),
  'the Tetris Loader descriptor must agree with the service-worker identity');
assert.match(presenter, /loader\.load\('tetris',\s*\{\s*resource\s*:\s*'renderer'\s*\}\)/,
  'Tetris must request its optional renderer through the closed GameModuleLoader seam');
assert.ok(!/import\(\s*['"]\.\/three\/tetris-entry\.js/.test(presenter),
  'Tetris callers must not retain an arbitrary direct renderer import path');

const shellMatch = serviceWorker.match(/const SHELL=(\[[^;]+\]);/);
assert.ok(shellMatch, 'service-worker install shell remains statically auditable');
const shell = JSON.parse(shellMatch[1].replace(/'/g, '"'));
for (const forbidden of ['three/tetris-entry.js', 'vendor/three/', 'vendor/gsap/']) {
  assert.ok(!shell.some(item => String(item).includes(forbidden)),
    `Tetris renderer runtime stays lazy and out of the install shell: ${forbidden}`);
}
assert.match(serviceWorker, /async function cacheFirstRenderer\(request,descriptor\)/,
  'exact renderer URLs must go through the verified renderer cache, not generic static caching');
assert.match(serviceWorker, /async function warmRenderer\(descriptor\)/,
  'the bounded Tetris warmup path remains available without putting the renderer in the install shell');

console.log('TETRIS_GHOST3D_CACHE_ALL_PASS');
