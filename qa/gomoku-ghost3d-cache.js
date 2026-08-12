'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'public', 'sw.js'), 'utf8');

const cacheVersionMatch = source.match(/const CACHE_VERSION='ghost-game-shell-v(\d+)-(\d{8})';/);
assert.ok(cacheVersionMatch && Number(cacheVersionMatch[1]) >= 3 && cacheVersionMatch[2] >= '20260812',
  'the shell cache must retain or advance the Gomoku Ghost3D invalidation generation');
assert.match(source, /CACHEABLE_DESTINATIONS=new Set\(\[[^\]]*'script'[^\]]*\]\)/,
  'same-origin ESM scripts must remain eligible for demand-loaded runtime caching');

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

assert.match(source, /async function cacheFirstStatic\(request\)/,
  'demand-loaded renderer modules must retain same-origin cache-first behavior');
assert.match(source, /CACHEABLE_DESTINATIONS\.has\(request\.destination\)/,
  'static runtime caching must remain destination-gated');

console.log('GOMOKU_GHOST3D_CACHE_ALL_PASS');
