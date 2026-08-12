'use strict';

/*
 * Avatar curation + premium background lifecycle contract v1.
 *
 * This is deliberately a client presentation contract. It must not turn a
 * local price into purchase authority: the server-owned `owned` projection
 * and existing purchase request remain the only authority seam.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const ASSETS_PATH = path.join(ROOT, 'public', 'src', 'core', '06-assets.js');
const ROSTER_PATH = path.join(ROOT, 'public', 'src', 'ui', '07-roster.js');
const SHOP_PATH = path.join(ROOT, 'public', 'src', 'shop', '06-shop.js');
const assets = fs.readFileSync(ASSETS_PATH, 'utf8');
const roster = fs.readFileSync(ROSTER_PATH, 'utf8');
const shop = fs.readFileSync(SHOP_PATH, 'utf8');

const failures = [];
function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

function sourceSlice(source, startPattern, endPattern){
  const start = startPattern.exec(source);
  if (!start) return '';
  const end = endPattern.exec(source.slice(start.index + start[0].length));
  return end ? source.slice(start.index, start.index + start[0].length + end.index) : source.slice(start.index);
}

function compact(value){
  return String(value).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

/*
 * The curated starter set is intentionally tiny and pixel-first. Paid catalog
 * entries remain purchasable, and a previously equipped legacy starter still
 * remains readable/selectable without making it a default option again.
 */
const hasCurationApi =
  /const\s+CURATED_DEFAULT_FREE_AVATAR_IDS\s*=\s*Object\.freeze\(\s*\[\s*100\s*,\s*101\s*\]\s*\)/.test(assets) &&
  /function\s+isCuratedDefaultFreeAvatarId\s*\(/.test(assets) &&
  /function\s+curatedAvatarCatalogItems\s*\(/.test(assets);

check('唯一品牌免费头像集合冻结为像素 100/101', hasCurationApi,
  '缺少 CURATED_DEFAULT_FREE_AVATAR_IDS 或其公开过滤 API');

if (hasCurationApi){
  try {
    const context = vm.createContext({});
    vm.runInContext(assets + '\nthis.__curation={isCuratedDefaultFreeAvatarId,curatedAvatarCatalogItems};', context, { filename:ASSETS_PATH });
    const catalog = [
      { id:100, free:true }, { id:101, free:true }, { id:108, free:true },
      { id:102, free:false }, { id:30, free:false },
    ];
    const defaultIds = context.__curation.curatedAvatarCatalogItems(catalog, 100).map(item => item.id);
    const legacySelectedIds = context.__curation.curatedAvatarCatalogItems(catalog, 108).map(item => item.id);
    check('默认目录只显示策展免费项并保留可售项',
      JSON.stringify(defaultIds) === JSON.stringify([100, 101, 102, 30]), JSON.stringify(defaultIds));
    check('已装备的历史免费 ID 继续可读且可选',
      legacySelectedIds.includes(108) && context.__curation.isCuratedDefaultFreeAvatarId(108) === false,
      JSON.stringify(legacySelectedIds));
  } catch (error){
    check('头像策展 API 可在轻量运行时执行', false, error.stack || error.message);
  }
}

try {
  const rosterCatalog = sourceSlice(roster, /const\s+AVATAR_COUNT\s*=/, /function\s+makeAvatar\s*\(/);
  const context = vm.createContext({
    PREMIUM_BACKGROUNDS:[],
    account:{ owned:{ avatars:[] } },
    isCuratedDefaultFreeAvatarId:id => Number(id) === 100 || Number(id) === 101,
  });
  vm.runInContext(rosterCatalog + '\nthis.__avatarPickerIds=avatarPickerIds;', context, { filename:ROSTER_PATH });
  const defaultIds = context.__avatarPickerIds(100);
  const legacySelectedIds = context.__avatarPickerIds(108);
  check('VM：编辑器默认不铺开旧免费头像，仍保留已装备旧 ID 与已售目录',
    defaultIds.includes(100) && defaultIds.includes(101) && defaultIds.includes(30) && !defaultIds.includes(108) && legacySelectedIds.includes(108),
    JSON.stringify({ defaultIds, legacySelectedIds }));
} catch (error){
  check('VM：编辑器头像策展路径可执行', false, error.stack || error.message);
}

const editorBody = sourceSlice(roster, /function\s+openProfileEditor\s*\(/, /function\s+renderLeaderboard\s*\(/);
check('Profile 编辑器消费策展目录，不再按 AVATAR_COUNT 全量铺开',
  /avatarPickerIds\(avatar\)\.forEach\(/.test(editorBody) &&
  !/for\s*\(\s*let\s+i\s*=\s*0\s*;\s*i\s*<\s*AVATAR_COUNT/.test(editorBody),
  compact(editorBody).slice(0, 220));
check('Profile 编辑器的锁定态只依赖免费目录/owned，不展示客户端价格',
  /avatarLocked\(i\)/.test(editorBody) &&
  !/avatarPrice\(i\)/.test(editorBody) &&
  !/meta\s*\.\s*price/.test(editorBody),
  '编辑器仍以本地 price 作为可见或锁定依据');

const avatarShopBlock = sourceSlice(shop, /if\s*\(tab\s*===\s*['"]avatars['"]\)\s*\{/, /\}\s*else\s*if\s*\(tab\s*===\s*['"]game_cosmetics['"]\)/);
check('商城 Avatar tab 消费同一策展目录',
  /curatedAvatarCatalogItems\(PLAYROOM_AVATARS\s*,\s*account\.avatar\)/.test(avatarShopBlock) &&
  /avatarItems\.forEach\(/.test(avatarShopBlock),
  compact(avatarShopBlock).slice(0, 260));
check('商城只将策展 ID 认定为默认免费，购买仍经既有请求路径',
  /isCuratedDefaultFreeAvatarId\(a\.id\)/.test(avatarShopBlock) &&
  /requestPurchase\(\s*['"]avatars['"]\s*,\s*a\.id\s*,\s*buy\s*\)/.test(avatarShopBlock),
  '缺少 curated free gate 或服务器购买请求');

class FakeImage {
  constructor(images){
    this.images = images;
    this.images.push(this);
    this.listeners = Object.create(null);
    this._src = '';
  }
  addEventListener(type, listener){
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }
  removeEventListener(type, listener){
    this.listeners[type] = (this.listeners[type] || []).filter(candidate => candidate !== listener);
  }
  set src(value){ this._src = String(value); }
  get src(){ return this._src; }
  emit(type){
    (this.listeners[type] || []).slice().forEach(listener => listener({ target:this }));
    const property = this['on' + type];
    if (typeof property === 'function') property({ target:this });
  }
}

function makeBackgroundRuntime(){
  const listeners = new Map();
  const imageInstances = [];
  const observers = [];
  const motionListeners = new Set();
  const motion = {
    matches:false,
    addEventListener(type, listener){ if (type === 'change') motionListeners.add(listener); },
    removeEventListener(type, listener){ if (type === 'change') motionListeners.delete(listener); },
    emit(matches){ this.matches = !!matches; motionListeners.forEach(listener => listener({ matches:this.matches })); },
  };
  const document = {
    hidden:false,
    addEventListener(type, listener){ listeners.set(type, listener); },
    removeEventListener(type, listener){ if (listeners.get(type) === listener) listeners.delete(type); },
    createElement(tag){ return String(tag).toLowerCase() === 'img' ? new FakeImage(imageInstances) : {}; },
  };
  class Observer {
    constructor(callback){ this.callback = callback; this.disconnected = false; observers.push(this); }
    observe(element){ this.element = element; }
    disconnect(){ this.disconnected = true; }
    emit(isIntersecting){ this.callback([{ target:this.element, isIntersecting:!!isIntersecting }]); }
  }
  const item = {
    id:21, animated:true, poster:'poster.webp', asset:'animated.webp', desktop:'desktop.webp',
    mobileCrop:'mobile.webp', miniCrop:'mini.webp', staticFallback:'static.webp',
    overlay:'rgba(0,0,0,.2)', textTone:'light',
  };
  const context = vm.createContext({
    PREMIUM_BACKGROUND_BY_ID:new Map([[21, item]]),
    document,
    Image:function(){ return new FakeImage(imageInstances); },
    IntersectionObserver:Observer,
    window:{ innerWidth:1024, matchMedia:() => motion },
    assetUrl:value => 'assets/' + value,
  });
  const snippet = sourceSlice(assets, /function\s+premiumBackgroundMeta\s*\(/, /function\s+backgroundPosterNode\s*\(/);
  vm.runInContext(snippet + '\nthis.__background={applyPremiumBackground,releasePremiumBackground,setPremiumBackgroundPlayback};', context, { filename:ASSETS_PATH });
  const classes = new Set();
  const element = {
    classList:{
      add(...names){ names.forEach(name => classes.add(String(name))); },
      remove(...names){ names.forEach(name => classes.delete(String(name))); },
      contains(name){ return classes.has(String(name)); },
    },
    dataset:{},
    style:{ backgroundImage:'', setProperty(name, value){ this[name] = value; } },
  };
  return { api:context.__background, document, element, classes, imageInstances, observers, listeners, motion, motionListeners };
}

try {
  const runtime = makeBackgroundRuntime();
  runtime.api.applyPremiumBackground(runtime.element, 21, 'profile', { autoplay:true });
  runtime.observers[0].emit(true);
  const initial = runtime.imageInstances.length === 1 &&
    runtime.element.dataset.animationActive === 'false' &&
    /poster\.webp/.test(runtime.element.style.backgroundImage);
  check('动态背景先预载真实 animated WebP，完成前保持 poster', initial,
    JSON.stringify({ images:runtime.imageInstances.length, data:runtime.element.dataset, image:runtime.element.style.backgroundImage }));

  const loader = runtime.imageInstances[0];
  if (loader) loader.emit('load');
  const activated = runtime.element.dataset.animationActive === 'true' && /animated\.webp/.test(runtime.element.style.backgroundImage);
  check('动态背景仅在 animated WebP 真实加载后进入播放态', activated,
    JSON.stringify({ data:runtime.element.dataset, image:runtime.element.style.backgroundImage }));

  runtime.document.hidden = true;
  const visibilityListener = runtime.listeners.get('visibilitychange');
  if (visibilityListener) visibilityListener();
  const hiddenPaused = runtime.element.dataset.animationActive === 'false' && /poster\.webp/.test(runtime.element.style.backgroundImage);
  runtime.document.hidden = false;
  if (visibilityListener) visibilityListener();
  runtime.observers[0].emit(false);
  const offscreenPaused = runtime.element.dataset.animationActive === 'false' && /poster\.webp/.test(runtime.element.style.backgroundImage);
  runtime.observers[0].emit(true);
  const resumed = runtime.element.dataset.animationActive === 'true' && /animated\.webp/.test(runtime.element.style.backgroundImage);
  check('页面隐藏、离屏与恢复均复用同一播放生命周期', hiddenPaused && offscreenPaused && resumed,
    JSON.stringify({ hiddenPaused, offscreenPaused, resumed, data:runtime.element.dataset }));

  runtime.motion.emit(true);
  const reducedPaused = runtime.element.dataset.animationActive === 'false' &&
    runtime.element.dataset.playbackDisabled === 'true' &&
    runtime.api.setPremiumBackgroundPlayback(runtime.element, true) === false;
  check('运行中切换 reduced-motion 会停止动画且拒绝重新播放', reducedPaused,
    JSON.stringify(runtime.element.dataset));

  runtime.api.releasePremiumBackground(runtime.element);
  check('背景释放清理 observer、visibility、motion listener 与播放句柄',
    runtime.observers.every(observer => observer.disconnected) &&
    runtime.listeners.size === 0 && runtime.motionListeners.size === 0 &&
    !runtime.element._premiumBackgroundPlayback,
    JSON.stringify({ observers:runtime.observers.length, listeners:runtime.listeners.size, motion:runtime.motionListeners.size }));
  check('背景释放会移除旧 text-tone class，避免同节点反复试穿时累积',
    !runtime.classes.has('premium-bg-light') && !runtime.element._premiumBackgroundToneClass,
    JSON.stringify([...runtime.classes]));
} catch (error){
  check('动态背景生命周期可在轻量 DOM seam 执行', false, error.stack || error.message);
}

try {
  const runtime = makeBackgroundRuntime();
  runtime.api.applyPremiumBackground(runtime.element, 21, 'profile', { autoplay:true });
  runtime.observers[0].emit(true);
  const loader = runtime.imageInstances[0];
  if (loader) loader.emit('error');
  check('animated WebP 失败回退 poster/static，且不伪称为播放中',
    runtime.element.dataset.animationActive === 'false' &&
    runtime.element.dataset.animationFailed === 'true' &&
    /poster\.webp/.test(runtime.element.style.backgroundImage) &&
    !/animated\.webp/.test(runtime.element.style.backgroundImage),
    JSON.stringify({ data:runtime.element.dataset, image:runtime.element.style.backgroundImage }));
  runtime.api.releasePremiumBackground(runtime.element);
} catch (error){
  check('动态背景失败回退可在轻量 DOM seam 执行', false, error.stack || error.message);
}

try {
  const runtime = makeBackgroundRuntime();
  runtime.api.applyPremiumBackground(runtime.element, 21, 'profile', { autoplay:true });
  runtime.observers[0].emit(true);
  const loader = runtime.imageInstances[0];
  runtime.api.releasePremiumBackground(runtime.element);
  if (loader) loader.emit('load');
  check('释放后的延迟资源事件不能复活动画',
    runtime.element.dataset.animationActive === 'false' &&
    /poster\.webp/.test(runtime.element.style.backgroundImage) &&
    !runtime.element._premiumBackgroundPlayback,
    JSON.stringify({ data:runtime.element.dataset, image:runtime.element.style.backgroundImage }));
} catch (error){
  check('释放后的延迟资源事件合同可执行', false, error.stack || error.message);
}

if (failures.length){
  console.error('AVATAR_CURATION_BACKGROUND_CONTRACT_FAILED: ' + failures.join('、'));
  process.exit(1);
}
console.log('AVATAR_CURATION_BACKGROUND_CONTRACT_ALL_PASS');
