'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const familyPath = path.join(ROOT, 'art-source/games/gomoku/final-art-v1/asset-family-manifest-v1.json');
const family = JSON.parse(fs.readFileSync(familyPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'asset-library/catalog.json'), 'utf8'));
const assets = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
const gomoku = fs.readFileSync(path.join(ROOT, 'public/src/games/gomoku.js'), 'utf8');
const template = fs.readFileSync(path.join(ROOT, 'public/index-template.html'), 'utf8');
const provenance = fs.readFileSync(path.join(ROOT, 'art-source/games/gomoku/final-art-v1/PROMPT_AND_PROVENANCE.md'), 'utf8');
const review = fs.readFileSync(path.join(ROOT, 'art-source/games/gomoku/final-art-v1/TECHNICAL_REVIEW_Reviewer_A.md'), 'utf8');
const clearance = fs.readFileSync(path.join(ROOT, 'art-source/games/gomoku/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md'), 'utf8');

let failures = 0;
function check(label, value, detail) {
  if (value) console.log('PASS ' + label);
  else { failures++; console.error('FAIL ' + label + (detail ? ' ' + detail : '')); }
}
function fileFor(relativePath) { return path.join(ROOT, ...String(relativePath).replace(/\\/g, '/').split('/')); }
function digest(file) {
  const data = fs.readFileSync(file);
  return { sha256: crypto.createHash('sha256').update(data).digest('hex').toUpperCase(), bytes: data.length };
}
function webpInfo(file) {
  const data = fs.readFileSync(file);
  if (data.toString('ascii', 0, 4) !== 'RIFF' || data.toString('ascii', 8, 12) !== 'WEBP') return null;
  let at = 12, width = 0, height = 0, alpha = false;
  while (at + 8 <= data.length) {
    const type = data.toString('ascii', at, at + 4), length = data.readUInt32LE(at + 4), start = at + 8;
    if (type === 'VP8X' && length >= 10) { alpha = !!(data[start] & 16); width = (data[start + 4] | data[start + 5] << 8 | data[start + 6] << 16) + 1; height = (data[start + 7] | data[start + 8] << 8 | data[start + 9] << 16) + 1; }
    if (type === 'ALPH') alpha = true;
    if (type === 'VP8L' && length >= 5) { const bits = data.readUInt32LE(start + 1); width = (bits & 0x3fff) + 1; height = ((bits >>> 14) & 0x3fff) + 1; alpha = alpha || !!(bits & 0x10000000); }
    if (type === 'VP8 ' && length >= 10 && !width) { width = data.readUInt16LE(start + 6) & 0x3fff; height = data.readUInt16LE(start + 8) & 0x3fff; }
    at = start + length + (length & 1);
  }
  return { width, height, alpha };
}

check('family identity and clearance', family.productionUnitId === 'P0-06' && family.familyId === 'G-02-GOMOKU-FINAL-ART-V1' && family.status === 'OWNER_AUTHORIZED_ART_CLEARANCE');
check('source/runtime counts and coverage', family.sourceMasters.length === 18 && family.runtimeVariants.length === 36 && family.boards.length === 4 && family.pieces.length === 5 && family.vfx.length === 7 && family.cameras.length === 2);
check('runtime budget', family.metrics.runtimeVariantBytes === 477912 && family.metrics.withinBudget === true && family.metrics.runtimeVariantBytes <= family.metrics.runtimeByteBudget);
check('external isolation records', /EXTERNAL_REFERENCE_ONLY/.test(family.externalReferencePolicy) && /blocked-license/.test(provenance) && /not.*generation inputs/i.test(provenance) && !/\.psd|\.ai|\.eps|\.rpg/i.test(JSON.stringify(family.sourceMasters)));

let integrityFailures = 0;
for (const asset of family.sourceMasters) {
  const file = fileFor(asset.path);
  if (!fs.existsSync(file)) { integrityFailures++; continue; }
  const actual = digest(file);
  if (actual.sha256 !== asset.sha256 || actual.bytes !== asset.bytes) integrityFailures++;
  const svg = fs.readFileSync(file, 'utf8');
  if (!/^<svg\b/.test(svg) || /<(?:script|foreignObject|image|iframe|object|embed|animate|animateTransform|set|text)\b/i.test(svg) || /(?:href|src|url\s*\(\s*(?!#)|@import)/i.test(svg)) integrityFailures++;
}
for (const asset of family.runtimeVariants) {
  const file = fileFor(asset.path);
  if (!fs.existsSync(file)) { integrityFailures++; continue; }
  const actual = digest(file), info = webpInfo(file);
  if (!info || actual.sha256 !== asset.sha256 || actual.bytes !== asset.bytes || info.width !== asset.width || info.height !== asset.height || info.alpha !== asset.alpha) integrityFailures++;
}
check('all source/runtime SHA bytes dimensions Alpha and safe SVG', integrityFailures === 0, 'bad=' + integrityFailures);

const runtime = manifest.assets.find(asset => asset && asset.asset_id === 'G-02-GOMOKU-FINAL-ART-V1');
const catalogEntry = catalog.assets.find(asset => asset && asset.id === 'G-02-GOMOKU-FINAL-ART-V1');
check('Manifest identity, flags, fallback and resolver boundary', !!runtime && runtime.runtime_id === 'gomoku' && runtime.status === 'ready' && runtime.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && runtime.source_asset_id === 'ART-GOMOKU-FINAL-ART-V1' && runtime.actual_bytes === 477912 && runtime.byte_budget === 4 * 1024 * 1024 && runtime.fallback_asset_id === 'G-02-STICKER-BOARD-SURFACE-V1' && JSON.stringify(runtime.feature_flags) === JSON.stringify({ operator: 'all', enabled_value: '1', default_enabled: true, ids: ['mg_art_gomoku_final_v1'] }));
check('Manifest contains all 36 registered paths', !!runtime && Object.keys(runtime.variants || {}).length === 36 && family.runtimeVariants.every(item => runtime.variants[item.key] === item.path));
check('asset-library catalog entry covers all runtime variants', !!catalogEntry && catalogEntry.status === 'integrated-local-only' && catalogEntry.runtimePaths.length === 36 && catalogEntry.runtimePaths.every(file => fs.existsSync(fileFor(file))));

check('independent Manifest resolver and fail-closed flag', assets.includes('gomokuFinalArtManifestPromise') && assets.includes('resolveGomokuFinalArtUrl') && assets.includes('GOMOKU_FINAL_ART_CLEARANCE_RECORD') && /ownerClearedDefaultOnFlagEnabled\(GOMOKU_FINAL_ART_FLAG\)/.test(assets) && /gomokuFinalArtManifestPromise=null/.test(assets));
check('Gomoku presentation-only board/piece/VFX integration', gomoku.includes('initGomokuFinalArtSurface') && gomoku.includes('drawGomokuFinalStone') && gomoku.includes('showGomokuFinalVfx') && gomoku.includes('game-art-gomoku-final-v1') && gomoku.includes("showGomokuFinalVfx('line'") && gomoku.includes("showGomokuFinalVfx('reconnect')"));
check('rule and persistence boundary remains closed', !/gomokuFinalArt(?:Active|State|Requested)[\s\S]{0,120}(?:snapshot|sendMove|onProgress|onEnd|reward|matchId)/.test(gomoku) && /function snapshot\(\)/.test(gomoku) && /function applyMove\(/.test(gomoku));
check('CSS fallback and reduced motion', template.includes('game-art-gomoku-final-v1') && template.includes('gomoku-final-vfx') && template.includes('prefers-reduced-motion:reduce') && template.includes('data-gomoku-final-vfx-state'));
check('review and clearance keep advisory boundaries honest', /TECHNICAL_PASS/.test(review) && /OPTIONAL_ADVISORY_EVIDENCE/.test(clearance) && /not.*release|不构成.*发布批准/i.test(clearance) && /blocked-license/.test(clearance));

if (failures) { console.error('GOMOKU_FINAL_ART_CONTRACT_FAILURES=' + failures); process.exit(1); }
console.log('GOMOKU_FINAL_ART_CONTRACT_ALL_PASS');
