'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'backgrounds', 'v1', 'background_catalog_v1.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'assets', 'manifests', 'asset_manifest.json'), 'utf8'));
const assetsSource = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '06-assets.js'), 'utf8');
const gomokuSource = fs.readFileSync(path.join(ROOT, 'public', 'src', 'games', 'gomoku.js'), 'utf8');
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
  let offset = 12, width = 0, height = 0, animated = false, alpha = false;
  while (offset + 8 <= buffer.length){
    const type = buffer.toString('ascii', offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const data = offset + 8;
    if (type === 'VP8X' && length >= 10){
      animated = !!(buffer[data] & 0x02);
      alpha = !!(buffer[data] & 0x10);
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
    if (type === 'ALPH') alpha = true;
    offset = data + length + (length % 2);
  }
  return { width, height, animated, alpha, bytes:buffer.length };
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
const stickerGomoku = manifest.assets.find(asset => asset.asset_id === 'G-02-STICKER-BOARD-SURFACE-V1');
const stickerGomokuPath = stickerGomoku && repoAbsolute(stickerGomoku.runtime_path);
const stickerGomokuSvg = stickerGomokuPath && fs.existsSync(stickerGomokuPath) ? fs.readFileSync(stickerGomokuPath, 'utf8') : '';
const stickerFlagContract = {operator:'all',enabled_value:'1',default_enabled:false,ids:['mg_art_sticker_m0_v1','mg_art_gomoku_sticker_v1']};
const stickerRuntimePath = 'public/assets/games/gomoku/sticker-v1/gomoku-board-surface-v1.svg';
const stickerFrozenHash = '05f88a47b3902f6a96a6b243da19f97aa8e12d39500ebe95576221cb6c9a8e35';
const stickerDirectory = path.dirname(stickerGomokuPath || repoAbsolute(stickerRuntimePath));
function safeStickerSvg(source){
  const clean = String(source || '').replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/i,'');
  return /<svg\b[^>]*\bwidth="520"[^>]*\bheight="520"[^>]*\bviewBox="0 0 520 520"/.test(clean) &&
    !/<!DOCTYPE|<!ENTITY|<(?:script|style|foreignObject|iframe|object|embed|image|audio|video|filter|fe[A-Z]|animate|animateTransform|set|text)\b/i.test(clean) &&
    !/\son[a-z]+\s*=|\s(?:href|src|style)\s*=|@import|url\s*\(/i.test(clean);
}
check('M0 五子棋运行时资产使用稳定 ID、版本、预算和默认关闭双闸门', !!stickerGomoku && stickerGomoku.runtime_id === 'gomoku' && stickerGomoku.artwork_version === 1 && stickerGomoku.status === 'ready' && stickerGomoku.actual_bytes === 998 && stickerGomoku.byte_budget === 1536*1024 && JSON.stringify(stickerGomoku.feature_flags) === JSON.stringify(stickerFlagContract));
check('M0 五子棋 SVG 路径固定、普通文件、无越界且目录无未登记运行时文件', !!stickerGomokuPath && stickerGomoku.runtime_path === stickerRuntimePath && !stickerGomoku.runtime_path.includes('..') && !stickerGomoku.runtime_path.includes('\\') && fs.lstatSync(stickerGomokuPath).isFile() && !fs.lstatSync(stickerGomokuPath).isSymbolicLink() && fs.realpathSync(stickerGomokuPath).startsWith(fs.realpathSync(path.join(ROOT,'public','assets')) + path.sep) && JSON.stringify(fs.readdirSync(stickerDirectory).sort()) === JSON.stringify(['gomoku-board-surface-v1.svg']));
check('M0 五子棋 SVG 实际字节不超过单游戏 1.5MB 预算', fs.statSync(stickerGomokuPath).size === stickerGomoku.actual_bytes && fs.statSync(stickerGomokuPath).size <= stickerGomoku.byte_budget);
check('M0 五子棋 SVG integrity、冻结 hash 与实际 SHA-256 三方一致', /^sha256:[a-f0-9]{64}$/.test(stickerGomoku.integrity || '') && stickerGomoku.integrity === 'sha256:' + stickerFrozenHash && stickerFrozenHash === crypto.createHash('sha256').update(fs.readFileSync(stickerGomokuPath)).digest('hex'));
check('M0 五子棋 SVG 为安全静态白名单且恶意样本会被拒绝', safeStickerSvg(stickerGomokuSvg) && !safeStickerSvg('<svg width="520" height="520" viewBox="0 0 520 520"><script>alert(1)</script></svg>') && !safeStickerSvg('<svg width="520" height="520" viewBox="0 0 520 520"><path href="other.svg#shape"/></svg>') && !safeStickerSvg('<svg width="520" height="520" viewBox="0 0 520 520"><path style="fill:url(other.svg#paint)"/></svg>') && !safeStickerSvg('<svg width="520" height="520" viewBox="0 0 520 520"><path fill="url(other.svg#paint)"/></svg>') && !safeStickerSvg('<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///x">]><svg width="520" height="520" viewBox="0 0 520 520"/>'));
const legacyGomokuBoard = manifest.assets.find(asset => asset.asset_id === 'G-02-BOARD-SURFACE');
check('M0 五子棋 runtime 明确回退未漂移木纹资产且规则 Canvas 仍为权威', !!stickerGomoku && stickerGomoku.fallback_asset_id === 'G-02-BOARD-SURFACE' && legacyGomokuBoard.runtime_path === 'public/assets/board/gomoku/mg_board_gomoku_surface_v01.webp' && legacyGomokuBoard.integrity === 'sha256:6aee61b0425b31551c0b5c83795a4937047ca95f6542b37d0879391a3d0b10f8' && legacyGomokuBoard.feature_flag === 'mg_art_gomoku_v1' && /15x15 网格/.test(stickerGomoku.a11y || '') && /grid\s*=\s*Array\.from/.test(gomokuSource));
const stickerFlagSource = (assetsSource.match(/function stickerArtEnabled\(id\)[\s\S]*?\n}/) || [''])[0];
check('M0 双闸门只接受显式 1 且异常默认关闭', /STICKER_ART_MASTER_FLAG\) === '1'/.test(stickerFlagSource) && /getItem\(art\.flag\) === '1'/.test(stickerFlagSource) && /catch \(error\) \{\s*return false;/.test(stickerFlagSource));
check('M0 路径只由 runtime manifest 稳定 asset ID 解析', !/games\/gomoku\/sticker-v1\/gomoku-board-surface-v1\.svg/.test(assetsSource) && /fetch\(assetUrl\('manifest'\)/.test(assetsSource) && /asset\.asset_id === assetId/.test(assetsSource) && assetsSource.includes("const expectedPrefix = 'public/assets/games/' + id + '/'") && /sticker-v\[1-9\]/.test(assetsSource));
check('M0 Manifest、加载或 decode 失败只回退表现层', /response && response\.ok \? response\.json\(\) : null/.test(assetsSource) && /probe\.decode\(\)/.test(gomokuSource) && /stickerArtState = 'fallback'; applyPresentation\(\); draw\(\);/.test(gomokuSource) && !/stickerArt(?:Active|State|Requested)[\s\S]{0,80}(?:snapshot|sendMove|onProgress)/.test(gomokuSource));
check('M0 静态底材无新增动画、计时器或持续重绘', !/<(?:animate|animateTransform|set)\b/i.test(stickerGomokuSvg) && !/requestAnimationFrame|setInterval/.test((gomokuSource.match(/function initStickerSurface\(\)[\s\S]*?\n  }/) || [''])[0]));
const honruStates = ['idle','thinking','surprised','win','lose','recover','waiting-invite','check-in','playful'];
const honruRuntime = manifest.assets.find(asset => asset.asset_id === 'P-HONRU-STATES-V1');
const honruFlagContract = {operator:'all',enabled_value:'1',default_enabled:true,ids:['mg_art_honru_states_v1','mg_art_honru_game_reactions_v1']};
const honruFiles = honruStates.map(state => honruRuntime && honruRuntime.variants && repoAbsolute(honruRuntime.variants[state]));
const honruDirectory = path.join(ROOT,'public','assets','brand','honru','states-v1');
check('Honru 九状态 Manifest 使用稳定 ID、所有者清除、版本、预算和默认开启双回滚闸门', !!honruRuntime && honruRuntime.runtime_id==='honru' && honruRuntime.artwork_version===1 && honruRuntime.status==='ready' && honruRuntime.clearance==='OWNER_AUTHORIZED_ART_CLEARANCE' && honruRuntime.actual_bytes===372796 && honruRuntime.byte_budget===512*1024 && JSON.stringify(honruRuntime.feature_flags)===JSON.stringify(honruFlagContract) && JSON.stringify(Object.keys(honruRuntime.variants))===JSON.stringify(honruStates));
check('Honru 九状态目录仅含登记的普通 WebP 文件且无越界', honruFiles.every(file=>file&&fs.existsSync(file)&&fs.lstatSync(file).isFile()&&!fs.lstatSync(file).isSymbolicLink()&&fs.realpathSync(file).startsWith(fs.realpathSync(path.join(ROOT,'public','assets'))+path.sep)) && JSON.stringify(fs.readdirSync(honruDirectory).sort())===JSON.stringify(honruStates.map(state=>'honru-'+state+'-v1.webp').sort()));
check('Honru 九状态均为 1254×1254 静态 Alpha WebP', honruFiles.every(file=>{const info=webpInfo(file);return info.width===1254&&info.height===1254&&info.alpha&&!info.animated;}));
check('Honru 九状态逐文件字节、总预算和 SHA-256 一致', honruStates.every((state,index)=>{const file=honruFiles[index],bytes=fs.statSync(file).size,hash=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');return honruRuntime.variant_bytes[state]===bytes&&honruRuntime.variant_integrity[state]==='sha256:'+hash;}) && honruFiles.reduce((sum,file)=>sum+fs.statSync(file).size,0)===honruRuntime.actual_bytes && honruRuntime.actual_bytes<=honruRuntime.byte_budget && honruRuntime.integrity===honruRuntime.variant_integrity.idle);
const honruV1 = manifest.assets.find(asset => asset.asset_id === 'P-002-HONRU-MASCOT-V1');
check('Honru 状态组失败回退到冻结 v1 SVG', !!honruV1 && honruRuntime.fallback_asset_id==='P-002-HONRU-MASCOT-V1' && honruRuntime.fallback.includes('honru-mascot-v1.svg') && honruV1.integrity==='sha256:42c6442efc3d86ef6d939d936bff3c83a59c46c63002fa817ea4551da3a2de64');
const ownerFlagSource=(assetsSource.match(/function ownerClearedDefaultOnFlagEnabled\(flag\)[\s\S]*?\n}/)||[''])[0];
const honruFlagSource=(assetsSource.match(/function honruStatesEnabled\(\)[\s\S]*?\n}/)||[''])[0];
const honruReactionFlagSource=(assetsSource.match(/function honruGameReactionsEnabled\(\)[\s\S]*?\n}/)||[''])[0];
const honruResolverSource=(assetsSource.match(/async function resolveHonruStateUrl\(stateId\)[\s\S]*?\n}/)||[''])[0];
check('Honru 所有者清除旗标缺失时默认开、显式 1 开、其他值与存储异常关闭，局内分闸门不连带平台状态',/value === null \|\| value === '1'/.test(ownerFlagSource)&&/catch \(error\) \{\s*return false;/.test(ownerFlagSource)&&/ownerClearedDefaultOnFlagEnabled\(HONRU_STATES_MASTER_FLAG\)/.test(honruFlagSource)&&/honruStatesEnabled\(\).*ownerClearedDefaultOnFlagEnabled\(HONRU_GAME_REACTIONS_FLAG\)/s.test(honruReactionFlagSource));
check('Honru 状态路径由 Manifest allowlist 按需解析且不预载整组',/HONRU_STATE_ID_SET\.has\(state\)/.test(honruResolverSource)&&/asset\.asset_id === HONRU_STATE_ASSET_ID/.test(honruResolverSource)&&/expectedPath/.test(honruResolverSource)&&/states-v1/.test(honruResolverSource)&&!/Promise\.all|forEach\([^)]*resolveHonruStateUrl/.test(honruResolverSource));
const collectionPreviewSource = (shopSource.match(/function previewCollection\(item\)[\s\S]*?\n  function render\(/) || [''])[0];
check('Collection Try-On 同时预览头像、框、背景与名称效果且不触发购买', /avatarCanvas\(parts\.avatarId/.test(collectionPreviewSource) && /frame-ring/.test(collectionPreviewSource) && /nameFxNode\(previewAccount/.test(collectionPreviewSource) && /applyPremiumBackground\(hero,item\.id/.test(collectionPreviewSource) && !/requestPurchase\(/.test(collectionPreviewSource));

if (failures){ console.error('ASSET_MANIFEST_V2_FAILED: ' + failures); process.exit(1); }
console.log('ASSET_MANIFEST_V2_ALL_PASS');
