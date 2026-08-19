'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const readText = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const exists = rel => fs.existsSync(path.join(ROOT, rel));
const sha256 = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
const pngColorType = rel => fs.readFileSync(path.join(ROOT, rel))[25];
const tokens = readJson('art-source/style/design-tokens.v1.json');
const facial = readJson('art-source/style/facial-kit.v1.json');
const schema = readJson('art-source/style/source-manifest-v2.schema.json');
const manifest = readJson('art-source/style/golden-set-source-manifest-v2.json');
const runtimeManifest = readJson('public/assets/manifests/asset_manifest.json');
const bible = readText('art-source/style/ART_BIBLE_v1.md');
const motion = readText('art-source/style/MOTION_SYSTEM_v1.md');
const design = readText('art-source/ui/sticker-v1/DESIGN_SYSTEM_v3.md');
const brandProvenance = readText('art-source/brand/ghost-game/PROMPT_AND_PROVENANCE_v1.md');
const statesIpReview = readText('art-source/brand/ghost-game/honru/states-v1/IP_REVIEW_draft-v1.md');
const tankProvenance = readText('art-source/games/tank/tank-art-p1-20260810/PROMPT_AND_PROVENANCE.md');
const tankAcceptance = readText('requirements/active/tank-art-p1-20260810/acceptance.md');
const tankPlan = readJson('requirements/active/tank-art-p1-20260810/plan.json');
const tankExecution = readJson('requirements/active/tank-art-p1-20260810/execution.json');
const game45Plan = readJson('requirements/active/game-045-monopoly-character-consumer-p1-20260810/plan.json');
const game45Execution = readJson('requirements/active/game-045-monopoly-character-consumer-p1-20260810/execution.json');
const gcoinsSourcePlan = readJson('requirements/active/gcoins-source-redesign-p1-20260814/plan.json');
const gcoinsSourceExecution = readJson('requirements/active/gcoins-source-redesign-p1-20260814/execution.json');
const stickerRuntimeExecution = readJson('requirements/active/sticker-cartoon-runtime-integration-p1-20260809/execution.json');
const honruRuntimeExecution = readJson('requirements/active/honru-runtime-integration-p2-20260809/execution.json');
const ui037Execution = readJson('requirements/active/ui-037-player-character-runtime-p1-20260810/execution.json');
const gcoinsPresentationExecution = readJson('requirements/active/gcoins-presentation-unification-p1-20260815/execution.json');
const socialMatchChatExecution = readJson('requirements/active/social-match-chat-p1-20260810/execution.json');
const honruCharacterAcceptance = readText('requirements/active/honru-character-master-v2-20260809/acceptance.md');
const art036Acceptance = readText('requirements/active/art-036-player-character-monopoly-p1-20260810/acceptance.md');
const progressionIdentityContract = readText('requirements/active/progression-identity-p1-20260810/contract.md');
const ipTemplate = readText('art-source/style/IP_REVIEW_TEMPLATE.md');
const prompts = readText('art-source/style/PROMPTS_draft-v1.md');
const visualDecision = readText('requirements/active/sticker-cartoon-golden-set-m0-20260808/USER_VISUAL_NORTH_STAR_DECISION-20260816.md');
const execution = readJson('requirements/active/sticker-cartoon-golden-set-m0-20260808/execution.json');
const gatePolicy = readText('requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md');
const routing = readJson('requirements/MAINLINE_CONTROL_ROUTING.json');
const externalSources = readJson('asset-library/external-source-register-20260813.json');
const assetsRuntime = readText('public/src/core/06-assets.js');
const ownerClearance = 'OWNER_AUTHORIZED_ART_CLEARANCE';
const optionalAdvisory = 'OPTIONAL_ADVISORY_EVIDENCE';
const policyMarkdownDocuments = [
  bible, design, brandProvenance, statesIpReview, tankProvenance, tankAcceptance,
  honruCharacterAcceptance, art036Acceptance, progressionIdentityContract,
];
const policyJsonDocuments = [
  tankPlan, tankExecution, game45Plan, game45Execution, gcoinsSourcePlan,
  gcoinsSourceExecution, stickerRuntimeExecution, honruRuntimeExecution,
  ui037Execution, gcoinsPresentationExecution, socialMatchChatExecution,
];

let failures = 0;
function check(name, condition){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures++;
}

function luminance(hex){
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrast(a, b){
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function hasFabricatedHumanPass(text){
  return /(?:Reviewer\s*B|IP(?:\s*Similarity)?(?:\s*Review)?|LEGAL|Golden\s*Set)[^\n]{0,48}\bPASS\b/i.test(String(text || ''));
}

function hasExplicitReleaseBoundary(text){
  return /(?:当前用户明确命令|explicit current user (?:release )?command)/i.test(String(text || ''));
}

function sourceAssetForRuntime(runtimeAsset){
  if (!runtimeAsset || typeof runtimeAsset !== 'object') return null;
  return manifest.assets.find(asset =>
    runtimeAsset.source_asset_id === asset.assetId ||
    runtimeAsset.catalog_key === asset.assetId ||
    (Array.isArray(asset.source && asset.source.paths) && asset.source.paths.includes(runtimeAsset.source))) || null;
}

const paletteKeys = ['ink900','ink700','paper50','cream100','green500','teal500','blue500','purple500','pink500','coral500','gold500','brown500'];
check('Art Bible token schema and style ID are frozen', tokens.schemaVersion === 1 && tokens.styleId === 'pocket-tabletop-sticker-v1');
check('Art Bible defines the complete 12-color palette', JSON.stringify(Object.keys(tokens.palette)) === JSON.stringify(paletteKeys));
check('Art Bible defines exactly the light/dark runtime themes', JSON.stringify(Object.keys(tokens.themes)) === JSON.stringify(['light','dark']));
check('Theme invariants freeze player identity and structural style', ['ink','outlineScale','proportions','materialGrammar','lightDirection','componentStructure','playerIdentityEncoding'].every(key => tokens.themeInvariants.includes(key)));
check('Outline scale covers 24/32/44/64/96/192/512px', JSON.stringify(tokens.outlineScale.map(item => item.displayPx)) === JSON.stringify([24,32,44,64,96,192,512]));
check('Every outline tier preserves minimum semantic line width', tokens.outlineScale.every(item => item.outerMinPx >= 2 && item.innerMinPx >= 1.5 && item.outerMaxPx >= item.outerMinPx && item.innerMaxPx >= item.innerMinPx));
check('Ink text passes AA on light and bright surfaces', ['paper50','cream100','green500','teal500','blue500','pink500','coral500','gold500'].every(key => contrast(tokens.palette.ink900, tokens.palette[key]) >= 4.5));
check('Paper text passes AA on purple and brown surfaces', ['purple500','brown500'].every(key => contrast(tokens.palette.paper50, tokens.palette[key]) >= 4.5));
check('Art budgets preserve Fast Fun Loop constraints', tokens.budgets.firstScreenAdditionalBytesMax <= 512000 && tokens.budgets.singleGameLazyBytesMax <= 1572864 && tokens.budgets.singleAtlasDimensionMaxPx <= 2048 && tokens.budgets.mobileDecodedWorkingSetBytesTarget <= 83886080);
check('Accessibility keeps 44px targets, reduced motion and safe flashing', tokens.accessibility.minimumTouchTargetPx === 44 && tokens.accessibility.respectReducedMotion === true && tokens.accessibility.flashesPerSecondMax <= 3);

const expressionIds = ['neutral','smile','laugh','smug','proud','angry','rage','shock','panic','cry','sad','confused','dizzy','shy','focus','celebrate'];
check('Facial Kit contains 16 canonical expressions', JSON.stringify(facial.expressions.map(item => item.id)) === JSON.stringify(expressionIds));
check('Every expression defines L1/L2/L3', facial.expressions.every(item => item.L1 && item.L2 && item.L3));
check('Facial Kit defines all reusable face layers', ['brow_L','brow_R','eye_L','eye_R','pupil_L','pupil_R','mouth','cheek','tear_sweat'].every(layer => facial.requiredLayers.includes(layer)));
check('Golden Persona is teacher with eight states', facial.goldenPersona.personaId === 'teacher' && JSON.stringify(Object.keys(facial.goldenPersona.states)) === JSON.stringify(['idle','think','confident','surprised','win','lose','taunt','recover']));

check('Source Manifest v2 schema is a source sidecar, not runtime authority', schema.properties.schemaVersion.const === 2 && schema.properties.manifestType.const === 'source-sidecar');
const requiredAssetFields = ['assetId','category','commerceId','runtimeId','artworkVersion','status','source','runtime','pivot','poster','fallbackAssetId','byteBudget','loadTiming','featureFlag','events','provenance','ipReview'];
check('Source Manifest v2 requires full art/provenance/fallback contract', requiredAssetFields.every(field => schema.properties.assets.items.required.includes(field)));
check('Golden Set manifest uses schema v2 and stable style ID', manifest.schemaVersion === 2 && manifest.manifestType === 'source-sidecar' && manifest.styleId === tokens.styleId);
check('Golden Set asset IDs are unique', new Set(manifest.assets.map(asset => asset.assetId)).size === manifest.assets.length);
check('Golden Set freezes Avatar commerce IDs 100/117/124/141', JSON.stringify(manifest.assets.filter(asset => asset.category === 'avatar').map(asset => asset.commerceId)) === JSON.stringify([100,117,124,141]));
check('Golden Set covers Persona/UI/Gomoku/Ludo', ['persona','ui-kit','game-gomoku','game-ludo'].every(category => manifest.assets.some(asset => asset.category === category)));
check('Source sidecar remains inert independently of optional human advice', manifest.assets.every(asset => asset.featureFlag.defaultEnabled === false));
check('Source sidecar honestly keeps optional IP/Golden Set advice pending', manifest.assets.every(asset => asset.status === 'draft' && asset.ipReview.status === 'pending' && Array.isArray(asset.ipReview.reviewers) && asset.ipReview.reviewers.length === 0));
check('All manifest entries define normalized pivots and positive budgets', manifest.assets.every(asset => asset.pivot.unit === 'normalized' && asset.pivot.x >= 0 && asset.pivot.x <= 1 && asset.pivot.y >= 0 && asset.pivot.y <= 1 && asset.byteBudget > 0));
check('Every draft source and poster exists', manifest.assets.every(asset => asset.source.paths.length > 0 && asset.source.paths.every(exists) && exists(asset.poster)));
check('Every draft source hash matches the source-sidecar record', manifest.assets.every(asset => asset.source.paths.length === 1 && sha256(asset.source.paths[0]) === asset.source.sha256));
check('Draft candidates are not wired into runtime paths', manifest.assets.every(asset => asset.runtime.paths.length === 0 && asset.runtime.sha256 === null));
check('Generated candidates retain complete prompt and runtime-managed provenance', manifest.assets.filter(asset => asset.provenance.sourceType === 'generated').every(asset => asset.provenance.license === 'project-owned-ai-generated' && exists(asset.provenance.promptPath) && asset.provenance.model === 'codex-built-in-imagegen-runtime-managed' && asset.provenance.taskId.startsWith('local:exec-') && Date.parse(asset.provenance.createdAt)));
check('Project-owned UI and game specs never claim an image model', manifest.assets.filter(asset => asset.provenance.sourceType === 'project-owned').every(asset => asset.provenance.license === 'project-owned' && asset.provenance.promptPath === null && asset.provenance.model === null && asset.provenance.taskId.startsWith('local:')));
check('Persona and Avatar draft sources are alpha PNGs', manifest.assets.filter(asset => asset.category === 'persona' || asset.category === 'avatar').every(asset => path.extname(asset.source.paths[0]) === '.png' && pngColorType(asset.source.paths[0]) === 6));

const expectedSources = {
  'AI-TEACHER-STICKER-V1': ['art-source/ai/teacher/sticker-v1/teacher-8-state-transparent-draft-v1.png', '6fcc1177fb0eeaaf8d7f9a1a37931f9e66b10dfa2bbd930c4af23491b6c324fb', 'art-source/ai/teacher/sticker-v1/states/idle-transparent-draft-v1.png'],
  'AVATAR-100-STICKER-V1': ['art-source/avatars/golden-set/sticker-v1/avatar_100/avatar_100-transparent-draft-v1.png', '87a4eab8943b41b9dd85e6baa8c6bb2a1fe43b13bd7e8525284a4bb2f4abb633', 'art-source/avatars/golden-set/sticker-v1/avatar_100/avatar_100-transparent-draft-v1.png'],
  'AVATAR-117-STICKER-V1': ['art-source/avatars/golden-set/sticker-v1/avatar_117/avatar_117-transparent-draft-v1.png', 'b62f370a5a58c7f1db173c67d04f824d4c72a50c2368ba5cf02322ebbe2d925f', 'art-source/avatars/golden-set/sticker-v1/avatar_117/avatar_117-transparent-draft-v1.png'],
  'AVATAR-124-STICKER-V1': ['art-source/avatars/golden-set/sticker-v1/avatar_124/avatar_124-transparent-draft-v1.png', 'bd814903906d08bca9976ce5fc2ef70706c2c1c98f3090a20bc73fad1ab9875e', 'art-source/avatars/golden-set/sticker-v1/avatar_124/avatar_124-transparent-draft-v1.png'],
  'AVATAR-141-STICKER-V1': ['art-source/avatars/golden-set/sticker-v1/avatar_141/avatar_141-transparent-draft-v1.png', '1e923155cd6a114fd5a58dee4175baa894166e0db557654b40b03bcd829f95df', 'art-source/avatars/golden-set/sticker-v1/avatar_141/avatar_141-transparent-draft-v1.png'],
  'UI-STICKER-CORE-V1': ['art-source/ui/sticker-v1/component-demo.html', '67e52d8d0ceab8cd22d3e0583a724d1f8b8a8c366ec6040ce8d76b9071b5b1e1', 'art-source/ui/sticker-v1/component-demo.png'],
  'G-02-STICKER-V1': ['art-source/games/gomoku/sticker-v1/gomoku-vertical-slice-spec-draft-v2.svg', '36638c20799829cda752469d26292ba0f2d17eef4e3c2c018139275b90e0f56c', 'art-source/games/gomoku/sticker-v1/gomoku-vertical-slice-spec-draft-v2.png'],
  'G-07-STICKER-V1': ['art-source/games/ludo/sticker-v1/ludo-vertical-slice-spec-draft-v2.svg', null, 'art-source/games/ludo/sticker-v1/ludo-vertical-slice-spec-draft-v2.png'],
};
check('Manifest freezes all eight current source and poster paths', manifest.assets.every(asset => {
  const expected = expectedSources[asset.assetId];
  return expected && asset.source.paths[0] === expected[0] && (!expected[1] || asset.source.sha256 === expected[1]) && asset.poster === expected[2];
}));

const gomokuSpec = readText('art-source/games/gomoku/sticker-v1/gomoku-vertical-slice-spec-draft-v2.svg');
const ludoSpec = readText('art-source/games/ludo/sticker-v1/ludo-vertical-slice-spec-draft-v2.svg');
check('Gomoku v2 spec freezes an exact 15x15 grid and five-stone win', gomokuSpec.includes('data-grid-size="15"') && gomokuSpec.includes('data-standard-star-count="5"') && gomokuSpec.includes('data-win-length="5"') && (gomokuSpec.match(/M\d+ 125V769/g) || []).length === 15 && (gomokuSpec.match(/M180 \d+H824/g) || []).length === 15);
check('Ludo v2 spec freezes 52 public cells and four tokens per team', ludoSpec.includes('data-public-track-cells="52"') && (ludoSpec.match(/data-base-token-count="4"/g) || []).length === 4 && ['greenPlane','bluePlane','coralPlane','goldPlane'].every(id => ludoSpec.includes(`id="${id}"`)));
check('Generated rule-error explorations remain documented and excluded', readText('art-source/style/PROMPTS_draft-v1.md').includes('REJECTED_AS_RULE_SOURCE') && !manifest.assets.some(asset => asset.source.paths.some(rel => rel.includes('style-board-draft-v1.png'))));
const northStarStructure = 'art-source/ui/sticker-v1/component-demo.png';
const northStarFinish = 'art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png';
const northStarStructureSha = '135db655dc400fb35f960045b510ee450e007ccfad03e308debf65e222db1f61';
const northStarFinishSha = '184e24bfd5c52f54fa240366787a0751e5078038e4fbda17b91c61219f2b4de5';
check('User visual North Star files retain exact approved bytes', sha256(northStarStructure) === northStarStructureSha && sha256(northStarFinish) === northStarFinishSha);
check('North Star decision records both immutable paths and hashes', [northStarStructure, northStarFinish, northStarStructureSha.toUpperCase(), northStarFinishSha.toUpperCase()].every(value => visualDecision.includes(value)));
check('Art Bible and Design System adopt the exact North Star without claiming per-asset approval', [northStarStructure, northStarFinish, 'USER_STYLE_DIRECTION_CONFIRMED'].every(value => bible.includes(value)) && ['component-demo.png','generated/core-ui-style-board-draft-v1.png','逐资产'].every(value => design.includes(value)));
check('Future ImageGen prompts use the project style ID and exclude external skins', prompts.includes('pocket-tabletop-sticker-v1') && prompts.includes(northStarStructure) && prompts.includes(northStarFinish) && prompts.includes('禁止引用商业游戏'));
check('Execution records verified style direction and honestly pending optional per-asset advice', execution.progress.userVisualNorthStar.status === 'verified' && execution.progress.humanDecision.status === 'partial' && execution.progress.humanDecision.missing.includes('per-asset APPROVE/REWORK/REJECT decisions'));
const gomokuSourceEntry = manifest.assets.find(asset => asset.assetId === 'G-02-STICKER-V1');
const gomokuRuntimeEntry = runtimeManifest.assets.find(asset => asset.asset_id === 'G-02-STICKER-BOARD-SURFACE-V1');
const stickerRuntimeEntries = runtimeManifest.assets.filter(asset => sourceAssetForRuntime(asset) || String(asset && asset.asset_id || '').includes('STICKER'));
const ownerClearedRuntimeEntries = stickerRuntimeEntries.filter(asset => asset.clearance === ownerClearance || asset.feature_flags && asset.feature_flags.default_enabled === true);
const technicalPreviewEntries = stickerRuntimeEntries.filter(asset => !ownerClearedRuntimeEntries.includes(asset));
check('M0 source sidecar remains source authority while runtime derivatives stay separate', !!gomokuSourceEntry && gomokuSourceEntry.status === 'draft' && gomokuSourceEntry.ipReview.status === 'pending' && gomokuSourceEntry.runtime.paths.length === 0 && (!gomokuRuntimeEntry || gomokuRuntimeEntry.source === gomokuSourceEntry.source.paths[0] && gomokuRuntimeEntry.runtime_path !== gomokuRuntimeEntry.source));
check('Uncleared runtime surface is limited to the existing inert Gomoku technical preview', technicalPreviewEntries.length <= 1 && technicalPreviewEntries.every(asset => {
  const sourceAsset = sourceAssetForRuntime(asset);
  const flags = asset.feature_flags;
  const integrity = String(asset.integrity || '').replace(/^sha256:/, '').toLowerCase();
  return asset.asset_id === 'G-02-STICKER-BOARD-SURFACE-V1' && sourceAsset && sourceAsset.assetId === 'G-02-STICKER-V1' &&
    !asset.clearance && asset.status === 'ready' && flags && flags.operator === 'all' && flags.enabled_value === '1' &&
    flags.default_enabled === false && JSON.stringify(flags.ids) === JSON.stringify(['mg_art_sticker_m0_v1','mg_art_gomoku_sticker_v1']) &&
    asset.fallback_asset_id === 'G-02-BOARD-SURFACE' && /^public\/assets\/games\/gomoku\//.test(asset.runtime_path || '') &&
    exists(asset.runtime_path) && /^[a-f0-9]{64}$/.test(integrity) && sha256(asset.runtime_path) === integrity &&
    asset.actual_bytes === fs.statSync(path.join(ROOT, asset.runtime_path)).size && asset.actual_bytes <= asset.byte_budget;
}));
check('No Sticker entry can be half-promoted between source/preview and owner-cleared runtime', stickerRuntimeEntries.every(asset => {
  const cleared = asset.clearance === ownerClearance;
  const defaultOn = !!(asset.feature_flags && asset.feature_flags.default_enabled === true);
  return cleared === defaultOn;
}));
check('Every owner-cleared Sticker runtime atomically pins source, public derivative, integrity, fallback, flags and clearance evidence', ownerClearedRuntimeEntries.every(asset => {
  const sourceAsset = sourceAssetForRuntime(asset);
  const flags = asset.feature_flags;
  const flagIds = flags && Array.isArray(flags.ids) ? flags.ids : [];
  const runtimePath = String(asset.runtime_path || '');
  const integrity = String(asset.integrity || '').replace(/^sha256:/, '').toLowerCase();
  const sourceSha = String(sourceAsset && sourceAsset.source && sourceAsset.source.sha256 || '').toLowerCase();
  const clearancePath = String(asset.clearance_record || '');
  const clearanceText = clearancePath && exists(clearancePath) ? readText(clearancePath) : '';
  return sourceAsset && /^[a-f0-9]{64}$/.test(sourceSha) && asset.source_asset_id === sourceAsset.assetId && asset.artwork_version === sourceAsset.artworkVersion &&
    asset.status === 'ready' && asset.clearance === ownerClearance && flags && flags.operator === 'all' && flags.enabled_value === '1' &&
    flags.default_enabled === true && flagIds.length > 0 && flagIds.every(id => /^mg_(?:art|ui|persona|avatar)_/.test(id)) &&
    runtimePath.startsWith('public/assets/') && !runtimePath.includes('art-source/') && exists(runtimePath) &&
    /^[a-f0-9]{64}$/.test(integrity) && sha256(runtimePath) === integrity &&
    Number.isInteger(asset.actual_bytes) && Number.isInteger(asset.byte_budget) && asset.actual_bytes === fs.statSync(path.join(ROOT, runtimePath)).size && asset.actual_bytes > 0 && asset.actual_bytes <= asset.byte_budget &&
    asset.fallback_asset_id && typeof asset.fallback === 'string' && asset.fallback.length > 0 &&
    clearanceText && [ownerClearance, sourceAsset.assetId, sourceSha, integrity, 'M0 North Star', optionalAdvisory, 'NOT_EXECUTED', 'fallback', 'blocked-license', 'EXTERNAL_REFERENCE_ONLY', ...flagIds].every(token => clearanceText.includes(token)) &&
    !hasFabricatedHumanPass(clearanceText) && assetsRuntime.includes(asset.asset_id) && flagIds.every(id => assetsRuntime.includes(id)) && assetsRuntime.includes('ownerClearedDefaultOnFlagEnabled');
}));
check('Current technical preview consumer stays exact-default-off while owner-cleared consumers use the reversible default-on helper', technicalPreviewEntries.every(asset => asset.feature_flags.ids.every(id => assetsRuntime.includes(id))) && assetsRuntime.includes('flags.default_enabled !== false') && ownerClearedRuntimeEntries.every(asset => assetsRuntime.includes('ownerClearedDefaultOnFlagEnabled')));
check('P1 静态底材 Change Request 保留 Motion 边界', exists('requirements/active/sticker-cartoon-runtime-integration-p1-20260809/CHANGE_REQUEST-静态底材策略-20260809.md') && readText('requirements/active/sticker-cartoon-runtime-integration-p1-20260809/CHANGE_REQUEST-静态底材策略-20260809.md').includes('不新增 requestAnimationFrame'));

const artGate = routing.sharedGates && routing.sharedGates['GATE-ART-GOLDEN-SET'];
check('Art Gate opens only through owner authorization and keeps release separate', artGate && artGate.status === 'OPEN_BY_OWNER_AUTHORIZATION' && artGate.developmentStatus === 'OPEN' && artGate.releaseStatus === 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED');
check('Human cleanup, Reviewer B, IP/legal and per-asset Golden Set remain honest optional advice', gatePolicy.includes(ownerClearance) && gatePolicy.includes(optionalAdvisory) && gatePolicy.includes('不作为原创资产的开发、runtime 或发布先决条件') && !manifest.assets.some(asset => asset.ipReview.status !== 'pending'));
check('External blocked-license/reference-only assets remain outside source and runtime lanes', externalSources.status === 'reference-only' && externalSources.storage.copiedIntoRepository === false && externalSources.storage.decompressedIntoRepository === false && /不得直接复制到 public\/assets/.test(externalSources.runtimePolicy || '') && gatePolicy.includes('blocked-license') && !JSON.stringify(runtimeManifest).includes('BaiduNetdiskDownload'));
check('Art/source and acceptance docs use owner clearance with non-blocking optional advice and explicit release authority', policyMarkdownDocuments.every(text =>
  text.includes(ownerClearance) && text.includes(optionalAdvisory) && text.includes('blocked-license') && hasExplicitReleaseBoundary(text) &&
  /(?:不得.{0,16}(?:冒充|伪造).{0,8}PASS|never fabricate PASS)/i.test(text)));
check('Former human-gated candidate/default-off prose is retained only as historical-as-of evidence', policyMarkdownDocuments.every(text =>
  /historical-as-of/i.test(text) && /candidate-only|default-off|SOURCE_ONLY|DO_NOT_SHIP/i.test(text)));
check('All reconciled art-task JSON remains parseable and carries current owner-clearance policy', policyJsonDocuments.every(record => {
  const text = JSON.stringify(record);
  const optionalPolicy = text.includes(optionalAdvisory) || record.optionalAdvisoryEvidence && record.optionalAdvisoryEvidence.blocking === false;
  return text.includes(ownerClearance) && optionalPolicy && text.includes('blocked-license') && hasExplicitReleaseBoundary(text);
}));
check('All reconciled art-task JSON preserves the former human-gated state as audit history', policyJsonDocuments.every(record => {
  const history = record && record.historicalAsOf;
  return history && /candidate-only|default-off|human prerequisite/i.test(JSON.stringify(history));
}));
check('Optional human advice no longer blocks active art development',
  tankExecution.blocked.length === 0 && gcoinsSourceExecution.blocked.length === 0 && stickerRuntimeExecution.blocked.length === 0 && honruRuntimeExecution.blocked.length === 0 &&
  game45Execution.developmentBlocked === false &&
  [tankExecution, game45Execution, gcoinsSourcePlan, gcoinsSourceExecution, stickerRuntimeExecution, honruRuntimeExecution, ui037Execution, gcoinsPresentationExecution, socialMatchChatExecution]
    .every(record => record.optionalAdvisoryEvidence && record.optionalAdvisoryEvidence.blocking === false));
check('Owner-cleared Honru state runtime is current local default-on while the old default-off release remains historical',
  honruRuntimeExecution.state === 'LOCAL_OWNER_CLEARED_DEFAULT_ON_NOT_RELEASED' &&
  honruRuntimeExecution.progress.ownerAuthorizedRuntime.status === 'verified_local_default_on' &&
  honruRuntimeExecution.historicalAsOf.state === 'RELEASED_DEFAULT_OFF');

for (const component of ['Button','Card','Modal','Room Seat','Shop Card','Avatar','Badge','Toast']) {
  check(`Design System v3 covers ${component}`, design.includes(component));
}
for (const state of ['default','hover','pressed','focus','disabled','loading','error','owned','equipped']) {
  check(`Design System v3 records ${state} state`, design.includes(state));
}
check('Motion System defines all four phases', ['Anticipation','Action','Impact','Settle'].every(phase => motion.includes(phase)));
check('Motion System protects reduced motion, offscreen pause and input', motion.includes('reduced-motion') && motion.includes('离屏') && motion.includes('inputBlocked=false'));
check('Art Bible preserves runtime authority and legacy fallback independently of advisory review', bible.includes('规则坐标') && bible.includes('命中、快照、AI 和联机协议不得进入美术状态') && bible.includes('fallback'));
check('IP template retains seven risk dimensions and optional reviewer fields without manufacturing a PASS', ['黑色剪影','头饰/服饰组合','道具/武器','徽记/文字','构图','表情与嘴型组合','高潮 Pose','Reviewer A','Reviewer B'].every(label => ipTemplate.includes(label)) && !hasFabricatedHumanPass(ipTemplate));

if (failures){
  console.error(`STICKER_ART_CONTRACT_FAILURES=${failures}`);
  process.exit(1);
}
console.log('STICKER_ART_CONTRACT_ALL_PASS');
