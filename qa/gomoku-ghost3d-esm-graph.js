'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'gomoku-entry.js');
const PROVENANCE = path.join(ROOT, 'requirements', 'active', 'gomoku-ghost3d-vertical-slice-p0-20260812', 'vendor-provenance.md');
const FILES = Object.freeze({
  threeModule: {
    path: path.join(ROOT, 'public', 'vendor', 'three', 'r185', 'build', 'three.module.js'),
    hash: 'BBF5ED13FE4373F5BD38B14EA8E62E9F157327DA5638EDC6D3863E08B167C9C7'
  },
  threeCore: {
    path: path.join(ROOT, 'public', 'vendor', 'three', 'r185', 'build', 'three.core.js'),
    hash: '3718DF126D69C125362A03340913204470D8C50238605150E57F808840FB7759'
  },
  webgl: {
    path: path.join(ROOT, 'public', 'vendor', 'three', 'r185', 'examples', 'jsm', 'capabilities', 'WebGL.js'),
    hash: '02D6F471F7CFE5F70B27FCEF39E0BA236229A79365C45071E193D4A32495E8A1'
  },
  gsap: {
    path: path.join(ROOT, 'public', 'vendor', 'gsap', '3.15.0', 'esm', 'gsap-core.js'),
    hash: '83C4B6C0B020BEBA737B90896181560B76747342B0F7BAA5BA1B185A75F65B65'
  }
});

let assertions = 0;
function check(condition, message) {
  assertions += 1;
  assert.ok(condition, message);
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function importsFor(source) {
  const imports = [];
  const expression = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?\s*$/gm;
  let match;
  while ((match = expression.exec(source))) imports.push(match[1]);
  return imports;
}

function relativeGraph(entryPath) {
  const visited = new Set();
  const walk = filePath => {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    const source = fs.readFileSync(resolved, 'utf8');
    importsFor(source).forEach(specifier => {
      check(specifier.startsWith('.'), `${path.relative(ROOT, resolved)} must not import a bare or remote specifier (${specifier})`);
      const child = path.resolve(path.dirname(resolved), specifier);
      check(fs.existsSync(child), `${path.relative(ROOT, resolved)} import must resolve: ${specifier}`);
      walk(child);
    });
  };
  walk(entryPath);
  return visited;
}

Object.values(FILES).forEach(file => {
  check(fs.existsSync(file.path), `vendored file exists: ${path.relative(ROOT, file.path)}`);
  check(hashFile(file.path) === file.hash, `vendored SHA-256 stays pinned: ${path.relative(ROOT, file.path)}`);
});

const threeModule = fs.readFileSync(FILES.threeModule.path, 'utf8');
const threeCore = fs.readFileSync(FILES.threeCore.path, 'utf8');
const webgl = fs.readFileSync(FILES.webgl.path, 'utf8');
const gsap = fs.readFileSync(FILES.gsap.path, 'utf8');
const entry = fs.readFileSync(ENTRY, 'utf8');
const provenance = fs.readFileSync(PROVENANCE, 'utf8');

check(threeModule.startsWith('/**\n * @license'), 'Three module retains its official license header');
check(threeCore.startsWith('/**\n * @license'), 'Three transitive core retains its official license header');
check(threeModule.includes("from './three.core.js'"), 'Three module declares only its vendored core sibling');
check(webgl.includes('class WebGL') && webgl.includes('isWebGL2Available'), 'official WebGL2 capability addon is present');
check(gsap.includes('GSAP 3.15.0') && gsap.includes('standard-license'), 'GSAP core retains its official license header');
check(!/^\s*import\s/m.test(gsap), 'GSAP core stays self-contained without a transitive module graph');

const imports = importsFor(entry);
check(JSON.stringify(imports) === JSON.stringify([
  '../vendor/three/r185/build/three.module.js',
  '../vendor/three/r185/examples/jsm/capabilities/WebGL.js',
  '../vendor/gsap/3.15.0/esm/gsap-core.js'
]), 'entry imports only the pinned Three module, WebGL capability addon, and GSAP core');

const exported = Array.from(entry.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/gm), match => match[1]);
check(JSON.stringify(exported) === JSON.stringify(['VERSIONS', 'isGomoku3DSupported', 'createGomoku3DAdapter']), 'entry exports exactly the stable renderer API');
check(!/^export\s+default/m.test(entry), 'entry has no default or legacy public export');

[
  'GLTFLoader', 'DRACOLoader', 'KTX2Loader', 'TextureLoader', 'ScrollTrigger',
  'registerPlugin', 'scrollTrigger', 'CSSPlugin', 'gsap/esm/index.js',
  'repeat:', 'yoyo:', 'setTimeout(', 'setInterval(', 'requestAnimationFrame('
].forEach(token => check(!entry.includes(token), `entry excludes forbidden runtime dependency or ambient work: ${token}`));

[
  'THREE.ColorManagement.enabled = true',
  'renderer.outputColorSpace = THREE.SRGBColorSpace',
  'renderer.toneMapping = THREE.NoToneMapping',
  "canvas.setAttribute('aria-hidden', 'true')",
  'boardGroup.worldToLocal',
  'raycaster.intersectObject(pickPlane, false)',
  'new ResizeObserver',
  "canvas.addEventListener('webglcontextlost', contextLossHandler)",
  "event.preventDefault()"
].forEach(token => check(entry.includes(token), `entry retains required renderer contract: ${token}`));

const graph = relativeGraph(ENTRY);
const graphPaths = Array.from(graph, filePath => path.relative(ROOT, filePath).replace(/\\/g, '/')).sort();
check(JSON.stringify(graphPaths) === JSON.stringify([
  'public/three/gomoku-entry.js',
  'public/vendor/gsap/3.15.0/esm/gsap-core.js',
  'public/vendor/three/r185/build/three.core.js',
  'public/vendor/three/r185/build/three.module.js',
  'public/vendor/three/r185/examples/jsm/capabilities/WebGL.js'
]), 'the complete ESM graph is minimal and same-origin');

[
  '2431a09f46f34c560bc8e44b33be0e567723d5b9',
  '13e2b790546426a1a2e0e9b409f3f8dc6d6611f2',
  FILES.threeModule.hash,
  FILES.threeCore.hash,
  FILES.webgl.hash,
  FILES.gsap.hash
].forEach(value => check(provenance.includes(value), `provenance records ${value}`));

console.log(`ALL_PASS gomoku-ghost3d-esm-graph assertions=${assertions}`);
