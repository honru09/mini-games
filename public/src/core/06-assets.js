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
  {id:32,name:'春日信号花园',theme:'seasonal-spring',season:'spring',seasonal:true,collectionId:'seasonal_spring_v1',tier:'premium-static',price:24,animated:false,poster:'backgrounds/seasonal-v1/spring/spring-poster-v1.webp',asset:'backgrounds/seasonal-v1/spring/spring-desktop-v1.webp',desktop:'backgrounds/seasonal-v1/spring/spring-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/spring/spring-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/spring/spring-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/spring/spring-desktop-v1.webp',overlay:'rgba(37,62,48,.26)',textTone:'dark'},
  {id:33,name:'春风巡游·动态',theme:'seasonal-spring',season:'spring',seasonal:true,collectionId:'seasonal_spring_v1',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/seasonal-v1/spring/spring-poster-v1.webp',asset:'backgrounds/seasonal-v1/spring/spring-animated-v1.webp',desktop:'backgrounds/seasonal-v1/spring/spring-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/spring/spring-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/spring/spring-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/spring/spring-desktop-v1.webp',overlay:'rgba(37,62,48,.26)',textTone:'dark'},
  {id:34,name:'云海游戏码头',theme:'seasonal-summer',season:'summer',seasonal:true,collectionId:'seasonal_summer_v1',tier:'premium-static',price:24,animated:false,poster:'backgrounds/seasonal-v1/summer/summer-poster-v1.webp',asset:'backgrounds/seasonal-v1/summer/summer-desktop-v1.webp',desktop:'backgrounds/seasonal-v1/summer/summer-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/summer/summer-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/summer/summer-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/summer/summer-desktop-v1.webp',overlay:'rgba(9,55,74,.30)',textTone:'light'},
  {id:35,name:'夏潮航行·动态',theme:'seasonal-summer',season:'summer',seasonal:true,collectionId:'seasonal_summer_v1',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/seasonal-v1/summer/summer-poster-v1.webp',asset:'backgrounds/seasonal-v1/summer/summer-animated-v1.webp',desktop:'backgrounds/seasonal-v1/summer/summer-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/summer/summer-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/summer/summer-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/summer/summer-desktop-v1.webp',overlay:'rgba(9,55,74,.30)',textTone:'light'},
  {id:36,name:'秋日收藏灯廊',theme:'seasonal-autumn',season:'autumn',seasonal:true,collectionId:'seasonal_autumn_v1',tier:'premium-static',price:24,animated:false,poster:'backgrounds/seasonal-v1/autumn/autumn-poster-v1.webp',asset:'backgrounds/seasonal-v1/autumn/autumn-desktop-v1.webp',desktop:'backgrounds/seasonal-v1/autumn/autumn-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/autumn/autumn-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/autumn/autumn-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/autumn/autumn-desktop-v1.webp',overlay:'rgba(55,34,24,.30)',textTone:'light'},
  {id:37,name:'金叶轨道·动态',theme:'seasonal-autumn',season:'autumn',seasonal:true,collectionId:'seasonal_autumn_v1',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/seasonal-v1/autumn/autumn-poster-v1.webp',asset:'backgrounds/seasonal-v1/autumn/autumn-animated-v1.webp',desktop:'backgrounds/seasonal-v1/autumn/autumn-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/autumn/autumn-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/autumn/autumn-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/autumn/autumn-desktop-v1.webp',overlay:'rgba(55,34,24,.30)',textTone:'light'},
  {id:38,name:'星雪信号台',theme:'seasonal-winter',season:'winter',seasonal:true,collectionId:'seasonal_winter_v1',tier:'premium-static',price:24,animated:false,poster:'backgrounds/seasonal-v1/winter/winter-poster-v1.webp',asset:'backgrounds/seasonal-v1/winter/winter-desktop-v1.webp',desktop:'backgrounds/seasonal-v1/winter/winter-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/winter/winter-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/winter/winter-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/winter/winter-desktop-v1.webp',overlay:'rgba(7,13,35,.34)',textTone:'light'},
  {id:39,name:'冬夜观测·动态',theme:'seasonal-winter',season:'winter',seasonal:true,collectionId:'seasonal_winter_v1',tier:'premium-animated',price:32,animated:true,poster:'backgrounds/seasonal-v1/winter/winter-poster-v1.webp',asset:'backgrounds/seasonal-v1/winter/winter-animated-v1.webp',desktop:'backgrounds/seasonal-v1/winter/winter-desktop-v1.webp',mobileCrop:'backgrounds/seasonal-v1/winter/winter-mobile-v1.webp',miniCrop:'backgrounds/seasonal-v1/winter/winter-mini-v1.webp',staticFallback:'backgrounds/seasonal-v1/winter/winter-desktop-v1.webp',overlay:'rgba(7,13,35,.34)',textTone:'light'},
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
const HONRU_SEASONAL_ASSET_ID = 'P-HONRU-SEASONAL-V1';
const HONRU_SEASONAL_SOURCE_ID = 'ART-HONRU-SEASONAL-V1';
const HONRU_SEASONAL_FLAG = 'mg_art_honru_seasonal_v1';
const HONRU_SEASONAL_ACTIVE_EDITION = 'summer-cloud';
const HONRU_SEASONAL_ROLES = Object.freeze(['hero-320','reaction-160','mini-96','celebration-320']);
const HONRU_SEASONAL_ROLE_SET = new Set(HONRU_SEASONAL_ROLES);
const HONRU_STICKER_BOOK_ASSET_ID = 'P-COLLECTIBLE-STICKER-BOOK-V1';
const HONRU_STICKER_BOOK_SOURCE_ID = 'ART-HONRU-STICKER-BOOK-V1';
const HONRU_STICKER_BOOK_FLAG = 'mg_art_sticker_book_v1';
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
const PERSONAL_HOME_SCENE_FLAG = 'mg_art_personal_home_scene_v1';
const PERSONAL_HOME_SCENE_ASSET_ID = 'P-PERSONAL-HOME-SCENE-V1';
const PERSONAL_HOME_SCENE_SOURCE_ID = 'ART-PERSONAL-HOME-SCENE-V1';
const PERSONAL_HOME_SCENE_CLEARANCE_RECORD = 'art-source/platform/personal-home-scene-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const PROFILE_ADAPTIVE_HERO_FLAG = 'mg_art_profile_adaptive_hero_v1';
const PROFILE_ADAPTIVE_HERO_ASSET_ID = 'P-PROFILE-ADAPTIVE-HERO-V1';
const PROFILE_ADAPTIVE_HERO_SOURCE_ID = 'ART-PROFILE-ADAPTIVE-HERO-V1';
const PROFILE_ADAPTIVE_HERO_CLEARANCE_RECORD = 'art-source/platform/profile-adaptive-hero-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
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
const MONOPOLY_FINAL_ART_FLAG = 'mg_art_monopoly_final_v1';
const MONOPOLY_FINAL_ART_ASSET_ID = 'G-15-MONOPOLY-FINAL-ART-V1';
const MONOPOLY_FINAL_ART_SOURCE_ID = 'ART-036-MONOPOLY-FINAL-ART-V1';
const MONOPOLY_FINAL_ART_CLEARANCE_RECORD = 'art-source/games/monopoly/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const MONOPOLY_FINAL_ART_BOARDS = Object.freeze(['background','midground','foreground']);
const MONOPOLY_FINAL_ART_OBJECTS = Object.freeze(['townhouse','hall','market','tower','gate','chance-card','key-token','coin','bell']);
const MONOPOLY_FINAL_ART_VFX = Object.freeze(['landing','opportunity','auction','purchase','payment','tax','bankruptcy','turn-result','final-result']);
const MONOPOLY_FINAL_ART_CAMERAS = Object.freeze(['desktop','mobile']);
const MONOPOLY_FINAL_ART_ROLE_SET = new Set([
  ...MONOPOLY_FINAL_ART_BOARDS.map(id => 'board-' + id),
  ...MONOPOLY_FINAL_ART_OBJECTS.map(id => 'object-' + id),
  ...MONOPOLY_FINAL_ART_VFX.map(id => 'vfx-' + id),
  ...MONOPOLY_FINAL_ART_CAMERAS.map(id => 'camera-' + id),
]);
const TANK_FINAL_ART_FLAG = 'mg_art_tank_final_v1';
const TANK_FINAL_ART_ASSET_ID = 'G-12-TANK-FINAL-ART-V1';
const TANK_FINAL_ART_SOURCE_ID = 'ART-035-TANK-FINAL-ART-V1';
const TANK_FINAL_ART_CLEARANCE_RECORD = 'art-source/games/tank/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const TANK_FINAL_ART_BOARDS = Object.freeze(['background','midground','foreground']);
const TANK_FINAL_ART_OBJECTS = Object.freeze(['tank-classic','tank-teal','tank-coral','tank-blue','wall-brick','wall-steel','cover','base-pad','projectile','muzzle','contact-shadow','shield']);
const TANK_FINAL_ART_VFX = Object.freeze(['muzzle','projectile','ricochet','hit','explosion','destruction','shield','terminal']);
const TANK_FINAL_ART_CAMERAS = Object.freeze(['desktop','mobile']);
const TANK_FINAL_ART_ROLE_SET = new Set([
  ...TANK_FINAL_ART_BOARDS.map(id => 'board-' + id),
  ...TANK_FINAL_ART_OBJECTS.map(id => 'object-' + id),
  ...TANK_FINAL_ART_VFX.map(id => 'vfx-' + id),
  ...TANK_FINAL_ART_CAMERAS.map(id => 'camera-' + id),
]);
const TETRIS_FINAL_ART_FLAG = 'mg_art_tetris_final_v1';
const TETRIS_FINAL_ART_ASSET_ID = 'G-11-TETRIS-FINAL-ART-V1';
const TETRIS_FINAL_ART_SOURCE_ID = 'ART-037-TETRIS-FINAL-ART-V1';
const TETRIS_FINAL_ART_CLEARANCE_RECORD = 'art-source/games/tetris/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const TETRIS_FINAL_ART_BOARDS = Object.freeze(['background','midground','foreground']);
const TETRIS_FINAL_ART_OBJECTS = Object.freeze(['block-i','block-o','block-t','block-s','block-z','block-j','block-l','block-ghost','block-garbage','well-frame','next-frame','hold-frame']);
const TETRIS_FINAL_ART_VFX = Object.freeze(['line-clear','hard-drop','t-spin','b2b','combo','perfect-clear','incoming-garbage','ko']);
const TETRIS_FINAL_ART_CAMERAS = Object.freeze(['desktop','mobile']);
const TETRIS_FINAL_ART_ROLE_SET = new Set([
  ...TETRIS_FINAL_ART_BOARDS.map(id => 'board-' + id),
  ...TETRIS_FINAL_ART_OBJECTS.map(id => 'object-' + id),
  ...TETRIS_FINAL_ART_VFX.map(id => 'vfx-' + id),
  ...TETRIS_FINAL_ART_CAMERAS.map(id => 'camera-' + id),
]);
let tetrisFinalArtManifestPromise = null;
const XIANGQI_FINAL_ART_FLAG = 'mg_art_xiangqi_final_v1';
const XIANGQI_FINAL_ART_ASSET_ID = 'G-16-XIANGQI-FINAL-ART-V1';
const XIANGQI_FINAL_ART_SOURCE_ID = 'ART-040-XIANGQI-FINAL-ART-V1';
const XIANGQI_FINAL_ART_CLEARANCE_RECORD = 'art-source/games/xiangqi/final-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const XIANGQI_FINAL_ART_BOARDS = Object.freeze(['background','midground','foreground']);
const XIANGQI_FINAL_ART_PIECES = Object.freeze([
  'red-general','red-advisor','red-elephant','red-horse','red-chariot','red-cannon','red-soldier',
  'black-general','black-advisor','black-elephant','black-horse','black-chariot','black-cannon','black-soldier'
]);
const XIANGQI_FINAL_ART_VFX = Object.freeze(['piece-land','check-alert','checkmate-burst','selected','capture','clock-warning']);
const XIANGQI_FINAL_ART_CAMERAS = Object.freeze(['desktop','mobile']);
const XIANGQI_FINAL_ART_ROLE_SET = new Set([
  ...XIANGQI_FINAL_ART_BOARDS.map(id => 'board-' + id),
  ...XIANGQI_FINAL_ART_PIECES.map(id => 'piece-' + id),
  ...XIANGQI_FINAL_ART_VFX.map(id => 'vfx-' + id),
  ...XIANGQI_FINAL_ART_CAMERAS.map(id => 'camera-' + id),
]);
let xiangqiFinalArtManifestPromise = null;
const SHOP_COMPLETE_ART_FLAG = 'mg_art_shop_complete_v1';
const SHOP_COMPLETE_ART_ASSET_ID = 'P-SHOP-COMPLETE-ART-V1';
const SHOP_COMPLETE_ART_SOURCE_ID = 'ART-041-SHOP-COMPLETE-ART-V1';
const SHOP_COMPLETE_ART_CLEARANCE_RECORD = 'art-source/platform/shop/complete-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const SHOP_COMPLETE_ART_RARITIES = Object.freeze(['common','rare','epic','legendary','mythic']);
const SHOP_COMPLETE_ART_PEDESTALS = Object.freeze(['common','rare','epic','legendary','mythic']);
const SHOP_COMPLETE_ART_CATEGORIES = Object.freeze(['avatars','frames','effects','backgrounds','skins','specials']);
const SHOP_COMPLETE_ART_VFX = Object.freeze(['purchase-burst','unlock-ray','coin-deduct','equipped-badge','rarity-glow','discount-tag']);
const SHOP_COMPLETE_ART_CAMERAS = Object.freeze(['desktop','mobile']);
const SHOP_COMPLETE_ART_ROLE_SET = new Set([
  ...SHOP_COMPLETE_ART_RARITIES.map(id => 'rarity-frame-' + id),
  ...SHOP_COMPLETE_ART_PEDESTALS.map(id => 'pedestal-' + id),
  ...SHOP_COMPLETE_ART_CATEGORIES.map(id => 'category-' + id),
  ...SHOP_COMPLETE_ART_VFX.map(id => 'vfx-' + id),
  ...SHOP_COMPLETE_ART_CAMERAS.map(id => 'camera-' + id),
]);
let shopCompleteArtManifestPromise = null;
const COMMUNITY_REPLAY_TOURNAMENT_CARDS_FLAG = 'mg_art_community_replay_tournament_cards_v1';
const COMMUNITY_REPLAY_TOURNAMENT_CARDS_ASSET_ID = 'P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1';
const COMMUNITY_REPLAY_TOURNAMENT_CARDS_SOURCE_ID = 'ART-042-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1';
const COMMUNITY_REPLAY_TOURNAMENT_CARDS_CLEARANCE_RECORD = 'art-source/platform/community-replay-tournament-cards-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const COMMUNITY_REPLAY_TOURNAMENT_CARD_ROLES = Object.freeze(['card-playline','card-replay','card-tournament','card-result','card-record','frame-og']);
const COMMUNITY_REPLAY_TOURNAMENT_MARK_ROLES = Object.freeze(['mark-playline','mark-replay','mark-tournament','mark-share']);
const COMMUNITY_REPLAY_TOURNAMENT_CAMERA_ROLES = Object.freeze(['camera-desktop','camera-mobile']);
const COMMUNITY_REPLAY_TOURNAMENT_ROLE_SET = new Set([
  ...COMMUNITY_REPLAY_TOURNAMENT_CARD_ROLES,
  ...COMMUNITY_REPLAY_TOURNAMENT_MARK_ROLES,
  ...COMMUNITY_REPLAY_TOURNAMENT_CAMERA_ROLES,
]);
let communityReplayTournamentCardsManifestPromise = null;
const AI_DIFFICULTY_VISUAL_FLAG = 'mg_art_ai_difficulty_visual_v1';
const AI_DIFFICULTY_VISUAL_ASSET_ID = 'P-AI-DIFFICULTY-VISUAL-V1';
const AI_DIFFICULTY_VISUAL_SOURCE_ID = 'ART-043-AI-DIFFICULTY-VISUAL-V1';
const AI_DIFFICULTY_VISUAL_CLEARANCE_RECORD = 'art-source/platform/ai-difficulty/visual-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const AI_DIFFICULTY_VISUAL_LEVELS = Object.freeze(['easy','normal','hard']);
const AI_DIFFICULTY_VISUAL_ROLE_SET = new Set([
  ...AI_DIFFICULTY_VISUAL_LEVELS.map(id => 'card-' + id),
  ...AI_DIFFICULTY_VISUAL_LEVELS.map(id => 'seat-' + id),
  ...AI_DIFFICULTY_VISUAL_LEVELS.map(id => 'mark-' + id),
  'vfx-thinking','vfx-decided','camera-desktop','camera-mobile',
]);
let aiDifficultyVisualManifestPromise = null;
const HONRU_EDGE_CURSOR_FLAG = 'mg_art_honru_edge_cursor_v1';
const HONRU_EDGE_CURSOR_ASSET_ID = 'P-HONRU-EDGE-CURSOR-V1';
const HONRU_EDGE_CURSOR_SOURCE_ID = 'ART-HONRU-EDGE-CURSOR-V1';
const HONRU_EDGE_CURSOR_CLEARANCE_RECORD = 'art-source/platform/honru-edge-cursor/visual-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const HONRU_EDGE_CURSOR_EDGE_ROLES = Object.freeze(['edge-games-peek','edge-playline-wave','edge-profile-grab']);
const HONRU_EDGE_CURSOR_STATES = Object.freeze(['cursor-idle','cursor-pressed','cursor-scroll-up','cursor-scroll-down','cursor-scroll-left','cursor-scroll-right']);
const HONRU_EDGE_CURSOR_ROLE_SET = new Set([
  ...HONRU_EDGE_CURSOR_EDGE_ROLES.flatMap(role => [role, role + '-static']),
  ...HONRU_EDGE_CURSOR_STATES.flatMap(role => ['32','64'].map(size => role + '-' + size)),
]);
const IDENTITY_BADGE_SYSTEM_FLAG = 'mg_art_identity_badge_system_v1';
const SEASONAL_BACKGROUNDS_FLAG = 'mg_art_seasonal_backgrounds_v1';
const AUDIO_SPECTRUM_ART_FLAG = 'mg_art_audio_spectrum_v1';
const SOCIAL_SHARE_TEMPLATES_FLAG = 'mg_art_social_share_templates_v1';
const TOURNAMENT_BROADCAST_OVERLAY_FLAG = 'mg_art_tournament_broadcast_overlay_v1';
const SHOP_LIMITED_SETS_FLAG = 'mg_art_shop_limited_sets_v1';
const SHOP_LIMITED_SETS_ASSET_ID = 'P-SHOP-LIMITED-SETS-V1';
const SHOP_LIMITED_SETS_SOURCE_ID = 'ART-SHOP-LIMITED-SETS-V1';
const SHOP_LIMITED_SETS_CLEARANCE_RECORD = 'art-source/platform/shop/limited-sets-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const SHOP_LIMITED_SETS_ROLES = Object.freeze(['desktop','mobile','poster']);
const SHOP_LIMITED_SETS_ROLE_SET = new Set(SHOP_LIMITED_SETS_ROLES);
let shopLimitedSetsManifestPromise = null;
const IDENTITY_BADGE_SYSTEM_ASSET_ID = 'P-IDENTITY-BADGE-SYSTEM-V1';
const IDENTITY_BADGE_SYSTEM_SOURCE_ID = 'ART-IDENTITY-BADGE-SYSTEM-V1';
const IDENTITY_BADGE_SYSTEM_CLEARANCE_RECORD = 'art-source/platform/identity/badge-system-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const IDENTITY_BADGE_GROUPS = Object.freeze({
  rank:Object.freeze(['1','2','3','standard']),
  achievement:Object.freeze(['first-win','win-10','win-50','streak-3','streak-5','level-5','all-games','social']),
  mastery:Object.freeze(['1','10','50','100','1000']),
  rarity:Object.freeze(['starter','uncommon','rare','epic']),
  title:Object.freeze(['1','2','3','4','5']),
  tournament:Object.freeze(['participant','contender','finalist','champion']),
  task:Object.freeze(['play-1','play-3','win-1','streak-2']),
});
const IDENTITY_BADGE_SIZES = Object.freeze(['32','48','64']);
const IDENTITY_BADGE_FALLBACKS = Object.freeze({
  rank:Object.freeze({'1':'♛','2':'◆','3':'◇',standard:'·'}),
  achievement:Object.freeze({'first-win':'🥇','win-10':'◆','win-50':'🏆','streak-3':'🔥','streak-5':'⚡','level-5':'↑','all-games':'✦',social:'◇'}),
  mastery:Object.freeze({'1':'◇','10':'◆','50':'✦','100':'✪','1000':'♛'}),
  rarity:Object.freeze({starter:'○',uncommon:'◇',rare:'✦',epic:'♛'}),
  title:Object.freeze({'1':'◇','2':'⚔','3':'◆','4':'♟','5':'♛'}),
  tournament:Object.freeze({participant:'⚑',contender:'◇',finalist:'✦',champion:'🏆'}),
  task:Object.freeze({'play-1':'🎮','play-3':'🎮','win-1':'⚑','streak-2':'🔥'}),
});
const PROGRESSION_FEEDBACK_ART_FLAG = 'mg_art_progression_feedback_v1';
const PROGRESSION_FEEDBACK_ART_ASSET_ID = 'P-PROGRESSION-FEEDBACK-ART-V1';
const PROGRESSION_FEEDBACK_ART_SOURCE_ID = 'ART-PROGRESSION-FEEDBACK-ART-V1';
const PROGRESSION_FEEDBACK_ART_CLEARANCE_RECORD = 'art-source/platform/progression/feedback-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const PROGRESSION_FEEDBACK_IDS = Object.freeze(['reward','gcoins','xp','level-up','task','achievement','win-streak','collection','unlock']);
const PROGRESSION_FEEDBACK_ID_SET = new Set(PROGRESSION_FEEDBACK_IDS);
const PROGRESSION_FEEDBACK_SIZES = Object.freeze(['96','160','256']);
const PROGRESSION_FEEDBACK_SIZE_SET = new Set(PROGRESSION_FEEDBACK_SIZES);
const PLAYER_CHARACTER_LAYERED_FLAG = 'mg_art_player_character_layered_v1';
const PLAYER_CHARACTER_LAYERED_ASSET_ID = 'P-PLAYER-CHARACTER-LAYERED-V1';
const PLAYER_CHARACTER_LAYERED_SOURCE_ID = 'ART-PLAYER-CHARACTER-LAYERED-V1';
const PLAYER_CHARACTER_LAYERED_CLEARANCE_RECORD = 'art-source/player-character/layered-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const PLAYER_CHARACTER_LAYERED_SLOTS = Object.freeze(['body','face','hair','top','bottom','footwear','accessory']);
const PLAYER_CHARACTER_LAYERED_SLOT_ORDER = Object.freeze(['body','bottom','footwear','top','face','hair','accessory']);
const PLAYER_CHARACTER_LAYERED_SLOT_CATALOG = Object.freeze({
  body:Object.freeze(['body-paper-01','body-dusk-01','body-moon-01','body-mist-01']),
  face:Object.freeze(['face-dot-01','face-bright-01','face-focus-01','face-joy-01','face-curious-01','face-calm-01']),
  hair:Object.freeze(['hair-none','hair-short-ink-01','hair-curl-ink-01','hair-bob-ink-01','hair-cloud-cream-01','hair-comet-teal-01','hair-sweep-violet-01','hair-tuft-coral-01']),
  top:Object.freeze(['top-hoodie-01','top-crew-ink-01','top-varsity-teal-01','top-sailor-blue-01','top-patch-coral-01','top-knit-gold-01','top-jacket-violet-01','top-tunic-mint-01','top-apron-cream-01','top-cosmic-dark-01']),
  bottom:Object.freeze(['bottom-shorts-01','bottom-trousers-01','bottom-skirt-01','bottom-joggers-01','bottom-cargo-01','bottom-overalls-01']),
  footwear:Object.freeze(['footwear-sneakers-01','footwear-boots-01','footwear-slipons-01','footwear-hightop-01','footwear-moon-01','footwear-teal-01']),
  accessory:Object.freeze(['accessory-none','accessory-round-glasses-01','accessory-square-glasses-01','accessory-scarf-teal-01','accessory-scarf-coral-01','accessory-headset-01','accessory-cap-01','accessory-star-pin-01','accessory-moon-pin-01','accessory-satchel-01','accessory-paper-halo-01','accessory-ghost-puff-01']),
});
const PLAYER_CHARACTER_LAYERED_DEFAULTS = Object.freeze({body:'body-paper-01',face:'face-dot-01',hair:'hair-short-ink-01',top:'top-hoodie-01',bottom:'bottom-shorts-01',footwear:'footwear-sneakers-01',accessory:'accessory-none'});
const PLAYER_CHARACTER_LAYERED_SIZE_SET = new Set(['128','256']);
const PLAYER_CHARACTER_LAYERED_POSES = Object.freeze(['idle-front','walk-contact-a','walk-passing-b','focus-tabletop','friendly-wave','victory-compact']);
const PLAYER_CHARACTER_LAYERED_POSE_SET = new Set(PLAYER_CHARACTER_LAYERED_POSES);
const PLAYER_CHARACTER_LAYERED_ACTIONS = Object.freeze({idle:Object.freeze(['idle-front']),walk:Object.freeze(['walk-contact-a','walk-passing-b']),celebrate:Object.freeze(['friendly-wave','victory-compact'])});
const AVATAR_FRAME_EFFECT_FLAG = 'mg_art_avatar_frame_effect_v1';
const AVATAR_FRAME_EFFECT_ASSET_ID = 'P-AVATAR-FRAME-EFFECT-V1';
const AVATAR_FRAME_EFFECT_SOURCE_ID = 'ART-020-AVATAR-FRAME-EFFECT-V1';
const AVATAR_FRAME_EFFECT_CLEARANCE_RECORD = 'art-source/platform/identity/avatar-frame-effect-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const AVATAR_FRAME_EFFECT_SIZES = Object.freeze(['44','64','96','192']);
const AVATAR_FRAME_EFFECT_SIZE_SET = new Set(AVATAR_FRAME_EFFECT_SIZES);
const AVATAR_FRAME_EFFECT_MODES = Object.freeze(['static','dynamic','high-contrast']);
const AVATAR_FRAME_EFFECT_MODE_SET = new Set(AVATAR_FRAME_EFFECT_MODES);
const AVATAR_FRAME_EFFECT_IDS = Object.freeze([1,2,3,4,5,6,7,8]);
const AVATAR_FRAME_EFFECT_ID_SET = new Set(AVATAR_FRAME_EFFECT_IDS);
const GAME_ICON_SYSTEM_FLAG = 'mg_art_game_icon_system_v2';
const GAME_ICON_SYSTEM_ASSET_ID = 'P-GAME-ICON-SYSTEM-V2';
const GAME_ICON_SYSTEM_SOURCE_ID = 'ART-027-GAME-ICON-SYSTEM-V2';
const GAME_ICON_SYSTEM_CLEARANCE_RECORD = 'art-source/platform/game-icons/cartoon-v2/OWNER_AUTHORIZED_ART_CLEARANCE.md';
const GAME_ICON_SYSTEM_GAMES = Object.freeze(['gomoku','ludo','monopoly','tank','tetris','xiangqi']);
const GAME_ICON_SYSTEM_ROLES = Object.freeze(['icon','cover-crop','theme-icon','selected-object']);
const GAME_ICON_SYSTEM_ROLE_SET = new Set(GAME_ICON_SYSTEM_ROLES);
const GAME_ICON_SYSTEM_ICON_SIZES = Object.freeze(['44','64','96']);
const GAME_ICON_SYSTEM_MARKER_SIZES = Object.freeze(['24','32','44']);
const GAME_ICON_SYSTEM_MARKERS = Object.freeze(['ai','solo','online','multiplayer','card','ready','waiting','live','ranking','room','locked','error']);
const GAME_ICON_SYSTEM_MARKER_SET = new Set(GAME_ICON_SYSTEM_MARKERS);
let gameIconSystemManifestPromise = null;
const PROGRESSION_FEEDBACK_FALLBACKS = Object.freeze({
  reward:'✦',gcoins:CURRENCY,xp:'XP','level-up':'↑',task:'✓',achievement:'◇','win-streak':'♨',collection:'□',unlock:'⌁',
});
// P0-10 is a presentation-only, manifest-backed family. The resolver is lazy
// and fail-closed; existing deterministic character/token fallbacks remain the
// visible default when storage, fetch, or decode fails.
let runtimeAssetManifestPromise = null;
let playerCharacterManifestPromise = null;
let stickerArtManifestPromise = null;
let authArtManifestPromise = null;
let platformSceneManifestPromise = null;
let gameStageArtManifestPromise = null;
let modalArtManifestPromise = null;
let loadingArtManifestPromise = null;
let gomokuFinalArtManifestPromise = null;
let ludoFinalArtManifestPromise = null;
let monopolyFinalArtManifestPromise = null;
let tankFinalArtManifestPromise = null;
let avatarFrameEffectManifestPromise = null;

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

function renderHomeGameIconStrip(){
  const strip=typeof document!=='undefined'?document.querySelector('.home-mini-games'):null;
  if(!strip)return false;
  strip.innerHTML='';
  GAME_ICON_SYSTEM_GAMES.forEach(id=>strip.appendChild(gameIconNode(id,{role:'icon',size:44,className:'home-mini-game-icon',loading:'eager'})));
  return true;
}

function gameTitleNode(gameId){
  const id=String(gameId||'').toLowerCase(),meta=typeof GAMES!=='undefined'&&GAMES[id];
  const wrap=el('span','game-title-content');
  wrap.dataset.gameId=id;
  if(meta)wrap.appendChild(gameIconNode(id,{role:'theme-icon',size:44,className:'game-title-icon',loading:'eager'}));
  wrap.appendChild(el('span','game-title-label',meta?(meta.name||t(meta.nameKey)):id));
  return wrap;
}

function renderGameTitle(gameId){
  const target=typeof $==='function'?$('game-title'):null;
  if(!target)return false;
  const id=String(gameId||'').toLowerCase(),meta=typeof GAMES!=='undefined'&&GAMES[id];
  const existing=target.querySelector&&target.querySelector('.game-title-content');
  if(existing&&existing.dataset&&existing.dataset.gameId===id){
    const label=existing.querySelector&&existing.querySelector('.game-title-label');
    if(label)label.textContent=meta?(meta.name||t(meta.nameKey)):id;
    return true;
  }
  target.innerHTML='';target.appendChild(gameTitleNode(id));
  return true;
}

function initStaticPlatformIcons(){
  setButtonIcon($('btn-settings-page'),'settings','',{ariaLabel:t('settings'),title:t('settings')});
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
  renderHomeGameIconStrip();
  if(onlineMode){const marker=gameSystemMarkerNode('online',{size:24,className:'mode-system-marker'});onlineMode.insertBefore(marker,onlineMode.firstChild);}
  if(aiMode){const marker=gameSystemMarkerNode('ai',{size:24,className:'mode-system-marker'});aiMode.insertBefore(marker,aiMode.firstChild);}
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

function gameIconSystemEnabled(){
  return ownerClearedDefaultOnFlagEnabled(GAME_ICON_SYSTEM_FLAG);
}

function gameIconSystemSize(role, size){
  if(role==='cover-crop') return '320x180';
  if(role==='theme-icon') return '64';
  if(role==='selected-object') return '96';
  const px=Math.max(44,Math.min(96,Number(size)||64));
  return GAME_ICON_SYSTEM_ICON_SIZES.find(value=>Number(value)>=px)||'96';
}

function gameIconSystemMarkerSize(size){
  const px=Math.max(24,Math.min(44,Number(size)||32));
  return GAME_ICON_SYSTEM_MARKER_SIZES.find(value=>Number(value)>=px)||'44';
}

function gameIconSystemVariantSpec(key){
  const value=String(key||'');
  let match=/^game-(gomoku|ludo|monopoly|tank|tetris|xiangqi)-(icon-(44|64|96)|theme-icon-64|selected-object-96|cover-crop-320x180)$/.exec(value);
  if(match){
    const id=match[1],variant=match[2];
    if(!GAME_ICON_SYSTEM_GAMES.includes(id))return null;
    return {
      expected:`public/assets/ui/game-icons/v2/games/${id}/${variant}-v2.webp`,
      pattern:/^public\/assets\/ui\/game-icons\/v2\/games\/(?:gomoku|ludo|monopoly|tank|tetris|xiangqi)\/(?:icon-(?:44|64|96)|theme-icon-64|selected-object-96|cover-crop-320x180)-v2\.webp$/,
    };
  }
  match=/^marker-([a-z0-9-]+)-(24|32|44)$/.exec(value);
  if(!match||!GAME_ICON_SYSTEM_MARKER_SET.has(match[1]))return null;
  return {
    expected:`public/assets/ui/game-icons/v2/markers/${match[1]}-${match[2]}-v2.webp`,
    pattern:/^public\/assets\/ui\/game-icons\/v2\/markers\/(?:ai|solo|online|multiplayer|card|ready|waiting|live|ranking|room|locked|error)-(?:24|32|44)-v2\.webp$/,
  };
}

function gameIconSystemManifestItem(manifest){
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===GAME_ICON_SYSTEM_ASSET_ID):null;
  const flags=item&&item.feature_flags;
  const variants=item&&item.variants&&typeof item.variants==='object'&&!Array.isArray(item.variants)?item.variants:null;
  const expected=[];
  GAME_ICON_SYSTEM_GAMES.forEach(id=>{
    GAME_ICON_SYSTEM_ICON_SIZES.forEach(size=>expected.push(`game-${id}-icon-${size}`));
    expected.push(`game-${id}-theme-icon-64`,`game-${id}-selected-object-96`,`game-${id}-cover-crop-320x180`);
  });
  GAME_ICON_SYSTEM_MARKERS.forEach(id=>GAME_ICON_SYSTEM_MARKER_SIZES.forEach(size=>expected.push(`marker-${id}-${size}`)));
  const validVariants=!!variants&&Object.keys(variants).length===expected.length&&expected.every(key=>{
    const spec=gameIconSystemVariantSpec(key),value=String(variants[key]||'');
    return !!spec&&value===spec.expected&&spec.pattern.test(value);
  });
  const valid=!!(item&&item.runtime_id==='game-icon-system'&&item.status==='ready'&&item.clearance==='OWNER_AUTHORIZED_ART_CLEARANCE'&&item.artwork_version===2&&
    item.source_asset_id===GAME_ICON_SYSTEM_SOURCE_ID&&item.clearance_record===GAME_ICON_SYSTEM_CLEARANCE_RECORD&&flags&&flags.operator==='all'&&flags.enabled_value==='1'&&flags.default_enabled===true&&
    JSON.stringify(flags.ids)===JSON.stringify([GAME_ICON_SYSTEM_FLAG])&&JSON.stringify(item.game_ids)===JSON.stringify(GAME_ICON_SYSTEM_GAMES)&&JSON.stringify(item.game_roles)===JSON.stringify(GAME_ICON_SYSTEM_ROLES)&&
    JSON.stringify(item.icon_sizes)===JSON.stringify(GAME_ICON_SYSTEM_ICON_SIZES.map(Number))&&JSON.stringify(item.marker_ids)===JSON.stringify(GAME_ICON_SYSTEM_MARKERS)&&
    JSON.stringify(item.marker_sizes)===JSON.stringify(GAME_ICON_SYSTEM_MARKER_SIZES.map(Number))&&
    item.runtime_path==='public/assets/ui/game-icons/v2/games/gomoku/icon-64-v2.webp'&&validVariants);
  return valid?item:null;
}

function loadGameIconSystemManifest(){
  if(!gameIconSystemManifestPromise){
    gameIconSystemManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const request=gameIconSystemManifestPromise;
  request.then(manifest=>{if(!manifest&&gameIconSystemManifestPromise===request)gameIconSystemManifestPromise=null;});
  return request;
}

function gameIconSystemVariantKey(gameId,role,size){
  const id=String(gameId||'').toLowerCase();
  if(!GAME_ICON_SYSTEM_GAMES.includes(id)||!GAME_ICON_SYSTEM_ROLE_SET.has(role))return '';
  if(role==='icon')return `game-${id}-icon-${gameIconSystemSize(role,size)}`;
  if(role==='cover-crop')return `game-${id}-cover-crop-320x180`;
  if(role==='theme-icon')return `game-${id}-theme-icon-64`;
  return `game-${id}-selected-object-96`;
}

async function resolveGameIconVariantUrl(gameId,role,size){
  const safeRole=String(role||'icon'),key=gameIconSystemVariantKey(gameId,safeRole,size);
  if(!key||!gameIconSystemEnabled())return '';
  const request=loadGameIconSystemManifest(),manifest=await request,item=gameIconSystemManifestItem(manifest);
  const pathValue=String(item&&item.variants&&item.variants[key]||''),spec=gameIconSystemVariantSpec(key);
  if(!gameIconSystemEnabled())return '';
  if(!item||!spec||pathValue!==spec.expected||!spec.pattern.test(pathValue)){
    if(gameIconSystemManifestPromise===request)gameIconSystemManifestPromise=null;
    return '';
  }
  return assetUrl(pathValue.slice('public/assets/'.length));
}

function gameSystemMarkerVariantKey(markerId,size){
  const id=String(markerId||'').toLowerCase();
  if(!GAME_ICON_SYSTEM_MARKER_SET.has(id))return '';
  return `marker-${id}-${gameIconSystemMarkerSize(size)}`;
}

async function resolveGameSystemMarkerUrl(markerId,size){
  const key=gameSystemMarkerVariantKey(markerId,size);
  if(!key||!gameIconSystemEnabled())return '';
  const request=loadGameIconSystemManifest(),manifest=await request,item=gameIconSystemManifestItem(manifest),pathValue=String(item&&item.variants&&item.variants[key]||''),spec=gameIconSystemVariantSpec(key);
  if(!gameIconSystemEnabled())return '';
  if(!item||!spec||pathValue!==spec.expected||!spec.pattern.test(pathValue)){
    if(gameIconSystemManifestPromise===request)gameIconSystemManifestPromise=null;
    return '';
  }
  return assetUrl(pathValue.slice('public/assets/'.length));
}

function gameIconNode(gameId,options){
  const settings=options&&typeof options==='object'?options:{},id=String(gameId||'').toLowerCase(),role=GAME_ICON_SYSTEM_ROLE_SET.has(String(settings.role||''))?String(settings.role):'icon';
  const requestedSize=role==='cover-crop'?'320x180':gameIconSystemSize(role,settings.size),wrap=el('span','game-icon-asset game-icon-role-'+role+(settings.className?' '+settings.className:''));
  wrap.setAttribute('aria-hidden','true');wrap.dataset.gameId=id;wrap.dataset.gameIconRole=role;wrap.dataset.gameIconState='loading';
  const gameMeta=typeof GAMES!=='undefined'&&GAMES[id],fallback=el('span','game-icon-fallback',settings.fallback!==undefined?settings.fallback:(gameMeta&&gameMeta.icon)||'🎮');fallback.setAttribute('aria-hidden','true');
  const img=document.createElement('img');img.className='game-icon-asset-image';img.alt='';img.decoding='async';img.loading=settings.loading||'lazy';if(settings.width)img.width=Number(settings.width);if(settings.height)img.height=Number(settings.height);wrap.appendChild(fallback);wrap.appendChild(img);
  let legacyAttempted=false,requestGeneration=0;
  const showFallback=()=>{img.style.display='none';wrap.classList.remove('asset-ready');wrap.classList.add('asset-failed');wrap.dataset.gameIconState='fallback';fallback.style.display='';};
  const loadLegacy=()=>{const legacy=String(settings.legacyPath||'');if(!legacy||legacyAttempted){showFallback();return;}legacyAttempted=true;img.dataset.assetSource='legacy';img.dataset.requestedSource=assetUrl(legacy);img.style.display='';img.src=img.dataset.requestedSource;};
  img.addEventListener('load',()=>{if(img.getAttribute('src')!==img.dataset.requestedSource||img.isConnected===false)return;if(img.dataset.assetSource==='v2'&&!gameIconSystemEnabled()){loadLegacy();return;}img.style.display='';fallback.style.display='none';wrap.classList.remove('asset-failed');wrap.classList.add('asset-ready');wrap.dataset.gameIconState=img.dataset.assetSource==='v2'?'v2':'legacy';});
  img.addEventListener('error',()=>{if(img.getAttribute('src')!==img.dataset.requestedSource||img.isConnected===false)return;loadLegacy();});
  const generation=++requestGeneration;
  resolveGameIconVariantUrl(id,role,requestedSize).then(url=>{if(generation!==requestGeneration||img.isConnected===false)return;if(url&&gameIconSystemEnabled()){img.dataset.assetSource='v2';img.dataset.requestedSource=url;img.style.display='';img.src=url;}else loadLegacy();}).catch(()=>{if(generation===requestGeneration&&img.isConnected!==false)loadLegacy();});
  return wrap;
}

function gameSystemMarkerNode(markerId,options){
  const settings=options&&typeof options==='object'?options:{},id=String(markerId||'').toLowerCase(),size=gameIconSystemMarkerSize(settings.size);
  const wrap=el('span','game-system-marker'+(settings.className?' '+settings.className:''));wrap.setAttribute('aria-hidden','true');wrap.dataset.markerId=id;wrap.dataset.markerState='loading';if(wrap.style&&wrap.style.setProperty)wrap.style.setProperty('--game-marker-size',size+'px');
  const fallbackText=settings.fallback!==undefined?String(settings.fallback):'';if(!fallbackText)wrap.classList.add('game-system-marker-empty-fallback');
  const fallback=el('span','game-system-marker-fallback',fallbackText);const img=document.createElement('img');img.className='game-system-marker-image';img.alt='';img.decoding='async';img.loading=settings.loading||'lazy';wrap.appendChild(fallback);wrap.appendChild(img);
  let requestGeneration=0;const showFallback=()=>{img.style.display='none';wrap.classList.remove('asset-ready');wrap.classList.add('asset-failed');wrap.dataset.markerState='fallback';fallback.style.display='';};
  img.addEventListener('load',()=>{if(img.getAttribute('src')!==img.dataset.requestedSource||img.isConnected===false)return;if(!gameIconSystemEnabled()){showFallback();return;}img.style.display='';fallback.style.display='none';wrap.classList.remove('asset-failed');wrap.classList.add('asset-ready');wrap.dataset.markerState='v2';});img.addEventListener('error',()=>{if(img.isConnected!==false&&img.getAttribute('src')===img.dataset.requestedSource)showFallback();});
  const generation=++requestGeneration;resolveGameSystemMarkerUrl(id,size).then(url=>{if(generation!==requestGeneration||img.isConnected===false)return;if(url&&gameIconSystemEnabled()){img.dataset.requestedSource=url;img.src=url;}else showFallback();}).catch(()=>{if(generation===requestGeneration&&img.isConnected!==false)showFallback();});return wrap;
}

function ensureGameSelectedObjectNode(card,gameId){
  if(!card||!card.appendChild)return null;const existing=card.querySelector&&card.querySelector('.game-icon-selected-object');if(existing)return existing;
  const node=gameIconNode(gameId,{role:'selected-object',size:96,className:'game-icon-selected-object',loading:'eager',fallback:''});card.appendChild(node);return node;
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

function honruSeasonalEnabled(){
  return ownerClearedDefaultOnFlagEnabled(HONRU_SEASONAL_FLAG);
}

function honruStickerBookEnabled(){
  return ownerClearedDefaultOnFlagEnabled(HONRU_STICKER_BOOK_FLAG);
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

function playerCharacterLayeredEnabled(){
  return ownerClearedDefaultOnFlagEnabled(PLAYER_CHARACTER_LAYERED_FLAG);
}

function avatarFrameEffectEnabled(){
  return ownerClearedDefaultOnFlagEnabled(AVATAR_FRAME_EFFECT_FLAG);
}

function avatarFrameEffectSize(size){
  const px = Math.max(44, Math.min(192, Number(size) || 96));
  return AVATAR_FRAME_EFFECT_SIZES.find(value => Number(value) >= px) || '192';
}

function avatarFrameEffectMode(){
  try {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(forced-colors: active)').matches) return 'high-contrast';
    if (typeof prefersReducedMotion === 'function' && prefersReducedMotion()) return 'static';
  } catch (error) {}
  return 'dynamic';
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

function monopolyFinalArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(MONOPOLY_FINAL_ART_FLAG);
}

async function loadMonopolyFinalArtManifest(){
  if(!monopolyFinalArtManifestPromise){
    monopolyFinalArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await monopolyFinalArtManifestPromise;
  if(!manifest)monopolyFinalArtManifestPromise=null;
  return manifest;
}

async function resolveMonopolyFinalArtUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!MONOPOLY_FINAL_ART_ROLE_SET.has(safeRole)||!monopolyFinalArtEnabled())return '';
  const manifest=await loadMonopolyFinalArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===MONOPOLY_FINAL_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,expectedFlags=[MONOPOLY_FINAL_ART_FLAG];
  const key=safeRole+(useStatic?'-static':''),runtimePath=String(item&&item.variants&&item.variants[key]||''),expected='public/assets/games/monopoly/final-art-v1/'+key+'-v1.webp';
  if(!item||item.runtime_id!=='monopoly'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.artwork_version!==1||item.source_asset_id!==MONOPOLY_FINAL_ART_SOURCE_ID||item.clearance_record!==MONOPOLY_FINAL_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify(expectedFlags)||runtimePath!==expected||!/public\/assets\/games\/monopoly\/final-art-v1\/[a-z0-9-]+-v1\.webp$/.test(runtimePath)){
    monopolyFinalArtManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function tankFinalArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(TANK_FINAL_ART_FLAG);
}

async function loadTankFinalArtManifest(){
  if(!tankFinalArtManifestPromise){
    tankFinalArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await tankFinalArtManifestPromise;
  if(!manifest)tankFinalArtManifestPromise=null;
  return manifest;
}

async function resolveTankFinalArtUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!TANK_FINAL_ART_ROLE_SET.has(safeRole)||!tankFinalArtEnabled())return '';
  const manifest=await loadTankFinalArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===TANK_FINAL_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,expectedFlags=[TANK_FINAL_ART_FLAG];
  const key=safeRole+(useStatic?'-static':''),runtimePath=String(item&&item.variants&&item.variants[key]||''),expected='public/assets/games/tank/final-art-v1/'+key+'-v1.webp';
  if(!item||item.runtime_id!=='tank'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.artwork_version!==1||item.source_asset_id!==TANK_FINAL_ART_SOURCE_ID||item.clearance_record!==TANK_FINAL_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify(expectedFlags)||runtimePath!==expected||!/public\/assets\/games\/tank\/final-art-v1\/[a-z0-9-]+-v1\.webp$/.test(runtimePath)){
    tankFinalArtManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function tetrisFinalArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(TETRIS_FINAL_ART_FLAG);
}

async function loadTetrisFinalArtManifest(){
  if(!tetrisFinalArtManifestPromise){
    tetrisFinalArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await tetrisFinalArtManifestPromise;
  if(!manifest)tetrisFinalArtManifestPromise=null;
  return manifest;
}

async function resolveTetrisFinalArtUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!TETRIS_FINAL_ART_ROLE_SET.has(safeRole)||!tetrisFinalArtEnabled())return '';
  const manifest=await loadTetrisFinalArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===TETRIS_FINAL_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,expectedFlags=[TETRIS_FINAL_ART_FLAG];
  const key=safeRole+(useStatic?'-static':''),runtimePath=String(item&&item.variants&&item.variants[key]||''),expected='public/assets/games/tetris/final-art-v1/'+key+'-v1.webp';
  if(!item||item.runtime_id!=='tetris'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.artwork_version!==1||item.source_asset_id!==TETRIS_FINAL_ART_SOURCE_ID||item.clearance_record!==TETRIS_FINAL_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify(expectedFlags)||runtimePath!==expected||!/public\/assets\/games\/tetris\/final-art-v1\/[a-z0-9-]+-v1\.webp$/.test(runtimePath)){
    tetrisFinalArtManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function xiangqiFinalArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(XIANGQI_FINAL_ART_FLAG);
}

async function loadXiangqiFinalArtManifest(){
  if(!xiangqiFinalArtManifestPromise){
    xiangqiFinalArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await xiangqiFinalArtManifestPromise;
  if(!manifest)xiangqiFinalArtManifestPromise=null;
  return manifest;
}

async function resolveXiangqiFinalArtUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!XIANGQI_FINAL_ART_ROLE_SET.has(safeRole)||!xiangqiFinalArtEnabled())return '';
  const manifest=await loadXiangqiFinalArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===XIANGQI_FINAL_ART_ASSET_ID):null;
  const flags=item&&item.feature_flags,expectedFlags=[XIANGQI_FINAL_ART_FLAG];
  const key=safeRole+(useStatic?'-static':''),runtimePath=String(item&&item.variants&&item.variants[key]||''),expected='public/assets/games/xiangqi/final-art-v1/'+key+'-v1.webp';
  if(!item||item.runtime_id!=='xiangqi'||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.artwork_version!==1||item.source_asset_id!==XIANGQI_FINAL_ART_SOURCE_ID||item.clearance_record!==XIANGQI_FINAL_ART_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify(expectedFlags)||runtimePath!==expected||!/public\/assets\/games\/xiangqi\/final-art-v1\/[a-z0-9-]+-v1\.webp$/.test(runtimePath)){
    xiangqiFinalArtManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function shopCompleteArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(SHOP_COMPLETE_ART_FLAG);
}

async function loadShopCompleteArtManifest(){
  if(!shopCompleteArtManifestPromise){
    shopCompleteArtManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await shopCompleteArtManifestPromise;
  if(!manifest)shopCompleteArtManifestPromise=null;
  return manifest;
}

async function resolveShopCompleteArtUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!SHOP_COMPLETE_ART_ROLE_SET.has(safeRole)||!shopCompleteArtEnabled())return '';
  const manifest=await loadShopCompleteArtManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===SHOP_COMPLETE_ART_ASSET_ID):null;
  if(!item||!item.runtime_path)return '';
  const variant=useStatic?'-static.webp':'.webp';
  return assetUrl(item.runtime_path+'/'+safeRole+variant);
}

function communityReplayTournamentCardsEnabled(){
  return ownerClearedDefaultOnFlagEnabled(COMMUNITY_REPLAY_TOURNAMENT_CARDS_FLAG);
}

async function loadCommunityReplayTournamentCardsManifest(){
  if(!communityReplayTournamentCardsManifestPromise){
    communityReplayTournamentCardsManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await communityReplayTournamentCardsManifestPromise;
  if(!manifest)communityReplayTournamentCardsManifestPromise=null;
  return manifest;
}

async function resolveCommunityReplayTournamentCardUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!COMMUNITY_REPLAY_TOURNAMENT_ROLE_SET.has(safeRole)||!communityReplayTournamentCardsEnabled())return '';
  const manifest=await loadCommunityReplayTournamentCardsManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===COMMUNITY_REPLAY_TOURNAMENT_CARDS_ASSET_ID):null;
  const flags=item&&item.feature_flags,key=safeRole+(useStatic?'-static':''),runtimePath=String(item&&item.variants&&item.variants[key]||'');
  const expected='public/assets/platform/community-replay-tournament-cards-v1/'+safeRole+(useStatic?'-static':'')+'.webp';
  if(!item||item.runtime_id!=='platform'||item.artwork_version!==1||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==COMMUNITY_REPLAY_TOURNAMENT_CARDS_SOURCE_ID||item.clearance_record!==COMMUNITY_REPLAY_TOURNAMENT_CARDS_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([COMMUNITY_REPLAY_TOURNAMENT_CARDS_FLAG])||runtimePath!==expected){
    communityReplayTournamentCardsManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function communityReplayTournamentCardRoleForKind(kind){
  const map={game_share:'card-playline',result_share:'card-result',record_share:'card-record',replay_share:'card-replay',tournament_share:'card-tournament'};
  return map[String(kind||'')]||'';
}

function shopLimitedSetsEnabled(){
  return ownerClearedDefaultOnFlagEnabled(SHOP_LIMITED_SETS_FLAG);
}

function loadShopLimitedSetsManifest(){
  if(!shopLimitedSetsManifestPromise){
    shopLimitedSetsManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const request=shopLimitedSetsManifestPromise;
  request.then(manifest=>{if(!manifest&&shopLimitedSetsManifestPromise===request)shopLimitedSetsManifestPromise=null;});
  return request;
}

async function resolveShopLimitedSetArtUrl(role){
  const safeRole=String(role||'');
  if(!SHOP_LIMITED_SETS_ROLE_SET.has(safeRole)||!shopLimitedSetsEnabled())return '';
  const request=loadShopLimitedSetsManifest(),manifest=await request;
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===SHOP_LIMITED_SETS_ASSET_ID):null;
  const flags=item&&item.feature_flags,variants=item&&item.variants&&typeof item.variants==='object'&&!Array.isArray(item.variants)?item.variants:null;
  const expected={
    desktop:'public/assets/platform/shop/limited-sets-v1/seasonal-vault-hero-desktop-v1.webp',
    mobile:'public/assets/platform/shop/limited-sets-v1/seasonal-vault-hero-mobile-v1.webp',
    poster:'public/assets/platform/shop/limited-sets-v1/seasonal-vault-hero-poster-v1.webp',
  };
  const complete=!!variants&&JSON.stringify(Object.keys(variants))===JSON.stringify(SHOP_LIMITED_SETS_ROLES)&&SHOP_LIMITED_SETS_ROLES.every(key=>String(variants[key]||'')===expected[key]);
  if(!item||item.runtime_id!=='platform'||item.artwork_version!==1||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||
    item.source_asset_id!==SHOP_LIMITED_SETS_SOURCE_ID||item.clearance_record!==SHOP_LIMITED_SETS_CLEARANCE_RECORD||!flags||flags.operator!=='all'||
    flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([SHOP_LIMITED_SETS_FLAG])||!complete){
    if(shopLimitedSetsManifestPromise===request)shopLimitedSetsManifestPromise=null;return '';
  }
  const runtimePath=String(variants[safeRole]||'');
  return /^public\/assets\/platform\/shop\/limited-sets-v1\/seasonal-vault-hero-(?:desktop|mobile|poster)-v1\.webp$/.test(runtimePath)
    ? assetUrl(runtimePath.slice('public/assets/'.length)) : '';
}

function aiDifficultyVisualEnabled(){
  return ownerClearedDefaultOnFlagEnabled(AI_DIFFICULTY_VISUAL_FLAG);
}

async function loadAiDifficultyVisualManifest(){
  if(!aiDifficultyVisualManifestPromise){
    aiDifficultyVisualManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const manifest=await aiDifficultyVisualManifestPromise;
  if(!manifest)aiDifficultyVisualManifestPromise=null;
  return manifest;
}

async function resolveAiDifficultyVisualUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!AI_DIFFICULTY_VISUAL_ROLE_SET.has(safeRole)||!aiDifficultyVisualEnabled())return '';
  const manifest=await loadAiDifficultyVisualManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===AI_DIFFICULTY_VISUAL_ASSET_ID):null;
  const flags=item&&item.feature_flags,key=safeRole+(useStatic?'-static':''),runtimePath=String(item&&item.variants&&item.variants[key]||'');
  const expected='public/assets/platform/ai-difficulty/visual-v1/'+safeRole+(useStatic?'-static':'')+'.webp';
  if(!item||item.runtime_id!=='platform'||item.artwork_version!==1||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==AI_DIFFICULTY_VISUAL_SOURCE_ID||item.clearance_record!==AI_DIFFICULTY_VISUAL_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([AI_DIFFICULTY_VISUAL_FLAG])||runtimePath!==expected){
    aiDifficultyVisualManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function aiDifficultyVisualNode(level, role, options){
  if(typeof document==='undefined'||!document.createElement)return null;
  const id=AI_DIFFICULTY_VISUAL_LEVELS.includes(String(level||''))?String(level):'normal';
  const kind=['card','seat','mark'].includes(String(role||''))?String(role):'mark';
  const settings=options&&typeof options==='object'?options:{};
  const img=document.createElement('img');img.className='ai-difficulty-art '+String(settings.className||'');img.alt='';img.setAttribute('aria-hidden','true');img.loading=settings.loading==='eager'?'eager':'lazy';img.decoding='async';img.hidden=true;
  const reduced=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  resolveAiDifficultyVisualUrl(kind+'-'+id,reduced).then(url=>{if(url&&img.isConnected!==false){img.src=url;img.hidden=false;}}).catch(()=>{});
  return img;
}

function honruEdgeCursorEnabled(){
  return ownerClearedDefaultOnFlagEnabled(HONRU_EDGE_CURSOR_FLAG);
}

async function resolveHonruEdgeCursorUrl(role, staticFallback){
  const safeRole=String(role||''),useStatic=!!staticFallback;
  if(!HONRU_EDGE_CURSOR_ROLE_SET.has(safeRole)||!honruEdgeCursorEnabled())return '';
  const manifest=await loadRuntimeAssetManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===HONRU_EDGE_CURSOR_ASSET_ID):null;
  const flags=item&&item.feature_flags;
  const isEdge=HONRU_EDGE_CURSOR_EDGE_ROLES.includes(safeRole);
  const key=isEdge?(safeRole+(useStatic?'-static':'')):safeRole;
  const runtimePath=String(item&&item.variants&&item.variants[key]||'');
  const expected=isEdge
    ? 'public/assets/platform/honru-edge-cursor/visual-v1/'+safeRole+(useStatic?'-static':'')+'.webp'
    : 'public/assets/platform/honru-edge-cursor/visual-v1/'+safeRole+'.png';
  if(!item||item.runtime_id!=='honru'||item.artwork_version!==1||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==HONRU_EDGE_CURSOR_SOURCE_ID||item.clearance_record!==HONRU_EDGE_CURSOR_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([HONRU_EDGE_CURSOR_FLAG])||runtimePath!==expected){
    runtimeAssetManifestPromise=null;return '';
  }
  return assetUrl(runtimePath.slice('public/assets/'.length));
}

function identityBadgeSystemEnabled(){
  return ownerClearedDefaultOnFlagEnabled(IDENTITY_BADGE_SYSTEM_FLAG);
}

function seasonalBackgroundsEnabled(){
  return ownerClearedDefaultOnFlagEnabled(SEASONAL_BACKGROUNDS_FLAG);
}

function audioSpectrumArtEnabled(){
  return ownerClearedDefaultOnFlagEnabled(AUDIO_SPECTRUM_ART_FLAG);
}

function socialShareTemplatesEnabled(){
  return ownerClearedDefaultOnFlagEnabled(SOCIAL_SHARE_TEMPLATES_FLAG);
}

function tournamentBroadcastOverlayEnabled(){
  return ownerClearedDefaultOnFlagEnabled(TOURNAMENT_BROADCAST_OVERLAY_FLAG);
}

async function resolveIdentityBadgeUrl(group,badgeId,size){
  const safeGroup=String(group||''),safeId=String(badgeId||''),safeSize=String(size||'48');
  const ids=IDENTITY_BADGE_GROUPS[safeGroup];
  if(!ids||!ids.includes(safeId)||!IDENTITY_BADGE_SIZES.includes(safeSize)||!identityBadgeSystemEnabled())return '';
  const manifest=await loadRuntimeAssetManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===IDENTITY_BADGE_SYSTEM_ASSET_ID):null;
  const flags=item&&item.feature_flags,key=safeGroup+'-'+safeId+'-'+safeSize,pathValue=String(item&&item.variants&&item.variants[key]||'');
  const expected='public/assets/platform/identity/badge-system-v1/'+key+'.webp';
  if(!item||item.runtime_id!=='platform'||item.artwork_version!==1||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==IDENTITY_BADGE_SYSTEM_SOURCE_ID||item.clearance_record!==IDENTITY_BADGE_SYSTEM_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([IDENTITY_BADGE_SYSTEM_FLAG])||pathValue!==expected){
    runtimeAssetManifestPromise=null;return '';
  }
  return assetUrl(pathValue.slice('public/assets/'.length));
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

async function resolvePersonalHomeSceneSet(theme,mobile,options){
  if(!ownerClearedDefaultOnFlagEnabled(PERSONAL_HOME_SCENE_FLAG))return null;
  const safeTheme=theme==='dark'?'dark':'light',viewport=mobile?'mobile':'desktop',manifest=await loadRuntimeAssetManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===PERSONAL_HOME_SCENE_ASSET_ID):null;
  const flags=item&&item.feature_flags,base=`public/assets/platform/personal-home-scene-v1/${safeTheme}/${viewport}/personal-home-${safeTheme}-${viewport}-`;
  const expected={background:base+'background-v1.webp',midground:base+'midground-v1.webp',foreground:base+'foreground-v1.webp',static:base+'static-v1.webp',poster:`public/assets/platform/personal-home-scene-v1/${safeTheme}/preview/personal-home-${safeTheme}-poster-v1.webp`,mini:`public/assets/platform/personal-home-scene-v1/${safeTheme}/preview/personal-home-${safeTheme}-mini-v1.webp`};
  if(!item||item.runtime_id!=='platform'||item.artwork_version!==1||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==PERSONAL_HOME_SCENE_SOURCE_ID||item.clearance_record!==PERSONAL_HOME_SCENE_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([PERSONAL_HOME_SCENE_FLAG])){runtimeAssetManifestPromise=null;return null;}
  const reduced=!!(options&&options.reducedMotion),saveData=!!(options&&options.saveData),selected=saveData?expected.poster:(reduced?expected.static:null);
  if(selected){const key=saveData?`personal-home-${safeTheme}-poster`:`personal-home-${safeTheme}-${viewport}-static`;if(item.variants[key]!==selected){runtimeAssetManifestPromise=null;return null;}return Object.freeze({theme:safeTheme,viewport,mode:saveData?'poster':'static',background:assetUrl(selected.slice('public/assets/'.length)),midground:'',foreground:'',poster:assetUrl(expected.poster.slice('public/assets/'.length)),mini:assetUrl(expected.mini.slice('public/assets/'.length))});}
  const keys={background:`personal-home-${safeTheme}-${viewport}-background`,midground:`personal-home-${safeTheme}-${viewport}-midground`,foreground:`personal-home-${safeTheme}-${viewport}-foreground`,static:`personal-home-${safeTheme}-${viewport}-static`};
  if(!Object.entries({background:expected.background,midground:expected.midground,foreground:expected.foreground,static:expected.static}).every(([role,value])=>item.variants[keys[role]]===value)){runtimeAssetManifestPromise=null;return null;}
  return Object.freeze({theme:safeTheme,viewport,mode:'layered',background:assetUrl(expected.background.slice('public/assets/'.length)),midground:assetUrl(expected.midground.slice('public/assets/'.length)),foreground:assetUrl(expected.foreground.slice('public/assets/'.length)),poster:assetUrl(expected.poster.slice('public/assets/'.length)),mini:assetUrl(expected.mini.slice('public/assets/'.length))});
}

async function resolveProfileAdaptiveHeroUrl(mobile,options){
  if(!ownerClearedDefaultOnFlagEnabled(PROFILE_ADAPTIVE_HERO_FLAG))return '';
  const viewport=mobile?'mobile':'desktop',mode=options&&options.saveData?'poster':(options&&options.reducedMotion?'static':viewport);
  const manifest=await loadRuntimeAssetManifest();
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===PROFILE_ADAPTIVE_HERO_ASSET_ID):null;
  const flags=item&&item.feature_flags;
  const files={desktop:'public/assets/platform/profile-adaptive-hero-v1/profile-adaptive-hero-desktop-v1.webp',mobile:'public/assets/platform/profile-adaptive-hero-v1/profile-adaptive-hero-mobile-v1.webp',poster:'public/assets/platform/profile-adaptive-hero-v1/profile-adaptive-hero-poster-v1.webp',static:'public/assets/platform/profile-adaptive-hero-v1/profile-adaptive-hero-static-v1.webp'};
  const key=mode==='poster'?'poster':(mode==='static'?'static':viewport),pathValue=String(item&&item.variants&&item.variants[key]||'');
  if(!item||item.runtime_id!=='platform'||item.artwork_version!==1||item.status!=='ready'||item.clearance!=='OWNER_AUTHORIZED_ART_CLEARANCE'||item.source_asset_id!==PROFILE_ADAPTIVE_HERO_SOURCE_ID||item.clearance_record!==PROFILE_ADAPTIVE_HERO_CLEARANCE_RECORD||!flags||flags.operator!=='all'||flags.enabled_value!=='1'||flags.default_enabled!==true||JSON.stringify(flags.ids)!==JSON.stringify([PROFILE_ADAPTIVE_HERO_FLAG])||pathValue!==files[key]){
    runtimeAssetManifestPromise=null;return '';
  }
  return assetUrl(pathValue.slice('public/assets/'.length));
}

function playerCharacterManifestItem(manifest){
  const item=manifest&&Array.isArray(manifest.assets)
    ? manifest.assets.find(asset=>asset&&asset.asset_id===PLAYER_CHARACTER_LAYERED_ASSET_ID)
    : null;
  const flags=item&&item.feature_flags;
  const variants=item&&item.variants&&typeof item.variants==='object'&&!Array.isArray(item.variants)?item.variants:null;
  const expectedKeys=[];
  PLAYER_CHARACTER_LAYERED_SLOTS.forEach(slot=>PLAYER_CHARACTER_LAYERED_SLOT_CATALOG[slot].forEach(id=>PLAYER_CHARACTER_LAYERED_SIZE_SET.forEach(size=>expectedKeys.push('layer-'+slot+'-'+id+'-'+size))));
  PLAYER_CHARACTER_LAYERED_POSES.forEach(id=>PLAYER_CHARACTER_LAYERED_SIZE_SET.forEach(size=>expectedKeys.push('pose-'+id+'-'+size)));
  PLAYER_CHARACTER_LAYERED_SIZE_SET.forEach(size=>expectedKeys.push('composite-default-'+size));
  const variantsComplete=!!variants&&Object.keys(variants).length===expectedKeys.length&&expectedKeys.every(key=>{
    const spec=playerCharacterVariantSpec(key),pathValue=String(variants[key]||'');
    return !!spec&&pathValue===spec.expected&&spec.pattern.test(pathValue);
  });
  const metadataComplete=JSON.stringify(item&&item.slot_catalog)===JSON.stringify(PLAYER_CHARACTER_LAYERED_SLOT_CATALOG)&&
    JSON.stringify(item&&item.slot_order)===JSON.stringify(PLAYER_CHARACTER_LAYERED_SLOT_ORDER)&&
    JSON.stringify(item&&item.default_selection)===JSON.stringify(PLAYER_CHARACTER_LAYERED_DEFAULTS)&&
    JSON.stringify(item&&item.poses)===JSON.stringify(PLAYER_CHARACTER_LAYERED_POSES)&&
    JSON.stringify(item&&item.actions)===JSON.stringify(PLAYER_CHARACTER_LAYERED_ACTIONS);
  return item&&item.runtime_id==='player-character'&&item.status==='ready'&&
    item.clearance==='OWNER_AUTHORIZED_ART_CLEARANCE'&&item.artwork_version===1&&
    item.source_asset_id===PLAYER_CHARACTER_LAYERED_SOURCE_ID&&
    item.clearance_record===PLAYER_CHARACTER_LAYERED_CLEARANCE_RECORD&&flags&&
    flags.operator==='all'&&flags.enabled_value==='1'&&flags.default_enabled===true&&
    JSON.stringify(flags.ids)===JSON.stringify([PLAYER_CHARACTER_LAYERED_FLAG])&&variantsComplete&&metadataComplete ? item : null;
}

function playerCharacterVariantSpec(key){
  const value=String(key||'');
  let match=/^layer-(body|face|hair|top|bottom|footwear|accessory)-([a-z0-9-]+)-(128|256)$/.exec(value);
  if(match){
    const slot=match[1],id=match[2],size=match[3],allowed=PLAYER_CHARACTER_LAYERED_SLOT_CATALOG[slot];
    if(!allowed||!allowed.includes(id))return null;
    return {
      expected:'public/assets/player-character/layered-v1/layers/'+slot+'/'+id+'-'+size+'-v1.webp',
      pattern:/^public\/assets\/player-character\/layered-v1\/layers\/(?:body|face|hair|top|bottom|footwear|accessory)\/[a-z0-9-]+-(?:128|256)-v1\.webp$/,
    };
  }
  match=/^(composite-default|pose-([a-z0-9-]+))-(128|256)$/.exec(value);
  if(!match)return null;
  if(value.startsWith('pose-')&&!PLAYER_CHARACTER_LAYERED_POSE_SET.has(match[2]))return null;
  const family=value.startsWith('composite-')?'composites':'poses';
  const fileName=value.startsWith('composite-')?'default-neutral-'+match[3]:match[2]+'-'+match[3];
  return {
    expected:'public/assets/player-character/layered-v1/'+family+'/'+fileName+'-v1.webp',
    pattern:/^public\/assets\/player-character\/layered-v1\/(?:composites|poses)\/[a-z0-9-]+-(?:128|256)-v1\.webp$/,
  };
}

async function resolvePlayerCharacterVariantUrl(key){
  if(!playerCharacterLayeredEnabled())return '';
  const spec=playerCharacterVariantSpec(key);
  if(!spec)return '';
  const request=loadPlayerCharacterManifest(),manifest=await request,item=playerCharacterManifestItem(manifest);
  const pathValue=String(item&&item.variants&&item.variants[String(key)]||'');
  if(!playerCharacterLayeredEnabled())return '';
  if(!item||pathValue!==spec.expected||!spec.pattern.test(pathValue)){
    if(playerCharacterManifestPromise===request)playerCharacterManifestPromise=null;
    return '';
  }
  return assetUrl(pathValue.slice('public/assets/'.length));
}

async function resolvePlayerCharacterLayerUrl(slot, runtimeId, size){
  const safeSlot=String(slot||''),id=String(runtimeId||''),px=String(size||'128');
  if(!PLAYER_CHARACTER_LAYERED_SIZE_SET.has(px))return '';
  return resolvePlayerCharacterVariantUrl('layer-'+safeSlot+'-'+id+'-'+px);
}

async function resolvePlayerCharacterCompositeUrl(size){
  const px=String(size||'128');
  if(!PLAYER_CHARACTER_LAYERED_SIZE_SET.has(px))return '';
  return resolvePlayerCharacterVariantUrl('composite-default-'+px);
}

// Kept as a compatibility alias for older callers; all validation now lives in
// the single family resolver above so the layered and composite paths cannot drift.
async function resolvePlayerCharacterArtUrl(variant){
  const key=typeof variant==='string'&&playerCharacterVariantSpec(variant)?variant:'composite-default-256';
  return resolvePlayerCharacterVariantUrl(key);
}

function loadPlayerCharacterManifest(){
  if(!playerCharacterManifestPromise){
    playerCharacterManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const request=playerCharacterManifestPromise;
  request.then(manifest=>{if(!manifest&&playerCharacterManifestPromise===request)playerCharacterManifestPromise=null;});
  return request;
}

function loadAvatarFrameEffectManifest(){
  if(!avatarFrameEffectManifestPromise){
    avatarFrameEffectManifestPromise=(typeof fetch==='function'
      ? fetch(assetUrl('manifest'),{cache:'no-store'}).then(response=>response&&response.ok?response.json():null)
      : Promise.resolve(null)).catch(()=>null);
  }
  const request=avatarFrameEffectManifestPromise;
  request.then(manifest=>{if(!manifest&&avatarFrameEffectManifestPromise===request)avatarFrameEffectManifestPromise=null;});
  return request;
}

function avatarFrameEffectManifestItem(manifest){
  const item=manifest&&Array.isArray(manifest.assets)?manifest.assets.find(asset=>asset&&asset.asset_id===AVATAR_FRAME_EFFECT_ASSET_ID):null;
  const flags=item&&item.feature_flags,variants=item&&item.variants&&typeof item.variants==='object'&&!Array.isArray(item.variants)?item.variants:null;
  const expectedKeys=[];
  for(const kind of ['frame','effect'])for(const id of AVATAR_FRAME_EFFECT_IDS)for(const size of AVATAR_FRAME_EFFECT_SIZES)for(const mode of AVATAR_FRAME_EFFECT_MODES)expectedKeys.push(`${kind}-${id}-${size}-${mode}`);
  const variantsComplete=!!variants&&Object.keys(variants).length===expectedKeys.length&&expectedKeys.every(key=>{
    const match=/^(frame|effect)-([1-8])-(44|64|96|192)-(static|dynamic|high-contrast)$/.exec(key);
    if(!match)return false;
    const expected=`public/assets/ui/identity/avatar-frame-effect-v1/${match[1]}s/${key}-v1.webp`,pathValue=String(variants[key]||'');
    return pathValue===expected&&/^public\/assets\/ui\/identity\/avatar-frame-effect-v1\/(?:frames|effects)\/(?:frame|effect)-[1-8]-(?:44|64|96|192)-(?:static|dynamic|high-contrast)-v1\.webp$/.test(pathValue);
  });
  return item&&item.runtime_id==='identity'&&item.status==='ready'&&item.clearance==='OWNER_AUTHORIZED_ART_CLEARANCE'&&item.artwork_version===1&&
    item.source_asset_id===AVATAR_FRAME_EFFECT_SOURCE_ID&&item.clearance_record===AVATAR_FRAME_EFFECT_CLEARANCE_RECORD&&flags&&flags.operator==='all'&&
    flags.enabled_value==='1'&&flags.default_enabled===true&&JSON.stringify(flags.ids)===JSON.stringify([AVATAR_FRAME_EFFECT_FLAG])&&
    JSON.stringify(item.frames)===JSON.stringify(AVATAR_FRAME_EFFECT_IDS)&&JSON.stringify(item.effects)===JSON.stringify(AVATAR_FRAME_EFFECT_IDS)&&
    JSON.stringify(item.runtime_sizes)===JSON.stringify(AVATAR_FRAME_EFFECT_SIZES.map(Number))&&JSON.stringify(item.modes)===JSON.stringify(AVATAR_FRAME_EFFECT_MODES)&&variantsComplete?item:null;
}

async function resolveAvatarFrameEffectUrl(kind, id, size, mode){
  const safeKind=String(kind||''),safeId=Number(id),safeSize=String(size||''),safeMode=String(mode||'');
  if(!['frame','effect'].includes(safeKind)||!AVATAR_FRAME_EFFECT_ID_SET.has(safeId)||!AVATAR_FRAME_EFFECT_SIZE_SET.has(safeSize)||!AVATAR_FRAME_EFFECT_MODE_SET.has(safeMode)||!avatarFrameEffectEnabled()) return '';
  const request=loadAvatarFrameEffectManifest(),manifest=await request,item=avatarFrameEffectManifestItem(manifest);
  const key=`${safeKind}-${safeId}-${safeSize}-${safeMode}`,pathValue=String(item&&item.variants&&item.variants[key]||''),expected=`public/assets/ui/identity/avatar-frame-effect-v1/${safeKind}s/${safeKind}-${safeId}-${safeSize}-${safeMode}-v1.webp`;
  if(!avatarFrameEffectEnabled())return '';
  if(!item||pathValue!==expected||!/^public\/assets\/ui\/identity\/avatar-frame-effect-v1\/(?:frames|effects)\/(?:frame|effect)-[1-8]-(?:44|64|96|192)-(?:static|dynamic|high-contrast)-v1\.webp$/.test(pathValue)){
    if(avatarFrameEffectManifestPromise===request)avatarFrameEffectManifestPromise=null;return '';
  }
  return assetUrl(pathValue.slice('public/assets/'.length));
}

function avatarFrameEffectRuntimeMode(){ return avatarFrameEffectMode(); }

function playerCharacterLayeredNode(character, options){
  const settings=options&&typeof options==='object'?options:{},px=PLAYER_CHARACTER_LAYERED_SIZE_SET.has(String(settings.size||''))?String(settings.size):'128';
  const wrap=el('span','player-character-layered'+(settings.className?' '+settings.className:''));
  wrap.setAttribute('aria-hidden','true');
  const setRendererState=state=>{
    wrap.dataset.playerCharacterRenderer=state;
    if(typeof settings.onRendererState==='function'){try{settings.onRendererState(state,wrap);}catch(error){}}
  };
  setRendererState('loading');
  const safe=character&&typeof character==='object'?character:null,slots=safe&&safe.slots&&typeof safe.slots==='object'?safe.slots:{};
  const selected=Object.fromEntries(PLAYER_CHARACTER_LAYERED_SLOTS.map(slot=>[slot,PLAYER_CHARACTER_LAYERED_SLOT_CATALOG[slot].includes(String(slots[slot]||''))?String(slots[slot]):PLAYER_CHARACTER_LAYERED_DEFAULTS[slot]]));
  const fallback=el('span','player-character-layered-fallback',settings.fallbackText||'◎');fallback.setAttribute('aria-hidden','true');wrap.appendChild(fallback);
  const composite=el('img','player-character-composite-fallback','');
  composite.alt='';composite.decoding='async';composite.loading='eager';composite.dataset.playerCharacterFallback='composite';composite.style.display='none';wrap.appendChild(composite);
  const layers=[];let loaded=0,failed=false,compositeRequested=false;
  const showGlyph=()=>{
    layers.forEach(layer=>{layer.style.display='none';});
    composite.style.display='none';fallback.style.display='';
    wrap.classList.remove('asset-ready','asset-composite-ready');wrap.classList.add('asset-failed');
    setRendererState('glyph');
  };
  const requestComposite=()=>{
    if(compositeRequested)return;
    compositeRequested=true;
    resolvePlayerCharacterCompositeUrl(px).then(url=>{
      if(!url||composite.isConnected===false){showGlyph();return;}
      composite.src=url;
    }).catch(()=>showGlyph());
  };
  const showComposite=()=>{
    layers.forEach(layer=>{layer.style.display='none';});
    fallback.style.display='none';composite.style.display='';
    wrap.classList.remove('asset-ready','asset-failed');wrap.classList.add('asset-composite-ready');
    setRendererState('composite');
  };
  composite.addEventListener('load',()=>{if(failed)showComposite();});
  composite.addEventListener('error',showGlyph);
  const failLayers=()=>{if(failed)return;failed=true;requestComposite();};
  PLAYER_CHARACTER_LAYERED_SLOT_ORDER.forEach(slot=>{
    const img=el('img','player-character-layer','');img.alt='';img.decoding='async';img.loading='eager';img.dataset.playerCharacterSlot=slot;img.dataset.playerCharacterId=selected[slot];img.style.display='none';
    img.addEventListener('load',()=>{loaded++;if(loaded===PLAYER_CHARACTER_LAYERED_SLOTS.length&&!failed){layers.forEach(layer=>{layer.style.display='';});fallback.style.display='none';composite.style.display='none';wrap.classList.remove('asset-failed','asset-composite-ready');wrap.classList.add('asset-ready');setRendererState('layered-v1');}});
    img.addEventListener('error',failLayers);
    layers.push(img);wrap.appendChild(img);
    resolvePlayerCharacterLayerUrl(slot,selected[slot],px).then(url=>{if(url&&img.isConnected!==false)img.src=url;else failLayers();}).catch(failLayers);
  });
  return wrap;
}

async function loadRuntimeAssetManifest(){
  if (!runtimeAssetManifestPromise){
    runtimeAssetManifestPromise = (typeof fetch === 'function'
      ? fetch(assetUrl('manifest'), { cache:'no-store' }).then(response => response && response.ok ? response.json() : null)
      : Promise.resolve(null)).catch(() => null);
  }
  const request=runtimeAssetManifestPromise;
  const manifest = await request;
  if (!manifest && runtimeAssetManifestPromise===request) runtimeAssetManifestPromise = null;
  return manifest;
}

async function resolveStickerArtUrl(id, role){
  const art = STICKER_GAME_ART[id];
  if (!art || !stickerArtEnabled(id)) return '';
  const assetId = art.assets && art.assets[role];
  if (!assetId) return '';
  if (!stickerArtManifestPromise){
    stickerArtManifestPromise = (typeof fetch === 'function'
      ? fetch(assetUrl('manifest'), { cache:'no-store' }).then(response => response && response.ok ? response.json() : null)
      : Promise.resolve(null)).catch(() => null);
  }
  const manifest = await stickerArtManifestPromise;
  if (!manifest) stickerArtManifestPromise = null;
  const item = manifest && Array.isArray(manifest.assets) ? manifest.assets.find(asset => asset && asset.asset_id === assetId) : null;
  const flags = item && item.feature_flags;
  const expectedFlags = [STICKER_ART_MASTER_FLAG, art.flag];
  if (!item || item.runtime_id !== id || item.status !== 'ready' || !flags || flags.operator !== 'all' || flags.enabled_value !== '1' || flags.default_enabled !== false || JSON.stringify(flags.ids) !== JSON.stringify(expectedFlags)) { stickerArtManifestPromise = null; return ''; }
  const path = String(item.runtime_path || '');
  const expectedPrefix = 'public/assets/games/' + id + '/';
  if (!path.startsWith(expectedPrefix) || !/^public\/assets\/games\/[a-z0-9-]+\/sticker-v[1-9]\d*\/[a-z0-9-]+\.svg$/.test(path)) { stickerArtManifestPromise = null; return ''; }
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
  const item=PREMIUM_BACKGROUND_BY_ID.get(Number(id)) || null;
  return item&&item.seasonal&&!seasonalBackgroundsEnabled()?null:item;
}

async function resolveHonruSeasonalUrl(role){
  const seasonalRole = String(role || '');
  if (!HONRU_SEASONAL_ROLE_SET.has(seasonalRole) || !honruSeasonalEnabled()) return '';
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === HONRU_SEASONAL_ASSET_ID)
    : null;
  const flags = item && item.feature_flags;
  const key = HONRU_SEASONAL_ACTIVE_EDITION + '-' + seasonalRole;
  const path = String(item && item.variants && item.variants[key] || '');
  const expectedPath = 'public/assets/brand/honru/seasonal-v1/' + key + '-v1.webp';
  if (!item || item.runtime_id !== 'honru' || item.status !== 'ready' ||
      item.clearance !== 'OWNER_AUTHORIZED_ART_CLEARANCE' || item.source_asset_id !== HONRU_SEASONAL_SOURCE_ID ||
      item.artwork_version !== 1 || item.active_edition !== HONRU_SEASONAL_ACTIVE_EDITION ||
      !flags || flags.operator !== 'all' || flags.enabled_value !== '1' || flags.default_enabled !== true ||
      JSON.stringify(flags.ids) !== JSON.stringify([HONRU_SEASONAL_FLAG]) || path !== expectedPath ||
      !/^public\/assets\/brand\/honru\/seasonal-v1\/[a-z0-9-]+-(?:hero-320|reaction-160|mini-96|celebration-320)-v1\.webp$/.test(path)) {
    runtimeAssetManifestPromise = null;
    return '';
  }
  return assetUrl(path.slice('public/assets/'.length));
}

async function resolveHonruStickerBookUrl(stickerId){
  const id = String(stickerId || '');
  if (!HONRU_CONTEXT_ID_SET.has(id) || !honruStickerBookEnabled()) return '';
  const manifest = await loadRuntimeAssetManifest();
  const item = manifest && Array.isArray(manifest.assets)
    ? manifest.assets.find(asset => asset && asset.asset_id === HONRU_STICKER_BOOK_ASSET_ID)
    : null;
  const flags = item && item.feature_flags;
  const path = String(item && item.variants && item.variants[id] || '');
  const expectedPath = 'public/assets/brand/honru/context-reactions-v1/contexts/honru-context-' + id + '-v1.webp';
  if (!item || item.runtime_id !== 'honru' || item.status !== 'ready' ||
      item.clearance !== 'OWNER_AUTHORIZED_ART_CLEARANCE' || item.source_asset_id !== HONRU_STICKER_BOOK_SOURCE_ID ||
      item.artwork_version !== 1 || !flags || flags.operator !== 'all' || flags.enabled_value !== '1' ||
      flags.default_enabled !== true || JSON.stringify(flags.ids) !== JSON.stringify([HONRU_STICKER_BOOK_FLAG]) ||
      path !== expectedPath || !/^public\/assets\/brand\/honru\/context-reactions-v1\/contexts\/honru-context-[a-z0-9-]+-v1\.webp$/.test(path)) {
    runtimeAssetManifestPromise = null;
    return '';
  }
  return assetUrl(path.slice('public/assets/'.length));
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
  let motionLayer = null;
  if(item.animated&&useContext!=='shop-grid'&&typeof document!=='undefined'&&document&&typeof document.createElement==='function'){
    motionLayer=document.createElement('img');motionLayer.className='premium-background-motion-layer';motionLayer.alt='';motionLayer.decoding='async';motionLayer.loading='eager';motionLayer.draggable=false;if(typeof motionLayer.setAttribute==='function')motionLayer.setAttribute('aria-hidden','true');
    if(typeof element.insertBefore==='function')element.insertBefore(motionLayer,element.firstChild||null);else if(typeof element.appendChild==='function')element.appendChild(motionLayer);
  }
  let visible = true;
  let active = false;
  let observer = null;
  let initialVisibilityTimer = null;
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
    if(motionLayer&&motionLayer.classList&&typeof motionLayer.classList.remove==='function')motionLayer.classList.remove('is-active');
    element.dataset.animationActive = 'false';
  };
  const clearMotionSource = () => {
    if (!motionLayer) return;
    // Keep a decoded DOM layer warm across visibility/offscreen pauses. This
    // avoids replaying an already-loaded animation and lets a resumed stage
    // become active synchronously; releasePremiumBackground still removes it.
    if (animationReady) return;
    try {
      if (typeof motionLayer.removeAttribute === 'function') motionLayer.removeAttribute('src');
      else motionLayer.src = '';
    } catch (error) {}
    animationReady = false;
  };
  const pause = () => {
    if (active || motionLayer) setPoster();
    clearMotionSource();
    active = false;
    element.dataset.animationActive = 'false';
  };
  const beginAnimatedPreload = () => {
    if (animationReady || animationFailed || loader || !mayAnimate()) return;
    const probe = motionLayer || premiumBackgroundLoader();
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
      if (!active){
        if(motionLayer&&motionLayer.classList&&typeof motionLayer.classList.add==='function')motionLayer.classList.add('is-active');
        else setPremiumBackgroundImage(element, item, item.asset, poster);
      }
      active = true;
      element.dataset.animationActive = 'true';
    } else if (next && loader) {
      // Keep the in-flight animated source attached while it decodes. Calling
      // pause() here would remove src and create a poster-only deadlock.
      active = false;
      element.dataset.animationActive = 'false';
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
    /* Some embedded WebViews keep an already-visible node from receiving the
       first IntersectionObserver notification until the next layout pass.
       A single bounded viewport probe prevents an animated background from
       remaining a poster forever; it never starts offscreen content. */
    if (typeof setTimeout === 'function') {
      initialVisibilityTimer = setTimeout(() => {
        initialVisibilityTimer = null;
        if (visible || !element || typeof element.getBoundingClientRect !== 'function') return;
        let rect = null;
        try { rect = element.getBoundingClientRect(); } catch (error) { rect = null; }
        const viewportWidth = typeof window === 'undefined' ? 0 : Number(window.innerWidth) || 0;
        const viewportHeight = typeof window === 'undefined' ? 0 : Number(window.innerHeight) || 0;
        const inViewport = !!(rect && rect.width > 0 && rect.height > 0 && viewportWidth > 0 && viewportHeight > 0 &&
          rect.right > 0 && rect.bottom > 0 && rect.left < viewportWidth && rect.top < viewportHeight);
        if (inViewport) { visible = true; sync(); }
      }, 120);
    }
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
    if (initialVisibilityTimer) clearTimeout(initialVisibilityTimer);
    initialVisibilityTimer = null;
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
    if(motionLayer&&typeof motionLayer.remove==='function')motionLayer.remove();
    motionLayer=null;
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
  if ((!art || !gameArtEnabled(id)) && !gameIconSystemEnabled()) return null;
  const cover = el('div', 'game-cover');
  cover.setAttribute('aria-hidden', 'true');
  const fallback = el('span', 'game-cover-fallback', game.icon);
  const img = document.createElement('img');
  img.className='game-cover-v2';img.loading='lazy';img.decoding='async';img.alt='';img.style.display='none';
  const legacy = document.createElement('img');
  legacy.className='game-cover-legacy';legacy.loading='lazy';legacy.decoding='async';legacy.alt='';legacy.style.display='none';
  let requestedSource='',legacyAttempted=false;
  const showFallback=()=>{img.style.display='none';legacy.style.display='none';cover.classList.remove('asset-ready');cover.classList.add('asset-failed');fallback.style.display='';};
  const loadLegacy=()=>{
    if(!art||!gameArtEnabled(id)||legacyAttempted){showFallback();return;}
    const legacyUrl=assetUrl(art.cover);
    legacyAttempted=true;legacy.dataset.requestedSource=legacyUrl;legacy.src=legacyUrl;legacy.srcset=assetUrl(art.coverSmall)+' 320w, '+legacyUrl+' 640w';legacy.sizes='(max-width: 480px) 45vw, 220px';legacy.style.display='';
  };
  img.addEventListener('load',()=>{if(img.getAttribute('src')!==requestedSource||img.isConnected===false)return;if(!gameIconSystemEnabled()){loadLegacy();return;}img.style.display='';legacy.style.display='none';fallback.style.display='none';cover.classList.remove('asset-failed');cover.classList.add('asset-ready');});
  img.addEventListener('error',()=>{if(img.getAttribute('src')!==requestedSource||img.isConnected===false)return;loadLegacy();});
  legacy.addEventListener('load',()=>{if(legacy.getAttribute('src')!==legacy.dataset.requestedSource||legacy.isConnected===false)return;legacy.style.display='';img.style.display='none';fallback.style.display='none';cover.classList.remove('asset-failed');cover.classList.add('asset-ready');});
  legacy.addEventListener('error',()=>{if(legacy.getAttribute('src')!==legacy.dataset.requestedSource||legacy.isConnected===false)return;showFallback();});
  cover.appendChild(fallback);cover.appendChild(img);cover.appendChild(legacy);
  if(gameIconSystemEnabled())resolveGameIconVariantUrl(id,'cover-crop','320x180').then(url=>{if(img.isConnected===false)return;if(url&&gameIconSystemEnabled()){requestedSource=url;img.dataset.assetSource='v2';img.dataset.requestedSource=url;img.style.display='';img.src=url;}else loadLegacy();}).catch(()=>{if(img.isConnected!==false)loadLegacy();});else loadLegacy();
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

function identityBadgeNode(group,badgeId,options){
  const settings=options&&typeof options==='object'?options:{};
  const safeGroup=String(group||''),ids=IDENTITY_BADGE_GROUPS[safeGroup]||[],safeId=ids.includes(String(badgeId||''))?String(badgeId):ids[0];
  if(!safeId)return null;
  const size=IDENTITY_BADGE_SIZES.includes(String(settings.size||''))?String(settings.size):'48';
  const wrap=el('span','identity-badge identity-badge-'+safeGroup+(settings.className?' '+settings.className:''));
  wrap.setAttribute('data-identity-badge',safeGroup+'-'+safeId);wrap.setAttribute('data-identity-badge-size',size);wrap.setAttribute('aria-hidden','true');
  if(wrap.style&&typeof wrap.style.setProperty==='function')wrap.style.setProperty('--identity-badge-size',size+'px');
  const img=el('img','identity-badge-asset');img.alt='';img.decoding='async';if(settings.loading==='eager')img.loading='eager';img.style.display='none';
  const fallbackText=settings.fallback||IDENTITY_BADGE_FALLBACKS[safeGroup]&&IDENTITY_BADGE_FALLBACKS[safeGroup][safeId]||'✦';
  const fallback=el('span','identity-badge-fallback',fallbackText);
  img.addEventListener('load',()=>{img.style.display='';fallback.style.display='none';wrap.classList.add('asset-ready');});
  img.addEventListener('error',()=>{img.style.display='none';fallback.style.display='';wrap.classList.add('asset-failed');});
  wrap.appendChild(img);wrap.appendChild(fallback);
  resolveIdentityBadgeUrl(safeGroup,safeId,size).then(url=>{if(url)img.src=url;}).catch(()=>{});
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
