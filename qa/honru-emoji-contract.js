'use strict';

// Dual-state contract for Honru Emoji v1. The source-only state must have no
// public runtime traces. Once any runtime trace exists, the whole
// owner-clearance/Manifest/flags/fallback/consumer bundle becomes mandatory;
// orphan public files always fail closed.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const EMOJI_ROOT = 'art-source/brand/ghost-game/honru/emoji-v1';
const PROMPT_PATH = EMOJI_ROOT + '/PROMPT_AND_PROVENANCE.md';
const EXPECTED_EMOJIS = [
  { id: 'emoji_wave', glyph: '👋', stem: 'wave', catalogId: 'G-17-HONRU-EMOJI-WAVE-V1', sha256: '2b9f4739461907872f6bef5b8cd7774b37d2eff3f35eeb96aa960515279686cf' },
  { id: 'emoji_thumbsup', glyph: '👍', stem: 'thumbsup', catalogId: 'G-18-HONRU-EMOJI-THUMBSUP-V1', sha256: '47ca91aca893feaf8e5a2bdacb32c09235c90068f93be667e793025769497108' },
  { id: 'emoji_cheer', glyph: '🎉', stem: 'cheer', catalogId: 'G-19-HONRU-EMOJI-CHEER-V1', sha256: '54893f913282b39e66adbf9d018ee96e61fe695e5aa843134fc9ab804a62a0c2' },
  { id: 'emoji_wow', glyph: '😮', stem: 'wow', catalogId: 'G-20-HONRU-EMOJI-WOW-V1', sha256: '9316d71dd1a20c5b5320701dd053d37a472daad3557a9d817f805be7fa08d727' },
  { id: 'emoji_oops', glyph: '😅', stem: 'oops', catalogId: 'G-21-HONRU-EMOJI-OOPS-V1', sha256: 'efe5f1dd3f50822edd1e2a8e2d7e029eee9b0d14cc037185e5ee06ee4ed7cd31' },
  { id: 'emoji_cry', glyph: '😭', stem: 'cry', catalogId: 'G-22-HONRU-EMOJI-CRY-V1', sha256: 'f9805061309e9f40099ce926ab95b73050348674bf2f6e1c0e69aa38266a0b59' },
  { id: 'emoji_angry', glyph: '😠', stem: 'angry', catalogId: 'G-23-HONRU-EMOJI-ANGRY-V1', sha256: 'd2d5c8d882b90077f2fd8ecb9673a2d58af63eb23463460d3a81e6352d0e8a3e' },
  { id: 'emoji_sly', glyph: '😏', stem: 'sly', catalogId: 'G-24-HONRU-EMOJI-SLY-V1', sha256: '55dc15664ed9e022acc3d0b3f7ea22351d0d4db438c776d8b9f120bdaab9175a' },
  { id: 'emoji_heart', glyph: '❤️', stem: 'heart', catalogId: 'G-25-HONRU-EMOJI-HEART-V1', sha256: '5176027d91885562847a612c486536745b2175a1f382cb1caccac2fcaf124a74' },
  { id: 'emoji_game', glyph: '🎮', stem: 'game', catalogId: 'G-26-HONRU-EMOJI-GAME-V1', sha256: 'd187b335eec57b3ae7530ace1ed66416764918c8eeb22325e4ceb57b06254c38' },
];
const PACKET = {
  id: 'G-27-HONRU-EMOJI-PACKET-V1',
  sourcePath: EMOJI_ROOT + '/atlas/honru-emoji-atlas-draft-v1.png',
  sourceSha256: 'a767fd48b1b738e4b1939d8b368acc0df51dee7199af9db65c3899b4308d6ba7',
  previewPath: EMOJI_ROOT + '/poster/honru-emoji-poster-draft-v1.png',
  previewSha256: '4b22256408b4222b99ba53b94af65c82a96fc1571b891b9c45e4c0869801e01d',
  stripPath: EMOJI_ROOT + '/poster/honru-emoji-44px-strip-draft-v1.png',
};
const RUNTIME = {
  assetId: 'P-HONRU-EMOJI-V1',
  clearancePath: 'requirements/active/honru-emoji-runtime-p0-20260811/OWNER_AUTHORIZED_ART_CLEARANCE.md',
  atlasPath: 'public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp',
  atlasSha256: '63108f289eab68f096cae59e2c32623e9e09b67fbebebb3383cc317494530d6a',
  atlasBytes: 302314,
  posterPath: 'public/assets/brand/honru/emoji-v1/honru-emoji-poster-v1.webp',
  posterSha256: 'ec4b5a263839367a6ddcb9ced1b1b58fa2cbd24b0812b290be17eb7da84b9e35',
  posterBytes: 67146,
  totalBytes: 369460,
  byteBudget: 1232896,
  flags: ['mg_art_honru_emoji_v1', 'mg_art_honru_emoji_throw_v1'],
};

const readText = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const readJson = relative => JSON.parse(readText(relative));
const exists = relative => fs.existsSync(path.join(ROOT, relative));
const sha256 = relative => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, relative))).digest('hex');
const normalized = relative => String(relative || '').replace(/\\/g, '/');
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

let failures = 0;
function check(name, condition, detail) {
  const ok = !!condition;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? ' :: ' + detail : ''));
  if (!ok) failures++;
}

function section(source, start, end) {
  const first = source.indexOf(start);
  if (first < 0) return '';
  const last = end ? source.indexOf(end, first) : -1;
  return source.slice(first, last < 0 ? source.length : last);
}

function quotedValues(source) {
  return [...source.matchAll(/'([^']+)'/g)].map(match => match[1]);
}

function listFiles(relative) {
  const root = path.join(ROOT, relative);
  if (!fs.existsSync(root)) return [];
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else files.push(normalized(path.relative(ROOT, full)));
    }
  };
  visit(root);
  return files;
}

function readPng(relative, decode) {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) throw new Error('not a PNG');

  let offset = 8;
  let header = null;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error('truncated ' + type + ' chunk');
    const data = bytes.subarray(start, end);
    if (type === 'IHDR') {
      if (length !== 13 || header) throw new Error('invalid IHDR');
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset = end + 4;
  }
  if (!header) throw new Error('missing IHDR');
  if (!decode) return header;
  if (header.bitDepth !== 8 || header.colorType !== 6 || header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error('expected non-interlaced 8-bit RGBA PNG');
  }

  const rowBytes = header.width * 4;
  const input = zlib.inflateSync(Buffer.concat(idat));
  if (input.length !== header.height * (rowBytes + 1)) throw new Error('unexpected decoded byte length');
  const rgba = Buffer.alloc(rowBytes * header.height);
  let inputOffset = 0;
  for (let y = 0; y < header.height; y++) {
    const filter = input[inputOffset++];
    const rowStart = y * rowBytes;
    for (let x = 0; x < rowBytes; x++) {
      const value = input[inputOffset++];
      const left = x >= 4 ? rgba[rowStart + x - 4] : 0;
      const above = y > 0 ? rgba[rowStart - rowBytes + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[rowStart - rowBytes + x - 4] : 0;
      let restored;
      if (filter === 0) restored = value;
      else if (filter === 1) restored = (value + left) & 255;
      else if (filter === 2) restored = (value + above) & 255;
      else if (filter === 3) restored = (value + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) restored = (value + paeth(left, above, upperLeft)) & 255;
      else throw new Error('unsupported PNG filter ' + filter);
      rgba[rowStart + x] = restored;
    }
  }
  return { ...header, rgba };
}

function readWebpSize(relative) {
  const bytes = fs.readFileSync(path.join(ROOT, relative));
  if (bytes.length < 30 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('not a WebP');
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const type = bytes.toString('ascii', offset, offset + 4);
    const length = bytes.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (data + length > bytes.length) throw new Error('truncated WebP chunk');
    if (type === 'VP8X' && length >= 10) {
      const width = 1 + bytes[data + 4] + (bytes[data + 5] << 8) + (bytes[data + 6] << 16);
      const height = 1 + bytes[data + 7] + (bytes[data + 8] << 8) + (bytes[data + 9] << 16);
      return { width, height, bytes: bytes.length };
    }
    if (type === 'VP8 ' && length >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
      return { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff, bytes: bytes.length };
    }
    if (type === 'VP8L' && length >= 5 && bytes[data] === 0x2f) {
      const bits = bytes.readUInt32LE(data + 1);
      return { width: 1 + (bits & 0x3fff), height: 1 + ((bits >>> 14) & 0x3fff), bytes: bytes.length };
    }
    offset = data + length + (length & 1);
  }
  throw new Error('missing WebP dimensions');
}

function paeth(left, above, upperLeft) {
  const p = left + above - upperLeft;
  const leftDistance = Math.abs(p - left);
  const aboveDistance = Math.abs(p - above);
  const upperLeftDistance = Math.abs(p - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left :
    aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function png(relative, decode) {
  try {
    return readPng(relative, decode);
  } catch (error) {
    return { error: error && error.message ? error.message : String(error) };
  }
}

function rgbaAt(image, x, y) {
  const offset = (y * image.width + x) * 4;
  return image.rgba.subarray(offset, offset + 4);
}

function sourcePaths(stem) {
  return [
    EMOJI_ROOT + '/chroma/honru-emoji-' + stem + '-chroma-draft-v1.png',
    EMOJI_ROOT + '/alpha/honru-emoji-' + stem + '-alpha-draft-v1.png',
    EMOJI_ROOT + '/derived/honru-emoji-' + stem + '-192px-draft-v1.png',
    EMOJI_ROOT + '/derived/honru-emoji-' + stem + '-96px-draft-v1.png',
    EMOJI_ROOT + '/derived/honru-emoji-' + stem + '-64px-draft-v1.png',
    EMOJI_ROOT + '/derived/honru-emoji-' + stem + '-44px-draft-v1.png',
  ];
}

function alphaPath(stem) {
  return EMOJI_ROOT + '/alpha/honru-emoji-' + stem + '-alpha-draft-v1.png';
}

function allCornersTransparent(image) {
  if (!image || !image.rgba) return false;
  return [[0, 0], [image.width - 1, 0], [0, image.height - 1], [image.width - 1, image.height - 1]]
    .every(([x, y]) => rgbaAt(image, x, y)[3] === 0);
}

function visibleGreenPixels(image) {
  if (!image || !image.rgba) return Infinity;
  let count = 0;
  for (let index = 0; index < image.rgba.length; index += 4) {
    const red = image.rgba[index], green = image.rgba[index + 1], blue = image.rgba[index + 2], alpha = image.rgba[index + 3];
    // The source contract bans leftover chroma. A visible green-dominant
    // pixel is contamination; Ink/Paper/Cream never has green above both
    // other channels by this margin.
    if (alpha > 0 && green > red + 16 && green > blue + 16) count++;
  }
  return count;
}

function lastAtlasCellsTransparent(image) {
  if (!image || !image.rgba || image.width !== 1024 || image.height !== 768) return false;
  for (let y = 512; y < 768; y++) {
    for (let x = 512; x < 1024; x++) {
      if (rgbaAt(image, x, y)[3] !== 0) return false;
    }
  }
  return true;
}

const server = readText('server/index.js');
const shell = readText('public/src/core/02-app-shell.js');
const social = readText('public/src/core/04-social.js');
const publicClient = readText('public/src/online/03-websocket.js');
const assetsRuntime = readText('public/src/core/06-assets.js');
const contract = readText('requirements/active/honru-emoji-runtime-p0-20260811/contract.md');
const requirement = readText('requirements/active/honru-emoji-runtime-p0-20260811/requirement.md');
const audit = readText('requirements/active/honru-emoji-runtime-p0-20260811/audit.md');
const provenance = readText(PROMPT_PATH);
const technicalReview = readText(EMOJI_ROOT + '/TECHNICAL_REVIEW_Reviewer_A.md');
const statesIpReview = readText('art-source/brand/ghost-game/honru/states-v1/IP_REVIEW_draft-v1.md');
const reviewerB = readText(EMOJI_ROOT + '/IP_REVIEW_Reviewer_B_PENDING.md');
const goldenSet = readText(EMOJI_ROOT + '/GOLDEN_SET_DECISION_PENDING.md');
const gatePolicy = readText('requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md');
const routing = readJson('requirements/MAINLINE_CONTROL_ROUTING.json');
const approvalMatrix = readText('requirements/ART_APPROVAL_MATRIX.md');
const catalog = readJson('asset-library/catalog.json');
const publicManifestText = readText('public/assets/manifests/asset_manifest.json');
const publicManifest = JSON.parse(publicManifestText);

const emojiIds = EXPECTED_EMOJIS.map(emoji => emoji.id);
const glyphs = EXPECTED_EMOJIS.map(emoji => emoji.glyph);
const serverEmojiSet = section(server, 'const MATCH_EXPRESSION_EMOJI_IDS', 'const MATCH_EXPRESSION_QUICK_IDS');
const shellFallback = section(shell, 'const MATCH_EXPRESSION_EMOJI_FALLBACK', 'const MATCH_EXPRESSION_QUICK_IDS');
const serverIds = quotedValues(serverEmojiSet);
const shellPairs = [...shellFallback.matchAll(/\[\s*'([^']+)'\s*,\s*'([^']*)'\s*\]/g)].map(match => [match[1], match[2]]);

check('server freezes exactly the ten stable Emoji IDs in the contract order',
  equal(serverIds, emojiIds) && new Set(serverIds).size === 10);
check('Game Stage fallback is exactly isomorphic to server IDs, order and glyphs',
  equal(shellPairs.map(pair => pair[0]), emojiIds) &&
  equal(shellPairs.map(pair => pair[1]), glyphs) &&
  shell.includes('const allowedEmoji=new Map(MATCH_EXPRESSION_EMOJI_FALLBACK)'));
check('contract and requirement retain the same ten stable IDs without a surrender alias',
  emojiIds.every(id => contract.includes(id) && requirement.includes(id) && provenance.includes(id)) &&
  !serverEmojiSet.includes('emoji_surrender') && requirement.includes('禁止把 ') && requirement.includes('emoji_game'));
check('app shell remains the existing fallback seam, not the social/profile module',
  shell.includes('MATCH_EXPRESSION_EMOJI_FALLBACK') && !social.includes('MATCH_EXPRESSION_EMOJI_FALLBACK'));

for (const emoji of EXPECTED_EMOJIS) {
  const [chroma, alpha, derived192, derived96, derived64, derived44] = sourcePaths(emoji.stem);
  const chromaPng = png(chroma, false);
  const alphaPng = png(alpha, false);
  const derived = [
    [derived192, 192],
    [derived96, 96],
    [derived64, 64],
    [derived44, 44],
  ].map(([relative, size]) => ({ relative, size, image: png(relative, false) }));
  check(emoji.id + ' has chroma, alpha and all four derived PNGs',
    [chroma, alpha, ...derived.map(item => item.relative)].every(exists));
  check(emoji.id + ' source PNG dimensions and color formats are frozen',
    !chromaPng.error && chromaPng.width === 1254 && chromaPng.height === 1254 && chromaPng.bitDepth === 8 && [2, 6].includes(chromaPng.colorType) &&
    !alphaPng.error && alphaPng.width === 1254 && alphaPng.height === 1254 && alphaPng.bitDepth === 8 && alphaPng.colorType === 6 &&
    derived.every(item => !item.image.error && item.image.width === item.size && item.image.height === item.size && item.image.bitDepth === 8 && item.image.colorType === 6));
}

const alphaImages = EXPECTED_EMOJIS.map(emoji => ({ emoji, image: png(alphaPath(emoji.stem), true) }));
check('all ten Alpha images decode as non-interlaced RGBA PNGs',
  alphaImages.every(item => !item.image.error && item.image.width === 1254 && item.image.height === 1254 && item.image.colorType === 6));
check('all ten Alpha images retain four transparent corners',
  alphaImages.every(item => allCornersTransparent(item.image)));
const greenCounts = alphaImages.map(item => ({ id: item.emoji.id, count: visibleGreenPixels(item.image) }));
check('visible green chroma pollution is zero in every Alpha image',
  greenCounts.every(item => item.count === 0),
  greenCounts.map(item => item.id + '=' + item.count).join(', '));

const atlas = png(PACKET.sourcePath, true);
const poster = png(PACKET.previewPath, false);
check('review atlas is a 1024×768 RGBA PNG with the frozen 4×3/256-cell geometry',
  !atlas.error && atlas.width === 1024 && atlas.height === 768 && atlas.bitDepth === 8 && atlas.colorType === 6);
check('atlas row-major cells 11 and 12 are completely transparent',
  lastAtlasCellsTransparent(atlas));
check('review poster is the required 640×360 PNG',
  !poster.error && poster.width === 640 && poster.height === 360);
check('44px review strip exists as a PNG',
  exists(PACKET.stripPath) && !png(PACKET.stripPath, false).error);

const emojiCatalogEntries = (catalog.assets || []).filter(asset => asset && asset.category === 'platform/honru-emoji');
const expectedCatalogIds = [...EXPECTED_EMOJIS.map(emoji => emoji.catalogId), PACKET.id];
const sourceCatalogEntries = emojiCatalogEntries.filter(asset => expectedCatalogIds.includes(asset.id));
const runtimeCatalogEntry = emojiCatalogEntries.find(asset => asset.id === RUNTIME.assetId) || null;
check('asset catalog keeps G-17 through G-27 source entries plus one owner-cleared runtime projection in frozen order',
  equal(emojiCatalogEntries.map(asset => asset.id), [...expectedCatalogIds, RUNTIME.assetId]) &&
  equal(sourceCatalogEntries.map(asset => asset.id), expectedCatalogIds) && emojiCatalogEntries.length === 12);
for (const emoji of EXPECTED_EMOJIS) {
  const asset = sourceCatalogEntries.find(entry => entry.id === emoji.catalogId);
  const source = alphaPath(emoji.stem);
  const expectedRuntimePaths = sourcePaths(emoji.stem);
  check(emoji.catalogId + ' remains a reference-only source/provenance sidecar',
    !!asset &&
    asset.category === 'platform/honru-emoji' &&
    asset.assetType === 'honru-emoji-source-candidate' &&
    asset.sourceType === 'generated' &&
    asset.license === 'project-owned-ai-generated' &&
    asset.author === 'OpenAI Codex for Ghost Game' &&
    asset.status === 'reference-only' &&
    asset.model === 'highest-quality-built-in-imagegen-runtime-managed' &&
    asset.remoteObjectKey === null &&
    asset.promptPath === PROMPT_PATH &&
    exists(asset.promptPath) &&
    equal(asset.dimensions, { width: 1254, height: 1254 }));
  check(emoji.catalogId + ' paths and immutable hashes match the candidate files',
    !!asset &&
    asset.sourcePath === source &&
    asset.previewPath === source &&
    asset.sourceSha256 === emoji.sha256 &&
    asset.previewSha256 === emoji.sha256 &&
    exists(source) &&
    sha256(source) === emoji.sha256 &&
    equal(asset.runtimePaths, expectedRuntimePaths) &&
    expectedRuntimePaths.every(relative => exists(relative) && normalized(relative).startsWith(EMOJI_ROOT + '/') && !normalized(relative).startsWith('public/')));
}

const packet = sourceCatalogEntries.find(asset => asset.id === PACKET.id);
check('G-27 review packet remains reference-only and preserves its provenance',
  !!packet &&
  packet.category === 'platform/honru-emoji' &&
  packet.assetType === 'honru-emoji-review-packet' &&
  packet.sourceType === 'generated' &&
  packet.license === 'project-owned-ai-generated' &&
  packet.author === 'OpenAI Codex for Ghost Game' &&
  packet.status === 'reference-only' &&
  packet.model === 'highest-quality-built-in-imagegen-runtime-managed' &&
  packet.remoteObjectKey === null &&
  packet.promptPath === PROMPT_PATH &&
  exists(packet.promptPath) &&
  equal(packet.dimensions, { width: 1024, height: 768 }));
check('G-27 atlas/poster/strip paths and hashes are pinned to art-source only',
  !!packet &&
  packet.sourcePath === PACKET.sourcePath &&
  packet.sourceSha256 === PACKET.sourceSha256 &&
  packet.previewPath === PACKET.previewPath &&
  packet.previewSha256 === PACKET.previewSha256 &&
  sha256(PACKET.sourcePath) === PACKET.sourceSha256 &&
  sha256(PACKET.previewPath) === PACKET.previewSha256 &&
  equal(packet.runtimePaths, [PACKET.sourcePath, PACKET.previewPath, PACKET.stripPath]) &&
  packet.runtimePaths.every(relative => exists(relative) && normalized(relative).startsWith(EMOJI_ROOT + '/') && !normalized(relative).startsWith('public/')));
check('all eleven catalog candidates remain outside public runtime paths',
  sourceCatalogEntries.every(asset => asset.status === 'reference-only' && (asset.runtimePaths || []).every(relative => normalized(relative).startsWith(EMOJI_ROOT + '/') && !normalized(relative).startsWith('public/'))));

const publicEmojiPaths = listFiles('public/assets').filter(relative => normalized(relative).split('/').includes('emoji-v1'));
const runtimeEntry = (publicManifest.assets || []).find(asset => asset && asset.asset_id === RUNTIME.assetId) || null;
const clearanceExists = exists(RUNTIME.clearancePath);
const runtimeCode = [assetsRuntime, shell, social, publicClient].join('\n');
const runtimeCodeSignal = runtimeCode.includes(RUNTIME.assetId) || RUNTIME.flags.some(flag => runtimeCode.includes(flag));
const runtimeMode = publicEmojiPaths.length > 0 || Boolean(runtimeEntry) || clearanceExists || runtimeCodeSignal;
const exactRuntimePaths = [RUNTIME.atlasPath, RUNTIME.posterPath];

if (!runtimeMode) {
  check('source-only state has no Emoji clearance, Manifest, public files, flags, or consumer',
    !clearanceExists && !runtimeEntry && !runtimeCatalogEntry && publicEmojiPaths.length === 0 && !runtimeCodeSignal);
  check('source-only contract keeps both preview flags fail-closed before owner clearance',
    RUNTIME.flags.every(flag => contract.includes(flag)) &&
    contract.includes('"default_enabled": false') &&
    contract.includes('只有两个 localStorage 值都严格等于字符串 ') &&
    contract.includes('"1"'));
} else {
  let atlasRuntime = null;
  let posterRuntime = null;
  try { atlasRuntime = readWebpSize(RUNTIME.atlasPath); } catch (error) { atlasRuntime = { error: error.message }; }
  try { posterRuntime = readWebpSize(RUNTIME.posterPath); } catch (error) { posterRuntime = { error: error.message }; }
  const expectedCells = Object.fromEntries(EXPECTED_EMOJIS.map((emoji, index) => [emoji.id, {
    x: (index % 4) * 256,
    y: Math.floor(index / 4) * 256,
    w: 256,
    h: 256,
  }]));
  const expectedFallbacks = Object.fromEntries(EXPECTED_EMOJIS.map(emoji => [emoji.id, emoji.glyph]));
  const clearance = clearanceExists ? readText(RUNTIME.clearancePath) : '';
  const matrixEmojiRow = (approvalMatrix.match(/^\| Honru Emoji[^\n]*$/m) || [''])[0];

  check('runtime state is atomic: exact atlas/poster pair exists without orphan extras',
    equal(publicEmojiPaths.sort(), exactRuntimePaths.slice().sort()) &&
    exists(RUNTIME.atlasPath) && exists(RUNTIME.posterPath), publicEmojiPaths.join(', '));
  check('runtime atlas/poster dimensions, bytes, hashes, and budgets are frozen',
    atlasRuntime && !atlasRuntime.error && atlasRuntime.width === 1024 && atlasRuntime.height === 768 && atlasRuntime.bytes === RUNTIME.atlasBytes &&
    posterRuntime && !posterRuntime.error && posterRuntime.width === 640 && posterRuntime.height === 360 && posterRuntime.bytes === RUNTIME.posterBytes &&
    sha256(RUNTIME.atlasPath) === RUNTIME.atlasSha256 && sha256(RUNTIME.posterPath) === RUNTIME.posterSha256 &&
    RUNTIME.atlasBytes <= 1048576 && RUNTIME.posterBytes <= 184320);
  check('runtime state has a per-family OWNER_AUTHORIZED_ART_CLEARANCE record with honest optional advice',
    clearanceExists &&
    ['OWNER_AUTHORIZED_ART_CLEARANCE', RUNTIME.assetId, 'M0 North Star', PACKET.sourceSha256, PACKET.previewSha256,
      RUNTIME.atlasSha256, RUNTIME.posterSha256, 'OPTIONAL_ADVISORY_EVIDENCE', 'NOT_EXECUTED',
      'fallback', ...RUNTIME.flags, 'blocked-license', 'EXTERNAL_REFERENCE_ONLY']
      .every(token => clearance.includes(token)) &&
    !/\b(?:IP|LEGAL|GOLDEN_SET)_?PASS\b/i.test(clearance));
  check('approval matrix promotes only the Emoji family through owner clearance',
    matrixEmojiRow.includes('OWNER_AUTHORIZED_ART_CLEARANCE') &&
    !matrixEmojiRow.includes('SOURCE_ONLY_CANDIDATE'));
  check('runtime Manifest pins identity, paths, integrity, geometry, cells, fallbacks, and budgets',
    runtimeEntry && runtimeEntry.runtime_id === 'honru' && runtimeEntry.artwork_version === 1 && runtimeEntry.status === 'ready' &&
    runtimeEntry.runtime_path === RUNTIME.atlasPath && runtimeEntry.poster === RUNTIME.posterPath &&
    runtimeEntry.integrity === `sha256:${RUNTIME.atlasSha256}` && runtimeEntry.poster_integrity === `sha256:${RUNTIME.posterSha256}` &&
    runtimeEntry.actual_bytes === RUNTIME.totalBytes && runtimeEntry.byte_budget === RUNTIME.byteBudget &&
    equal(runtimeEntry.atlas, { width: 1024, height: 768, columns: 4, rows: 3, cell: 256 }) &&
    equal(runtimeEntry.cells, expectedCells) && equal(runtimeEntry.fallback_glyphs, expectedFallbacks) &&
    runtimeEntry.fallback === 'per-id Unicode glyph, then localized readable text' &&
    runtimeEntry.license === 'project-owned-ai-generated' &&
    typeof runtimeEntry.load === 'string' && /on demand/i.test(runtimeEntry.load) &&
    typeof runtimeEntry.a11y === 'string' && runtimeEntry.a11y.length > 0);
  check('asset catalog keeps source provenance separate from the owner-cleared local runtime projection',
    runtimeCatalogEntry &&
    runtimeCatalogEntry.assetType === 'honru-emoji-runtime-owner-cleared' &&
    runtimeCatalogEntry.sourceType === 'generated' &&
    runtimeCatalogEntry.sourcePath === PACKET.sourcePath &&
    runtimeCatalogEntry.sourceSha256 === PACKET.sourceSha256 &&
    runtimeCatalogEntry.license === 'project-owned-ai-generated' &&
    runtimeCatalogEntry.author === 'OpenAI Codex for Ghost Game' &&
    runtimeCatalogEntry.status === 'integrated-local-only' &&
    equal(runtimeCatalogEntry.dimensions, { width: 1024, height: 768 }) &&
    runtimeCatalogEntry.previewPath === RUNTIME.posterPath &&
    runtimeCatalogEntry.previewSha256 === RUNTIME.posterSha256 &&
    equal(runtimeCatalogEntry.runtimePaths, exactRuntimePaths) &&
    runtimeCatalogEntry.promptPath === PROMPT_PATH && exists(runtimeCatalogEntry.promptPath) &&
    runtimeCatalogEntry.model === 'highest-quality-built-in-imagegen-runtime-managed' &&
    runtimeCatalogEntry.remoteObjectKey === null);
  check('runtime Manifest uses reversible default-on flags with an independent throw kill switch',
    runtimeEntry && runtimeEntry.feature_flags && runtimeEntry.feature_flags.operator === 'all' &&
    runtimeEntry.feature_flags.enabled_value === '1' && runtimeEntry.feature_flags.default_enabled === true &&
    equal(runtimeEntry.feature_flags.ids, RUNTIME.flags));
  check('runtime consumer is explicit, Manifest-backed, default-on, and keeps Unicode fallback',
    assetsRuntime.includes("const HONRU_EMOJI_ASSET_ID = 'P-HONRU-EMOJI-V1'") &&
    assetsRuntime.includes("const HONRU_EMOJI_MASTER_FLAG = 'mg_art_honru_emoji_v1'") &&
    assetsRuntime.includes("const HONRU_EMOJI_THROW_FLAG = 'mg_art_honru_emoji_throw_v1'") &&
    /function honruEmojiEnabled\s*\(/.test(assetsRuntime) &&
    /function resolveHonruEmojiCell\s*\(/.test(assetsRuntime) &&
    assetsRuntime.includes('ownerClearedDefaultOnFlagEnabled') &&
    shell.includes('resolveHonruEmojiCell') &&
    shell.includes('MATCH_EXPRESSION_EMOJI_FALLBACK') &&
    RUNTIME.flags.every(flag => runtimeCode.includes(flag)));
  check('runtime paths never point to source art or external assets',
    runtimeEntry && !JSON.stringify(runtimeEntry).includes('art-source/') &&
    exactRuntimePaths.every(relative => normalized(relative).startsWith('public/assets/brand/honru/emoji-v1/')));
}

const directChatHandler = section(server, 'async function handleChatSend(', 'async function handleChatRead(');
const matchChatHandler = section(server, 'function handleMatchChatSend(', 'function controlledAISeat(');
const binaryChatFields = /(emojiId|assetId|atlasCell|imageUrl|data:image|<svg|\.webp|\.png)/i;
check('contract keeps direct and match Chat as text-only surfaces pending a versioned adapter',
  contract.includes('当前是服务端权威纯文字合同') &&
  contract.includes('不发送图片 bytes、data URL、HTML、SVG、CSS') &&
  contract.includes('不授权偷偷扩展现有 ') &&
  contract.includes('text') &&
  /normalizeChatText\(payload&&payload\.text\)/.test(directChatHandler) &&
  /normalizeMatchChatText\(payload&&payload\.text\)/.test(matchChatHandler) &&
  !binaryChatFields.test(directChatHandler) &&
  !binaryChatFields.test(matchChatHandler));
check('contract excludes Emoji images from messages, logs, replay, rewards and persistence',
  contract.includes('不进入消息正文、日志、Replay、moveLog、奖励、AI 学习、Analytics、Profile、数据库或 localStorage') &&
  requirement.includes('不把原图、Prompt、聊天正文、Emoji 事件、投掷轨迹写入规则快照、moveLog、Replay、奖励、AI 学习、Analytics、数据库、localStorage 或普通日志'));

check('Emoji provenance records current owner-cleared default-on runtime and honest optional advice',
  provenance.includes('OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_RUNTIME_DEFAULT_ON / NOT_RELEASED') &&
  provenance.includes('OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED') &&
  provenance.includes('blocked-license') && provenance.includes('当前用户明确命令'));
check('Reviewer A current conclusion is owner-cleared while candidate-only/default-off remains historical-as-of',
  technicalReview.includes('TECHNICAL_PASS / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_RUNTIME_DEFAULT_ON / NOT_RELEASED') &&
  technicalReview.includes('Historical-as-of') &&
  technicalReview.includes('TECHNICAL_CANDIDATE / NOT_APPROVED_FOR_RUNTIME') &&
  technicalReview.includes('reference-only/default-off') &&
  technicalReview.includes('OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED') &&
  technicalReview.includes('blocked-license') && technicalReview.includes('当前用户明确命令'));
check('Honru states Reviewer A draft is reconciled to owner clearance without erasing the old DO_NOT_SHIP prerequisite',
  statesIpReview.includes('OWNER_AUTHORIZED_ART_CLEARANCE') &&
  statesIpReview.includes('OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED') &&
  statesIpReview.includes('Historical-as-of') && statesIpReview.includes('DO_NOT_SHIP') &&
  statesIpReview.includes('blocked-license') && statesIpReview.includes('当前用户明确命令'));
check('Reviewer B/IP optional consultation is honestly pending and unsigned',
  reviewerB.includes('PENDING_INDEPENDENT_HUMAN_REVIEW') &&
  reviewerB.includes('Reviewer B：________') &&
  !/\b(?:IP|LEGAL)_?PASS\b/i.test(reviewerB));
check('Golden Set optional consultation is honestly pending and unsigned',
  goldenSet.includes('PENDING_USER_GOLDEN_SET_SIGNOFF') &&
  goldenSet.includes('Golden Set 负责人：________') &&
  !/\bGOLDEN_SET_?PASS\b/i.test(goldenSet));
check('current contract opens owner-authorized runtime without fabricating human or legal approval',
  contract.includes('OWNER_AUTHORIZED_ART_CLEARANCE') &&
  contract.includes('OPTIONAL_ADVISORY_EVIDENCE') &&
  contract.includes('可逆 default-on runtime') &&
  gatePolicy.includes('不作为原创资产的开发、runtime 或发布先决条件') &&
  routing.sharedGates?.['GATE-ART-GOLDEN-SET']?.status === 'OPEN_BY_OWNER_AUTHORIZATION' &&
  routing.sharedGates?.['GATE-ART-GOLDEN-SET']?.developmentStatus === 'OPEN');
check('2026-08-11 blocked audit remains historical and cannot override current 2026-08-16 policy',
  audit.includes('审计时间：2026-08-11') &&
  audit.includes('HIGH / BLOCKED_FOR_RUNTIME') &&
  gatePolicy.includes('2026-08-16 用户再次明确授权'));

if (failures) {
  console.error('HONRU_EMOJI_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('HONRU_EMOJI_CONTRACT_ALL_PASS');
}
