'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source/platform/shop/complete-art-v1');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/platform/shop/complete-art-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');

const FAMILY_ID = 'P-SHOP-COMPLETE-ART-V1';
const SOURCE_ID = 'ART-041-SHOP-COMPLETE-ART-V1';
const FLAG = 'mg_art_shop_complete_v1';

function digest(abs){
  const buf = fs.readFileSync(abs);
  return {
    sha256: crypto.createHash('sha256').update(buf).digest('hex').toUpperCase(),
    bytes: buf.length
  };
}

// 1. Family Identity & Clearance
const clearanceDoc = fs.readFileSync(path.join(SOURCE_ROOT, 'OWNER_AUTHORIZED_ART_CLEARANCE.md'), 'utf8');
assert(clearanceDoc.includes(FAMILY_ID), 'clearance doc must contain FAMILY_ID');
assert(clearanceDoc.includes('CLEARED_FOR_PRODUCTION'), 'clearance doc must confirm CLEARED_FOR_PRODUCTION');
console.log('PASS family identity and clearance');

// 2. Source/Runtime Counts & Budget (< 3 MiB)
const familyManifest = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, 'asset-family-manifest-v1.json'), 'utf8'));
assert.strictEqual(familyManifest.familyId, FAMILY_ID);
assert.strictEqual(familyManifest.sourceMastersCount, 24);
assert.strictEqual(familyManifest.runtimeVariantsCount, 48);
assert(familyManifest.totalRuntimeBytes < 3 * 1024 * 1024, 'runtime bytes must be < 3 MiB');
console.log('PASS source/runtime counts and budget');

// 3. Source-Only External Boundary
const extRef = JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, 'EXTERNAL_REFERENCE_TRANSMISSION.json'), 'utf8'));
assert.strictEqual(extRef.policy.zeroExternalThirdPartyArt, true);
console.log('PASS source-only external boundary');

// 4. Review and Clearance Boundaries
assert(fs.existsSync(path.join(SOURCE_ROOT, 'SKILL_ROUTING.md')));
assert(fs.existsSync(path.join(SOURCE_ROOT, 'PROMPT_AND_PROVENANCE.md')));
assert(fs.existsSync(path.join(SOURCE_ROOT, 'TECHNICAL_REVIEW_Reviewer_A.md')));
assert(fs.existsSync(path.join(SOURCE_ROOT, 'review/shop-complete-contact-sheet-v1.png')));
console.log('PASS review and clearance boundaries');

// 5. 24 Source Masters SHA/Bytes & SVG Safety
const sourceDir = path.join(SOURCE_ROOT, 'runtime-source');
const sourceFiles = fs.readdirSync(sourceDir).filter(f => f.endsWith('.svg'));
assert.strictEqual(sourceFiles.length, 24);
for (const f of sourceFiles){
  const content = fs.readFileSync(path.join(sourceDir, f), 'utf8');
  assert(content.includes('<svg'), `svg tag required in ${f}`);
  assert(!content.includes('<script'), `no script in ${f}`);
  const d = digest(path.join(sourceDir, f));
  const record = familyManifest.sourceMasters.find(m => m.path.endsWith(f));
  assert(record, `missing manifest record for ${f}`);
  assert.strictEqual(record.sha256, d.sha256);
}
console.log('PASS 24 source masters SHA/bytes and SVG safety');

// 6. 48 Runtime Variants SHA/Bytes
const runtimeFiles = fs.readdirSync(RUNTIME_ROOT).filter(f => f.endsWith('.webp'));
assert.strictEqual(runtimeFiles.length, 48);
for (const f of runtimeFiles){
  const d = digest(path.join(RUNTIME_ROOT, f));
  const record = familyManifest.runtimeVariants.find(v => v.path.endsWith(f));
  assert(record, `missing runtime variant record for ${f}`);
  assert.strictEqual(record.sha256, d.sha256);
}
console.log('PASS 48 runtime variants SHA/bytes');

// 7. Global Asset Manifest Contract
const globalManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const manifestEntry = globalManifest.assets.find(a => a.asset_id === FAMILY_ID);
assert(manifestEntry, 'global manifest must include FAMILY_ID');
assert.strictEqual(manifestEntry.source_id, SOURCE_ID);
assert.strictEqual(manifestEntry.flag, FLAG);
assert.strictEqual(manifestEntry.variants_count, 48);
console.log('PASS manifest strict runtime contract');

// 8. Catalog Local-Only Family
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const catalogEntry = catalog.assets.find(a => a.id === FAMILY_ID);
assert(catalogEntry, 'catalog must include FAMILY_ID');
assert.strictEqual(catalogEntry.remoteObjectKey, null);
console.log('PASS catalog local-only family');

// 9. Core Asset Resolver Integration
const coreAssets = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
assert(coreAssets.includes('SHOP_COMPLETE_ART_FLAG'), 'core assets must declare SHOP_COMPLETE_ART_FLAG');
assert(coreAssets.includes('resolveShopCompleteArtUrl'), 'core assets must declare resolveShopCompleteArtUrl');
assert(coreAssets.includes('shopCompleteArtEnabled'), 'core assets must declare shopCompleteArtEnabled');
console.log('PASS resolver is strict and fail-closed');

console.log('SHOP_COMPLETE_ART_CONTRACT_ALL_PASS');
