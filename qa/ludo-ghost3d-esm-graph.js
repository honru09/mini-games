'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'ludo-entry.js');
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
function check(value, message) {
  assertions += 1;
  assert.ok(value, message);
}

function hash(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function importsFor(source) {
  const imports = [];
  const expression = /^\s*import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"];?\s*$/gm;
  let match = null;
  while ((match = expression.exec(source))) imports.push(match[1]);
  return imports;
}

function relativeGraph(entryPath) {
  const visited = new Set();
  const visit = filePath => {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    importsFor(fs.readFileSync(resolved, 'utf8')).forEach(specifier => {
      check(specifier.startsWith('.'), `${path.relative(ROOT, resolved)} has no bare or remote import (${specifier})`);
      const child = path.resolve(path.dirname(resolved), specifier);
      check(fs.existsSync(child), `${path.relative(ROOT, resolved)} import resolves (${specifier})`);
      visit(child);
    });
  };
  visit(entryPath);
  return visited;
}

Object.values(FILES).forEach(file => {
  check(fs.existsSync(file.path), `vendored dependency exists: ${path.relative(ROOT, file.path)}`);
  check(hash(file.path) === file.hash, `vendored dependency remains byte pinned: ${path.relative(ROOT, file.path)}`);
});

const source = fs.readFileSync(ENTRY, 'utf8');
const imports = importsFor(source);
check(JSON.stringify(imports) === JSON.stringify([
  '../vendor/three/r185/build/three.module.js',
  '../vendor/three/r185/examples/jsm/capabilities/WebGL.js',
  '../vendor/gsap/3.15.0/esm/gsap-core.js'
]), 'Ludo entry imports only the existing same-origin Three/WebGL/GSAP-core graph');

const exported = Array.from(source.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/gm), match => match[1]);
check(JSON.stringify(exported) === JSON.stringify(['VERSIONS', 'isLudo3DSupported', 'createLudo3DAdapter']), 'entry exports the small renderer Module Interface only');
check(!/^export\s+default/m.test(source), 'entry has no default or compatibility export');
check(/const VALID_MOTION = new Set\(\['piece_moved', 'terminal'\]\);/.test(source) && !/ludo_piece_moved|token_moved/.test(source), 'piece_moved stays the canonical action motion while terminal is the bounded presentation-only result beat');
check(/function readCapturedTokens\(event, projection, actorSeat, actorTokenIndex\)/.test(source) && /values\.slice\(0, maxCaptured\)/.test(source) && /safeRead\(value, 'from'\)/.test(source), 'captured-token substage parsing is bounded, pure, and revision-frame scoped');
check(/if \(captured\.length\) \{[\s\S]{0,900}addLabel\('capture', '>'\)/.test(source) && /capture\+=0\.12/.test(source) && /if \(reachedHome\) \{[\s\S]{0,620}addLabel\('finish', '>'\)/.test(source), 'capture rebound and finish remain finite piece_moved sub-stages rather than independent motion messages');
check(/const overviewPlan = cameraPlan\('overview'/.test(source) && /if \(overviewPlan\.animated\) \{[\s\S]{0,180}addLabel\('restore', '>'\);[\s\S]{0,180}tweenCamera\(next, overviewPlan, 'restore'\)/.test(source), 'animated qualities restore through the shared overview camera plan inside the same finite timeline');
check(/rig\.plan\('ludo', mode, targetValue, \{ quality, reducedMotion \}\)/.test(source) && /function playResult\(event\)/.test(source), 'renderer consumes the shared pure CameraRig and owns a finite terminal result shot');
check(/boardGroup\.rotation\.y = -projection\.quarterTurns \* \(Math\.PI \/ 2\);/.test(source), 'Three board rotation matches TabletopPerspective positive screen-clockwise quarters');
check(/function environment\(value, context\)[\s\S]{0,1200}if \(hasSemanticFrame\) renderOnce\(\);\s*return true;/.test(source), 'environment configuration remains successful before the first semantic frame');

[
  'GLTFLoader', 'DRACOLoader', 'KTX2Loader', 'TextureLoader', 'ScrollTrigger',
  'CSSPlugin', 'registerPlugin', 'repeat:', 'yoyo:', 'setTimeout(', 'setInterval(', 'requestAnimationFrame(',
  'fetch(', 'XMLHttpRequest'
].forEach(token => check(!source.includes(token), `entry excludes non-P0 asset, plugin, ambient, and network dependency: ${token}`));

[
  'THREE.ColorManagement.enabled = true',
  'renderer.outputColorSpace = THREE.SRGBColorSpace',
  'renderer.toneMapping = THREE.NoToneMapping',
  "canvas.setAttribute('aria-hidden', 'true')",
  'raycaster.intersectObjects(targets, true)',
  "canvas.addEventListener('webglcontextlost', contextLossHandler)",
  'event.preventDefault()',
  "id: 'ludo-three-r185'"
].forEach(token => check(source.includes(token), `entry retains required lifecycle seam: ${token}`));

const graph = Array.from(relativeGraph(ENTRY), filePath => path.relative(ROOT, filePath).replace(/\\/g, '/')).sort();
check(JSON.stringify(graph) === JSON.stringify([
  'public/three/ludo-entry.js',
  'public/vendor/gsap/3.15.0/esm/gsap-core.js',
  'public/vendor/three/r185/build/three.core.js',
  'public/vendor/three/r185/build/three.module.js',
  'public/vendor/three/r185/examples/jsm/capabilities/WebGL.js'
]), 'complete Ludo ESM graph stays closed, minimal, and same-origin');

console.log(`ALL_PASS ludo-ghost3d-esm-graph assertions=${assertions}`);
