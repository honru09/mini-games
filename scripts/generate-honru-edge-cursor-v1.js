'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source/platform/honru-edge-cursor/visual-v1');
const SOURCE_DIR = path.join(SOURCE_ROOT, 'runtime-source');
const REVIEW_DIR = path.join(SOURCE_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/platform/honru-edge-cursor/visual-v1');
const MASTER_PATH = path.join(ROOT, 'art-source/brand/ghost-game/honru/honru-mascot-master-v1.svg');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
const FAMILY = 'P-HONRU-EDGE-CURSOR-V1';
const SOURCE = 'ART-HONRU-EDGE-CURSOR-V1';
const FLAG = 'mg_art_honru_edge_cursor_v1';
const EDGE_ROLES = ['edge-games-peek', 'edge-playline-wave', 'edge-profile-grab'];
const CURSOR_STATES = ['cursor-idle', 'cursor-pressed', 'cursor-scroll-up', 'cursor-scroll-down', 'cursor-scroll-left', 'cursor-scroll-right'];
const CURSOR_SIZES = [32, 64];

function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function write(file, value) { ensure(path.dirname(file)); fs.writeFileSync(file, value); }
function rel(file) { return path.relative(ROOT, file).split(path.sep).join('/'); }
function digest(file) { const bytes = fs.readFileSync(file); return { sha256: crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), bytes: bytes.length }; }
function svg(width, height, body) { return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">${body}</svg>`; }
function sourceInner() {
  const raw = fs.readFileSync(MASTER_PATH, 'utf8');
  return raw.replace(/^\s*<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<title[\s\S]*?<\/title>|<desc[\s\S]*?<\/desc>/g, '');
}

function edgeMaster(role) {
  const transforms = {
    'edge-games-peek': 'translate(210 -48) scale(.72) rotate(-8 256 310)',
    'edge-playline-wave': 'translate(-82 20) scale(.68) rotate(9 256 310)',
    'edge-profile-grab': 'translate(228 -28) scale(.74) rotate(-5 256 310)',
  };
  return svg(640, 480, `<defs><filter id="shadow" x="-30%" y="-30%" width="160%" height="180%"><feGaussianBlur stdDeviation="9"/></filter><clipPath id="viewport"><rect width="640" height="480" rx="28"/></clipPath></defs><g clip-path="url(#viewport)"><ellipse cx="388" cy="438" rx="112" ry="16" fill="#07090d" fill-opacity=".12" filter="url(#shadow)"/><g transform="${transforms[role]}">${sourceInner()}</g></g>`);
}

function cursorMaster(state, size) {
  const s = Number(size);
  const k = s / 32;
  const body = state === 'cursor-pressed'
    ? `<path d="M10 7c2-4 8-5 11-1l4 6-3 2-3-3 1 9-5 8-8-3-2-9Z" fill="#fff" stroke="#07090d" stroke-width="2.2" stroke-linejoin="round"/><circle cx="17" cy="11" r="2.5" fill="#07090d"/><path d="M15.6 10.2h2.8M17 8.8v2.8" stroke="#fff" stroke-width=".85" stroke-linecap="round"/>`
    : `<path d="M15 2c4 2 7 5 7 10l4 5-4 1 3 6-5 1-3-5-2 8-5-1 1-8-5 3-2-4 5-5c-1-5 1-9 6-11Z" fill="#fff" stroke="#07090d" stroke-width="2.2" stroke-linejoin="round"/><circle cx="15" cy="10" r="2.7" fill="#07090d"/><path d="M14.1 9.3h1.8M15 8.4v1.8" stroke="#fff" stroke-width=".85" stroke-linecap="round"/><circle cx="20" cy="11" r=".65" fill="#fff"/><circle cx="21.8" cy="12.8" r=".65" fill="#fff"/><circle cx="20" cy="14.6" r=".65" fill="#fff"/><circle cx="18.2" cy="12.8" r=".65" fill="#fff"/>`;
  const direction = state.replace('cursor-scroll-', '');
  const arrows = direction && direction !== state ? ({
    up: '<path d="M27 8v-5m0 0-2 2m2-2 2 2" stroke="#07090d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    down: '<path d="M27 20v5m0 0-2-2m2 2 2-2" stroke="#07090d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    left: '<path d="M7 27H2m0 0 2-2m-2 2 2 2" stroke="#07090d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    right: '<path d="M23 27h5m0 0-2-2m2 2-2 2" stroke="#07090d" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
  }[direction] || '') : '';
  return svg(s, s, `<g transform="scale(${k})">${body}${arrows}</g>`);
}

async function generateAll() {
  const release = acquireArtGeneratorLock(FAMILY);
  try {
    ensure(SOURCE_DIR); ensure(REVIEW_DIR); ensure(RUNTIME_ROOT);
    for (const role of EDGE_ROLES) write(path.join(SOURCE_DIR, role + '.svg'), edgeMaster(role));
    for (const state of CURSOR_STATES) for (const size of CURSOR_SIZES) write(path.join(SOURCE_DIR, `${state}-${size}.svg`), cursorMaster(state, size));
    const sourceMasters = [];
    for (const file of fs.readdirSync(SOURCE_DIR).filter(name => name.endsWith('.svg')).sort()) {
      const p = path.join(SOURCE_DIR, file); const h = digest(p); sourceMasters.push({ role: file.slice(0, -4), path: rel(p), sha256: h.sha256, bytes: h.bytes, alpha: true });
    }
    const runtimeVariants = []; const variants = {}; const variantBytes = {};
    for (const role of EDGE_ROLES) {
      const source = fs.readFileSync(path.join(SOURCE_DIR, role + '.svg'));
      for (const variant of ['normal', 'static']) {
        const suffix = variant === 'static' ? '-static' : '';
        const p = path.join(RUNTIME_ROOT, role + suffix + '.webp');
        await sharp(source).resize(640, 480, { fit: 'contain' }).webp({ quality: variant === 'static' ? 84 : 90 }).toFile(p);
        const h = digest(p); const key = role + suffix; variants[key] = rel(p); variantBytes[key] = h.bytes; runtimeVariants.push({ role, variant, path: rel(p), sha256: h.sha256, bytes: h.bytes, width: 640, height: 480, alpha: true });
      }
    }
    for (const state of CURSOR_STATES) for (const size of CURSOR_SIZES) {
      const source = fs.readFileSync(path.join(SOURCE_DIR, `${state}-${size}.svg`));
      const p = path.join(RUNTIME_ROOT, `${state}-${size}.png`);
      await sharp(source).resize(size, size, { fit: 'contain' }).png().toFile(p);
      const h = digest(p); const key = `${state}-${size}`; variants[key] = rel(p); variantBytes[key] = h.bytes; runtimeVariants.push({ role: state, variant: String(size), path: rel(p), sha256: h.sha256, bytes: h.bytes, width: size, height: size, alpha: true });
    }
    const reviewFiles = [...EDGE_ROLES.map(role => `${role}.webp`), ...CURSOR_STATES.map(state => `${state}-32.png`)];
    const cells = [];
    for (let i = 0; i < reviewFiles.length; i++) {
      const p = path.join(RUNTIME_ROOT, reviewFiles[i]);
      const b = await sharp(p).resize(180, 120, { fit: 'contain', background: { r: 236, g: 238, b: 242, alpha: 1 } }).png().toBuffer();
      cells.push({ input: b, left: (i % 5) * 196 + 8, top: Math.floor(i / 5) * 142 + 8 });
    }
    const review = path.join(REVIEW_DIR, 'honru-edge-cursor-contact-sheet-v1.png');
    await sharp({ create: { width: 990, height: Math.ceil(cells.length / 5) * 142 + 8, channels: 4, background: { r: 236, g: 238, b: 242, alpha: 1 } } }).composite(cells).png().toFile(review);
    const total = runtimeVariants.reduce((sum, item) => sum + item.bytes, 0);
    write(path.join(SOURCE_ROOT, 'asset-family-manifest-v1.json'), JSON.stringify({ familyId: FAMILY, sourceId: SOURCE, flag: FLAG, generatedAt: new Date().toISOString(), sourceMastersCount: sourceMasters.length, runtimeVariantsCount: runtimeVariants.length, totalRuntimeBytes: total, byteBudget: 1024 * 1024, sourceMasters, runtimeVariants, reviewBoards: [rel(review)] }, null, 2));
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    manifest.assets = (manifest.assets || []).filter(item => item.asset_id !== FAMILY);
    manifest.assets.push({ asset_id: FAMILY, runtime_id: 'honru', artwork_version: 1, runtime_path: variants['edge-games-peek'], variants, status: 'ready', clearance: 'OWNER_AUTHORIZED_ART_CLEARANCE', source_asset_id: SOURCE, feature_flags: { operator: 'all', enabled_value: '1', default_enabled: true, ids: [FLAG] }, fallback_asset_id: 'honru-edge-cursor-system-fallback', fallback: 'system cursor plus existing Hero Honru', load: 'lazy on active route; cursor only on fine hover pointers', a11y: 'edge art is decorative and pointer-events:none; cursor can be disabled in Settings; text remains DOM/i18n', license: 'project-owned-deterministic-svg-sharp', source: rel(SOURCE_DIR), clearance_record: rel(path.join(SOURCE_ROOT, 'OWNER_AUTHORIZED_ART_CLEARANCE.md')), variant_integrity: Object.fromEntries(Object.entries(variants).map(([key, value]) => [key, 'sha256:' + digest(path.join(ROOT, value)).sha256.toLowerCase()])), variant_bytes: variantBytes, actual_bytes: total, byte_budget: 1024 * 1024, review_boards: [rel(review)], cursor_hotspot: { idle: [4, 2], pressed: [4, 2], scroll: [4, 2] } });
    write(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
    catalog.assets = (catalog.assets || []).filter(item => item.id !== FAMILY && item.familyId !== FAMILY);
    const first = sourceMasters.find(item => item.role === 'edge-games-peek') || sourceMasters[0];
    catalog.assets.push({ id: FAMILY, category: 'platform/honru-edge-cursor', assetType: 'edge-guide-and-native-cursor', sourceType: 'project-owned', sourcePath: first.path, sourceSha256: first.sha256.toLowerCase(), license: 'project-owned-deterministic-vector', author: 'OpenAI Codex for Ghost Game', status: 'integrated-local-only', dimensions: { width: 640, height: 480 }, previewPath: rel(review), previewSha256: digest(review).sha256.toLowerCase(), runtimePaths: runtimeVariants.map(item => item.path), promptPath: 'art-source/platform/honru-edge-cursor/visual-v1/PROMPT_AND_PROVENANCE.md', model: null, remoteObjectKey: null });
    const index = (catalog.indexes || []).find(item => item.id === 'production-asset-manifest'); if (index) index.sha256 = digest(MANIFEST_PATH).sha256.toLowerCase();
    write(CATALOG_PATH, JSON.stringify(catalog, null, 2));
    console.log(`[${FAMILY}] generated ${sourceMasters.length} SVG masters, ${runtimeVariants.length} runtime variants, ${total} bytes`);
  } finally { release(); }
}

if (require.main === module) generateAll().catch(error => { console.error(error); process.exit(1); });
module.exports = { generateAll, FAMILY, SOURCE, FLAG, EDGE_ROLES, CURSOR_STATES, CURSOR_SIZES };
