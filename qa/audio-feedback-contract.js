#!/usr/bin/env node
'use strict';

/*
 * Audio mainline contract probe.
 *
 * This is intentionally a contract/acceptance-gap test: existing legacy
 * callsites and missing settings/manifest entries are reported as PENDING,
 * not hidden or mislabelled as implementation.  Only corruption of the
 * already-landed FeedbackBus/LocalFeedbackAdapter seam fails the process.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const busSource = read('public/src/core/15-feedback-bus.js');
const adapterSource = read('public/src/core/17-local-feedback-adapter.js');
const tankSource = read('public/src/games/tank.js');
const utilsSource = read('public/src/core/01-utils.js');
const settingsSource = read('public/src/core/02-app-shell.js');
const runtimeSource = read('public/src/core/22-audio-runtime.js');
const rosterSource = read('public/src/ui/07-roster.js');
const onlineSource = read('public/src/online/03-websocket.js');
const FeedbackBus = require(path.join(ROOT, 'public/src/core/15-feedback-bus.js'));
const LocalFeedbackAdapter = require(path.join(ROOT, 'public/src/core/17-local-feedback-adapter.js'));

let failures = 0;
let assertions = 0;
let pending = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    console.log(`PASS  ${label}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL  ${label} :: ${error && error.message || error}`);
  }
}

function pendingCheck(label, condition, note) {
  assertions += 1;
  if (condition) {
    console.log(`PASS  ${label}`);
  } else {
    pending += 1;
    console.log(`PENDING ${label} :: ${note}`);
  }
}

function cue(type, id, extras) {
  return Object.assign({ type, id }, extras || {});
}

const expectedTypes = [
  'gomoku_place', 'ludo_move', 'monopoly_roll', 'tank_move', 'tank_fire',
  'tank_hit', 'tetris_move', 'tetris_lock', 'tetris_line_clear',
  'xiangqi_move', 'match_terminal'
];
const gameIds = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
const settingsKeys = [
  'mg_audio_sfx', 'mg_audio_music', 'mg_audio_haptics',
  'mg_audio_spatial', 'mg_audio_reduced_effects'
];
const volumeKeys = [
  'mg_audio_master_volume', 'mg_audio_sfx_volume',
  'mg_audio_music_volume', 'mg_audio_haptics_volume'
];

check('mainline classification remains GAME-037/GAME-038', () => {
  const ledger = JSON.parse(read('requirements/PRODUCT_REQUIREMENTS_LEDGER.json'));
  const rows = ledger.requirements.filter(item => item && (item.id === 'GAME-037' || item.id === 'GAME-038'));
  assert.strictEqual(rows.length, 2);
  assert(rows.some(row => row.id === 'GAME-037'));
  assert(rows.some(row => row.id === 'GAME-038'));
  assert(read('requirements/GHOST_GAME_MAINLINE_COMMAND.md').includes('CLOSE'));
  assert(read('requirements/MAINLINE_CONTROL_ROUTING.json').includes('GAME-038'));
});

check('FeedbackBus exports the expected narrow seam and exact cue vocabulary', () => {
  assert.deepStrictEqual(Object.keys(FeedbackBus), ['create']);
  expectedTypes.forEach(type => assert(busSource.includes(`'${type}'`), `missing cue ${type}`));
  assert.strictEqual((busSource.match(/var EVENT_TYPES/g) || []).length, 1);
  assert(busSource.includes('MAX_QUEUE = 16'));
  assert(busSource.includes('MAX_LISTENERS = 8'));
  assert(busSource.includes('MAX_CUE_IDS = 64'));
  assert(busSource.includes('MAX_CUES_PER_WINDOW = 32'));
});

check('FeedbackBus VM rejects private/unknown fields and accepts bounded semantic cues', () => {
  const context = vm.createContext({ globalThis: {}, Object, Array, String, Math, Number, RegExp, Symbol, Date });
  vm.runInContext(busSource, context, { filename: '15-feedback-bus.js' });
  const browserApi = vm.runInContext('globalThis.FeedbackBus', context);
  assert(browserApi && typeof browserApi.create === 'function');
  const bus = browserApi.create({ environment: { enabled: true, audioEnabled: true, hapticsEnabled: true } });
  assert.strictEqual(bus.emit(cue('gomoku_place', 'vm-place-1', { intensity: 0.5 })).accepted, true);
  assert.strictEqual(bus.emit(cue('gomoku_place', 'vm-private-1', { text: 'do-not-store' })).reason, 'sensitive_field');
  assert.strictEqual(bus.emit(cue('not-a-cue', 'vm-unknown-1')).reason, 'unsupported_type');
  assert.strictEqual(bus.emit(cue('tetris_lock', 'vm-pan-1', { pan: 0.4 })).reason, 'invalid_pan');
  assert.strictEqual(bus.setEnvironment({ hidden: true }).accepted, true);
  assert.strictEqual(bus.emit(cue('tank_fire', 'vm-hidden-1')).reason, 'hidden');
  assert.strictEqual(bus.dispose().status, 'disposed');
});

check('FeedbackBus has no transport, persistence, raw input, or browser side effects', () => {
  [
    /\bfetch\b/i, /XMLHttpRequest/, /WebSocket/, /localStorage/, /sessionStorage/,
    /indexedDB/, /addEventListener/, /setInterval/, /setTimeout/, /AudioContext/, /navigator\s*\./,
    /\btext\b\s*:/i, /\bpayload\b\s*:/i
  ].forEach(pattern => assert(!pattern.test(busSource), `forbidden dependency ${pattern}`));
});

check('LocalFeedbackAdapter keeps explicit unlock, bounded voices, fallback and dispose seams', () => {
  assert(adapterSource.includes('MAX_ACTIVE_VOICES = 8'));
  assert(adapterSource.includes('function unlock'));
  assert(adapterSource.includes('function dispose'));
  assert(adapterSource.includes('createStereoPanner'));
  assert(adapterSource.includes('audio_unavailable'));
  assert(adapterSource.includes('safeClose'));
  assert(adapterSource.includes('safeResume'));
  [/\bfetch\b/i, /WebSocket/, /localStorage/, /sessionStorage/, /document\s*\./, /navigator\s*\./, /setTimeout/]
    .forEach(pattern => assert(!pattern.test(adapterSource), `forbidden adapter dependency ${pattern}`));
});

check('LocalFeedbackAdapter VM lifecycle remains fail-silent and terminal', () => {
  const context = vm.createContext({ globalThis: {}, Object, Array, String, Math, Number, RegExp, Date });
  vm.runInContext(adapterSource, context, { filename: '17-local-feedback-adapter.js' });
  const api = vm.runInContext('globalThis.LocalFeedbackAdapter', context);
  assert(api && typeof api.create === 'function');
  const bus = { subscribe() { return () => {}; } };
  const adapter = api.create({ enabled: true, bus, audioContextFactory() { throw new Error('unavailable'); } });
  assert.doesNotThrow(() => adapter.unlock());
  assert.strictEqual(adapter.dispose().disposed, true);
  assert.strictEqual(adapter.unlock().reason, 'disposed');
});

check('Tank accepted-action seam has stable IDs and Authority snapshot receipts', () => {
  assert(tankSource.includes('function emitTankFeedback'));
  assert(tankSource.includes('function onAuthoritySnapshot'));
  assert(tankSource.includes('tank-fire-'));
  assert(tankSource.includes('tank-hit-'));
  assert(/server\.shots>previous(?:Audio)?\.shots/.test(tankSource));
  assert(/server\.hp<previous(?:Audio)?\.hp/.test(tankSource));
});

const gameSources = Object.fromEntries(gameIds.map(id => [id, read(`public/src/games/${id}.js`)]));
const legacyCallsites = gameIds.flatMap(id => {
  const source = gameSources[id];
  const helperStart = source.indexOf('const audioCue =');
  const helperEnd = helperStart < 0 ? -1 : source.indexOf('\n  };', helperStart);
  const matches = [];
  const pattern = /\b(?:sfx|playFeedback|haptic)\s*\(/g;
  let match;
  while ((match = pattern.exec(source))) {
    // The compatibility call inside each module's local audioCue helper is
    // intentional.  Only a primitive call that bypasses that helper is a
    // migration finding.
    if (match.index >= helperStart && match.index <= helperEnd) continue;
    matches.push(`${id}:${match[0].trim()}`);
  }
  return matches;
});
pendingCheck(
  'all six games route feedback only through accepted-action adapter',
  legacyCallsites.length === 0,
  `legacy primitive callsites remain outside the compatibility helper (${legacyCallsites.join(', ')})`
);
pendingCheck(
  'global button listener is removed before unified adapter rollout',
  !/closest\(['"]\.btn['"]\)/.test(utilsSource),
  '01-utils.js still has the legacy global .btn click SFX listener'
);

settingsKeys.forEach(key => {
  pendingCheck(`settings key ${key} is wired`, settingsSource.includes(key), 'settings UI/runtime key is not implemented yet');
});
volumeKeys.forEach(key => {
  pendingCheck(`volume key ${key} is wired`, settingsSource.includes(key), 'settings UI is missing a volume control');
});
pendingCheck(
  'settings page exposes the complete audio preference group',
  settingsKeys.concat(volumeKeys).every(key => settingsSource.includes(key)) && settingsSource.includes("'audio_master_volume'"),
  'settings page is missing one or more audio controls'
);

check('accepted cue IDs preserve the complete FeedbackBus 64-character envelope', () => {
  const helper = utilsSource.match(/function audioCueId\([\s\S]*?\n\}/);
  assert(helper, 'audioCueId helper missing');
  assert(/\{0,63\}/.test(helper[0]), 'audioCueId truncates or replaces IDs accepted by FeedbackBus');
});

check('countdown owns a cancellable generation and cannot emit stale start cues', () => {
  assert(utilsSource.includes('let _activeAudioCountdown = null'));
  assert(utilsSource.includes('function cancelCountdown()'));
  assert(utilsSource.includes('if (_activeAudioCountdown !== active) return'));
  assert(utilsSource.includes('clearInterval(active.interval)'));
  assert(utilsSource.includes('clearTimeout(active.removalTimeout)'));
  assert(utilsSource.includes('cancelCountdown();\n  const area'));
});

check('game, reconnect, spectator/account and auth boundaries reset presentation audio', () => {
  assert(runtimeSource.includes('function reset()'));
  assert(runtimeSource.includes('reset: function () { return getRuntime().reset(); }'));
  assert(utilsSource.includes('function resetPresentationAudio(scope)'));
  assert(rosterSource.includes("resetPresentationAudio('show-hub')"));
  assert(rosterSource.includes("resetPresentationAudio('show-game')"));
  assert(onlineSource.includes("resetPresentationAudio('account-switch')"));
  assert(onlineSource.includes("resetPresentationAudio(preserveResume?'reconnect':'online-reset')"));
  assert(settingsSource.includes("resetPresentationAudio('auth-required')"));
});

check('asset manifest has exactly six known runtime game records', () => {
  const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
  assert(Array.isArray(manifest.games));
  assert.deepStrictEqual(manifest.games.map(item => item.runtime_id), gameIds);
});

const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const missingAudio = manifest.games.filter(item => !item || typeof item.audio !== 'string' || !item.audio.trim()).map(item => item.runtime_id);
pendingCheck(
  'all six manifest game records declare audio fallback/asset metadata',
  missingAudio.length === 0,
  `missing audio metadata: ${missingAudio.join(', ')}`
);

check('legacy fallback primitives remain available while migration is pending', () => {
  assert(/function sfx\s*\(/.test(utilsSource));
  assert(/function haptic\s*\(/.test(utilsSource));
  assert(/function playFeedback\s*\(/.test(utilsSource));
});

check('contract documents settings, accepted-action, lifecycle, variants and rollback boundaries', () => {
  const contract = read('requirements/active/audio-optimization-mainline-p1-20260817/contract.md');
  ['UnifiedFeedbackAdapter', 'accepted-action', 'mg_audio_sfx', '2–4', 'dispose', 'rollback', 'AudioCraft'].forEach(term => assert(contract.includes(term), `missing ${term}`));
});

if (failures) {
  console.error(`AUDIO_FEEDBACK_CONTRACT_FAILURES=${failures}/${assertions} pending=${pending}`);
  process.exitCode = 1;
} else {
  console.log(`AUDIO_FEEDBACK_CONTRACT_ALL_PASS assertions=${assertions} pending=${pending}`);
}
