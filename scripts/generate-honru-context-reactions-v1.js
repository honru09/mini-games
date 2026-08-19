/* Ghost Game P0-08 deterministic Honru context reactions and quick stickers. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const SOURCE_ROOT = path.join(ROOT, 'art-source/brand/ghost-game/honru/context-reactions-v1');
const CHROMA_MASTER = path.join(SOURCE_ROOT, 'source/honru-hand-corrected-master-v1.png');
const MASTER = path.join(SOURCE_ROOT, 'derived/honru-hand-corrected-master-v1-alpha.png');
const CONTEXT_SOURCE_ROOT = path.join(SOURCE_ROOT, 'derived/context-states');
const QUICK_SOURCE_ROOT = path.join(SOURCE_ROOT, 'derived/quick-stickers');
const REVIEW_ROOT = path.join(SOURCE_ROOT, 'review');
const RUNTIME_ROOT = path.join(ROOT, 'public/assets/brand/honru/context-reactions-v1');
const MANIFEST_PATH = path.join(ROOT, 'public/assets/manifests/asset_manifest.json');
const CATALOG_PATH = path.join(ROOT, 'asset-library/catalog.json');

const CONTEXT_IDS = Object.freeze([
  'ready', 'your-turn', 'thinking', 'throw',
  'hit', 'capture', 'score', 'combo',
  'warning', 'reconnect', 'spectator', 'win',
  'lose', 'draw', 'rematch', 'celebration',
]);
const QUICK_GROUPS = Object.freeze({
  quick_hello: Object.freeze(['quick_hello_a', 'quick_hello_b', 'quick_hello_c']),
  quick_good_luck: Object.freeze(['quick_good_luck_a', 'quick_good_luck_b', 'quick_good_luck_c']),
  quick_nice: Object.freeze(['quick_nice_a', 'quick_nice_b', 'quick_nice_c']),
  quick_wow: Object.freeze(['quick_wow_a', 'quick_wow_b']),
  quick_thanks: Object.freeze(['quick_thanks_a', 'quick_thanks_b']),
  quick_again: Object.freeze(['quick_again_a', 'quick_again_b', 'quick_again_c']),
});
const QUICK_CELLS = Object.freeze(Object.values(QUICK_GROUPS).flat());
const COLORS = Object.freeze({
  ink:'#211923', paper:'#FFF9F2', cream:'#F3E5C4', teal:'#39B9B2', blue:'#508BF0',
  purple:'#8656CF', pink:'#E45CA4', yellow:'#F1B640', red:'#EF665F', green:'#4BCB83',
});

function ensure(...dirs) { dirs.forEach(dir => fs.mkdirSync(dir, { recursive:true })); }
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function digest(file) {
  const data = fs.readFileSync(file);
  return { sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(), bytes:data.length };
}
function writeJson(file, value) { ensure(path.dirname(file)); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function svg(content, size) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${content}</svg>`);
}
function stroke(color = COLORS.ink, width = 10) {
  return `stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"`;
}
function ring(cx, cy, r, color, width = 10, opacity = 1, dash = '') {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ${stroke(color, width)} opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}
function dot(cx, cy, r, color, opacity = 1) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}"/>`;
}
function sparkle(cx, cy, r, color) {
  const h = Math.round(r * .34);
  return `<path d="M${cx} ${cy-r}C${cx+h} ${cy-h} ${cx+h} ${cy-h} ${cx+r} ${cy}C${cx+h} ${cy+h} ${cx+h} ${cy+h} ${cx} ${cy+r}C${cx-h} ${cy+h} ${cx-h} ${cy+h} ${cx-r} ${cy}C${cx-h} ${cy-h} ${cx-h} ${cy-h} ${cx} ${cy-r}Z" fill="${color}" ${stroke(COLORS.ink, Math.max(4, Math.round(r * .16)))}/>`;
}
function star(cx, cy, outer, color, points = 5) {
  const coords = [];
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 ? outer * .44 : outer;
    const angle = -Math.PI / 2 + i * Math.PI / points;
    coords.push(`${(cx + Math.cos(angle) * radius).toFixed(1)},${(cy + Math.sin(angle) * radius).toFixed(1)}`);
  }
  return `<polygon points="${coords.join(' ')}" fill="${color}" ${stroke(COLORS.ink, Math.max(4, Math.round(outer * .13)))}/>`;
}
function arc(pathData, color, width = 12, opacity = 1, dash = '') {
  return `<path d="${pathData}" fill="none" ${stroke(color, width)} opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}
function heart(cx, cy, size, color) {
  return `<path d="M${cx} ${cy+size*.72}C${cx-size*1.2} ${cy-size*.02} ${cx-size*.72} ${cy-size} ${cx} ${cy-size*.35}C${cx+size*.72} ${cy-size} ${cx+size*1.2} ${cy-size*.02} ${cx} ${cy+size*.72}Z" fill="${color}" ${stroke(COLORS.ink, Math.max(4, Math.round(size * .18)))}/>`;
}
function arrowHead(x, y, rotation, color, scale = 1) {
  return `<path d="M${x} ${y}l${-22*scale} ${-13*scale}v${26*scale}Z" fill="${color}" ${stroke(COLORS.ink, Math.max(4, 7*scale))} transform="rotate(${rotation} ${x} ${y})"/>`;
}

function contextDecoration(id) {
  let behind = '', front = '';
  switch (id) {
    case 'ready':
      behind = ring(256, 272, 210, COLORS.green, 13, .35, '18 15') + ring(256, 272, 184, COLORS.yellow, 7, .3);
      front = sparkle(84, 124, 25, COLORS.green) + sparkle(426, 376, 22, COLORS.yellow);
      break;
    case 'your-turn':
      behind = ring(256, 268, 216, COLORS.blue, 15, .34, '35 18') + ring(256, 268, 190, COLORS.teal, 7, .32);
      front = arrowHead(440, 255, 0, COLORS.blue, .95) + dot(74, 255, 13, COLORS.teal);
      break;
    case 'thinking':
      behind = ring(256, 270, 208, COLORS.purple, 8, .25, '10 22');
      front = dot(414, 100, 25, COLORS.paper) + ring(414, 100, 25, COLORS.purple, 7) + dot(449, 64, 14, COLORS.paper) + ring(449, 64, 14, COLORS.purple, 5) + dot(471, 41, 7, COLORS.purple);
      break;
    case 'throw':
      behind = arc('M64 352C148 75 363 46 456 180', COLORS.yellow, 18, .5, '22 16');
      front = star(445, 170, 31, COLORS.yellow) + dot(78, 366, 15, COLORS.pink);
      break;
    case 'hit':
      behind = `<polygon points="256,28 292,119 380,75 360,170 466,162 394,240 482,292 377,312 411,414 315,370 270,474 230,374 127,423 158,317 50,294 143,240 64,158 169,170 145,68 232,118" fill="${COLORS.red}" opacity=".18"/>`;
      front = star(425, 120, 41, COLORS.red, 8) + arc('M80 126l42 30M66 184l52 5', COLORS.yellow, 10);
      break;
    case 'capture':
      behind = ring(256, 270, 214, COLORS.purple, 14, .28, '54 20') + ring(256, 270, 184, COLORS.pink, 8, .28);
      front = dot(76, 112, 21, COLORS.purple) + dot(435, 388, 24, COLORS.pink) + arc('M74 112C142 35 373 31 435 106', COLORS.purple, 9, .75, '12 14');
      break;
    case 'score':
      behind = ring(256, 270, 210, COLORS.yellow, 18, .28, '6 22');
      front = star(89, 118, 31, COLORS.yellow) + star(420, 104, 25, COLORS.yellow) + sparkle(444, 387, 25, COLORS.green);
      break;
    case 'combo':
      behind = ring(215, 268, 176, COLORS.teal, 15, .22) + ring(300, 268, 176, COLORS.pink, 15, .22);
      front = sparkle(79, 145, 26, COLORS.teal) + sparkle(431, 145, 26, COLORS.pink) + star(256, 49, 22, COLORS.yellow);
      break;
    case 'warning':
      behind = `<path d="M256 28 486 438H26Z" fill="${COLORS.yellow}" opacity=".22" ${stroke(COLORS.red, 13)}/>`;
      front = `<path d="M256 70v66" ${stroke(COLORS.red, 17)}/>${dot(256, 167, 10, COLORS.red)}`;
      break;
    case 'reconnect':
      behind = arc('M92 330A186 186 0 0 1 406 120', COLORS.blue, 18, .38, '52 16') + arc('M420 177A186 186 0 0 1 104 391', COLORS.teal, 12, .34, '40 16');
      front = arrowHead(413, 116, -48, COLORS.blue, 1) + arrowHead(97, 394, 132, COLORS.teal, .9);
      break;
    case 'spectator':
      behind = `<ellipse cx="256" cy="270" rx="232" ry="154" fill="${COLORS.blue}" opacity=".14" ${stroke(COLORS.teal, 12)}/>` + ring(256, 270, 78, COLORS.blue, 11, .28);
      front = sparkle(74, 117, 21, COLORS.teal) + sparkle(438, 117, 21, COLORS.blue);
      break;
    case 'win':
      behind = ring(256, 272, 216, COLORS.yellow, 18, .3, '8 18');
      front = `<path d="M184 88 218 120 256 70 294 120 330 88 318 150H194Z" fill="${COLORS.yellow}" ${stroke(COLORS.ink, 10)}/>` + star(83, 193, 27, COLORS.green) + star(430, 193, 27, COLORS.yellow);
      break;
    case 'lose':
      behind = ring(256, 280, 206, COLORS.blue, 11, .18, '10 24');
      front = `<path d="M76 128c22 27 22 46 0 62-22-16-22-35 0-62ZM430 318c24 30 24 50 0 68-24-18-24-38 0-68Z" fill="${COLORS.blue}" ${stroke(COLORS.ink, 7)}/>` + arc('M394 94l28 18M406 70l34 7', COLORS.blue, 8);
      break;
    case 'draw':
      behind = arc('M84 268H428', COLORS.purple, 12, .3) + arc('M256 80V444', COLORS.teal, 8, .22, '12 18');
      front = ring(80, 268, 31, COLORS.purple, 10) + ring(432, 268, 31, COLORS.teal, 10) + sparkle(256, 65, 20, COLORS.yellow);
      break;
    case 'rematch':
      behind = arc('M110 278A154 154 0 0 1 395 175', COLORS.green, 18, .32) + arc('M402 250A154 154 0 0 1 117 353', COLORS.blue, 13, .3);
      front = arrowHead(397, 173, -38, COLORS.green, 1.05) + arrowHead(115, 355, 142, COLORS.blue, .95);
      break;
    case 'celebration':
      behind = ring(256, 270, 218, COLORS.pink, 14, .24, '5 22') + ring(256, 270, 190, COLORS.yellow, 8, .22, '32 17');
      front = star(78, 108, 28, COLORS.yellow) + sparkle(438, 106, 27, COLORS.pink) + `<path d="M62 276l28-16 8 31-27 16ZM429 307l31 5-9 30-31-6ZM120 421l22-23 23 22-22 23Z" fill="${COLORS.teal}" ${stroke(COLORS.ink, 6)}/>`;
      break;
    default: throw new Error(`Unknown context ${id}`);
  }
  return { behind, front };
}

function quickDecoration(cellId) {
  const [protocol, variant] = Object.entries(QUICK_GROUPS).find(([, cells]) => cells.includes(cellId)) || [];
  if (!protocol) throw new Error(`Unknown quick cell ${cellId}`);
  const v = variant.indexOf(cellId);
  let behind = ring(128, 136, 111, COLORS.cream, 8, .5), front = '';
  if (protocol === 'quick_hello') {
    const color = [COLORS.teal, COLORS.blue, COLORS.yellow][v];
    behind += arc('M31 167A102 102 0 0 1 218 70', color, 10, .42, '16 12');
    front = v === 0 ? arc('M34 88l25-18M46 111l31-6', color, 8) : v === 1 ? sparkle(211, 60, 18, color) : star(43, 67, 18, color);
  } else if (protocol === 'quick_good_luck') {
    const color = [COLORS.green, COLORS.yellow, COLORS.teal][v];
    behind += ring(128, 136, 102, color, 10, .28, '7 16');
    front = v === 0 ? heart(42, 63, 18, color) + heart(74, 63, 18, color) : v === 1 ? star(208, 62, 24, color) : sparkle(44, 193, 22, color);
  } else if (protocol === 'quick_nice') {
    const color = [COLORS.yellow, COLORS.green, COLORS.pink][v];
    behind += ring(128, 136, 103, color, 11, .28);
    front = v === 0 ? `<path d="M78 50 96 68 118 40 139 68 160 50 153 87H85Z" fill="${color}" ${stroke(COLORS.ink, 6)}/>` : v === 1 ? sparkle(205, 63, 23, color) : star(47, 185, 21, color);
  } else if (protocol === 'quick_wow') {
    const color = [COLORS.purple, COLORS.red][v];
    behind += `<polygon points="128,11 148,53 190,26 184,73 234,70 202,108 245,132 199,145 221,190 174,178 163,228 130,193 96,228 84,179 36,191 59,145 12,132 55,108 23,70 73,73 66,26 108,53" fill="${color}" opacity=".2"/>`;
    front = star(v ? 206 : 48, 61, 24, color, 8);
  } else if (protocol === 'quick_thanks') {
    const color = [COLORS.pink, COLORS.purple][v];
    behind += ring(128, 136, 103, color, 10, .25, '28 15');
    front = v === 0 ? heart(207, 67, 25, color) : heart(47, 183, 23, color) + sparkle(211, 61, 14, COLORS.yellow);
  } else if (protocol === 'quick_again') {
    const color = [COLORS.blue, COLORS.green, COLORS.purple][v];
    behind += arc('M40 144A89 89 0 0 1 208 92', color, 10, .35) + arc('M214 126A89 89 0 0 1 47 181', COLORS.teal, 8, .28);
    front = v === 0 ? arrowHead(208, 91, -30, color, .55) : v === 1 ? arrowHead(47, 181, 147, color, .55) : sparkle(209, 58, 18, color);
  }
  return { behind, front, protocolId:protocol, variant:String.fromCharCode(65 + v) };
}

async function renderComposite(size, masterSize, decoration) {
  const master = await sharp(MASTER).resize(masterSize, masterSize, { fit:'contain' }).png().toBuffer();
  const offset = Math.round((size - masterSize) / 2);
  return sharp({ create:{ width:size, height:size, channels:4, background:{ r:0, g:0, b:0, alpha:0 } } })
    .composite([
      { input:svg(decoration.behind, size), left:0, top:0 },
      { input:master, left:offset, top:offset },
      { input:svg(decoration.front, size), left:0, top:0 },
    ]).png({ compressionLevel:9, effort:10 }).toBuffer();
}

async function imageRecord(file, extra = {}) {
  const meta = await sharp(file).metadata();
  const hash = digest(file);
  return { path:rel(file), sha256:hash.sha256, bytes:hash.bytes, width:meta.width, height:meta.height, format:meta.format, alpha:!!meta.hasAlpha, ...extra };
}

async function makeContactSheet(files, output, size, columns, tile, background) {
  const rows = Math.ceil(files.length / columns);
  const parts = [];
  for (let i = 0; i < files.length; i++) {
    const input = await sharp(files[i]).resize(tile - 24, tile - 24, { fit:'contain' }).png().toBuffer();
    parts.push({ input, left:(i % columns) * tile + 12, top:Math.floor(i / columns) * tile + 12 });
  }
  await sharp({ create:{ width:size.width, height:size.height || rows * tile, channels:4, background } }).composite(parts).png({ compressionLevel:9, effort:10 }).toFile(output);
}

async function main() {
  if (!fs.existsSync(CHROMA_MASTER) || !fs.existsSync(MASTER)) throw new Error('Missing approved chroma or alpha mother');
  ensure(CONTEXT_SOURCE_ROOT, QUICK_SOURCE_ROOT, REVIEW_ROOT, path.join(RUNTIME_ROOT, 'contexts'));
  const masterMeta = await sharp(MASTER).metadata();
  if (masterMeta.width !== 1254 || masterMeta.height !== 1254 || !masterMeta.hasAlpha) throw new Error('Approved mother must remain 1254x1254 RGBA');

  const contextSources = [], runtimeContexts = [], contextFiles = [];
  for (const id of CONTEXT_IDS) {
    const source = path.join(CONTEXT_SOURCE_ROOT, `honru-context-${id}-v1.png`);
    const runtime = path.join(RUNTIME_ROOT, 'contexts', `honru-context-${id}-v1.webp`);
    const buffer = await renderComposite(512, 480, contextDecoration(id));
    fs.writeFileSync(source, buffer);
    await sharp(buffer).resize(320, 320).webp({ quality:90, alphaQuality:100, effort:6 }).toFile(runtime);
    contextSources.push(await imageRecord(source, { id, bakedText:false, sourceMotherSha256:digest(MASTER).sha256 }));
    runtimeContexts.push(await imageRecord(runtime, { id, bakedText:false }));
    contextFiles.push(source);
  }

  const quickSources = [], quickFiles = [], quickCellMap = {};
  for (let i = 0; i < QUICK_CELLS.length; i++) {
    const cellId = QUICK_CELLS[i], info = quickDecoration(cellId);
    const source = path.join(QUICK_SOURCE_ROOT, `honru-${cellId.replace(/_/g, '-')}-v1.png`);
    const buffer = await renderComposite(256, 220, info);
    fs.writeFileSync(source, buffer);
    quickSources.push(await imageRecord(source, { id:cellId, protocolId:info.protocolId, variant:info.variant, bakedText:false, sourceMotherSha256:digest(MASTER).sha256 }));
    quickFiles.push(source);
    quickCellMap[cellId] = { x:(i % 4) * 256, y:Math.floor(i / 4) * 256, w:256, h:256, protocol_id:info.protocolId, variant:info.variant };
  }

  const atlas = path.join(RUNTIME_ROOT, 'honru-quick-atlas-v1.webp');
  const atlasParts = quickFiles.map((file, i) => ({ input:file, left:(i % 4) * 256, top:Math.floor(i / 4) * 256 }));
  await sharp({ create:{ width:1024, height:1024, channels:4, background:{ r:0, g:0, b:0, alpha:0 } } })
    .composite(atlasParts).webp({ quality:90, alphaQuality:100, effort:6 }).toFile(atlas);

  const contextBoard = path.join(REVIEW_ROOT, 'honru-context-contact-sheet-v1.png');
  const quickBoard = path.join(REVIEW_ROOT, 'honru-quick-contact-sheet-v1.png');
  const poster = path.join(REVIEW_ROOT, 'honru-context-reactions-poster-v1.png');
  await makeContactSheet(contextFiles, contextBoard, { width:1280, height:1280 }, 4, 320, COLORS.paper);
  await makeContactSheet(quickFiles, quickBoard, { width:1024, height:1024 }, 4, 256, COLORS.cream);
  const posterParts = [];
  for (let i = 0; i < contextFiles.length; i++) posterParts.push({ input:await sharp(contextFiles[i]).resize(184, 184).png().toBuffer(), left:(i % 4) * 200 + 8, top:Math.floor(i / 4) * 220 + 10 });
  for (let i = 0; i < quickFiles.length; i++) posterParts.push({ input:await sharp(quickFiles[i]).resize(184, 184).png().toBuffer(), left:800 + (i % 4) * 200 + 8, top:Math.floor(i / 4) * 220 + 10 });
  await sharp({ create:{ width:1600, height:900, channels:4, background:COLORS.paper } }).composite(posterParts).png({ compressionLevel:9, effort:10 }).toFile(poster);

  const atlasRecord = await imageRecord(atlas, { bakedText:false });
  const reviewBoards = await Promise.all([
    imageRecord(contextBoard, { role:'context-contact-sheet' }),
    imageRecord(quickBoard, { role:'quick-contact-sheet' }),
    imageRecord(poster, { role:'family-poster' }),
  ]);
  const motherRecord = await imageRecord(MASTER, { role:'approved-identity-anchor' });
  const chromaMotherRecord = await imageRecord(CHROMA_MASTER, { role:'owner-approved-generation-master' });
  const runtimeBytes = runtimeContexts.reduce((sum, row) => sum + row.bytes, 0) + atlasRecord.bytes;
  const family = {
    schemaVersion:1,
    productionUnitId:'P0-08',
    familyId:'P-HONRU-CONTEXT-REACTIONS-V1',
    sourceAssetId:'ART-HONRU-CONTEXT-REACTIONS-V1',
    artworkVersion:1,
    status:'OWNER_AUTHORIZED_ART_CLEARANCE',
    license:'project-owned-derived-from-owner-approved-ai-generated-honru',
    generationMethod:'deterministic Sharp composition from the approved Q-hand Honru alpha mother; no external generation endpoint used for derivatives',
    identityLock:{
      preserve:['three flame-shaped head peaks','white/cream palette','pale cheek blush','D-pad left eye','four-button right eye','smile','two lower feet','proportions and composition'],
      hands:'single smooth circular/oval Q-version ghost puffs; no fingers, thumb, palm, knuckles, nails or gaps',
    },
    externalReferencePolicy:'No EXTERNAL_REFERENCE_ONLY / blocked-license pixels or layers were read, copied, traced or transmitted for these derivatives.',
    sourceChromaMother:chromaMotherRecord,
    sourceMother:motherRecord,
    contextIds:CONTEXT_IDS,
    quickProtocolIds:Object.keys(QUICK_GROUPS),
    quickGroups:QUICK_GROUPS,
    contextSources,
    quickSources,
    runtimeContexts,
    quickAtlas:{ ...atlasRecord, columns:4, rows:4, cell:256, cells:quickCellMap },
    reviewBoards,
    featureFlags:{ operator:'all', enabledValue:'1', defaultEnabled:true, ids:['mg_art_honru_context_reactions_v1','mg_art_honru_quick_stickers_v1'] },
    metrics:{ contextSourceCount:contextSources.length, runtimeContextCount:runtimeContexts.length, quickSourceCount:quickSources.length, quickAtlasCellCount:Object.keys(quickCellMap).length, reviewBoardCount:reviewBoards.length, runtimeBytes, runtimeByteBudget:2*1024*1024, withinBudget:runtimeBytes<=2*1024*1024 },
    fallback:{ context:'new context -> mapped P-HONRU-STATES-V1 state -> P-002-HONRU-MASCOT-V1 SVG', quick:'new quick atlas cell -> localized quick text; existing emoji path remains independent' },
    a11y:'All bitmaps are decorative and contain no baked text; localized HTML labels remain authoritative.',
    authorityBoundary:'Presentation only. No protocol, Rule Authority, Reward, Replay, AI, Analytics, Direct Chat, Match Chat or persistence fields are added or changed.',
  };
  writeJson(path.join(SOURCE_ROOT, 'asset-family-manifest-v1.json'), family);

  const runtimeVariants = Object.fromEntries(runtimeContexts.map(row => [row.id, row.path]));
  const variantIntegrity = Object.fromEntries(runtimeContexts.map(row => [row.id, `sha256:${row.sha256.toLowerCase()}`]));
  const variantBytes = Object.fromEntries(runtimeContexts.map(row => [row.id, row.bytes]));
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  manifest.assets = manifest.assets.filter(item => item && item.asset_id !== family.familyId);
  manifest.assets.push({
    asset_id:family.familyId,
    runtime_id:'honru',
    artwork_version:1,
    runtime_path:runtimeVariants.ready,
    variants:runtimeVariants,
    quick_atlas:atlasRecord.path,
    quick_groups:QUICK_GROUPS,
    atlas:{ width:1024, height:1024, columns:4, rows:4, cell:256 },
    cells:quickCellMap,
    logical_size:'16 context states at <=192 CSS px; 16 quick visuals mapped to six stable protocol IDs',
    pixel_size:'512x512 RGBA sources; 320x320 alpha WebP contexts; 1024x1024 alpha WebP atlas with 256px cells',
    status:'ready',
    clearance:'OWNER_AUTHORIZED_ART_CLEARANCE',
    source_asset_id:family.sourceAssetId,
    feature_flags:{ operator:'all', enabled_value:'1', default_enabled:true, ids:['mg_art_honru_context_reactions_v1','mg_art_honru_quick_stickers_v1'] },
    fallback_asset_id:'P-HONRU-STATES-V1',
    fallback:'mapped P-HONRU-STATES-V1 state, P-002-HONRU-MASCOT-V1 SVG, or localized quick text',
    load:'context image on reaction demand; quick atlas on first visible quick picker/bubble/flight; decode before activation',
    a11y:'decorative no-text art; localized HTML owns all expression and game-state semantics',
    license:family.license,
    source:'art-source/brand/ghost-game/honru/context-reactions-v1',
    clearance_record:'art-source/brand/ghost-game/honru/context-reactions-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md',
    integrity:variantIntegrity.ready,
    variant_integrity:variantIntegrity,
    variant_bytes:variantBytes,
    quick_atlas_integrity:`sha256:${atlasRecord.sha256.toLowerCase()}`,
    quick_atlas_bytes:atlasRecord.bytes,
    actual_bytes:runtimeBytes,
    byte_budget:2*1024*1024,
  });
  writeJson(MANIFEST_PATH, manifest);

  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
  catalog.updatedAt = '2026-08-19';
  catalog.assets = catalog.assets.filter(item => item && item.id !== family.familyId);
  catalog.assets.push({
    id:family.familyId,
    category:'platform/honru-context-reactions',
    assetType:'honru-context-and-quick-runtime-owner-cleared',
    sourceType:'project-owned',
    sourcePath:motherRecord.path,
    sourceSha256:motherRecord.sha256.toLowerCase(),
    license:family.license,
    author:'OpenAI Codex for Ghost Game',
    status:'integrated-local-only',
    dimensions:{ width:motherRecord.width, height:motherRecord.height },
    previewPath:rel(poster),
    previewSha256:digest(poster).sha256.toLowerCase(),
    runtimePaths:[...runtimeContexts.map(row => row.path), atlasRecord.path],
    promptPath:'art-source/brand/ghost-game/honru/context-reactions-v1/PROMPT_AND_PROVENANCE.md',
    model:'codex-built-in-imagegen mother + deterministic Sharp derivatives',
    remoteObjectKey:null,
  });
  writeJson(CATALOG_PATH, catalog);

  console.log('P0-08 Honru context reactions generated', {
    contexts:contextSources.length,
    quickCells:quickSources.length,
    runtimeBytes,
    atlasBytes:atlasRecord.bytes,
    poster:rel(poster),
  });
}

main().catch(error => { console.error(error); process.exitCode = 1; });
