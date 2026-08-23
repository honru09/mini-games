'use strict';

// P0-12 deterministic asset contract. This verifies files and registries only;
// it is not a human art review or real-browser/device visible evidence.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { acquireArtGeneratorLock } = require('../scripts/art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_PATH = 'art-source/platform/game-icons/cartoon-v2/asset-family-manifest-v2.json';
const MANIFEST_PATH = 'public/assets/manifests/asset_manifest.json';
const CATALOG_PATH = 'asset-library/catalog.json';
const RUNTIME_ROOT = 'public/assets/ui/game-icons/v2';
const SOURCE_ROOT = 'art-source/platform/game-icons/cartoon-v2/source';
const LOCK_PATH = path.join(ROOT, '.tmp', 'art-generator-locks', 'game-icon-system-v2.lock');
const ASSET_ID = 'P-GAME-ICON-SYSTEM-V2';
const SOURCE_ID = 'ART-027-GAME-ICON-SYSTEM-V2';
const FLAG = 'mg_art_game_icon_system_v2';
const GAMES = ['gomoku', 'ludo', 'monopoly', 'tank', 'tetris', 'xiangqi'];
const GAME_ROLES = ['icon', 'cover-crop', 'theme-icon', 'selected-object'];
const ICON_SIZES = [44, 64, 96];
const MARKERS = ['ai', 'solo', 'online', 'multiplayer', 'card', 'ready', 'waiting', 'live', 'ranking', 'room', 'locked', 'error'];
const MARKER_SIZES = [24, 32, 44];

const releaseLock = acquireArtGeneratorLock(LOCK_PATH, {
  generatorId: 'qa-game-icon-system-v2',
  waitMs: 120000,
  pollMs: 50,
});
process.once('exit', releaseLock);

const readBuffer = relative => fs.readFileSync(path.join(ROOT, relative));
const readText = relative => readBuffer(relative).toString('utf8');
const readJson = relative => JSON.parse(readText(relative));
const family = readJson(FAMILY_PATH);
const manifest = readJson(MANIFEST_PATH);
const catalog = readJson(CATALOG_PATH);
const manifestFamily = manifest.assets.find(item => item && item.asset_id === ASSET_ID);
const catalogFamily = catalog.assets.find(item => item && item.id === ASSET_ID);
const { readPresentationSource } = require('./presentation-source');
const template = readPresentationSource();
const rosterSource = readText('public/src/ui/07-roster.js');
const assetsSource = readText('public/src/core/06-assets.js');
const mascotSource = readText('public/src/core/26-ghost-mascot-motion.js');
const websocketSource = readText('public/src/online/03-websocket.js');
const onlineSource = readText('public/src/online/03-websocket.js');
const checks = [];

function check(name, condition, detail = ''){
  const ok = !!condition;
  checks.push({name, ok});
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (ok || !detail ? '' : ' :: ' + detail));
}

function normalizeRepoPath(value){
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}

function resolveRepoPath(value){
  const relative = normalizeRepoPath(value);
  const absolute = path.resolve(ROOT, ...relative.split('/'));
  return {
    relative,
    absolute,
    insideRoot: absolute === ROOT || absolute.startsWith(ROOT + path.sep),
  };
}

function sha256(buffer){
  return crypto.createHash('sha256').update(buffer).digest('hex').toUpperCase();
}

function inspectWebp(buffer){
  if (!Buffer.isBuffer(buffer) || buffer.length < 20 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP'){
    return {valid:false, width:0, height:0, alpha:false};
  }
  let offset = 12;
  let width = 0;
  let height = 0;
  let alpha = false;
  while (offset + 8 <= buffer.length){
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + length > buffer.length) return {valid:false, width:0, height:0, alpha:false};
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
  return {valid:width > 0 && height > 0, width, height, alpha};
}

function inspectPng(buffer){
  const signature = '89504e470d0a1a0a';
  if (!Buffer.isBuffer(buffer) || buffer.length < 33 || buffer.subarray(0, 8).toString('hex') !== signature || buffer.toString('ascii', 12, 16) !== 'IHDR'){
    return {valid:false, width:0, height:0, alpha:false};
  }
  const colorType = buffer[25];
  return {
    valid:true,
    width:buffer.readUInt32BE(16),
    height:buffer.readUInt32BE(20),
    alpha:colorType === 4 || colorType === 6,
  };
}

function inspectSvg(buffer){
  const source = buffer.toString('utf8');
  const root = /<svg\b([^>]*)>/i.exec(source);
  const attributes = root && root[1] || '';
  const width = Number((/\bwidth=["'](\d+)["']/i.exec(attributes) || [])[1]);
  const height = Number((/\bheight=["'](\d+)["']/i.exec(attributes) || [])[1]);
  const viewBox = (/\bviewBox=["']([^"']+)["']/i.exec(attributes) || [])[1] || '';
  return {
    valid:!!root && width > 0 && height > 0 && viewBox === `0 0 ${width} ${height}`,
    width,
    height,
    source,
  };
}

function walkTree(relativeRoot){
  const root = path.join(ROOT, relativeRoot);
  const state = {files:[], symlinks:[]};
  function walk(absolute){
    const baseStat = fs.lstatSync(absolute);
    if (baseStat.isSymbolicLink()){
      state.symlinks.push(normalizeRepoPath(path.relative(ROOT, absolute)));
      return;
    }
    for (const entry of fs.readdirSync(absolute, {withFileTypes:true})){
      const child = path.join(absolute, entry.name);
      const stat = fs.lstatSync(child);
      const relative = normalizeRepoPath(path.relative(ROOT, child));
      if (stat.isSymbolicLink()) state.symlinks.push(relative);
      else if (stat.isDirectory()) walk(child);
      else if (stat.isFile()) state.files.push(relative);
    }
  }
  walk(root);
  state.files.sort();
  state.symlinks.sort();
  return state;
}

function gameSourceSpec(gameId, role){
  const dimensions = role === 'cover-crop' ? [640, 360] : [512, 512];
  return {
    key:`source-game-${gameId}-${role}`,
    path:`${SOURCE_ROOT}/games/${gameId}/${role}-v2.svg`,
    width:dimensions[0],
    height:dimensions[1],
    kind:'game',
    gameId,
    role,
  };
}

function gameRuntimeSpecs(gameId){
  const specs = ICON_SIZES.map(size => ({
    key:`game-${gameId}-icon-${size}`,
    path:`${RUNTIME_ROOT}/games/${gameId}/icon-${size}-v2.webp`,
    width:size,
    height:size,
    kind:'game',
    gameId,
    gameRole:'icon',
    size,
    edgePolicy:'transparent-gutter',
  }));
  specs.push(
    {key:`game-${gameId}-theme-icon-64`, path:`${RUNTIME_ROOT}/games/${gameId}/theme-icon-64-v2.webp`, width:64, height:64, kind:'game', gameId, gameRole:'theme-icon', size:64, edgePolicy:'transparent-gutter'},
    {key:`game-${gameId}-selected-object-96`, path:`${RUNTIME_ROOT}/games/${gameId}/selected-object-96-v2.webp`, width:96, height:96, kind:'game', gameId, gameRole:'selected-object', size:96, edgePolicy:'transparent-gutter'},
    {key:`game-${gameId}-cover-crop-320x180`, path:`${RUNTIME_ROOT}/games/${gameId}/cover-crop-320x180-v2.webp`, width:320, height:180, kind:'game', gameId, gameRole:'cover-crop', size:'320x180', edgePolicy:'opaque-edge-intentional'},
  );
  return specs;
}

function markerRuntimeSpecs(markerId){
  return MARKER_SIZES.map(size => ({
    key:`marker-${markerId}-${size}`,
    path:`${RUNTIME_ROOT}/markers/${markerId}-${size}-v2.webp`,
    width:size,
    height:size,
    kind:'marker',
    markerId,
    size,
    edgePolicy:'transparent-gutter',
  }));
}

const sourceSpecs = [
  ...GAMES.flatMap(gameId => GAME_ROLES.map(role => gameSourceSpec(gameId, role))),
  ...MARKERS.map(markerId => ({
    key:`source-marker-${markerId}`,
    path:`${SOURCE_ROOT}/markers/${markerId}-v2.svg`,
    width:256,
    height:256,
    kind:'marker',
    markerId,
    role:'marker',
  })),
];
const runtimeSpecs = [
  ...GAMES.flatMap(gameRuntimeSpecs),
  ...MARKERS.flatMap(markerRuntimeSpecs),
];
const runtimeByPath = new Map((family.runtimeVariants || []).map(item => [normalizeRepoPath(item.path), item]));
const sourceByPath = new Map((family.sourceMasters || []).map(item => [normalizeRepoPath(item.path), item]));

check('family identity and owner clearance are exact', family.schemaVersion === 1 && family.productionUnitId === 'P0-12' && family.familyId === ASSET_ID && family.sourceAssetId === SOURCE_ID && family.artworkVersion === 2 && family.status === 'OWNER_AUTHORIZED_ART_CLEARANCE' && family.license === 'project-owned-deterministic-vector');
check('family enumerates the exact game, role, size and marker sets', JSON.stringify(family.gameIds) === JSON.stringify(GAMES) && JSON.stringify(family.gameRoles) === JSON.stringify(GAME_ROLES) && JSON.stringify(family.iconSizes) === JSON.stringify(ICON_SIZES) && JSON.stringify(family.markerIds) === JSON.stringify(MARKERS) && JSON.stringify(family.markerSizes) === JSON.stringify(MARKER_SIZES));
check('family uses the one exact default-on rollback flag', JSON.stringify(family.featureFlags) === JSON.stringify({operator:'all', enabledValue:'1', defaultEnabled:true, ids:[FLAG]}));
check('family documents presentation-only authority and semantic fallbacks', /do not derive or mutate/i.test(family.authorityBoundary || '') && /v2 icon.*Emoji/i.test(family.fallback && family.fallback.icon || '') && /Lucide\/CSS\/text/i.test(family.fallback && family.fallback.marker || '') && /reduced motion/i.test(family.motionBoundary || '') && /forced-colors/i.test(family.motionBoundary || ''));

check('source family contains exactly 36 unique SVG masters', Array.isArray(family.sourceMasters) && family.sourceMasters.length === 36 && sourceByPath.size === 36 && sourceSpecs.length === 36);
let sourceFailures = 0;
for (const spec of sourceSpecs){
  const item = sourceByPath.get(spec.path);
  const resolved = resolveRepoPath(spec.path);
  if (!item || !resolved.insideRoot || !fs.existsSync(resolved.absolute)){
    sourceFailures++;
    continue;
  }
  const buffer = fs.readFileSync(resolved.absolute);
  const svg = inspectSvg(buffer);
  const noExecutableOrBakedText = !/<(?:script|foreignObject|image|text)\b/i.test(svg.source) && !/\b(?:href|xlink:href)\s*=/i.test(svg.source);
  const exactMetadata = item.path === spec.path && item.sha256 === sha256(buffer) && item.bytes === buffer.length && item.width === spec.width && item.height === spec.height && item.format === 'svg' && item.alpha === true && item.kind === spec.kind && item.role === spec.role && item.bakedText === false && (spec.gameId ? item.gameId === spec.gameId : item.markerId === spec.markerId);
  if (!svg.valid || svg.width !== spec.width || svg.height !== spec.height || !noExecutableOrBakedText || !exactMetadata) sourceFailures++;
}
check('all SVG masters match path/SHA/bytes/dimensions/alpha metadata and contain no baked text or external payload', sourceFailures === 0, `${sourceFailures} source mismatch(es)`);
const sourceTree = walkTree(SOURCE_ROOT);
check('source tree has no symlink or unregistered source file', sourceTree.symlinks.length === 0 && JSON.stringify(sourceTree.files) === JSON.stringify(sourceSpecs.map(item => item.path).sort()), JSON.stringify(sourceTree));

check('runtime family contains exactly 72 unique variants', Array.isArray(family.runtimeVariants) && family.runtimeVariants.length === 72 && runtimeByPath.size === 72 && runtimeSpecs.length === 72);
let runtimeFailures = 0;
let runtimeBytes = 0;
const dimensionCounts = {};
let transparentGutterCount = 0;
let transparentGutterFailures = 0;
let intentionalOpaqueEdgeCount = 0;
for (const spec of runtimeSpecs){
  const item = runtimeByPath.get(spec.path);
  const resolved = resolveRepoPath(spec.path);
  if (!item || !resolved.insideRoot || !fs.existsSync(resolved.absolute)){
    runtimeFailures++;
    continue;
  }
  const buffer = fs.readFileSync(resolved.absolute);
  const webp = inspectWebp(buffer);
  runtimeBytes += buffer.length;
  const dimensionKey = `${spec.width}x${spec.height}`;
  dimensionCounts[dimensionKey] = (dimensionCounts[dimensionKey] || 0) + 1;
  const exactRoleMetadata = spec.gameId ? item.gameRole === spec.gameRole : !Object.prototype.hasOwnProperty.call(item, 'gameRole');
  const exactMetadata = item.path === spec.path && item.sha256 === sha256(buffer) && item.bytes === buffer.length && item.width === spec.width && item.height === spec.height && item.format === 'webp' && item.alpha === true && item.role === 'runtime-variant' && item.bakedText === false && item.kind === spec.kind && exactRoleMetadata && item.size === spec.size && item.edgePolicy === spec.edgePolicy && Number.isInteger(item.edgeAlphaPixels) && Number.isInteger(item.edgeAlphaMax) && (spec.edgePolicy !== 'transparent-gutter' || (item.edgeAlphaPixels === 0 && item.edgeAlphaMax === 0)) && (spec.gameId ? item.gameId === spec.gameId : item.markerId === spec.markerId);
  if(spec.edgePolicy === 'transparent-gutter'){
    transparentGutterCount++;
    if(item.edgeAlphaPixels !== 0 || item.edgeAlphaMax !== 0)transparentGutterFailures++;
  }else if(spec.edgePolicy === 'opaque-edge-intentional')intentionalOpaqueEdgeCount++;
  if (!webp.valid || webp.width !== spec.width || webp.height !== spec.height || !webp.alpha || !exactMetadata) runtimeFailures++;
}
check('all WebP variants match path/SHA/bytes/dimensions/Alpha and semantic metadata', runtimeFailures === 0, `${runtimeFailures} runtime mismatch(es)`);
check('all 66 transparent atoms have a zero-Alpha outer gutter; six cover edges are intentional', transparentGutterCount === 66 && transparentGutterFailures === 0 && intentionalOpaqueEdgeCount === 6, JSON.stringify({transparentGutterCount,transparentGutterFailures,intentionalOpaqueEdgeCount}));
const runtimeTree = walkTree(RUNTIME_ROOT);
check('runtime tree has exactly the registered 72 WebP files and no symlink', runtimeTree.symlinks.length === 0 && JSON.stringify(runtimeTree.files) === JSON.stringify(runtimeSpecs.map(item => item.path).sort()), JSON.stringify(runtimeTree));
check('runtime dimensions have the exact production distribution', JSON.stringify(dimensionCounts) === JSON.stringify({'44x44':18,'64x64':12,'96x96':12,'320x180':6,'24x24':12,'32x32':12}), JSON.stringify(dimensionCounts));
check('runtime byte total agrees with family metrics and stays below 1 MiB', runtimeBytes === 142914 && family.metrics && family.metrics.runtimeBytes === runtimeBytes && family.metrics.runtimeVariantCount === 72 && family.metrics.sourceMasterCount === 36 && family.metrics.reviewBoardCount === 4 && family.metrics.runtimeByteBudget === 1048576 && family.metrics.withinBudget === true && runtimeBytes <= family.metrics.runtimeByteBudget, String(runtimeBytes));

const expectedVariantKeys = runtimeSpecs.map(item => item.key);
const exactKeyRegistry = registry => registry && typeof registry === 'object' && !Array.isArray(registry) && Object.keys(registry).length === 72 && expectedVariantKeys.every(key => Object.prototype.hasOwnProperty.call(registry, key));
check('runtime Manifest keeps exact identity, clearance, flag and enumerations', manifestFamily && manifestFamily.runtime_id === 'game-icon-system' && manifestFamily.artwork_version === 2 && manifestFamily.status === 'ready' && manifestFamily.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && manifestFamily.source_asset_id === SOURCE_ID && manifestFamily.clearance_record === 'art-source/platform/game-icons/cartoon-v2/OWNER_AUTHORIZED_ART_CLEARANCE.md' && JSON.stringify(manifestFamily.feature_flags) === JSON.stringify({operator:'all', enabled_value:'1', default_enabled:true, ids:[FLAG]}) && JSON.stringify(manifestFamily.game_ids) === JSON.stringify(GAMES) && JSON.stringify(manifestFamily.game_roles) === JSON.stringify(GAME_ROLES) && JSON.stringify(manifestFamily.icon_sizes) === JSON.stringify(ICON_SIZES) && JSON.stringify(manifestFamily.marker_ids) === JSON.stringify(MARKERS) && JSON.stringify(manifestFamily.marker_sizes) === JSON.stringify(MARKER_SIZES));
check('Manifest variant, integrity and byte registries contain exactly 72 keys', exactKeyRegistry(manifestFamily && manifestFamily.variants) && exactKeyRegistry(manifestFamily && manifestFamily.variant_integrity) && exactKeyRegistry(manifestFamily && manifestFamily.variant_bytes));
let registryFailures = 0;
for (const spec of runtimeSpecs){
  const item = runtimeByPath.get(spec.path);
  const expectedHash = String(item && item.sha256 || '').toLowerCase();
  if (normalizeRepoPath(manifestFamily && manifestFamily.variants && manifestFamily.variants[spec.key]) !== spec.path || String(manifestFamily && manifestFamily.variant_integrity && manifestFamily.variant_integrity[spec.key] || '').toLowerCase() !== `sha256:${expectedHash}` || Number(manifestFamily && manifestFamily.variant_bytes && manifestFamily.variant_bytes[spec.key]) !== Number(item && item.bytes)) registryFailures++;
}
check('every Manifest key maps to its own exact path/hash/byte record (no valid-looking swaps)', registryFailures === 0, `${registryFailures} registry mismatch(es)`);
check('Manifest totals and primary runtime path match actual files', manifestFamily && manifestFamily.runtime_path === `${RUNTIME_ROOT}/games/gomoku/icon-64-v2.webp` && manifestFamily.actual_bytes === runtimeBytes && manifestFamily.byte_budget === 1048576);

const catalogPaths = catalogFamily && Array.isArray(catalogFamily.runtimePaths) ? catalogFamily.runtimePaths.map(normalizeRepoPath) : [];
const expectedRuntimePaths = runtimeSpecs.map(item => item.path);
const firstSource = sourceByPath.get(`${SOURCE_ROOT}/games/gomoku/icon-v2.svg`);
check('Catalog entry retains local-only project-owned provenance', catalogFamily && catalogFamily.category === 'platform/game-icons' && catalogFamily.assetType === 'cartoon-icon-v2-owner-cleared' && catalogFamily.sourceType === 'project-owned' && catalogFamily.status === 'integrated-local-only' && catalogFamily.license === family.license && catalogFamily.remoteObjectKey === null && catalogFamily.sourcePath === `${SOURCE_ROOT}/games/gomoku/icon-v2.svg` && String(catalogFamily.sourceSha256).toUpperCase() === firstSource.sha256);
check('Catalog, Manifest and family are path-isomorphic across all 72 variants', catalogPaths.length === 72 && new Set(catalogPaths).size === 72 && JSON.stringify(catalogPaths) === JSON.stringify(expectedRuntimePaths) && runtimeSpecs.every(spec => normalizeRepoPath(manifestFamily.variants[spec.key]) === spec.path && runtimeByPath.has(spec.path)));

let reviewFailures = 0;
for (const item of family.reviewBoards || []){
  const resolved = resolveRepoPath(item.path);
  if (!resolved.insideRoot || !fs.existsSync(resolved.absolute)){
    reviewFailures++;
    continue;
  }
  const buffer = fs.readFileSync(resolved.absolute);
  const png = inspectPng(buffer);
  if (sha256(buffer) !== item.sha256 || buffer.length !== item.bytes || !png.valid || png.width !== item.width || png.height !== item.height || png.alpha !== item.alpha || item.format !== 'png') reviewFailures++;
}
check('all four generated review boards match SHA/bytes/dimensions/Alpha metadata', Array.isArray(family.reviewBoards) && family.reviewBoards.length === 4 && reviewFailures === 0, `${reviewFailures} review mismatch(es)`);
check('ImageGen anchor is source-only and has recorded provenance', fs.existsSync(path.join(ROOT, 'art-source/platform/game-icons/cartoon-v2/review/imagegen-concept-board-v1.png')) && /exec-009d2d60-e1e8-4eaf-b1b4-dac423ec4f71/.test(readText('art-source/platform/game-icons/cartoon-v2/PROMPT_AND_PROVENANCE.md')) && /source-only/i.test(readText('art-source/platform/game-icons/cartoon-v2/OWNER_AUTHORIZED_ART_CLEARANCE.md')));
check('nine-skill routing and machine/advisory boundaries are recorded', (readText('art-source/platform/game-icons/cartoon-v2/SKILL_ROUTING.md').match(/\| `[^`]+` \|/g) || []).length === 9 && /(?:OPTIONAL_ADVISORY_EVIDENCE|可选咨询)/.test(readText('art-source/platform/game-icons/cartoon-v2/OWNER_AUTHORIZED_ART_CLEARANCE.md')) && fs.existsSync(path.join(ROOT, 'art-source/platform/game-icons/cartoon-v2/TECHNICAL_REVIEW_Reviewer_A.md')) && fs.existsSync(path.join(ROOT, 'art-source/platform/game-icons/cartoon-v2/MACHINE_VISUAL_REVIEW.md')) && fs.existsSync(path.join(ROOT, 'art-source/platform/game-icons/cartoon-v2/SIMILARITY_AND_IP_REVIEW.md')));

check('CSS defines the game icon/marker and selected-object presentation seams', /\.game-icon-asset\b/.test(template) && /\.game-system-marker\b/.test(template) && /\.game-icon-selected-object\b/.test(template) && /game-cover-v2/.test(template));
check('selected decorative object cannot intercept input and has explicit selected-state reveal', /\.game-icon-selected-object[^{}]*\{[^}]*pointer-events\s*:\s*none/i.test(template) && /data-depth-selected=["']true["'][^{}]*\.game-icon-selected-object|\.game-card\[data-depth-selected=["']true["']\][^{}]*\.game-icon-selected-object/i.test(template));
check('rollback leaves existing CSS/text baselines without replacement diamonds or enlarged Emoji', /ensureGameSelectedObjectNode[\s\S]{0,600}?fallback:''/.test(assetsSource) && !/gameSystemMarkerNode\([^\n]*fallback:'◆'/.test(rosterSource + '\n' + onlineSource));
check('selected object is reachable as a stable pointer and keyboard preview before activation', /card\.addEventListener\(['"]pointerenter['"],\s*selectForTransition\)/.test(rosterSource) && /card\.addEventListener\(['"]focus['"],\s*selectForTransition\)/.test(rosterSource) && /card\.addEventListener\(['"]click['"][^\n]*selectForTransition\(\)[^\n]*startGame\(id\)/.test(rosterSource));
check('same-card selection is idempotent and does not recreate the selected object', /const next=card&&card\.nodeType===1\?card:null/.test(mascotSource) && /if\(next===selectedCard\)\{/.test(mascotSource) && /ensureGameSelectedObjectNode\(next,next\.dataset\.gameId\)/.test(mascotSource));
check('game stage title reuses its icon node during high-frequency state renders', /wrap\.dataset\.gameId=id/.test(assetsSource) && /existing&&existing\.dataset&&existing\.dataset\.gameId===id/.test(assetsSource) && /target\.innerHTML='';target\.appendChild\(gameTitleNode\(id\)/.test(assetsSource));
check('room ready status uses the ready marker instead of waiting', /onlineSystemMarkerNode\(info\.started\?'live':info\.canStart\?'ready':'waiting'/.test(websocketSource));
check('empty marker loading/failure collapses to existing Lucide/text without spacer boxes', /fallbackText=settings\.fallback!==undefined\?String\(settings\.fallback\):''/.test(assetsSource) && /wrap\.classList\.add\('game-system-marker-empty-fallback'\)/.test(assetsSource) && /\.game-system-marker-empty-fallback:not\(\.asset-ready\)\s*\{[^}]*display\s*:\s*none/i.test(template) && /\.mode-system-marker\.asset-ready\+\.ui-icon\s*\{[^}]*display\s*:\s*none/i.test(template));
check('leaderboard marker and rank number have an explicit non-overflowing flex cell', /\.lb-rank\s*\{[^}]*width\s*:\s*42px[^}]*display\s*:\s*inline-flex[^}]*gap\s*:\s*2px/i.test(template) && /\.lb-rank-number\s*\{[^}]*font-variant-numeric\s*:\s*tabular-nums/i.test(template));
check('reduced-motion and forced-colors CSS contracts preserve P0-12 semantics', /@media\s*\(prefers-reduced-motion\s*:\s*reduce\)[\s\S]{0,1500}game-icon-selected-object/i.test(template) && /@media\s*\(forced-colors\s*:\s*active\)[\s\S]{0,1500}(?:game-icon-(?:asset-image|selected-object)|game-system-marker-image)/i.test(template) && /mode-system-marker(?:\+\.ui-icon|\.asset-ready\+\.ui-icon)[^{}]*\{[^}]*display\s*:\s*inline-flex\s*!important/i.test(template));

releaseLock();
const failures = checks.filter(item => !item.ok);
if (failures.length){
  console.error('GAME_ICON_SYSTEM_V2_FAILURES=' + failures.length);
  process.exit(1);
}
console.log('GAME_ICON_SYSTEM_V2_ALL_PASS', JSON.stringify({checks:checks.length, sources:sourceSpecs.length, variants:runtimeSpecs.length, bytes:runtimeBytes, dimensionCounts}));
