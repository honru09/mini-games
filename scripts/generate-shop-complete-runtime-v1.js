'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source/platform/shop/complete-art-v1/runtime-source');
const REVIEW_ROOT = path.join(ROOT, 'art-source/platform/shop/complete-art-v1/review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/platform/shop/complete-art-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const FAMILY_MANIFEST = path.join(ROOT, 'art-source/platform/shop/complete-art-v1/asset-family-manifest-v1.json');

const FAMILY_ID = 'P-SHOP-COMPLETE-ART-V1';
const SOURCE_ID = 'ART-041-SHOP-COMPLETE-ART-V1';
const FLAG = 'mg_art_shop_complete_v1';

const RARITY_ROLES = [
  'rarity-frame-common', 'rarity-frame-rare', 'rarity-frame-epic',
  'rarity-frame-legendary', 'rarity-frame-mythic'
];
const PEDESTAL_ROLES = [
  'pedestal-common', 'pedestal-rare', 'pedestal-epic',
  'pedestal-legendary', 'pedestal-mythic'
];
const CATEGORY_ROLES = [
  'category-avatars', 'category-frames', 'category-effects',
  'category-backgrounds', 'category-skins', 'category-specials'
];
const VFX_ROLES = [
  'vfx-purchase-burst', 'vfx-unlock-ray', 'vfx-coin-deduct',
  'vfx-equipped-badge', 'vfx-rarity-glow', 'vfx-discount-tag'
];
const CAMERA_ROLES = ['camera-desktop', 'camera-mobile'];

function ensure(dir){ if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function write(file, data){ ensure(path.dirname(file)); fs.writeFileSync(file, data); }
function rel(abs){ return path.relative(ROOT, abs).replace(/\\/g, '/'); }
function digest(abs){
  const buf = fs.readFileSync(abs);
  return {
    sha256: crypto.createHash('sha256').update(buf).digest('hex').toUpperCase(),
    bytes: buf.length
  };
}

const C = {
  ink: '#1E1B2E',
  inkLight: '#3D3854',
  commonBase: '#E2E8F0',
  commonBorder: '#94A3B8',
  commonGlow: '#CBD5E1',
  rareBase: '#38BDF8',
  rareBorder: '#0284C7',
  rareGlow: '#BAE6FD',
  epicBase: '#C084FC',
  epicBorder: '#9333EA',
  epicGlow: '#E9D5FF',
  legendaryBase: '#FBBF24',
  legendaryBorder: '#D97706',
  legendaryGlow: '#FEF3C7',
  mythicBase: '#F43F5E',
  mythicBorder: '#BE123C',
  mythicGlow: '#FFE4E6',
  gold: '#F59E0B',
  goldLight: '#FDE68A',
  goldDark: '#B45309',
  emerald: '#10B981',
  violet: '#8B5CF6',
  cyan: '#06B6D4',
  rose: '#F43F5E',
  white: '#FFFFFF',
  darkBg: '#0F0D1B'
};

function stroke(color, width = 6){
  return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
}
function svg(w, h, content, bg = 'transparent'){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:${bg};">${content}</svg>`;
}

function buildSvgByRole(role){
  switch (role) {
    // 1. Rarity Frames
    case 'rarity-frame-common':
      return svg(256, 256, `
        <rect x="16" y="16" width="224" height="224" rx="32" fill="${C.commonBase}" fill-opacity="0.15" ${stroke(C.commonBorder, 8)}/>
        <rect x="28" y="28" width="200" height="200" rx="24" fill="none" stroke="${C.commonGlow}" stroke-width="3" stroke-dasharray="8 6"/>
        <circle cx="32" cy="32" r="8" fill="${C.commonBorder}"/>
        <circle cx="224" cy="32" r="8" fill="${C.commonBorder}"/>
        <circle cx="32" cy="224" r="8" fill="${C.commonBorder}"/>
        <circle cx="224" cy="224" r="8" fill="${C.commonBorder}"/>
      `);
    case 'rarity-frame-rare':
      return svg(256, 256, `
        <rect x="16" y="16" width="224" height="224" rx="32" fill="${C.rareBase}" fill-opacity="0.2" ${stroke(C.rareBorder, 8)}/>
        <rect x="28" y="28" width="200" height="200" rx="24" fill="none" stroke="${C.rareGlow}" stroke-width="4"/>
        <polygon points="128,12 140,24 128,36 116,24" fill="${C.rareBase}"/>
        <polygon points="128,220 140,232 128,244 116,232" fill="${C.rareBase}"/>
        <polygon points="12,128 24,140 36,128 24,116" fill="${C.rareBase}"/>
        <polygon points="220,128 232,140 244,128 232,116" fill="${C.rareBase}"/>
      `);
    case 'rarity-frame-epic':
      return svg(256, 256, `
        <rect x="16" y="16" width="224" height="224" rx="32" fill="${C.epicBase}" fill-opacity="0.22" ${stroke(C.epicBorder, 9)}/>
        <rect x="28" y="28" width="200" height="200" rx="24" fill="none" stroke="${C.epicGlow}" stroke-width="4" stroke-dasharray="16 8"/>
        <circle cx="128" cy="24" r="10" fill="${C.epicGlow}" ${stroke(C.epicBorder, 4)}/>
        <circle cx="128" cy="232" r="10" fill="${C.epicGlow}" ${stroke(C.epicBorder, 4)}/>
        <path d="M28,48 L48,28 M228,48 L208,28 M28,208 L48,228 M228,208 L208,228" stroke="${C.epicGlow}" stroke-width="6" stroke-linecap="round"/>
      `);
    case 'rarity-frame-legendary':
      return svg(256, 256, `
        <rect x="16" y="16" width="224" height="224" rx="36" fill="${C.legendaryBase}" fill-opacity="0.25" ${stroke(C.legendaryBorder, 10)}/>
        <rect x="30" y="30" width="196" height="196" rx="26" fill="none" stroke="${C.legendaryGlow}" stroke-width="5"/>
        <polygon points="128,10 142,26 164,26 150,40 156,62 128,48 100,62 106,40 92,26 114,26" fill="${C.legendaryBase}" ${stroke(C.legendaryBorder, 3)}/>
        <circle cx="36" cy="36" r="10" fill="${C.legendaryGlow}" ${stroke(C.legendaryBorder, 4)}/>
        <circle cx="220" cy="36" r="10" fill="${C.legendaryGlow}" ${stroke(C.legendaryBorder, 4)}/>
        <circle cx="36" cy="220" r="10" fill="${C.legendaryGlow}" ${stroke(C.legendaryBorder, 4)}/>
        <circle cx="220" cy="220" r="10" fill="${C.legendaryGlow}" ${stroke(C.legendaryBorder, 4)}/>
      `);
    case 'rarity-frame-mythic':
      return svg(256, 256, `
        <rect x="16" y="16" width="224" height="224" rx="40" fill="${C.mythicBase}" fill-opacity="0.28" ${stroke(C.mythicBorder, 12)}/>
        <rect x="32" y="32" width="192" height="192" rx="28" fill="none" stroke="${C.mythicGlow}" stroke-width="6"/>
        <path d="M128,6 L138,24 L158,28 L142,42 L146,62 L128,52 L110,62 L114,42 L98,28 L118,24 Z" fill="${C.mythicBase}" ${stroke(C.mythicBorder, 3)}/>
        <path d="M6,128 L24,138 L28,158 L42,142 L62,146 L52,128 L62,110 L42,114 L28,98 L24,118 Z" fill="${C.mythicBase}" ${stroke(C.mythicBorder, 3)}/>
        <path d="M250,128 L232,138 L228,158 L214,142 L194,146 L204,128 L194,110 L214,114 L228,98 L232,118 Z" fill="${C.mythicBase}" ${stroke(C.mythicBorder, 3)}/>
        <circle cx="128" cy="128" r="80" fill="none" stroke="${C.mythicGlow}" stroke-width="3" stroke-dasharray="8 8" opacity="0.6"/>
      `);

    // 2. Pedestals
    case 'pedestal-common':
      return svg(320, 180, `
        <ellipse cx="160" cy="130" rx="130" ry="36" fill="${C.ink}" fill-opacity="0.25"/>
        <ellipse cx="160" cy="120" rx="120" ry="32" fill="${C.commonBase}" ${stroke(C.commonBorder, 6)}/>
        <ellipse cx="160" cy="116" rx="100" ry="24" fill="${C.white}" fill-opacity="0.5"/>
      `);
    case 'pedestal-rare':
      return svg(320, 180, `
        <ellipse cx="160" cy="132" rx="136" ry="38" fill="${C.ink}" fill-opacity="0.3"/>
        <ellipse cx="160" cy="122" rx="124" ry="34" fill="${C.rareBase}" fill-opacity="0.8" ${stroke(C.rareBorder, 7)}/>
        <ellipse cx="160" cy="116" rx="104" ry="26" fill="${C.rareGlow}" fill-opacity="0.7"/>
        <ellipse cx="160" cy="112" rx="84" ry="18" fill="${C.white}" fill-opacity="0.6"/>
      `);
    case 'pedestal-epic':
      return svg(320, 180, `
        <ellipse cx="160" cy="134" rx="140" ry="40" fill="${C.ink}" fill-opacity="0.35"/>
        <ellipse cx="160" cy="124" rx="128" ry="36" fill="${C.epicBase}" fill-opacity="0.85" ${stroke(C.epicBorder, 8)}/>
        <ellipse cx="160" cy="118" rx="108" ry="28" fill="${C.epicGlow}" fill-opacity="0.75"/>
        <ellipse cx="160" cy="112" rx="88" ry="20" fill="${C.white}" fill-opacity="0.7"/>
        <circle cx="50" cy="120" r="6" fill="${C.epicGlow}"/>
        <circle cx="270" cy="120" r="6" fill="${C.epicGlow}"/>
      `);
    case 'pedestal-legendary':
      return svg(320, 180, `
        <ellipse cx="160" cy="136" rx="144" ry="42" fill="${C.ink}" fill-opacity="0.4"/>
        <ellipse cx="160" cy="126" rx="132" ry="38" fill="${C.legendaryBase}" ${stroke(C.legendaryBorder, 9)}/>
        <ellipse cx="160" cy="118" rx="112" ry="30" fill="${C.legendaryGlow}" fill-opacity="0.85"/>
        <ellipse cx="160" cy="110" rx="92" ry="22" fill="${C.white}" fill-opacity="0.8"/>
        <polygon points="160,80 166,92 180,94 170,104 172,118 160,110 148,118 150,104 140,94 154,92" fill="${C.goldLight}"/>
      `);
    case 'pedestal-mythic':
      return svg(320, 180, `
        <ellipse cx="160" cy="138" rx="150" ry="44" fill="${C.ink}" fill-opacity="0.45"/>
        <ellipse cx="160" cy="128" rx="138" ry="40" fill="${C.mythicBase}" ${stroke(C.mythicBorder, 10)}/>
        <ellipse cx="160" cy="120" rx="118" ry="32" fill="${C.mythicGlow}" fill-opacity="0.9"/>
        <ellipse cx="160" cy="112" rx="96" ry="24" fill="${C.white}" fill-opacity="0.85"/>
        <path d="M40,115 Q160,85 280,115" fill="none" stroke="${C.mythicGlow}" stroke-width="4" stroke-dasharray="6 6"/>
      `);

    // 3. Category Icons
    case 'category-avatars':
      return svg(128, 128, `
        <circle cx="64" cy="64" r="54" fill="${C.cyan}" fill-opacity="0.2" ${stroke(C.cyan, 6)}/>
        <circle cx="64" cy="48" r="20" fill="${C.cyan}" ${stroke(C.ink, 4)}/>
        <path d="M34,96 C34,76 94,76 94,96 Z" fill="${C.cyan}" ${stroke(C.ink, 4)}/>
      `);
    case 'category-frames':
      return svg(128, 128, `
        <circle cx="64" cy="64" r="54" fill="${C.gold}" fill-opacity="0.2" ${stroke(C.gold, 6)}/>
        <rect x="36" y="36" width="56" height="56" rx="12" fill="none" ${stroke(C.gold, 8)}/>
        <circle cx="64" cy="64" r="14" fill="${C.goldLight}"/>
      `);
    case 'category-effects':
      return svg(128, 128, `
        <circle cx="64" cy="64" r="54" fill="${C.violet}" fill-opacity="0.2" ${stroke(C.violet, 6)}/>
        <polygon points="64,22 74,48 100,52 80,70 86,96 64,82 42,96 48,70 28,52 54,48" fill="${C.violet}" ${stroke(C.ink, 4)}/>
      `);
    case 'category-backgrounds':
      return svg(128, 128, `
        <circle cx="64" cy="64" r="54" fill="${C.emerald}" fill-opacity="0.2" ${stroke(C.emerald, 6)}/>
        <rect x="32" y="40" width="64" height="48" rx="8" fill="${C.emerald}" fill-opacity="0.5" ${stroke(C.emerald, 5)}/>
        <circle cx="48" cy="54" r="6" fill="${C.goldLight}"/>
        <path d="M36,80 L52,64 L68,76 L80,68 L92,80 Z" fill="${C.emerald}" stroke="${C.ink}" stroke-width="3"/>
      `);
    case 'category-skins':
      return svg(128, 128, `
        <circle cx="64" cy="64" r="54" fill="${C.rose}" fill-opacity="0.2" ${stroke(C.rose, 6)}/>
        <rect x="36" y="36" width="56" height="56" rx="10" fill="${C.rose}" fill-opacity="0.6" ${stroke(C.ink, 4)}/>
        <line x1="64" y1="36" x2="64" y2="92" stroke="${C.white}" stroke-width="4"/>
        <line x1="36" y1="64" x2="92" y2="64" stroke="${C.white}" stroke-width="4"/>
      `);
    case 'category-specials':
      return svg(128, 128, `
        <circle cx="64" cy="64" r="54" fill="${C.goldDark}" fill-opacity="0.2" ${stroke(C.goldDark, 6)}/>
        <path d="M40,36 L88,36 L98,64 L64,100 L30,64 Z" fill="${C.gold}" ${stroke(C.goldDark, 5)}/>
        <polygon points="64,44 70,58 84,60 74,70 76,84 64,76 52,84 54,70 44,60 58,58" fill="${C.goldLight}"/>
      `);

    // 4. Purchase Feedback VFX
    case 'vfx-purchase-burst':
      return svg(256, 256, `
        <circle cx="128" cy="128" r="70" fill="${C.goldLight}" fill-opacity="0.4"/>
        <circle cx="128" cy="128" r="45" fill="${C.gold}" fill-opacity="0.7"/>
        <g stroke="${C.gold}" stroke-width="6" stroke-linecap="round">
          <line x1="128" y1="30" x2="128" y2="10"/>
          <line x1="128" y1="226" x2="128" y2="246"/>
          <line x1="30" y1="128" x2="10" y2="128"/>
          <line x1="226" y1="128" x2="246" y2="128"/>
          <line x1="58" y1="58" x2="42" y2="42"/>
          <line x1="198" y1="198" x2="214" y2="214"/>
          <line x1="58" y1="198" x2="42" y2="214"/>
          <line x1="198" y1="58" x2="214" y2="42"/>
        </g>
        <circle cx="128" cy="128" r="20" fill="${C.white}"/>
      `);
    case 'vfx-unlock-ray':
      return svg(256, 256, `
        <polygon points="128,128 110,10 146,10" fill="${C.goldLight}" fill-opacity="0.35"/>
        <polygon points="128,128 246,110 246,146" fill="${C.goldLight}" fill-opacity="0.35"/>
        <polygon points="128,128 110,246 146,246" fill="${C.goldLight}" fill-opacity="0.35"/>
        <polygon points="128,128 10,110 10,146" fill="${C.goldLight}" fill-opacity="0.35"/>
        <polygon points="128,128 220,40 240,60" fill="${C.goldLight}" fill-opacity="0.25"/>
        <polygon points="128,128 40,220 60,240" fill="${C.goldLight}" fill-opacity="0.25"/>
        <polygon points="128,128 40,36 60,16" fill="${C.goldLight}" fill-opacity="0.25"/>
        <polygon points="128,128 220,216 240,236" fill="${C.goldLight}" fill-opacity="0.25"/>
        <circle cx="128" cy="128" r="32" fill="${C.white}"/>
      `);
    case 'vfx-coin-deduct':
      return svg(256, 256, `
        <circle cx="128" cy="128" r="50" fill="${C.gold}" ${stroke(C.goldDark, 6)}/>
        <circle cx="128" cy="128" r="38" fill="none" stroke="${C.goldLight}" stroke-width="4"/>
        <text x="128" y="142" font-size="44" font-weight="900" text-anchor="middle" fill="${C.goldDark}">💵</text>
        <path d="M128,40 L128,70 M116,52 L128,40 L140,52" stroke="${C.rose}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      `);
    case 'vfx-equipped-badge':
      return svg(256, 256, `
        <circle cx="128" cy="128" r="64" fill="${C.emerald}" ${stroke(C.white, 8)}/>
        <polyline points="96,128 118,150 164,102" fill="none" stroke="${C.white}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
      `);
    case 'vfx-rarity-glow':
      return svg(256, 256, `
        <circle cx="128" cy="128" r="88" fill="${C.cyan}" fill-opacity="0.15"/>
        <circle cx="128" cy="128" r="64" fill="${C.cyan}" fill-opacity="0.3"/>
        <circle cx="128" cy="128" r="36" fill="${C.white}" fill-opacity="0.7"/>
      `);
    case 'vfx-discount-tag':
      return svg(256, 256, `
        <polygon points="40,60 180,60 220,128 180,196 40,196" fill="${C.rose}" ${stroke(C.mythicBorder, 6)}/>
        <circle cx="70" cy="128" r="14" fill="${C.white}"/>
        <text x="140" y="142" font-size="36" font-weight="900" text-anchor="middle" fill="${C.white}">SALE</text>
      `);

    // 5. Cameras
    case 'camera-desktop':
    case 'camera-mobile':
      return svg(1, 1, `<rect width="1" height="1" fill="none"/>`);

    default:
      return svg(128, 128, `<rect width="128" height="128" fill="${C.commonBase}"/>`);
  }
}

async function generateAll(){
  const releaseLock = acquireArtGeneratorLock('P-SHOP-COMPLETE-ART-V1');
  try {
    ensure(SOURCE_ROOT);
    ensure(REVIEW_ROOT);
    ensure(RUNTIME_ROOT);

    const ALL_ROLES = [
      ...RARITY_ROLES,
      ...PEDESTAL_ROLES,
      ...CATEGORY_ROLES,
      ...VFX_ROLES,
      ...CAMERA_ROLES
    ];

    console.log(`[P-SHOP-COMPLETE-ART-V1] Generating ${ALL_ROLES.length} SVG masters...`);
    for (const role of ALL_ROLES){
      const svgContent = buildSvgByRole(role);
      const svgPath = path.join(SOURCE_ROOT, `${role}.svg`);
      write(svgPath, svgContent);
    }

    console.log(`[P-SHOP-COMPLETE-ART-V1] Compiling WebP runtime variants...`);
    for (const role of ALL_ROLES){
      const svgPath = path.join(SOURCE_ROOT, `${role}.svg`);
      const normalWebp = path.join(RUNTIME_ROOT, `${role}.webp`);
      const staticWebp = path.join(RUNTIME_ROOT, `${role}-static.webp`);
      const buf = fs.readFileSync(svgPath);

      const isCamera = role.startsWith('camera-');
      const width = isCamera ? 1 : (role.startsWith('pedestal-') ? 320 : (role.startsWith('category-') ? 128 : 256));

      await sharp(buf).resize(width).webp({ quality: 90, lossless: false }).toFile(normalWebp);
      await sharp(buf).resize(width).webp({ quality: 85, lossless: false }).toFile(staticWebp);
    }

    // Build contact sheet
    console.log(`[P-SHOP-COMPLETE-ART-V1] Building review contact sheet...`);
    const contactSheetPath = path.join(REVIEW_ROOT, 'shop-complete-contact-sheet-v1.png');
    const sampleWebps = ALL_ROLES.slice(0, 16).map(r => path.join(RUNTIME_ROOT, `${r}.webp`));
    const compositeList = [];
    let idx = 0;
    for (const sp of sampleWebps){
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const resized = await sharp(sp).resize(120, 120, { fit: 'contain', background: { r: 15, g: 13, b: 27, alpha: 1 } }).toBuffer();
      compositeList.push({ input: resized, top: row * 130 + 10, left: col * 130 + 10 });
      idx++;
    }
    await sharp({
      create: {
        width: 530,
        height: 530,
        channels: 4,
        background: { r: 15, g: 13, b: 27, alpha: 1 }
      }
    }).composite(compositeList).png().toFile(contactSheetPath);

    // Update Family Manifest
    console.log(`[P-SHOP-COMPLETE-ART-V1] Updating asset family manifest...`);
    const sourceMasters = ALL_ROLES.map(r => {
      const p = path.join(SOURCE_ROOT, `${r}.svg`);
      const d = digest(p);
      return { role: r, path: rel(p), sha256: d.sha256, bytes: d.bytes };
    });
    const runtimeVariants = [];
    for (const r of ALL_ROLES){
      const p1 = path.join(RUNTIME_ROOT, `${r}.webp`);
      const d1 = digest(p1);
      runtimeVariants.push({ role: r, variant: 'normal', path: rel(p1), sha256: d1.sha256, bytes: d1.bytes });

      const p2 = path.join(RUNTIME_ROOT, `${r}-static.webp`);
      const d2 = digest(p2);
      runtimeVariants.push({ role: r, variant: 'static', path: rel(p2), sha256: d2.sha256, bytes: d2.bytes });
    }
    const totalRuntimeBytes = runtimeVariants.reduce((sum, item) => sum + item.bytes, 0);

    const familyManifestObj = {
      familyId: FAMILY_ID,
      sourceId: SOURCE_ID,
      flag: FLAG,
      generatedAt: new Date().toISOString(),
      sourceMastersCount: sourceMasters.length,
      runtimeVariantsCount: runtimeVariants.length,
      totalRuntimeBytes,
      sourceMasters,
      runtimeVariants
    };
    write(FAMILY_MANIFEST, JSON.stringify(familyManifestObj, null, 2));

    // Update Global Asset Manifest
    console.log(`[P-SHOP-COMPLETE-ART-V1] Updating global asset manifest...`);
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    manifest.assets = (manifest.assets || []).filter(a => a.asset_id !== FAMILY_ID);
    manifest.assets.push({
      asset_id: FAMILY_ID,
      runtime_path: 'public/assets/platform/shop/complete-art-v1',
      source_id: SOURCE_ID,
      roles_count: ALL_ROLES.length,
      variants_count: runtimeVariants.length,
      total_bytes: totalRuntimeBytes,
      flag: FLAG
    });
    write(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

    // Update catalog.json
    const catalogPath = path.join(ROOT, 'asset-library/catalog.json');
    if (fs.existsSync(catalogPath)){
      const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      catalog.assets = (catalog.assets || []).filter(a => a.id !== FAMILY_ID && a.familyId !== FAMILY_ID);
      const primarySource = sourceMasters[0];
      const review = digest(contactSheetPath);
      catalog.assets.push({
        id: FAMILY_ID,
        category: 'platform/shop/complete-art',
        assetType: 'shop-complete-art-runtime-owner-cleared',
        sourceType: 'project-owned',
        sourcePath: primarySource.path,
        sourceSha256: primarySource.sha256.toLowerCase(),
        license: 'project-owned-deterministic-vector',
        author: 'OpenAI Codex for Ghost Game',
        status: 'integrated-local-only',
        dimensions: { width: 256, height: 256 },
        previewPath: rel(contactSheetPath),
        previewSha256: review.sha256.toLowerCase(),
        runtimePaths: runtimeVariants.map(item => item.path),
        promptPath: 'art-source/platform/shop/complete-art-v1/PROMPT_AND_PROVENANCE.md',
        model: null,
        remoteObjectKey: null
      });
      const productionIndex = (catalog.indexes || []).find(item => item.id === 'production-asset-manifest');
      if (productionIndex) productionIndex.sha256 = digest(MANIFEST_PATH).sha256.toLowerCase();
      write(catalogPath, JSON.stringify(catalog, null, 2));
    }

    console.log(`[P-SHOP-COMPLETE-ART-V1] Done! Total runtime bytes: ${totalRuntimeBytes} bytes.`);
  } finally {
    releaseLock();
  }
}

if (require.main === module){
  generateAll().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { generateAll, FAMILY_ID, SOURCE_ID, FLAG };
