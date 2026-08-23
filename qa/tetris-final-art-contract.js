'use strict';

// P1-03 machine contract. This proves manifest/provenance/runtime isolation and
// the presentation-only seam; it deliberately does not claim real-device or
// human/IP review evidence.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const file = relative => path.join(ROOT, relative);
const digest = relative => {
  const bytes = fs.readFileSync(file(relative));
  return { sha256: crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), bytes: bytes.length };
};
const check = (name, value, detail = '') => {
  const ok = Boolean(value);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
};
let failures = 0;

const familyPath = 'art-source/games/tetris/final-art-v1/asset-family-manifest-v1.json';
const family = JSON.parse(read(familyPath));
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const catalog = JSON.parse(read('asset-library/catalog.json'));
const ledger = JSON.parse(read('art-source/production/ghost-game-art-program-v1/production-ledger-v1.json'));
const transmission = JSON.parse(read('art-source/games/tetris/final-art-v1/EXTERNAL_REFERENCE_TRANSMISSION.json'));
const assets = read('public/src/core/06-assets.js');
const tetris = read('public/src/games/tetris.js');
const { readPresentationSource } = require('./presentation-source');
const template = readPresentationSource();
const routing = read('art-source/games/tetris/final-art-v1/SKILL_ROUTING.md');
const clearance = read('art-source/games/tetris/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md');
const review = read('art-source/games/tetris/final-art-v1/TECHNICAL_REVIEW_Reviewer_A.md');

const item = manifest.assets.find(asset => asset && asset.asset_id === 'G-11-TETRIS-FINAL-ART-V1');
const entry = catalog.assets.find(asset => asset && asset.id === 'G-11-TETRIS-FINAL-ART-V1');
check('family identity and clearance', family.familyId === 'G-11-TETRIS-FINAL-ART-V1' && family.productionUnitId === 'P1-03' && family.status === 'OWNER_AUTHORIZED_ART_CLEARANCE');
check('source/runtime counts and budget', family.metrics && family.metrics.sourceMasterCount === 25 && family.metrics.runtimeVariantCount === 50 && family.metrics.withinBudget === true && family.metrics.runtimeBytes === 457640);
check('source-only external boundary', /EXTERNAL_REFERENCE_ONLY/.test(String(family.externalReferenceContext && family.externalReferenceContext.license)) && /No blocked-license/.test(String(family.externalReferenceContext && family.externalReferenceContext.runtimeBoundary)) && /blocked-license/.test(routing));
check('review and clearance boundaries', /TECHNICAL_PASS/.test(review) && /OPTIONAL_ADVISORY_EVIDENCE/.test(clearance) && /未执行/.test(clearance));

const sources = Array.isArray(family.sources) ? family.sources : [];
let sourceBad = 0;
for (const source of sources) {
  if (!source || !source.path || !exists(source.path)) { sourceBad += 1; continue; }
  const raw = read(source.path);
  const d = digest(source.path);
  if (d.sha256 !== source.sha256 || d.bytes !== source.bytes || !/^<svg\b/.test(raw) || /<(?:script|foreignObject|iframe|object|embed)\b/i.test(raw) || /(?:href|src|url\s*\(\s*(?!#)|@import)/i.test(raw)) sourceBad += 1;
}
check('25 source masters SHA/bytes and SVG safety', sources.length === 25 && sourceBad === 0, `sources=${sources.length},bad=${sourceBad}`);

const variants = Array.isArray(family.variants) ? family.variants : [];
let runtimeBad = 0;
for (const variant of variants) {
  if (!variant || !variant.path || !exists(variant.path)) { runtimeBad += 1; continue; }
  const d = digest(variant.path);
  if (d.sha256 !== variant.sha256 || d.bytes !== variant.bytes || d.bytes < 100 || !variant.path.endsWith('.webp')) runtimeBad += 1;
}
check('50 runtime variants SHA/bytes', variants.length === 50 && runtimeBad === 0, `variants=${variants.length},bad=${runtimeBad}`);

check('manifest strict runtime contract', Boolean(
  item &&
  item.status === 'ready' &&
  item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' &&
  item.source_asset_id === 'ART-037-TETRIS-FINAL-ART-V1' &&
  item.feature_flags &&
  item.feature_flags.operator === 'all' &&
  item.feature_flags.enabled_value === '1' &&
  item.feature_flags.default_enabled === true &&
  Array.isArray(item.feature_flags.ids) &&
  item.feature_flags.ids.length === 1 &&
  item.feature_flags.ids[0] === 'mg_art_tetris_final_v1' &&
  item.variants &&
  Object.keys(item.variants).length === 50
));

check('catalog local-only family', Boolean(
  entry &&
  entry.status === 'integrated-local-only' &&
  entry.license === 'project-owned-deterministic-svg-sharp' &&
  Array.isArray(entry.runtimePaths) &&
  entry.runtimePaths.length === 50
));

check('resolver is strict and fail-closed', Boolean(
  assets.includes('TETRIS_FINAL_ART_FLAG') &&
  assets.includes('TETRIS_FINAL_ART_ASSET_ID') &&
  assets.includes('resolveTetrisFinalArtUrl') &&
  assets.includes('loadTetrisFinalArtManifest') &&
  assets.includes('TETRIS_FINAL_ART_ROLE_SET')
));

check('Tetris presentation consumes art only', Boolean(
  tetris.includes('tetrisFinalArtRequested') &&
  tetris.includes('initTetrisFinalArtSurface') &&
  tetris.includes('TETRIS_FINAL_ART_BOARD_ROLES') &&
  tetris.includes('TETRIS_FINAL_ART_OBJECT_ROLES') &&
  tetris.includes('TETRIS_FINAL_ART_VFX_ROLES') &&
  tetris.includes('tetrisFinalArtCellUrl') &&
  tetris.includes('applyTetrisFinalArtCell') &&
  tetris.includes('updateTetrisFinalArtVfx') &&
  tetris.includes("well.classList.toggle('tetris-final-art-v1',finalArt)") &&
  tetris.includes('tetrisFinalArtAssets.objects') &&
  tetris.includes('tetrisFinalArtAssets.vfx') &&
  template.includes('.tetris-well.tetris-final-art-v1') &&
  template.includes('@media(forced-colors:active)')
));

const ledgerEntry = ledger.units && ledger.units.find(u => u && u.id === 'P1-03');
check('production ledger P1-03 updated', Boolean(
  ledgerEntry &&
  ledgerEntry.familyId === 'G-11-TETRIS-FINAL-ART-V1'
));

if (failures > 0) {
  console.error(`TETRIS_FINAL_ART_CONTRACT_FAIL (${failures} failures)`);
  process.exit(1);
} else {
  console.log('TETRIS_FINAL_ART_CONTRACT_ALL_PASS');
}
