'use strict';

// P1-01 machine contract. This proves manifest/provenance/runtime isolation and
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
const { readPresentationSource } = require('./presentation-source');
let failures = 0;

const familyPath = 'art-source/games/monopoly/final-art-v1/asset-family-manifest-v1.json';
const family = JSON.parse(read(familyPath));
const sourceExtraction = JSON.parse(read('art-source/games/monopoly/final-art-v1/source-extraction-manifest-v1.json'));
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const catalog = JSON.parse(read('asset-library/catalog.json'));
const ledger = JSON.parse(read('art-source/production/ghost-game-art-program-v1/production-ledger-v1.json'));
const assets = read('public/src/core/06-assets.js');
const monopoly = read('public/src/games/monopoly.js');
const html = readPresentationSource();
const routing = read('art-source/games/monopoly/final-art-v1/SKILL_ROUTING.md');
const clearance = read('art-source/games/monopoly/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md');
const review = read('art-source/games/monopoly/final-art-v1/TECHNICAL_REVIEW_Reviewer_A.md');

const item = manifest.assets.find(asset => asset && asset.asset_id === 'G-15-MONOPOLY-FINAL-ART-V1');
const entry = catalog.assets.find(asset => asset && asset.id === 'G-15-MONOPOLY-FINAL-ART-V1');
check('family identity and clearance', family.familyId === 'G-15-MONOPOLY-FINAL-ART-V1' && family.productionUnitId === 'P1-01' && family.status === 'OWNER_AUTHORIZED_ART_CLEARANCE' && family.runtimeIntegration === undefined);
check('source/runtime counts and budget', family.metrics && family.metrics.sourceMasterCount === 23 && family.metrics.runtimeVariantCount === 46 && family.metrics.withinBudget === true && family.metrics.runtimeBytes === 429072);
check('AI source extraction keeps strict Alpha and color evidence', family.sourceExtractionManifest === 'art-source/games/monopoly/final-art-v1/source-extraction-manifest-v1.json' && sourceExtraction.objectAtoms.length === 6 && sourceExtraction.objectAtoms.every(atom => atom.transparent > 0 && atom.opaque > 0 && atom.edgeVisible === 0 && atom.magentaRisk === 0) && sourceExtraction.sources.falseTransparency.decision === 'rejected-for-runtime');
check('source-only external boundary', /EXTERNAL_REFERENCE_ONLY/.test(String(family.externalReferenceContext && family.externalReferenceContext.license)) && /No blocked-license/.test(String(family.externalReferenceContext && family.externalReferenceContext.runtimeBoundary)) && /blocked-license/.test(routing) && /不作为本批生成输入/.test(routing));
check('review and clearance boundaries', /TECHNICAL_PASS/.test(review) && /OPTIONAL_ADVISORY_EVIDENCE/.test(clearance) && /不构成人工/.test(clearance));

const sources = Array.isArray(family.sources) ? family.sources : [];
let sourceBad = 0;
for (const source of sources) {
  if (!source || !source.path || !exists(source.path)) { sourceBad += 1; continue; }
  const raw = read(source.path);
  const d = digest(source.path);
  if (d.sha256 !== source.sha256 || d.bytes !== source.bytes || !/^<svg\b/.test(raw) || /<(?:script|foreignObject|image|iframe|object|embed|text)\b/i.test(raw) || /(?:href|src|url\s*\(\s*(?!#)|@import)/i.test(raw)) sourceBad += 1;
}
check('23 source masters SHA/bytes and SVG safety', sources.length === 23 && sourceBad === 0, `sources=${sources.length},bad=${sourceBad}`);

const variants = Array.isArray(family.variants) ? family.variants : [];
let runtimeBad = 0;
for (const variant of variants) {
  if (!variant || !variant.path || !exists(variant.path)) { runtimeBad += 1; continue; }
  const d = digest(variant.path);
  const expectedHash = family.variants.find(candidate => candidate && candidate.role === variant.role);
  if (d.sha256 !== String(variant.sha256 || '').toUpperCase() || d.bytes !== variant.bytes || (expectedHash && d.sha256 !== String(expectedHash.sha256 || '').toUpperCase())) runtimeBad += 1;
}
check('46 runtime variants SHA/bytes', variants.length === 46 && runtimeBad === 0, `variants=${variants.length},bad=${runtimeBad}`);
check('manifest strict runtime contract', !!item && item.runtime_id === 'monopoly' && item.status === 'ready' && item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && item.source_asset_id === 'ART-036-MONOPOLY-FINAL-ART-V1' && item.feature_flags && item.feature_flags.default_enabled === true && JSON.stringify(item.feature_flags.ids) === JSON.stringify(['mg_art_monopoly_final_v1']) && Object.keys(item.variants || {}).length === 46 && item.actual_bytes === 429072 && item.byte_budget === 6 * 1024 * 1024);
check('catalog local-only family', !!entry && entry.status === 'integrated-local-only' && Array.isArray(entry.runtimePaths) && entry.runtimePaths.length === 46 && entry.license === 'project-owned-deterministic-svg-sharp');
check('resolver is strict and fail-closed', assets.includes('MONOPOLY_FINAL_ART_FLAG') && assets.includes('resolveMonopolyFinalArtUrl') && /ownerClearedDefaultOnFlagEnabled\(MONOPOLY_FINAL_ART_FLAG\)/.test(assets) && /clearance_record!==MONOPOLY_FINAL_ART_CLEARANCE_RECORD/.test(assets));
check('Monopoly presentation consumes art only', monopoly.includes('initMonopolyFinalArtSurface') && monopoly.includes('renderMonopolyFinalArtLayers') && monopoly.includes('showMonopolyFinalArtVfx') && /Rule Authority|authority/i.test(monopoly) && /opts\.onProgress/.test(monopoly) && /sendMonopolyAction/.test(monopoly));
check('Monopoly VFX survives board redraws',
  monopoly.includes('monopolyFinalArtVfxRole=null') &&
  /monopolyFinalArtVfxRole=null/.test(monopoly) &&
  /const preservedVfxRole=monopolyFinalArtVfxRole/.test(monopoly) &&
  /monopolyFinalArtLayers\.host=null/.test(monopoly) &&
  /if\(preservedVfxRole\)showMonopolyFinalArtVfx\(preservedVfxRole\)/.test(monopoly) &&
  /monopolyFinalArtVfxRole=role/.test(monopoly) &&
  /showMonopolyFinalArtVfx\('bankruptcy'\)/.test(monopoly) &&
  /showMonopolyFinalArtVfx\('turn-result'\)/.test(monopoly));
check('CSS 2.5D layers and reduced motion', html.includes('monopoly-final-art-layers') && html.includes('monopoly-final-art-vfx') && html.includes('prefers-reduced-motion:reduce'));
check('Monopoly viewport ownership keeps a desktop board rail and explicit compact controls',
  html.includes('P1-01 Monopoly Final Art · viewport ownership') &&
  /@media\(min-width:901px\) and \(min-height:601px\)/.test(html) &&
  /data-shell-game="monopoly"\] \.game-stage-arena/.test(html) &&
  /width:min\(100%,calc\(100dvh - var\(--stage-header-size\) - var\(--stage-seat-size\) - 18px\),560px\)!important/.test(html) &&
  /grid-template-areas:"money money" "actions settle" "state state" "meta meta"/.test(html) &&
  /grid-template-areas:"dice settle" "actions actions" "money money" "state state" "meta meta"/.test(html));
check('Monopoly responsive command keeps metadata, scrolling and 44px controls without duplicating state',
  /monopoly-wave-b-command>\.monopoly-wave-b-meta[\s\S]{0,180}display:grid!important/.test(html) &&
  /monopoly-wave-b-command[\s\S]{0,300}overflow:auto/.test(html) &&
  /monopoly-action-row \.btn,[\s\S]{0,220}min-width:44px;min-height:44px/.test(html) &&
  /output\.monopoly-wave-b-turn,[\s\S]{0,320}output\.monopoly-wave-b-trade\{display:none!important\}/.test(html));
const unit = ledger.units.find(candidate => candidate && candidate.id === 'P1-01');
check('production ledger P1-01 closed locally', !!unit && unit.status === 'implemented_owner_cleared_release_evidence_pending' && unit.deliverables && unit.deliverables.runtimeVariants === 46 && unit.deliverables.sourceMasters === 23 && unit.deliverables.runtimeBytes === 429072 && Array.isArray(unit.evidence) && unit.evidence.includes('qa/monopoly-final-art-contract.js'));

if (failures) {
  console.error(`MONOPOLY_FINAL_ART_CONTRACT_FAILURES=${failures}`);
  process.exit(1);
}
console.log('MONOPOLY_FINAL_ART_CONTRACT_ALL_PASS');
