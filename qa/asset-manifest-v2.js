'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'backgrounds', 'v1', 'background_catalog_v1.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json'), 'utf8'));
const assetsSource = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '06-assets.js'), 'utf8');
const shopSource = fs.readFileSync(path.join(ROOT, 'public', 'src', 'shop', '06-shop.js'), 'utf8');
const serverSource = fs.readFileSync(path.join(ROOT, 'server', 'index.js'), 'utf8');

let failures = 0;
function check(name, condition){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name);
  if (!condition) failures++;
}
function absolute(assetPath){
  return path.join(ROOT, 'public', 'assets', ...String(assetPath).split('/'));
}
function repoAbsolute(assetPath){
  return path.join(ROOT, ...String(assetPath).split('/'));
}
function read24(buffer, offset){
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}
function webpInfo(file){
  const buffer = fs.readFileSync(file);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') throw new Error('not WebP: ' + file);
  let offset = 12, width = 0, height = 0, animated = false;
  while (offset + 8 <= buffer.length){
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && length >= 10){
      animated = !!(buffer[data] & 0x02);
      width = read24(buffer, data + 4) + 1;
      height = read24(buffer, data + 7) + 1;
    } else if (type === 'VP8 ' && !width && length >= 10){
      width = buffer.readUInt16LE(data + 6) & 0x3fff;
      height = buffer.readUInt16LE(data + 8) & 0x3fff;
    } else if (type === 'VP8L' && !width && length >= 5){
      const bits = buffer.readUInt32LE(data + 1);
      width = (bits & 0x3fff) + 1;
      height = ((bits >> 14) & 0x3fff) + 1;
    }
    if (type === 'ANIM') animated = true;
    offset = data + length + (length % 2);
  }
  return { width, height, animated, bytes:buffer.length };
}

check('Premium Background catalog 固定 12 个商品', catalog.items.length === 12);
check('Premium Background ID 固定为 20–31', JSON.stringify(catalog.items.map(item => item.id)) === JSON.stringify(Array.from({length:12},(_,i)=>20+i)));
check('六主题各含 1 Static + 1 Animated', ['pixel','anime','landscape','animal','neon','technology'].every(theme => {
  const items = catalog.items.filter(item => item.theme === theme);
  return items.length === 2 && items.filter(item => item.animated).length === 1;
}));

const required = ['assetId','theme','tier','animated','poster','asset','mobileCrop','miniCrop','textTone','overlay','fallback','staticFallback','license','source'];
check('每个背景具备 Manifest v1 必填字段', catalog.items.every(item => required.every(key => item[key] !== undefined && item[key] !== '')));
check('背景运行时路径全部存在且不越界', catalog.items.every(item => ['poster','asset','desktop','mobileCrop','miniCrop','staticFallback'].every(key => {
  const value = item[key];
  return value && !value.includes('..') && !path.isAbsolute(value) && fs.existsSync(absolute(value));
})));

const staticItems = catalog.items.filter(item => !item.animated);
const animatedItems = catalog.items.filter(item => item.animated);
check('全部 Poster 实际不超过 180 KB', catalog.items.every(item => fs.statSync(absolute(item.poster)).size <= 180 * 1024));
check('全部 Animated WebP 实际不超过 1.5 MB', animatedItems.every(item => fs.statSync(absolute(item.asset)).size <= 1536 * 1024));
check('Desktop / Poster / Mobile / Mini 实际尺寸正确', staticItems.every(item => {
  const desktop=webpInfo(absolute(item.desktop)),poster=webpInfo(absolute(item.poster)),mobile=webpInfo(absolute(item.mobileCrop)),mini=webpInfo(absolute(item.miniCrop));
  return desktop.width===1920&&desktop.height===1080&&poster.width===640&&poster.height===360&&mobile.width===900&&mobile.height===1200&&mini.width===640&&mini.height===360;
}));
check('动态资源实际为 720×405 Animated WebP', animatedItems.every(item => { const info=webpInfo(absolute(item.asset)); return info.width===720&&info.height===405&&info.animated; }));
check('动态策略包含离屏、页面隐藏与减少动态回退', /IntersectionObserver/.test(assetsSource) && /visibilitychange/.test(assetsSource) && /prefers-reduced-motion: reduce/.test(assetsSource));
check('服务端权威商城包含全部 20–31 背景价格', Array.from({length:12},(_,i)=>20+i).every(id => new RegExp('(?:^|[,\\s{])'+id+':(?:24|32)(?:[,\\s}])').test(serverSource)));
check('Asset Manifest 登记 Premium Background Pack', manifest.assets.some(asset => asset.asset_id === 'P-BACKGROUND-V1-CATALOG' && asset.status === 'integrated'));
const coverContract = {
  gomoku:'G-02-COVER', ludo:'G-07-COVER', monopoly:'G-08-COVER',
  tank:'G-09-COVER', tetris:'G-11-COVER', xiangqi:'G-06-COVER',
};
const coverAssets = Object.entries(coverContract).map(([game,assetId]) => manifest.assets.find(asset => asset.asset_id === assetId && asset.runtime_id === game));
check('六款大厅封面均有稳定 Asset ID 与 integrated 状态', coverAssets.every(Boolean) && coverAssets.every(asset => asset.status === 'integrated'));
check('六款封面源文件、640w 与 320w 运行时文件全部存在', coverAssets.every(asset => asset && fs.existsSync(repoAbsolute(asset.source)) && fs.existsSync(repoAbsolute(asset.runtime_path)) && asset.variants && fs.existsSync(repoAbsolute(asset.variants['320w']))));
check('六款封面尺寸严格为 640×360 与 320×180', coverAssets.every(asset => {
  if (!asset) return false;
  const large=webpInfo(repoAbsolute(asset.runtime_path)),small=webpInfo(repoAbsolute(asset.variants['320w']));
  return large.width===640&&large.height===360&&!large.animated&&small.width===320&&small.height===180&&!small.animated;
}));
check('六款封面首屏候选总量不超过 500 KB', coverAssets.reduce((sum,asset)=>sum+(asset?fs.statSync(repoAbsolute(asset.runtime_path)).size:0),0) <= 500*1024);
check('六款封面 integrity 与实际 SHA-256 一致', coverAssets.every(asset => {
  if (!asset || !/^sha256:[a-f0-9]{64}$/.test(asset.integrity || '')) return false;
  const actual=crypto.createHash('sha256').update(fs.readFileSync(repoAbsolute(asset.runtime_path))).digest('hex');
  return asset.integrity === 'sha256:' + actual;
}));
check('六款封面声明生成许可、懒加载、可读 fallback 与装饰图合同', coverAssets.every(asset => asset && asset.license === 'project-owned-ai-generated' && asset.load === 'lobby lazy' && asset.fallback && /可读 HTML/.test(asset.a11y || '')));
check('封面组件具备 srcset、lazy 与失败回退', /img\.srcset\s*=/.test(assetsSource) && /img\.loading\s*=\s*['"]lazy['"]/.test(assetsSource) && /asset-failed/.test((assetsSource.match(/function gameCoverNode[\s\S]*?\n}/)||[''])[0]));
const collectionPreviewSource = (shopSource.match(/function previewCollection\(item\)[\s\S]*?\n  function render\(/) || [''])[0];
check('Collection Try-On 同时预览头像、框、背景与名称效果且不触发购买', /avatarCanvas\(parts\.avatarId/.test(collectionPreviewSource) && /frame-ring/.test(collectionPreviewSource) && /nameFxNode\(previewAccount/.test(collectionPreviewSource) && /applyPremiumBackground\(hero,item\.id/.test(collectionPreviewSource) && !/requestPurchase\(/.test(collectionPreviewSource));

if (failures){ console.error('ASSET_MANIFEST_V2_FAILED: ' + failures); process.exit(1); }
console.log('ASSET_MANIFEST_V2_ALL_PASS');
