'use strict';

/*
 * Governance-only regression. It never promotes an asset itself; it verifies
 * that source-only and owner-cleared runtime states cannot be mixed.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8').replace(/^\uFEFF/, '');
const matrix = read('requirements/ART_APPROVAL_MATRIX.md');
const catalog = JSON.parse(read('asset-library/catalog.json'));
const manifest = JSON.parse(read('public/assets/manifests/asset_manifest.json'));
const routing = JSON.parse(read('requirements/MAINLINE_CONTROL_ROUTING.json'));
const external = JSON.parse(read('asset-library/external-source-register-20260813.json'));
const originalInventory = JSON.parse(read('requirements/active/art-approval-matrix-p1-20260814/evidence/original-14-family-complete-visual-inventory-20260814.json'));
const emojiClearancePath = 'requirements/active/honru-emoji-runtime-p0-20260811/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const emojiRuntimePath = path.join(ROOT, 'public', 'assets', 'brand', 'honru', 'emoji-v1');

let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}

check('统一审批矩阵存在所有者原创清除状态',
  ['LEGACY_FALLBACK', 'SOURCE_ONLY_CANDIDATE', 'DEFAULT_OFF_TECHNICAL_PREVIEW', 'OWNER_AUTHORIZED_ART_CLEARANCE', 'EXTERNAL_REFERENCE_ONLY']
    .every(token => matrix.includes(token)));
check('矩阵明确技术状态不自行构成所有者清除或虚构人工法律结论',
  /TECHNICAL_PASS.*不等价于 `OWNER_AUTHORIZED_ART_CLEARANCE`[\s\S]*IP\/法律意见或 Golden Set 已完成/i.test(matrix));
check('矩阵把人工/IP/Golden Set 固定为可选风险咨询',
  /人工清稿、独立自然人 Reviewer B、IP\/法律意见和逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`/.test(matrix));

const byId = new Map(catalog.assets.map(asset => [asset.id, asset]));
for (const id of [
  'BRAND-HONRU-CHARACTER-MASTER-V2-DRAFT',
  'G-12-TANK-ART-P1-CLEAN',
  'G-13-TANK-ART-P1-REJECTED',
  'G-14-PLAYER-CHARACTER-ART-036',
  'G-15-MONOPOLY-ART-036',
  'ART-026-GCOINS-SOURCE-CHROMA-V1',
  'ART-026-GCOINS-P1-CANDIDATE-B',
  'G-17-HONRU-EMOJI-WAVE-V1',
  'G-27-HONRU-EMOJI-PACKET-V1'
]) check(`Catalog 保留 ${id} 为 reference-only`, byId.get(id)?.status === 'reference-only');

check('矩阵覆盖 Honru、Emoji、G Coins、Tank、ART-036、M0 与外部素材',
  ['Honru v2', 'Honru Emoji', 'G Coins', 'Tank', 'Player Character', 'Monopoly', 'M0 Teacher', '外部 RPG / Q 版 UI']
    .every(token => matrix.includes(token)));
check('矩阵显式保留 Pixel Avatar 的 Prompt 不可恢复事实', matrix.includes('精确 Prompt `NOT_RECOVERED`'));
const pixelApproval = read('art-source/platform/avatars/v3-honru-pixel-p0-20260811/APPROVAL_STATUS.md');
const pixelProvenance = read('art-source/platform/avatars/v3-honru-pixel-p0-20260811/PROMPT_AND_PROVENANCE.md');
check('Pixel Avatar 审批状态不再冒充从 session 恢复精确 Prompt',
  pixelApproval.includes('精确生成 Prompt') && pixelApproval.includes('`NOT_RECOVERED`') &&
  !/Prompt\s*\/\s*provenance[^\n]*verified[^\n]*session/i.test(pixelApproval) &&
  pixelProvenance.includes('Exact generation prompts: NOT_RECOVERED.'));
const cleanupDecision = read('art-source/brand/ghost-game/honru/cleanup-candidate-v1/GOLDEN_SET_DECISION_PENDING.md');
const cleanupAudit = JSON.parse(read('requirements/active/production-readiness-sprint-p0-20260809/evidence/honru-cleanup-candidate-v1-audit.json'));
check('Honru cleanup Reviewer A 决议与机器 TECHNICAL_PASS 同步',
  cleanupAudit.status === 'TECHNICAL_PASS' &&
  /Reviewer A 技术审查[^\n]*`TECHNICAL_PASS`/.test(cleanupDecision) &&
  !/Reviewer A 技术审查[^\n]*等待机器审计结果/.test(cleanupDecision));
check('拒绝版 Tank 永久隔离', /G-13-TANK-ART-P1-REJECTED[\s\S]*永久隔离/.test(matrix));
const emojiRuntimeEntry = (manifest.assets || []).find(asset => asset && asset.asset_id === 'P-HONRU-EMOJI-V1') || null;
const emojiRuntimeFiles = fs.existsSync(emojiRuntimePath)
  ? fs.readdirSync(emojiRuntimePath, { withFileTypes: true }).filter(entry => entry.isFile()).map(entry => entry.name).sort()
  : [];
const emojiClearanceExists = fs.existsSync(path.join(ROOT, emojiClearancePath));
const emojiRuntimeMode = Boolean(emojiRuntimeEntry || emojiClearanceExists || emojiRuntimeFiles.length);
const emojiMatrixRow = (matrix.match(/^\| Honru Emoji[^\n]*$/m) || [''])[0];
if (!emojiRuntimeMode) {
  check('Emoji source-only 状态没有 Manifest、public runtime 或 clearance 混入',
    !emojiRuntimeEntry && !emojiClearanceExists && emojiRuntimeFiles.length === 0 &&
    emojiMatrixRow.includes('SOURCE_ONLY_CANDIDATE'));
} else {
  check('Emoji runtime 状态同时具备所有者清除、Manifest、两份派生与矩阵提升',
    emojiClearanceExists && emojiRuntimeEntry &&
    JSON.stringify(emojiRuntimeFiles) === JSON.stringify(['honru-emoji-atlas-v1.webp', 'honru-emoji-poster-v1.webp']) &&
    emojiMatrixRow.includes('OWNER_AUTHORIZED_ART_CLEARANCE') &&
    !emojiMatrixRow.includes('SOURCE_ONLY_CANDIDATE'));
  check('Emoji runtime Manifest 保留严格回退、预算和可逆 default-on flags',
    emojiRuntimeEntry && emojiRuntimeEntry.fallback === 'per-id Unicode glyph, then localized readable text' &&
    Number.isInteger(emojiRuntimeEntry.actual_bytes) && Number.isInteger(emojiRuntimeEntry.byte_budget) &&
    emojiRuntimeEntry.actual_bytes > 0 && emojiRuntimeEntry.actual_bytes <= emojiRuntimeEntry.byte_budget &&
    emojiRuntimeEntry.feature_flags?.default_enabled === true &&
    JSON.stringify(emojiRuntimeEntry.feature_flags?.ids) === JSON.stringify(['mg_art_honru_emoji_v1', 'mg_art_honru_emoji_throw_v1']));
}
check('生产 Manifest 不引用 art-source', !(manifest.assets || []).some(asset => JSON.stringify(asset).includes('art-source/brand/ghost-game/honru/emoji-v1')));
check('reference-only Catalog 不进入 Manifest', (catalog.assets || []).filter(asset => asset.status === 'reference-only')
  .every(asset => !(manifest.assets || []).some(runtime => runtime.asset_id === asset.id)));
check('外部素材登记仍为 reference-only 且禁止运行时接入',
  external.status === 'reference-only' && external.storage?.copiedIntoRepository === false &&
  external.storage?.decompressedIntoRepository === false && /不得直接复制到 public\/assets/.test(external.runtimePolicy || ''));
check('共享 Art Gate 已按所有者授权开放且发布命令仍独立',
  routing.sharedGates?.['GATE-ART-GOLDEN-SET']?.status === 'OPEN_BY_OWNER_AUTHORIZATION' &&
  routing.sharedGates?.['GATE-ART-GOLDEN-SET']?.developmentStatus === 'OPEN' &&
  routing.sharedGates?.['GATE-ART-GOLDEN-SET']?.releaseStatus === 'EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED');
check('矩阵明确禁止伪造人工/IP/Golden Set PASS',
  matrix.includes('不声称人工清稿、Reviewer B、IP/法律或 Golden Set 已 PASS') &&
  matrix.includes('不把未执行的咨询写成 PASS'));
check('原创所有者清除合同完整且不自动批准现有候选',
  /OWNER_AUTHORIZED_ART_CLEARANCE[\s\S]*M0 North Star[\s\S]*稳定 ID、版本、源 SHA-256[\s\S]*fallback[\s\S]*一键回滚/.test(matrix) &&
  matrix.includes('不把任何当前候选自动升级到该状态'));
check('外部素材受控 reference lane 与运行时隔离',
  /G-13-TANK-ART-P1-REJECTED[\s\S]*永远不在此例外/.test(matrix) &&
  /EXTERNAL_REFERENCE_ONLY[\s\S]*(?:受控全信息 reference lane|仅记录|只保留)/.test(matrix) &&
  (/(?:逐输入记录|逐输入留存|provenance)/.test(matrix) || /不进入任何 Skill 输入/.test(matrix)) &&
  /源像素\/图层直接复制[\s\S]*不得/.test(matrix));
check('原创 14 族完整性与全部图像接触表已冻结',
  originalInventory.totals?.families === 14 && originalInventory.totals?.files === 247 &&
  originalInventory.totals?.visualFiles === 214 && originalInventory.totals?.rasterRendered === 212 &&
  originalInventory.totals?.textFilesRead === 33 && originalInventory.totals?.markdownDocumentsRead === 32 &&
  originalInventory.totals?.htmlFilesRead === 1 &&
  originalInventory.families?.every(family => fs.existsSync(path.join(ROOT, family.contactSheet)) &&
    family.files?.length === family.fileCount && family.files.every(record => /^[a-f0-9]{64}$/.test(record.sha256)) &&
    family.records?.every(record => /^[a-f0-9]{64}$/.test(record.sha256))));

if (failures) {
  console.error(`ART_APPROVAL_MATRIX_CONTRACT_FAILED: ${failures}`);
  process.exit(1);
}
console.log(`ART_APPROVAL_MATRIX_CONTRACT_ALL_PASS catalogAssets=${catalog.assets.length}`);
