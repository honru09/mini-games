/* Full i18n contract for every shipped locale and every statically referenced
 * translation key. This intentionally fails when a new UI key is added to only
 * one language or when translated catalogs still contain Chinese fallback text. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const langs = ['zh-CN', 'en-US', 'uk-UA'];
const localeSources = Object.fromEntries(langs.map(lang => [lang, read(`public/locales/${lang}.json`)]));
const locales = Object.fromEntries(langs.map(lang => [lang, JSON.parse(localeSources[lang])]));
let failed = false;
function check(ok, message) {
  console.log((ok ? 'PASS  ' : 'FAIL  ') + message);
  if (!ok) failed = true;
}

function topLevelJsonKeys(source) {
  const keys = [];
  let depth = 0, expectingKey = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      const start = i++;
      let escaped = false;
      for (; i < source.length; i++) {
        if (escaped) { escaped = false; continue; }
        if (source[i] === '\\') { escaped = true; continue; }
        if (source[i] === '"') break;
      }
      if (depth === 1 && expectingKey) {
        let cursor = i + 1;
        while (/\s/.test(source[cursor] || '')) cursor++;
        if (source[cursor] === ':') {
          keys.push(JSON.parse(source.slice(start, i + 1)));
          expectingKey = false;
        }
      }
      continue;
    }
    if (char === '{' || char === '[') {
      depth++;
      if (depth === 1) expectingKey = true;
    } else if (char === '}' || char === ']') {
      if (depth === 1) expectingKey = false;
      depth--;
    } else if (char === ',' && depth === 1) {
      expectingKey = true;
    }
  }
  return keys;
}

const sourceFiles = [];
function collect(dir) {
  for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const relative = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(relative);
    else if (/\.(?:js|html)$/.test(entry.name) && relative !== path.join('public', 'index.html')) sourceFiles.push(relative);
  }
}
collect(path.join('public', 'src'));
sourceFiles.push(path.join('public', 'index-template.html'));
const source = sourceFiles.map(file => read(file)).join('\n');

const baseKeys = Object.keys(locales['zh-CN']).sort();
for (const lang of langs) {
  const sourceKeys = topLevelJsonKeys(localeSources[lang]);
  const seen = new Set(), duplicateKeys = new Set();
  sourceKeys.forEach(key => { if (seen.has(key)) duplicateKeys.add(key); else seen.add(key); });
  check(duplicateKeys.size === 0, `${lang} contains no duplicate top-level keys`);
  if (duplicateKeys.size) console.log('      duplicate=[' + [...duplicateKeys].join(', ') + ']');
  const keys = Object.keys(locales[lang]).sort();
  const missing = baseKeys.filter(key => !Object.prototype.hasOwnProperty.call(locales[lang], key));
  const extra = keys.filter(key => !Object.prototype.hasOwnProperty.call(locales['zh-CN'], key));
  const blank = keys.filter(key => typeof locales[lang][key] !== 'string' || (!locales[lang][key].trim() && key !== 'empty_text'));
  check(missing.length === 0 && extra.length === 0, `${lang} key set matches zh-CN (${keys.length} keys)`);
  if (missing.length || extra.length) console.log(`      missing=[${missing.join(', ')}] extra=[${extra.join(', ')}]`);
  check(blank.length === 0, `${lang} has no blank translation values`);
  if (blank.length) console.log(`      blank=[${blank.join(', ')}]`);
}
const placeholderSignature = value => (String(value).match(/%[sd]/g) || []).join(',');
for (const lang of langs.slice(1)) {
  const mismatched = baseKeys.filter(key =>
    placeholderSignature(locales[lang][key]) !== placeholderSignature(locales['zh-CN'][key]));
  check(mismatched.length === 0, `${lang} placeholder signatures match zh-CN`);
  if (mismatched.length) console.log('      ' + mismatched.join(', '));
}
for (const lang of ['en-US', 'uk-UA']) {
  const leaked = Object.entries(locales[lang]).filter(([, value]) => /[\u3400-\u9fff]/.test(value));
  check(leaked.length === 0, `${lang} contains no Chinese fallback text`);
  if (leaked.length) console.log('      ' + leaked.map(([key]) => key).join(', '));
}

const referenced = new Set();
for (const match of source.matchAll(/\bt\(\s*(['"])([^'"]+)\1\s*(?=[,)])/g)) referenced.add(match[2]);
for (const match of source.matchAll(/data-i18n(?:-title|-placeholder|-aria-label|-alt)?\s*=\s*['"]([^'"]+)['"]/g)) referenced.add(match[1]);
for (const lang of langs) {
  const missing = [...referenced].filter(key => !Object.prototype.hasOwnProperty.call(locales[lang], key));
  check(missing.length === 0, `${lang} contains all ${referenced.size} statically referenced keys`);
  if (missing.length) console.log('      ' + missing.join(', '));
}

const families = {
  game_catalog: Object.keys({ gomoku:1, ludo:1, monopoly:1, tank:1, tetris:1, xiangqi:1 })
    .flatMap(id => [`game_${id}`, `game_${id}_desc`]),
  game_rules: Object.entries({ gomoku:3, ludo:5, monopoly:5, tank:5, tetris:5, xiangqi:5 })
    .flatMap(([id, count]) => Array.from({ length: count }, (_, i) => `rule_${id}_${i + 1}`)),
  shop_catalog: [
    ...Array.from({ length: 26 }, (_, i) => `shop_item_avatars_${i + 30}`),
    ...Array.from({ length: 8 }, (_, i) => `shop_item_frames_${i + 1}`),
    ...Array.from({ length: 4 }, (_, i) => `shop_item_effects_${i + 1}`),
    ...Array.from({ length: 10 }, (_, i) => `shop_item_backgrounds_${i + 1}`),
  ],
  monopoly_board: [
    ...Array.from({ length: 24 }, (_, i) => `monopoly_cell_${i}`),
    ...Array.from({ length: 8 }, (_, i) => `monopoly_chance_${i}`),
  ],
  xiangqi_pieces: ['k','a','e','h','r','c','p'].flatMap(piece =>
    [`xiangqi_piece_red_${piece}`, `xiangqi_piece_black_${piece}`]),
  accessibility: [
    'mode_group_aria','player_count_aria','account_button_title','my_profile_button_title',
    'profile_avatar_aria','ludo_dice_cyber','ludo_dice_classic','currency_aria',
    'monopoly_owned_by','monopoly_token_title','monopoly_token_car','monopoly_token_character',
  ],
  tournament: [
    'tournament_open','tournament_create','tournament_create_title','tournament_hint',
    'tournament_requires_players','tournament_title','tournament_state_line',
    'tournament_standing_line','tournament_table_line','tournament_consent_prompt',
    'tournament_start','tournament_next','tournament_bind','tournament_bound',
    'tournament_watch_table','tournament_switch_table','tournament_watching_table',
    'tournament_wait_result','tournament_format_round_robin','tournament_format_swiss',
    'tournament_status_waiting','tournament_status_round_playing',
    'tournament_status_round_complete','tournament_status_finished',
    'tournament_status_expired','tournament_status_declined','tournament_match_assigned',
    'tournament_bye_round',
  ],
  social_progression: [
    ...Array.from({ length: 5 }, (_, i) => `social_title_${i + 1}`),
    ...['first_win','win_10','win_50','streak_3','streak_5','level_5','all_games','social']
      .flatMap(id => [`achievement_${id}`, `achievement_${id}_desc`]),
    'daily_play_1','daily_play_3','daily_win_1','daily_streak_2',
  ],
  ai_personas: ['tsundere','gambler','mean','cute','teacher'].flatMap(id => [
    `ai_persona_${id}_name`, `ai_persona_${id}_desc`,
    ...['think','win','lose'].flatMap(kind => Array.from({ length: 3 }, (_, i) => `ai_persona_${id}_${kind}_${i + 1}`)),
  ]),
  runtime_branches: [
    'room_players_ready','room_waiting_players','room_host_selected_starting','room_host_selected_waiting',
    'tournament_pair_status_playing','tournament_pair_status_complete','tournament_pair_status_unbound','tournament_pair_status_bound',
    'monopoly_action_buy','monopoly_action_auction','monopoly_forward','monopoly_backward',
    'tetris_status_alive','tetris_reason_top_out','tetris_reason_garbage_ko','tetris_reason_remote_ko','tetris_reason_server_ko',
    'tetris_event_lock','tetris_event_spawn','tetris_event_sync','tetris_event_ready','tetris_event_tetris',
    'tetris_move_left','tetris_move_right','tetris_rotate_left','tetris_rotate_right','tetris_soft_drop','tetris_hard_drop',
    'gomoku_your_turn_hint','gomoku_wait_opponent','ludo_roll_die','ludo_choose_plane','thinking',
    ...['all','basic','theme','fantasy','animals','profession','creative'].map(id => `avatar_category_${id}`),
  ],
  server_error_reasons: [
    'login_required','session_expired','identity_switch_requires_logout','registration_requires_logout','login_requires_logout',
    'pin_format_invalid','registration_rate_limited','login_rate_limited','auth_service_busy','pin_in_use','pin_not_found','profile_forbidden',
    'invalid_purchase_id','product_not_found','purchase_sync_failed','insufficient_balance',
    'no_settleable_match','authoritative_result_required','match_id_expired','invalid_result','conflicting_result_claim',
    'result_consensus_mismatch','solo_in_room','invalid_solo_start','invalid_solo_ticket','solo_ticket_unavailable','solo_rate_limited','invalid_room_state',
    'room_not_found','match_started','room_full','already_in_room','duplicate_room_account','spectator_readonly','invitee_missing',
    'wait_reconnect_start','host_only_settle','move_too_large','tournament_create_failed','tournament_access_denied',
    'pairing_access_denied','invalid_binding_room','pairing_bind_failed','tournament_unavailable','participant_offline','participant_busy',
    'pairing_registration_failed','round_not_complete','match_not_found','match_room_mismatch','round_not_playing','invalid_winner',
    'err_protocol_version','err_invalid_state','err_invalid_move','err_match_finished','err_not_active_player','err_stale_seq','err_duplicate_action','err_deadline',
  ].map(reason => `server_reason_${reason}`),
};
for (const [family, keys] of Object.entries(families)) {
  for (const lang of langs) {
    const missing = keys.filter(key => typeof locales[lang][key] !== 'string' || !locales[lang][key].trim());
    check(missing.length === 0, `${lang} fully covers ${family} (${keys.length})`);
    if (missing.length) console.log('      ' + missing.join(', '));
  }
}

const template = read('public/index-template.html');
for (const match of template.matchAll(/<(?!script|style)([a-z][\w-]*)([^>]*)>/gi)) {
  const attrs = match[2];
  for (const [attribute, marker] of [['title','data-i18n-title'], ['placeholder','data-i18n-placeholder'], ['aria-label','data-i18n-aria-label'], ['alt','data-i18n-alt']]) {
    const value = new RegExp(`\\s${attribute}="([^"]*[A-Za-z\\u3400-\\u9fff][^"]*)"`, 'i').exec(attrs);
    if (value) check(new RegExp(`\\s${marker}="[^"]+"`, 'i').test(attrs), `template ${attribute} text is bound to ${marker}`);
  }
}

const i18nCore = read('public/src/core/00-i18n.js');
const runtimeKeys = [...i18nCore.matchAll(/'([^']+)'\s*:\s*\{\s*'en-US'\s*:/g)].map(match => match[1]);
const runtimeSeen = new Set(), duplicateRuntimeKeys = new Set();
runtimeKeys.forEach(key => { if (runtimeSeen.has(key)) duplicateRuntimeKeys.add(key); else runtimeSeen.add(key); });
check(duplicateRuntimeKeys.size === 0, 'RUNTIME_I18N contains no duplicate legacy source keys');
if (duplicateRuntimeKeys.size) console.log('      ' + [...duplicateRuntimeKeys].join(', '));
check(/function\s+setLocalizedText\s*\(/.test(i18nCore), 'runtime text keeps a locale-independent source value');
check(/\[data-i18n-aria-label\]/.test(i18nCore), 'ARIA labels are translated by applyI18n');
check(!/function\s+installI18nObserver[\s\S]*?root\.querySelectorAll\('\[data-i18n-aria-label\]'\)/.test(i18nCore), 'observer initialization has no undefined root access');

if (failed) process.exit(1);
console.log('ALL_PASS');
