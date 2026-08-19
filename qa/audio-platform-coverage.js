#!/usr/bin/env node
'use strict';

/*
 * Coverage contract for the non-game surfaces added in the audio closure
 * pass.  It is intentionally source-local: the UI/online modules are large
 * browser presenters, so this gate verifies that a cue sits behind the same
 * accepted local/server branch that owns the visible state change.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const bus = read('public/src/core/15-feedback-bus.js');
const adapter = read('public/src/core/21-unified-feedback-adapter.js');
const utils = read('public/src/core/01-utils.js');
const shell = read('public/src/core/02-app-shell.js');
const online = read('public/src/online/03-websocket.js');
const shop = read('public/src/shop/06-shop.js');
const playline = read('public/src/core/07-playline.js');
const roster = read('public/src/ui/07-roster.js');

let assertions = 0;
let failures = 0;
function check(label, run) {
  assertions += 1;
  try {
    run();
    process.stdout.write(`PASS  ${label}\n`);
  } catch (error) {
    failures += 1;
    process.stderr.write(`FAIL  ${label} :: ${error && error.message || error}\n`);
  }
}
function block(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert(start >= 0, `missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert(end > start, `missing ${endNeedle}`);
  return source.slice(start, end);
}

const addedCues = [
  'settings_change', 'shop_purchase', 'shop_error', 'equip_change',
  'social_update', 'social_error', 'playline_post', 'playline_error',
  'expression_received', 'match_chat_incoming', 'match_chat_sent',
  'daily_claim', 'profile_saved'
];

check('new platform vocabulary is synchronized between bus and adapter', () => {
  addedCues.forEach(type => {
    assert(bus.includes(`'${type}'`), `FeedbackBus missing ${type}`);
    assert(adapter.includes(`'${type}'`), `UnifiedFeedbackAdapter missing ${type}`);
    assert(new RegExp(`\\b${type}\\s*:`).test(adapter), `tone profile missing ${type}`);
  });
});

check('UI helper uses a local bounded ID namespace with no caller payload', () => {
  const helper = block(utils, 'function emitUiAudioCue', 'function emitPresentationAudio');
  assert(helper.includes('_uiAudioSequence'));
  assert(helper.includes("actionId:'ui-'+safeType+'-'+_uiAudioSequence"));
  assert(!/uid|token|payload|message|text|content|username/i.test(helper));
});

check('settings cues follow committed local preference changes', () => {
  assert(shell.includes("emitUiAudioCue('settings_change'"));
  const theme = block(shell, 'btn.addEventListener("click", () => {', 'themeRow.appendChild(btn);');
  assert(theme.indexOf('localStorage.setItem') < theme.indexOf("emitUiAudioCue('settings_change'"));
  const language = block(shell, 'btn.addEventListener("click", async () => {', 'langRow.appendChild(btn);');
  assert(language.indexOf('if (!committed) return') < language.indexOf("emitUiAudioCue('settings_change'"));
  assert(shell.includes("input.addEventListener('change', () => { if (typeof emitUiAudioCue === 'function') emitUiAudioCue('settings_change'"));
});

check('shop success/error cues are tied to matching purchase replies and equip commits', () => {
  const finish = block(shop, 'function finishShopPurchaseFeedback', 'function refreshOpenShop');
  const guard = finish.indexOf('responseRequestId !== pending.requestId');
  const cue = finish.indexOf("emitUiAudioCue(ok ? 'shop_purchase' : 'shop_error'", guard);
  assert(guard >= 0 && cue > guard);
  const timeout = block(shop, 'pending.timer = setTimeout', '},SHOP_PURCHASE_TIMEOUT_MS);');
  assert(timeout.includes("emitUiAudioCue('shop_error'"));
  assert((shop.match(/emitUiAudioCue\('equip_change'/g) || []).length >= 3);
});

check('social and Playline cues stay on accepted/rejected branches', () => {
  const socialOk = block(online, "case 'social_ok':", "case 'social_error':");
  const socialError = block(online, "case 'social_error':", "case 'playline_state':");
  assert(socialOk.includes("emitPlatformAudioCue('social_update'"));
  assert(socialError.includes("emitPlatformAudioCue('social_error'"));
  const publish = block(playline, 'function setPlaylineError', 'function requestPlayline');
  assert(publish.includes("emitUiAudioCue('playline_error'"));
  const pl = block(online, "case 'playline_state':", "case 'chat_state':");
  assert(pl.includes("accepted&&(msg.type==='playline_publish_ok'||msg.type==='playline_remove_ok')"));
  assert(pl.includes("emitPlatformAudioCue('playline_post'"));
});

check('match expression and match chat cues are deduplicated and privacy-safe', () => {
  const expression = block(shell, 'function receiveMatchExpression', 'function handleMatchExpressionAck');
  assert(expression.includes('const repeated='));
  assert(expression.includes('!repeated&&senderUid!==String(account&&account.uid||\'\')'));
  assert(expression.includes("emitUiAudioCue('expression_received'"));
  const chat = block(shell, 'function receiveMatchChatMessage', 'function handleMatchChatAck');
  assert(chat.indexOf('storeMatchChatMessage(event,true)') < chat.indexOf("emitUiAudioCue(mine?'match_chat_sent':'match_chat_incoming'"));
  assert(chat.includes('!loadMatchChatMute()'));
  assert(!/emitUiAudioCue\([^\n]*(?:text|content|senderUid|uid|token)/i.test(expression + chat));
});

check('daily claim and profile-save cues require the corresponding accepted state', () => {
  const daily = block(online, "case 'daily_tasks':", "case 'replay_list':");
  assert(daily.indexOf('Number(msg.payload&&msg.payload.reward)>0') < daily.indexOf("emitPlatformAudioCue('daily_claim'"));
  assert(daily.includes('this._audioDailyClaimIds.includes(claimKey)'));
  const save = block(roster, "toast(t('profile_saved',finalName));", "  });\n  const cancel");
  assert(save.includes("emitUiAudioCue('profile_saved'"));
});

check('new cue path never adds wire/transport audio fields', () => {
  const all = online + shop + playline + roster;
  assert(!/type\s*:\s*['"](?:audio|sound|cue)['"]/i.test(all));
  assert(!/payload\s*:\s*\{[^}]*\b(?:audioCue|soundCue|audioType)\b/i.test(all));
  const callPattern = /emitUiAudioCue\(([^)]{0,180})\)/g;
  let match;
  while ((match = callPattern.exec(all))) {
    assert(!/\b(?:payload|message|content|text|username|token|uid)\b/i.test(match[1]), `sensitive cue argument: ${match[0]}`);
  }
});

if (failures) {
  process.stderr.write(`AUDIO_PLATFORM_COVERAGE_FAILURES=${failures}/${assertions}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`AUDIO_PLATFORM_COVERAGE_ALL_PASS assertions=${assertions} cues=${addedCues.length}\n`);
}
