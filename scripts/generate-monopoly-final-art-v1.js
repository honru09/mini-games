/* Ghost Game P1-01 deterministic source extraction for Monopoly Final Art v1. */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { acquireArtGeneratorLock } = require('./art-generator-lock');

const ROOT = path.resolve(__dirname, '..');
const FAMILY_ROOT = path.join(ROOT, 'art-source/games/monopoly/final-art-v1');
const BOARD_SOURCE = path.join(FAMILY_ROOT, 'monopoly-city-board-source-v1.png');
const REJECTED_ALPHA_SOURCE = path.join(FAMILY_ROOT, 'monopoly-building-prop-kit-source-v1.png');
const CHROMA_SOURCE = path.join(FAMILY_ROOT, 'monopoly-building-prop-kit-chroma-source-v1.png');
const DERIVED_ROOT = path.join(FAMILY_ROOT, 'derived/atoms');
const REVIEW_ROOT = path.join(FAMILY_ROOT, 'review/generated');
const FAMILY_MANIFEST = path.join(FAMILY_ROOT, 'source-extraction-manifest-v1.json');
const LOCK_PATH = path.join(ROOT, '.tmp/art-generator-locks/monopoly-final-art-v1.lock');

const FAMILY_ID = 'G-15-MONOPOLY-FINAL-ART-V1';
const SOURCE_ID = 'ART-036-MONOPOLY-FINAL-ART-V1';
const OBJECTS = Object.freeze([
  { id:'townhouse-sage', col:0, row:0 },
  { id:'city-hall-ink', col:1, row:0 },
  { id:'market-pavilion-blue', col:0, row:1 },
  { id:'tower-landmark-coral', col:1, row:1 },
  { id:'wrought-gate-sage', col:0, row:2 },
  { id:'chance-card-stack', col:1, row:2 },
]);
const CHARACTER_POSES = Object.freeze([
  'idle-front-v1.png',
  'walk-contact-a-v1.png',
  'walk-passing-b-v1.png',
  'victory-compact-v1.png',
]);

function ensure(dir) { fs.mkdirSync(dir, { recursive:true }); }
function resetGeneratedDir(dir) {
  const resolved = path.resolve(dir);
  if (resolved === ROOT || !resolved.startsWith(`${ROOT}${path.sep}`)) {
    throw new Error(`Refusing unsafe generated-dir reset: ${resolved}`);
  }
  fs.rmSync(resolved, { recursive:true, force:true, maxRetries:20, retryDelay:100 });
  fs.mkdirSync(resolved, { recursive:true });
}
function rel(file) { return path.relative(ROOT, file).replace(/\\/g, '/'); }
function digest(file) {
  const data = fs.readFileSync(file);
  return {
    sha256:crypto.createHash('sha256').update(data).digest('hex').toUpperCase(),
    bytes:data.length,
  };
}
function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }

function removeChroma(data, info) {
  if (info.channels !== 3) throw new Error(`Expected RGB chroma source, got ${info.channels} channels`);
  const output = Buffer.alloc(info.width * info.height * 4);
  for (let pixel = 0, src = 0, dst = 0; pixel < info.width * info.height; pixel += 1, src += 3, dst += 4) {
    const r = data[src];
    const g = data[src + 1];
    const b = data[src + 2];
    const minRB = Math.min(r, b);
    const rbDiff = Math.abs(r - b);
    const chroma = minRB - g;
    const hueBalance = clamp((100 - rbDiff) / 78);
    const saturation = clamp((chroma - 30) / 112);
    const brightness = clamp((minRB - 58) / 142);
    const background = clamp(hueBalance * saturation * (0.18 + 0.82 * brightness));
    let alpha = Math.round(255 * (1 - background));
    let outR = r;
    let outG = g;
    let outB = b;

    if (alpha <= 4) {
      alpha = 0;
      outR = 0;
      outG = 0;
      outB = 0;
    } else if (background > 0.02) {
      const a = alpha / 255;
      const inv = 1 - a;
      outR = clamp(Math.round((r - inv * 240) / a), 0, 255);
      outG = clamp(Math.round((g - inv * 16) / a), 0, 255);
      outB = clamp(Math.round((b - inv * 232) / a), 0, 255);
    }

    if (alpha > 0 && Math.min(outR, outB) - outG > 16 && Math.abs(outR - outB) < 80) {
      const neutral = Math.round((outR + outG + outB) / 3);
      outR = neutral;
      outB = neutral;
    }

    output[dst] = outR;
    output[dst + 1] = outG;
    output[dst + 2] = outB;
    output[dst + 3] = alpha;
  }
  return output;
}

async function alphaStats(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  let transparent = 0;
  let opaque = 0;
  let partial = 0;
  let magentaRisk = 0;
  let edgeVisible = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) transparent += 1;
      else if (a === 255) opaque += 1;
      else partial += 1;
      if (a >= 32 && r > g + 60 && b > g + 60 && Math.abs(r - b) < 80) magentaRisk += 1;
      if ((x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) && a > 0) edgeVisible += 1;
    }
  }
  return { width:info.width, height:info.height, transparent, partial, opaque, magentaRisk, edgeVisible };
}

/**
 * The chroma source contains a few deliberate contact shadows that render as
 * purple/magenta on both review backgrounds. They are not part of the
 * Ghost-native palette, so normalize only the near-neutral magenta family
 * after extraction. Blue roofs and coral accents are intentionally excluded
 * by the tight r/b balance check.
 */
async function neutralizeMagentaPixels(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject:true });
  let changed = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 12) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const balancedMagenta = Math.abs(r - b) <= 44 && r > g + 12 && b > g + 12;
    if (!balancedMagenta) continue;
    const neutral = Math.round((r * 0.34 + g * 0.42 + b * 0.24));
    data[i] = neutral;
    data[i + 1] = neutral;
    data[i + 2] = neutral;
    changed += 1;
  }
  if (changed === 0) return { changed:0 };
  await sharp(data, { raw:{ width:info.width, height:info.height, channels:4 } })
    .png({ compressionLevel:9, effort:10 })
    .toFile(file);
  return { changed };
}

async function extractAtoms() {
  const { data, info } = await sharp(CHROMA_SOURCE).raw().toBuffer({ resolveWithObject:true });
  const rgba = removeChroma(data, info);
  const cellWidth = Math.floor(info.width / 2);
  const cellHeight = Math.floor(info.height / 3);
  const assets = [];

  for (const item of OBJECTS) {
    const left = item.col * cellWidth;
    const top = item.row * cellHeight;
    const width = item.col === 1 ? info.width - left : cellWidth;
    const height = item.row === 2 ? info.height - top : cellHeight;
    const file = path.join(DERIVED_ROOT, `${item.id}-source-v1.png`);
    const temp = path.join(DERIVED_ROOT, `.${item.id}.crop.png`);
    await sharp(Buffer.from(rgba), { raw:{ width:info.width, height:info.height, channels:4 } })
      .extract({ left, top, width, height })
      .png({ compressionLevel:9, effort:10 })
      .toFile(temp);
    await sharp(temp)
      .trim({ background:{ r:0, g:0, b:0, alpha:0 }, threshold:2 })
      .extend({ top:20, right:20, bottom:20, left:20, background:{ r:0, g:0, b:0, alpha:0 } })
      .png({ compressionLevel:9, effort:10 })
      .toFile(file);
    fs.rmSync(temp, { force:true });
    await neutralizeMagentaPixels(file);
    const metadata = await alphaStats(file);
    assets.push({ id:item.id, path:rel(file), ...digest(file), ...metadata });
  }
  return assets;
}

async function createReviewBoard(assets) {
  const tile = 280;
  const panelWidth = tile * 2;
  const panelHeight = tile * 3;
  const width = panelWidth * 2;
  const height = panelHeight;
  const composites = [];
  for (let panel = 0; panel < 2; panel += 1) {
    for (let index = 0; index < assets.length; index += 1) {
      const file = path.join(ROOT, assets[index].path);
      const image = await sharp(file)
        .resize(tile - 42, tile - 42, { fit:'contain', background:{ r:0, g:0, b:0, alpha:0 } })
        .png()
        .toBuffer();
      composites.push({
        input:image,
        left:panel * panelWidth + (index % 2) * tile + 21,
        top:Math.floor(index / 2) * tile + 21,
      });
    }
  }
  const light = await sharp({ create:{ width:panelWidth, height, channels:4, background:'#FFF9F2' } }).png().toBuffer();
  const dark = await sharp({ create:{ width:panelWidth, height, channels:4, background:'#211923' } }).png().toBuffer();
  const output = path.join(REVIEW_ROOT, 'monopoly-object-atoms-light-dark-v1.png');
  await sharp({ create:{ width, height, channels:4, background:'#FFF9F2' } })
    .composite([{ input:light, left:0, top:0 }, { input:dark, left:panelWidth, top:0 }, ...composites])
    .png({ compressionLevel:9, effort:10 })
    .toFile(output);
  return { path:rel(output), ...digest(output), width, height };
}

async function sourceRecord(file, extra = {}) {
  const metadata = await sharp(file).metadata();
  return {
    path:rel(file),
    ...digest(file),
    width:metadata.width,
    height:metadata.height,
    channels:metadata.channels,
    hasAlpha:Boolean(metadata.hasAlpha),
    ...extra,
  };
}

async function main() {
  const release = acquireArtGeneratorLock(LOCK_PATH, { generatorId:'monopoly-final-art-v1', waitMs:120000 });
  try {
    for (const file of [BOARD_SOURCE, REJECTED_ALPHA_SOURCE, CHROMA_SOURCE]) {
      if (!fs.existsSync(file)) throw new Error(`Missing source: ${rel(file)}`);
    }
    resetGeneratedDir(DERIVED_ROOT);
    resetGeneratedDir(REVIEW_ROOT);
    const assets = await extractAtoms();
    const reviewBoard = await createReviewBoard(assets);
    const characterDependencies = [];
    for (const pose of CHARACTER_POSES) {
      const file = path.join(ROOT, 'art-source/player-character/layered-v1/source/poses', pose);
      if (!fs.existsSync(file)) throw new Error(`Missing P0-10 character dependency: ${rel(file)}`);
      characterDependencies.push(await sourceRecord(file, { role:'reused-p0-10-character-pose' }));
    }
    const manifest = {
      schemaVersion:1,
      familyId:FAMILY_ID,
      sourceId:SOURCE_ID,
      productionUnitId:'P1-01',
      status:'SOURCE_EXTRACTION_IN_PROGRESS',
      license:'project-owned-original',
      runtimeIntegration:'NOT_STARTED',
      sources:{
        board:await sourceRecord(BOARD_SOURCE, { decision:'accepted-source-master' }),
        falseTransparency:await sourceRecord(REJECTED_ALPHA_SOURCE, { decision:'rejected-for-runtime', reason:'RGB checkerboard was baked into pixels; retained as source-only visual evidence' }),
        chroma:await sourceRecord(CHROMA_SOURCE, { decision:'accepted-for-deterministic-alpha-extraction', matte:'#FF00FF requested; generated field varies and is removed by bounded chroma model' }),
      },
      objectAtoms:assets,
      characterDependencies,
      reviewBoards:[reviewBoard],
      metrics:{ objectAtoms:assets.length, runtimeVariants:0, sourceBytes:assets.reduce((sum, asset) => sum + asset.bytes, 0) },
      boundaries:{
        authority:'presentation-only; no Rule/Authority/Protocol/Reward/Economy/Replay/AI/Persistence changes',
        fallback:'current Monopoly DOM/CSS/Canvas board and existing P0-10 character/code token',
        renderer:'DOM/CSS/Canvas + GSAP 2.5D only; no Three/Ghost3D dependency',
        release:'LOCAL_ONLY_NOT_RELEASED',
      },
    };
    fs.writeFileSync(FAMILY_MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`MONOPOLY_FINAL_ART_SOURCE_OK atoms=${assets.length} bytes=${manifest.metrics.sourceBytes} manifest=${rel(FAMILY_MANIFEST)}`);
  } finally {
    release();
  }
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
