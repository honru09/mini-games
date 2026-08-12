/* ================= 美术资源运行时（P0） ================= */
const ASSET_ROOT = 'assets/';
// `coins`/`currency` remain the protocol and persistence field names.  The
// brand-facing label is deliberately separate so a naming refresh never
// changes economy authority or old clients.
const CURRENCY = '💵';
const CURRENCY_NAME = 'G Coins';
const CURRENCY_ASSET_ID = 'P-003';
/*
 * Presentation-only starter curation.  These IDs intentionally describe the
 * small pixel-first default gallery, not an entitlement or a price list:
 * server `owned` and purchase responses remain authoritative.  Older IDs are
 * still renderable and an already equipped legacy ID is kept in pickers.
 */
const CURATED_DEFAULT_FREE_AVATAR_IDS = Object.freeze([100, 101]);
const CURATED_DEFAULT_FREE_AVATAR_ID_SET = new Set(CURATED_DEFAULT_FREE_AVATAR_IDS);
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
const STICKER_ART_MASTER_FLAG = 'mg_art_sticker_m0_v1';
const STICKER_GAME_ART = Object.freeze({
  gomoku: Object.freeze({
    flag: 'mg_art_gomoku_sticker_v1',
    assets: Object.freeze({ board:'G-02-STICKER-BOARD-SURFACE-V1' }),
  }),
});
const HONRU_STATES_MASTER_FLAG = 'mg_art_honru_states_v1';
const HONRU_GAME_REACTIONS_FLAG = 'mg_art_honru_game_reactions_v1';
const HONRU_STATE_ASSET_ID = 'P-HONRU-STATES-V1';
const HONRU_STATE_IDS = Object.freeze(['idle','thinking','surprised','win','lose','recover','waiting-invite','check-in','playful']);
const HONRU_STATE_ID_SET = new Set(HONRU_STATE_IDS);
let runtimeAssetManifestPromise = null;

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

function stickerArtEnabled(id){
  const art = STICKER_GAME_ART[id];
  if (!art) return false;
  try {
    return localStorage.getItem(STICKER_ART_MASTER_FLAG) === '1' && localStorage.getItem(art.flag) === '1';
  } catch (error) {
    return false;
  }
}

function honruStatesEnabled(){
  try {
    return localStorage.getItem(HONRU_STATES_MASTER_FLAG) === '1' &&
      localStorage.getItem(HONRU_GAME_REACTIONS_FLAG) === '1';
  } catch (error) {
    return false;
  }
}

async function loadRuntimeAssetManifest(){
  if (!runtimeAssetManifestPromise){
    runtimeAssetManifestPromise = (typeof fetch === 'function'
      ? fetch(assetUrl('manifest'), { cache:'no-store' }).then(response => response && response.ok ? response.json() : null)
      : Promise.resolve(null)).catch(() => null);
  }
  const manifest = await runtimeAssetManifestPromise;
  if (!manifest) runtimeAssetManifestPromise = null;
  return manifest;
}

async function resolveStickerArtUrl(id, role){
  const art = STICKER_GAME_ART[id];
  if (!art || !stickerArtEnabled(id)) return '';
  const assetId = art.assets && art.assets[role];
  if (!assetId) return '';
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets) ? manifest.assets.find(asset => asset && asset.asset_id === assetId) : null;
  const flags = item && item.feature_flags;
  const expectedFlags = [STICKER_ART_MASTER_FLAG, art.flag];
  if (!item || item.runtime_id !== id || item.status !== 'ready' || !flags || flags.operator !== 'all' || flags.enabled_value !== '1' || flags.default_enabled !== false || JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags)) { runtimeAssetManifestPromise = null; return ''; }
  const path = String(item.runtime_path || '');
  const expectedPrefix = 'public/assets/games/' + id + '/';
  if (!path.startsWith(expectedPrefix) || !/^public\/assets\/games\/[a-z0-9-]+\/sticker-v[1-9]\d*\/[a-z0-9-]+\.svg$/.test(path)) { runtimeAssetManifestPromise = null; return ''; }
  return assetUrl(path.slice('public/assets/'.length));
}

async function resolveHonruStateUrl(stateId){
  const state = String(stateId || '');
  if (!HONRU_STATE_ID_SET.has(state) || !honruStatesEnabled()) return '';
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === HONRU_STATE_ASSET_ID)
    : null;
  const flags = item && item.feature_flags;
  const expectedFlags = [HONRU_STATES_MASTER_FLAG, HONRU_GAME_REACTIONS_FLAG];
  const path = String(item && item.variants && item.variants[state] || '');
  const expectedPath = 'public/assets/brand/honru/states-v1/honru-' + state + '-v1.webp';
  if (!item || item.runtime_id !== 'honru' || item.status !== 'ready' ||
      !flags || flags.operator !== 'all' || flags.enabled_value !== '1' ||
      flags.default_enabled !== false || JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags) ||
      path !== expectedPath || !/^public\/assets\/brand\/honru\/states-v1\/honru-[a-z0-9-]+-v1\.webp$/.test(path)) {
    runtimeAssetManifestPromise = null;
    return '';
  }
  return assetUrl(path.slice('public/assets/'.length));
}

function setAssetCssUrl(element, property, url){
  const value = 'url("' + url + '")';
  if (element.style && typeof element.style.setProperty === 'function') element.style.setProperty(property, value);
  else if (element.style) element.style[property] = value;
}

function premiumBackgroundMeta(id){
  return PREMIUM_BACKGROUND_BY_ID.get(Number(id)) || null;
}

function isCuratedDefaultFreeAvatarId(id){
  return CURATED_DEFAULT_FREE_AVATAR_ID_SET.has(Number(id));
}

function curatedAvatarCatalogItems(items, selectedAvatar){
  const selected = Number(selectedAvatar);
  return (Array.isArray(items) ? items : []).filter(item => {
    const id = Number(item && item.id);
    if (!Number.isInteger(id)) return false;
    // Former broad free choices are no longer starter options.  They remain
    // readable when equipped; paid entries stay in the catalog as before.
    return isCuratedDefaultFreeAvatarId(id) || item.free !== true || id === selected;
  });
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

function setPremiumBackgroundImage(element, item, path, fallbackPath){
  const fallbackLayer = fallbackPath && fallbackPath !== path ? ',url("' + assetUrl(fallbackPath) + '")' : '';
  element.style.backgroundImage = 'linear-gradient(' + item.overlay + ',' + item.overlay + '),url("' + assetUrl(path) + '")' + fallbackLayer;
}

function premiumBackgroundLoader(){
  try {
    if (typeof Image === 'function') return new Image();
    if (typeof document !== 'undefined' && document && typeof document.createElement === 'function') return document.createElement('img');
  } catch (error) {}
  return null;
}

function releasePremiumBackground(element){
  if (!element) return;
  if (typeof element._premiumBackgroundCleanup === 'function') element._premiumBackgroundCleanup();
  if (element._premiumBackgroundToneClass && element.classList && typeof element.classList.remove === 'function') {
    element.classList.remove(element._premiumBackgroundToneClass);
  }
  delete element._premiumBackgroundToneClass;
  element._premiumBackgroundCleanup = null;
  delete element._premiumBackgroundPlayback;
}

function setPremiumBackgroundPlayback(element, shouldPlay){
  const playback = element && element._premiumBackgroundPlayback;
  return playback && typeof playback.setPlayback === 'function'
    ? playback.setPlayback(shouldPlay)
    : false;
}

function applyPremiumBackground(element, id, context, options){
  releasePremiumBackground(element);
  const item = premiumBackgroundMeta(id);
  if (!item) return false;
  const useContext = context || 'profile';
  const opts = options || {};
  const fallback = premiumStaticAsset(item, useContext);
  const poster = item.animated ? item.poster : fallback;
  const toneClass = 'premium-bg-' + item.textTone;
  element.classList.add('premium-background', toneClass);
  element._premiumBackgroundToneClass = toneClass;
  element.dataset.backgroundId = String(item.id);
  element.dataset.backgroundAnimated = item.animated ? 'true' : 'false';
  setPremiumBackgroundImage(element, item, poster, fallback);
  let visible = true;
  let active = false;
  let observer = null;
  let loader = null;
  let removeLoaderListeners = null;
  let loaderEpoch = 0;
  let animationReady = !item.animated;
  let animationFailed = false;
  const playbackListeners = new Set();
  const motionQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  let reducedMotion = motionQuery ? !!motionQuery.matches : prefersReducedMotion();
  const mayAnimate = () => item.animated && !reducedMotion && useContext !== 'shop-grid';
  let playbackRequested = Object.prototype.hasOwnProperty.call(opts, 'autoplay') ? !!opts.autoplay : true;
  let lastPlaybackState = null;
  const discardLoader = invalidate => {
    if (invalidate) loaderEpoch++;
    if (typeof removeLoaderListeners === 'function') removeLoaderListeners();
    removeLoaderListeners = null;
    loader = null;
  };
  const emitPlaybackState = force => {
    const pageVisible = typeof document === 'undefined' || !document.hidden;
    const state = Object.freeze({ active, requested:playbackRequested, disabled:!mayAnimate(), visible, pageVisible, failed:animationFailed, loading:!!loader });
    if (!force && lastPlaybackState && lastPlaybackState.active === state.active && lastPlaybackState.requested === state.requested && lastPlaybackState.disabled === state.disabled && lastPlaybackState.visible === state.visible && lastPlaybackState.pageVisible === state.pageVisible && lastPlaybackState.failed === state.failed && lastPlaybackState.loading === state.loading) return;
    lastPlaybackState = state;
    if (typeof opts.onPlaybackStateChange === 'function') { try { opts.onPlaybackStateChange(state); } catch {} }
    playbackListeners.forEach(listener => { try { listener(state); } catch {} });
  };
  const setPoster = () => {
    setPremiumBackgroundImage(element, item, poster, fallback);
    element.dataset.animationActive = 'false';
  };
  const pause = () => {
    if (active) setPoster();
    active = false;
    element.dataset.animationActive = 'false';
  };
  const beginAnimatedPreload = () => {
    if (animationReady || animationFailed || loader || !mayAnimate()) return;
    const probe = premiumBackgroundLoader();
    // Non-browser consumers (such as minimal contract harnesses) have no
    // image lifecycle.  They retain the old deterministic direct seam.
    if (!probe || typeof probe !== 'object') {
      animationReady = true;
      return;
    }
    const epoch = ++loaderEpoch;
    loader = probe;
    const onLoad = () => {
      if (epoch !== loaderEpoch || loader !== probe) return;
      discardLoader(false);
      animationReady = true;
      sync();
    };
    const onError = () => {
      if (epoch !== loaderEpoch || loader !== probe) return;
      discardLoader(false);
      animationReady = false;
      animationFailed = true;
      pause();
      setPoster();
      element.dataset.animationFailed = 'true';
      emitPlaybackState(true);
    };
    if (typeof probe.addEventListener === 'function') {
      probe.addEventListener('load', onLoad);
      probe.addEventListener('error', onError);
      removeLoaderListeners = () => {
        if (typeof probe.removeEventListener === 'function') {
          probe.removeEventListener('load', onLoad);
          probe.removeEventListener('error', onError);
        }
      };
    } else {
      probe.onload = onLoad;
      probe.onerror = onError;
      removeLoaderListeners = () => { probe.onload = null; probe.onerror = null; };
    }
    try { probe.src = assetUrl(item.asset); }
    catch (error) { onError(); }
  };
  const sync = () => {
    const pageVisible = typeof document === 'undefined' || !document.hidden;
    const next = !!(mayAnimate() && playbackRequested && visible && pageVisible && !animationFailed);
    if (!next && loader) discardLoader(true);
    if (next && !animationReady) beginAnimatedPreload();
    if (next && animationReady){
      if (!active) setPremiumBackgroundImage(element, item, item.asset, poster);
      active = true;
      element.dataset.animationActive = 'true';
    } else pause();
    element.dataset.playbackDisabled = mayAnimate() ? 'false' : 'true';
    element.dataset.animationFailed = animationFailed ? 'true' : 'false';
    emitPlaybackState(false);
  };
  const setPlayback = shouldPlay => {
    if (!mayAnimate() || animationFailed){
      playbackRequested = false;
      element.dataset.playbackRequested = 'false';
      element.dataset.playbackDisabled = 'true';
      sync();
      return false;
    }
    playbackRequested = !!shouldPlay;
    element.dataset.playbackRequested = playbackRequested ? 'true' : 'false';
    sync();
    return true;
  };
  const onVisibility = () => sync();
  const onReducedMotionChange = event => {
    reducedMotion = !!(event && event.matches);
    sync();
  };
  element.dataset.animationActive = 'false';
  element.dataset.playbackRequested = playbackRequested ? 'true' : 'false';
  element.dataset.playbackDisabled = mayAnimate() ? 'false' : 'true';
  element.dataset.animationFailed = 'false';
  if (item.animated && useContext !== 'shop-grid' && typeof IntersectionObserver !== 'undefined'){
    visible = false;
    observer = new IntersectionObserver(entries => {
      const entry = entries[0];
      visible = !!(entry && entry.isIntersecting);
      sync();
    }, { threshold:.05 });
    observer.observe(element);
  }
  if (item.animated && useContext !== 'shop-grid' && typeof document !== 'undefined' && document.addEventListener){
    document.addEventListener('visibilitychange', onVisibility);
  }
  if (motionQuery && typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', onReducedMotionChange);
  else if (motionQuery && typeof motionQuery.addListener === 'function') motionQuery.addListener(onReducedMotionChange);
  element._premiumBackgroundPlayback = {
    setPlayback,
    sync,
    subscribe(listener){
      if (typeof listener !== 'function') return () => {};
      playbackListeners.add(listener);
      try { listener(lastPlaybackState || { active, requested:playbackRequested, disabled:!mayAnimate(), visible, pageVisible:typeof document === 'undefined' || !document.hidden, failed:animationFailed, loading:!!loader }); } catch {}
      return () => playbackListeners.delete(listener);
    },
  };
  sync();
  element._premiumBackgroundCleanup = () => {
    if (observer) observer.disconnect();
    discardLoader(true);
    if (item.animated && useContext !== 'shop-grid' && typeof document !== 'undefined' && document.removeEventListener){
      document.removeEventListener('visibilitychange', onVisibility);
    }
    if (motionQuery && typeof motionQuery.removeEventListener === 'function') motionQuery.removeEventListener('change', onReducedMotionChange);
    else if (motionQuery && typeof motionQuery.removeListener === 'function') motionQuery.removeListener(onReducedMotionChange);
    active = false;
    playbackRequested = false;
    setPoster();
    element.dataset.playbackRequested = 'false';
    playbackListeners.clear();
    delete element._premiumBackgroundPlayback;
  };
  return true;
}

function backgroundPosterNode(item, options){
  const opts = options || {};
  const wrap = el('div', 'background-poster' + (item.animated ? ' is-animated' : ''));
  const img = document.createElement('img');
  img.alt = '';
  img.loading = 'lazy';
  img.decoding = 'async';
  const fallback = el('span', 'background-poster-fallback', 'BG');
  let requestedSource = '';
  let requestedKind = '';
  const posterPath = item.poster || item.staticFallback || item.desktop || '';
  const staticFallbackPath = item.staticFallback || item.desktop || posterPath;
  const setSource = path => {
    requestedSource = assetUrl(path);
    requestedKind = path === item.asset ? 'animated' : (path === staticFallbackPath ? 'fallback' : 'poster');
    img.dataset.requestedSource = requestedSource;
    img.style.display = '';
    wrap.classList.remove('asset-ready', 'asset-failed');
    img.src = requestedSource;
  };
  wrap.appendChild(img);
  wrap.appendChild(fallback);
  img.addEventListener('load', () => {
    if (img.getAttribute('src') !== requestedSource) return;
    img.style.display = '';
    wrap.classList.remove('asset-failed');
    wrap.classList.add('asset-ready');
  });
  img.addEventListener('error', () => {
    if (img.getAttribute('src') !== requestedSource) return;
    if (requestedKind === 'animated' && posterPath && requestedSource !== assetUrl(posterPath)) {
      setSource(posterPath);
      return;
    }
    if (requestedKind === 'poster' && staticFallbackPath && requestedSource !== assetUrl(staticFallbackPath)) {
      setSource(staticFallbackPath);
      return;
    }
    img.style.display = 'none';
    wrap.classList.remove('asset-ready');
    wrap.classList.add('asset-failed');
  });
  setSource(posterPath);
  if (opts.hoverPreview && item.animated){
    const start = () => { if (!prefersReducedMotion()) setSource(item.asset); };
    const stop = () => { setSource(posterPath); };
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

function currencyName(){
  try {
    const localized = typeof t === 'function' ? String(t('currency_name') || '') : '';
    return localized && localized !== 'currency_name' ? localized : CURRENCY_NAME;
  } catch { return CURRENCY_NAME; }
}

function currencyAmountText(value, options){
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '0 ' + currencyName();
  const normalized = Math.trunc(amount);
  const signed = !!(options && options.signed);
  const prefix = signed && normalized > 0 ? '+' : '';
  return prefix + normalized + ' ' + currencyName();
}

/*
 * Test-admin presentation is deliberately a private-profile concern.  These
 * helpers only change what the currently signed-in account sees; they never
 * create capabilities, alter ownership, or send a mutation.  The server still
 * decides whether the four-part descriptor is present.
 */
function testAdminPresentation(profile){
  const source = profile && typeof profile === 'object' ? profile : null;
  const direct = !!(source &&
    source.isTestAdmin === true &&
    source.testRole === 'test_admin' &&
    source.currencyMode === 'unlimited' &&
    source.progressionMode === 'max');
  // Compatibility with the first private projection shape. This is only a
  // display check; it never grants or forwards any capability to the client.
  const nested = source && source.testAdmin && typeof source.testAdmin === 'object' && !Array.isArray(source.testAdmin) ? source.testAdmin : null;
  const capabilities = nested && Array.isArray(nested.capabilities) ? new Set(nested.capabilities.map(String)) : null;
  const nestedActive = !!(nested && nested.sandbox === true && nested.virtualAssets === true && capabilities &&
    ['test_admin_profile','test_admin_unlimited_currency','test_admin_all_catalog_items','test_admin_sandbox_match'].every(value => capabilities.has(value)));
  return { active: direct || nestedActive };
}

function isTestAdminPrivateAccount(profile){
  return testAdminPresentation(profile).active;
}

function hasTestAdminPrivateProjection(profile){
  if (!profile || typeof profile !== 'object') return false;
  return ['isTestAdmin','testRole','currencyMode','progressionMode','testAdmin'].some(key => Object.prototype.hasOwnProperty.call(profile,key));
}

function testAdminCurrencyText(profile, options){
  if (isTestAdminPrivateAccount(profile)) return t('test_admin_currency_unlimited');
  return currencyAmountText(profile && profile.coins, options);
}

function testAdminLevelShortText(profile, level){
  return isTestAdminPrivateAccount(profile) ? t('test_admin_level_short') : t('level_short',level);
}

function testAdminLevelBracketText(profile, level){
  return isTestAdminPrivateAccount(profile) ? t('test_admin_level_bracket') : t('level_bracket',level);
}

function testAdminLevelValue(profile, level){
  return isTestAdminPrivateAccount(profile) ? t('test_admin_level_value') : String(level);
}

function testAdminGrowthText(profile, current, required){
  return isTestAdminPrivateAccount(profile) ? t('test_admin_growth_max') : t('profile_xp_progress',current,required);
}

function appendTestAdminBadge(parent, profile, variant){
  if (!parent || !isTestAdminPrivateAccount(profile)) return null;
  const badge = el('span','test-admin-badge' + (variant ? ' test-admin-badge--' + variant : ''),t('test_admin_badge'));
  badge.setAttribute('title',t('test_admin_badge_aria'));
  badge.setAttribute('aria-label',t('test_admin_badge_aria'));
  return parent.appendChild(badge);
}

function applyTestAdminPrivateProjection(target, profile){
  if (!target || typeof target !== 'object') return target;
  const active = isTestAdminPrivateAccount(profile);
  target.isTestAdmin = active;
  target.testRole = active ? 'test_admin' : '';
  target.currencyMode = active ? 'unlimited' : '';
  target.progressionMode = active ? 'max' : '';
  // Capabilities are server-only control-plane data. The UI does not need to
  // retain them and must never turn a cached/local value into a privilege.
  delete target.testAdmin;
  delete target.capabilities;
  return target;
}

function stripTestAdminPrivateProjection(profile){
  if (!profile || typeof profile !== 'object') return profile;
  const safe = { ...profile };
  delete safe.isTestAdmin;
  delete safe.testRole;
  delete safe.currencyMode;
  delete safe.progressionMode;
  delete safe.testAdmin;
  delete safe.capabilities;
  return safe;
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
