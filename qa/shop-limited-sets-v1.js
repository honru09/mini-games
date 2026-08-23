'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const FAMILY = 'P-SHOP-LIMITED-SETS-V1';
const SOURCE = 'ART-SHOP-LIMITED-SETS-V1';
const FLAG = 'mg_art_shop_limited_sets_v1';
const ROLES = ['desktop','mobile','poster'];
const familyRoot = path.join(ROOT, 'art-source/platform/shop/limited-sets-v1');
const runtimeRoot = path.join(ROOT, 'public/assets/platform/shop/limited-sets-v1');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();

const family = JSON.parse(fs.readFileSync(path.join(familyRoot, 'asset-family-manifest-v1.json'), 'utf8'));
assert.strictEqual(family.familyId, FAMILY);
assert.strictEqual(family.sourceAssetId, SOURCE);
assert.strictEqual(family.featureFlag.id, FLAG);
assert.strictEqual(family.clearance, 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.strictEqual(family.runtimeFiles.length, 3);
assert(family.runtimeBytes > 0 && family.runtimeBytes <= family.runtimeByteBudget);
const sourcePath = path.join(ROOT, family.source.path);
assert.strictEqual(family.source.sha256, digest(sourcePath));

for (const item of family.runtimeFiles) assert.strictEqual(item.sha256, digest(path.join(ROOT, item.path)));

const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8'));
const entry = manifest.assets.find(item => item.asset_id === FAMILY);
assert(entry && entry.source_asset_id === SOURCE && entry.status === 'ready');
assert.strictEqual(entry.clearance, 'OWNER_AUTHORIZED_ART_CLEARANCE');
assert.deepStrictEqual(entry.feature_flags.ids, [FLAG]);
assert.strictEqual(entry.feature_flags.default_enabled, true);
assert.deepStrictEqual(Object.keys(entry.variants), ROLES);
assert.strictEqual(entry.variants.desktop, 'public/assets/platform/shop/limited-sets-v1/seasonal-vault-hero-desktop-v1.webp');
assert.strictEqual(entry.variants.mobile, 'public/assets/platform/shop/limited-sets-v1/seasonal-vault-hero-mobile-v1.webp');
assert.strictEqual(entry.variants.poster, 'public/assets/platform/shop/limited-sets-v1/seasonal-vault-hero-poster-v1.webp');

const ext = JSON.parse(fs.readFileSync(path.join(familyRoot, 'EXTERNAL_REFERENCE_TRANSMISSION.json'), 'utf8'));
assert.strictEqual(ext.inventoryContext.fileCount, 836);
assert.strictEqual(ext.inventoryContext.layeredOrVectorRecords, 3819);
assert.strictEqual(ext.taskRelevantInputs.length, 4);
assert.strictEqual(ext.externalPixelsOrLayersTransmitted, 0);
assert.strictEqual(ext.runtimeExternalInputs, 0);

const assets = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
const shop = fs.readFileSync(path.join(ROOT, 'public/src/shop/06-shop.js'), 'utf8');
const { readPresentationSource } = require('./presentation-source');
const css = readPresentationSource();
assert(assets.includes('SHOP_LIMITED_SETS_FLAG') && assets.includes('resolveShopLimitedSetArtUrl'));
assert(shop.includes('SHOP_LIMITED_SET_DEFS') && shop.includes('renderLimitedSets') && shop.includes('renderLimitedSetPreview'));
assert(shop.includes("['avatars','frames','effects','backgrounds']"));
assert(!shop.includes('requestLimitedSetPurchase') && !shop.includes('limitedSetPrice'));
assert(css.includes('.shop-limited-showcase') && css.includes('.shop-limited-card'));
assert(!/shop-limited-card[^}]*filter:/s.test(css), 'limited cards must not use blur-producing filter effects');

for (const locale of ['zh-CN','en-US','uk-UA']) {
  const dict = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/locales', `${locale}.json`), 'utf8'));
  for (const key of ['shop_limited_title','shop_limited_disclaimer','shop_limited_browse','shop_limited_set_spring','shop_limited_set_summer','shop_limited_set_autumn','shop_limited_set_winter']) assert(dict[key], `${locale} missing ${key}`);
}

const server = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
assert(!server.includes('P-SHOP-LIMITED-SETS-V1') && !server.includes('mg_art_shop_limited_sets_v1'), 'presentation family must not alter server authority');
console.log('SHOP_LIMITED_SETS_V1_ALL_PASS');
