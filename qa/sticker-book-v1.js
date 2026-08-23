'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const FAMILY = 'P-COLLECTIBLE-STICKER-BOOK-V1';
const FLAG = 'mg_art_sticker_book_v1';
const SOURCE_FAMILY = 'P-HONRU-CONTEXT-REACTIONS-V1';
const IDS = ['ready','your-turn','thinking','throw','hit','capture','score','combo','warning','reconnect','spectator','win','lose','draw','rematch','celebration'];

function read(relative) { return fs.readFileSync(path.join(ROOT, relative), 'utf8'); }
function json(relative) { return JSON.parse(read(relative)); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase(); }
function pass(label) { console.log('PASS ' + label); }
function webpInfo(file) {
  const bytes = fs.readFileSync(file);
  assert(bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP');
  let offset = 12, width = 0, height = 0;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && size >= 10) {
      width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
      height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
    }
    if (type === 'VP8 ' && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      width = bytes.readUInt16LE(data + 6) & 0x3fff;
      height = bytes.readUInt16LE(data + 8) & 0x3fff;
    }
    offset = data + size + (size % 2);
  }
  return { width, height, bytes: bytes.length };
}

const family = json('art-source/platform/sticker-book-v1/asset-family-manifest-v1.json');
assert.strictEqual(family.productionUnitId, 'P2-03');
assert.strictEqual(family.familyId, FAMILY);
assert.strictEqual(family.status, 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.strictEqual(family.sourceFamily, SOURCE_FAMILY);
assert.deepStrictEqual(family.featureFlags.ids, [FLAG]);
assert.strictEqual(family.featureFlags.defaultEnabled, true);
assert.strictEqual(family.runtimeVariants.length, IDS.length);
assert.strictEqual(family.metrics.runtimeBytes <= family.metrics.runtimeByteBudget, true);
assert(family.authority.includes('no owned') && family.authority.includes('Supabase capability'));
assert.deepStrictEqual(family.runtimeVariants.map(item => item.id), IDS);
pass('family identity, inherited source, count, budget and presentation-only boundary');

const manifest = json('public/assets/manifests/asset_manifest.json');
const item = manifest.assets.find(asset => asset && asset.asset_id === FAMILY);
assert(item && item.runtime_id === 'honru' && item.status === 'ready');
assert.strictEqual(item.clearance, 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.strictEqual(item.source_asset_id, 'ART-HONRU-STICKER-BOOK-V1');
assert.deepStrictEqual(item.feature_flags.ids, [FLAG]);
assert.strictEqual(item.feature_flags.default_enabled, true);
assert.deepStrictEqual(Object.keys(item.variants), IDS);
const expectedPrefix = 'public/assets/brand/honru/context-reactions-v1/contexts/honru-context-';
for (const id of IDS) {
  const expected = expectedPrefix + id + '-v1.webp';
  assert.strictEqual(item.variants[id], expected);
  assert.strictEqual(item.variants[id], family.runtimeVariants.find(row => row.id === id).path);
  const file = path.join(ROOT, expected);
  const info = webpInfo(file);
  assert(fs.existsSync(file) && info.width === 320 && info.height === 320);
}
assert.strictEqual(item.actual_bytes, family.metrics.runtimeBytes);
pass('Manifest has exact 16-cell allowlist, inherited runtime paths and decodable 320px cells');

const catalog = json('asset-library/catalog.json');
const catalogItem = catalog.assets.find(asset => asset && asset.id === FAMILY);
assert(catalogItem && catalogItem.status === 'integrated-local-only');
assert.strictEqual(catalogItem.remoteObjectKey, null);
assert.strictEqual(catalogItem.runtimePaths.length, IDS.length);
assert.deepStrictEqual(catalogItem.runtimePaths, IDS.map(id => item.variants[id]));
assert(catalogItem.sourcePath.includes(SOURCE_FAMILY.toLowerCase().replaceAll('-', '/')) || catalogItem.sourcePath.includes('context-reactions-v1'));
assert.strictEqual(catalogItem.previewPath, 'art-source/platform/sticker-book-v1/review/sticker-book-contact-sheet-v1.png');
assert(fs.existsSync(path.join(ROOT, catalogItem.previewPath)));
pass('Asset Library keeps inherited runtime, local review contact sheet and no remote object');

const assets = read('public/src/core/06-assets.js');
const shell = read('public/src/core/02-app-shell.js');
assert(assets.includes("const HONRU_STICKER_BOOK_FLAG = '" + FLAG + "'"));
assert(assets.includes('function honruStickerBookEnabled') && assets.includes('async function resolveHonruStickerBookUrl'));
assert(shell.includes('renderHonruStickerBookSection') && shell.includes('resolveHonruStickerBookUrl(token)'));
assert(shell.includes('sticker_book_fallback'));
const stickerSection = shell.slice(shell.indexOf('function renderHonruStickerBookSection'), shell.indexOf('function renderGhostProfile'));
assert(stickerSection && !/server\/|online\.send|fetch\([^)]*sticker/i.test(stickerSection));
pass('Profile Library consumes the flag-gated resolver with localized fallback and no server mutation');

const contract = read('art-source/platform/sticker-book-v1/CONTRACT.md');
for (const forbidden of ['owned', '购买', 'Battle Pass', 'Direct Chat', 'Match Chat', 'Supabase', 'Three/GLB']) assert(contract.includes(forbidden));
const routing = read('art-source/platform/sticker-book-v1/SKILL_ROUTING.md');
for (const skill of ['imagegen','ai-image-generation','gpt-image','image','happy-image-gen','html-to-image','website-screenshot','code-to-image','og-image']) assert(routing.includes('`' + skill + '`'));
const external = json('art-source/platform/sticker-book-v1/EXTERNAL_REFERENCE_TRANSMISSION.json');
assert.strictEqual(external.externalRestrictedInputCount, 0);
assert.strictEqual(external.transmissions.length, 0);
assert.strictEqual(external.runtimeExternalAssetCount, 0);
pass('contract, nine skill routes and external restricted lane are explicit');

const locales = ['zh-CN','en-US','uk-UA'].map(code => json('public/locales/' + code + '.json'));
for (const id of IDS) assert(locales.every(locale => typeof locale['sticker_book_' + id] === 'string' && locale['sticker_book_' + id].trim()));
assert(locales.every(locale => typeof locale.sticker_book_title === 'string' && typeof locale.sticker_book_subtitle === 'string'));
pass('all 16 sticker labels and section chrome are localized in three locales');

for (const forbidden of ['P-COLLECTIBLE-STICKER-BOOK-V1','mg_art_sticker_book_v1']) {
  for (const file of ['server/index.js','shared/progression/collection-rarity-catalog.js','public/src/online/03-websocket.js']) assert(!read(file).includes(forbidden));
}
pass('sticker book remains outside server, protocol, reward, chat and persistence authority');
console.log('STICKER_BOOK_V1_ALL_PASS ' + JSON.stringify({ family: FAMILY, cells: IDS.length, runtimeBytes: family.metrics.runtimeBytes }));
