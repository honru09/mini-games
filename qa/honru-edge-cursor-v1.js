'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
const { readPresentationSource } = require('./presentation-source');

const ROOT = path.resolve(__dirname, '..');
const FAMILY = 'P-HONRU-EDGE-CURSOR-V1';
const SOURCE = 'ART-HONRU-EDGE-CURSOR-V1';
const FLAG = 'mg_art_honru_edge_cursor_v1';
const SOURCE_ROOT = path.join(ROOT, 'art-source/platform/honru-edge-cursor/visual-v1');
const SOURCE_DIR = path.join(SOURCE_ROOT, 'runtime-source');
const RUNTIME_DIR = path.join(ROOT, 'public/assets/platform/honru-edge-cursor/visual-v1');
const EDGE = ['edge-games-peek', 'edge-playline-wave', 'edge-profile-grab'];
const CURSOR = ['cursor-idle', 'cursor-pressed', 'cursor-scroll-up', 'cursor-scroll-down', 'cursor-scroll-left', 'cursor-scroll-right'];

function pass(value) { console.log('PASS ' + value); }
function digest(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase(); }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }

const routing = fs.readFileSync(path.join(SOURCE_ROOT, 'SKILL_ROUTING.md'), 'utf8');
for (const name of ['imagegen','ai-image-generation','gpt-image','image','happy-image-gen','html-to-image','website-screenshot','code-to-image','og-image']) assert(routing.includes('`' + name + '`'));
assert(routing.includes('`image` | `APPLIED`')); pass('nine installed skill routes are explicit');

const transmission = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, 'EXTERNAL_REFERENCE_TRANSMISSION.json'), 'utf8'));
assert.deepStrictEqual(transmission.externalReferences, []); assert.strictEqual(transmission.policy.blockedLicensePixelsTransmitted, false); pass('external lane is empty');

const family = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, 'asset-family-manifest-v1.json'), 'utf8'));
assert.strictEqual(family.familyId, FAMILY); assert.strictEqual(family.sourceId, SOURCE); assert.strictEqual(family.sourceMastersCount, 15); assert.strictEqual(family.runtimeVariantsCount, 18); assert(family.totalRuntimeBytes < family.byteBudget); pass('15 masters, 18 variants and budget');

const sourceFiles = fs.readdirSync(SOURCE_DIR).filter(file => file.endsWith('.svg')).sort();
assert.strictEqual(sourceFiles.length, 15);
for (const file of sourceFiles) { const text = fs.readFileSync(path.join(SOURCE_DIR, file), 'utf8'); assert(text.includes('<svg') && !text.includes('<script') && !text.includes('href="http') && !text.includes('href="https')); const row = family.sourceMasters.find(item => item.path.endsWith(file)); assert(row && row.sha256 === digest(path.join(SOURCE_DIR, file))); }
pass('safe SVG source SHA');

const runtimeFiles = fs.readdirSync(RUNTIME_DIR).filter(file => /\.(webp|png)$/.test(file));
assert.strictEqual(runtimeFiles.length, 18);
for (const file of runtimeFiles) { const row = family.runtimeVariants.find(item => item.path.endsWith(file)); assert(row && row.sha256 === digest(path.join(RUNTIME_DIR, file))); }
pass('runtime SHA and PNG/WebP variants');

const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const item = manifest.assets.find(asset => asset && asset.asset_id === FAMILY);
assert(item && item.runtime_id === 'honru' && item.status === 'ready' && item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && item.source_asset_id === SOURCE && item.clearance_record.endsWith('OWNER_AUTHORIZED_ART_CLEARANCE.md'));
assert(item.feature_flags && item.feature_flags.default_enabled === true && JSON.stringify(item.feature_flags.ids) === JSON.stringify([FLAG]));
for (const role of EDGE) { assert(item.variants[role]); assert(item.variants[role + '-static']); }
for (const state of CURSOR) { assert(item.variants[state + '-32']); assert(item.variants[state + '-64']); }
assert.deepStrictEqual(item.cursor_hotspot.idle, [4, 2]); pass('Manifest allowlist, fallback and hotspot');

const assets = read('public/src/core/06-assets.js');
assert(assets.includes('HONRU_EDGE_CURSOR_FLAG') && assets.includes('resolveHonruEdgeCursorUrl') && assets.includes('honruEdgeCursorEnabled')); pass('asset resolver and strict feature gate');
const motion = read('public/src/core/26-ghost-mascot-motion.js');
for (const token of ['edge-games-peek','edge-playline-wave','edge-profile-grab','cursor-scroll-up','setCursorEnabled','honru-gaze-layer','pointermove','prefers-reduced-motion']) assert(motion.includes(token));
assert(!motion.includes('mousemove')); pass('route edge mount, native cursor states and code gaze');
const template = readPresentationSource();
for (const token of ['honru-edge-guide','honru-gaze-dot','honru-cursor-active','honru-cursor-pressed','@media(prefers-reduced-motion:reduce)']) assert(template.includes(token));
assert(template.includes('input,textarea,select,[contenteditable="true"]')); pass('CSS has non-blurring pointer, input and reduced-motion fallbacks');
const shell = read('public/src/core/02-app-shell.js'); assert(shell.includes('honru_cursor_settings') && shell.includes('GhostMascot25D.setCursorEnabled')); pass('Settings opt-out is wired');
for (const locale of ['zh-CN','en-US','uk-UA']) { const json = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/locales', locale + '.json'), 'utf8')); for (const key of ['honru_cursor_settings','honru_cursor_enabled','honru_cursor_note']) assert(json[key]); }
pass('three-language cursor copy');

assert(fs.existsSync(path.join(SOURCE_ROOT, 'review/honru-edge-cursor-contact-sheet-v1.png'))); pass('machine contact sheet exists');
console.log('HONRU_EDGE_CURSOR_V1_ALL_PASS');
