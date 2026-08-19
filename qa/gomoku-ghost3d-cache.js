'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'public', 'src', 'core', '14-game-module-loader.js'), 'utf8');
const caller = fs.readFileSync(path.join(root, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
const entry = fs.readFileSync(path.join(root, 'public', 'three', 'gomoku-entry.js'));
const sha256 = crypto.createHash('sha256').update(entry).digest('hex');
const rendererUrl = `./three/gomoku-entry.js?v=sha256-${sha256.slice(0, 16)}`;

const cacheVersionMatch = source.match(/const CACHE_VERSION='ghost-game-shell-v(\d+)-(\d{8})';/);
assert.ok(cacheVersionMatch && cacheVersionMatch[1] === '14' && cacheVersionMatch[2] === '20260816',
  'the shell cache must use the v14 renderer-identity generation');
assert.match(source, /const RENDERER_CACHE_VERSION='ghost-game-renderer-v17-20260819';/,
  'verified renderer entries must stay out of the shell cache');
assert.ok(source.includes(`url:'${rendererUrl}'`) && source.includes(`sha256:'${sha256}'`) &&
  source.includes("exports:Object.freeze(['isGomoku3DSupported','createGomoku3DAdapter'])"),
  'Gomoku renderer allowlist entry must bind the exact version URL, full digest, and exported Adapter Interface');
assert.ok(loader.includes(`sha256: '${sha256}'`) && loader.includes(`primary: '${rendererUrl}'`),
  'the Gomoku Loader descriptor must agree with the service-worker identity');
assert.match(caller, /GameModuleLoader\.load\('gomoku',\s*\{\s*resource\s*:\s*'renderer'\s*\}\)/,
  'Gomoku must request its optional renderer through the closed GameModuleLoader seam');
assert.ok(!/import\(\s*['"]\.\/three\/gomoku-entry\.js/.test(caller),
  'Gomoku callers must not retain an arbitrary direct renderer import path');

const shellMatch = source.match(/const SHELL=(\[[^;]+\]);/);
assert.ok(shellMatch, 'service worker shell allowlist must remain statically auditable');
const shell = JSON.parse(shellMatch[1].replace(/'/g, '"'));
const forbidden = [
  'three/gomoku-entry.js',
  'route-motion-entry.js',
  'surface-motion-entry.js',
  'vendor/three/',
  'vendor/gsap/'
];
for (const item of shell) {
  assert.ok(!forbidden.some(prefix => String(item).includes(prefix)),
    `Ghost3D runtime must stay lazy and out of the install shell: ${item}`);
}

assert.match(source, /async function cacheFirstRenderer\(request,descriptor\)/,
  'exact renderer URLs must go through the verified renderer cache, not generic static caching');
assert.match(source, /async function warmRenderer\(descriptor\)/,
  'the bounded Gomoku warmup path remains available without putting the renderer in the install shell');

console.log('GOMOKU_GHOST3D_CACHE_ALL_PASS');
