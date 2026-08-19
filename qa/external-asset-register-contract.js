'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const file = path.join(root, 'asset-library', 'external-source-register-20260813.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
let failures = 0;
function check(name, value) { console.log((value ? 'PASS' : 'FAIL') + '  ' + name); if (!value) failures++; }
check('register schema version', data.schemaVersion === 1);
check('reference-only default', data.status === 'reference-only' && data.storage.mode === 'local-reference-path-only');
check('controlled Skill reference lane', data.skillReferencePolicy?.status === 'OWNER_AUTHORIZED_CONTROLLED_REFERENCE_INPUT' &&
  Array.isArray(data.skillReferencePolicy?.requiredProvenance) &&
  data.skillReferencePolicy.requiredProvenance.includes('sourceSha256') &&
  /SOURCE_ONLY_EXTERNAL_INFLUENCED/.test(data.skillReferencePolicy.outputDisposition));
check('no repository copy or remote object', data.storage.copiedIntoRepository === false && data.storage.decompressedIntoRepository === false && data.storage.remoteObjectKey === null);
check('two source roots', Array.isArray(data.sourceRoots) && data.sourceRoots.length === 2);
check('character inventory', data.sourceRoots[0].inventory.zipFiles === 64 && data.sourceRoots[0].inventory.pngFramesInsideZip === 44145);
check('ui inventory', data.sourceRoots[1].inventory.files === 708 && data.sourceRoots[1].inventory.extensions['.psd'] === 263 && data.sourceRoots[1].inventory.extensions['.ai'] === 91);
check('license remains unverified', data.sourceRoots.every(item => /未建立|不证明|核验|授权/.test(item.licenseObservation)));
check('PSD/AI/EPS structure and semantic limits explicit',
  data.inspectionLimits.some(item => item.includes('3819/3819')) &&
  data.inspectionLimits.some(item => item.includes('Illustrator 私有语义')) &&
  data.inspectionLimits.some(item => item.includes('SHA-256')));
check('runtime prohibition explicit', data.selectiveUsePlan.forbiddenNow.some(item => item.includes('public/assets')) && data.selectiveUsePlan.forbiddenNow.some(item => item.includes('Manifest')));
const previewAudit = JSON.parse(fs.readFileSync(path.join(root, 'requirements', 'active', 'external-assets-audit-p1-20260813', 'evidence', 'external-preview-license-audit.json'), 'utf8'));
const hashAudit = JSON.parse(fs.readFileSync(path.join(root, 'requirements', 'active', 'external-assets-audit-p1-20260813', 'evidence', 'external-file-content-hashes.json'), 'utf8'));
const layeredAudit = JSON.parse(fs.readFileSync(path.join(root, 'requirements', 'active', 'external-assets-audit-p1-20260813', 'evidence', 'external-layered-source-structure-audit-20260814.json'), 'utf8'));
const secondaryPsdAudit = JSON.parse(fs.readFileSync(path.join(root, 'requirements', 'active', 'external-assets-audit-p1-20260813', 'evidence', 'external-psd-secondary-parser-verification-20260814.json'), 'utf8'));
check('all rendered previews audited', previewAudit.rolePreviewCount === 64 && previewAudit.uiPreviewCount === 354 && previewAudit.contactSheets.length === 7);
check('license text evidence audited without auto approval', previewAudit.licenseLikeTextPackages === 64 && previewAudit.licenseFiles === 256 && previewAudit.limits.some(item => item.includes('not an automatic commercial-use decision')));
check('all external files content-hashed', hashAudit.fileCount === 836 && hashAudit.totalBytes === 18567721249 && hashAudit.aggregateSha256 === 'a7151ed3c6b32fd1306962accd42f8f838a8e5b8d1ea54f4fc4a56397842298f');
check('all layered/vector sources structurally parsed without extraction',
  layeredAudit.mode === 'READ_ONLY_NO_EXTRACTION' &&
  layeredAudit.scope.expectedLayeredOrVectorFiles === 3819 &&
  layeredAudit.completion.parsedOrRecorded === 3819 && layeredAudit.completion.failed === 0 &&
  layeredAudit.psd.summary.files === 288 && layeredAudit.psd.summary.layers === 35107 &&
  layeredAudit.vector.extensionCounts['.ai'] === 361 && layeredAudit.vector.extensionCounts['.eps'] === 3170 &&
  layeredAudit.vector.containerCounts['binary-eps-wrapper'] === 1153 &&
  layeredAudit.vector.containerCounts.unknown === undefined);
check('secondary PSD parser independently confirms all hierarchy counts',
  secondaryPsdAudit.mode === 'READ_ONLY_SECONDARY_PARSER_NO_RENDER_NO_EXTRACTION' &&
  secondaryPsdAudit.directUiPsd.documents === 263 && secondaryPsdAudit.directUiPsd.parseErrors === 0 &&
  secondaryPsdAudit.zipEmbeddedPsd.documents === 25 && secondaryPsdAudit.zipEmbeddedPsd.parseErrors === 0 &&
  secondaryPsdAudit.crossCheck.hierarchyNodes + secondaryPsdAudit.crossCheck.groupOrArtboardNodes ===
    secondaryPsdAudit.crossCheck.rawLayerRecordsFromPrimaryParser);
check('rollback explicit', typeof data.rollback === 'string' && data.rollback.length > 20);
if (failures) process.exit(1);
console.log('EXTERNAL_ASSET_REGISTER_ALL_PASS');
