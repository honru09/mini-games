/*
 * UnifiedFeedbackAdapter
 *
 * Presentation-only audio/haptics adapter.  It consumes semantic records from
 * FeedbackBus and owns no game state.  Browser discovery is deliberately kept
 * out of module evaluation: callers inject an AudioContext factory and invoke
 * unlock() from a user gesture.
 */
(function installUnifiedFeedbackAdapter(root, factory) {
  'use strict';

  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  else if (root) root.UnifiedFeedbackAdapter = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createUnifiedFeedbackAdapterModule() {
  'use strict';

  var MAX_VOICES = 8;
  var MAX_RECENT = 48;
  var RATE_WINDOW = 1000;
  var MAX_CUES_PER_WINDOW = 32;
  var COALESCE_MS = 55;
  var MAX_COUNTER = 999999;
  // Reduced Effects is an accessibility/performance preference, not a mute
  // switch.  Keep errors, terminal/result and other state-defining cues while
  // dropping only the high-frequency/non-critical presentation chatter.
  var REDUCED_EFFECT_CUES = {
    ui_confirm: true, ui_cancel: true, ui_toggle: true, settings_change: true,
    equip_change: true, route_enter: true,
    game_select: true, chat_sent: true, chat_unread: true,
    social_update: true, playline_post: true, expression_received: true,
    match_chat_incoming: true, match_chat_sent: true,
    turn_opponent: true, tank_move: true, tetris_move: true,
    tetris_rotate: true, tetris_soft_drop: true, xiangqi_select: true
  };
  var CUE_TYPES = [
    'ui_confirm', 'ui_cancel', 'ui_error', 'ui_toggle', 'ui_test',
    'settings_change', 'shop_purchase', 'shop_error', 'equip_change',
    'social_update', 'social_error', 'playline_post', 'playline_error',
    'expression_received', 'match_chat_incoming', 'match_chat_sent', 'daily_claim', 'profile_saved',
    'auth_success', 'auth_error', 'route_enter', 'game_select',
    'room_joined', 'peer_join', 'peer_leave', 'ready', 'host_changed',
    'reconnect_ok', 'reconnect_failed', 'offline_enter', 'online_restore',
    'chat_incoming', 'chat_sent', 'chat_unread',
    'reward_win', 'reward_draw', 'reward_loss', 'coins_gain', 'xp_gain',
    'level_up', 'achievement_unlock',
    'match_countdown', 'match_start', 'turn_self', 'turn_opponent',
    'match_pause', 'match_resume', 'match_timeout', 'match_surrender',
    'match_draw', 'match_win', 'match_loss', 'match_terminal',
    'gomoku_place', 'gomoku_line',
    'ludo_roll', 'ludo_move', 'ludo_capture', 'ludo_home',
    'monopoly_roll', 'monopoly_land', 'monopoly_purchase',
    'monopoly_pay', 'monopoly_auction', 'monopoly_bankrupt',
    'tank_move', 'tank_fire', 'tank_hit', 'tank_ko', 'tank_respawn',
    'tetris_move', 'tetris_rotate', 'tetris_soft_drop', 'tetris_hard_drop',
    'tetris_lock', 'tetris_line_clear', 'tetris_garbage', 'tetris_ko',
    'xiangqi_select', 'xiangqi_move', 'xiangqi_capture', 'xiangqi_check',
    'xiangqi_checkmate', 'xiangqi_clock_low'
  ];
  // Each family has two to four deterministic variants.  Families are shared
  // intentionally (for sonic consistency), while every cue below makes an
  // explicit choice; there is no accidental generic catch-all sound.
  var TONE_FAMILIES = {
    ui_confirm: [{ f: 520, f2: 650, d: .055, g: .075, w: 'sine' }, { f: 560, f2: 700, d: .05, g: .07, w: 'sine' }, { f: 490, f2: 620, d: .06, g: .075, w: 'triangle' }],
    ui_cancel: [{ f: 420, f2: 310, d: .075, g: .07, w: 'sine' }, { f: 390, f2: 285, d: .08, g: .075, w: 'triangle' }],
    ui_error: [{ f: 180, f2: 125, d: .13, g: .105, w: 'sawtooth' }, { f: 205, f2: 145, d: .12, g: .1, w: 'square' }],
    ui_toggle: [{ f: 660, d: .045, g: .06, w: 'sine' }, { f: 720, d: .04, g: .055, w: 'triangle' }],
    ui_test: [{ f: 440, f2: 880, d: .18, g: .1, w: 'sine' }, { f: 523, f2: 1046, d: .17, g: .095, w: 'triangle' }],
    navigation: [{ f: 310, f2: 390, d: .07, g: .055, w: 'sine' }, { f: 340, f2: 425, d: .065, g: .055, w: 'triangle' }],
    presence_up: [{ f: 440, f2: 660, d: .11, g: .08, w: 'sine' }, { f: 494, f2: 740, d: .105, g: .075, w: 'triangle' }],
    presence_down: [{ f: 390, f2: 245, d: .12, g: .075, w: 'sine' }, { f: 350, f2: 220, d: .13, g: .08, w: 'triangle' }],
    network_up: [{ f: 330, f2: 660, d: .15, g: .08, w: 'sine' }, { f: 370, f2: 740, d: .145, g: .075, w: 'triangle' }],
    network_down: [{ f: 260, f2: 130, d: .17, g: .085, w: 'triangle' }, { f: 230, f2: 115, d: .18, g: .09, w: 'sine' }],
    chat_in: [{ f: 740, f2: 880, d: .09, g: .065, w: 'sine' }, { f: 784, f2: 988, d: .085, g: .06, w: 'triangle' }],
    chat_out: [{ f: 620, f2: 760, d: .07, g: .05, w: 'sine' }, { f: 660, f2: 810, d: .065, g: .05, w: 'triangle' }],
    reward: [{ f: 523, f2: 784, d: .16, g: .1, w: 'triangle' }, { f: 587, f2: 880, d: .15, g: .095, w: 'sine' }, { f: 659, f2: 988, d: .145, g: .09, w: 'triangle' }],
    reward_neutral: [{ f: 392, f2: 494, d: .13, g: .075, w: 'sine' }, { f: 440, f2: 523, d: .12, g: .075, w: 'triangle' }],
    reward_loss: [{ f: 330, f2: 196, d: .18, g: .085, w: 'sine' }, { f: 294, f2: 175, d: .19, g: .085, w: 'triangle' }],
    reward_major: [{ f: 523, f2: 1046, d: .25, g: .115, w: 'triangle' }, { f: 659, f2: 1318, d: .23, g: .11, w: 'sine' }, { f: 784, f2: 1175, d: .24, g: .11, w: 'triangle' }],
    countdown: [{ f: 440, d: .075, g: .08, w: 'sine' }, { f: 494, d: .07, g: .075, w: 'triangle' }],
    match_start: [{ f: 392, f2: 784, d: .18, g: .105, w: 'triangle' }, { f: 440, f2: 880, d: .17, g: .1, w: 'sine' }],
    turn_self: [{ f: 620, f2: 780, d: .09, g: .07, w: 'sine' }, { f: 660, f2: 825, d: .085, g: .065, w: 'triangle' }],
    turn_other: [{ f: 310, d: .07, g: .05, w: 'sine' }, { f: 350, d: .065, g: .05, w: 'triangle' }],
    match_pause: [{ f: 360, f2: 270, d: .13, g: .07, w: 'triangle' }, { f: 400, f2: 300, d: .12, g: .07, w: 'sine' }],
    match_resume: [{ f: 300, f2: 450, d: .12, g: .075, w: 'triangle' }, { f: 330, f2: 495, d: .115, g: .07, w: 'sine' }],
    terminal_win: [{ f: 523, f2: 1046, d: .3, g: .13, w: 'triangle' }, { f: 659, f2: 988, d: .28, g: .125, w: 'sine' }, { f: 784, f2: 1175, d: .27, g: .12, w: 'triangle' }],
    terminal_draw: [{ f: 440, f2: 523, d: .22, g: .09, w: 'sine' }, { f: 392, f2: 494, d: .23, g: .09, w: 'triangle' }],
    terminal_loss: [{ f: 330, f2: 165, d: .28, g: .1, w: 'sine' }, { f: 294, f2: 147, d: .3, g: .1, w: 'triangle' }],
    terminal: [{ f: 660, f2: 440, d: .24, g: .115, w: 'triangle' }, { f: 550, f2: 367, d: .23, g: .11, w: 'sine' }, { f: 784, f2: 523, d: .25, g: .11, w: 'triangle' }],
    gomoku_stone: [{ f: 410, f2: 350, d: .075, g: .095, w: 'triangle' }, { f: 470, f2: 395, d: .07, g: .09, w: 'sine' }, { f: 380, f2: 320, d: .08, g: .095, w: 'triangle' }],
    gomoku_line: [{ f: 523, f2: 988, d: .22, g: .115, w: 'triangle' }, { f: 587, f2: 1046, d: .21, g: .11, w: 'sine' }],
    ludo_roll: [{ f: 205, f2: 410, d: .09, g: .085, w: 'square' }, { f: 230, f2: 460, d: .085, g: .08, w: 'triangle' }, { f: 185, f2: 370, d: .095, g: .085, w: 'square' }],
    ludo_move: [{ f: 330, f2: 392, d: .075, g: .08, w: 'triangle' }, { f: 392, f2: 440, d: .07, g: .075, w: 'sine' }, { f: 440, f2: 494, d: .065, g: .075, w: 'triangle' }],
    ludo_capture: [{ f: 196, f2: 98, d: .16, g: .12, w: 'square' }, { f: 220, f2: 110, d: .15, g: .115, w: 'sawtooth' }],
    ludo_home: [{ f: 494, f2: 988, d: .2, g: .105, w: 'triangle' }, { f: 523, f2: 1046, d: .19, g: .1, w: 'sine' }],
    monopoly_roll: [{ f: 220, f2: 330, d: .1, g: .08, w: 'square' }, { f: 247, f2: 370, d: .095, g: .08, w: 'triangle' }, { f: 277, f2: 415, d: .09, g: .075, w: 'square' }],
    monopoly_land: [{ f: 294, f2: 247, d: .085, g: .075, w: 'triangle' }, { f: 330, f2: 277, d: .08, g: .07, w: 'sine' }],
    monopoly_buy: [{ f: 523, f2: 784, d: .16, g: .1, w: 'triangle' }, { f: 587, f2: 880, d: .15, g: .095, w: 'sine' }],
    monopoly_pay: [{ f: 440, f2: 294, d: .14, g: .085, w: 'triangle' }, { f: 392, f2: 262, d: .15, g: .085, w: 'sine' }],
    monopoly_auction: [{ f: 350, f2: 700, d: .13, g: .09, w: 'square' }, { f: 392, f2: 784, d: .12, g: .085, w: 'triangle' }],
    monopoly_bankrupt: [{ f: 247, f2: 82, d: .28, g: .11, w: 'sawtooth' }, { f: 220, f2: 73, d: .3, g: .11, w: 'square' }],
    tank_move: [{ f: 100, f2: 125, d: .05, g: .055, w: 'square' }, { f: 120, f2: 145, d: .045, g: .05, w: 'sawtooth' }],
    tank_fire: [{ f: 250, f2: 70, d: .095, g: .14, w: 'square' }, { f: 220, f2: 62, d: .105, g: .145, w: 'sawtooth' }, { f: 285, f2: 80, d: .09, g: .135, w: 'square' }],
    tank_hit: [{ f: 125, f2: 55, d: .16, g: .17, w: 'square' }, { f: 105, f2: 48, d: .18, g: .175, w: 'sawtooth' }, { f: 145, f2: 65, d: .15, g: .165, w: 'square' }],
    tank_ko: [{ f: 180, f2: 42, d: .3, g: .19, w: 'sawtooth' }, { f: 155, f2: 38, d: .32, g: .19, w: 'square' }],
    tank_respawn: [{ f: 110, f2: 440, d: .22, g: .105, w: 'triangle' }, { f: 130, f2: 520, d: .21, g: .1, w: 'sine' }],
    tetris_move: [{ f: 300, d: .035, g: .05, w: 'square' }, { f: 350, d: .03, g: .045, w: 'triangle' }],
    tetris_rotate: [{ f: 420, f2: 560, d: .055, g: .06, w: 'square' }, { f: 460, f2: 610, d: .05, g: .055, w: 'triangle' }],
    tetris_drop: [{ f: 260, f2: 130, d: .07, g: .065, w: 'square' }, { f: 300, f2: 150, d: .065, g: .06, w: 'triangle' }],
    tetris_lock: [{ f: 170, f2: 120, d: .09, g: .085, w: 'square' }, { f: 200, f2: 140, d: .08, g: .08, w: 'triangle' }],
    tetris_clear: [{ f: 520, f2: 920, d: .17, g: .115, w: 'square' }, { f: 620, f2: 1040, d: .15, g: .11, w: 'triangle' }, { f: 740, f2: 1180, d: .14, g: .105, w: 'sine' }],
    tetris_garbage: [{ f: 150, f2: 75, d: .17, g: .12, w: 'sawtooth' }, { f: 170, f2: 85, d: .16, g: .115, w: 'square' }],
    tetris_ko: [{ f: 247, f2: 82, d: .26, g: .13, w: 'square' }, { f: 220, f2: 73, d: .28, g: .135, w: 'sawtooth' }],
    xiangqi_select: [{ f: 440, d: .05, g: .055, w: 'sine' }, { f: 494, d: .045, g: .05, w: 'triangle' }],
    xiangqi_move: [{ f: 260, f2: 220, d: .075, g: .08, w: 'triangle' }, { f: 310, f2: 260, d: .07, g: .075, w: 'sine' }, { f: 235, f2: 196, d: .08, g: .08, w: 'triangle' }],
    xiangqi_capture: [{ f: 220, f2: 110, d: .15, g: .12, w: 'square' }, { f: 247, f2: 123, d: .14, g: .115, w: 'sawtooth' }],
    xiangqi_check: [{ f: 659, f2: 988, d: .17, g: .11, w: 'square' }, { f: 698, f2: 1046, d: .16, g: .105, w: 'triangle' }],
    xiangqi_mate: [{ f: 523, f2: 1568, d: .28, g: .13, w: 'square' }, { f: 587, f2: 1760, d: .27, g: .125, w: 'triangle' }],
    xiangqi_clock: [{ f: 880, f2: 660, d: .08, g: .09, w: 'square' }, { f: 988, f2: 740, d: .075, g: .085, w: 'triangle' }]
  };
  var CUE_PROFILES = {
    ui_confirm:'ui_confirm', ui_cancel:'ui_cancel', ui_error:'ui_error', ui_toggle:'ui_toggle', ui_test:'ui_test',
    settings_change:'ui_toggle', shop_purchase:'reward_major', shop_error:'ui_error', equip_change:'ui_confirm',
    social_update:'presence_up', social_error:'ui_error', playline_post:'chat_out', playline_error:'ui_error',
    expression_received:'chat_in', match_chat_incoming:'chat_in', match_chat_sent:'chat_out',
    daily_claim:'reward_major', profile_saved:'ui_confirm',
    auth_success:'presence_up', auth_error:'ui_error', route_enter:'navigation', game_select:'navigation',
    room_joined:'presence_up', peer_join:'presence_up', peer_leave:'presence_down', ready:'presence_up', host_changed:'navigation',
    reconnect_ok:'network_up', reconnect_failed:'network_down', offline_enter:'network_down', online_restore:'network_up',
    chat_incoming:'chat_in', chat_sent:'chat_out', chat_unread:'chat_in',
    reward_win:'reward', reward_draw:'reward_neutral', reward_loss:'reward_loss', coins_gain:'reward', xp_gain:'reward_neutral', level_up:'reward_major', achievement_unlock:'reward_major',
    match_countdown:'countdown', match_start:'match_start', turn_self:'turn_self', turn_opponent:'turn_other',
    match_pause:'match_pause', match_resume:'match_resume', match_timeout:'terminal_loss', match_surrender:'terminal_loss',
    match_draw:'terminal_draw', match_win:'terminal_win', match_loss:'terminal_loss', match_terminal:'terminal',
    gomoku_place:'gomoku_stone', gomoku_line:'gomoku_line',
    ludo_roll:'ludo_roll', ludo_move:'ludo_move', ludo_capture:'ludo_capture', ludo_home:'ludo_home',
    monopoly_roll:'monopoly_roll', monopoly_land:'monopoly_land', monopoly_purchase:'monopoly_buy', monopoly_pay:'monopoly_pay', monopoly_auction:'monopoly_auction', monopoly_bankrupt:'monopoly_bankrupt',
    tank_move:'tank_move', tank_fire:'tank_fire', tank_hit:'tank_hit', tank_ko:'tank_ko', tank_respawn:'tank_respawn',
    tetris_move:'tetris_move', tetris_rotate:'tetris_rotate', tetris_soft_drop:'tetris_drop', tetris_hard_drop:'tetris_drop', tetris_lock:'tetris_lock', tetris_line_clear:'tetris_clear', tetris_garbage:'tetris_garbage', tetris_ko:'tetris_ko',
    xiangqi_select:'xiangqi_select', xiangqi_move:'xiangqi_move', xiangqi_capture:'xiangqi_capture', xiangqi_check:'xiangqi_check', xiangqi_checkmate:'xiangqi_mate', xiangqi_clock_low:'xiangqi_clock'
  };
  var HAPTIC_MS = {
    ui_confirm:8, ui_error:16, ui_toggle:8, settings_change:8, shop_purchase:18, shop_error:18,
    equip_change:8, social_update:8, social_error:18, playline_post:8, playline_error:18,
    expression_received:8, match_chat_incoming:8, match_chat_sent:6, daily_claim:22, profile_saved:10,
    auth_success:12, auth_error:18,
    room_joined:10, peer_join:8, peer_leave:10, ready:10, reconnect_ok:10, reconnect_failed:18,
    chat_incoming:8, reward_win:16, reward_loss:14, coins_gain:8, level_up:22, achievement_unlock:24,
    match_countdown:8, match_start:16, match_timeout:24, match_surrender:20, match_win:28, match_loss:26, match_terminal:30,
    gomoku_place:9, gomoku_line:22, ludo_roll:8, ludo_move:9, ludo_capture:20, ludo_home:18,
    monopoly_roll:8, monopoly_land:7, monopoly_purchase:14, monopoly_pay:10, monopoly_auction:12, monopoly_bankrupt:24,
    tank_move:5, tank_fire:16, tank_hit:28, tank_ko:32, tank_respawn:14,
    tetris_rotate:6, tetris_hard_drop:12, tetris_lock:9, tetris_line_clear:20, tetris_garbage:18, tetris_ko:28,
    xiangqi_select:6, xiangqi_move:9, xiangqi_capture:18, xiangqi_check:20, xiangqi_checkmate:30, xiangqi_clock_low:14
  };
  // Optional BGM defaults to off.  When enabled these quiet three-layer beds
  // avoid a single sustained test tone while keeping the zero-resource,
  // timer-free fallback deterministic and cheap to suspend or dispose.
  var MUSIC_PROFILES = {
    home: [
      { f:130.81, g:.018, w:'sine' },
      { f:196.00, g:.012, w:'triangle' },
      { f:261.63, g:.006, w:'sine' }
    ],
    game: [
      { f:146.83, g:.017, w:'triangle' },
      { f:220.00, g:.011, w:'sine' },
      { f:293.66, g:.006, w:'triangle' }
    ],
    result: [
      { f:174.61, g:.016, w:'sine' },
      { f:261.63, g:.011, w:'triangle' },
      { f:349.23, g:.006, w:'sine' }
    ]
  };

  function freeze(value) { return Object.freeze(value); }
  function own(value, key) {
    if (!value || typeof value !== 'object') return { present: false, ok: false, value: undefined };
    try {
      var d = Object.getOwnPropertyDescriptor(value, key);
      if (!d) return { present: false, ok: true, value: undefined };
      if (!Object.prototype.hasOwnProperty.call(d, 'value')) return { present: true, ok: false, value: undefined };
      return { present: true, ok: true, value: d.value };
    } catch (_e) { return { present: false, ok: false, value: undefined }; }
  }
  function prop(value, key) {
    var d = own(value, key);
    if (d.present || !d.ok) return d;
    try { return { present: true, ok: true, value: value[key] }; } catch (_e) { return { present: true, ok: false, value: undefined }; }
  }
  function plain(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    try { return Object.prototype.toString.call(value) === '[object Object]'; } catch (_e) { return false; }
  }
  function finite(value) { return typeof value === 'number' && isFinite(value); }
  function clamp(value, lo, hi, fallback) { return finite(value) ? Math.max(lo, Math.min(hi, value)) : fallback; }
  function thenable(value) { return !!value && (typeof value === 'object' || typeof value === 'function') && typeof value.then === 'function'; }
  function call(fn, receiver, args) { try { return typeof fn === 'function' ? { ok: true, value: fn.apply(receiver, args || []) } : { ok: false }; } catch (_e) { return { ok: false }; } }
  function ignorePromise(value) {
    if (!value || typeof value.then !== 'function') return;
    try {
      if (typeof value.catch === 'function') value.catch(function ignoreFailure() {});
    } catch (_e) {}
  }
  function setParam(param, value, at) {
    if (!param) return false;
    var setter = prop(param, 'setValueAtTime');
    if (setter.ok && setter.present && typeof setter.value === 'function' && call(setter.value, param, [value, at]).ok) return true;
    try { param.value = value; return true; } catch (_e) { return false; }
  }
  function disconnect(node) { var m = prop(node, 'disconnect'); if (m.ok && m.present) call(m.value, node, []); }
  function stop(node) { var m = prop(node, 'stop'); if (m.ok && m.present) { var r = call(m.value, node, []); if (!r.ok) call(m.value, node, [0]); } }
  function hash(value) {
    var text = String(value || ''); var h = 2166136261;
    for (var i = 0; i < text.length; i += 1) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function result(ok, reason) { return freeze({ accepted: ok === true, reason: reason || null }); }

  function create(options) {
    var opts = plain(options) ? options : {};
    var enabled = own(opts, 'enabled');
    var busField = own(opts, 'bus');
    var factory = own(opts, 'audioContextFactory');
    var vibrate = own(opts, 'vibrate');
    var nowField = own(opts, 'now');
    var resolverField = own(opts, 'variantResolver');
    var bus = busField.ok && busField.present && busField.value && typeof busField.value.subscribe === 'function' ? busField.value : null;
    var state = {
      enabled: enabled.ok && enabled.present && enabled.value === true && !!bus,
      disposed: false, subscribed: false, unsubscribe: null, context: null, contextOwned: false, unlocked: false,
      master: null, sfx: null, music: null, musicVoice: null, musicReserved: 0, voices: [], recent: [], cueTimes: [], lastNow: 0,
      unlockPending: null, unlockGeneration: 0,
      hidden: false, reducedMotion: false, reducedEffects: false, muted: false,
      audioEnabled: true, sfxEnabled: true, musicEnabled: true, hapticsEnabled: true, spatialEnabled: true,
      masterVolume: 1, sfxVolume: 1, musicVolume: .35, hapticsVolume: 1,
      counters: { unlockAttempts: 0, audioStarted: 0, audioSkipped: 0, audioFailures: 0, hapticCalls: 0, hapticFailures: 0, coalesced: 0, rateLimited: 0, variants: 0 }
    };
    var clock = nowField.ok && nowField.present && typeof nowField.value === 'function' ? nowField.value : null;
    var variantResolver = resolverField.ok && resolverField.present && typeof resolverField.value === 'function' ? resolverField.value : null;
    var initialSettings = own(opts, 'settings');
    function applySettingValues(settings) {
      if (!plain(settings)) return;
      if (Object.prototype.hasOwnProperty.call(settings, 'mg_audio_sfx')) state.sfxEnabled = settings.mg_audio_sfx === true;
      if (Object.prototype.hasOwnProperty.call(settings, 'mg_audio_music')) state.musicEnabled = settings.mg_audio_music === true;
      if (Object.prototype.hasOwnProperty.call(settings, 'mg_audio_haptics')) state.hapticsEnabled = settings.mg_audio_haptics === true;
      if (Object.prototype.hasOwnProperty.call(settings, 'mg_audio_spatial')) state.spatialEnabled = settings.mg_audio_spatial === true;
      if (Object.prototype.hasOwnProperty.call(settings, 'mg_audio_reduced_effects')) state.reducedEffects = settings.mg_audio_reduced_effects === true;
      var volumeFields = [
        ['masterVolume', 'mg_audio_master_volume', 1],
        ['sfxVolume', 'mg_audio_sfx_volume', 1],
        ['musicVolume', 'mg_audio_music_volume', .35],
        ['hapticsVolume', 'mg_audio_haptics_volume', 1]
      ];
      for (var volumeIndex = 0; volumeIndex < volumeFields.length; volumeIndex += 1) {
        var field = volumeFields[volumeIndex];
        var direct = own(settings, field[0]);
        var stored = own(settings, field[1]);
        var candidate = direct.present ? direct : stored;
        if (candidate.ok && candidate.present && finite(candidate.value) && candidate.value >= 0 && candidate.value <= 1) state[field[0]] = candidate.value;
      }
    }
    if (initialSettings.ok && initialSettings.present) {
      // A supplied settings object is an explicit user preference boundary;
      // missing or malformed frozen keys stay off until set correctly.
      state.sfxEnabled = false; state.musicEnabled = false; state.hapticsEnabled = false; state.spatialEnabled = false;
      applySettingValues(initialSettings.value);
    }
    function now() { var n = Date.now(); if (clock) { try { n = clock(); } catch (_e) {} } if (!finite(n) || n < state.lastNow) n = state.lastNow; state.lastNow = Math.floor(n); return state.lastNow; }
    state.lastNow = now();
    function inc(key) { if (state.counters[key] < MAX_COUNTER) state.counters[key] += 1; }
    function contextTime() { var p = prop(state.context, 'currentTime'); return p.ok && p.present && finite(p.value) ? p.value : 0; }
    function buildGraph() {
      var c = state.context; var mk = prop(c, 'createGain');
      if (!mk.ok || !mk.present || typeof mk.value !== 'function') return false;
      var master = call(mk.value, c, []); var sfx = call(mk.value, c, []); var music = call(mk.value, c, []);
      if (!master.ok || !sfx.ok || !music.ok) return false;
      state.master = master.value; state.sfx = sfx.value; state.music = music.value;
      var dest = prop(c, 'destination'); var mc = prop(state.master, 'connect'); var sc = prop(state.sfx, 'connect'); var uc = prop(state.music, 'connect');
      if (!dest.ok || !dest.present || !mc.ok || !sc.ok || !uc.ok || typeof mc.value !== 'function' || typeof sc.value !== 'function' || typeof uc.value !== 'function') return false;
      if (!call(sc.value, state.sfx, [state.master]).ok || !call(uc.value, state.music, [state.master]).ok || !call(mc.value, state.master, [dest.value]).ok) return false;
      applyGains(); return true;
    }
    function applyGains() {
      var t = contextTime(); setParam(prop(state.master, 'gain').value, state.masterVolume, t);
      setParam(prop(state.sfx, 'gain').value, state.sfxEnabled && state.audioEnabled && !state.muted ? state.sfxVolume : 0, t);
      setParam(prop(state.music, 'gain').value, state.musicEnabled && state.audioEnabled && !state.muted ? state.musicVolume : 0, t);
    }
    function removeVoice(v) { if (!v || v.released) return; v.released = true; var i = state.voices.indexOf(v); if (i !== -1) state.voices.splice(i, 1); disconnect(v.panner); disconnect(v.gain); disconnect(v.oscillator); }
    function stopVoices() { while (state.voices.length) { var voice = state.voices[state.voices.length - 1]; stop(voice.oscillator); removeVoice(voice); } }
    function activeVoiceCount() { return state.voices.length + state.musicReserved + (state.musicVoice && Array.isArray(state.musicVoice.voices) ? state.musicVoice.voices.length : 0); }
    function reducedEffectSuppressed(type) { return state.reducedEffects && REDUCED_EFFECT_CUES[type] === true; }
    function createPanner(pan) {
      if (!state.spatialEnabled) return null;
      var maker = prop(state.context, 'createStereoPanner'); if (!maker.ok || !maker.present || typeof maker.value !== 'function') return null;
      var made = call(maker.value, state.context, []); if (!made.ok || !made.value) return null;
      var p = made.value; var pp = prop(p, 'pan'); if (!pp.ok || !pp.present || !setParam(pp.value, clamp(pan, -1, 1, 0), contextTime())) { disconnect(p); return null; } return p;
    }
    function playCue(cue) {
      if (!state.unlocked || !state.context || state.hidden || state.muted || !state.audioEnabled || !state.sfxEnabled || reducedEffectSuppressed(cue.type)) { inc('audioSkipped'); return false; }
      if (activeVoiceCount() >= MAX_VOICES) { inc('audioSkipped'); return false; }
      var type = cue.type; var tones = TONE_FAMILIES[CUE_PROFILES[type]] || TONE_FAMILIES.ui_confirm; var variant = hash(cue.id) % tones.length;
      if (variantResolver) { try { var selected = variantResolver(type, cue.id, tones.length); if (finite(selected)) variant = Math.max(0, Math.min(tones.length - 1, Math.floor(selected))); } catch (_resolverError) {} }
      inc('variants');
      var tone = tones[variant]; var c = state.context; var om = prop(c, 'createOscillator'); var gm = prop(c, 'createGain');
      if (!om.ok || !gm.ok || !om.present || !gm.present || typeof om.value !== 'function' || typeof gm.value !== 'function') { inc('audioFailures'); return false; }
      var o = call(om.value, c, []); var g = call(gm.value, c, []); if (!o.ok || !g.ok || !o.value || !g.value) { inc('audioFailures'); return false; }
      var p = createPanner(cue.pan); var voice = { type: type, oscillator: o.value, gain: g.value, panner: p, released: false }; var t = contextTime();
      var fp = prop(o.value, 'frequency'); var gp = prop(g.value, 'gain');
      if (fp.ok && fp.present) {
        setParam(fp.value, tone.f, t);
        if (finite(tone.f2) && tone.f2 > 0) {
          var frequencyRamp = prop(fp.value, 'exponentialRampToValueAtTime');
          if (frequencyRamp.ok && frequencyRamp.present && typeof frequencyRamp.value === 'function') call(frequencyRamp.value, fp.value, [tone.f2, t + tone.d]);
          else setParam(fp.value, tone.f2, t + tone.d);
        }
      }
      if (gp.ok && gp.present) {
        setParam(gp.value, tone.g * clamp(cue.intensity, 0, 1, 1), t);
        var gainRamp = prop(gp.value, 'exponentialRampToValueAtTime');
        if (gainRamp.ok && gainRamp.present && typeof gainRamp.value === 'function') call(gainRamp.value, gp.value, [.001, t + tone.d]);
        else setParam(gp.value, .001, t + tone.d);
      }
      try { o.value.type = tone.w || 'sine'; } catch (_e) {}
      var oc = prop(o.value, 'connect'); var gc = prop(g.value, 'connect'); var dest = p || state.sfx; var dc = prop(dest, 'connect');
      if (!oc.ok || !gc.ok || !oc.present || !gc.present || typeof oc.value !== 'function' || typeof gc.value !== 'function' || !call(oc.value, o.value, [g.value]).ok || !call(gc.value, g.value, [p || state.sfx]).ok) { inc('audioFailures'); removeVoice(voice); return false; }
      if (p) { var pc = prop(p, 'connect'); if (!pc.ok || !pc.present || typeof pc.value !== 'function' || !call(pc.value, p, [state.sfx]).ok) { inc('audioFailures'); removeVoice(voice); return false; } }
      state.voices.push(voice); try { o.value.onended = function () { removeVoice(voice); }; } catch (_e2) {}
      var start = prop(o.value, 'start'); var stopm = prop(o.value, 'stop'); if (!start.ok || !start.present || typeof start.value !== 'function' || !call(start.value, o.value, []).ok) { inc('audioFailures'); removeVoice(voice); return false; }
      if (stopm.ok && stopm.present && typeof stopm.value === 'function') call(stopm.value, o.value, [t + tone.d]); inc('audioStarted'); return true;
    }
    function playHaptic(cue) { var base = HAPTIC_MS[cue.type]; if (!finite(base) || base <= 0 || !state.hapticsEnabled || state.hidden || state.reducedMotion || reducedEffectSuppressed(cue.type) || state.hapticsVolume <= 0 || !vibrate.ok || !vibrate.present || typeof vibrate.value !== 'function') return false; var scaled = base * clamp(cue.intensity, 0, 1, 1) * state.hapticsVolume; if (!finite(scaled) || scaled <= 0) return false; var ms = Math.max(1, Math.round(scaled)); var r = call(vibrate.value, null, [ms]); var accepted = r.ok && r.value !== false; if (accepted) inc('hapticCalls'); else inc('hapticFailures'); return accepted; }
    function onCue(cue) {
      if (!state.enabled || state.disposed || !plain(cue) || CUE_TYPES.indexOf(cue.type) === -1) return;
      var timestamp = now(); while (state.cueTimes.length && timestamp - state.cueTimes[0] > RATE_WINDOW) state.cueTimes.shift();
      var key = cue.type + ':' + String(cue.id || ''); var last = state.recent.length ? state.recent[state.recent.length - 1] : null;
      if (last && last.key === key && timestamp - last.time < COALESCE_MS) { inc('coalesced'); return; }
      if (state.cueTimes.length >= MAX_CUES_PER_WINDOW) { inc('rateLimited'); return; }
      state.recent.push({ key: key, time: timestamp }); while (state.recent.length > MAX_RECENT) state.recent.shift(); state.cueTimes.push(timestamp);
      var channels = plain(cue.channels) ? cue.channels : { audio: true, haptic: true }; if (channels.audio === true) playCue(cue); if (channels.haptic === true) playHaptic(cue);
    }
    function unlock() {
      if (state.disposed) return result(false, 'disposed'); if (!state.enabled) return result(false, 'disabled');
      if (state.unlockPending) return state.unlockPending;
      inc('unlockAttempts'); if (!state.context) { var made = factory.ok && factory.present && typeof factory.value === 'function' ? call(factory.value, null, []) : { ok: false }; if (!made.ok || !made.value) return result(false, 'audio_unavailable'); state.context = made.value; state.contextOwned = true; if (!buildGraph()) { disconnect(state.music); disconnect(state.sfx); disconnect(state.master); var brokenContext = state.context; var brokenClose = prop(brokenContext, 'close'); if (brokenClose.ok && brokenClose.present) { var brokenClosed = call(brokenClose.value, brokenContext, []); ignorePromise(brokenClosed.value); } state.context = null; state.master = state.sfx = state.music = null; state.contextOwned = false; inc('audioFailures'); return result(false, 'audio_unavailable'); } }
      var contextAtAttempt = state.context; var generationAtAttempt = ++state.unlockGeneration;
      var resume = prop(state.context, 'resume'); var resumedResult = !resume.present || typeof resume.value !== 'function' ? { ok: true } : call(resume.value, state.context, []);
      if (!resumedResult.ok) { state.unlocked = false; inc('audioFailures'); return result(false, 'resume_failed'); }
      if (thenable(resumedResult.value)) {
        var settled = false; var pending;
        function finish(outcome) {
          settled = true;
          if (state.unlockPending === pending) state.unlockPending = null;
          if (state.disposed || state.context !== contextAtAttempt || state.unlockGeneration !== generationAtAttempt) return result(false, state.disposed ? 'disposed' : 'stale_unlock');
          state.unlocked = outcome.accepted === true;
          if (pending) {
            try { pending.accepted = outcome.accepted; pending.reason = outcome.reason; } catch (_pendingMutationError) {}
          }
          return outcome;
        }
        try {
          pending = resumedResult.value.then(function () { return finish(result(true, null)); }, function () { inc('audioFailures'); return finish(result(false, 'resume_failed')); });
          try { pending.accepted = false; pending.reason = 'resume_pending'; } catch (_pendingMutationError2) {}
          state.unlockPending = pending;
          if (settled) state.unlockPending = null;
          return pending;
        } catch (_resumeError) {
          state.unlocked = false; inc('audioFailures'); return result(false, 'resume_failed');
        }
      }
      state.unlocked = true; return result(true, null);
    }
    function setPreferences(patch) {
      if (state.disposed) return result(false, 'disposed'); if (!plain(patch)) return result(false, 'invalid_preferences');
      var source = patch;
      if (Object.prototype.hasOwnProperty.call(patch, 'mg_audio_sfx') || Object.prototype.hasOwnProperty.call(patch, 'mg_audio_music') || Object.prototype.hasOwnProperty.call(patch, 'mg_audio_haptics') || Object.prototype.hasOwnProperty.call(patch, 'mg_audio_spatial') || Object.prototype.hasOwnProperty.call(patch, 'mg_audio_reduced_effects')) {
        source = {};
        var settingKeys = Object.keys(patch);
        for (var sk = 0; sk < settingKeys.length; sk += 1) source[settingKeys[sk]] = patch[settingKeys[sk]];
        if (Object.prototype.hasOwnProperty.call(patch, 'mg_audio_sfx')) source.sfxEnabled = patch.mg_audio_sfx;
        if (Object.prototype.hasOwnProperty.call(patch, 'mg_audio_music')) source.musicEnabled = patch.mg_audio_music;
        if (Object.prototype.hasOwnProperty.call(patch, 'mg_audio_haptics')) source.hapticsEnabled = patch.mg_audio_haptics;
        if (Object.prototype.hasOwnProperty.call(patch, 'mg_audio_spatial')) source.spatialEnabled = patch.mg_audio_spatial;
        if (Object.prototype.hasOwnProperty.call(patch, 'mg_audio_reduced_effects')) source.reducedEffects = patch.mg_audio_reduced_effects;
      }
      var bools = ['enabled', 'hidden', 'reducedMotion', 'reducedEffects', 'muted', 'audioEnabled', 'sfxEnabled', 'musicEnabled', 'hapticsEnabled', 'spatialEnabled'];
      for (var i = 0; i < bools.length; i += 1) if (Object.prototype.hasOwnProperty.call(source, bools[i])) { if (typeof source[bools[i]] !== 'boolean') return result(false, 'invalid_preferences'); state[bools[i]] = source[bools[i]]; }
      var nums = ['masterVolume', 'sfxVolume', 'musicVolume', 'hapticsVolume']; for (var n = 0; n < nums.length; n += 1) if (Object.prototype.hasOwnProperty.call(source, nums[n])) { if (!finite(source[nums[n]]) || source[nums[n]] < 0 || source[nums[n]] > 1) return result(false, 'invalid_preferences'); state[nums[n]] = source[nums[n]]; }
      if (state.context) applyGains();
      if (state.hidden || state.muted || !state.audioEnabled) { stopVoices(); stopMusic(); }
      else {
        if (!state.sfxEnabled) stopVoices();
        if (!state.musicEnabled) stopMusic();
      }
      return result(true, null);
    }
    function playMusic(track) {
      if (state.disposed || !state.unlocked || !state.musicEnabled || !state.audioEnabled || state.muted || state.hidden) return result(false, 'inactive');
      if (state.musicVoice && state.musicVoice.track === track) return result(true, null);
      if (state.musicVoice) stopMusic();
      var profile = MUSIC_PROFILES[track] || MUSIC_PROFILES.home;
      if (activeVoiceCount() + profile.length > MAX_VOICES) return result(false, 'voice_limit');
      var om = prop(state.context, 'createOscillator'); var gm = prop(state.context, 'createGain');
      if (!om.ok || !gm.ok || !om.present || !gm.present || typeof om.value !== 'function' || typeof gm.value !== 'function') return result(false, 'audio_unavailable');
      state.musicReserved = profile.length;
      var voices = [];
      for (var layerIndex = 0; layerIndex < profile.length; layerIndex += 1) {
        var layer = profile[layerIndex]; var o = call(om.value, state.context, []); var g = call(gm.value, state.context, []);
        if (!o.ok || !g.ok || !o.value || !g.value) { for (var cleanupIndex = 0; cleanupIndex < voices.length; cleanupIndex += 1) { stop(voices[cleanupIndex].oscillator); disconnect(voices[cleanupIndex].gain); disconnect(voices[cleanupIndex].oscillator); } state.musicReserved = 0; return result(false, 'audio_unavailable'); }
        var gp = prop(g.value, 'gain'); if (gp.ok && gp.present) setParam(gp.value, layer.g, contextTime());
        var fp = prop(o.value, 'frequency'); if (fp.ok && fp.present) setParam(fp.value, layer.f, contextTime());
        try { o.value.type = layer.w || 'sine'; } catch (_e) {}
        var oc = prop(o.value, 'connect'); var gc = prop(g.value, 'connect'); var st = prop(o.value, 'start');
        if (!oc.ok || !oc.present || !gc.ok || !gc.present || !st.ok || !st.present ||
           !call(oc.value, o.value, [g.value]).ok || !call(gc.value, g.value, [state.music]).ok || !call(st.value, o.value, []).ok) {
          stop(o.value); disconnect(g.value); disconnect(o.value);
          for (var rollbackIndex = 0; rollbackIndex < voices.length; rollbackIndex += 1) { stop(voices[rollbackIndex].oscillator); disconnect(voices[rollbackIndex].gain); disconnect(voices[rollbackIndex].oscillator); }
          state.musicReserved = 0;
          return result(false, 'audio_unavailable');
        }
        voices.push({ oscillator:o.value, gain:g.value });
      }
      state.musicReserved = 0;
      state.musicVoice = { track:track, voices:voices }; return result(true, null);
    }
    function stopMusic() { state.musicReserved = 0; if (state.musicVoice) { var musicVoices = Array.isArray(state.musicVoice.voices) ? state.musicVoice.voices : [state.musicVoice]; for (var musicIndex = 0; musicIndex < musicVoices.length; musicIndex += 1) { stop(musicVoices[musicIndex].oscillator); disconnect(musicVoices[musicIndex].gain); disconnect(musicVoices[musicIndex].oscillator); } state.musicVoice = null; } return result(true, null, snapshot()); }
    function setLifecycle(patch) { return setPreferences(patch); }
    function setVisibility(hidden) { return setPreferences({ hidden: hidden === true }); }
    function setReducedMotion(value) { return setPreferences({ reducedMotion: value === true }); }
    function setReducedEffects(value) { return setPreferences({ reducedEffects: value === true }); }
    function setMuted(value) { return setPreferences({ muted: value === true }); }
    function dispose() { if (state.disposed) return snapshot(); state.disposed = true; state.enabled = false; state.unlockGeneration += 1; state.unlockPending = null; if (typeof state.unsubscribe === 'function') call(state.unsubscribe, null, []); state.unsubscribe = null; state.subscribed = false; stopMusic(); stopVoices(); if (state.contextOwned && state.context) { var close = prop(state.context, 'close'); if (close.ok && close.present) { var closed = call(close.value, state.context, []); ignorePromise(closed.value); } } state.context = null; state.master = state.sfx = state.music = null; state.unlocked = false; return snapshot(); }
    function snapshot() { return freeze({ enabled: state.enabled, disposed: state.disposed, subscribed: state.subscribed, unlocked: state.unlocked, contextReady: !!state.context, activeVoices: activeVoiceCount(), sfxVoices: state.voices.length, maxVoices: MAX_VOICES, musicActive: !!state.musicVoice, musicLayers: state.musicVoice && Array.isArray(state.musicVoice.voices) ? state.musicVoice.voices.length : 0, hidden: state.hidden, reducedMotion: state.reducedMotion, reducedEffects: state.reducedEffects, muted: state.muted, audioEnabled: state.audioEnabled, sfxEnabled: state.sfxEnabled, musicEnabled: state.musicEnabled, hapticsEnabled: state.hapticsEnabled, spatialEnabled: state.spatialEnabled, masterVolume: state.masterVolume, sfxVolume: state.sfxVolume, musicVolume: state.musicVolume, hapticsVolume: state.hapticsVolume, counters: freeze({ unlockAttempts: state.counters.unlockAttempts, audioStarted: state.counters.audioStarted, audioFailures: state.counters.audioFailures, audioSkipped: state.counters.audioSkipped, hapticCalls: state.counters.hapticCalls, hapticFailures: state.counters.hapticFailures, coalesced: state.counters.coalesced, rateLimited: state.counters.rateLimited, variants: state.counters.variants }) }); }
    if (state.enabled) { var sub = call(bus.subscribe, bus, [onCue]); if (sub.ok && typeof sub.value === 'function') { state.unsubscribe = sub.value; state.subscribed = true; } }
    function reset() { if (state.disposed) return result(false, 'disposed'); state.recent.length = 0; state.cueTimes.length = 0; stopVoices(); stopMusic(); return result(true, null); }
    return freeze({ unlock: unlock, setSettings: setPreferences, setPreferences: setPreferences, setLifecycle: setLifecycle, setVisibility: setVisibility, setReducedMotion: setReducedMotion, setReducedEffects: setReducedEffects, setMuted: setMuted, reset: reset, playMusic: playMusic, stopMusic: stopMusic, snapshot: snapshot, dispose: dispose });
  }
  return freeze({ create: create });
}));
