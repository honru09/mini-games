'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');

const ROOT = path.join(__dirname, '..');
const manifestPath = path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const webManifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'manifest.webmanifest'), 'utf8'));
const html = fs.readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const sourceJs = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '06-assets.js'), 'utf8');
const authJs = fs.readFileSync(path.join(ROOT, 'public', 'src', 'shop', '04-auth.js'), 'utf8');

let failures = 0;
function check(label, condition, detail = '') {
  const ok = !!condition;
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail ? ' :: ' + detail : ''));
  if (!ok) failures += 1;
}
function fileFor(runtimePath) {
  return path.join(ROOT, String(runtimePath).replace(/^public[\\/]/, 'public/').replace(/[\\/]/g, path.sep));
}
function digest(file) {
  const data = fs.readFileSync(file);
  return { bytes: data.length, sha256: crypto.createHash('sha256').update(data).digest('hex') };
}
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const PNG_CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const PNG_BIT_DEPTHS = {
  0: new Set([1, 2, 4, 8, 16]),
  2: new Set([8, 16]),
  3: new Set([1, 2, 4, 8]),
  4: new Set([8, 16]),
  6: new Set([8, 16]),
};
const ADAM7_PASSES = [
  [0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4],
  [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2],
];

let crcTable;
function crc32(bytes) {
  if (!crcTable) {
    crcTable = Array.from({ length: 256 }, (_, index) => {
      let value = index;
      for (let bit = 0; bit < 8; bit++) value = value & 1 ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
      return value >>> 0;
    });
  }
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paeth(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  return leftDistance <= aboveDistance && leftDistance <= upperLeftDistance ? left :
    aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function passSize(size, start, step) {
  return size <= start ? 0 : Math.ceil((size - start) / step);
}

function sampleAt(row, bitOffset, bitDepth) {
  if (bitDepth === 16) return row.readUInt16BE(bitOffset >>> 3);
  if (bitDepth === 8) return row[bitOffset >>> 3];
  const shift = 8 - bitDepth - (bitOffset & 7);
  return (row[bitOffset >>> 3] >>> shift) & ((1 << bitDepth) - 1);
}

function decodePng(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length < 33 || !bytes.subarray(0, 8).equals(PNG_SIGNATURE)) throw new Error('invalid PNG signature');

  let offset = 8;
  let header = null;
  let palette = null;
  let transparency = null;
  let sawIdat = false;
  let idatEnded = false;
  let sawIend = false;
  const idat = [];
  while (offset + 12 <= bytes.length) {
    const chunkOffset = offset;
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) throw new Error('truncated PNG ' + type + ' chunk');
    if (crc32(bytes.subarray(offset + 4, end)) !== bytes.readUInt32BE(end)) throw new Error('bad PNG ' + type + ' CRC');
    const data = bytes.subarray(start, end);

    if (type === 'IHDR') {
      if (chunkOffset !== 8 || header || length !== 13) throw new Error('invalid PNG IHDR');
      header = {
        width: data.readUInt32BE(0), height: data.readUInt32BE(4),
        bitDepth: data[8], colorType: data[9], compression: data[10],
        filter: data[11], interlace: data[12],
      };
    } else {
      if (!header) throw new Error('PNG IHDR must be first');
      if (type === 'PLTE') {
        if (sawIdat || palette || length < 3 || length > 768 || length % 3 !== 0) throw new Error('invalid PNG PLTE');
        palette = Buffer.from(data);
      } else if (type === 'tRNS') {
        if (sawIdat || transparency) throw new Error('invalid PNG tRNS ordering');
        transparency = Buffer.from(data);
      } else if (type === 'IDAT') {
        if (idatEnded) throw new Error('PNG IDAT chunks must be consecutive');
        sawIdat = true;
        idat.push(data);
      } else if (type === 'IEND') {
        if (!sawIdat || length !== 0) throw new Error('invalid PNG IEND');
        sawIend = true;
      } else {
        if (sawIdat) idatEnded = true;
        if ((type.charCodeAt(0) & 0x20) === 0) throw new Error('unknown critical PNG chunk ' + type);
      }
    }

    offset = end + 4;
    if (sawIend) break;
  }
  if (!header || !sawIend || offset !== bytes.length) throw new Error('incomplete PNG chunk stream');
  if (!header.width || !header.height || header.width * header.height > 64 * 1024 * 1024) throw new Error('invalid PNG dimensions');
  if (!PNG_BIT_DEPTHS[header.colorType] || !PNG_BIT_DEPTHS[header.colorType].has(header.bitDepth)) throw new Error('illegal PNG color type/bit depth');
  if (header.compression !== 0 || header.filter !== 0 || ![0, 1].includes(header.interlace)) throw new Error('unsupported PNG coding method');
  if ([0, 4].includes(header.colorType) && palette) throw new Error('PLTE is forbidden for grayscale PNG');
  if (header.colorType === 3 && (!palette || palette.length / 3 > (1 << header.bitDepth))) throw new Error('indexed PNG requires a legal palette');
  if (transparency) {
    const paletteEntries = palette ? palette.length / 3 : 0;
    const legalLength = header.colorType === 0 ? transparency.length === 2 :
      header.colorType === 2 ? transparency.length === 6 :
      header.colorType === 3 ? transparency.length > 0 && transparency.length <= paletteEntries : false;
    if (!legalLength) throw new Error('illegal PNG tRNS chunk');
  }

  const channels = PNG_CHANNELS[header.colorType];
  const bitsPerPixel = channels * header.bitDepth;
  const passes = header.interlace === 0 ? [[0, 0, 1, 1]] : ADAM7_PASSES;
  const passLayout = passes.map(([startX, startY, stepX, stepY]) => {
    const width = passSize(header.width, startX, stepX);
    const height = passSize(header.height, startY, stepY);
    return { startX, startY, stepX, stepY, width, height, rowBytes: Math.ceil(width * bitsPerPixel / 8) };
  }).filter(pass => pass.width && pass.height);
  const expectedInflatedBytes = passLayout.reduce((sum, pass) => sum + pass.height * (pass.rowBytes + 1), 0);
  const inflated = zlib.inflateSync(Buffer.concat(idat), { maxOutputLength: expectedInflatedBytes });
  if (inflated.length !== expectedInflatedBytes) throw new Error('unexpected PNG decoded byte length');

  const rgba = Buffer.alloc(header.width * header.height * 4);
  const sampleMax = (1 << Math.min(header.bitDepth, 15)) - 1;
  const channelMax = header.bitDepth === 16 ? 65535 : sampleMax;
  let cursor = 0;
  let transparentPixels = 0;
  let opaquePixels = 0;
  let minAlpha = 255;
  let maxAlpha = 0;
  for (const pass of passLayout) {
    let previous = Buffer.alloc(pass.rowBytes);
    const filterBytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
    for (let passY = 0; passY < pass.height; passY++) {
      const filterType = inflated[cursor++];
      if (filterType > 4) throw new Error('illegal PNG filter type');
      const row = Buffer.from(inflated.subarray(cursor, cursor + pass.rowBytes));
      cursor += pass.rowBytes;
      for (let index = 0; index < row.length; index++) {
        const left = index >= filterBytesPerPixel ? row[index - filterBytesPerPixel] : 0;
        const above = previous[index] || 0;
        const upperLeft = index >= filterBytesPerPixel ? previous[index - filterBytesPerPixel] : 0;
        const predictor = filterType === 0 ? 0 : filterType === 1 ? left : filterType === 2 ? above :
          filterType === 3 ? Math.floor((left + above) / 2) : paeth(left, above, upperLeft);
        row[index] = (row[index] + predictor) & 255;
      }

      for (let passX = 0; passX < pass.width; passX++) {
        const samples = [];
        for (let channel = 0; channel < channels; channel++) samples.push(sampleAt(row, (passX * channels + channel) * header.bitDepth, header.bitDepth));
        let red;
        let green;
        let blue;
        let alphaRaw = channelMax;
        let alphaRawMax = channelMax;
        if (header.colorType === 0) {
          red = green = blue = Math.round(samples[0] * 255 / channelMax);
          if (transparency && samples[0] === transparency.readUInt16BE(0)) alphaRaw = 0;
        } else if (header.colorType === 2) {
          [red, green, blue] = samples.map(value => Math.round(value * 255 / channelMax));
          if (transparency && samples.every((value, index) => value === transparency.readUInt16BE(index * 2))) alphaRaw = 0;
        } else if (header.colorType === 3) {
          const paletteIndex = samples[0];
          if (paletteIndex >= palette.length / 3) throw new Error('PNG palette index out of range');
          red = palette[paletteIndex * 3]; green = palette[paletteIndex * 3 + 1]; blue = palette[paletteIndex * 3 + 2];
          alphaRawMax = 255;
          alphaRaw = transparency && paletteIndex < transparency.length ? transparency[paletteIndex] : 255;
        } else if (header.colorType === 4) {
          red = green = blue = Math.round(samples[0] * 255 / channelMax);
          alphaRaw = samples[1];
        } else {
          red = Math.round(samples[0] * 255 / channelMax);
          green = Math.round(samples[1] * 255 / channelMax);
          blue = Math.round(samples[2] * 255 / channelMax);
          alphaRaw = samples[3];
        }
        const alpha = Math.round(alphaRaw * 255 / alphaRawMax);
        const x = pass.startX + passX * pass.stepX;
        const y = pass.startY + passY * pass.stepY;
        const pixelOffset = (y * header.width + x) * 4;
        rgba[pixelOffset] = red; rgba[pixelOffset + 1] = green; rgba[pixelOffset + 2] = blue; rgba[pixelOffset + 3] = alpha;
        if (alphaRaw < alphaRawMax) transparentPixels++;
        if (alphaRaw === alphaRawMax) opaquePixels++;
        minAlpha = Math.min(minAlpha, alpha);
        maxAlpha = Math.max(maxAlpha, alpha);
      }
      previous = row;
    }
  }
  return {
    ...header, rgba, hasAlpha: header.colorType === 4 || header.colorType === 6 || !!transparency,
    hasTransparencyChunk: !!transparency, transparentPixels, opaquePixels, minAlpha, maxAlpha,
  };
}

function pngInfo(file) {
  try { return decodePng(file); }
  catch (error) { return { error: error && error.message ? error.message : String(error) }; }
}

function read24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpInfo(file) {
  try {
    const bytes = fs.readFileSync(file);
    if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('invalid WebP RIFF header');
    const riffEnd = 8 + bytes.readUInt32LE(4);
    if (riffEnd !== bytes.length) throw new Error('WebP RIFF size mismatch');
    let offset = 12;
    let extended = null;
    let image = null;
    let alphaChunk = false;
    while (offset + 8 <= riffEnd) {
      const type = bytes.toString('ascii', offset, offset + 4);
      const length = bytes.readUInt32LE(offset + 4);
      const data = offset + 8;
      const end = data + length;
      if (end > riffEnd || end + (length & 1) > riffEnd) throw new Error('truncated WebP ' + type + ' chunk');
      if ((length & 1) && bytes[end] !== 0) throw new Error('non-zero WebP padding byte');
      if (type === 'VP8X') {
        if (extended || offset !== 12 || length !== 10) throw new Error('invalid WebP VP8X chunk');
        if ((bytes[data] & 0xc1) || bytes[data + 1] || bytes[data + 2] || bytes[data + 3]) throw new Error('reserved WebP VP8X bits are set');
        extended = {
          width: read24LE(bytes, data + 4) + 1,
          height: read24LE(bytes, data + 7) + 1,
          alphaFlag: !!(bytes[data] & 0x10),
        };
      } else if (type === 'VP8 ') {
        if (image || length < 10 || (bytes[data] & 1) !== 0 || bytes[data + 3] !== 0x9d || bytes[data + 4] !== 0x01 || bytes[data + 5] !== 0x2a) throw new Error('invalid WebP VP8 frame header');
        image = { width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff, kind: 'VP8', losslessAlpha: false };
      } else if (type === 'VP8L') {
        if (image || length < 5 || bytes[data] !== 0x2f) throw new Error('invalid WebP VP8L frame header');
        const bits = bytes.readUInt32LE(data + 1);
        if ((bits >>> 29) !== 0) throw new Error('unsupported WebP VP8L version');
        image = { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1, kind: 'VP8L', losslessAlpha: !!(bits & 0x10000000) };
      } else if (type === 'ALPH') {
        alphaChunk = true;
      }
      offset = end + (length & 1);
    }
    if (offset !== riffEnd || (!extended && !image)) throw new Error('incomplete WebP chunk stream');
    if (image && (!image.width || !image.height)) throw new Error('invalid WebP dimensions');
    if (extended && image && (extended.width !== image.width || extended.height !== image.height)) throw new Error('WebP canvas/frame dimensions disagree');
    const hasAlpha = !!((extended && extended.alphaFlag) || alphaChunk || (image && image.losslessAlpha));
    if (extended && alphaChunk && !extended.alphaFlag) throw new Error('WebP ALPH chunk lacks VP8X alpha flag');
    return {
      width: extended ? extended.width : image.width,
      height: extended ? extended.height : image.height,
      kind: extended ? 'VP8X' : image.kind,
      hasAlpha,
    };
  } catch (error) {
    return { error: error && error.message ? error.message : String(error) };
  }
}

function statusSvgInfo(text) {
  const reasons = [];
  if (!/<svg\b/i.test(text) || !/<\/svg>\s*$/i.test(text)) reasons.push('missing SVG root');
  if (!/\bviewBox\s*=\s*(["'])0\s+0\s+64\s+64\1/i.test(text)) reasons.push('wrong viewBox');
  const namespacePattern = /\bxmlns(?::([A-Za-z_][\w.-]*))?\s*=\s*(["'])(.*?)\2/gi;
  const namespaces = [...text.matchAll(namespacePattern)];
  const hasSvgNamespace = namespaces.some(match => !match[1] && match[3] === 'http://www.w3.org/2000/svg');
  const namespacesSafe = namespaces.every(match =>
    (!match[1] && match[3] === 'http://www.w3.org/2000/svg') ||
    (String(match[1]).toLowerCase() === 'xlink' && match[3] === 'http://www.w3.org/1999/xlink'));
  if (!hasSvgNamespace || !namespacesSafe) reasons.push('unsafe namespace');
  const withoutNamespaces = text.replace(namespacePattern, '');
  if (/<(?:script|foreignObject|image|iframe|object|embed)\b/i.test(text)) reasons.push('active/external element');
  if (/<text\b/i.test(text)) reasons.push('text element');
  if (/<!DOCTYPE\b|<!ENTITY\b|\bon[a-z]+\s*=|@import\b|\bjavascript\s*:/i.test(text)) reasons.push('active markup');
  if (/\bdata\s*:|\b(?:https?|ftp|file)\s*:|\.psd\b|\.ai\b/i.test(withoutNamespaces)) reasons.push('external/data reference');
  const hrefPattern = /\b(?:xlink:)?href\s*=\s*(["'])(.*?)\1/gi;
  const hrefs = [...text.matchAll(hrefPattern)];
  if ((text.match(/\b(?:xlink:)?href\s*=/gi) || []).length !== hrefs.length || hrefs.some(match => !/^#[A-Za-z_][\w:.-]*$/.test(match[2]))) reasons.push('external/malformed href');
  const urlPattern = /url\(\s*(["']?)(.*?)\1\s*\)/gi;
  const urls = [...text.matchAll(urlPattern)];
  if ((text.match(/url\(/gi) || []).length !== urls.length || urls.some(match => !/^#[A-Za-z_][\w:.-]*$/.test(match[2]))) reasons.push('external/malformed url()');
  return { safe: reasons.length === 0, detail: reasons.join(', ') || 'self-contained vector' };
}

function maskableSafety(info) {
  if (!info || info.error || !info.rgba || info.width !== info.height) return null;
  const background = [...info.rgba.subarray(0, 4)];
  const sameBackground = (x, y) => {
    const pixel = (y * info.width + x) * 4;
    return info.rgba[pixel] === background[0] && info.rgba[pixel + 1] === background[1] &&
      info.rgba[pixel + 2] === background[2] && info.rgba[pixel + 3] === background[3];
  };
  let edgeUniform = true;
  for (let coordinate = 0; coordinate < info.width; coordinate++) {
    if (!sameBackground(coordinate, 0) || !sameBackground(coordinate, info.height - 1) ||
        !sameBackground(0, coordinate) || !sameBackground(info.width - 1, coordinate)) edgeUniform = false;
  }
  const safeRadius = info.width * 0.4;
  let foregroundPixels = 0;
  let unsafeForegroundPixels = 0;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if (sameBackground(x, y)) continue;
      foregroundPixels++;
      const distance = Math.hypot(x + 0.5 - info.width / 2, y + 0.5 - info.height / 2);
      if (distance > safeRadius) unsafeForegroundPixels++;
    }
  }
  return { edgeUniform, foregroundPixels, unsafeForegroundPixels, safeRadius };
}
function asset(id) { return manifest.assets.find(item => item && item.asset_id === id); }
function allVariants(item) { return item && item.variants && typeof item.variants === 'object' ? item.variants : {}; }

const ids = [
  'P-AUTH-GHOST-WAKE-BACKDROP-V1',
  'P-AUTH-HONRU-SCENES-V1',
  'P-BOOT-HONRU-CONTROLLER-V1',
  'P-AUTH-STATUS-ICONS-V1',
  'P-PWA-GHOST-WAKE-V1',
];
const items = ids.map(asset);
check('P0-01 runtime IDs are present and unique', items.every(Boolean) && new Set(ids).size === ids.length);

for (const item of items) {
  if (!item) continue;
  const variants = allVariants(item);
  check(item.asset_id + ' owner clearance and default-on contract', item.status === 'ready' && item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && item.feature_flags && item.feature_flags.default_enabled === true && item.feature_flags.operator === 'all');
  check(item.asset_id + ' has source, fallback, a11y and byte budget', typeof item.source === 'string' && typeof item.fallback === 'string' && typeof item.a11y === 'string' && Number(item.byte_budget) > 0);
  check(item.asset_id + ' variant integrity/bytes keys match', Object.keys(variants).sort().join('|') === Object.keys(item.variant_integrity || {}).sort().join('|') && Object.keys(variants).sort().join('|') === Object.keys(item.variant_bytes || {}).sort().join('|'));
  for (const [key, runtimePath] of Object.entries(variants)) {
    const file = fileFor(runtimePath);
    check(item.asset_id + '/' + key + ' path exists and stays public/assets', fs.existsSync(file) && String(runtimePath).startsWith('public/assets/'));
    if (!fs.existsSync(file)) continue;
    const d = digest(file);
    check(item.asset_id + '/' + key + ' SHA and bytes', d.sha256 === item.variant_integrity[key].replace(/^sha256:/, '') && d.bytes === item.variant_bytes[key], `${d.bytes} bytes`);
  }
}

const background = asset('P-AUTH-GHOST-WAKE-BACKDROP-V1');
for (const [key, runtimePath] of Object.entries(allVariants(background))) {
  const info = webpInfo(fileFor(runtimePath));
  const mobile = key.includes('mobile');
  check('background ' + key + ' WebP dimensions', info && !info.error && info.width === (mobile ? 900 : 1920) && info.height === (mobile ? 1200 : 1080), info && !info.error ? `${info.kind} ${info.width}x${info.height}` : (info && info.error) || 'not WebP');
}
const honru = asset('P-AUTH-HONRU-SCENES-V1');
for (const key of Object.keys(allVariants(honru))) {
  const info = webpInfo(fileFor(honru.variants[key]));
  const sizeMatch = key.match(/-(160|240|320)$/);
  const expectedSize = sizeMatch ? Number(sizeMatch[1]) : 0;
  check('auth Honru ' + key + ' alpha WebP', info && !info.error && info.width === expectedSize && info.height === expectedSize && (info.kind === 'VP8X' || info.kind === 'VP8L') && info.hasAlpha, info && !info.error ? `${info.kind} ${info.width}x${info.height} alpha=${info.hasAlpha}` : (info && info.error) || 'not WebP');
}
for (const file of fs.readdirSync(path.join(ROOT, 'art-source', 'platform', 'auth', 'ghost-wake-v1', 'alpha')).filter(name => name.startsWith('honru-auth-') && name.endsWith('.png'))) {
  const info = pngInfo(path.join(ROOT, 'art-source', 'platform', 'auth', 'ghost-wake-v1', 'alpha', file));
  const supportedAlphaEncoding = info && (info.colorType === 4 || info.colorType === 6 || (info.colorType === 3 && info.hasTransparencyChunk));
  check('source alpha ' + file, info && !info.error && info.width === 512 && info.height === 512 && supportedAlphaEncoding && info.hasAlpha && info.transparentPixels > 0 && info.opaquePixels > 0, info && !info.error ? `${info.width}x${info.height} type=${info.colorType} depth=${info.bitDepth} alpha=${info.minAlpha}-${info.maxAlpha}` : (info && info.error) || 'invalid PNG');
}
for (const file of fs.readdirSync(path.join(ROOT, 'art-source', 'platform', 'auth', 'status-v1')).filter(name => name.endsWith('.svg'))) {
  const text = fs.readFileSync(path.join(ROOT, 'art-source', 'platform', 'auth', 'status-v1', file), 'utf8');
  const info = statusSvgInfo(text);
  check('status SVG ' + file + ' is no-text safe vector', info.safe, info.detail);
}
for (const file of ['ghost-game-maskable-192-v1.png','ghost-game-maskable-512-v1.png']) {
  const info = pngInfo(path.join(ROOT, 'public', 'assets', 'brand', 'pwa', 'ghost-wake-v1', file));
  const safety = maskableSafety(info);
  const expectedSize = Number(file.match(/(192|512)/)[1]);
  check('maskable ' + file + ' opaque full-bleed 80% safe-zone PNG', info && !info.error && info.width === expectedSize && info.height === expectedSize && info.transparentPixels === 0 && info.minAlpha === 255 && info.maxAlpha === 255 && safety && safety.edgeUniform && safety.foregroundPixels > 0 && safety.unsafeForegroundPixels === 0, info && !info.error && safety ? `type=${info.colorType} depth=${info.bitDepth} foreground=${safety.foregroundPixels} unsafe=${safety.unsafeForegroundPixels}` : (info && info.error) || 'invalid PNG');
}
check('PWA manifest points to project-owned maskable PNGs', JSON.stringify(webManifest.icons).includes('ghost-wake-v1/ghost-game-maskable-192-v1.png') && JSON.stringify(webManifest.icons).includes('ghost-wake-v1/ghost-game-maskable-512-v1.png'));
check('P0-01 first-screen decoded candidate remains under 512KB', 26756 + 14182 + 14564 < 512000);
check('boot screen has honest indeterminate HTML progress and fallback', html.includes('ghost-boot-screen') && html.includes('ghost-boot-progress') && html.includes('ghost-game-mark.svg'));
check('auth background uses defined Ghost scene token and keeps runtime WebP layer computable', /\.ghost-auth-page\{background-color:var\(--ghost-scene\);background-image:[^}]*var\(--auth-ghost-wake-background,none\)/.test(html) && !/\.ghost-auth-page\{[^}]*var\(--bg-primary\)/.test(html));
check('forced-colors removes decorative art without stranding the copy in the art column', html.includes('@media(forced-colors:active)') && html.includes('.ghost-auth-card .auth-hero{grid-template-columns:minmax(0,1fr);min-height:0}'));
check('auth runtime resolver is manifest/flag/fallback gated', sourceJs.includes('resolveAuthBackgroundUrl') && sourceJs.includes('resolveAuthHonruSceneUrl') && sourceJs.includes('resolveBootHonruUrl') && sourceJs.includes('authArtManifestPromise'));
check('auth runtime validates source identity and decodes before activation', sourceJs.includes('AUTH_ART_SOURCE_IDS') && sourceJs.includes('AUTH_ART_CLEARANCE_RECORD') && sourceJs.includes("probe.decode().then(activate, restore)"));
check('auth panel mounts stateful scene art, connection sync and guest art without baking copy', authJs.includes('authDecorativeImage') && authJs.includes('setAuthHeroScene') && authJs.includes('syncAuthConnectionState') && authJs.includes('guest-safe-entry') && !/data:image\//i.test(authJs));

if (failures) {
  console.error('AUTH_ART_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('AUTH_ART_CONTRACT_ALL_PASS');
}
