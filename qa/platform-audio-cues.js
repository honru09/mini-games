#!/usr/bin/env node
'use strict';

/*
 * Platform/online semantic-audio contract.
 *
 * The WebSocket client is deliberately not executed wholesale here: its
 * transport owns a large browser surface.  Pure audio helpers are exercised
 * in a VM, while source-local assertions pin every cue to the accepted and
 * deduplicated branch that owns it.  This also guards the privacy boundary:
 * no chat text, identity, token, or transport payload may enter a cue.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const FILE = 'public/src/online/03-websocket.js';
const source = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
let assertions = 0;
let failures = 0;

function check(label, run) {
  assertions += 1;
  try {
    run();
    process.stdout.write(`ok - ${label}\n`);
  } catch (error) {
    failures += 1;
    process.stderr.write(`not ok - ${label}: ${error && error.message || error}\n`);
  }
}

function caseBlock(name) {
  const marker = `case '${name}':`;
  const start = source.indexOf(marker);
  assert(start >= 0, `missing ${marker}`);
  const tail = source.slice(start + marker.length);
  const next = tail.search(/\n\s*case '[a-z0-9_]+'/);
  return next < 0 ? source.slice(start) : source.slice(start, start + marker.length + next);
}

function methodBlock(name, nextName) {
  const start = source.indexOf(`  ${name}(`);
  assert(start >= 0, `missing method ${name}`);
  const end = source.indexOf(`  ${nextName}(`, start + name.length + 3);
  assert(end > start, `missing method boundary ${nextName}`);
  return source.slice(start, end);
}

const helperEnd = source.indexOf('function socialGuestMutationBlocked');
assert(helperEnd > 0, 'audio helper boundary missing');
const calls = [];
const sandbox = vm.createContext({
  Object, Array, Set, String, Number, Math, Date,
  emitPresentationAudio(type, context, intensity) {
    calls.push({ type, context, intensity });
    return Object.freeze({ accepted:true, reason:null });
  }
});
vm.runInContext(`${source.slice(0, helperEnd)}\n;globalThis.__platformAudio={detachedRoomAudioSummary,roomAudioTransitions,emitRoomAudioTransitions,acceptPlatformAuthSuccess,acceptPlatformAuthError,emitAcceptedRewardAudio};`, sandbox, { filename:FILE });
const helpers = sandbox.__platformAudio;

check('room summaries are detached and unchanged snapshots emit no cue', () => {
  const info = {
    humanCount:2,
    host:{seatId:0},
    seats:[
      {seatId:0,type:'human',host:true,ready:true},
      {seatId:1,type:'human',ready:false}
    ]
  };
  const summary = helpers.detachedRoomAudioSummary(info);
  info.humanCount = 5;
  info.seats[0].ready = false;
  assert.deepStrictEqual(JSON.parse(JSON.stringify(summary)), {humanCount:2,readyCount:1,hostSeat:0});
  assert.strictEqual(Object.isFrozen(summary), true);
  assert.deepStrictEqual(Array.from(helpers.roomAudioTransitions(summary, summary)), []);
  const before = calls.length;
  helpers.emitRoomAudioTransitions(summary, summary);
  assert.strictEqual(calls.length, before);
});

check('room snapshot deltas map once to peer, ready, and host semantics', () => {
  const previous = {humanCount:1,readyCount:0,hostSeat:0};
  const next = {humanCount:2,readyCount:1,hostSeat:1};
  assert.deepStrictEqual(Array.from(helpers.roomAudioTransitions(previous, next)), ['peer_join','ready','host_changed']);
  calls.length = 0;
  helpers.emitRoomAudioTransitions(previous, next);
  assert.deepStrictEqual(calls.map(item => item.type), ['peer_join','ready','host_changed']);
  calls.forEach(item => assert.strictEqual(item.context, null));
});

check('authentication helpers accept each success or failed attempt once', () => {
  calls.length = 0;
  const client = {_audioAuthSuccessEmitted:false,_audioAuthAttempt:1,_audioAuthErrorAttempt:-1};
  assert.strictEqual(helpers.acceptPlatformAuthSuccess(client), true);
  assert.strictEqual(helpers.acceptPlatformAuthSuccess(client), false);
  assert.strictEqual(helpers.acceptPlatformAuthError(client), true);
  assert.strictEqual(helpers.acceptPlatformAuthError(client), false);
  client._audioAuthAttempt = 2;
  assert.strictEqual(helpers.acceptPlatformAuthError(client), true);
  assert.deepStrictEqual(calls.map(item => item.type), ['auth_success','auth_error','auth_error']);
});

check('reward helper emits only eligible bounded semantic facts', () => {
  calls.length = 0;
  assert.strictEqual(helpers.emitAcceptedRewardAudio({eligible:false,result:'win',currency:10,xp:10}, true), false);
  assert.strictEqual(calls.length, 0);
  assert.strictEqual(helpers.emitAcceptedRewardAudio({eligible:true,result:'win',currency:2,xp:8,levelBefore:1,levelAfter:2}, true), true);
  assert.deepStrictEqual(calls.map(item => item.type), ['reward_win','coins_gain','xp_gain','level_up','achievement_unlock']);
  calls.forEach(item => assert.strictEqual(item.context, null));
});

check('accepted auth reply branches own success/error cues', () => {
  for (const name of ['registered','logged_in','guest_logged_in']) {
    const block = caseBlock(name);
    const guard = name === 'guest_logged_in' ? block.indexOf('if(profile&&uid&&token)') : block.indexOf('if (profile && uid)');
    const cue = block.indexOf('acceptPlatformAuthSuccess(this)');
    assert(guard >= 0 && cue > guard, `${name} cue is outside accepted profile guard`);
  }
  const hello = caseBlock('hello_ack');
  assert(hello.indexOf('acceptPlatformAuthSuccess(this)') > hello.indexOf('if (msg.authenticated)'));
  assert(caseBlock('auth_error').includes('acceptPlatformAuthError(this)'));
});

check('chat list announces only unread growth and suppresses realtime duplication', () => {
  const block = caseBlock('chat_state');
  const compare = block.indexOf('unread>previousUnread');
  const duplicate = block.indexOf('realtimeDuplicate', compare);
  const cue = block.indexOf("emitPlatformAudioCue('chat_unread'", duplicate);
  assert(block.includes('previousUnread=this._audioChatUnread'));
  assert(compare >= 0 && duplicate > compare && cue > duplicate);
  assert(block.includes('this._audioChatRealtimeAt=0'));
});

check('chat incoming cue requires a new inbound accepted message', () => {
  const block = caseBlock('chat_message');
  const accepted = block.indexOf('if(isNewMessage&&messageId&&accountUid&&senderUid&&recipientUid===accountUid&&senderUid!==accountUid)');
  const dedupe = block.indexOf('!this._audioChatReceivedIds.includes(messageId)', accepted);
  const cue = block.indexOf("emitPlatformAudioCue('chat_incoming'", dedupe);
  assert(accepted >= 0 && dedupe > accepted && cue > dedupe);
  assert(block.indexOf('this._audioChatRealtimeAt=Date.now()', dedupe) < cue);
});

check('chat sent cue requires the first accepted receipt', () => {
  const block = caseBlock('chat_send_ok');
  const accepted = block.indexOf('firstAcceptedReceipt=');
  const guard = block.indexOf('if(firstAcceptedReceipt)', accepted);
  const remember = block.indexOf('this._audioChatSentIds.push(receiptId)', guard);
  const cue = block.indexOf("emitPlatformAudioCue('chat_sent'", remember);
  assert(accepted >= 0 && guard > accepted && remember > guard && cue > remember);
});

check('result audio is inside the persisted reward-id dedupe guard', () => {
  const block = caseBlock('result_ok');
  const profileUpdate = block.indexOf('updateAccountProfile(profile)');
  const achievementDiff = block.indexOf('achievementUnlocked=', profileUpdate);
  const rewardGuard = block.indexOf('if (payload.reward && (!rewardId || !this.displayedRewardIds.includes(rewardId)))');
  const remember = block.indexOf('this.displayedRewardIds.push(rewardId)', rewardGuard);
  const cue = block.indexOf('emitAcceptedRewardAudio(payload.reward,achievementUnlocked)', rewardGuard);
  const display = block.indexOf('showRewardBreakdown', rewardGuard);
  assert(profileUpdate >= 0 && achievementDiff > profileUpdate);
  assert(rewardGuard >= 0 && remember > rewardGuard && cue > rewardGuard && display > cue);
  assert.strictEqual((source.match(/emitAcceptedRewardAudio\(payload\.reward,achievementUnlocked\)/g) || []).length, 1);
});

check('social and Playline mutation cues require accepted server outcomes', () => {
  const socialOk = caseBlock('social_ok');
  assert(socialOk.indexOf("emitPlatformAudioCue('social_update'") > socialOk.indexOf("case 'social_ok':"));
  assert(socialOk.indexOf('this.requestSocial()') > socialOk.indexOf("emitPlatformAudioCue('social_update'"));
  const socialError = caseBlock('social_error');
  assert(socialError.includes("emitPlatformAudioCue('social_error'"));

  const playlineStart = source.indexOf("case 'playline_state':");
  const playlineEnd = source.indexOf("case 'chat_state':", playlineStart);
  const playline = source.slice(playlineStart, playlineEnd);
  const accepted = playline.indexOf('const accepted=');
  const success = playline.indexOf("accepted&&(msg.type==='playline_publish_ok'||msg.type==='playline_remove_ok')", accepted);
  const successCue = playline.indexOf("emitPlatformAudioCue('playline_post'", success);
  const errorGuard = playline.indexOf("accepted&&msg.type==='playline_error'", successCue);
  const errorCue = playline.indexOf("emitPlatformAudioCue('playline_error'", errorGuard);
  assert(accepted >= 0 && success > accepted && successCue > success && errorGuard > successCue && errorCue > errorGuard);
});

check('daily claim cue is reward-bearing and claim-id deduplicated', () => {
  const dailyStart = source.indexOf("case 'daily_tasks':");
  const dailyEnd = source.indexOf("case 'replay_list':", dailyStart);
  const block = source.slice(dailyStart, dailyEnd);
  const key = block.indexOf("const claimKey=String(msg.payload&&msg.payload.claimId||'')");
  const rewardGuard = block.indexOf('Number(msg.payload&&msg.payload.reward)>0', key);
  const replayGuard = block.indexOf("msg.payload.replayed!==true", rewardGuard);
  const dedupe = block.indexOf('!this._audioDailyClaimIds.includes(claimKey)', key);
  const remember = block.indexOf('this._audioDailyClaimIds.push(claimKey)', dedupe);
  const cue = block.indexOf("emitPlatformAudioCue('daily_claim'", remember);
  assert(key >= 0 && dedupe > key && rewardGuard > key && replayGuard > rewardGuard && remember > dedupe && cue > remember);
});

check('account and room resets clear every audio dedupe baseline', () => {
  const accountReset = methodBlock('resetAccountCaches', 'requestChatList');
  const stateResetStart = source.indexOf('  resetState(');
  const stateResetEnd = source.indexOf('function resolveServer', stateResetStart);
  assert(stateResetStart >= 0 && stateResetEnd > stateResetStart, 'missing resetState boundary');
  const stateReset = source.slice(stateResetStart, stateResetEnd);
  for (const key of ['_audioRoomSummary=null','_audioChatUnread=null','_audioChatRealtimeAt=0','_audioChatSentIds=[]','_audioChatReceivedIds=[]','_audioDailyClaimIds=[]']) {
    assert(accountReset.includes(key), `account reset misses ${key}`);
    assert(stateReset.includes(key), `state reset misses ${key}`);
  }
});

check('audio calls carry no chat body, identity, token, or protocol payload', () => {
  assert(source.includes("return emitPresentationAudio(type,null,Number.isFinite(intensity)?intensity:1)"));
  const callPattern = /emitPlatformAudioCue\(([^;\n]*)\)/g;
  let match;
  while ((match = callPattern.exec(source))) {
    assert(!/\b(?:msg|payload|message|text|body|content|uid|token|session|username)\b/i.test(match[1]), `sensitive cue argument: ${match[0]}`);
  }
  assert(!/this\.send\(\{[^\n}]*type\s*:\s*['"](?:audio|sound|cue)/i.test(source));
  assert(!/payload\s*:\s*\{[^\n}]*\b(?:audioCue|soundCue|audioType)\b/i.test(source));
});

if (failures) {
  process.stderr.write(`PLATFORM_AUDIO_CUES_FAILURES=${failures}/${assertions}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`PLATFORM_AUDIO_CUES_ALL_PASS assertions=${assertions}\n`);
}
