'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const FAMILY = 'P-HONRU-SEASONAL-V1';
const FLAG = 'mg_art_honru_seasonal_v1';
const SOURCE_ROOT = path.join(ROOT, 'art-source/brand/ghost-game/honru/seasonal-v1');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/brand/honru/seasonal-v1');
const EDITIONS = ['spring-bloom', 'summer-cloud', 'autumn-leaf', 'winter-star'];
const ROLES = ['hero-320', 'reaction-160', 'mini-96', 'celebration-320'];

function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase(); }
function pass(label) { console.log('PASS ' + label); }
function webpSize(file) {
  const b = fs.readFileSync(file);
  assert(b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP');
  let o = 12, width = 0, height = 0;
  while (o + 8 <= b.length) {
    const type = b.toString('ascii', o, o + 4), size = b.readUInt32LE(o + 4), d = o + 8;
    if (type === 'VP8X' && size >= 10) { width = 1 + b[d + 4] + (b[d + 5] << 8) + (b[d + 6] << 16); height = 1 + b[d + 7] + (b[d + 8] << 8) + (b[d + 9] << 16); }
    if (type === 'VP8 ' && size >= 10 && b[d + 3] === 0x9d && b[d + 4] === 0x01 && b[d + 5] === 0x2a) { width = b.readUInt16LE(d + 6) & 0x3fff; height = b.readUInt16LE(d + 8) & 0x3fff; }
    o = d + size + (size % 2);
  }
  return { width, height, bytes: b.length };
}

const family = JSON.parse(read('art-source/brand/ghost-game/honru/seasonal-v1/asset-family-manifest-v1.json'));
assert.strictEqual(family.productionUnitId, 'P2-02');
assert.strictEqual(family.familyId, FAMILY);
assert.strictEqual(family.status, 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.strictEqual(family.activeEdition, 'summer-cloud');
assert.deepStrictEqual(family.featureFlags.ids, [FLAG]);
assert.strictEqual(family.sourceMasters.length, 4);
assert.strictEqual(family.runtimeVariants.length, 16);
assert(family.metrics.runtimeBytes <= family.metrics.runtimeByteBudget);
pass('family identity, active edition, count and budget');

for (const source of family.sourceMasters) {
  const file = path.join(ROOT, source.path);
  assert(fs.existsSync(file) && hash(file) === source.sha256 && source.width === 1254 && source.height === 1254 && source.alpha === true);
}
pass('four transparent source masters are hash-pinned');
for (const variant of family.runtimeVariants) {
  const file = path.join(ROOT, variant.path), info = webpSize(file);
  const expected = variant.role === 'mini-96' ? 96 : variant.role === 'reaction-160' ? 160 : 320;
  assert(fs.existsSync(file) && hash(file) === variant.sha256 && info.width === expected && info.height === expected && info.bytes === variant.bytes);
}
pass('sixteen WebP derivatives decode with exact dimensions and hashes');

const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const item = manifest.assets.find(asset => asset && asset.asset_id === FAMILY);
assert(item && item.runtime_id === 'honru' && item.status === 'ready' && item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.strictEqual(item.source_asset_id, 'ART-HONRU-SEASONAL-V1');
assert.deepStrictEqual(item.feature_flags.ids, [FLAG]);
assert.strictEqual(item.active_edition, 'summer-cloud');
assert.strictEqual(Object.keys(item.variants).length, 16);
for (const edition of EDITIONS) for (const role of ROLES) assert(item.variants[edition + '-' + role].endsWith(edition + '-' + role + '-v1.webp'));
pass('Manifest has strict owner-cleared allowlist and 16 variants');

const assets = read('public/src/core/06-assets.js');
assert(assets.includes("const HONRU_SEASONAL_FLAG = '" + FLAG + "'"));
assert(assets.includes('function honruSeasonalEnabled') && assets.includes('async function resolveHonruSeasonalUrl'));
assert(assets.includes("const HONRU_SEASONAL_ACTIVE_EDITION = 'summer-cloud'"));
const shell = read('public/src/core/02-app-shell.js');
assert(shell.includes("resolveHonruSeasonalUrl('hero-320')") && shell.includes("resolveHonruSeasonalUrl(seasonalRole)"));
assert(shell.includes("contextId === 'ready'") && shell.includes("contextId === 'celebration'"));
pass('runtime consumes seasonal art only for idle/ready/celebration with base fallback');

const routing = read('art-source/brand/ghost-game/honru/seasonal-v1/SKILL_ROUTING.md');
for (const name of ['imagegen', 'ai-image-generation', 'gpt-image', 'image', 'happy-image-gen', 'html-to-image', 'website-screenshot', 'code-to-image', 'og-image']) assert(routing.includes('`' + name + '`'));
const external = JSON.parse(read('art-source/brand/ghost-game/honru/seasonal-v1/EXTERNAL_REFERENCE_TRANSMISSION.json'));
assert.strictEqual(external.externalRestrictedInputCount, 0);
assert.strictEqual(external.transmissions.length, 0);
assert.strictEqual(external.runtimeExternalAssetCount, 0);
pass('nine skill routes recorded and external blocked-license lane remains empty');

const contract = read('art-source/brand/ghost-game/honru/seasonal-v1/CONTRACT.md');
for (const forbidden of ['Battle Pass', 'Remote Config', 'Direct Chat', 'Rule', 'Three/GLB']) assert(contract.includes(forbidden));
pass('contract preserves presentation-only and 2.5D boundaries');
console.log('HONRU_SEASONAL_V1_ALL_PASS ' + JSON.stringify({ sourceMasters: 4, runtimeVariants: 16, runtimeBytes: family.metrics.runtimeBytes }));
