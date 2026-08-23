'use strict';

// P1-02 machine contract. It proves provenance, strict Manifest activation,
// runtime isolation and presentation-only consumption. It does not claim
// second-browser, physical-device, human/IP or release evidence.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const file = relative => path.join(ROOT, relative);
const exists = relative => fs.existsSync(file(relative));
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

const familyPath = 'art-source/games/tank/final-art-v1/asset-family-manifest-v1.json';
const family = JSON.parse(read(familyPath));
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const catalog = JSON.parse(read('asset-library/catalog.json'));
const ledger = JSON.parse(read('art-source/production/ghost-game-art-program-v1/production-ledger-v1.json'));
const transmission = JSON.parse(read('art-source/games/tank/final-art-v1/EXTERNAL_REFERENCE_TRANSMISSION.json'));
const assets = read('public/src/core/06-assets.js');
const tank = read('public/src/games/tank.js');
const { readPresentationSource } = require('./presentation-source');
const html = readPresentationSource();
const routing = read('art-source/games/tank/final-art-v1/SKILL_ROUTING.md');
const clearance = read('art-source/games/tank/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md');
const review = read('art-source/games/tank/final-art-v1/TECHNICAL_REVIEW_Reviewer_A.md');
const visible = JSON.parse(read('requirements/active/tank-final-art-v1-p1-20260821/current-build-tank-visible-matrix-20260821.json'));
const middleVisible = JSON.parse(read('requirements/active/tank-final-art-v1-p1-20260821/tank-middle-viewport-visible-20260821.json'));

const item = manifest.assets.find(asset => asset && asset.asset_id === 'G-12-TANK-FINAL-ART-V1');
const entry = catalog.assets.find(asset => asset && asset.id === 'G-12-TANK-FINAL-ART-V1');
check('family identity and clearance', family.familyId === 'G-12-TANK-FINAL-ART-V1' && family.productionUnitId === 'P1-02' && family.sourceAssetId === 'ART-035-TANK-FINAL-ART-V1' && family.status === 'OWNER_AUTHORIZED_ART_CLEARANCE');
check('source/runtime counts and budget', family.metrics && family.metrics.sourceMasterCount === 25 && family.metrics.runtimeVariantCount === 50 && family.metrics.runtimeBytes === 376668 && family.metrics.withinBudget === true);

const falseTransparency = [
  'art-source/games/tank/final-art-v1/source/tank-object-atoms-source-v1.png',
  'art-source/games/tank/final-art-v1/source/tank-semantic-vfx-source-v1.png',
  'art-source/games/tank/final-art-v1/source/tank-object-atoms-chroma-source-v1.png',
  'art-source/games/tank/final-art-v1/source/tank-semantic-vfx-chroma-source-v1.png',
];
check('source boards preserve false-transparency evidence', falseTransparency.every(relative => exists(relative) && fs.readFileSync(file(relative))[25] === 2) && /rejected for runtime/i.test(read('art-source/games/tank/final-art-v1/PROMPT_AND_PROVENANCE.md')));
check('controlled full-information reference lane is fully recorded', transmission.schemaVersion === 2 && transmission.inventoryContext && transmission.inventoryContext.runtimeLicense === 'EXTERNAL_REFERENCE_ONLY / blocked-license' && transmission.inputs.length === 2 && transmission.calls.length === 5 && transmission.calls.every(call => call.taskId && call.sentAt && call.outputPath && call.outputSha256) && /blocked-license/.test(routing));
check('external reference remains source-only', family.externalReferenceContext && family.externalReferenceContext.status === 'SOURCE_ONLY_EXTERNAL_INFLUENCED' && /No blocked-license/.test(String(family.externalReferenceContext.runtimeBoundary)) && /不覆盖 ImageGen source-only PNG/.test(clearance));
check('review and clearance boundaries', /TECHNICAL_PASS/.test(review) && /SIMILARITY_RISK_LOW/.test(review) && /OPTIONAL_ADVISORY_EVIDENCE/.test(clearance) && /未执行/.test(clearance));

const sources = Array.isArray(family.sources) ? family.sources : [];
let sourceBad = 0;
for (const source of sources) {
  if (!source || !source.path || !exists(source.path)) { sourceBad += 1; continue; }
  const raw = read(source.path);
  const d = digest(source.path);
  if (d.sha256 !== source.sha256 || d.bytes !== source.bytes || !/^<svg\b/.test(raw) || /<(?:script|foreignObject|image|iframe|object|embed|text)\b/i.test(raw) || /(?:href|src|url\s*\(\s*(?!#)|@import)/i.test(raw)) sourceBad += 1;
}
check('25 source masters SHA/bytes and SVG safety', sources.length === 25 && sourceBad === 0, `sources=${sources.length},bad=${sourceBad}`);

const variants = Array.isArray(family.variants) ? family.variants : [];
let runtimeBad = 0;
for (const variant of variants) {
  if (!variant || !variant.path || !exists(variant.path)) { runtimeBad += 1; continue; }
  const d = digest(variant.path);
  if (d.sha256 !== String(variant.sha256 || '').toUpperCase() || d.bytes !== variant.bytes) runtimeBad += 1;
}
check('50 runtime variants SHA/bytes', variants.length === 50 && runtimeBad === 0, `variants=${variants.length},bad=${runtimeBad}`);
check('manifest strict runtime contract', !!item && item.runtime_id === 'tank' && item.status === 'ready' && item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && item.source_asset_id === 'ART-035-TANK-FINAL-ART-V1' && item.clearance_record === 'art-source/games/tank/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md' && item.feature_flags && item.feature_flags.default_enabled === true && JSON.stringify(item.feature_flags.ids) === JSON.stringify(['mg_art_tank_final_v1']) && Object.keys(item.variants || {}).length === 50 && item.actual_bytes === 376668 && item.byte_budget === 6 * 1024 * 1024);
check('catalog local-only family', !!entry && entry.status === 'integrated-local-only' && Array.isArray(entry.runtimePaths) && entry.runtimePaths.length === 50 && entry.license === 'project-owned-deterministic-svg-sharp');
check('resolver is strict and fail-closed', assets.includes('TANK_FINAL_ART_FLAG') && assets.includes('resolveTankFinalArtUrl') && /ownerClearedDefaultOnFlagEnabled\(TANK_FINAL_ART_FLAG\)/.test(assets) && /clearance_record!==TANK_FINAL_ART_CLEARANCE_RECORD/.test(assets) && /runtime_id!==['"]tank['"]/.test(assets));
check('Tank consumes art through presentation-only lifecycle', tank.includes('initTankFinalArtSurface') && tank.includes('mountTankFinalArtSurface') && tank.includes('syncTankFinalArtTerminal') && tank.includes('tankFinalArtRequest++') && tank.includes('clearTankFinalArtSurface') && /Tank Authority|authority/i.test(tank) && /sendTankInput/.test(tank));
check('full family decode is atomic', /Promise\.all\(roles\.map\(role=>resolveTankFinalArtUrl/.test(tank) && /Promise\.all\(urls\.map\(tankFinalArtProbe\)\)/.test(tank) && /results\.some\(value=>!value\)/.test(tank));
check('CSS 2.5D, HUD, reduced motion and forced colors', html.includes('P1-02 Tank Final Art · presentation only') && html.includes('tank-final-art-layers') && html.includes('tank-arena-hud') && /prefers-reduced-motion:reduce/.test(html) && /forced-colors:active/.test(html));
check('797x698 middle viewport owns a right command rail without shrinking Tank controls',
  html.includes('P1-02 Tank Final Art · middle viewport ownership') &&
  /@media\(min-width:600px\) and \(min-height:601px\) and \(orientation:landscape\)\{[\s\S]*--tank-middle-command-rail:clamp\(300px,30vw,380px\)[\s\S]*padding:4px calc\(var\(--tank-middle-command-rail\) \+ 10px\) 4px 4px[\s\S]*grid-template-areas:"state" "status" "controls" "tools" "banner"/.test(html) &&
  /data-shell-game="tank"\] \.tank-control-deck\{[\s\S]{0,340}grid-template-areas:"move fire" "mode mode"/.test(html) &&
  /\.tank-dpad-button\{[^}]*min-width:44px!important;min-height:44px!important/.test(html) &&
  /data-shell-game="tank"\] \.tank-fire\{[^}]*min-width:66px!important;min-height:66px!important/.test(html));
check('Tank landscape rail has no 720/721 or 900/901 breakpoint cliff',
  /@media\(min-width:600px\) and \(min-height:601px\) and \(orientation:landscape\)/.test(html) &&
  !/@media\(min-width:721px\) and \(max-width:900px\) and \(min-height:601px\)[\s\S]{0,220}tank-middle-command-rail/.test(html));
check('generator has one terminal cross path', (read('art-source/games/tank/final-art-v1/runtime-source/vfx-terminal-v1.svg').match(/M256 54v72/g) || []).length === 1);
const currentBuild = digest('public/index.html');
check('recorded Chromium matrix is build-bound to its historical artifact and scoped', visible.evidenceClass === 'LOCAL_SINGLE_CHROMIUM_SIMULATION_ONLY' && /^[A-F0-9]{64}$/.test(visible.build.sha256) && visible.build.bytes > 0 && visible.scenarios.length === 6 && visible.scenarios.every(scenario => scenario.result === 'PASS') && visible.console.warningCount === 0 && visible.console.errorCount === 0 && visible.notExecuted.includes('second desktop browser'));
check('middle landscape visible repair evidence stays historical and honest', middleVisible.evidenceClass === 'LOCAL_SINGLE_CHROMIUM_HISTORICAL_AS_OF' && middleVisible.scenario && middleVisible.scenario.result === 'PASS' && middleVisible.scenario.facts.tankFinalArtState === 'active' && middleVisible.scenario.facts.board.width >= 340 && middleVisible.scenario.facts.boardCommandOverlapPixels === 0 && middleVisible.scenario.facts.dpadMinimumTarget >= 44 && middleVisible.scenario.facts.fireTarget >= 44 && middleVisible.laterNarrowing.visibleReexecution === 'NOT_EXECUTED_AFTER_NARROWING' && /historical-as-of/i.test(middleVisible.boundary));
check('machine visual and similarity reviews are separate and do not claim legal review', exists('art-source/games/tank/final-art-v1/MACHINE_VISUAL_REVIEW.md') && exists('art-source/games/tank/final-art-v1/SIMILARITY_AND_IP_REVIEW.md') && /MACHINE_VISUAL_PASS/.test(read('art-source/games/tank/final-art-v1/MACHINE_VISUAL_REVIEW.md')) && /NOT_LEGAL_ADVICE/.test(read('art-source/games/tank/final-art-v1/SIMILARITY_AND_IP_REVIEW.md')));

const unit = ledger.units.find(candidate => candidate && candidate.id === 'P1-02');
check('production ledger P1-02 closed locally', !!unit && unit.status === 'implemented_owner_cleared_release_evidence_pending' && unit.completion && unit.completion.localVisibleEvidencePercent === 100 && unit.deliverables && unit.deliverables.runtimeVariants === 50 && unit.deliverables.sourceMasters === 25 && unit.deliverables.runtimeBytes === 376668 && Array.isArray(unit.evidence) && unit.evidence.includes('qa/tank-final-art-contract.js'));

if (failures) {
  console.error(`TANK_FINAL_ART_CONTRACT_FAILURES=${failures}`);
  process.exit(1);
}
console.log('TANK_FINAL_ART_CONTRACT_ALL_PASS');
