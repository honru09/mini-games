'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'tank-entry.js');
const PINNED = Object.freeze({
  'public/vendor/three/r185/build/three.module.js': 'BBF5ED13FE4373F5BD38B14EA8E62E9F157327DA5638EDC6D3863E08B167C9C7',
  'public/vendor/three/r185/build/three.core.js': '3718DF126D69C125362A03340913204470D8C50238605150E57F808840FB7759',
  'public/vendor/three/r185/examples/jsm/capabilities/WebGL.js': '02D6F471F7CFE5F70B27FCEF39E0BA236229A79365C45071E193D4A32495E8A1',
  'public/vendor/gsap/3.15.0/esm/gsap-core.js': '83C4B6C0B020BEBA737B90896181560B76747342B0F7BAA5BA1B185A75F65B65'
});
let assertions = 0;
let failures = 0;
function check(value, message) { assertions += 1; try { assert.ok(value, message); console.log('PASS  ' + message); } catch (_error) { failures += 1; console.error('FAIL  ' + message); } }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase(); }
function imports(source) {
  return Array.from(source.matchAll(/^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?\s*$/gm), row => row[1]);
}
function graph(entry) {
  const visited = new Set();
  const visit = file => {
    const absolute = path.resolve(file);
    if (visited.has(absolute) || !fs.existsSync(absolute)) return;
    visited.add(absolute);
    imports(fs.readFileSync(absolute, 'utf8')).forEach(specifier => {
      check(specifier.startsWith('.'), path.relative(ROOT, absolute) + ' has no bare/remote import: ' + specifier);
      const child = path.resolve(path.dirname(absolute), specifier);
      check(fs.existsSync(child), path.relative(ROOT, absolute) + ' resolves import: ' + specifier);
      visit(child);
    });
  };
  visit(entry);
  return visited;
}

Object.entries(PINNED).forEach(([relative, expected]) => {
  const file = path.join(ROOT, relative);
  check(fs.existsSync(file), 'pinned vendor exists: ' + relative);
  if (fs.existsSync(file)) check(hash(file) === expected, 'pinned vendor hash remains exact: ' + relative);
});

check(fs.existsSync(ENTRY), 'Tank P5 ESM entry exists');
if (fs.existsSync(ENTRY)) {
  const source = fs.readFileSync(ENTRY, 'utf8');
  check(JSON.stringify(imports(source)) === JSON.stringify([
    '../vendor/three/r185/build/three.module.js',
    '../vendor/three/r185/examples/jsm/capabilities/WebGL.js',
    '../vendor/gsap/3.15.0/esm/gsap-core.js'
  ]), 'Tank entry imports exactly the pinned Three/WebGL/GSAP-core island');
  [
    'GLTFLoader', 'DRACOLoader', 'KTX2Loader', 'TextureLoader', 'ScrollTrigger', 'CSSPlugin',
    'registerPlugin', 'https://', 'http://', 'asset_manifest', 'tank-art-p1', 'ART-035', 'fetch('
  ].forEach(token => check(!source.includes(token), 'closed graph excludes: ' + token));
  const actual = Array.from(graph(ENTRY), file => path.relative(ROOT, file).replace(/\\/g, '/')).sort();
  check(JSON.stringify(actual) === JSON.stringify([
    'public/three/tank-entry.js',
    'public/vendor/gsap/3.15.0/esm/gsap-core.js',
    'public/vendor/three/r185/build/three.core.js',
    'public/vendor/three/r185/build/three.module.js',
    'public/vendor/three/r185/examples/jsm/capabilities/WebGL.js'
  ]), 'Tank ESM graph remains closed, same-origin, and minimal');
}

if (failures) { console.error('TANK_GHOST3D_ESM_GRAPH_FAILURES=' + failures + ' assertions=' + assertions); process.exitCode = 1; }
else console.log('TANK_GHOST3D_ESM_GRAPH_ALL_PASS assertions=' + assertions);
