/* ================= 美术资源运行时（P0） ================= */
const ASSET_ROOT = 'assets/';
// `coins`/`currency` remain the protocol and persistence field names.  The
// brand-facing label is deliberately separate so a naming refresh never
// changes economy authority or old clients.
const CURRENCY = '💵';
const CURRENCY_NAME = 'G Coins';
const CURRENCY_ASSET_ID = 'P-003';
// Candidate B is a presentation-only replacement for P-003.  The economy
// still speaks `coins`/`currency`; this seam only selects a visual asset and
// always keeps the project-owned P-003 SVG/emoji fallback available.
const GCOINS_RUNTIME_ASSET_ID = 'P-GCOINS-ICON-V1';
const GCOINS_RUNTIME_SOURCE_ASSET_ID = 'ART-026-GCOINS-P1-CANDIDATE-B';
const GCOINS_RUNTIME_FLAG = 'mg_art_gcoins_p1_v1';
const GCOINS_RUNTIME_VARIANTS = Object.freeze({
  '44': 'public/assets/ui/currency/gcoins-v1/gcoins-icon-44-v1.png',
  '64': 'public/assets/ui/currency/gcoins-v1/gcoins-icon-64-v1.png',
  '96': 'public/assets/ui/currency/gcoins-v1/gcoins-icon-96-v1.png',
  '192': 'public/assets/ui/currency/gcoins-v1/gcoins-icon-192-v1.png',
});
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
const HONRU_EMOJI_ASSET_ID = 'P-HONRU-EMOJI-V1';
const HONRU_EMOJI_MASTER_FLAG = 'mg_art_honru_emoji_v1';
const HONRU_EMOJI_THROW_FLAG = 'mg_art_honru_emoji_throw_v1';
const HONRU_EMOJI_IDS = Object.freeze(['emoji_wave','emoji_thumbsup','emoji_cheer','emoji_wow','emoji_oops','emoji_cry','emoji_angry','emoji_sly','emoji_heart','emoji_game']);
const HONRU_EMOJI_ID_SET = new Set(HONRU_EMOJI_IDS);
const HONRU_CONTEXT_REACTIONS_ASSET_ID = 'P-HONRU-CONTEXT-REACTIONS-V1';
const HONRU_CONTEXT_REACTIONS_FLAG = 'mg_art_honru_context_reactions_v1';
const HONRU_QUICK_STICKERS_FLAG = 'mg_art_honru_quick_stickers_v1';
const HONRU_CONTEXT_IDS = Object.freeze(['ready','your-turn','thinking','throw','hit','capture','score','combo','warning','reconnect','spectator','win','lose','draw','rematch','celebration']);
const HONRU_CONTEXT_ID_SET = new Set(HONRU_CONTEXT_IDS);
const HONRU_QUICK_GROUPS = Object.freeze({
  quick_hello:Object.freeze(['quick_hello_a','quick_hello_b','quick_hello_c']),
  quick_good_luck:Object.freeze(['quick_good_luck_a','quick_good_luck_b','quick_good_luck_c']),
  quick_nice:Object.freeze(['quick_nice_a','quick_nice_b','quick_nice_c']),
  quick_wow:Object.freeze(['quick_wow_a','quick_wow_b']),
  quick_thanks:Object.freeze(['quick_thanks_a','quick_thanks_b']),
  quick_again:Object.freeze(['quick_again_a','quick_again_b','quick_again_c']),
});
const HONRU_QUICK_ID_SET = new Set(Object.keys(HONRU_QUICK_GROUPS));
const AUTH_ART_MASTER_FLAG = 'mg_art_p0_01_v1';
const AUTH_BACKGROUND_FLAG = 'mg_art_auth_ghost_wake_v1';
const AUTH_HONRU_FLAG = 'mg_art_auth_honru_scenes_v1';
const AUTH_STATUS_FLAG = 'mg_art_auth_status_icons_v1';
const BOOT_HONRU_FLAG = 'mg_art_boot_honru_v1';
const AUTH_BACKGROUND_ASSET_ID = 'P-AUTH-GHOST-WAKE-BACKDROP-V1';
const AUTH_HONRU_ASSET_ID = 'P-AUTH-HONRU-SCENES-V1';
const AUTH_STATUS_ASSET_ID = 'P-AUTH-STATUS-ICONS-V1';
const BOOT_HONRU_ASSET_ID = 'P-BOOT-HONRU-CONTROLLER-V1';
const AUTH_ART_CLEARANCE_RECORD = 'art-source/platform/auth/ghost-wake-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const AUTH_ART_SOURCE_IDS = Object.freeze({
  [AUTH_BACKGROUND_ASSET_ID]:'ART-AUTH-GHOST-WAKE-BACKDROP-V1',
  [AUTH_HONRU_ASSET_ID]:'ART-AUTH-HONRU-SCENES-V1',
  [AUTH_STATUS_ASSET_ID]:'ART-AUTH-STATUS-ICONS-V1',
  [BOOT_HONRU_ASSET_ID]:'ART-BOOT-HONRU-CONTROLLER-V1',
});
const AUTH_HONRU_SCENE_IDS = Object.freeze(['login-welcome','register-create','legacy-migrate','guest-safe-entry','connecting','credential-error','recovered','first-start']);
const AUTH_HONRU_SCENE_ID_SET = new Set(AUTH_HONRU_SCENE_IDS);
const AUTH_STATUS_ICON_IDS = Object.freeze(['username-available','username-occupied','password-error','migration-success','connected','offline-retry']);
const AUTH_STATUS_ICON_ID_SET = new Set(AUTH_STATUS_ICON_IDS);
const AUTH_ART_SIZES = Object.freeze(['160','240','320']);
const AUTH_ART_SIZE_SET = new Set(AUTH_ART_SIZES);
const PLATFORM_SCENE_MASTER_FLAG = 'mg_art_platform_scenes_v1';
const PLATFORM_SCENE_FLAGS = Object.freeze({
  home:'mg_art_platform_scene_home_v1',
  games:'mg_art_platform_scene_games_v1',
  room:'mg_art_platform_scene_room_v1',
  playline:'mg_art_platform_scene_playline_v1',
});
const PLATFORM_SCENE_EXPECTED_FLAGS = Object.freeze([PLATFORM_SCENE_MASTER_FLAG,...Object.values(PLATFORM_SCENE_FLAGS)]);
const PLATFORM_SCENE_ASSET_ID = 'P-PLATFORM-SCENES-V1';
const PLATFORM_SCENE_SOURCE_ID = 'ART-PLATFORM-SCENES-V1';
const PLATFORM_SCENE_CLEARANCE_RECORD = 'art-source/platform/scenes/signal-worlds-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const PLATFORM_SCENE_ROUTES = Object.freeze(['home','games','room','playline']);
const GAME_STAGE_ART_FLAG = 'mg_art_game_stage_shared_v1';
const GAME_STAGE_ART_ASSET_ID = 'P-GAME-STAGE-SHARED-ART-V1';
const GAME_STAGE_ART_SOURCE_ID = 'ART-GAME-STAGE-SHARED-ART-V1';
const GAME_STAGE_ART_CLEARANCE_RECORD = 'art-source/platform/game-stage/shared-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const GAME_STAGE_ART_ROLES = Object.freeze(['surface','frame','stage_enter','ready','turn_start','accepted_move','capture','warning','reconnect','terminal','reward']);
const GAME_STAGE_ART_ROLE_SET = new Set(GAME_STAGE_ART_ROLES);
const MODAL_ART_FLAG = 'mg_art_modal_illustration_v1';
const MODAL_ART_ASSET_ID = 'P-MODAL-ILLUSTRATION-V1';
const MODAL_ART_SOURCE_ID = 'ART-MODAL-ILLUSTRATION-V1';
const MODAL_ART_CLEARANCE_RECORD = 'art-source/platform/modal/illustrations-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const MODAL_ART_SEMANTICS = Object.freeze(['auth-entry','legacy-migrate','room-create','room-join','invite','waiting','host-transfer','reconnect','room-closed','rules','tutorial','exit-confirm','victory','defeat-draw','reward','level-up','achievement','profile-loading','profile-compare','shop-purchase','balance-low','safety-shield','connection-failed','playline-empty','dm-empty','tournament','replay']);
const MODAL_ART_SEMANTIC_SET = new Set(MODAL_ART_SEMANTICS);
const MODAL_ART_TONES = Object.freeze(['neutral','success','warning','error']);
const MODAL_ART_TONE_SET = new Set(MODAL_ART_TONES);
const MODAL_ART_SIZES = Object.freeze(['160','240','320']);
const MODAL_ART_SIZE_SET = new Set(MODAL_ART_SIZES);
const LOADING_ART_FLAG = 'mg_art_loading_state_v1';
const LOADING_ART_ASSET_ID = 'P-LOADING-STATE-ART-V1';
const LOADING_ART_SOURCE_ID = 'ART-LOADING-STATE-ART-V1';
const LOADING_ART_CLEARANCE_RECORD = 'art-source/platform/loading/state-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const LOADING_ART_SEMANTICS = Object.freeze(['boot','page','auth','avatar','background','game','room','reconnect','feed','profile','shop','retry']);
const LOADING_ART_SEMANTIC_SET = new Set(LOADING_ART_SEMANTICS);
const GOMOKU_FINAL_ART_FLAG = 'mg_art_gomoku_final_v1';
const GOMOKU_FINAL_ART_ASSET_ID = 'G-02-GOMOKU-FINAL-ART-V1';
const GOMOKU_FINAL_ART_SOURCE_ID = 'ART-GOMOKU-FINAL-ART-V1';
const GOMOKU_FINAL_ART_CLEARANCE_RECORD = 'art-source/games/gomoku/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const GOMOKU_FINAL_ART_BOARDS = Object.freeze(['wood','stone','ink','grass']);
const GOMOKU_FINAL_ART_PIECES = Object.freeze(['black-white','jade','crystal','glow','obsidian']);
const GOMOKU_FINAL_ART_VFX = Object.freeze(['last-move','placement-impact','five-line','draw-settle','ai-thinking','spectate','reconnect']);
const GOMOKU_FINAL_ART_CAMERAS = Object.freeze(['desktop','mobile']);
const GOMOKU_FINAL_ART_ROLE_SET = new Set([
  ...GOMOKU_FINAL_ART_BOARDS.map(id => 'board-' + id),
  ...GOMOKU_FINAL_ART_PIECES.map(id => 'piece-' + id),
  ...GOMOKU_FINAL_ART_VFX.map(id => 'vfx-' + id),
  ...GOMOKU_FINAL_ART_CAMERAS.map(id => 'camera-' + id),
]);
const LUDO_FINAL_ART_FLAG = 'mg_art_ludo_final_v1';
const LUDO_FINAL_ART_ASSET_ID = 'G-07-LUDO-FINAL-ART-V1';
const LUDO_FINAL_ART_SOURCE_ID = 'ART-LUDO-FINAL-ART-V1';
const LUDO_FINAL_ART_CLEARANCE_RECORD = 'art-source/games/ludo/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const LUDO_FINAL_ART_BOARDS = Object.freeze(['classic','sky','night','grass']);
const LUDO_FINAL_ART_FACTIONS = Object.freeze(['red','blue','green','yellow']);
const LUDO_FINAL_ART_POSES = Object.freeze(['takeoff','cruise','land']);
const LUDO_FINAL_ART_VFX = Object.freeze(['takeoff','capture-impact','extra-turn','return-home','finish']);
const LUDO_FINAL_ART_PODIUMS = Object.freeze(['2p','3p','4p']);
const LUDO_FINAL_ART_SKINS = Object.freeze(['jet','paper','ghost','mech']);
const LUDO_FINAL_ART_ROLE_SET = new Set([
  ...LUDO_FINAL_ART_BOARDS.map(id => 'board-' + id),
  ...LUDO_FINAL_ART_FACTIONS.flatMap(color => LUDO_FINAL_ART_POSES.map(pose => 'aircraft-' + color + '-' + pose)),
  'route-safe','route-start','route-finish','die-atlas',
  ...LUDO_FINAL_ART_VFX.map(id => 'vfx-' + id),
  ...LUDO_FINAL_ART_PODIUMS.map(id => 'podium-' + id),
  ...LUDO_FINAL_ART_SKINS.map(id => 'skin-' + id),
  'camera-desktop','camera-mobile',
]);
const PROGRESSION_FEEDBACK_ART_FLAG = 'mg_art_progression_feedback_v1';
const PROGRESSION_FEEDBACK_ART_ASSET_ID = 'P-PROGRESSION-FEEDBACK-ART-V1';
const PROGRESSION_FEEDBACK_ART_SOURCE_ID = 'ART-PROGRESSION-FEEDBACK-ART-V1';
const PROGRESSION_FEEDBACK_ART_CLEARANCE_RECORD = 'art-source/platform/progression/feedback-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const PROGRESSION_FEEDBACK_IDS = Object.freeze(['reward','gcoins','xp','level-up','task','achievement','win-streak','collection','unlock']);
const PROGRESSION_FEEDBACK_ID_SET = new Set(PROGRESSION_FEEDBACK_IDS);
const PROGRESSION_FEEDBACK_SIZES = Object.freeze(['96','160','256']);
const PROGRESSION_FEEDBACK_SIZE_SET = new Set(PROGRESSION_FEEDBACK_SIZES);
const PROGRESSION_FEEDBACK_FALLBACKS = Object.freeze({
  reward:'✦',gcoins:CURRENCY,xp:'XP','level-up':'↑',task:'✓',achievement:'◇','win-streak':'♨',collection:'□',unlock:'⌁',
});
let runtimeAssetManifestPromise = null;
let authArtManifestPromise = null;
let platformSceneManifestPromise = null;
let gameStageArtManifestPromise = null;
let modalArtManifestPromise = null;
let loadingArtManifestPromise = null;
let gomokuFinalArtManifestPromise = null;
let ludoFinalArtManifestPromise = null;

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

function ownerClearedDefaultOnFlagEnabled(flag){
  try {
    const value = localStorage.getItem(flag);
    return value === null || value === '1';
  } catch (error) {
    return false;
  }
}

function honruStatesEnabled(){
  return ownerClearedDefaultOnFlagEnabled(HONRU_STATES_MASTER_FLAG);
}

function honruGameReactionsEnabled(){
  return honruStatesEnabled() && ownerClearedDefaultOnFlagEnabled(HONRU_GAME_REACTIONS_FLAG);
}

function honruEmojiEnabled(){
  return ownerClearedDefaultOnFlagEnabled(HONRU_EMOJI_MASTER_FLAG);
}

function honruEmojiThrowEnabled(){
  return honruEmojiEnabled() && ownerClearedDefaultOnFlagEnabled(HONRU_EMOJI_THROW_FLAG);
}

function honruContextReactionsEnabled(){
  return ownerClearedDefaultOnFlagEnabled(HONRU_CONTEXT_REACTIONS_FLAG);
}

function honruQuickStickersEnabled(){
  return honruContextReactionsEnabled() && ownerClearedDefaultOnFlagEnabled(HONRU_QUICK_STICKERS_FLAG);
}

function gCoinsRuntimeEnabled(){
  return ownerClearedDefaultOnFlagEnabled(GCOINS_RUNTIME_FLAG);
}

function progressionFeedbackArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(PROGRESSION_FEEDBACK_ART_FLAG);
}

function authArtFamilyEnabled(flag){
  return ownerClearedDefaultOnFlagEnabled(AUTH_ART_MASTER_FLAG) && ownerClearedDefaultOnFlagEnabled(flag);
}

function platformSceneEnabled(route){
  const id=PLATFORM_SCENE_ROUTES.includes(String(route||''))?String(route):'home';
  return ownerClearedDefaultOnFlagEnabled(PLATFORM_SCENE_MASTER_FLAG) && ownerClearedDefaultOnFlagEnabled(PLATFORM_SCENE_FLAGS[id]);
}

function gameStageArtEnabled(){ return ownerClearedDefaultOnFlagEnabled(GAME_STAGE_ART_FLAG); }

function ownerClearedManifestItem(manifest, assetId, expectedFlags, cacheFamily, expectedSourceId){
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === assetId)
    : null;
  const flags = item && item.feature_flags;
  const valid = !!(item && item.runtime_id === 'platform' && item.status === 'ready' &&
    item.clearance === 'OWNER_AUTHORIZED_ART_CLEARANCE' && item.artwork_version === 1 &&
    item.source_asset_id === (expectedSourceId || AUTH_ART_SOURCE_IDS[assetId]) && item.clearance_record === (expectedSourceId ? PLATFORM_SCENE_CLEARANCE_RECORD : AUTH_ART_CLEARANCE_RECORD) &&
    flags && flags.operator === 'all' && flags.enabled_value === '1' && flags.default_enabled === true &&
    JSON.stringify(flags.ids) === JSON.stringify(expectedFlags));
  if (!valid){
    if (cacheFamily === 'auth') authArtManifestPromise = null;
    else if (cacheFamily === 'platform-scene') platformSceneManifestPromise = null;
    else runtimeAssetManifestPromise = null;
  }
  return valid ? item : null;
}

async function loadAuthArtManifest(){
  if (!authArtManifestPromise){
    authArtManifestPromise = (typeof fetch === 'function'
      ? fetch(assetUrl('manifest'), { cache:'no-store' }).then(response => response && response.ok ? response.json() : null)
      : Promise.resolve(null)).catch(() => null);
  }
  const manifest = await authArtManifestPromise;
  if (!manifest) authArtManifestPromise = null;
  return manifest;
}

async function loadPlatformSceneManifest(){
  if(!platformSceneManifestPromise){
    platformSceneManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await platformSceneManifestPromise;
  if(!manifest)platformSceneManifestPromise=null;
  return manifest;
}

async function loadGameStageArtManifest(){
  if(!gameStageArtManifestPromise){
    gameStageArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await gameStageArtManifestPromise;
  if(!manifest)gameStageArtManifestPromise=null;
  return manifest;
}

async function loadModalArtManifest(){
  if(!modalArtManifestPromise){
    modalArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await modalArtManifestPromise;
  if(!manifest)modalArtManifestPromise=null;
  return manifest;
}

async function loadLoadingArtManifest(){
  if(!loadingArtManifestPromise){
    loadingArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await loadingArtManifestPromise;
  if(!manifest)loadingArtManifestPromise=null;
  return manifest;
}

function gomokuFinalArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(GOMOKU_FINAL_ART_FLAG);
}

async function loadGomokuFinalArtManifest(){
  if(!gomokuFinalArtManifestPromise){
    gomokuFinalArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await gomokuFinalArtManifestPromise;
  if(!manifest)gomokuFinalArtManifestPromise=null;
  return manifest;
}

async function resolveGomokuFinalArtUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!GOMOKU_FINAL_ART_ROLE_SET.has(safeRole)||!gomokuFinalArtEnabled())return '';
  const manifest=await loadGomokuFinalArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===GOMOKU_FINAL_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,expectedFlags=[GOMOKU_FINAL_ART_FLAG];
  const key=safeRole+(useStatic?'-static':'');
  const runtimePath=String(item&&item.variants&&item.variants[key]||'');
  const expected='public/assets/games/gomoku/final-art-v1/'+key+'-v1.webp';
  if(!item||item.runtime_id!=='gomoku'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.artwork_version!==1||item.source_asset_id!==GOMOKU_FINAL_ART_SOURCE_ID||item.clearance_record!==GOMOKU_FINAL_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify(expectedFlags)||runtimePath!==expected||!/public\/assets\/games\/gomoku\/final-art-v1\/[a-z0-9-]+-v1\.webp$/.test(runtimePath)){
    gomokuFinalArtManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function ludoFinalArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(LUDO_FINAL_ART_FLAG);
}

async function loadLudoFinalArtManifest(){
  if(!ludoFinalArtManifestPromise){
    ludoFinalArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await ludoFinalArtManifestPromise;
  if(!manifest)ludoFinalArtManifestPromise=null;
  return manifest;
}

async function resolveLudoFinalArtUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!LUDO_FINAL_ART_ROLE_SET.has(safeRole)||!ludoFinalArtEnabled())return '';
  const manifest=await loadLudoFinalArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===LUDO_FINAL_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,expectedFlags=[LUDO_FINAL_ART_FLAG];
  const key=safeRole+(useStatic?'-static':''),runtimePath=String(item&&item.variants&&item.variants[key]||''),expected='public/assets/games/ludo/final-art-v1/'+key+'-v1.webp';
  if(!item||item.runtime_id!=='ludo'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.artwork_version!==1||item.source_asset_id!==LUDO_FINAL_ART_SOURCE_ID||item.clearance_record!==LUDO_FINAL_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify(expectedFlags)||runtimePath!==expected||!/public\/assets\/games\/ludo\/final-art-v1\/[a-z0-9-]+-v1\.webp$/.test(runtimePath)){
    ludoFinalArtManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

async function resolvePlatformSceneSet(route,theme,mobile,options){
  const id=PLATFORM_SCENE_ROUTES.includes(String(route||''))?String(route):'home';
  if(!platformSceneEnabled(id))return null;
  const safeTheme=theme==='dark'?'dark':'light',viewport=mobile?'mobile':'desktop';
  const manifest=await loadPlatformSceneManifest();
  const item=ownerClearedManifestItem(manifest,PLATFORM_SCENE_ASSET_ID,PLATFORM_SCENE_EXPECTED_FLAGS,'platform-scene',PLATFORM_SCENE_SOURCE_ID);
  const variants=item&&item.variants&&typeof item.variants==='object'?item.variants:{};
  const base=`public/assets/backgrounds/platform-scenes-v1/${id}/${safeTheme}/${viewport}/${id}-${safeTheme}-${viewport}-`;
  const expected={
    far:base+'far-v1.webp',mid:base+'mid-v1.webp',foreground:base+'foreground-v1.webp',static:base+'static-v1.webp',
    poster:`public/assets/backgrounds/platform-scenes-v1/${id}/${safeTheme}/preview/${id}-${safeTheme}-poster-v1.webp`,
    mini:`public/assets/backgrounds/platform-scenes-v1/${id}/${safeTheme}/preview/${id}-${safeTheme}-mini-v1.webp`,
  };
  const useStatic=!!(options&&options.reducedMotion),usePoster=!!(options&&options.saveData);
  const selected=usePoster?expected.poster:(useStatic?expected.static:null);
  if(selected){
    const selectedKey=usePoster?`${id}-${safeTheme}-poster`:`${id}-${safeTheme}-${viewport}-static`;
    if(variants[selectedKey]!==selected){platformSceneManifestPromise=null;return null;}
    return Object.freeze({route:id,theme:safeTheme,viewport,mode:usePoster?'poster':'static',far:assetUrl(selected.slice('public/assets/'.length)),mid:'',foreground:'',poster:assetUrl(expected.poster.slice('public/assets/'.length)),mini:assetUrl(expected.mini.slice('public/assets/'.length))});
  }
  const keys={far:`${id}-${safeTheme}-${viewport}-far`,mid:`${id}-${safeTheme}-${viewport}-mid`,foreground:`${id}-${safeTheme}-${viewport}-foreground`,static:`${id}-${safeTheme}-${viewport}-static`};
  if(!Object.entries({far:expected.far,mid:expected.mid,foreground:expected.foreground,static:expected.static}).every(([layer,value])=>variants[keys[layer]]===value)) { platformSceneManifestPromise=null; return null; }
  return Object.freeze({route:id,theme:safeTheme,viewport,mode:'layered',far:assetUrl(expected.far.slice('public/assets/'.length)),mid:assetUrl(expected.mid.slice('public/assets/'.length)),foreground:assetUrl(expected.foreground.slice('public/assets/'.length)),poster:assetUrl(expected.poster.slice('public/assets/'.length)),mini:assetUrl(expected.mini.slice('public/assets/'.length))});
}

async function resolveGameStageArtUrl(role, staticFallback){
  const safeRole=String(role||'');
  if(!GAME_STAGE_ART_ROLE_SET.has(safeRole)||!gameStageArtEnabled())return '';
  const manifest=await loadGameStageArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===GAME_STAGE_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,expectedFlags=[GAME_STAGE_ART_FLAG];
  const key=staticFallback?safeRole+'-static':safeRole;
  const pathValue=String(item&&item.variants&&item.variants[key]||'');
  const expected='public/assets/ui/game-stage/shared-v1/'+safeRole+(staticFallback?'-static':'')+'-v1.webp';
  if(!item||item.runtime_id!=='platform'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==GAME_STAGE_ART_SOURCE_ID||item.clearance_record!==GAME_STAGE_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify(expectedFlags)||pathValue!==expected){gameStageArtManifestPromise=null;return '';}
  return assetUrl(pathValue.slice('public/assets/'.length));
}

async function resolveModalIllustrationUrl(semantic,tone,size,staticFallback){
  const safeSemantic=String(semantic||''),safeTone=staticFallback?'neutral':String(tone||'neutral'),safeSize=String(size||'240');
  if(!MODAL_ART_SEMANTIC_SET.has(safeSemantic)||!MODAL_ART_TONE_SET.has(safeTone)||!MODAL_ART_SIZE_SET.has(safeSize)||!ownerClearedDefaultOnFlagEnabled(MODAL_ART_FLAG))return '';
  const manifest=await loadModalArtManifest(),item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===MODAL_ART_ASSET_ID):null,flags=item&&item.feature_flags;
  const key=`${safeSemantic}-${safeTone}-${safeSize}`,pathValue=String(item&&item.variants&&item.variants[key]||''),expected=`public/assets/ui/modal/illustrations-v1/${safeSemantic}/${safeTone}/${safeSize}-${safeSemantic}-v1.webp`;
  if(!item||item.runtime_id!=='platform'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==MODAL_ART_SOURCE_ID||item.clearance_record!==MODAL_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([MODAL_ART_FLAG])||pathValue!==expected){modalArtManifestPromise=null;return '';}
  return assetUrl(pathValue.slice('public/assets/'.length));
}

async function resolveLoadingArtUrl(semantic,size){
  const safeSemantic=LOADING_ART_SEMANTIC_SET.has(String(semantic||''))?String(semantic):'page',safeSize=MODAL_ART_SIZE_SET.has(String(size||''))?String(size):'160';
  if(!ownerClearedDefaultOnFlagEnabled(LOADING_ART_FLAG))return '';
  const manifest=await loadLoadingArtManifest(),item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===LOADING_ART_ASSET_ID):null,flags=item&&item.feature_flags;
  const key=`${safeSemantic}-${safeSize}`,pathValue=String(item&&item.variants&&item.variants[key]||''),expected=`public/assets/ui/loading/state-art-v1/${safeSemantic}/${safeSize}-${safeSemantic}-v1.webp`;
  if(!item||item.runtime_id!=='platform'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==LOADING_ART_SOURCE_ID||item.clearance_record!==LOADING_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([LOADING_ART_FLAG])||pathValue!==expected){loadingArtManifestPromise=null;return '';}
  return assetUrl(pathValue.slice('public/assets/'.length));
}

async function resolveAuthBackgroundUrl(theme, mobile, staticFallback){
  if (!authArtFamilyEnabled(AUTH_BACKGROUND_FLAG)) return '';
  const safeTheme = theme === 'dark' ? 'dark' : 'light';
  const viewport = mobile ? 'mobile' : 'desktop';
  const key = safeTheme + '-' + viewport + (staticFallback ? '-static' : '');
  const expectedPath = 'public/assets/ui/auth/ghost-wake-v1/backgrounds/auth-ghost-wake-' + safeTheme + '-' + viewport + '-v1' + (staticFallback ? '-static' : '') + '.webp';
  const manifest = await loadAuthArtManifest();
  const item = ownerClearedManifestItem(manifest, AUTH_BACKGROUND_ASSET_ID, [AUTH_ART_MASTER_FLAG,AUTH_BACKGROUND_FLAG], 'auth');
  const runtimePath = String(item && item.variants && item.variants[key] || '');
  if (!item || runtimePath !== expectedPath || !/^public\/assets\/ui\/auth\/ghost-wake-v1\/backgrounds\/auth-ghost-wake-(?:light|dark)-(?:desktop|mobile)-v1(?:-static)?\.webp$/.test(runtimePath)) {
    authArtManifestPromise = null;
    return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

async function resolveAuthHonruSceneUrl(sceneId, size){
  const scene = String(sceneId || ''), px = String(size || '320');
  if (!AUTH_HONRU_SCENE_ID_SET.has(scene) || !AUTH_ART_SIZE_SET.has(px) || !authArtFamilyEnabled(AUTH_HONRU_FLAG)) return '';
  const key = scene + '-' + px;
  const expectedPath = 'public/assets/ui/auth/ghost-wake-v1/honru/' + scene + '-' + px + '-v1.webp';
  const manifest = await loadAuthArtManifest();
  const item = ownerClearedManifestItem(manifest, AUTH_HONRU_ASSET_ID, [AUTH_ART_MASTER_FLAG,AUTH_HONRU_FLAG], 'auth');
  const runtimePath = String(item && item.variants && item.variants[key] || '');
  if (!item || runtimePath !== expectedPath || !/^public\/assets\/ui\/auth\/ghost-wake-v1\/honru\/[a-z0-9-]+-(?:160|240|320)-v1\.webp$/.test(runtimePath)) {
    authArtManifestPromise = null;
    return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

async function resolveBootHonruUrl(sceneId, size){
  const scene = String(sceneId || ''), px = String(size || '320');
  if (!['honru-boot-controller-hug','honru-boot-retry-signal'].includes(scene) || !AUTH_ART_SIZE_SET.has(px) || !authArtFamilyEnabled(BOOT_HONRU_FLAG)) return '';
  const key = scene + '-' + px;
  const expectedPath = 'public/assets/ui/loading/ghost-boot-v1/' + scene + '-' + px + '-v1.webp';
  const manifest = await loadAuthArtManifest();
  const item = ownerClearedManifestItem(manifest, BOOT_HONRU_ASSET_ID, [AUTH_ART_MASTER_FLAG,BOOT_HONRU_FLAG], 'auth');
  const runtimePath = String(item && item.variants && item.variants[key] || '');
  if (!item || runtimePath !== expectedPath || !/^public\/assets\/ui\/loading\/ghost-boot-v1\/honru-boot-(?:controller-hug|retry-signal)-(?:160|240|320)-v1\.webp$/.test(runtimePath)) {
    authArtManifestPromise = null;
    return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

async function resolveAuthStatusIconUrl(iconId){
  const id = String(iconId || '');
  if (!AUTH_STATUS_ICON_ID_SET.has(id) || !authArtFamilyEnabled(AUTH_STATUS_FLAG)) return '';
  const expectedPath = 'public/assets/ui/auth/status-v1/' + id + '-v1.svg';
  const manifest = await loadAuthArtManifest();
  const item = ownerClearedManifestItem(manifest, AUTH_STATUS_ASSET_ID, [AUTH_ART_MASTER_FLAG,AUTH_STATUS_FLAG], 'auth');
  const runtimePath = String(item && item.variants && item.variants[id] || '');
  if (!item || runtimePath !== expectedPath || !/^public\/assets\/ui\/auth\/status-v1\/[a-z0-9-]+-v1\.svg$/.test(runtimePath)) {
    authArtManifestPromise = null;
    return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function loadDecorativeImage(img, url, fallback, valid){
  if (!img) return Promise.resolve(false);
  const fallbackUrl = String(fallback || assetUrl('brand/honru-mascot-v1.svg'));
  const isValid = () => img.isConnected && (typeof valid !== 'function' || valid());
  const restore = () => { if (isValid()) { img.onerror = null; img.src = fallbackUrl; } return false; };
  const activate = () => {
    if (!isValid()) return false;
    img.onerror = () => { img.onerror = null; if (isValid()) img.src = fallbackUrl; };
    img.src = url;
    return true;
  };
  if (!url) return Promise.resolve(restore());
  const probe = new Image();
  probe.decoding = 'async';
  if (typeof probe.decode === 'function') { probe.src = url; return probe.decode().then(activate, restore); }
  return new Promise(resolve => {
    probe.onload = () => resolve(activate());
    probe.onerror = () => resolve(restore());
    probe.src = url;
  });
}

function initAuthArtRuntime(){
  const bootImg = typeof document !== 'undefined' ? document.getElementById('ghost-boot-art') : null;
  if (bootImg) resolveBootHonruUrl('honru-boot-controller-hug','320').then(url => loadDecorativeImage(bootImg,url,assetUrl('brand/ghost-game-mark.svg'))).catch(()=>{});
}

async function resolveGCoinsIconSet(){
  if (!gCoinsRuntimeEnabled()) return null;
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === GCOINS_RUNTIME_ASSET_ID)
    : null;
  const flags = item && item.feature_flags;
  const expectedFlags = [GCOINS_RUNTIME_FLAG];
  const runtimePath = String(item && item.runtime_path || '');
  const variants = item && item.variants && typeof item.variants === 'object' ? item.variants : null;
  const validPath = path => /^public\/assets\/ui\/currency\/gcoins-v1\/gcoins-icon-(?:44|64|96|192)-v1\.png$/.test(String(path || ''));
  const validVariants = variants && Object.keys(GCOINS_RUNTIME_VARIANTS).every(size => variants[size] === GCOINS_RUNTIME_VARIANTS[size]);
  if (!item || item.runtime_id !== 'platform' || item.status !== 'ready' ||
      item.clearance !== 'OWNER_AUTHORIZED_ART_CLEARANCE' || item.source_asset_id !== GCOINS_RUNTIME_SOURCE_ASSET_ID ||
      item.artwork_version !== 1 || runtimePath !== GCOINS_RUNTIME_VARIANTS['64'] || !validPath(runtimePath) ||
      !validVariants || !flags || flags.operator !== 'all' || flags.enabled_value !== '1' ||
      flags.default_enabled !== true || JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags)) {
    runtimeAssetManifestPromise = null;
    return null;
  }
  return Object.freeze({
    primary: assetUrl(runtimePath.slice('public/assets/'.length)),
    variants: Object.freeze(Object.fromEntries(Object.entries(variants).map(([size, value]) => [size, assetUrl(String(value).slice('public/assets/'.length))]))),
  });
}

async function resolveProgressionFeedbackUrl(feedbackId,size){
  const id=String(feedbackId||''),px=String(size||'160');
  if(!PROGRESSION_FEEDBACK_ID_SET.has(id)||!PROGRESSION_FEEDBACK_SIZE_SET.has(px)||!progressionFeedbackArtEnabled())return '';
  const manifest=await loadRuntimeAssetManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===PROGRESSION_FEEDBACK_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,key=id+'-'+px,pathValue=String(item&&item.variants&&item.variants[key]||'');
  const expected='public/assets/ui/progression/feedback-v1/'+id+'-'+px+'-v1.webp';
  if(!item||item.runtime_id!=='platform'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||
      item.source_asset_id!==PROGRESSION_FEEDBACK_ART_SOURCE_ID||item.artwork_version!==1||
      item.clearance_record!==PROGRESSION_FEEDBACK_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||
      flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([PROGRESSION_FEEDBACK_ART_FLAG])||
      pathValue!==expected||!/^public\/assets\/ui\/progression\/feedback-v1\/[a-z0-9-]+-(?:96|160|256)-v1\.webp$/.test(pathValue)){
    runtimeAssetManifestPromise=null;return '';
  }
  return assetUrl(pathValue.slice('public/assets/'.length));
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
      item.clearance !== 'OWNER_AUTHORIZED_ART_CLEARANCE' ||
      !flags || flags.operator !== 'all' || flags.enabled_value !== '1' ||
      flags.default_enabled !== true || JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags) ||
      path !== expectedPath || !/^public\/assets\/brand\/honru\/states-v1\/honru-[a-z0-9-]+-v1\.webp$/.test(path)) {
    runtimeAssetManifestPromise = null;
    return '';
  }
  return assetUrl(path.slice('public/assets/'.length));
}

async function resolveHonruContextUrl(contextId){
  const id = String(contextId || '');
  if (!HONRU_CONTEXT_ID_SET.has(id) || !honruContextReactionsEnabled()) return '';
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === HONRU_CONTEXT_REACTIONS_ASSET_ID)
    : null;
  const flags = item && item.feature_flags;
  const expectedFlags = [HONRU_CONTEXT_REACTIONS_FLAG, HONRU_QUICK_STICKERS_FLAG];
  const path = String(item && item.variants && item.variants[id] || '');
  const expectedPath = 'public/assets/brand/honru/context-reactions-v1/contexts/honru-context-' + id + '-v1.webp';
  if (!item || item.runtime_id !== 'honru' || item.status !== 'ready' ||
      item.clearance !== 'OWNER_AUTHORIZED_ART_CLEARANCE' || item.source_asset_id !== 'ART-HONRU-CONTEXT-REACTIONS-V1' ||
      item.artwork_version !== 1 || !flags || flags.operator !== 'all' || flags.enabled_value !== '1' ||
      flags.default_enabled !== true || JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags) ||
      path !== expectedPath || !/^public\/assets\/brand\/honru\/context-reactions-v1\/contexts\/honru-context-[a-z0-9-]+-v1\.webp$/.test(path)) {
    runtimeAssetManifestPromise = null;
    return '';
  }
  return assetUrl(path.slice('public/assets/'.length));
}

function honruQuickVariantHash(value){
  const text = String(value || '');
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

async function resolveHonruQuickCell(quickId, eventId){
  const id = String(quickId || '');
  if (!HONRU_QUICK_ID_SET.has(id) || !honruQuickStickersEnabled()) return null;
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === HONRU_CONTEXT_REACTIONS_ASSET_ID)
    : null;
  const flags = item && item.feature_flags;
  const atlas = item && item.atlas;
  const groups = item && item.quick_groups;
  const expectedFlags = [HONRU_CONTEXT_REACTIONS_FLAG, HONRU_QUICK_STICKERS_FLAG];
  const path = String(item && item.quick_atlas || '');
  const expectedPath = 'public/assets/brand/honru/context-reactions-v1/honru-quick-atlas-v1.webp';
  const validGroups = groups && JSON.stringify(groups) === JSON.stringify(HONRU_QUICK_GROUPS);
  const variants = validGroups ? groups[id] : null;
  const index = variants && variants.length ? honruQuickVariantHash(id + '|' + String(eventId || id)) % variants.length : -1;
  const cellId = index >= 0 ? variants[index] : '';
  const cell = item && item.cells && item.cells[cellId];
  const validAtlas = atlas && atlas.width === 1024 && atlas.height === 1024 && atlas.columns === 4 && atlas.rows === 4 && atlas.cell === 256;
  const validCell = cell && cell.protocol_id === id && /^[A-C]$/.test(String(cell.variant || '')) &&
    [cell.x,cell.y,cell.w,cell.h].every(Number.isInteger) && cell.w === 256 && cell.h === 256 &&
    cell.x >= 0 && cell.y >= 0 && cell.x + cell.w <= 1024 && cell.y + cell.h <= 1024;
  if (!item || item.runtime_id !== 'honru' || item.status !== 'ready' ||
      item.clearance !== 'OWNER_AUTHORIZED_ART_CLEARANCE' || item.source_asset_id !== 'ART-HONRU-CONTEXT-REACTIONS-V1' ||
      item.artwork_version !== 1 || path !== expectedPath ||
      !flags || flags.operator !== 'all' || flags.enabled_value !== '1' || flags.default_enabled !== true ||
      JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags) || !validAtlas || !validGroups || !validCell) {
    runtimeAssetManifestPromise = null;
    return null;
  }
  return Object.freeze({
    id,
    cellId,
    variant:String(cell.variant),
    url:assetUrl(path.slice('public/assets/'.length)),
    x:cell.x,
    y:cell.y,
    width:cell.w,
    height:cell.h,
    atlasWidth:atlas.width,
    atlasHeight:atlas.height,
  });
}

async function resolveHonruEmojiCell(expressionId, forThrow){
  const id = String(expressionId || '');
  if (!HONRU_EMOJI_ID_SET.has(id) || !honruEmojiEnabled() || (forThrow && !honruEmojiThrowEnabled())) return null;
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === HONRU_EMOJI_ASSET_ID)
    : null;
  const flags = item && item.feature_flags;
  const atlas = item && item.atlas;
  const cell = item && item.cells && item.cells[id];
  const expectedFlags = [HONRU_EMOJI_MASTER_FLAG, HONRU_EMOJI_THROW_FLAG];
  const path = String(item && item.runtime_path || '');
  const expectedPath = 'public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp';
  const validAtlas = atlas && atlas.width === 1024 && atlas.height === 768 && atlas.columns === 4 && atlas.rows === 3 && atlas.cell === 256;
  const validCell = cell && [cell.x,cell.y,cell.w,cell.h].every(Number.isInteger) && cell.w === 256 && cell.h === 256 &&
    cell.x >= 0 && cell.y >= 0 && cell.x + cell.w <= 1024 && cell.y + cell.h <= 768;
  if (!item || item.runtime_id !== 'honru' || item.status !== 'ready' ||
      item.clearance !== 'OWNER_AUTHORIZED_ART_CLEARANCE' || path !== expectedPath ||
      !flags || flags.operator !== 'all' || flags.enabled_value !== '1' || flags.default_enabled !== true ||
      JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags) || !validAtlas || !validCell) {
    runtimeAssetManifestPromise = null;
    return null;
  }
  return Object.freeze({
    id,
    url:assetUrl(path.slice('public/assets/'.length)),
    x:cell.x,
    y:cell.y,
    width:cell.w,
    height:cell.h,
    atlasWidth:atlas.width,
    atlasHeight:atlas.height,
    fallback:String(item.fallback_glyphs && item.fallback_glyphs[id] || ''),
  });
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
  wrap.setAttribute('data-currency-asset', CURRENCY_ASSET_ID);
  const img = el('img', 'coin-asset');
  img.alt = '';
  const fallback = el('span', 'coin-fallback', CURRENCY);
  const fallbackUrl = assetUrl('currencyCash');
  let activeAsset = CURRENCY_ASSET_ID;
  img.addEventListener('error', () => {
    if (activeAsset === GCOINS_RUNTIME_ASSET_ID) {
      activeAsset = CURRENCY_ASSET_ID;
      wrap.setAttribute('data-currency-asset', CURRENCY_ASSET_ID);
      if ('srcset' in img) img.srcset = '';
      if ('sizes' in img) img.sizes = '';
      img.src = fallbackUrl;
      return;
    }
    img.style.display = 'none';
    wrap.classList.add('asset-failed');
  });
  img.addEventListener('load', () => {
    img.style.display = '';
    if (wrap.classList && typeof wrap.classList.remove === 'function') wrap.classList.remove('asset-failed');
  });
  img.src = fallbackUrl;
  wrap.appendChild(img);
  wrap.appendChild(fallback);
  if (gCoinsRuntimeEnabled()) {
    resolveGCoinsIconSet().then(runtime => {
      if (!runtime || activeAsset !== CURRENCY_ASSET_ID) return;
      activeAsset = GCOINS_RUNTIME_ASSET_ID;
      wrap.setAttribute('data-currency-asset', GCOINS_RUNTIME_ASSET_ID);
      const requestedSize = String(sizeClass || '') === 'sm' ? '44' : '64';
      img.srcset = Object.entries(runtime.variants).map(([size, url]) => url + ' ' + size + 'w').join(', ');
      img.sizes = requestedSize === '44' ? '14px' : '18px';
      img.src = runtime.variants[requestedSize] || runtime.primary;
    }).catch(() => {});
  }
  return wrap;
}

function progressionFeedbackNode(feedbackId,options){
  const settings=options&&typeof options==='object'?options:{};
  const id=PROGRESSION_FEEDBACK_ID_SET.has(String(feedbackId||''))?String(feedbackId):'reward';
  const size=PROGRESSION_FEEDBACK_SIZE_SET.has(String(settings.size||''))?String(settings.size):'160';
  const wrap=el('span','progression-feedback-art'+(settings.className?' '+settings.className:''));
  wrap.setAttribute('data-progression-feedback',id);
  wrap.setAttribute('aria-hidden','true');
  const img=el('img','progression-feedback-asset');img.alt='';img.decoding='async';img.style.display='none';
  const fallback=el('span','progression-feedback-fallback',PROGRESSION_FEEDBACK_FALLBACKS[id]||'✦');
  img.addEventListener('load',()=>{img.style.display='';fallback.style.display='none';wrap.classList.add('asset-ready');});
  img.addEventListener('error',()=>{img.style.display='none';fallback.style.display='';wrap.classList.add('asset-failed');});
  wrap.appendChild(img);wrap.appendChild(fallback);
  resolveProgressionFeedbackUrl(id,size).then(url=>{if(url)img.src=url;}).catch(()=>{});
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

function currencyAmountNode(value, options){
  const settings = options && typeof options === 'object' ? options : {};
  const suffix = ' ' + currencyName();
  const defaultFormatted=currencyAmountText(value,{signed:settings.signed === true});
  const requestedFormatted=settings.formattedText == null?'':String(settings.formattedText);
  const formatted=requestedFormatted.endsWith(suffix)?requestedFormatted:defaultFormatted;
  const visibleValue = formatted.endsWith(suffix) ? formatted.slice(0,-suffix.length) : formatted;
  const wrap = el('span','coin-line currency-amount' + (settings.className ? ' ' + settings.className : ''));
  wrap.setAttribute('role','img');
  wrap.setAttribute('aria-label',formatted);
  wrap.setAttribute('data-currency-amount','true');
  const icon = currencyIcon(settings.sizeClass);
  if(typeof icon.removeAttribute === 'function'){
    icon.removeAttribute('role');
    icon.removeAttribute('aria-label');
  }
  icon.setAttribute('aria-hidden','true');
  wrap.appendChild(icon);
  const valueNode=el('span','currency-amount-value' + (settings.valueClass ? ' ' + settings.valueClass : ''),visibleValue);
  valueNode.setAttribute('aria-hidden','true');
  wrap.appendChild(valueNode);
  return wrap;
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
