'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source/games/xiangqi/final-art-v1/runtime-source');
const REVIEW_ROOT = path.join(ROOT, 'art-source/games/xiangqi/final-art-v1/review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/games/xiangqi/final-art-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const FAMILY_MANIFEST = path.join(ROOT, 'art-source/games/xiangqi/final-art-v1/asset-family-manifest-v1.json');

const FAMILY_ID = 'G-16-XIANGQI-FINAL-ART-V1';
const SOURCE_ID = 'ART-040-XIANGQI-FINAL-ART-V1';
const FLAG = 'mg_art_xiangqi_final_v1';

const BOARD_ROLES = ['board-background', 'board-midground', 'board-foreground'];
const PIECE_ROLES = [
  'piece-red-general', 'piece-red-advisor', 'piece-red-elephant', 'piece-red-horse',
  'piece-red-chariot', 'piece-red-cannon', 'piece-red-soldier',
  'piece-black-general', 'piece-black-advisor', 'piece-black-elephant', 'piece-black-horse',
  'piece-black-chariot', 'piece-black-cannon', 'piece-black-soldier'
];
const VFX_ROLES = [
  'vfx-piece-land', 'vfx-check-alert', 'vfx-checkmate-burst',
  'vfx-selected', 'vfx-capture', 'vfx-clock-warning'
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
  paper: '#F3E5C4',
  paperLight: '#FFF9F2',
  paperDark: '#E7C57F',
  wood: '#B87B44',
  woodDark: '#8A5A2B',
  ink: '#211923',
  inkLight: '#443443',
  redBase: '#FFF0E9',
  redShade: '#E99A7B',
  redInk: '#B85245',
  redDark: '#8B261D',
  blackBase: '#EDF6F4',
  blackShade: '#82AAB3',
  blackInk: '#315D78',
  blackDark: '#1B3B52',
  gold: '#F59E0B',
  goldLight: '#FDE68A',
  goldDark: '#B45309',
  jade: '#22C55E',
  coral: '#EF4444',
  river: '#7BB3C4',
  riverDark: '#4A8598',
  riverLight: '#C3E4ED',
  cream: '#FCF8EE',
  shade: '#D2B986'
};

function stroke(color, width = 8){
  return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
}
function shadow(cx, cy, rx, ry, opacity = 0.25){
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${C.ink}" fill-opacity="${opacity}"/>`;
}
function svg(w, h, content, bg = 'transparent'){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:${bg};">${content}</svg>`;
}

function boardBackground(){
  const w = 1080, h = 1200;
  return svg(w, h,
    shadow(w/2, h - 30, w/2 - 40, 24, 0.3) +
    `<rect x="36" y="36" width="${w-72}" height="${h-72}" rx="32" fill="${C.paper}" ${stroke(C.ink, 14)}/>` +
    `<rect x="56" y="56" width="${w-112}" height="${h-112}" rx="20" fill="none" ${stroke(C.shade, 6)}/>` +
    `<rect x="76" y="76" width="${w-152}" height="${h-152}" rx="12" fill="${C.paperLight}" ${stroke(C.inkLight, 8)}/>`
  );
}

function boardMidground(){
  const w = 1080, h = 1200;
  const padX = 100, padY = 100;
  const csX = (w - padX * 2) / 8;
  const csY = (h - padY * 2) / 9;
  let lines = '';
  for(let c = 0; c < 9; c++){
    const x = padX + c * csX;
    if(c === 0 || c === 8){
      lines += `<line x1="${x}" y1="${padY}" x2="${x}" y2="${h - padY}" ${stroke(C.ink, 8)}/>`;
    } else {
      lines += `<line x1="${x}" y1="${padY}" x2="${x}" y2="${padY + 4 * csY}" ${stroke(C.ink, 8)}/>`;
      lines += `<line x1="${x}" y1="${padY + 5 * csY}" x2="${x}" y2="${h - padY}" ${stroke(C.ink, 8)}/>`;
    }
  }
  for(let r = 0; r < 10; r++){
    const y = padY + r * csY;
    lines += `<line x1="${padX}" y1="${y}" x2="${w - padX}" y2="${y}" ${stroke(C.ink, 8)}/>`;
  }
  const palaceTop = `<line x1="${padX + 3*csX}" y1="${padY}" x2="${padX + 5*csX}" y2="${padY + 2*csY}" ${stroke(C.ink, 8)}/>` +
                    `<line x1="${padX + 5*csX}" y1="${padY}" x2="${padX + 3*csX}" y2="${padY + 2*csY}" ${stroke(C.ink, 8)}/>`;
  const palaceBottom = `<line x1="${padX + 3*csX}" y1="${padY + 7*csY}" x2="${padX + 5*csX}" y2="${padY + 9*csY}" ${stroke(C.ink, 8)}/>` +
                       `<line x1="${padX + 5*csX}" y1="${padY + 7*csY}" x2="${padX + 3*csX}" y2="${padY + 9*csY}" ${stroke(C.ink, 8)}/>`;
  const riverY = padY + 4.5 * csY;
  const river = `<rect x="${padX}" y="${padY + 4*csY}" width="${8*csX}" height="${csY}" fill="${C.riverLight}" fill-opacity=".45"/>` +
                `<text x="${padX + 2*csX}" y="${riverY + 14}" text-anchor="middle" fill="${C.riverDark}" font-size="44" font-family="sans-serif" font-weight="bold">楚 河</text>` +
                `<text x="${padX + 6*csX}" y="${riverY + 14}" text-anchor="middle" fill="${C.riverDark}" font-size="44" font-family="sans-serif" font-weight="bold">漢 界</text>`;
  return svg(w, h, river + lines + palaceTop + palaceBottom);
}

function boardForeground(){
  const w = 1080, h = 1200;
  return svg(w, h,
    `<circle cx="64" cy="64" r="16" fill="${C.gold}" ${stroke(C.ink, 6)}/>` +
    `<circle cx="${w-64}" cy="64" r="16" fill="${C.gold}" ${stroke(C.ink, 6)}/>` +
    `<circle cx="64" cy="${h-64}" r="16" fill="${C.gold}" ${stroke(C.ink, 6)}/>` +
    `<circle cx="${w-64}" cy="${h-64}" r="16" fill="${C.gold}" ${stroke(C.ink, 6)}/>`
  );
}

function xiangqiPiece(char, isRed){
  const w = 512, h = 512;
  const base = isRed ? C.redBase : C.blackBase;
  const shade = isRed ? C.redShade : C.blackShade;
  const ink = isRed ? C.redInk : C.blackInk;
  const dark = isRed ? C.redDark : C.blackDark;
  return svg(w, h,
    shadow(256, 440, 190, 48, 0.3) +
    `<circle cx="256" cy="240" r="190" fill="${C.woodDark}" ${stroke(C.ink, 14)}/>` +
    `<circle cx="256" cy="230" r="180" fill="${base}" ${stroke(C.ink, 12)}/>` +
    `<path d="M 120 230 A 136 136 0 0 0 392 230 A 136 136 0 0 1 120 230 Z" fill="${shade}" fill-opacity=".6"/>` +
    `<circle cx="256" cy="230" r="148" fill="none" ${stroke(dark, 8)}/>` +
    `<circle cx="256" cy="230" r="136" fill="none" ${stroke(dark, 4)}/>` +
    `<ellipse cx="190" cy="150" rx="36" ry="20" transform="rotate(-30 190 150)" fill="#FFF" fill-opacity=".75"/>` +
    `<text x="256" y="285" text-anchor="middle" fill="${ink}" font-size="140" font-family="'KaiTi', 'STKaiti', 'SimSun', sans-serif" font-weight="900">${char}</text>`
  );
}

function vfxSvg(role){
  if(role==='vfx-piece-land') return svg(512,512,
    `<circle cx="256" cy="256" r="180" fill="none" stroke="${C.gold}" stroke-width="24" stroke-dasharray="36 20"/>`+
    `<circle cx="256" cy="256" r="120" fill="${C.goldLight}" fill-opacity=".4" ${stroke(C.ink,10)}/>`+
    `<circle cx="256" cy="256" r="50" fill="#FFF" ${stroke(C.ink,8)}/>`
  );
  if(role==='vfx-check-alert') return svg(512,512,
    `<path d="M256 60 L450 420 H62 Z" fill="${C.coral}" ${stroke(C.ink,16)}/>`+
    `<path d="M256 120 L400 390 H112 Z" fill="${C.goldLight}" fill-opacity=".9"/>`+
    `<circle cx="256" cy="340" r="18" fill="${C.ink}"/>`+
    `<line x1="256" y1="190" x2="256" y2="290" stroke="${C.ink}" stroke-width="24" stroke-linecap="round"/>`
  );
  if(role==='vfx-checkmate-burst') return svg(512,512,
    shadow(256,440,180,36,.3)+
    `<path d="M256 40 L280 180 L420 120 L320 230 L450 310 L300 320 L310 460 L230 350 L110 420 L190 290 L50 240 L190 190 Z" fill="${C.coral}" ${stroke(C.ink,14)}/>`+
    `<circle cx="256" cy="256" r="80" fill="${C.goldLight}" ${stroke(C.ink,10)}/>`+
    `<circle cx="256" cy="256" r="32" fill="${C.gold}" ${stroke(C.ink,8)}/>`
  );
  if(role==='vfx-selected') return svg(512,512,
    `<circle cx="256" cy="256" r="220" fill="none" stroke="${C.jade}" stroke-width="14" stroke-dasharray="32 20"/>`+
    `<circle cx="256" cy="256" r="180" fill="${C.jade}" fill-opacity=".25" ${stroke(C.ink,8)}/>`+
    `<path d="M140 140 L180 140 M140 140 L140 180 M372 140 L332 140 M372 140 L372 180 M140 372 L180 372 M140 372 L140 332 M372 372 L332 372 M372 372 L372 332" stroke="${C.jade}" stroke-width="14" stroke-linecap="round"/>`
  );
  if(role==='vfx-capture') return svg(512,512,
    `<circle cx="256" cy="256" r="210" fill="${C.coral}" fill-opacity=".3" ${stroke(C.ink,12)}/>`+
    `<path d="M110 110 L402 402 M402 110 L110 402" stroke="${C.ink}" stroke-width="24" stroke-linecap="round"/>`+
    `<path d="M110 110 L402 402 M402 110 L110 402" stroke="${C.coral}" stroke-width="12" stroke-linecap="round"/>`+
    `<circle cx="256" cy="256" r="70" fill="${C.gold}" ${stroke(C.ink,10)}/>`
  );
  if(role==='vfx-clock-warning') return svg(512,512,
    `<circle cx="256" cy="256" r="220" fill="none" stroke="${C.coral}" stroke-width="18" stroke-dasharray="28 16"/>`+
    `<circle cx="256" cy="256" r="170" fill="${C.coral}" fill-opacity=".2"/>`+
    `<path d="M256 120 V256 L336 300" fill="none" stroke="${C.ink}" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>`+
    `<circle cx="256" cy="256" r="20" fill="${C.ink}"/>`
  );
  return svg(512,512,shadow(256,256,200,200,.2));
}

function cameraSvg(role){
  const desktop = role === 'camera-desktop';
  return svg(512,512,
    shadow(256,440,210,32,.25)+
    `<rect x="64" y="${desktop?120:80}" width="384" height="${desktop?272:352}" rx="28" fill="${C.cream}" ${stroke(C.ink,14)}/>`+
    `<rect x="96" y="${desktop?152:112}" width="320" height="${desktop?208:288}" rx="18" fill="${C.paper}" ${stroke(C.shade,6)}/>`+
    `<circle cx="256" cy="256" r="64" fill="${C.wood}" ${stroke(C.ink,10)}/>`+
    `<text x="256" y="270" text-anchor="middle" fill="${C.ink}" font-size="34" font-family="sans-serif" font-weight="900">${desktop?'OVERHEAD':'PORTRAIT'}</text>`
  );
}

function getMasterSvg(role){
  if(role==='board-background') return boardBackground();
  if(role==='board-midground') return boardMidground();
  if(role==='board-foreground') return boardForeground();
  if(role==='piece-red-general') return xiangqiPiece('帅', true);
  if(role==='piece-red-advisor') return xiangqiPiece('仕', true);
  if(role==='piece-red-elephant') return xiangqiPiece('相', true);
  if(role==='piece-red-horse') return xiangqiPiece('傌', true);
  if(role==='piece-red-chariot') return xiangqiPiece('俥', true);
  if(role==='piece-red-cannon') return xiangqiPiece('炮', true);
  if(role==='piece-red-soldier') return xiangqiPiece('兵', true);
  if(role==='piece-black-general') return xiangqiPiece('将', false);
  if(role==='piece-black-advisor') return xiangqiPiece('士', false);
  if(role==='piece-black-elephant') return xiangqiPiece('象', false);
  if(role==='piece-black-horse') return xiangqiPiece('馬', false);
  if(role==='piece-black-chariot') return xiangqiPiece('車', false);
  if(role==='piece-black-cannon') return xiangqiPiece('砲', false);
  if(role==='piece-black-soldier') return xiangqiPiece('卒', false);
  if(VFX_ROLES.includes(role)) return vfxSvg(role);
  if(CAMERA_ROLES.includes(role)) return cameraSvg(role);
  return svg(512,512,`<rect width="512" height="512" fill="${C.cream}"/>`);
}

async function renderRole(role, sourceFile, webpNormal, webpStatic){
  const svgText = getMasterSvg(role);
  write(sourceFile, svgText);
  const svgBuf = Buffer.from(svgText);
  const meta = await sharp(svgBuf).metadata();
  const width = meta.width || 512, height = meta.height || 512;
  const normalBuf = await sharp(svgBuf)
    .webp({ effort: 3, quality: 86, lossless: false })
    .toBuffer();
  write(webpNormal, normalBuf);
  const staticBuf = await sharp(svgBuf)
    .webp({ effort: 3, quality: 84, lossless: false })
    .toBuffer();
  write(webpStatic, staticBuf);
  return { width, height };
}

async function generate(){
  const releaseLock = acquireArtGeneratorLock('xiangqi-final-art-v1');
  try {
    ensure(SOURCE_ROOT); ensure(REVIEW_ROOT); ensure(RUNTIME_ROOT);
    const ALL_ROLES = [...BOARD_ROLES, ...PIECE_ROLES, ...VFX_ROLES, ...CAMERA_ROLES];
    const roleMeta = {};
    const sources = [];
    const variants = [];

    for(const role of ALL_ROLES){
      const src = path.join(SOURCE_ROOT, `${role}.svg`);
      const normal = path.join(RUNTIME_ROOT, `${role}-v1.webp`);
      const stat = path.join(RUNTIME_ROOT, `${role}-static-v1.webp`);
      roleMeta[role] = await renderRole(role, src, normal, stat);

      const srcDigest = digest(src);
      sources.push({
        role,
        path: rel(src),
        sha256: srcDigest.sha256,
        bytes: srcDigest.bytes,
        width: roleMeta[role].width,
        height: roleMeta[role].height,
        alpha: !role.startsWith('board-background'),
        kind: BOARD_ROLES.includes(role) ? 'layer' : (PIECE_ROLES.includes(role) ? 'piece' : (VFX_ROLES.includes(role) ? 'vfx' : 'camera'))
      });

      const normalDigest = digest(normal);
      variants.push({
        role,
        path: rel(normal),
        sha256: normalDigest.sha256,
        bytes: normalDigest.bytes,
        animated: false,
        width: roleMeta[role].width,
        height: roleMeta[role].height,
        mode: 'standard'
      });

      const statDigest = digest(stat);
      variants.push({
        role: `${role}-static`,
        path: rel(stat),
        sha256: statDigest.sha256,
        bytes: statDigest.bytes,
        animated: false,
        width: roleMeta[role].width,
        height: roleMeta[role].height,
        mode: 'static'
      });
    }

    // Compose review contact sheet (5x5 grid = 25 items)
    const TILE_W = 200, TILE_H = 200, COLS = 5, ROWS = 5;
    const sheetW = TILE_W * COLS + 60, sheetH = TILE_H * ROWS + 80;
    const compositeList = [];
    for(let i=0; i<ALL_ROLES.length; i++){
      const r = Math.floor(i / COLS), c = i % COLS;
      const x = 30 + c * TILE_W, y = 50 + r * TILE_H;
      const role = ALL_ROLES[i];
      const webpPath = path.join(RUNTIME_ROOT, `${role}-v1.webp`);
      const resized = await sharp(webpPath).resize(180, 180, { fit: 'contain', background: { r: 243, g: 229, b: 196, alpha: 0 } }).toBuffer();
      compositeList.push({ input: resized, top: y + 10, left: x + 10 });
    }
    const bgSvg = Buffer.from(svg(sheetW, sheetH,
      `<rect width="${sheetW}" height="${sheetH}" rx="24" fill="${C.paper}" ${stroke(C.ink,12)}/>`+
      `<text x="${sheetW/2}" y="36" text-anchor="middle" fill="${C.ink}" font-size="22" font-family="sans-serif" font-weight="bold">XIANGQI FINAL ART V1 RUNTIME REVIEW SHEET (P1-04)</text>`,
      C.cream
    ));
    const sheet = await sharp(bgSvg).composite(compositeList).png().toBuffer();
    const reviewFile = path.join(REVIEW_ROOT, 'xiangqi-final-runtime-contact-sheet-v1.png');
    write(reviewFile, sheet);
    const reviewHash = digest(reviewFile);

    const total = variants.reduce((sum, item) => sum + item.bytes, 0);

    // Build variants map for manifest
    const variantPaths = Object.fromEntries(variants.map(v => [v.role, v.path]));
    const variantHashes = Object.fromEntries(variants.map(v => [v.role, 'sha256:' + v.sha256.toLowerCase()]));
    const variantBytes = Object.fromEntries(variants.map(v => [v.role, v.bytes]));

    // Update asset-family-manifest-v1.json
    const familyManifest = {
      schemaVersion: 1,
      productionUnitId: 'P1-04',
      familyId: FAMILY_ID,
      sourceAssetId: SOURCE_ID,
      artworkVersion: 1,
      status: 'OWNER_AUTHORIZED_ART_CLEARANCE',
      license: 'project-owned-deterministic-svg-sharp',
      runtimeStrategy: 'Vanilla DOM + CSS + Canvas + GSAP 2.5D; no GLB/Three dependency',
      sourceOnlyInputs: {
        boardCover: 'art-source/games/xiangqi/cover-source-v1.png',
        pieceAtoms: 'art-source/games/xiangqi/piece-atoms-source-v1.png',
        externalInfluence: 'task-scoped semantic-only reference lane; no external pixels in runtime'
      },
      sources,
      variants,
      reviewBoards: [{ path: rel(reviewFile), ...reviewHash, width: sheetW, height: sheetH }],
      featureFlags: { operator: 'all', enabledValue: '1', defaultEnabled: true, ids: [FLAG] },
      metrics: {
        sourceMasterCount: sources.length,
        runtimeVariantCount: variants.length,
        runtimeBytes: total,
        runtimeByteBudget: 6 * 1024 * 1024,
        withinBudget: total <= 6 * 1024 * 1024,
        boardLayerCount: BOARD_ROLES.length,
        pieceAtomCount: PIECE_ROLES.length,
        semanticVfxCount: VFX_ROLES.length,
        cameraPresetCount: CAMERA_ROLES.length
      },
      authorityBoundary: 'presentation-only; XiangqiRules v2, clocks, moves, captured pieces, and tournament orchestrator remain authoritative live DOM/Rules',
      fallback: { chain: 'Xiangqi final art -> Tabletop Wave A paper board and CSS fallback' },
      release: 'LOCAL_ONLY_NOT_RELEASED',
      externalReferenceContext: {
        status: 'SOURCE_ONLY_EXTERNAL_INFLUENCED',
        license: 'EXTERNAL_REFERENCE_ONLY / blocked-license',
        transmissionRecord: 'art-source/games/xiangqi/final-art-v1/EXTERNAL_REFERENCE_TRANSMISSION.json',
        runtimeBoundary: 'No blocked-license pixel, layer, silhouette, palette, text or icon enters runtime.'
      }
    };
    write(FAMILY_MANIFEST, JSON.stringify(familyManifest, null, 2) + '\n');

    // Update asset_manifest.json
    if(fs.existsSync(MANIFEST_PATH)){
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
      manifest.assets = manifest.assets || [];
      manifest.assets = manifest.assets.filter(a => a && a.asset_id !== FAMILY_ID);
      const assetRecord = {
        asset_id: FAMILY_ID,
        source_asset_id: SOURCE_ID,
        name: 'Xiangqi Final Art v1',
        runtime_id: 'xiangqi',
        family_id: FAMILY_ID,
        artwork_version: 1,
        runtime_path: variantPaths['board-background'],
        variants: variantPaths,
        status: 'ready',
        clearance: 'OWNER_AUTHORIZED_ART_CLEARANCE',
        clearance_record: 'art-source/games/xiangqi/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md',
        feature_flags: {
          ids: [FLAG],
          operator: 'all',
          default_enabled: true,
          enabled_value: '1'
        },
        fallback_asset_id: 'G-16-XIANGQI-CSS-FALLBACK',
        fallback: 'existing Xiangqi DOM/CSS/Tabletop arena and Canvas piece fallback',
        load: 'lazy layered board; decode each layer before activation; remove nodes on game destroy; reduced-motion selects -static variants',
        a11y: 'decorative board layers and piece textures aria-hidden; live moves, clock, score, captured pieces and player names remain DOM/i18n',
        license: 'project-owned-deterministic-svg-sharp',
        source: 'art-source/games/xiangqi/final-art-v1/runtime-source',
        variant_integrity: variantHashes,
        variant_bytes: variantBytes,
        actual_bytes: total,
        byte_budget: 6 * 1024 * 1024,
        review_boards: [rel(reviewFile)]
      };
      manifest.assets.push(assetRecord);
      manifest.assets.sort((a,b) => String(a.asset_id).localeCompare(String(b.asset_id)));
      write(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
    }

    // Update catalog.json
    const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');
    if(fs.existsSync(CATALOG_PATH)){
      const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
      catalog.assets = catalog.assets || [];
      catalog.assets = catalog.assets.filter(a => a && a.id !== FAMILY_ID);
      const catRecord = {
        id: FAMILY_ID,
        category: 'game/xiangqi/final-art',
        assetType: 'xiangqi-final-board-piece-vfx-runtime-owner-cleared',
        sourceType: 'project-owned',
        sourcePath: 'art-source/games/xiangqi/final-art-v1/runtime-source/board-background.svg',
        sourceSha256: sources[0].sha256.toLowerCase(),
        license: 'project-owned-deterministic-svg-sharp',
        author: 'OpenAI Codex for Ghost Game',
        status: 'integrated-local-only',
        dimensions: { width: 1080, height: 1200 },
        previewPath: 'art-source/games/xiangqi/final-art-v1/review/xiangqi-final-runtime-contact-sheet-v1.png',
        previewSha256: reviewHash.sha256.toLowerCase(),
        runtimePaths: variants.map(v => v.path),
        promptPath: 'art-source/games/xiangqi/final-art-v1/PROMPT_AND_PROVENANCE.md',
        model: 'code-generated-svg-sharp-effort-3',
        remoteObjectKey: null
      };
      catalog.assets.push(catRecord);
      catalog.assets.sort((a,b) => String(a.id).localeCompare(String(b.id)));
      const manifestIndex = catalog.indexes && catalog.indexes.find(idx => idx && idx.id === 'production-asset-manifest');
      if(manifestIndex){
        const manifestDigest = digest(MANIFEST_PATH);
        manifestIndex.sha256 = manifestDigest.sha256.toLowerCase();
        manifestIndex.bytes = manifestDigest.bytes;
      }
      write(CATALOG_PATH, JSON.stringify(catalog, null, 2) + '\n');
    }

    console.log(`XIANGQI_FINAL_ART_GENERATION_SUCCESS sources=${sources.length} variants=${variants.length} bytes=${total}`);
  } finally {
    releaseLock();
  }
}

if(require.main === module){
  generate().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
