'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const manifestPath = path.join(ROOT, 'art-source', 'platform', 'scenes', 'signal-worlds-v1', 'asset-family-manifest-v1.json');
const runtimeManifestPath = path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json');
const sourceJs = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '06-assets.js'), 'utf8');
const shellJs = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '02-app-shell.js'), 'utf8');
const utilsJs = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '01-utils.js'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const generator = fs.readFileSync(path.join(ROOT, 'scripts', 'generate-platform-scenes-v1.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const runtimeManifest = JSON.parse(fs.readFileSync(runtimeManifestPath, 'utf8'));
let failures = 0;
function check(label, value, detail = '') {
  if (value) console.log('PASS', label, detail);
  else { failures++; console.error('FAIL', label, detail); }
}
function fileFor(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/');
  return path.join(ROOT, ...normalized.split('/'));
}
function digest(file) {
  const bytes = fs.readFileSync(file);
  return { sha256: crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), bytes: bytes.length };
}
function webpInfo(file) {
  try {
    const bytes = fs.readFileSync(file);
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('invalid RIFF/WEBP');
    const riffEnd = 8 + bytes.readUInt32LE(4);
    if (riffEnd !== bytes.length) throw new Error('RIFF size mismatch');
    let offset = 12, canvas = null, frame = null, alphaChunk = false;
    while (offset + 8 <= riffEnd) {
      const kind = bytes.toString('ascii', offset, offset + 4);
      const length = bytes.readUInt32LE(offset + 4), data = offset + 8, end = data + length;
      if (end > riffEnd || end + (length & 1) > riffEnd) throw new Error('truncated ' + kind);
      if (kind === 'VP8X') {
        if (offset !== 12 || length !== 10 || canvas) throw new Error('invalid VP8X');
        if ((bytes[data] & 0xc1) || bytes[data + 1] || bytes[data + 2] || bytes[data + 3]) throw new Error('VP8X reserved bits');
        const read24 = at => bytes[at] | (bytes[at + 1] << 8) | (bytes[at + 2] << 16);
        canvas = { width: read24(data + 4) + 1, height: read24(data + 7) + 1, alpha: !!(bytes[data] & 0x10) };
      } else if (kind === 'VP8 ') {
        if (frame || length < 10 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) throw new Error('invalid VP8');
        frame = { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff };
      } else if (kind === 'VP8L') {
        if (frame || length < 5 || bytes[data] !== 0x2f) throw new Error('invalid VP8L');
        const bits = bytes.readUInt32LE(data + 1);
        frame = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, alpha: !!(bits & 0x10000000) };
      } else if (kind === 'ALPH') alphaChunk = true;
      offset = end + (length & 1);
    }
    if (offset !== riffEnd || (!canvas && !frame)) throw new Error('incomplete WebP');
    if (canvas && frame && (canvas.width !== frame.width || canvas.height !== frame.height)) throw new Error('canvas/frame mismatch');
    return { width: canvas ? canvas.width : frame.width, height: canvas ? canvas.height : frame.height, alpha: !!((canvas && canvas.alpha) || alphaChunk || (frame && frame.alpha)) };
  } catch (error) { return { error: error.message }; }
}

check('family manifest is P0-02 v1', manifest.productionUnitId === 'P0-02' && manifest.familyId === 'P-PLATFORM-SCENES-V1' && manifest.artworkVersion === 1);
check('external assets are explicitly isolated', /EXTERNAL_REFERENCE_ONLY/.test(manifest.externalReferencePolicy) && /not read|not copied|not.*inputs/i.test(manifest.externalReferencePolicy));
check('source/runtime/review counts', manifest.sourceMasters.length === 48 && manifest.runtimeVariants.length === 80 && manifest.reviewBoards.length === 4);
check('runtime budget is respected', manifest.metrics.runtimeVariantBytes === 1259316 && manifest.metrics.withinBudget === true && manifest.metrics.runtimeByteBudget === 4194304);
check('route/theme/viewport matrix', JSON.stringify(manifest.routes) === JSON.stringify(['home','games','room','playline']) && JSON.stringify(manifest.themes) === JSON.stringify(['light','dark']) && manifest.viewports.desktop.width === 1920 && manifest.viewports.mobile.height === 1200);
check('feature flags are exact and default-on is reversible', manifest.featureFlags.operator === 'all' && manifest.featureFlags.defaultEnabled === true && manifest.featureFlags.ids.length === 5 && sourceJs.includes('PLATFORM_SCENE_MASTER_FLAG') && sourceJs.includes('PLATFORM_SCENE_FLAGS'));
check('runtime manifest entry is owner-cleared', (() => { const item = runtimeManifest.assets.find(asset => asset && asset.asset_id === 'P-PLATFORM-SCENES-V1'); return !!item && item.status === 'ready' && item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && item.source_asset_id === 'ART-PLATFORM-SCENES-V1' && item.clearance_record.endsWith('signal-worlds-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md'); })());

const expectedDims = { desktop: [1920, 1080], mobile: [900, 1200], poster: [640, 360], mini: [640, 360] };
const layerRecords = new Map(manifest.runtimeVariants.map(item => [item.key, item]));
for (const item of manifest.runtimeVariants) {
  const file = fileFor(item.path);
  const relative = item.path.replace(/\\/g, '/');
  check(item.key + ' path exists and is public runtime', fs.existsSync(file) && relative.startsWith('public/assets/backgrounds/platform-scenes-v1/'));
  if (!fs.existsSync(file)) continue;
  const d = digest(file);
  check(item.key + ' SHA/bytes frozen', d.sha256 === item.sha256 && d.bytes === item.bytes, `${d.bytes} bytes`);
  const shape = item.key.includes('-poster') ? 'poster' : item.key.includes('-mini') ? 'mini' : item.key.includes('-mobile-') ? 'mobile' : 'desktop';
  const info = webpInfo(file);
  const dims = expectedDims[shape];
  check(item.key + ' WebP dimensions', !info.error && info.width === dims[0] && info.height === dims[1], info.error || `${info.width}x${info.height}`);
  const shouldAlpha = item.role === 'mid' || item.role === 'foreground';
  check(item.key + ' alpha contract', !info.error && info.alpha === shouldAlpha, info.error || `alpha=${info.alpha}`);
}
check('all route/theme/viewport layered keys are unique', layerRecords.size === 80);
check('desktop and mobile compositions are independent', manifest.runtimeVariants.some(item => item.key === 'home-light-desktop-mid') && manifest.runtimeVariants.some(item => item.key === 'home-light-mobile-mid') && layerRecords.get('home-light-desktop-mid').sha256 !== layerRecords.get('home-light-mobile-mid').sha256);
check('static/reduced-motion and poster/save-data paths are wired', sourceJs.includes('reducedMotion') && sourceJs.includes('saveData') && sourceJs.includes('useStatic') && sourceJs.includes('usePoster'));
check('decode-before-activate and late-result isolation', shellJs.includes('probe.decode') && shellJs.includes('platformSceneRenderSeq') && shellJs.includes('dataset.platformSceneSeq') && shellJs.includes('clearPlatformSceneRuntime'));
check('visibility/game-active pause is wired', shellJs.includes('visibilitychange') && html.includes('platform-scene-paused') && html.includes('body.game-active .ambient-scene.platform-scene-ready'));
check('reduced-motion and forced-colors static safety', html.includes('@media(prefers-reduced-motion:reduce)') && html.includes('@media(forced-colors:active)') && html.includes('.platform-scene-layer{display:none!important}'));
check('theme and route refresh seams are wired', utilsJs.includes('refreshPlatformScene') && shellJs.includes('platformSceneRouteFor') && sourceJs.includes('PLATFORM_SCENE_ROUTES'));
check('generator has no external reference input', !/art-source[\\/]external|\.psd|\.ai|\.rpg/i.test(generator) && !/readFileSync\([^)]*external|readdirSync\([^)]*external/i.test(generator));

if (failures) { console.error('PLATFORM_SCENES_CONTRACT_FAILURES=' + failures); process.exitCode = 1; }
else console.log('PLATFORM_SCENES_CONTRACT_ALL_PASS');
