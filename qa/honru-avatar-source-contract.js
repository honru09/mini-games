'use strict';

/*
 * Dual-state contract for the Honru Pixel Avatar P0 candidate set.
 *
 * The immutable source PNGs and source-side decisions are always verified.
 * The family must then be in exactly one atomic state: source-only with no
 * runtime signal, or owner-cleared runtime with the complete machine-review,
 * provenance, Manifest, flag, fallback, consumer, and rollback chain.
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
const APPROVAL_PATH = PACK_ROOT + '/APPROVAL_STATUS.md';
const TECHNICAL_REVIEW_PATH = PACK_ROOT + '/TECHNICAL_REVIEW_Reviewer_A.md';
const ASSET_MANIFEST_PATH = 'public/assets/manifests/asset_manifest.json';
const ASSET_CATALOG_PATH = 'asset-library/catalog.json';
const APPROVAL_MATRIX_PATH = 'requirements/ART_APPROVAL_MATRIX.md';
const EXTERNAL_REGISTER_PATH = 'asset-library/external-source-register-20260813.json';
const EXTERNAL_HASH_EVIDENCE_PATH = 'requirements/active/external-assets-audit-p1-20260813/evidence/external-file-content-hashes.json';
const OWNER_CLEARANCE = 'OWNER_AUTHORIZED_ART_CLEARANCE';
const RUNTIME_MARKERS = [
  PACK_ROOT,
  'v3-honru-pixel',
  'honru-pixel-avatar',
  'honru-pixel',
  'honru-stargazer',
  'honru-night-cadet',
  'honru-explorer',
  'honru-arcade-builder',
].map(value => value.toLowerCase());

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

function containsRuntimeMarker(source) {
  const lower = normalize(source).toLowerCase();
  return RUNTIME_MARKERS.some(token => lower.includes(token));
}

function readJson(relative) {
  return JSON.parse(readText(relative));
}

function runtimePathRecords(entry) {
  const records = [];
  if (typeof entry?.runtime_path === 'string' && entry.runtime_path) {
    records.push({ key: null, path: normalize(entry.runtime_path), integrity: entry.integrity });
  }
  for (const [key, runtimePath] of Object.entries(entry?.variants || {})) {
    if (typeof runtimePath !== 'string' || !runtimePath) continue;
    records.push({ key, path: normalize(runtimePath), integrity: entry.variant_integrity?.[key] });
  }
  return records;
}

function featureFlagIds(entry) {
  const ids = [];
  if (typeof entry?.feature_flag === 'string' && entry.feature_flag) ids.push(entry.feature_flag);
  for (const id of entry?.feature_flags?.ids || []) {
    if (typeof id === 'string' && id) ids.push(id);
  }
  return [...new Set(ids)];
}

function integrityHash(value) {
  const match = String(value || '').match(/^sha256:([a-f0-9]{64})$/i);
  return match ? match[1].toLowerCase() : '';
}

function publicConsumerFiles() {
  return [
    ...listFiles('public/src').filter(file => /\.js$/i.test(file)),
    'public/index-template.html',
  ].filter(exists);
}

function clearanceFiles(runtimeIds) {
  const files = [
    ...listFiles(PACK_ROOT),
    ...listFiles('requirements/active'),
  ].filter(file => /(?:^|\/)OWNER_AUTHORIZED_ART_CLEARANCE[^/]*\.md$/i.test(normalize(file)));
  return [...new Set(files)].filter(file => {
    const text = readText(file);
    return containsRuntimeMarker(text) || runtimeIds.some(id => text.includes(id));
  });
}

const ADVISORY_GATES = [
  { label: 'human cleanup', pattern: /人工清稿|human cleanup/i },
  { label: 'Reviewer B', pattern: /Reviewer B/i },
  { label: 'IP/legal review', pattern: /IP(?: Similarity)? Review|IP\s*\/\s*法律|IP\/法律|法律意见/i },
  { label: 'Golden Set', pattern: /Golden Set/i },
];

function advisoryStateIsHonest(text, gate) {
  const lines = String(text || '').split(/\r?\n/).filter(line => gate.pattern.test(line));
  const hasUnexecutedState = lines.some(line => /NOT_EXECUTED|not_executed|OPTIONAL_ADVISORY_EVIDENCE|未执行|可选(?:风险)?咨询/i.test(line));
  const fabricatedPass = lines.some(line => {
    if (/NOT_EXECUTED|not_executed|未执行|不得|不声称|不等于|不是|没有|不可|not\s+(?:a\s+)?(?:pass|approval|legal)|optional/i.test(line)) return false;
    return /\b(?:PASS(?:ED)?|APPROVED|COMPLETED|SIGNED)\b|已通过|已经通过|已完成|完成签字/i.test(line);
  });
  return hasUnexecutedState && !fabricatedPass;
}

function machineReviewTermsPresent(text) {
  return [
    /机器|machine/i,
    /技术|technical/i,
    /视觉|visual/i,
    /相似(?:性)?|similarity/i,
    /风险|risk/i,
  ].every(pattern => pattern.test(text));
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
const approval = readText(APPROVAL_PATH);
const technicalReview = readText(TECHNICAL_REVIEW_PATH);
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
check('source records keep all optional human/IP advisory gates honest and unexecuted',
  review.includes('TECHNICAL_CANDIDATE / NOT_APPROVED_FOR_RUNTIME') &&
    ADVISORY_GATES.every(gate => advisoryStateIsHonest(`${approval}\n${review}\n${technicalReview}`, gate)));
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

const assetManifest = readJson(ASSET_MANIFEST_PATH);
const assetManifestText = readText(ASSET_MANIFEST_PATH);
const assetCatalog = readJson(ASSET_CATALOG_PATH);
const approvalMatrix = readText(APPROVAL_MATRIX_PATH);
const externalRegister = readJson(EXTERNAL_REGISTER_PATH);
const externalHashEvidence = readJson(EXTERNAL_HASH_EVIDENCE_PATH);
const publicAssetFiles = listFiles('public/assets');
const candidateHashes = new Set([...SOURCE_FILES, ...ALPHA_FILES].map(item => item.sha256));
const publicAssetHashMatches = publicAssetFiles
  .filter(file => /\.(png|webp)$/i.test(file))
  .filter(file => candidateHashes.has(sha256(file)));
const familyManifestEntries = (assetManifest.assets || [])
  .filter(entry => containsRuntimeMarker(JSON.stringify(entry)) ||
    normalize(entry?.source).toLowerCase() === PACK_ROOT.toLowerCase() ||
    normalize(entry?.source).toLowerCase().startsWith(PACK_ROOT.toLowerCase() + '/'));
const runtimeIds = familyManifestEntries.map(entry => entry.asset_id).filter(Boolean);
const runtimeFlags = familyManifestEntries.flatMap(featureFlagIds);
const manifestCandidateHashSignal = [...candidateHashes].some(hash => assetManifestText.includes(hash));
const publicAssetPathSignals = publicAssetFiles.filter(file => containsRuntimeMarker(file) || containsCandidateToken(file));
const canonicalConsumers = publicConsumerFiles();
const canonicalConsumerMarkerSignals = canonicalConsumers.filter(file => containsRuntimeMarker(readText(file)) || containsCandidateToken(readText(file)));
const canonicalConsumerTokenSignals = canonicalConsumers.filter(file => {
  const text = readText(file);
  return [...runtimeIds, ...runtimeFlags].some(token => token && text.includes(token));
});
const familyCatalogEntries = (assetCatalog.assets || []).filter(entry => containsRuntimeMarker(JSON.stringify(entry)));
const integratedCatalogSignals = familyCatalogEntries.filter(entry => entry.status !== 'reference-only' ||
  (entry.runtimePaths || []).some(runtimePath => normalize(runtimePath).startsWith('public/assets/')));
const familyClearanceFiles = clearanceFiles(runtimeIds);
const pixelMatrixRow = (approvalMatrix.match(/^\| Honru Pixel Avatar v3[^\n]*$/m) || [''])[0];
const runtimeSignals = [
  familyManifestEntries.length && `manifest=${familyManifestEntries.length}`,
  manifestCandidateHashSignal && 'manifest-source-hash',
  publicAssetPathSignals.length && `public-path=${publicAssetPathSignals.length}`,
  publicAssetHashMatches.length && `public-source-bytes=${publicAssetHashMatches.length}`,
  canonicalConsumerMarkerSignals.length && `consumer-marker=${canonicalConsumerMarkerSignals.length}`,
  canonicalConsumerTokenSignals.length && `consumer-token=${canonicalConsumerTokenSignals.length}`,
  integratedCatalogSignals.length && `catalog=${integratedCatalogSignals.length}`,
  familyClearanceFiles.length && `clearance=${familyClearanceFiles.length}`,
  pixelMatrixRow.includes(OWNER_CLEARANCE) && 'matrix-owner-clearance',
].filter(Boolean);
const runtimeMode = runtimeSignals.length > 0;

check('external blocked-license register remains reference-only and outside the repository/runtime lane',
  externalRegister.status === 'reference-only' &&
    externalRegister.storage?.copiedIntoRepository === false &&
    externalRegister.storage?.decompressedIntoRepository === false &&
    /不得直接复制到 public\/assets/.test(externalRegister.runtimePolicy || ''));

if (!runtimeMode) {
  check('source-only mode has no runtime Manifest, public bytes/path, consumer, integrated Catalog, or clearance signal',
    familyManifestEntries.length === 0 && !manifestCandidateHashSignal &&
      publicAssetPathSignals.length === 0 && publicAssetHashMatches.length === 0 &&
      canonicalConsumerMarkerSignals.length === 0 && canonicalConsumerTokenSignals.length === 0 &&
      integratedCatalogSignals.length === 0 && familyClearanceFiles.length === 0,
    runtimeSignals.join(', '));
  check('source-only Catalog records, if added, stay reference-only under art-source',
    familyCatalogEntries.every(entry => entry.status === 'reference-only' &&
      (entry.runtimePaths || []).every(runtimePath => normalize(runtimePath).startsWith('art-source/'))));
  check('source-only approval matrix has no owner-cleared runtime claim',
    pixelMatrixRow.includes('SOURCE_ONLY_CANDIDATE') && !pixelMatrixRow.includes(OWNER_CLEARANCE),
    pixelMatrixRow);
} else {
  const manifestIdsStable = familyManifestEntries.length > 0 &&
    new Set(runtimeIds).size === familyManifestEntries.length &&
    familyManifestEntries.every(entry => /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/.test(entry.asset_id || '') &&
      Number.isInteger(entry.artwork_version) && entry.artwork_version > 0 &&
      entry.clearance === OWNER_CLEARANCE &&
      /^project-owned(?:-|$)/.test(entry.license || '') &&
      (normalize(entry.source).toLowerCase() === PACK_ROOT.toLowerCase() ||
        normalize(entry.source).toLowerCase().startsWith(PACK_ROOT.toLowerCase() + '/')));
  check('runtime mode has unique stable IDs, versions, project provenance, and owner clearance in Manifest',
    manifestIdsStable,
    runtimeIds.join(', '));

  const runtimeRecords = familyManifestEntries.flatMap(runtimePathRecords);
  const runtimeFilesPinned = runtimeRecords.length > 0 && runtimeRecords.every(record => {
    const expected = integrityHash(record.integrity);
    return record.path.startsWith('public/assets/') && exists(record.path) && expected && sha256(record.path) === expected;
  });
  check('every owner-cleared runtime file exists under public/assets with its own stable SHA-256',
    runtimeFilesPinned,
    runtimeRecords.filter(record => !exists(record.path) || !integrityHash(record.integrity) ||
      (exists(record.path) && sha256(record.path) !== integrityHash(record.integrity))).map(record => record.path).join(', '));
  check('runtime derives new bytes instead of copying a source/Alpha candidate verbatim',
    publicAssetHashMatches.length === 0,
    publicAssetHashMatches.join(', '));

  check('runtime Manifest keeps an explicit feature flag/kill switch and fallback for every family entry',
    familyManifestEntries.every(entry => {
      const flags = featureFlagIds(entry);
      const structuredFlagsValid = !entry.feature_flags ||
        (['all', 'any'].includes(entry.feature_flags.operator) &&
          entry.feature_flags.enabled_value === '1' &&
          typeof entry.feature_flags.default_enabled === 'boolean');
      return flags.length > 0 && structuredFlagsValid &&
        ((typeof entry.fallback === 'string' && entry.fallback.trim()) ||
          (typeof entry.fallback_asset_id === 'string' && entry.fallback_asset_id.trim()));
    }));
  check('canonical runtime consumer references each stable asset ID or its feature flag',
    familyManifestEntries.length > 0 && familyManifestEntries.every(entry => {
      const tokens = [entry.asset_id, ...featureFlagIds(entry)];
      return canonicalConsumers.some(file => tokens.some(token => token && readText(file).includes(token)));
    }),
    canonicalConsumerTokenSignals.join(', '));
  check('runtime consumers never load the art-source pack or frozen source filenames directly',
    canonicalConsumers.every(file => !containsCandidateToken(readText(file))),
    canonicalConsumers.filter(file => containsCandidateToken(readText(file))).join(', '));

  const clearanceText = familyClearanceFiles.map(readText).join('\n');
  const runtimeHashes = runtimeRecords.map(record => integrityHash(record.integrity)).filter(Boolean);
  check('runtime mode has an auditable owner-clearance record bound to IDs, versions, hashes, and provenance',
    familyClearanceFiles.length > 0 &&
      runtimeIds.every(id => clearanceText.includes(id)) &&
      familyManifestEntries.every(entry => clearanceText.includes(String(entry.artwork_version))) &&
      runtimeHashes.every(hash => clearanceText.toLowerCase().includes(hash)) &&
      clearanceText.includes('PROMPT_AND_PROVENANCE.md') &&
      clearanceText.includes('NOT_RECOVERED'));
  check('owner-clearance record contains machine technical/visual/similarity-risk review and rollback chain',
    machineReviewTermsPresent(clearanceText) &&
      /M0 North Star/i.test(clearanceText) &&
      /fallback/i.test(clearanceText) &&
      /feature flag/i.test(clearanceText) &&
      /回滚|rollback/i.test(clearanceText));
  check('owner clearance keeps cleanup, Reviewer B, IP/legal, and Golden Set advisory without fabricated PASS',
    ADVISORY_GATES.every(gate => advisoryStateIsHonest(clearanceText, gate)));
  check('owner clearance explicitly excludes blocked-license/external reference material',
    /blocked-license/i.test(clearanceText) && /EXTERNAL_REFERENCE_ONLY/i.test(clearanceText) &&
      /不得|never|no exception/i.test(clearanceText));
  check('approval matrix moves the family atomically to owner-authorized clearance',
    pixelMatrixRow.includes(OWNER_CLEARANCE) && !pixelMatrixRow.includes('SOURCE_ONLY_CANDIDATE'),
    pixelMatrixRow);

  const externalHashes = new Set((externalHashEvidence.files || []).map(record => record.sha256));
  check('owner-cleared runtime bytes do not match any blocked-license external file',
    runtimeRecords.every(record => exists(record.path) && !externalHashes.has(sha256(record.path))));
}

if (failures) {
  console.error('HONRU_AVATAR_SOURCE_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('HONRU_AVATAR_SOURCE_CONTRACT_ALL_PASS mode=' + (runtimeMode ? 'OWNER_CLEARED_RUNTIME' : 'SOURCE_ONLY'));
}
