'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME_ID = 'tank';
const ENTRY_FILE = 'tank-entry.js';
const ENTRY_EXPORTS = ['isTank3DSupported', 'createTank3DAdapter'];
const build = fs.readFileSync(path.join(ROOT, 'scripts', 'build.js'), 'utf8');
const source = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const loader = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '14-game-module-loader.js'), 'utf8');
const presenter = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'tank-ghost3d-presenter.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const entry = fs.readFileSync(path.join(ROOT, 'public', 'three', ENTRY_FILE));
const sha256 = crypto.createHash('sha256').update(entry).digest('hex');
const rendererUrl = `./three/${ENTRY_FILE}?v=sha256-${sha256.slice(0, 16)}`;

assert.ok(build.indexOf("'games/tank-ghost3d-presenter.js'") >= 0,
  'Tank Presenter is included in the deterministic build');
assert.ok(build.indexOf("'games/tank-ghost3d-presenter.js'") < build.indexOf("'games/tank.js'"),
  'Tank Presenter is concatenated before its Tank caller');
assert.match(source, /const CACHE_VERSION='ghost-game-shell-v14-20260816';/,
  'the shell cache must advance with the T2 renderer identity generation');
assert.match(source, /const RENDERER_CACHE_VERSION='ghost-game-renderer-v17-20260819';/,
  'Tank renderer entries must use the dedicated verified renderer cache');
assert.ok(source.includes(`gameId:'${GAME_ID}'`) && source.includes(`url:'${rendererUrl}'`) &&
  source.includes(`sha256:'${sha256}'`) && source.includes(`exports:Object.freeze(['${ENTRY_EXPORTS[0]}','${ENTRY_EXPORTS[1]}'])`),
  'the Tank SW descriptor must bind its exact primary version URL, full digest, and Adapter Interface');
assert.ok(loader.includes(`sha256: '${sha256}'`) && loader.includes(`primary: '${rendererUrl}'`),
  'the Tank Loader primary descriptor must agree with the service-worker identity');
assert.match(presenter, /loader\.load\('tank',\s*\{\s*resource\s*:\s*'renderer'\s*,\s*variant\s*:\s*variant\s*\}\)/,
  'Tank must request its optional renderer through the closed GameModuleLoader seam');
assert.ok(!/import\(\s*['"]\.\/three\/tank-entry\.js/.test(presenter),
  'Tank callers must not retain an arbitrary direct renderer import path');
assert.ok(/mg_art_game_stage_wave_b_v1/.test(presenter) && /mg_ghost3d_tank_v1/.test(presenter) &&
  /mg_ghost3d_tank_v1['"]\)\s*===\s*['"]1['"]/.test(presenter),
  'the frozen Tank renderer requires exact opt-in and fails closed without storage');
assert.ok(/fallback|rendererBlocked|failure/i.test(presenter) && /ghost3dReady/.test(presenter),
  'Tank preserves an explicit DOM-ready/fallback path after loader failure');

const shellMatch = source.match(/const SHELL=(\[[^;]+\]);/);
assert.ok(shellMatch, 'service-worker install shell remains statically auditable');
const shell = JSON.parse(shellMatch[1].replace(/'/g, '"'));
for (const forbidden of ['three/tank-entry.js', 'vendor/three/', 'vendor/gsap/']) {
  assert.ok(!shell.some(item => String(item).includes(forbidden)),
    `Tank renderer runtime stays lazy and out of the install shell: ${forbidden}`);
}
assert.ok(!/rel=['"]modulepreload['"][^>]*(?:tank-entry|vendor\/three|vendor\/gsap)|(?:tank-entry|vendor\/three|vendor\/gsap)[^>]*rel=['"]modulepreload['"]/i.test(template),
  'login and shell template do not preload the optional Tank island');
assert.match(source, /async function cacheFirstRenderer\(request,descriptor\)/,
  'exact renderer URLs must go through the verified renderer cache, not generic static caching');
assert.match(source, /async function warmRenderer\(descriptor\)/,
  'the bounded Tank primary warmup remains available without putting the renderer in the install shell');

console.log('TANK_GHOST3D_CACHE_ALL_PASS');
