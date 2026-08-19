'use strict';

/*
 * UI Identity Preview Contract v1
 *
 * This contract intentionally observes the public DOM/CSS/API seam used by
 * players: identity media, the shop preview and premium background playback.
 * It does not depend on implementation-private rendering details.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'public', 'index-template.html');
const ASSETS_PATH = path.join(ROOT, 'public', 'src', 'core', '06-assets.js');
const SHOP_PATH = path.join(ROOT, 'public', 'src', 'shop', '06-shop.js');
const ROSTER_PATH = path.join(ROOT, 'public', 'src', 'ui', '07-roster.js');
const LOCALE_DIR = path.join(ROOT, 'public', 'locales');

const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
const assets = fs.readFileSync(ASSETS_PATH, 'utf8');
const shop = fs.readFileSync(SHOP_PATH, 'utf8');
const roster = fs.readFileSync(ROSTER_PATH, 'utf8');
const locales = Object.fromEntries(['zh-CN', 'en-US', 'uk-UA'].map(lang => [
  lang,
  JSON.parse(fs.readFileSync(path.join(LOCALE_DIR, lang + '.json'), 'utf8')),
]));

const failures = [];
function check(name, condition, detail){
  console.log((condition ? 'PASS' : 'FAIL') + '  ' + name + (condition || !detail ? '' : ' :: ' + detail));
  if (!condition) failures.push(name);
}

function compact(value){
  return String(value).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ').trim();
}

function extractBalancedBlock(source, headerPattern){
  const match = headerPattern.exec(source);
  if (!match) return '';
  const open = source.indexOf('{', match.index);
  if (open < 0) return '';
  let depth = 0;
  for (let index = open; index < source.length; index++){
    if (source[index] === '{') depth++;
    else if (source[index] === '}'){
      depth--;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

function extractFrom(source, startPattern, endPattern){
  const start = startPattern.exec(source);
  if (!start) return '';
  const end = endPattern.exec(source.slice(start.index + start[0].length));
  return end ? source.slice(start.index, start.index + start[0].length + end.index) : source.slice(start.index);
}

function placeholderSignature(value){
  return (String(value).match(/%[sd]/g) || []).join('|');
}

/* Avatar v2 image and Canvas must occupy the same visible circular identity seam. */
const avatarMediaRule = extractBalancedBlock(
  template,
  /\.avatar-stage\s*>\s*canvas\s*,\s*\.avatar-stage\s*>\s*\.avatar-art-v2\s*,\s*\.mini-avatar-stage\s*>\s*canvas\s*,\s*\.mini-avatar-stage\s*>\s*\.avatar-art-v2\s*\{/i,
);
const compactMediaRule = compact(avatarMediaRule);
check('Avatar v2 图片与 Canvas 共享直接子节点圆形媒体合同',
  avatarMediaRule.length > 0 &&
  /border-radius\s*:\s*50%/.test(compactMediaRule) &&
  /object-fit\s*:\s*cover/.test(compactMediaRule) &&
  /object-position\s*:\s*center/.test(compactMediaRule) &&
  /z-index\s*:\s*2/.test(compactMediaRule),
  compactMediaRule);

const frameRule = extractBalancedBlock(template, /\.avatar-stage\s+\.frame-ring\s*,\s*\.mini-avatar-stage\s+\.frame-ring\s*\{/i);
check('头像框位于 Canvas 与 Avatar v2 媒体前方且不改变媒体几何',
  /z-index\s*:\s*3/.test(compact(frameRule)) && /pointer-events\s*:\s*none/.test(compact(frameRule)),
  compact(frameRule));

const effectOneTwo = template.match(/\.avatar-stage\.effect-1\s+:is\(canvas,\s*\.avatar-art-v2\)[\s\S]*?\.avatar-stage\.effect-2\s+:is\(canvas,\s*\.avatar-art-v2\)/i);
check('Canvas 与 Avatar v2 都能继承呼吸和闪耀特效', !!effectOneTwo, effectOneTwo ? '' : '缺少共享媒体选择器');

const effectFourStage = extractBalancedBlock(template, /\.avatar-stage\.effect-4(?:\s*,\s*\.mini-avatar-stage\.effect-4)?\s*\{/i);
const effectFourMedia = extractBalancedBlock(template, /\.avatar-stage\.effect-4\s+>\s*:is\(canvas,\s*\.avatar-art-v2\)\s*\{/i);
const effectFourDecoration = extractBalancedBlock(template, /\.avatar-stage\.effect-4::after(?:\s*,\s*\.mini-avatar-stage\.effect-4::after)?\s*\{/i);
check('effect-4 不旋转头像容器或头像本体',
  !/animation\s*:/.test(compact(effectFourStage)) &&
  !/animation\s*:/.test(compact(effectFourMedia)),
  compact(effectFourStage) + ' | ' + compact(effectFourMedia));
check('effect-4 只让独立装饰环旋转',
  /content\s*:/.test(compact(effectFourDecoration)) && /animation\s*:\s*fxSpin/.test(compact(effectFourDecoration)),
  compact(effectFourDecoration));

/* Premium background API: shop can explicitly play/pause and release resources. */
check('premium background 提供本地显式播放/暂停 API',
  /function\s+setPremiumBackgroundPlayback\s*\(\s*element\s*,\s*shouldPlay\s*\)/.test(assets),
  '缺少 setPremiumBackgroundPlayback(element, shouldPlay)');
check('applyPremiumBackground 接受可选播放配置且 cleanup 清除播放句柄',
  /function\s+applyPremiumBackground\s*\(\s*element\s*,\s*id\s*,\s*context\s*,\s*options\s*\)/.test(assets) &&
  /delete\s+element\._premiumBackgroundPlayback/.test(assets),
  '缺少 options 或 cleanup delete');
check('背景 animated 失败会清除 asset-ready 并显示 poster/static fallback',
  /wrap\.classList\.remove\(\s*['"]asset-ready['"]\s*\)/.test(assets) &&
  /wrap\.classList\.add\(\s*['"]asset-failed['"]\s*\)/.test(assets) &&
  /setSource\(posterPath\)/.test(assets) &&
  /staticFallbackPath/.test(assets),
  '失败路径没有恢复可见 fallback');
check('背景播放状态提供订阅并在同步时通知消费者',
  /const playbackListeners = new Set\(\)/.test(assets) &&
  /subscribe\(listener\)/.test(assets) &&
  /onPlaybackStateChange/.test(assets) &&
  /playbackHandle && typeof playbackHandle\.subscribe/.test(shop),
  '缺少 observer/visibility 到 Shop 的状态 seam');

function playbackRuntime(reducedMotion){
  const snippet = extractFrom(
    assets,
    /function\s+premiumBackgroundMeta\s*\(/,
    /function\s+backgroundPosterNode\s*\(/,
  );
  const listeners = new Map();
  const observerInstances = [];
  const document = {
    hidden: false,
    addEventListener(type, listener){ listeners.set(type, listener); },
    removeEventListener(type, listener){ if (listeners.get(type) === listener) listeners.delete(type); },
  };
  class Observer {
    constructor(callback){ this.callback = callback; this.disconnected = false; observerInstances.push(this); }
    observe(){ this.callback([{ isIntersecting:true }]); }
    disconnect(){ this.disconnected = true; }
  }
  const item = {
    id: 21,
    animated: true,
    poster: 'poster.webp',
    asset: 'animated.webp',
    desktop: 'desktop.webp',
    mobileCrop: 'mobile.webp',
    miniCrop: 'mini.webp',
    staticFallback: 'desktop.webp',
    overlay: 'rgba(0,0,0,.2)',
    textTone: 'light',
  };
  const context = vm.createContext({
    PREMIUM_BACKGROUND_BY_ID: new Map([[21, item]]),
    document,
    IntersectionObserver: Observer,
    window: { innerWidth:1024, matchMedia:() => ({ matches:!!reducedMotion }) },
    assetUrl: value => 'assets/' + value,
  });
  vm.runInContext(snippet + '\nthis.__api={applyPremiumBackground,releasePremiumBackground,setPremiumBackgroundPlayback};', context, { filename:ASSETS_PATH });
  const element = {
    classList: { add(){} },
    dataset: {},
    style: { backgroundImage:'', setProperty(name, value){ this[name] = value; } },
  };
  return { context, element, document, listeners, observerInstances };
}

try {
  const runtime = playbackRuntime();
  const api = runtime.context.__api;
  check('背景播放 API 可在轻量 DOM seam 执行', !!api && typeof api.applyPremiumBackground === 'function' && typeof api.setPremiumBackgroundPlayback === 'function');
  if (api && typeof api.setPremiumBackgroundPlayback === 'function'){
    const changes = [];
    const applied = api.applyPremiumBackground(runtime.element, 21, 'shop-preview', { autoplay:false, onPlaybackStateChange:state => changes.push(state) });
    const startsPaused = applied && runtime.element.dataset.animationActive === 'false' && /poster\.webp/.test(runtime.element.style.backgroundImage);
    const started = api.setPremiumBackgroundPlayback(runtime.element, true) === true && runtime.element.dataset.animationActive === 'true' && /animated\.webp/.test(runtime.element.style.backgroundImage) && /poster\.webp/.test(runtime.element.style.backgroundImage);
    const paused = api.setPremiumBackgroundPlayback(runtime.element, false) === true && runtime.element.dataset.animationActive === 'false' && /poster\.webp/.test(runtime.element.style.backgroundImage);
    check('商城背景可由用户显式播放和暂停', startsPaused && started && paused, JSON.stringify(runtime.element.dataset));
    check('背景播放状态回调覆盖初始/播放/暂停状态', changes.length >= 3 && changes.some(state => state.active === true) && changes[changes.length - 1].active === false, JSON.stringify(changes));
    api.releasePremiumBackground(runtime.element);
    check('背景预览释放 observer、visibility listener 与播放句柄',
      runtime.observerInstances.every(observer => observer.disconnected) &&
      runtime.listeners.size === 0 &&
      !runtime.element._premiumBackgroundPlayback &&
      /poster\.webp/.test(runtime.element.style.backgroundImage),
      JSON.stringify({ listeners:runtime.listeners.size, observers:runtime.observerInstances.length, data:runtime.element.dataset }));
  }
} catch (error){
  check('背景播放 API 可执行', false, error.stack || error.message);
}

try {
  const reduced = playbackRuntime(true);
  const api = reduced.context.__api;
  api.applyPremiumBackground(reduced.element, 21, 'shop-preview', { autoplay:true });
  check('reduced-motion 强制使用静态 poster 并拒绝播放请求',
    reduced.element.dataset.animationActive === 'false' &&
    reduced.element.dataset.playbackDisabled === 'true' &&
    api.setPremiumBackgroundPlayback(reduced.element, true) === false &&
    /poster\.webp/.test(reduced.element.style.backgroundImage),
    JSON.stringify(reduced.element.dataset));
  api.releasePremiumBackground(reduced.element);
} catch (error){
  check('reduced-motion 背景降级可执行', false, error.stack || error.message);
}

/* Shop uses the same identity composition, and cards remain keyboard-accessible. */
const openShopBody = extractBalancedBlock(shop, /function\s+openShop\s*\(\s*\)\s*\{/);
check('商城预览以真实身份组合渲染背景、头像、框、昵称效果与遮罩',
  /function\s+renderIdentityPreview\s*\(/.test(openShopBody) &&
  /applyPremiumBackground\(\s*hero\s*,\s*backgroundId\s*,\s*['"]shop-preview['"]\s*,\s*\{\s*autoplay\s*:\s*false\s*\}\s*\)/.test(openShopBody) &&
  /avatar-stage/.test(openShopBody) && /frame-ring/.test(openShopBody) && /nameFxNode/.test(openShopBody) && /profile-identity-scrim/.test(openShopBody),
  '缺少真实身份组合或显式 shop-preview 背景');
check('商城背景预览提供可触屏/键盘操作的播放暂停按钮',
  /shop-preview-playback/.test(openShopBody) && /setPremiumBackgroundPlayback/.test(openShopBody) && /disabled\s*=\s*reduced/.test(openShopBody),
  '缺少播放暂停控件或 reduced-motion 禁用');
check('商品卡具有当前语言 aria-label/aria-current 与 Enter/Space 预览选择',
  /setAttribute\(\s*['"]role['"]\s*,\s*['"]group['"]\s*\)/.test(openShopBody) &&
  /setAttribute\(\s*['"]aria-label['"]\s*,\s*t\(\s*['"]shop_preview_item_aria['"]/.test(openShopBody) &&
  /setAttribute\(\s*['"]aria-current['"]/.test(openShopBody) &&
  /event\.target\s*!==\s*node/.test(openShopBody) &&
  /event\.key\s*===\s*['"]Enter['"]/.test(openShopBody) &&
  /event\.key\s*===\s*['"] ['"]/.test(openShopBody),
  '缺少卡片语义或键盘保护');
check('个人编辑器背景选择使用可聚焦 radio 按钮并同步选中状态',
  /bgGrid\.setAttribute\(\s*['"]role['"]\s*,\s*['"]radiogroup['"]\s*\)/.test(roster) &&
  /const sw\s*=\s*el\(\s*['"]button['"]\s*,\s*['"]bg-swatch/.test(roster) &&
  /sw\.setAttribute\(\s*['"]role['"]\s*,\s*['"]radio['"]\s*\)/.test(roster) &&
  /aria-checked/.test(roster) && /shopItemName\(\s*['"]backgrounds['"]/.test(roster),
  '背景色板仍为鼠标专用 div 或没有 radio 状态');
check('排行榜公开 Profile 入口使用独立 44px 键盘按钮且列表行不伪装为鼠标按钮',
  /const av\s*=\s*el\(\s*['"]button['"]\s*,\s*['"]game-stage-avatar-button lb-av['"]\s*\)/.test(roster) &&
  /av\.setAttribute\(\s*['"]aria-label['"]/.test(roster) &&
  !/row\.style\.cursor\s*=\s*['"]pointer['"]/.test(roster.slice(roster.indexOf('function renderLeaderboard'),roster.indexOf('function xpRequiredForNextLevel'))),
  '排行榜仍依赖不可聚焦的 div/span 点击');
check('切换候选与关闭商城释放旧背景预览资源',
  /releasePremiumBackground\(\s*previewBackground\s*\)/.test(openShopBody) &&
  /releasePremiumBackground\(\s*previewBackground\s*\)/.test(openShopBody.slice(openShopBody.indexOf('function releaseShopResources'))),
  '缺少切换或关闭 cleanup');

class PreviewNode {
  constructor(tag, className){
    this.tagName = String(tag || 'div').toUpperCase();
    this.className = className || '';
    this.children = [];
    this.parentNode = null;
    this.listeners = Object.create(null);
    this.attributes = Object.create(null);
    this.dataset = {};
    this.style = {};
    this.isConnected = false;
    this.disabled = false;
    this.classList = {
      add: (...names) => names.forEach(name => {
        if (!this.className.split(/\s+/).includes(name)) this.className = (this.className + ' ' + name).trim();
      }),
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        const next = force == null ? !names.has(name) : !!force;
        if (next) names.add(name); else names.delete(name);
        this.className = Array.from(names).join(' ');
        return next;
      },
      remove: (...names) => {
        const removeSet = new Set(names);
        this.className = this.className.split(/\s+/).filter(name => name && !removeSet.has(name)).join(' ');
      },
    };
  }
  appendChild(child){
    child.parentNode = this;
    child.setConnected(this.isConnected);
    this.children.push(child);
    return child;
  }
  setConnected(connected){
    this.isConnected = connected;
    this.children.forEach(child => child.setConnected(connected));
  }
  addEventListener(type, listener){
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }
  dispatch(type, event){
    const payload = event || { target:this };
    if (!payload.target) payload.target = this;
    (this.listeners[type] || []).forEach(listener => listener(payload));
  }
  setAttribute(name, value){ this.attributes[name] = String(value); }
  getAttribute(name){ return this.attributes[name]; }
  closest(selector){ return selector === 'button' && this.tagName === 'BUTTON' ? this : null; }
  querySelectorAll(selector){
    const target = selector.replace(/^\./, '');
    const found = [];
    const visit = node => {
      node.children.forEach(child => {
        if (child.className.split(/\s+/).includes(target)) found.push(child);
        visit(child);
      });
    };
    visit(this);
    return found;
  }
  findByClass(name){
    if (this.className.split(/\s+/).includes(name)) return this;
    for (const child of this.children){
      const found = child.findByClass(name);
      if (found) return found;
    }
    return null;
  }
  remove(){
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null;
    this.setConnected(false);
  }
  set innerHTML(value){ if (!value) this.children = []; }
  get innerHTML(){ return ''; }
}

/* Poster media regression: poster success -> animated failure -> poster/static fallback. */
try {
  class PosterImage extends PreviewNode {
    constructor(){
      super('img');
      this._src = '';
    }
    set src(value){ this._src = String(value); this.attributes.src = this._src; }
    get src(){ return this._src; }
  }
  const document = { createElement(tag){ return String(tag).toLowerCase() === 'img' ? new PosterImage() : new PreviewNode(tag); } };
  const item = { animated:true, poster:'poster.webp', asset:'animated.webp', staticFallback:'static.webp', desktop:'desktop.webp' };
  const context = vm.createContext({
    document,
    window:{ innerWidth:1024, matchMedia:() => ({ matches:false }) },
    assetUrl:value => 'assets/' + value,
    prefersReducedMotion:() => false,
    el:(tag, cls, text) => { const node = new PreviewNode(tag, cls); node.textContent = text || ''; return node; },
  });
  const snippet = extractFrom(assets, /function\s+backgroundPosterNode\s*\(/, /function\s+gameCoverNode\s*\(/);
  vm.runInContext(snippet + '\nthis.__poster = backgroundPosterNode;', context, { filename:ASSETS_PATH });
  const wrap = context.__poster(item, { hoverPreview:true });
  const image = wrap.children[0];
  const fire = type => image.dispatch(type, { target:image });
  fire('load');
  const posterReady = wrap.className.includes('asset-ready') && !wrap.className.includes('asset-failed');
  wrap.dispatch('mouseenter', { target:wrap });
  const animatedRequested = image.src === 'assets/animated.webp';
  fire('error');
  const animatedFallbackRequested = image.src === 'assets/poster.webp' && !wrap.className.includes('asset-failed');
  fire('load');
  image.src = 'assets/poster.webp';
  fire('error');
  const staticFallbackRequested = image.src === 'assets/static.webp' && !wrap.className.includes('asset-failed');
  fire('load');
  check('VM：动态背景加载失败回到 poster，并在 poster 失败时继续回到 static fallback',
    posterReady && animatedRequested && animatedFallbackRequested && staticFallbackRequested && wrap.className.includes('asset-ready'),
    JSON.stringify({ src:image.src, className:wrap.className }));
} catch (error){
  check('VM：动态背景 poster/static fallback 回退可执行', false, error.stack || error.message);
}

try {
  const body = new PreviewNode('body');
  body.setConnected(true);
  let cleaned = 0;
  const catalog = {
    avatars:[],
    frames:[{ id:1, cls:'frame-1' }],
    effects:[{ id:4, cls:'effect-4' }],
    backgrounds:[],
    game_cosmetics:[],
  };
  const context = vm.createContext({
    SHOP:catalog,
    PLAYROOM_AVATARS:[{ id:30, free:true, theme:'pixel' }],
    AVATAR_CATEGORIES:[],
    CURRENCY:'$',
    GAMES:{},
    account:{ name:'Preview', avatar:30, frame:1, effect:4, background:21, owned:{ avatars:[] } },
    online:{ connected:true, send(){} },
    document:{ body },
    el:(tag, cls, text) => { const node = new PreviewNode(tag, cls); node.textContent = text || ''; return node; },
    currencyAmountText:value => String(value) + ' G Coins',
    currencyAmountNode:(value,options) => { const node=new PreviewNode('span','currency-amount'); node.textContent=options&&options.formattedText?String(options.formattedText):String(value); return node; },
    t:(key, ...args) => key + (args.length ? ':' + args.join('|') : ''),
    shopItemName:(category, item) => category + '-' + item.id,
    ownItem:() => false,
    acquireModalScrollLock(){}, releaseModalScrollLock(){}, openAuthModal(){},
    avatarCanvas:() => new PreviewNode('img','avatar-art-v2'),
    nameFxNode:() => new PreviewNode('span','name-fx-0'),
    premiumBackgroundMeta:id => Number(id) === 21 ? { id:21, animated:true } : null,
    applyPremiumBackground:(node, id, contextName, options) => {
      node.dataset.animationActive = options && options.autoplay ? 'true' : 'false';
      node.dataset.backgroundId = String(id);
      node.dataset.context = contextName;
      return true;
    },
    setPremiumBackgroundPlayback:(node, shouldPlay) => { node.dataset.animationActive = shouldPlay ? 'true' : 'false'; return true; },
    releasePremiumBackground:() => { cleaned++; },
    prefersReducedMotion:() => false,
    saveAccount(){}, syncProfiles(){}, renderMe(){}, toast(){}, setTimeout(){}, crypto:undefined,
  });
  vm.runInContext(shop + '\nthis.__openShop = openShop;', context, { filename:SHOP_PATH });
  context.__openShop();
  const card = body.findByClass('shop-item');
  const preview = body.findByClass('shop-identity-preview');
  const playback = body.findByClass('shop-preview-playback-toggle');
  check('VM：商城初始预览组合真实 Avatar v2、Frame、Effect、背景与昵称遮罩',
    !!preview && !!preview.findByClass('avatar-art-v2') && !!preview.findByClass('frame-ring') &&
    !!preview.findByClass('effect-4') && preview.dataset.context === 'shop-preview' &&
    !!preview.findByClass('profile-identity-scrim'));
  let prevented = false;
  if (card) card.dispatch('keydown',{ target:card, key:' ', preventDefault(){ prevented = true; } });
  check('VM：商品卡空格键选择预览且维护 aria-current',
    !!card && prevented && card.getAttribute('role') === 'group' && card.getAttribute('aria-current') === 'true');
  const activePlayback = body.findByClass('shop-preview-playback-toggle');
  if (activePlayback) activePlayback.dispatch('click');
  const activePreview = body.findByClass('shop-identity-preview');
  check('VM：播放按钮切换当前预览的本地动画状态',
    !!activePlayback && activePreview && activePreview.dataset.animationActive === 'true' && activePlayback.getAttribute('aria-pressed') === 'true');
  const close = body.findByClass('shop-close');
  if (close) close.dispatch('click');
  check('VM：关闭商城会释放全部已创建的背景预览', cleaned >= 2 && body.children.length === 0, String(cleaned));
} catch (error){
  check('VM：商城身份组合预览可执行', false, error.stack || error.message);
}

const requiredKeys = [
  'shop_preview_play',
  'shop_preview_pause',
  'shop_preview_motion_reduced',
  'shop_preview_playback_status',
  'shop_preview_item_aria',
];
for (const key of requiredKeys){
  const values = Object.values(locales).map(locale => locale[key]);
  check('三语存在身份预览文案 ' + key,
    values.every(value => typeof value === 'string' && value.trim()),
    JSON.stringify(values));
  check('三语身份预览文案占位符一致 ' + key,
    new Set(values.map(placeholderSignature)).size === 1,
    JSON.stringify(values.map(placeholderSignature)));
}

const playbackButtonRule = extractBalancedBlock(template, /\.shop-preview-playback\s+\.btn\s*\{/i);
check('商城播放控制满足 44px 触控合同',
  /min-height\s*:\s*44px/.test(compact(playbackButtonRule)) && /min-width\s*:\s*44px/.test(compact(playbackButtonRule)),
  compact(playbackButtonRule));

if (failures.length){
  console.error('UI_IDENTITY_PREVIEW_CONTRACT_FAILED: ' + failures.join('、'));
  process.exit(1);
}
console.log('UI_IDENTITY_PREVIEW_CONTRACT_ALL_PASS');
