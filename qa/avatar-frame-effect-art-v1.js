'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { acquireArtGeneratorLock } = require('../scripts/art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/ui/identity/avatar-frame-effect-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const FAMILY_PATH = path.join(ROOT, 'art-source/platform/identity/avatar-frame-effect-v1/asset-family-manifest-v1.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const LEDGER_PATH = path.join(ROOT, 'art-source/production/ghost-game-art-program-v1/production-ledger-v1.json');
const ASSET_ID = 'P-AVATAR-FRAME-EFFECT-V1';
const SOURCE_ID = 'ART-020-AVATAR-FRAME-EFFECT-V1';
const SIZES = [44, 64, 96, 192];
const MODES = ['static', 'dynamic', 'high-contrast'];
const KINDS = ['frame', 'effect'];
const LOCK_PATH = path.join(ROOT, '.tmp', 'art-generator-locks', 'avatar-frame-effect-v1.lock');
const releaseReadLock = acquireArtGeneratorLock(LOCK_PATH, {
  generatorId:'qa-avatar-frame-effect-art-v1',
  waitMs:120000,
  pollMs:50,
});
process.once('exit', releaseReadLock);

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const manifestFamily = manifest.assets.find(item => item && item.asset_id === ASSET_ID);
const sourceFamily = JSON.parse(fs.readFileSync(FAMILY_PATH, 'utf8'));
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const catalogFamily = catalog.assets.find(item => item && item.id === ASSET_ID);
const ledger = JSON.parse(fs.readFileSync(LEDGER_PATH, 'utf8'));
const assetsSource = fs.readFileSync(path.join(ROOT, 'public/src/core/06-assets.js'), 'utf8');
const identitySource = fs.readFileSync(path.join(ROOT, 'public/src/core/10-identity-presentation.js'), 'utf8');
const rosterSource = fs.readFileSync(path.join(ROOT, 'public/src/ui/07-roster.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8');
const { readPresentationSource } = require('./presentation-source');
const template = readPresentationSource();
const checks = [];

function check(name, condition, detail = ''){
  const ok = !!condition;
  checks.push({name, ok});
  if (!ok) throw new Error('FAIL ' + name + (detail ? ' :: ' + detail : ''));
}

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function normalizeRepoPath(value){
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveRepoFile(value){
  const relative = normalizeRepoPath(value);
  const absolute = path.resolve(ROOT, ...relative.split('/'));
  const insideRoot = absolute === ROOT || absolute.startsWith(ROOT + path.sep);
  return {relative, absolute, insideRoot};
}

function expectedVariantPath(key){
  const match = /^(frame|effect)-([1-8])-(44|64|96|192)-(static|dynamic|high-contrast)$/.exec(key);
  return match ? `public/assets/ui/identity/avatar-frame-effect-v1/${match[1]}s/${key}-v1.webp` : '';
}

function expectedVariantKeys(){
  const keys = [];
  for (const kind of KINDS){
    for (let id = 1; id <= 8; id++){
      for (const size of SIZES){
        for (const mode of MODES) keys.push(`${kind}-${id}-${size}-${mode}`);
      }
    }
  }
  return keys;
}

function familyVariantKey(item){
  const kind = item && item.kind === 'frames' ? 'frame' : item && item.kind === 'effects' ? 'effect' : '';
  return kind && Number.isInteger(item.id) && Number.isInteger(item.size) && typeof item.mode === 'string'
    ? `${kind}-${item.id}-${item.size}-${item.mode}`
    : '';
}

function inspectWebp(buffer){
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP'){
    return {width:0, height:0, alpha:false, valid:false};
  }
  let offset = 12;
  let width = 0;
  let height = 0;
  let alpha = false;
  while (offset + 8 <= buffer.length){
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + length > buffer.length) return {width:0, height:0, alpha:false, valid:false};
    if (type === 'VP8X' && length >= 10){
      alpha = alpha || !!(buffer[data] & 0x10);
      width = (buffer[data + 4] | (buffer[data + 5] << 8) | (buffer[data + 6] << 16)) + 1;
      height = (buffer[data + 7] | (buffer[data + 8] << 8) | (buffer[data + 9] << 16)) + 1;
    } else if (type === 'ALPH'){
      alpha = true;
    } else if (type === 'VP8L' && length >= 5 && buffer[data] === 0x2f){
      const bits = buffer.readUInt32LE(data + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
      alpha = alpha || !!(bits & 0x10000000);
    } else if (type === 'VP8 ' && length >= 10 && !width){
      width = buffer.readUInt16LE(data + 6) & 0x3fff;
      height = buffer.readUInt16LE(data + 8) & 0x3fff;
    }
    offset = data + length + (length & 1);
  }
  return {width, height, alpha, valid:width > 0 && height > 0};
}

function walkRuntimeTree(directory, state = {files:[], symlinks:[]}){
  const directoryStat = fs.lstatSync(directory);
  if (directoryStat.isSymbolicLink()){
    state.symlinks.push(directory);
    return state;
  }
  for (const entry of fs.readdirSync(directory, {withFileTypes:true})){
    const absolute = path.join(directory, entry.name);
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) state.symlinks.push(absolute);
    else if (stat.isDirectory()) walkRuntimeTree(absolute, state);
    else if (stat.isFile()) state.files.push(absolute);
  }
  return state;
}

const expectedKeys = expectedVariantKeys();
const expectedKeySet = new Set(expectedKeys);
const manifestKeys = Object.keys(manifestFamily && manifestFamily.variants || {});
const integrityKeys = Object.keys(manifestFamily && manifestFamily.variant_integrity || {});
const byteKeys = Object.keys(manifestFamily && manifestFamily.variant_bytes || {});
const sourceRuntime = Array.isArray(sourceFamily.runtimeVariants) ? sourceFamily.runtimeVariants : [];
const sourceByKey = new Map();
let duplicateSourceKeys = 0;
for (const item of sourceRuntime){
  const key = familyVariantKey(item);
  if (sourceByKey.has(key)) duplicateSourceKeys++;
  sourceByKey.set(key, item);
}

check('manifest family ready', manifestFamily && manifestFamily.runtime_id === 'identity' && manifestFamily.status === 'ready' && manifestFamily.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE');
check('manifest and source family use the stable ART-020 source ID', manifestFamily && manifestFamily.source_asset_id === SOURCE_ID && sourceFamily.sourceAssetId === SOURCE_ID);
check('all 8 frames and effects', manifestFamily && JSON.stringify(manifestFamily.frames) === '[1,2,3,4,5,6,7,8]' && JSON.stringify(manifestFamily.effects) === '[1,2,3,4,5,6,7,8]' && JSON.stringify(sourceFamily.frames) === '[1,2,3,4,5,6,7,8]' && JSON.stringify(sourceFamily.effects) === '[1,2,3,4,5,6,7,8]');
check('four exact sizes and three exact modes', manifestFamily && JSON.stringify(manifestFamily.runtime_sizes) === JSON.stringify(SIZES) && JSON.stringify(sourceFamily.runtimeSizes) === JSON.stringify(SIZES) && JSON.stringify(manifestFamily.modes) === JSON.stringify(MODES) && JSON.stringify(sourceFamily.modes) === JSON.stringify(MODES));
check('manifest and family flags are isomorphic', manifestFamily && sourceFamily && JSON.stringify(manifestFamily.feature_flags) === JSON.stringify({operator:'all', enabled_value:'1', default_enabled:true, ids:['mg_art_avatar_frame_effect_v1']}) && JSON.stringify(sourceFamily.featureFlags) === JSON.stringify({operator:'all', enabledValue:'1', defaultEnabled:true, ids:['mg_art_avatar_frame_effect_v1']}));

const exactKeys = values => values.length === expectedKeys.length && new Set(values).size === expectedKeys.length && expectedKeys.every(key => values.includes(key));
check('manifest key/hash/byte registries contain exactly 192 variants', exactKeys(manifestKeys) && exactKeys(integrityKeys) && exactKeys(byteKeys));
check('source family contains exactly 192 uniquely keyed variants', sourceRuntime.length === 192 && sourceByKey.size === 192 && duplicateSourceKeys === 0 && expectedKeys.every(key => sourceByKey.has(key)));
check('catalog family is present with exactly 192 unique runtime paths', catalogFamily && catalogFamily.status === 'integrated-local-only' && Array.isArray(catalogFamily.runtimePaths) && catalogFamily.runtimePaths.length === 192 && new Set(catalogFamily.runtimePaths.map(normalizeRepoPath)).size === 192);

let badRegistry = 0;
let totalBytes = 0;
const registeredPaths = [];
const sizeCounts = Object.fromEntries(SIZES.map(size => [size, 0]));
for (const key of expectedKeys){
  const sourceItem = sourceByKey.get(key);
  const manifestPath = normalizeRepoPath(manifestFamily.variants[key]);
  const sourcePath = normalizeRepoPath(sourceItem && sourceItem.path);
  const expectedPath = expectedVariantPath(key);
  const resolved = resolveRepoFile(manifestPath);
  const expectedHash = String(manifestFamily.variant_integrity[key] || '').replace(/^sha256:/i, '').toUpperCase();
  const sourceHash = String(sourceItem && sourceItem.sha256 || '').toUpperCase();
  const expectedBytes = Number(manifestFamily.variant_bytes[key]);
  const sourceBytes = Number(sourceItem && sourceItem.bytes);
  const match = /^(frame|effect)-([1-8])-(44|64|96|192)-(static|dynamic|high-contrast)$/.exec(key);
  const size = Number(match && match[3]);
  registeredPaths.push(manifestPath);
  if (!resolved.insideRoot || manifestPath !== expectedPath || sourcePath !== expectedPath || !fs.existsSync(resolved.absolute)){
    badRegistry++;
    continue;
  }
  const stat = fs.lstatSync(resolved.absolute);
  if (!stat.isFile() || stat.isSymbolicLink()){
    badRegistry++;
    continue;
  }
  const bytes = fs.readFileSync(resolved.absolute);
  const image = inspectWebp(bytes);
  totalBytes += stat.size;
  sizeCounts[size]++;
  if (sha256(bytes) !== expectedHash || expectedHash !== sourceHash || stat.size !== expectedBytes || expectedBytes !== sourceBytes ||
      !image.valid || image.width !== size || image.height !== size || image.alpha !== true ||
      Number(sourceItem.width) !== size || Number(sourceItem.height) !== size || sourceItem.alpha !== true || sourceItem.format !== 'webp' ||
      !expectedKeySet.has(key)) badRegistry++;
}
check('192 real WebP files match SHA-256, bytes, dimensions and Alpha metadata', badRegistry === 0, 'bad=' + badRegistry);
check('all four dimensions contain exactly 48 variants', SIZES.every(size => sizeCounts[size] === 48), JSON.stringify(sizeCounts));

const runtimeTree = walkRuntimeTree(RUNTIME_ROOT);
const actualPaths = runtimeTree.files.map(file => normalizeRepoPath(path.relative(ROOT, file))).sort();
const sortedRegisteredPaths = [...registeredPaths].sort();
check('runtime tree contains no symlink', runtimeTree.symlinks.length === 0, runtimeTree.symlinks.map(file => path.relative(ROOT, file)).join(','));
check('runtime tree has no unregistered or missing file', actualPaths.length === 192 && JSON.stringify(actualPaths) === JSON.stringify(sortedRegisteredPaths));

const catalogPaths = catalogFamily.runtimePaths.map(normalizeRepoPath).sort();
check('Manifest, family and catalog are path-isomorphic', expectedKeys.every(key => normalizeRepoPath(manifestFamily.variants[key]) === normalizeRepoPath(sourceByKey.get(key).path)) && JSON.stringify(catalogPaths) === JSON.stringify(sortedRegisteredPaths));
check('Manifest and family are hash/byte-isomorphic', expectedKeys.every(key => {
  const item = sourceByKey.get(key);
  return String(manifestFamily.variant_integrity[key]).replace(/^sha256:/i, '').toUpperCase() === String(item.sha256).toUpperCase() && Number(manifestFamily.variant_bytes[key]) === Number(item.bytes);
}));
check('runtime byte totals agree with files, Manifest, family and ledger', totalBytes === manifestFamily.actual_bytes && totalBytes <= manifestFamily.byte_budget && totalBytes === sourceFamily.metrics.runtimeBytes && sourceFamily.metrics.runtimeVariantCount === 192 && sourceFamily.metrics.sourceMasterCount === 48);

check('resolver source keeps fail-closed allowlist and ART-020 identity', assetsSource.includes("const AVATAR_FRAME_EFFECT_SOURCE_ID = '" + SOURCE_ID + "'") && /resolveAvatarFrameEffectUrl/.test(assetsSource) && /AVATAR_FRAME_EFFECT_CLEARANCE_RECORD/.test(assetsSource) && /avatarFrameEffectManifestPromise=null;return ''/.test(assetsSource));
check('identity node keeps CSS fallback and loads both atoms', /playerIdentityLoadAtom/.test(identitySource) && /frame-ring/.test(identitySource) && /avatar-frame-art/.test(identitySource) && /avatar-effect-art/.test(identitySource));
check('shop and server expose all eight effects', /id: 8, name: '像素扫描'/.test(rosterSource) && /effects: \{ 1:10,2:12,3:12,4:20,5:20,6:24,7:28,8:32 \}/.test(serverSource));
check('reduced and forced-color presentation styles remain available', /prefers-reduced-motion:reduce/.test(template) && /forced-colors:active/.test(template) && /avatarAtomOrbit/.test(template) && /avatarAtomBreathe/.test(template));
check('asset source and three review files exist', fs.existsSync(path.join(ROOT, 'art-source/platform/identity/avatar-frame-effect-v1/SKILL_ROUTING.md')) && sourceFamily.reviewBoards.length === 3 && sourceFamily.reviewBoards.every(item => fs.existsSync(path.join(ROOT, item.path))) && fs.existsSync(path.join(ROOT, 'art-source/platform/identity/avatar-frame-effect-v1/review/avatar-frame-effect-small-runtime-review-v1.png')));

const unit = ledger.units.find(item => item && item.id === 'P0-11');
check('production ledger matches the real P0-11 output', unit && unit.status === 'implemented_owner_cleared_release_evidence_pending' && unit.familyId === ASSET_ID && unit.deliverables.runtimeVariants === 192 && unit.deliverables.sourceMasters === 48 && unit.deliverables.reviewBoards === 3 && unit.deliverables.runtimeBytes === totalBytes);
check('runtime VM contract is part of the npm art test', fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8').includes('qa/avatar-frame-effect-runtime.js'));

const digest = sha256(Buffer.from(JSON.stringify(manifestFamily))).slice(0, 16);
releaseReadLock();
console.log('AVATAR_FRAME_EFFECT_ART_V1_PASS', JSON.stringify({checks:checks.length, assetShaPrefix:digest, variants:expectedKeys.length, bytes:totalBytes, sizeCounts}));
