// Build script: concatenate public/src/* modules into public/index.html.
//
// The default command remains a write build:
//   node scripts/build.js
//   node scripts/build.js --write
// A release/CI check can perform the same deterministic calculation without
// touching the generated file:
//   node scripts/build.js --check
//
// This file intentionally has no dependencies outside Node's standard
// library. The small createBuildSeam() export is used by focused build tests;
// production callers use the CLI above.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const TEMPLATE = path.join(ROOT, 'public', 'index-template.html');
const OUT = path.join(ROOT, 'public', 'index.html');
const MARKER = '<!-- BUILD:JS -->';

// JS modules in concatenation order. Keep this list explicit and ordered:
// changing it is a product/build decision, not a filesystem enumeration.
const MODULES = Object.freeze([
  'games/00-tabletop-perspective.js',
  // Shared Ghost3D camera vocabulary is pure presentation data. Renderers
  // own Three/GSAP objects and may consume these frozen poses lazily.
  'games/00-tabletop-camera-rig.js',
  'core/00-i18n.js',
  'core/01-utils.js',
  'core/06-assets.js',
  // Player identity presentation is defined before consumers and resolves the
  // roster-owned catalogs lazily when its small Interface is invoked.
  'core/10-identity-presentation.js',
  '../../shared/progression/victory-mastery.js',
  '../../shared/progression/profile-journey.js',
  '../../shared/progression/collection-rarity-catalog.js',
  // T5 restores optional Tank delta envelopes to the same canonical v1
  // snapshot consumed by the existing online client and game caller.
  '../../shared/protocol/tank-snapshot-wire-codec.js',
  // Deep route-motion bridge stays synchronous and lazy-loads its DOM GSAP island only on demand.
  'core/09-route-motion.js',
  // Shared overlay motion stays presentation-only and lazy-loads the same pinned GSAP island.
  'core/11-surface-motion.js',
  // Game Stage status feedback is a presentation-only, lazy GSAP island.
  'core/12-game-stage-motion.js',
  // Technical runtime controls are inert until a caller explicitly creates
  // an instance; they expose no DOM, game, network, or persistence behavior.
  'core/13-client-diagnostics-ring.js',
  'core/13-renderer-device-profile.js',
  'core/13-renderer-runtime-governor.js',
  // Frame-budget recommendations become real Renderer quality changes only
  // through this presentation-only, caller-rejectable adapter.
  'core/13-renderer-quality-adapter.js',
  // Game-scoped optional Renderer islands are resolved through this loader;
  // the six logical game factories remain inline and synchronous.
  'core/14-game-module-loader.js',
  // 2.5D-first platform presentation. These bridges are renderer-agnostic;
  // the optional GSAP adapter is lazy and the frozen Three islands stay off.
  'core/23-depth-scene.js',
  'core/25-camera-system.js',
  'core/26-ghost-mascot-motion.js',
  'core/27-page-transition.js',
  'core/28-game-stage-2_5d.js',
  // T3 semantic feedback and input seams are inert by default. The local
  // adapter owns only explicitly unlocked, bounded Tank audio/haptics.
  'core/15-feedback-bus.js',
  'core/16-gameplay-input-gate.js',
  'core/17-local-feedback-adapter.js',
  // Unified presentation audio stays behind the same inert semantic seam;
  // the browser lifecycle bridge is loaded only after the pure adapters.
  'core/21-unified-feedback-adapter.js',
  'core/22-audio-runtime.js',
  // T4 board AI remains a default-off local optimization.  Keep the pure
  // kernel before its broker and both before any game caller.
  'core/18-board-ai-kernel.js',
  'core/19-board-ai-worker-broker.js',
  // T5 local movement prediction is default-off and presentation-only.
  'core/20-tank-prediction-adapter.js',
  'core/02-app-shell.js',
  'core/03-game-framework.js',
  'core/04-social.js',
  'core/05-ai-personas.js',
  'online/03-websocket.js',
  'core/07-playline.js',
  // Foundation is inert until an exact per-game opt-in bridge creates an instance.
  'core/08-ghost3d-foundation.js',
  'shop/04-auth.js',
  'shop/05-profile.js',
  'shop/06-shop.js',
  'ui/07-roster.js',
  '../../shared/rules/tetris.js',
  '../../shared/rules/xiangqi.js',
  '../../shared/rules/monopoly.js',
  'games/00-tabletop-art-runtime.js',
  'games/monopoly-character-presentation.js',
  'games/monopoly-presentation-adapter.js',
  'games/monopoly-ui-state.js',
  'games/gomoku.js',
  'games/ludo.js',
  'games/monopoly.js',
  // Tank owns the caller; its presentation-only deep module must exist first.
  'games/tank-ghost3d-presenter.js',
  'games/tank.js',
  // Tetris owns the caller; its presentation-only deep module must exist first.
  'games/tetris-ghost3d-presenter.js',
  'games/tetris.js',
  'games/xiangqi.js',
  '08-registry.js',
]);

function normalizeLf(value) {
  return String(value).replace(/\r\n?/g, '\n');
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function describeText(text) {
  const normalized = normalizeLf(text);
  const buffer = Buffer.from(normalized, 'utf8');
  return Object.freeze({
    chars: normalized.length,
    utf8Bytes: buffer.length,
    sha256: sha256(buffer),
  });
}

function describeBuffer(value) {
  const buffer = Buffer.isBuffer(value) ? value : Buffer.from(value || '');
  return Object.freeze({
    chars: buffer.toString('utf8').length,
    utf8Bytes: buffer.length,
    sha256: sha256(buffer),
  });
}

function firstByteDifference(expected, actual) {
  const left = Buffer.isBuffer(expected) ? expected : Buffer.from(expected || '');
  const right = Buffer.isBuffer(actual) ? actual : Buffer.from(actual || '');
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? null : limit;
}

function readBuildOutput(options = {}) {
  const io = options.io || fs;
  const root = options.root || ROOT;
  const templatePath = options.templatePath || path.join(root, 'public', 'index-template.html');
  const modules = options.modules || MODULES;
  const srcDir = options.srcDir || path.join(root, 'public', 'src');
  const template = io.readFileSync(templatePath, 'utf8');
  if (!template.includes(MARKER)) {
    throw new Error('Template missing <!-- BUILD:JS --> marker');
  }

  let js = '';
  for (const mod of modules) {
    const filePath = path.join(srcDir, mod);
    let content;
    try {
      content = io.readFileSync(filePath, 'utf8');
    } catch (error) {
      const wrapped = new Error('Module not found: ' + mod);
      wrapped.cause = error;
      throw wrapped;
    }
    js += String(content).replace(/\r?\n$/, '') + '\n';
  }
  js = js.trimEnd();

  // Use a callback to avoid `$` replacement-pattern interpretation, then
  // normalize source/template line endings for cross-platform determinism.
  return normalizeLf(template.replace(MARKER, () => js));
}

function inspectGenerated(text) {
  const summary = describeText(text);
  const scriptTags = (text.match(/<script>/g) || []).length;
  const closeTags = (text.match(/<\/script>/g) || []).length;
  return Object.freeze({ ...summary, scriptTags, closeTags });
}

function readExisting(io, outPath) {
  try {
    return io.readFileSync(outPath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function compareBuild(options = {}) {
  const io = options.io || fs;
  const outPath = options.outPath || OUT;
  const expectedText = readBuildOutput(options);
  const expected = Buffer.from(expectedText, 'utf8');
  const existing = readExisting(io, outPath);
  const same = existing !== null && Buffer.compare(expected, existing) === 0;
  return Object.freeze({
    ok: same,
    changed: !same,
    outPath,
    expected: inspectGenerated(expectedText),
    actual: existing === null ? null : describeBuffer(existing),
    firstByte: existing === null ? 0 : firstByteDifference(expected, existing),
  });
}

function randomTempPath(outPath) {
  const suffix = crypto.randomBytes(12).toString('hex');
  return outPath + '.tmp-' + process.pid + '-' + suffix;
}

function writeAll(io, fd, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const written = io.writeSync(fd, buffer, offset, buffer.length - offset);
    if (!Number.isInteger(written) || written <= 0) throw new Error('short build write');
    offset += written;
  }
}

function writeAtomic(io, outPath, buffer) {
  const tempPath = randomTempPath(outPath);
  let fd = null;
  let renamed = false;
  try {
    fd = io.openSync(tempPath, 'wx', 0o644);
    writeAll(io, fd, buffer);
    if (typeof io.fsyncSync !== 'function') throw new Error('fsync unavailable');
    io.fsyncSync(fd);
    io.closeSync(fd);
    fd = null;
    // Same-directory rename is the atomic commit point. If it fails, OUT is
    // intentionally untouched and the finally block removes only our temp.
    io.renameSync(tempPath, outPath);
    renamed = true;
  } finally {
    if (fd !== null) {
      try { io.closeSync(fd); } catch (_) {}
    }
    if (!renamed) {
      try { io.unlinkSync(tempPath); } catch (_) {}
    }
  }
}

function writeBuild(options = {}) {
  const io = options.io || fs;
  const outPath = options.outPath || OUT;
  const outputText = readBuildOutput(options);
  const output = Buffer.from(outputText, 'utf8');
  const expected = inspectGenerated(outputText);
  const existing = readExisting(io, outPath);
  if (existing !== null && Buffer.compare(output, existing) === 0) {
    return Object.freeze({ changed: false, outPath, summary: expected, actual: describeBuffer(existing) });
  }
  writeAtomic(io, outPath, output);
  return Object.freeze({ changed: true, outPath, summary: expected, actual: expected });
}

function parseMode(argv) {
  const args = Array.isArray(argv) ? argv : [];
  let mode = null;
  for (const arg of args) {
    if (arg !== '--check' && arg !== '--write') throw new Error('Unknown argument: ' + arg);
    const candidate = arg.slice(2);
    if (mode && mode !== candidate) throw new Error('Conflicting build modes: --' + mode + ' and --' + candidate);
    mode = candidate;
  }
  return mode || 'write';
}

function createBuildSeam(options = {}) {
  return Object.freeze({
    buildOutput: () => readBuildOutput(options),
    check: () => compareBuild(options),
    write: () => writeBuild(options),
  });
}

function printSummary(label, result) {
  const summary = result.summary || result.expected;
  const status = label === 'check'
    ? (result.ok ? 'PASS' : 'FAIL')
    : (result.changed ? 'WROTE' : 'UNCHANGED');
  const location = result.outPath || OUT;
  console.log(`${status} build:${label} ${location} chars=${summary.chars} utf8Bytes=${summary.utf8Bytes} sha256=${summary.sha256}`);
  if (label === 'check' && !result.ok) {
    const actual = result.actual ? ` actualSha256=${result.actual.sha256}` : ' actual=missing';
    console.error(`Build drift at byte ${result.firstByte}${actual}`);
  }
}

function runCli(argv = process.argv.slice(2), options = {}) {
  let mode;
  try {
    mode = parseMode(argv);
    const seam = createBuildSeam(options);
    const result = mode === 'check' ? seam.check() : seam.write();
    printSummary(mode, result);
    if (mode === 'check' && !result.ok) return 1;
    return 0;
  } catch (error) {
    console.error('ERROR build: ' + String(error && error.message || error));
    return 1;
  }
}

// Keep a deliberately small CommonJS seam for deterministic local tests.
// Running the file directly remains the only path that performs I/O writes.
if (require.main === module) {
  process.exitCode = runCli();
} else {
  module.exports = Object.freeze({
    MODULES,
    createBuildSeam,
    describeText,
    parseMode,
    runCli,
  });
}
