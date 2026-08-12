'use strict';

/*
 * Source-only contract for the unshipped Honru Pixel Avatar P0 candidate set.
 *
 * This test is intentionally a boundary test.  It verifies the immutable
 * source PNGs and their source-side decisions while rejecting a premature
 * runtime copy, manifest registration, or default-avatar reference.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const PACK_ROOT = 'art-source/platform/avatars/v3-honru-pixel-p0-20260811';
const SOURCE_DIR = PACK_ROOT + '/source';
const ALPHA_DIR = PACK_ROOT + '/alpha';
const PROMPT_PATH = PACK_ROOT + '/PROMPT_AND_PROVENANCE.md';
const REVIEW_PATH = PACK_ROOT + '/SOURCE_STATUS_AND_TECHNICAL_REVIEW.md';

const SOURCE_FILES = [
  {
    file: 'honru-arcade-builder-chroma-v1.png',
    sha256: '56e060da08c871677ff7f12612bc8079eedf77b67974b9c3f4b8eb078ed30276',
    status: 'REJECTED_SUPERSEDED_GENERATED_VARIANT',
  },
  {
    file: 'honru-arcade-builder-chroma-v2.png',
    sha256: '042c393df43c02c5d77c9c069ab8db41fe4e7e20e3363f4c9c8689088667042a',
    status: 'CANONICAL_GENERATED_SOURCE',
  },
  {
    file: 'honru-explorer-chroma-v1.png',
    sha256: '0944d7cc97a01fbf457e06f2e544f569d9480b05e7d37dfc5d95021af4f99406',
    status: 'CANONICAL_GENERATED_SOURCE',
  },
  {
    file: 'honru-night-cadet-chroma-v1.png',
    sha256: '3582588586c0e1f46e459a882f3140c2dff74f75c99f7f8443c2d8133ca76215',
    status: 'CANONICAL_GENERATED_SOURCE',
  },
  {
    file: 'honru-stargazer-chroma-v1.png',
    sha256: '9f8853b7c61ff8556db3a7f290647a6355ed67c3ee922b126132fe345222c008',
    status: 'CANONICAL_GENERATED_SOURCE',
  },
];

const ALPHA_FILES = [
  {
    file: 'honru-arcade-builder-alpha-v1.png',
    sha256: '1c4efb6cdd88a9c45af73c8e30fcdd2d95302891dd0f53bd7892d90055329e1b',
    status: 'REJECTED_CHROMA_INTERMEDIATE',
  },
  {
    file: 'honru-arcade-builder-alpha-v2.png',
    sha256: '47ad9618d582ae20abb2aec44d179be5cf4e66b7ffa9bbbabe4ebd62fa88e736',
    status: 'REJECTED_NONFINAL_BUILDER_INTERMEDIATE',
  },
  {
    file: 'honru-arcade-builder-alpha-v3.png',
    sha256: '8ef71d260f75bf4db2d4a5d134fa0029990ee4156f035350132c5e775ff6118c',
    status: 'REJECTED_MASK_BREAKAGE',
  },
  {
    file: 'honru-arcade-builder-alpha-v4.png',
    sha256: '7c23a561a5d6615e5edc478cae41403ecd33a8b87a72ee7fb29fa24f164ecc7f',
    status: 'REJECTED_CHROMA_INTERMEDIATE',
  },
  {
    file: 'honru-arcade-builder-alpha-v5.png',
    sha256: 'f56ec80d427ed0864e9437422a2356e82cf6b2a49a58b339dfec239d4d0024c1',
    status: 'REJECTED_NONFINAL_BUILDER_INTERMEDIATE',
  },
  {
    file: 'honru-arcade-builder-alpha-v6.png',
    sha256: '506cb8d15b819a968251f2be9adf65ebe496d70ccbbaf7ae9bf5478a7128f8a0',
    status: 'REJECTED_NONFINAL_BUILDER_INTERMEDIATE',
  },
  {
    file: 'honru-arcade-builder-alpha-v7.png',
    sha256: 'a1090c036bdcd523e68ef62b3183b1ca7ed23459ce955172dce672c9429840a8',
    status: 'REJECTED_MASK_BREAKAGE',
  },
  {
    file: 'honru-arcade-builder-alpha-v8.png',
    sha256: '1ee490d38b5da584cdca2b8050edad81ced279979843bc6010fce3aec854908e',
    status: 'REJECTED_NONFINAL_BUILDER_INTERMEDIATE',
  },
  {
    file: 'honru-arcade-builder-alpha-v9.png',
    sha256: '775dbd6500eac095eaa08a4bb688fb5e5870b84d91cf79bf23dfa80c3bdf3846',
    status: 'ACCEPTED_TECHNICAL_CANDIDATE',
  },
  {
    file: 'honru-explorer-alpha-v1.png',
    sha256: '4ae2652aeb4f1c6a55ddc4df9fb1560b9e5a72e14b306182e1dea7b77540e579',
    status: 'REJECTED_CHROMA_INTERMEDIATE',
  },
  {
    file: 'honru-explorer-alpha-v2.png',
    sha256: '7353548824f3bc2940ad3c98e76d43b04645b90cce800ec0544477e160c3a408',
    status: 'ACCEPTED_TECHNICAL_CANDIDATE',
  },
  {
    file: 'honru-night-cadet-alpha-v1.png',
    sha256: '8804aeed71517d5c29eb47a5eddeea436e3d8097a40ab0521e7c86206dd9ce7c',
    status: 'REJECTED_CHROMA_INTERMEDIATE',
  },
  {
    file: 'honru-night-cadet-alpha-v2.png',
    sha256: '4e5e0f07dba7075f485c79ab2ab02a4cac3c8e3973572fe2a1779d0efd9b860d',
    status: 'ACCEPTED_TECHNICAL_CANDIDATE',
  },
  {
    file: 'honru-stargazer-alpha-v1.png',
    sha256: 'c8374be02de6d5118a1e627b204c9364b0dc1ba7da2568bfd1d7373f7d9159bc',
    status: 'REJECTED_CHROMA_INTERMEDIATE',
  },
  {
    file: 'honru-stargazer-alpha-v2.png',
    sha256: '8874f1943dc8b23d9647727fb82ff27b27c3cd394d711f05345d12c0123fce7b',
    status: 'ACCEPTED_TECHNICAL_CANDIDATE',
  },
];

const FINAL_ALPHA_FILES = [
  'honru-stargazer-alpha-v2.png',
  'honru-night-cadet-alpha-v2.png',
  'honru-explorer-alpha-v2.png',
  'honru-arcade-builder-alpha-v9.png',
];

let failures = 0;
function check(name, condition, detail) {
  const ok = !!condition;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? ' :: ' + detail : ''));
  if (!ok) failures++;
}

function relativePath(relative) {
  return path.join(ROOT, ...String(relative).split('/'));
}

function readText(relative) {
  return fs.readFileSync(relativePath(relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(relativePath(relative));
}

function sha256(relative) {
  return crypto.createHash('sha256').update(fs.readFileSync(relativePath(relative))).digest('hex');
}

function sortedNames(relative) {
  if (!exists(relative)) return [];
  return fs.readdirSync(relativePath(relative)).sort();
}

function normalize(relative) {
  return String(relative || '').replace(/\\/g, '/');
}

function listFiles(relative) {
  const initial = relativePath(relative);
  if (!fs.existsSync(initial)) return [];
  const files = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else files.push(normalize(path.relative(ROOT, full)));
    }
  };
  visit(initial);
  return files;
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance
    ? left
    : aboveDistance <= upperLeftDistance
      ? above
      : upperLeft;
}

function readPng(relative, decodeRgba) {
  const bytes = fs.readFileSync(relativePath(relative));
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(signature)) throw new Error('not a PNG');

  const chunks = [];
  const idat = [];
  let offset = 8;
  let header = null;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error('truncated ' + type + ' chunk');
    const data = bytes.subarray(start, end);
    chunks.push({ type, data });
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
      sawEnd = true;
      break;
    }
    offset = end + 4;
  }
  if (!header || !sawEnd) throw new Error('missing required PNG chunk');
  if (!decodeRgba) return { ...header, chunks };

  if (header.bitDepth !== 8 || header.colorType !== 6 ||
      header.compression !== 0 || header.filter !== 0 || header.interlace !== 0) {
    throw new Error('expected non-interlaced 8-bit RGBA PNG');
  }
  const rowBytes = header.width * 4;
  const input = zlib.inflateSync(Buffer.concat(idat));
  if (input.length !== header.height * (rowBytes + 1)) {
    throw new Error('unexpected decoded byte length');
  }
  const rgba = Buffer.alloc(rowBytes * header.height);
  let inputOffset = 0;
  for (let y = 0; y < header.height; y++) {
    const rowStart = y * rowBytes;
    const filter = input[inputOffset++];
    for (let x = 0; x < rowBytes; x++) {
      const value = input[inputOffset++];
      const left = x >= 4 ? rgba[rowStart + x - 4] : 0;
      const above = y > 0 ? rgba[rowStart - rowBytes + x] : 0;
      const upperLeft = y > 0 && x >= 4 ? rgba[rowStart - rowBytes + x - 4] : 0;
      if (filter === 0) rgba[rowStart + x] = value;
      else if (filter === 1) rgba[rowStart + x] = (value + left) & 255;
      else if (filter === 2) rgba[rowStart + x] = (value + above) & 255;
      else if (filter === 3) rgba[rowStart + x] = (value + Math.floor((left + above) / 2)) & 255;
      else if (filter === 4) rgba[rowStart + x] = (value + paeth(left, above, upperLeft)) & 255;
      else throw new Error('unsupported PNG filter ' + filter);
    }
  }
  return { ...header, chunks, rgba };
}

function alphaAt(image, x, y) {
  return image.rgba[(y * image.width + x) * 4 + 3];
}

function transparentCorners(image) {
  return [
    [0, 0],
    [image.width - 1, 0],
    [0, image.height - 1],
    [image.width - 1, image.height - 1],
  ].every(point => alphaAt(image, point[0], point[1]) === 0);
}

function visibleBrightMagentaPixels(image) {
  let count = 0;
  for (let index = 0; index < image.rgba.length; index += 4) {
    const red = image.rgba[index];
    const green = image.rgba[index + 1];
    const blue = image.rgba[index + 2];
    const alpha = image.rgba[index + 3];
    if (alpha > 0 && red >= 180 && blue >= 120 && green <= 100) count++;
  }
  return count;
}

function hasChunk(image, type) {
  return image.chunks.some(chunk => chunk.type === type);
}

function c2paText(image) {
  return Buffer.concat(image.chunks.filter(chunk => chunk.type === 'caBX').map(chunk => chunk.data)).toString('latin1');
}

function hasOnlyExpectedPngTextChunks(image) {
  return !image.chunks.some(chunk => chunk.type === 'tEXt' || chunk.type === 'zTXt' || chunk.type === 'iTXt');
}

function containsCandidateToken(source) {
  const lower = String(source || '').toLowerCase();
  const tokens = [
    PACK_ROOT.toLowerCase(),
    ...SOURCE_FILES.map(item => item.file.toLowerCase()),
    ...ALPHA_FILES.map(item => item.file.toLowerCase()),
  ];
  return tokens.some(token => lower.includes(token));
}

function oneLineDecision(file, status) {
  return 'DECISION | alpha/' + file + ' | ' + status + ' |';
}

const expectedSourceNames = SOURCE_FILES.map(item => item.file).sort();
const expectedAlphaNames = ALPHA_FILES.map(item => item.file).sort();
check('source directory contains exactly the five frozen chroma PNGs',
  JSON.stringify(sortedNames(SOURCE_DIR)) === JSON.stringify(expectedSourceNames),
  JSON.stringify(sortedNames(SOURCE_DIR)));
check('alpha directory contains exactly the fifteen frozen repair PNGs',
  JSON.stringify(sortedNames(ALPHA_DIR)) === JSON.stringify(expectedAlphaNames),
  JSON.stringify(sortedNames(ALPHA_DIR)));
check('source-only provenance and technical-review documents exist',
  exists(PROMPT_PATH) && exists(REVIEW_PATH));

for (const source of SOURCE_FILES) {
  const relative = SOURCE_DIR + '/' + source.file;
  let png;
  try {
    png = readPng(relative, false);
  } catch (error) {
    png = { error: error.message };
  }
  const c2pa = png.error ? '' : c2paText(png);
  check('source hash is frozen: ' + source.file,
    exists(relative) && sha256(relative) === source.sha256,
    exists(relative) ? sha256(relative) : 'missing');
  check('source PNG remains 1254-square non-interlaced RGB: ' + source.file,
    !png.error && png.width === 1254 && png.height === 1254 &&
      png.bitDepth === 8 && png.colorType === 2 &&
      png.compression === 0 && png.filter === 0 && png.interlace === 0);
  check('source C2PA provenance remains attached: ' + source.file,
    !png.error && hasChunk(png, 'caBX') &&
      c2pa.includes('gpt-image') && c2pa.includes('OpenAI Media Service API'));
  check('source exposes no recoverable textual prompt chunk: ' + source.file,
    !png.error && hasOnlyExpectedPngTextChunks(png));
}

const finalAlphaImages = [];
for (const alpha of ALPHA_FILES) {
  const relative = ALPHA_DIR + '/' + alpha.file;
  let png;
  try {
    png = readPng(relative, true);
  } catch (error) {
    png = { error: error.message };
  }
  if (FINAL_ALPHA_FILES.includes(alpha.file)) finalAlphaImages.push({ file: alpha.file, png });
  check('alpha hash is frozen: ' + alpha.file,
    exists(relative) && sha256(relative) === alpha.sha256,
    exists(relative) ? sha256(relative) : 'missing');
  check('alpha PNG remains 1254-square non-interlaced RGBA: ' + alpha.file,
    !png.error && png.width === 1254 && png.height === 1254 &&
      png.bitDepth === 8 && png.colorType === 6 &&
      png.compression === 0 && png.filter === 0 && png.interlace === 0);
  check('alpha corners remain fully transparent: ' + alpha.file,
    !png.error && transparentCorners(png));
  check('Builder repair remains a derivative without a C2PA claim: ' + alpha.file,
    !png.error && !hasChunk(png, 'caBX') && hasOnlyExpectedPngTextChunks(png));
}

check('the four selected technical alpha candidates are exactly v2/v2/v2/v9',
  JSON.stringify(finalAlphaImages.map(item => item.file).sort()) === JSON.stringify(FINAL_ALPHA_FILES.slice().sort()));
check('selected alpha candidates have zero visible bright-magenta chroma residue',
  finalAlphaImages.every(item => !item.png.error && visibleBrightMagentaPixels(item.png) === 0),
  finalAlphaImages.map(item => item.file + '=' + (item.png.error ? item.png.error : visibleBrightMagentaPixels(item.png))).join(', '));

const provenance = readText(PROMPT_PATH);
const review = readText(REVIEW_PATH);
check('provenance explicitly preserves unrecoverable prompt and repair status',
  provenance.includes('Exact generation prompts: NOT_RECOVERED.') &&
    provenance.includes('Exact Builder repair instructions') &&
    provenance.includes('NOT_RECOVERED.') &&
    provenance.includes('Do not reconstruct') &&
    provenance.includes('gpt-image version 2.0') &&
    provenance.includes('OpenAI Media Service API'));
check('provenance distinguishes four selected directions from the fifth generated alternate',
  provenance.includes('original four generated avatars') &&
    provenance.includes('five C2PA-bearing') &&
    provenance.includes('generation outputs') &&
    provenance.includes('PRESERVED_NONCANONICAL_GENERATED_VARIANT'));
check('technical review stays source-only and preserves all three human gates as unexecuted',
  review.includes('TECHNICAL_CANDIDATE / NOT_APPROVED_FOR_RUNTIME') &&
    review.includes('Reviewer B: NOT_EXECUTED.') &&
    review.includes('IP Review: NOT_EXECUTED.') &&
    review.includes('Golden Set: NOT_EXECUTED.'));
check('review has a status-bearing decision record for every alpha candidate',
  ALPHA_FILES.every(alpha => review.includes(oneLineDecision(alpha.file, alpha.status))));
check('review freezes the selected source roles and preserves the rejected Builder source alternate',
  ['source/honru-stargazer-chroma-v1.png', 'source/honru-night-cadet-chroma-v1.png',
    'source/honru-explorer-chroma-v1.png', 'source/honru-arcade-builder-chroma-v2.png']
    .every(file => review.includes(file) && review.includes('CANONICAL_GENERATED_SOURCE')) &&
    review.includes('source/honru-arcade-builder-chroma-v1.png') &&
    review.includes('REJECTED_SUPERSEDED_GENERATED_VARIANT'));
check('provenance pins every source hash and selected alpha filename',
  SOURCE_FILES.every(source => provenance.includes(source.sha256)) &&
    FINAL_ALPHA_FILES.every(file => provenance.includes('alpha/' + file)));

const assetManifestPath = 'public/assets/manifests/asset_manifest.json';
const assetManifestText = readText(assetManifestPath);
const publicAssetFiles = listFiles('public/assets');
const candidateHashes = new Set([...SOURCE_FILES, ...ALPHA_FILES].map(item => item.sha256));
const publicAssetHashMatches = publicAssetFiles
  .filter(file => /\.(png|webp)$/i.test(file))
  .filter(file => candidateHashes.has(sha256(file)));
const publicDefaultAvatarSurfaces = [
  'public/src/core/06-assets.js',
  'public/src/ui/07-roster.js',
  'public/src/shop/06-shop.js',
  'public/index-template.html',
  'public/index.html',
];
check('no source candidate has been copied into public assets',
  !publicAssetFiles.some(file => containsCandidateToken(file)),
  publicAssetFiles.filter(file => containsCandidateToken(file)).join(', '));
check('no source candidate bytes have been copied into public assets under another name',
  publicAssetHashMatches.length === 0,
  publicAssetHashMatches.join(', '));
check('asset manifest contains no premature Honru Pixel Avatar P0 record',
  !containsCandidateToken(assetManifestText) &&
    ![...candidateHashes].some(hash => assetManifestText.includes(hash)));
check('runtime/default-avatar surfaces contain no source candidate reference',
  publicDefaultAvatarSurfaces.every(file => exists(file) && !containsCandidateToken(readText(file))),
  publicDefaultAvatarSurfaces.filter(file => !exists(file) || containsCandidateToken(readText(file))).join(', '));

if (failures) {
  console.error('HONRU_AVATAR_SOURCE_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('HONRU_AVATAR_SOURCE_CONTRACT_ALL_PASS');
}
