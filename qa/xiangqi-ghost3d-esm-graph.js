'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRY = path.join(ROOT, 'public', 'three', 'xiangqi-entry.js');
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
      check(specifier.startsWith('.'), path.relative(ROOT, resolved) + ' has no bare or remote import (' + specifier + ')');
      const child = path.resolve(path.dirname(resolved), specifier);
      check(fs.existsSync(child), path.relative(ROOT, resolved) + ' import resolves (' + specifier + ')');
      visit(child);
    });
  };
  visit(entryPath);
  return visited;
}

Object.values(FILES).forEach(file => {
  check(fs.existsSync(file.path), 'vendored dependency exists: ' + path.relative(ROOT, file.path));
  check(hash(file.path) === file.hash, 'vendored dependency remains byte pinned: ' + path.relative(ROOT, file.path));
});

const source = fs.readFileSync(ENTRY, 'utf8');
const imports = importsFor(source);
check(JSON.stringify(imports) === JSON.stringify([
  '../vendor/three/r185/build/three.module.js',
  '../vendor/three/r185/examples/jsm/capabilities/WebGL.js',
  '../vendor/gsap/3.15.0/esm/gsap-core.js'
]), 'Xiangqi entry imports only the pinned same-origin Three/WebGL/GSAP-core graph');

const exported = Array.from(source.matchAll(/^export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/gm), match => match[1]);
check(JSON.stringify(exported) === JSON.stringify(['XIANGQI_3D_QUALITY', 'isXiangqi3DSupported', 'createXiangqi3DAdapter']),
  'entry exports only the requested Xiangqi renderer surface');
check(!/^export\s+default/m.test(source), 'entry has no default or legacy compatibility export');

[
  'GLTFLoader', 'DRACOLoader', 'KTX2Loader', 'TextureLoader', 'ScrollTrigger',
  'CSSPlugin', 'registerPlugin', 'repeat:', 'yoyo:', 'setTimeout(', 'setInterval(',
  'requestAnimationFrame(', 'fetch(', 'XMLHttpRequest', 'Raycaster', 'pointerdown',
  'pointermove', 'onInput'
].forEach(token => check(!source.includes(token), 'entry excludes ambient input, network, plugin, and unapproved asset dependency: ' + token));

[
  'money', 'price', 'coins', 'owned', 'reward', 'replay', 'dice',
  'sendXiangqi', 'XiangqiRules', 'MonopolyRules'
].forEach(token => check(!new RegExp('\\b' + token + '\\b', 'i').test(source),
  'renderer does not consume authority, economy, rule, or input field: ' + token));

[
  'const ROWS = 10;',
  'const COLS = 9;',
  "const VALID_MOTION = new Set(['piece_moved', 'check', 'terminal']);",
  "canvas.setAttribute('aria-hidden', 'true')",
  "canvas.style.pointerEvents = 'none'",
  'new ResizeObserver',
  'function scheduleResize()',
  "canvas.addEventListener('webglcontextlost', contextLossHandler)",
  'event.preventDefault()',
  "id: 'xiangqi-three-r185'",
  'function readProjection(frame)',
  'function readMotion(event, revision)',
  'function readOrigin(value)',
  'function readCoordinate(value)',
  'function isDeepFrozen(value, seen)',
  "safeRead(frame, 'origin')",
  "safeRead(frame, 'current')",
  "safeRead(frame, 'moveNumber')",
  "safeRead(frame, 'lastMove')",
  "safeRead(frame, 'winner')",
  "safeRead(event, 'eventId')",
  "safeRead(event, 'player')"
].forEach(token => check(source.includes(token), 'entry retains required renderer/lifecycle boundary: ' + token));

[
  'winnerPlayerId',
  "safeRead(frame, 'turn')",
  "safeRead(frame, 'process')",
  "safeRead(event, 'playerId')",
  "safeRead(event, 'pieceType')",
  "safeRead(event, 'captured')"
].forEach(token => check(!source.includes(token),
  'entry accepts only the frozen Xiangqi P3 public frame and motion vocabulary: ' + token));

const graph = Array.from(relativeGraph(ENTRY), filePath => path.relative(ROOT, filePath).replace(/\\/g, '/')).sort();
check(JSON.stringify(graph) === JSON.stringify([
  'public/three/xiangqi-entry.js',
  'public/vendor/gsap/3.15.0/esm/gsap-core.js',
  'public/vendor/three/r185/build/three.core.js',
  'public/vendor/three/r185/build/three.module.js',
  'public/vendor/three/r185/examples/jsm/capabilities/WebGL.js'
]), 'complete Xiangqi ESM graph stays closed, minimal, and same-origin');

console.log('ALL_PASS xiangqi-ghost3d-esm-graph assertions=' + assertions);
