/* ================= 美术资源运行时（P0） ================= */
const ASSET_ROOT = 'assets/';
const CURRENCY = '💵';
const ASSET_CATALOG = Object.freeze({
  brandMark: 'brand/ghost-game-mark.svg',
  brandWordmark: 'brand/ghost-game-wordmark.svg',
  currencyCash: 'ui/currency_cash.svg',
  manifest: 'manifests/asset_manifest.json',
  backgroundCatalog: 'backgrounds/v1/background_catalog_v1.json',
});
const PREMIUM_BACKGROUNDS = Object.freeze([
  {id:20,name:'像素夜城',theme:'pixel',collectionId:'pixel_origins',tier:'premium-static',price:24,animated:false,poster:'backgrounds/v1/pixel/pixel_poster.webp',asset:'backgrounds/v1/pixel/pixel_desktop.webp',desktop:'backgrounds/v1/pixel/pixel_desktop.webp',mobileCrop:'backgrounds/v1/pixel/pixel_mobile.webp',miniCrop:'backgrounds/v1/pixel/pixel_mini.webp',staticFallback:'backgrounds/v1/pixel/pixel_desktop.webp',overlay:'rgba(5,13,34,.42)',textTone:'light'},
  {id:21,name:'像素星火·动态',theme:'pixel',collectionId:'pixel_origins',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/v1/pixel/pixel_poster.webp',asset:'backgrounds/v1/pixel/pixel_animated.webp',desktop:'backgrounds/v1/pixel/pixel_desktop.webp',mobileCrop:'backgrounds/v1/pixel/pixel_mobile.webp',miniCrop:'backgrounds/v1/pixel/pixel_mini.webp',staticFallback:'backgrounds/v1/pixel/pixel_desktop.webp',overlay:'rgba(5,13,34,.42)',textTone:'light'},
  {id:22,name:'晴空回廊',theme:'anime',collectionId:'anime_origins',tier:'premium-static',price:24,animated:false,poster:'backgrounds/v1/anime/anime_poster.webp',asset:'backgrounds/v1/anime/anime_desktop.webp',desktop:'backgrounds/v1/anime/anime_desktop.webp',mobileCrop:'backgrounds/v1/anime/anime_mobile.webp',miniCrop:'backgrounds/v1/anime/anime_mini.webp',staticFallback:'backgrounds/v1/anime/anime_desktop.webp',overlay:'rgba(17,34,92,.30)',textTone:'light'},
  {id:23,name:'云海微光·动态',theme:'anime',collectionId:'anime_origins',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/v1/anime/anime_poster.webp',asset:'backgrounds/v1/anime/anime_animated.webp',desktop:'backgrounds/v1/anime/anime_desktop.webp',mobileCrop:'backgrounds/v1/anime/anime_mobile.webp',miniCrop:'backgrounds/v1/anime/anime_mini.webp',staticFallback:'backgrounds/v1/anime/anime_desktop.webp',overlay:'rgba(17,34,92,.30)',textTone:'light'},
  {id:24,name:'月海群峰',theme:'landscape',collectionId:'landscape_origins',tier:'premium-static',price:24,animated:false,poster:'backgrounds/v1/landscape/landscape_poster.webp',asset:'backgrounds/v1/landscape/landscape_desktop.webp',desktop:'backgrounds/v1/landscape/landscape_desktop.webp',mobileCrop:'backgrounds/v1/landscape/landscape_mobile.webp',miniCrop:'backgrounds/v1/landscape/landscape_mini.webp',staticFallback:'backgrounds/v1/landscape/landscape_desktop.webp',overlay:'rgba(3,22,43,.38)',textTone:'light'},
  {id:25,name:'潮汐月影·动态',theme:'landscape',collectionId:'landscape_origins',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/v1/landscape/landscape_poster.webp',asset:'backgrounds/v1/landscape/landscape_animated.webp',desktop:'backgrounds/v1/landscape/landscape_desktop.webp',mobileCrop:'backgrounds/v1/landscape/landscape_mobile.webp',miniCrop:'backgrounds/v1/landscape/landscape_mini.webp',staticFallback:'backgrounds/v1/landscape/landscape_desktop.webp',overlay:'rgba(3,22,43,.38)',textTone:'light'},
  {id:26,name:'月下伙伴',theme:'animal',collectionId:'animal_origins',tier:'premium-static',price:24,animated:false,poster:'backgrounds/v1/animal/animal_poster.webp',asset:'backgrounds/v1/animal/animal_desktop.webp',desktop:'backgrounds/v1/animal/animal_desktop.webp',mobileCrop:'backgrounds/v1/animal/animal_mobile.webp',miniCrop:'backgrounds/v1/animal/animal_mini.webp',staticFallback:'backgrounds/v1/animal/animal_desktop.webp',overlay:'rgba(8,25,44,.40)',textTone:'light'},
  {id:27,name:'灯火呼吸·动态',theme:'animal',collectionId:'animal_origins',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/v1/animal/animal_poster.webp',asset:'backgrounds/v1/animal/animal_animated.webp',desktop:'backgrounds/v1/animal/animal_desktop.webp',mobileCrop:'backgrounds/v1/animal/animal_mobile.webp',miniCrop:'backgrounds/v1/animal/animal_mini.webp',staticFallback:'backgrounds/v1/animal/animal_desktop.webp',overlay:'rgba(8,25,44,.40)',textTone:'light'},
  {id:28,name:'霓虹穹庭',theme:'neon',collectionId:'neon_origins',tier:'premium-static',price:24,animated:false,poster:'backgrounds/v1/neon/neon_poster.webp',asset:'backgrounds/v1/neon/neon_desktop.webp',desktop:'backgrounds/v1/neon/neon_desktop.webp',mobileCrop:'backgrounds/v1/neon/neon_mobile.webp',miniCrop:'backgrounds/v1/neon/neon_mini.webp',staticFallback:'backgrounds/v1/neon/neon_desktop.webp',overlay:'rgba(4,5,25,.34)',textTone:'light'},
  {id:29,name:'光轨脉冲·动态',theme:'neon',collectionId:'neon_origins',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/v1/neon/neon_poster.webp',asset:'backgrounds/v1/neon/neon_animated.webp',desktop:'backgrounds/v1/neon/neon_desktop.webp',mobileCrop:'backgrounds/v1/neon/neon_mobile.webp',miniCrop:'backgrounds/v1/neon/neon_mini.webp',staticFallback:'backgrounds/v1/neon/neon_desktop.webp',overlay:'rgba(4,5,25,.34)',textTone:'light'},
  {id:30,name:'轨道船坞',theme:'technology',collectionId:'technology_origins',tier:'premium-static',price:24,animated:false,poster:'backgrounds/v1/technology/technology_poster.webp',asset:'backgrounds/v1/technology/technology_desktop.webp',desktop:'backgrounds/v1/technology/technology_desktop.webp',mobileCrop:'backgrounds/v1/technology/technology_mobile.webp',miniCrop:'backgrounds/v1/technology/technology_mini.webp',staticFallback:'backgrounds/v1/technology/technology_desktop.webp',overlay:'rgba(2,13,27,.36)',textTone:'light'},
  {id:31,name:'深空巡航·动态',theme:'technology',collectionId:'technology_origins',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/v1/technology/technology_poster.webp',asset:'backgrounds/v1/technology/technology_animated.webp',desktop:'backgrounds/v1/technology/technology_desktop.webp',mobileCrop:'backgrounds/v1/technology/technology_mobile.webp',miniCrop:'backgrounds/v1/technology/technology_mini.webp',staticFallback:'backgrounds/v1/technology/technology_desktop.webp',overlay:'rgba(2,13,27,.36)',textTone:'light'},
].map(Object.freeze));
const PREMIUM_BACKGROUND_BY_ID = new Map(PREMIUM_BACKGROUNDS.map(item => [item.id, item]));
const UI_ICON_NAMES = new Set(['settings','user','users','store','gamepad-2','plus','lock','unlock','eye','eye-off','play','search','chevron-right','chevron-down','ellipsis','flag','shield','shield-alert','user-plus','user-minus','bot','moon','sun','zap','door-open','refresh-cw','book-open','square','arrow-left','trophy','log-out','more-horizontal']);
const GAME_ART = Object.freeze({
  gomoku: Object.freeze({
    flag: 'mg_art_gomoku_v1',
    cover: 'ui/game_covers/game_gomoku.webp',
    coverSmall: 'ui/game_covers/game_gomoku_320.webp',
    board: 'board/gomoku/mg_board_gomoku_surface_v01.webp',
  }),
  ludo: Object.freeze({
    flag: 'mg_art_ludo_cover_v1',
    cover: 'ui/game_covers/game_ludo.webp',
    coverSmall: 'ui/game_covers/game_ludo_320.webp',
  }),
  monopoly: Object.freeze({
    flag: 'mg_art_monopoly_cover_v1',
    cover: 'ui/game_covers/game_monopoly.webp',
    coverSmall: 'ui/game_covers/game_monopoly_320.webp',
  }),
  tank: Object.freeze({
    flag: 'mg_art_tank_cover_v1',
    cover: 'ui/game_covers/game_tank.webp',
    coverSmall: 'ui/game_covers/game_tank_320.webp',
  }),
  tetris: Object.freeze({
    flag: 'mg_art_tetris_v1',
    cover: 'ui/game_covers/game_tetris.webp',
    coverSmall: 'ui/game_covers/game_tetris_320.webp',
    board: 'board/tetris/mg_board_tetris_well_v01.webp',
  }),
  xiangqi: Object.freeze({
    flag: 'mg_art_xiangqi_cover_v1',
    cover: 'ui/game_covers/game_xiangqi.webp',
    coverSmall: 'ui/game_covers/game_xiangqi_320.webp',
  }),
});

function assetUrl(key){
  const path = ASSET_CATALOG[key] || key || '';
  return ASSET_ROOT + String(path).replace(/^\/+/, '');
}

function icon(name, size, label){
  const safeName = UI_ICON_NAMES.has(name) ? name : 'square';
  const px = Number(size) > 0 ? Number(size) : 18;
  const wrap = el('span', 'ui-icon');
  wrap.style.width = px + 'px';
  wrap.style.height = px + 'px';
  if (label){ wrap.setAttribute('role','img'); wrap.setAttribute('aria-label',label); }
  else wrap.setAttribute('aria-hidden','true');
  const img = document.createElement('img');
  img.src = assetUrl('icons/ui/' + safeName + '.svg');
  img.alt = '';
  img.width = px;
  img.height = px;
  img.addEventListener('error', () => { img.style.display='none'; wrap.classList.add('asset-failed'); });
  wrap.appendChild(img);
  return wrap;
}

function setButtonIcon(button, name, label, options){
  if (!button) return;
  const opts = options || {};
  button.innerHTML = '';
  button.appendChild(icon(name, opts.size || 18));
  if (label) button.appendChild(el('span','ui-icon-label',label));
  if (opts.ariaLabel) button.setAttribute('aria-label',opts.ariaLabel);
  if (opts.title) button.title = opts.title;
}

function initStaticPlatformIcons(){
  setButtonIcon($('btn-settings-page'),'settings','',{ariaLabel:t('settings'),title:t('settings')});
  const root = document.documentElement;
  const theme = root && typeof root.getAttribute === 'function' ? (root.getAttribute('data-theme') || 'light') : 'light';
  setButtonIcon($('btn-theme'),theme==='light'?'moon':'sun','',{ariaLabel:t('theme'),title:t('theme'),size:19});
  setButtonIcon($('btn-hero-quick'),'play',t('home_enter_games'));
  setButtonIcon($('btn-quick-join'),'zap',t('quick_join'));
  setButtonIcon($('btn-create-room'),'plus',t('create_room'));
  setButtonIcon($('btn-browse-rooms'),'search',t('browse_rooms'));
  setButtonIcon($('btn-join-code'),'door-open',t('join_room'));
  setButtonIcon($('btn-back'),'arrow-left',t('back'));
  setButtonIcon($('btn-end-game'),'square',t('end_game'));
  setButtonIcon($('btn-rules'),'book-open',t('rules'));
  setButtonIcon($('btn-restart'),'refresh-cw',t('restart'));
  const onlineMode=typeof document.querySelector==='function'?document.querySelector('[data-mode="online"]'):null;
  const aiMode=typeof document.querySelector==='function'?document.querySelector('[data-mode="ai"]'):null;
  setButtonIcon(onlineMode,'users',t('mode_online'));
  setButtonIcon(aiMode,'bot',t('mode_ai'));
}

function gameArtEnabled(id){
  const art = GAME_ART[id];
  if (!art) return false;
  try { return localStorage.getItem(art.flag) !== '0'; }
  catch (error) { return true; }
}

function gameArtUrl(id, role){
  const art = GAME_ART[id];
  return art && art[role] ? assetUrl(art[role]) : '';
}

function setAssetCssUrl(element, property, url){
  const value = 'url("' + url + '")';
  if (element.style && typeof element.style.setProperty === 'function') element.style.setProperty(property, value);
  else if (element.style) element.style[property] = value;
}

function premiumBackgroundMeta(id){
  return PREMIUM_BACKGROUND_BY_ID.get(Number(id)) || null;
}

function prefersReducedMotion(){
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function premiumStaticAsset(item, context){
  if (context === 'mini') return item.miniCrop;
  if (typeof window !== 'undefined' && Number(window.innerWidth || 0) <= 600) return item.mobileCrop;
  return item.desktop || item.staticFallback;
}

function setPremiumBackgroundImage(element, item, path){
  element.style.backgroundImage = 'linear-gradient(' + item.overlay + ',' + item.overlay + '),url("' + assetUrl(path) + '")';
}

function releasePremiumBackground(element){
  if (!element || typeof element._premiumBackgroundCleanup !== 'function') return;
  element._premiumBackgroundCleanup();
  element._premiumBackgroundCleanup = null;
}

function applyPremiumBackground(element, id, context){
  releasePremiumBackground(element);
  const item = premiumBackgroundMeta(id);
  if (!item) return false;
  const useContext = context || 'profile';
  const fallback = premiumStaticAsset(item, useContext);
  element.classList.add('premium-background', 'premium-bg-' + item.textTone);
  element.dataset.backgroundId = String(item.id);
  element.dataset.backgroundAnimated = item.animated ? 'true' : 'false';
  setPremiumBackgroundImage(element, item, item.animated ? item.poster : fallback);
  let visible = true;
  let active = false;
  let observer = null;
  const mayAnimate = item.animated && !prefersReducedMotion() && useContext !== 'shop-grid';
  const sync = () => {
    const pageVisible = typeof document === 'undefined' || !document.hidden;
    const next = !!(mayAnimate && visible && pageVisible);
    if (next === active) return;
    active = next;
    setPremiumBackgroundImage(element, item, active ? item.asset : fallback);
    element.dataset.animationActive = active ? 'true' : 'false';
  };
  const onVisibility = () => sync();
  if (mayAnimate && typeof IntersectionObserver !== 'undefined'){
    visible = false;
    observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      visible = !!(entry && entry.isIntersecting);
      sync();
    }, { threshold:.05 });
    observer.observe(element);
  }
  if (mayAnimate && typeof document !== 'undefined' && document.addEventListener){
    document.addEventListener('visibilitychange', onVisibility);
  }
  sync();
  element._premiumBackgroundCleanup = () => {
    if (observer) observer.disconnect();
    if (mayAnimate && typeof document !== 'undefined' && document.removeEventListener){
      document.removeEventListener('visibilitychange', onVisibility);
    }
    active = false;
    setPremiumBackgroundImage(element, item, fallback);
    element.dataset.animationActive = 'false';
  };
  return true;
}

function backgroundPosterNode(item, options){
  const opts = options || {};
  const wrap = el('div', 'background-poster' + (item.animated ? ' is-animated' : ''));
  const img = document.createElement('img');
  img.src = assetUrl(item.poster);
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  const fallback = el('span', 'background-poster-fallback', 'BG');
  wrap.appendChild(img);
  wrap.appendChild(fallback);
  img.addEventListener('load', () => wrap.classList.add('asset-ready'));
  img.addEventListener('error', () => { img.style.display = 'none'; wrap.classList.add('asset-failed'); });
  if (opts.hoverPreview && item.animated){
    const start = () => { if (!prefersReducedMotion()) img.src = assetUrl(item.asset); };
    const stop = () => { img.src = assetUrl(item.poster); };
    wrap.addEventListener('mouseenter', start);
    wrap.addEventListener('focusin', start);
    wrap.addEventListener('mouseleave', stop);
    wrap.addEventListener('focusout', stop);
  }
  return wrap;
}

function gameCoverNode(id, game){
  const art = GAME_ART[id];
  if (!art || !gameArtEnabled(id)) return null;
  const cover = el('div', 'game-cover');
  cover.setAttribute('aria-hidden', 'true');
  const fallback = el('span', 'game-cover-fallback', game.icon);
  const img = document.createElement('img');
  img.src = assetUrl(art.cover);
  img.srcset = assetUrl(art.coverSmall) + ' 320w, ' + assetUrl(art.cover) + ' 640w';
  img.sizes = '(max-width: 480px) 45vw, 220px';
  img.loading = 'lazy';
  img.decoding = 'async';
  img.alt = '';
  img.addEventListener('load', () => cover.classList.add('asset-ready'));
  img.addEventListener('error', () => {
    img.style.display = 'none';
    cover.classList.add('asset-failed');
  });
  cover.appendChild(fallback);
  cover.appendChild(img);
  return cover;
}

function currencyIcon(sizeClass){
  const wrap = el('span', 'coin' + (sizeClass ? ' ' + sizeClass : ''));
  wrap.setAttribute('role', 'img');
  wrap.setAttribute('aria-label', t('currency_aria'));
  const img = el('img', 'coin-asset');
  img.src = assetUrl('currencyCash');
  img.alt = '';
  const fallback = el('span', 'coin-fallback', CURRENCY);
  img.addEventListener('error', () => {
    img.style.display = 'none';
    wrap.classList.add('asset-failed');
  });
  wrap.appendChild(img);
  wrap.appendChild(fallback);
  return wrap;
}

function initAssetFallbacks(){
  if (!document || !document.querySelectorAll) return;
  document.querySelectorAll('[data-asset-fallback]').forEach(holder => {
    const img = holder.querySelector('img');
    if (!img) return;
    img.addEventListener('error', () => {
      img.style.display = 'none';
      holder.classList.add('asset-failed');
    });
  });
}
