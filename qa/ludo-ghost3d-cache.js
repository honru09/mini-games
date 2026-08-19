'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GAME_ID = 'ludo';
const ENTRY_FILE = 'ludo-entry.js';
const ENTRY_EXPORTS = ['isLudo3DSupported', 'createLudo3DAdapter'];
const source = fs.readFileSync(path.join(ROOT, 'public', 'sw.js'), 'utf8');
const loader = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '14-game-module-loader.js'), 'utf8');
const caller = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'ludo.js'), 'utf8');
const entry = fs.readFileSync(path.join(ROOT, 'public', 'three', ENTRY_FILE));
const sha256 = crypto.createHash('sha256').update(entry).digest('hex');
const rendererUrl = `./three/${ENTRY_FILE}?v=sha256-${sha256.slice(0, 16)}`;

assert.match(source, /const CACHE_VERSION='ghost-game-shell-v14-20260816';/,
  'the shell cache must advance with the T2 renderer identity generation');
assert.match(source, /const RENDERER_CACHE_VERSION='ghost-game-renderer-v17-20260819';/,
  'Ludo renderer entries must use the dedicated verified renderer cache');
assert.ok(source.includes(`gameId:'${GAME_ID}'`) && source.includes(`url:'${rendererUrl}'`) &&
  source.includes(`sha256:'${sha256}'`) && source.includes(`exports:Object.freeze(['${ENTRY_EXPORTS[0]}','${ENTRY_EXPORTS[1]}'])`),
  'the Ludo SW descriptor must bind its exact version URL, full digest, and Adapter Interface');
assert.ok(loader.includes(`sha256: '${sha256}'`) && loader.includes(`primary: '${rendererUrl}'`),
  'the Ludo Loader descriptor must agree with the service-worker identity');
assert.match(caller, /GameModuleLoader\.load\('ludo',\s*\{\s*resource\s*:\s*'renderer'\s*\}\)/,
  'Ludo must request its optional renderer through the closed GameModuleLoader seam');
assert.ok(!/import\(\s*['"]\.\/three\/ludo-entry\.js/.test(caller),
  'Ludo callers must not retain an arbitrary direct renderer import path');

const shellMatch = source.match(/const SHELL=(\[[^;]+\]);/);
assert.ok(shellMatch, 'service-worker install shell remains statically auditable');
const shell = JSON.parse(shellMatch[1].replace(/'/g, '"'));
for (const forbidden of ['three/ludo-entry.js', 'vendor/three/', 'vendor/gsap/']) {
  assert.ok(!shell.some(item => String(item).includes(forbidden)),
    `Ludo renderer runtime stays lazy and out of the install shell: ${forbidden}`);
}
assert.match(source, /async function cacheFirstRenderer\(request,descriptor\)/,
  'exact renderer URLs must go through the verified renderer cache, not generic static caching');
assert.match(source, /async function warmRenderer\(descriptor\)/,
  'the bounded Ludo warmup path remains available without putting the renderer in the install shell');

console.log('LUDO_GHOST3D_CACHE_ALL_PASS');
