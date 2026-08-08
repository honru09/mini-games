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
const bible = readText('art-source/style/ART_BIBLE_v1.md');
const motion = readText('art-source/style/MOTION_SYSTEM_v1.md');
const design = readText('art-source/ui/sticker-v1/DESIGN_SYSTEM_v3.md');
const ipTemplate = readText('art-source/style/IP_REVIEW_TEMPLATE.md');

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

const paletteKeys = ['ink900','ink700','paper50','cream100','green500','teal500','blue500','purple500','pink500','coral500','gold500','brown500'];
check('Art Bible token schema and style ID are frozen', tokens.schemaVersion === 1 && tokens.styleId === 'pocket-tabletop-sticker-v1');
check('Art Bible defines the complete 12-color palette', JSON.stringify(Object.keys(tokens.palette)) === JSON.stringify(paletteKeys));
check('Art Bible defines exactly six runtime themes', JSON.stringify(Object.keys(tokens.themes)) === JSON.stringify(['light','midnight','ocean','forest','cyber','sakura']));
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
check('All M0 feature flags default off before human approval', manifest.assets.every(asset => asset.featureFlag.defaultEnabled === false));
check('All Golden Set candidates are draft with pending IP review', manifest.assets.every(asset => asset.status === 'draft' && asset.ipReview.status === 'pending'));
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
  'G-02-STICKER-V1': ['art-source/games/gomoku/sticker-v1/gomoku-vertical-slice-spec-draft-v2.svg', null, 'art-source/games/gomoku/sticker-v1/gomoku-vertical-slice-spec-draft-v2.png'],
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

for (const component of ['Button','Card','Modal','Room Seat','Shop Card','Avatar','Badge','Toast']) {
  check(`Design System v3 covers ${component}`, design.includes(component));
}
for (const state of ['default','hover','pressed','focus','disabled','loading','error','owned','equipped']) {
  check(`Design System v3 records ${state} state`, design.includes(state));
}
check('Motion System defines all four phases', ['Anticipation','Action','Impact','Settle'].every(phase => motion.includes(phase)));
check('Motion System protects reduced motion, offscreen pause and input', motion.includes('reduced-motion') && motion.includes('离屏') && motion.includes('inputBlocked=false'));
check('Art Bible preserves runtime authority and blocks batch production', bible.includes('规则坐标') && bible.includes('不得批量翻新 48 Avatar'));
check('IP template covers seven similarity dimensions and two reviewers', ['黑色剪影','头饰/服饰组合','道具/武器','徽记/文字','构图','表情与嘴型组合','高潮 Pose','Reviewer A','Reviewer B'].every(label => ipTemplate.includes(label)));

if (failures){
  console.error(`STICKER_ART_CONTRACT_FAILURES=${failures}`);
  process.exit(1);
}
console.log('STICKER_ART_CONTRACT_ALL_PASS');
