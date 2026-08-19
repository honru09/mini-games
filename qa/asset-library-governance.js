#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let failures = 0;
function check(label, condition, detail = '') {
  const ok = Boolean(condition);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures += 1;
}
const contractPath = path.join(ROOT, 'requirements', 'ASSET_LIBRARY_GOVERNANCE.md');
const approvalMatrixPath = path.join(ROOT, 'requirements', 'ART_APPROVAL_MATRIX.md');
check('素材库双层事实源合同存在', fs.existsSync(contractPath));
const contract = fs.existsSync(contractPath) ? fs.readFileSync(contractPath, 'utf8').replace(/^\uFEFF/, '') : '';
for (const token of ['asset-library/catalog.json', 'asset_manifest.json', 'reference-only', 'integrated-local-only', 'remoteObjectKey', 'Golden Set', '回滚']) check(`合同包含 ${token}`, contract.includes(token));
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'asset-library', 'catalog.json'), 'utf8').replace(/^\uFEFF/, ''));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/assets/manifests/asset_manifest.json'), 'utf8').replace(/^\uFEFF/, ''));
check('素材库保持 local-only', catalog.storage.mode === 'local-only' && catalog.storage.remoteProvider === null && catalog.storage.remoteBucket === null);
check('未预填远端对象键', [...(catalog.collections || []), ...(catalog.assets || [])].every(item => item.remoteObjectKey === null));
const runtimeMap = new Map((manifest.assets || []).map(item => [item.asset_id, item]));
check('integrated 素材均有 Manifest 对应', (catalog.assets || []).filter(item => item.status === 'integrated-local-only').every(item => runtimeMap.has(item.id)));
check('reference-only 不进入 Manifest', (catalog.assets || []).filter(item => item.status === 'reference-only').every(item => !runtimeMap.has(item.id)));
const ledger = JSON.parse(fs.readFileSync(path.join(ROOT, 'requirements/PRODUCT_REQUIREMENTS_LEDGER.json'), 'utf8').replace(/^\uFEFF/, ''));
const item = ledger.requirements.find(entry => entry.id === 'TECH-031');
check('TECH-031 已进入 implemented', item && item.status === 'implemented');
check('TECH-031 引用双层合同', item && Array.isArray(item.evidence) && item.evidence.includes('requirements/ASSET_LIBRARY_GOVERNANCE.md'));
check('美术候选审批矩阵以所有者清除开放且保留显式发布命令', fs.existsSync(approvalMatrixPath) &&
  /GATE-ART-GOLDEN-SET=OPEN_BY_OWNER_AUTHORIZATION/.test(fs.readFileSync(approvalMatrixPath, 'utf8')) &&
  /EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED/.test(fs.readFileSync(approvalMatrixPath, 'utf8')));
if (failures) process.exit(1);
console.log(`ASSET_LIBRARY_GOVERNANCE_ALL_PASS catalogAssets=${(catalog.assets || []).length}`);
