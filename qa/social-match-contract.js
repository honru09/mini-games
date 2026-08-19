'use strict';

// Static contract checks for Social Match P0.  The online companion test
// exercises the live authority; this file protects the frozen protocol, UI
// boundary, and source ownership without importing a browser or server.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = relative => fs.readFileSync(path.join(ROOT, relative), 'utf8');
const server = read('server/index.js');
const client = read('public/src/online/03-websocket.js');
const shell = read('public/src/core/02-app-shell.js');
const template = read('public/index-template.html');
const built = read('public/index.html');
const contract = read('requirements/active/social-match-p0-20260809/contract.md');
const requirement = read('requirements/active/social-match-p0-20260809/requirement.md');
const ownership = JSON.parse(read('requirements/active/social-match-p0-20260809/ownership.json'));
const locales = ['zh-CN', 'en-US', 'uk-UA'].map(lang => JSON.parse(read('public/locales/' + lang + '.json')));
const { createRoomPresenceBoundary, createMemoryRoomPresenceAdapter } = require(path.join(ROOT, 'server', 'boundaries', 'room-presence.js'));
let failures = 0;

function check(name, value, detail) {
  const ok = !!value;
  console.log((ok ? 'PASS  ' : 'FAIL  ') + name + (detail ? ' :: ' + detail : ''));
  if (!ok) failures++;
}

function section(source, start, end) {
  const a = source.indexOf(start);
  const b = end ? source.indexOf(end, a < 0 ? 0 : a) : -1;
  return a < 0 ? '' : source.slice(a, b < 0 ? source.length : b);
}

// Keep the frozen expression assertions scoped to the expression handler.  The
// P1 room-chat protocol is deliberately adjacent in server/index.js, so a
// broad slice through controlledAISeat would accidentally inspect chat code.
const serverHandler = section(server, 'function handleMatchExpression(', 'function matchChatError(');
const serverPublicSeat = section(server, 'function publicSeat(', 'function roomHostPayload(');
const serverDelivery = section(server, 'function matchExpressionRecipientAllowed(', 'function controlledAISeat(');
const clientMessageCases = section(client, 'onMessage(msg){', 'case \'rejoined\':');
const shellExpression = section(shell, 'const MATCH_EXPRESSION_EMOJI_FALLBACK', 'const matchChatUi=');
const shellPanel = section(shell, 'function renderMatchExpressionPanel(', 'const matchChatUi=');

const emojiIds = ['emoji_wave','emoji_thumbsup','emoji_cheer','emoji_wow','emoji_oops','emoji_cry','emoji_angry','emoji_sly','emoji_heart','emoji_game'];
const quickIds = ['quick_hello','quick_good_luck','quick_nice','quick_wow','quick_thanks','quick_again'];
const errorReasons = ['unsupported_capability','persistent_account_required','spectator_readonly','not_in_room','match_not_active','invalid_match','invalid_event_id','invalid_expression','invalid_target','blocked','rate_limited'];
const publicSeatKeys = ['seatId','type','userId','nickname','avatar','frame','effect','nameFx','lang','playerCharacter','ready','host','online','aiDifficulty','aiPersona','controllerUid'];
const privateSeatKeys = ['owned','token','authToken','password','passwordHash','coins','xp','purchaseRequests'];
const publicSeatBoundary = createRoomPresenceBoundary({
  adapter:createMemoryRoomPresenceAdapter(),
  now:()=>1700000000000,
  publicPlayerCharacter:value=>({ characterId:String(value && value.characterId || 'honru-default') }),
});
const publicSeatResult = publicSeatBoundary.room({ action:'seat', kind:'public', value:{
  seatId:1, type:'human', userId:'seat-user', nickname:'Seat User', avatar:100, frame:7, effect:4,
  nameFx:3, lang:'forged', playerCharacter:{ characterId:'honru-default', privateSlot:'forged' },
  ready:true, host:false, online:true, aiDifficulty:'hard', aiPersona:'teacher', controllerUid:'seat-user',
  owned:['forged'], token:'forged', authToken:'forged', password:'forged', passwordHash:'forged',
  coins:999999, xp:999999, purchaseRequests:['forged'],
} });
const projectedPublicSeat = publicSeatResult.ok ? publicSeatResult.seat : null;

check('frozen capability and message names are documented', contract.includes('match-expression-v1') && contract.includes('`match_expression`') && contract.includes('`match_expression_ok`') && contract.includes('`match_expression_error`'));
check('exact stable Emoji set is present in contract/server/client', emojiIds.length === 10 && emojiIds.every(id => contract.includes(id) && server.includes(id) && shell.includes(id) && built.includes(id)));
check('exact stable quick phrase set is present in contract/server/client', quickIds.length === 6 && quickIds.every(id => contract.includes(id) && server.includes(id) && shell.includes(id) && built.includes(id)));
check('eventId validation keeps the frozen ASCII envelope', /MATCH_EXPRESSION_EVENT_RE\s*=\s*\/\^\[A-Za-z\]\[A-Za-z0-9_-\]\{7,80\}\$\//.test(server) && contract.includes('^[A-Za-z][A-Za-z0-9_-]{7,80}$'));

check('server and client pair all three expression message types',
  ['match_expression','match_expression_ok','match_expression_error'].every(type =>
    (server.includes("type === '" + type + "'") || server.includes("type:'" + type + "'")) &&
    clientMessageCases.includes("case '" + type + "':")));
check('client advertises and gates match-expression-v1',
  client.includes("'match-expression-v1'") && /sendMatchExpression\(kind,expressionId,targetSeat,eventId\)/.test(client) &&
  /!this\.supportsCapability\('match-expression-v1'\)/.test(client));
check('connected account/room resets preserve negotiated capabilities',
  /if\(!this\.connected\)this\.capabilities=new Set\(\)/.test(client));
check('server hello acknowledgement advertises match-expression-v1',
  server.includes('MATCH_EXPRESSION_PROTOCOL,MATCH_CHAT_PROTOCOL'));
check('built index stays synchronized with the source protocol/UI',
  built.includes('match-expression-v1') && built.includes('case \'match_expression\':') && built.includes('id="match-expression-panel"'));

check('server derives sender/player/time/protocol from session and seat',
  /const user=session\.uid&&db\.users\[session\.uid\]/.test(serverHandler) &&
  /const senderSeat=seatForSession\(room,session\)/.test(serverHandler) &&
  /senderUid:user\.uid/.test(serverHandler) && /player:Number\(senderSeat\.seatId\)/.test(serverHandler) &&
  /createdAt:now/.test(serverHandler) && /protocol:MATCH_EXPRESSION_PROTOCOL/.test(serverHandler));
check('server ignores client forged authority fields',
  !/payload\s*&&?\s*payload\.(senderUid|player|createdAt|protocol)/.test(serverHandler));
check('public Seat exposes only the frozen identity/presentation contract',
  /roomPresenceBoundary\.room\(\{\s*action:'seat',\s*kind:'public'/.test(serverPublicSeat) &&
  projectedPublicSeat &&
  JSON.stringify(Object.keys(projectedPublicSeat).sort()) === JSON.stringify(publicSeatKeys.slice().sort()) &&
  projectedPublicSeat.lang === 'zh-CN' &&
  projectedPublicSeat.playerCharacter.characterId === 'honru-default' &&
  projectedPublicSeat.playerCharacter.privateSlot === undefined);
check('server keeps owned/token and economy data out of room Seat payloads',
  projectedPublicSeat && privateSeatKeys.every(key => !Object.prototype.hasOwnProperty.call(projectedPublicSeat, key)));

check('capability, account, spectator, room, match and expression checks are ordered on server',
  ['unsupported_capability','persistent_account_required','spectator_readonly','not_in_room','match_not_active','invalid_match','invalid_event_id','invalid_expression','invalid_target'].every(reason => serverHandler.includes("'" + reason + "'")));
check('server implements both-direction Block rejection and recipient re-check',
  /socialBlockedBetween\(user\.uid,target\.userId\)/.test(serverHandler) &&
  /function matchExpressionRecipientAllowed[\s\S]*socialBlockedBetween\(session\.uid,senderUid\)/.test(serverDelivery) &&
  /deliverMatchExpression\(room,event\)/.test(serverHandler));
check('delayed spectator delivery revalidates the active match',
  /setTimeout\(\(\)=>\{[\s\S]*if\(room\.started&&!room\.settled&&String\(room\.matchId\)===String\(event\.matchId\)/.test(serverDelivery));
check('delayed spectator expression timers are tracked and cleared with room authorities',
  /matchExpressionDelayTimers\.add\(timer\)/.test(serverDelivery) &&
  /function stopRoomAuthorities\(r\)[\s\S]*matchExpressionDelayTimers[\s\S]*clearTimeout\(timer\)/.test(server));
check('server enforces ten-second, sixty-second, per-match and bounded idempotency limits',
  /now-at<10000/.test(server) && /now-at<60000/.test(server) && />=80/.test(server) &&
  /matchExpressionSeen\.size>300/.test(server) && /matchExpressionCounts\.set/.test(server));
check('eventId idempotency is account × match and replay is ack-only',
  /const seenKey=user\.uid\+'\|'.*eventId/.test(serverHandler) &&
  /replayed:true/.test(serverHandler) && !/deliverMatchExpression\(room,event\)[\s\S]*replayed:true/.test(serverHandler));

check('expression handler has no persistence/replay/reward side effects',
  !/(saveDB\(|recordAnalytics\(|recordRoomAction\(|moveLog|reward|economy)/i.test(serverHandler));
check('new match/reset/restart clear expression stores',
  (server.match(/r\.matchExpressionSeen\s*=\s*new Map\(\)/g) || []).length >= 3 &&
  (server.match(/r\.matchExpressionRates\s*=\s*new Map\(\)/g) || []).length >= 3 &&
  (server.match(/r\.matchExpressionCounts\s*=\s*new Map\(\)/g) || []).length >= 3);

check('Game Shell mounts an expression panel in the frozen Command Slot and an inert Overlay Slot',
  /id="game-stage-command"[\s\S]*id="match-expression-panel"/.test(template) &&
  /id="match-expression-panel"[^>]*data-i18n-aria-label="match_expression_aria"/.test(template) &&
  /id="game-stage-overlay"[^>]*data-game-shell-slot="overlay"/.test(template));
check('panel uses only whitelist choices/target selection and provides local mute',
  shellPanel.includes("match_expression_emoji_tab") && shellPanel.includes("match_expression_quick_tab") &&
  shellPanel.includes("sendMatchExpressionChoice('emoji',id)") && shellPanel.includes("sendMatchExpressionChoice('quick',id)") &&
  shellExpression.includes('online.sendMatchExpression(kind,id,matchExpressionUi.targetSeat)') &&
  shellPanel.includes("mg_match_expression_muted") && !/(textarea|contenteditable|prompt\s*\()/i.test(shellPanel));
check('panel is hidden for unsupported, spectator, guest or inactive matches',
  /function matchExpressionEnabled\(\)[\s\S]*matchExpressionReceiveEnabled\(\)[\s\S]*!online\.isSpectator[\s\S]*account\.ephemeral/.test(shellExpression) &&
  /if\(!matchExpressionEnabled\(\)\)\{panel\.classList\.add\('hidden'\)/.test(shellPanel));
check('Seat identity opens the existing public Profile entry point',
  /function gameStageAvatar\([\s\S]*online\.requestProfile\(seat\.userId\)/.test(shell) &&
  /seat\.type==='human'&&seat\.userId[\s\S]*openProfileModal\(seat\.userId\)/.test(shell) &&
  /label\.setAttribute\('data-i18n-raw',''\)/.test(shell));
check('target fallback player number remains localizable while nickname stays raw',
  /if\(seat\.nickname\)\{option\.textContent=seat\.nickname;option\.setAttribute\('data-i18n-raw',''\);\}else option\.textContent=gameStageLocalized\('player_number'/.test(shell));
check('Seat identity renders the server language flag',
  /seat\.type==='human'&&seat\.lang&&typeof langFlag==='function'/.test(shell) && /game-stage-lang-flag/.test(shell));
check('expression queue is bounded to three visible bubbles per Seat and has timer cleanup',
  /list\.slice\(-3\)/.test(shellExpression) && /matchExpressionUi\.events=matchExpressionUi\.events\.slice\(-30\)/.test(shellExpression) &&
  /matchExpressionUi\.timers\.clear\(\)/.test(shellExpression) && /matchExpressionUi\.flightTimers\.clear\(\)/.test(shellExpression) &&
  /clearMatchExpressions\(\)/.test(shell));
check('local mute immediately clears pending and visible expression presentation',
  /function clearMatchExpressionPresentation\(\)[\s\S]*matchExpressionUi\.events=\[\][\s\S]*\.match-expression-bubbles/.test(shellExpression) &&
  /if\(matchExpressionUi\.muted\)clearMatchExpressionPresentation\(\)/.test(shellPanel));
check('targeted Emoji bubbles attach to the target while quick phrases stay on sender',
  /displaySeat:event\.kind==='emoji'&&Number\.isInteger\(targetSeat\)\?targetSeat:player/.test(shellExpression));
check('client event keys match senderUid × eventId idempotency scope',
  /function matchExpressionEventKey\(event\)[\s\S]*senderUid[\s\S]*matchExpressionKey\(event&&event\.eventId\)/.test(shellExpression) &&
  /row\.eventKey!==item\.eventKey/.test(shellExpression) && /timers\.get\(item\.eventKey\)/.test(shellExpression));
check('client applies the frozen 900ms visual cooldown',
  /cooldownUntil=now\+900/.test(shellExpression) && /setTimeout\(\(\)=>\{[\s\S]*renderMatchExpressionPanel\(\);\},920\)/.test(shellExpression) &&
  /button\.disabled=cooling/.test(shellPanel));
check('received expression can open an event-scoped match report',
  /openReportUserModal\([\s\S]*\{type:'match',id:item\.eventId,recentEventIds:\[item\.eventId\]\}/.test(shellExpression) &&
  /contextType:context&&context\.type\|\|'profile'[\s\S]*contextId:context&&context\.id/.test(client));
check('new match interaction controls keep the 44px touch target floor',
  /\.match-expression-panel \.btn\{min-height:44px;min-width:44px/.test(template) &&
  /\.match-expression-target\{[^}]*height:44px/.test(template) && /\.game-stage-avatar-button\{[^}]*width:44px;height:44px/.test(template));
check('spectator leave has an acknowledgement and client cleanup path',
  /type === 'spectate_leave'[\s\S]*leaveSpectator\(true\)/.test(server) && server.includes("type:'spectate_left'") &&
  clientMessageCases.includes("case 'spectate_left':") && /case 'spectate_left':[\s\S]*resetState\(\)[\s\S]*clearMatchExpressions\(\)/.test(clientMessageCases));
check('reduced-motion removes flight/bubble animation and flight code honors the guard',
  /@media\(prefers-reduced-motion:reduce\)[\s\S]*\.match-expression-bubble,.match-expression-flight,.match-chat-bubble\{animation:none!important\}/.test(template) &&
  /visualEnabled[\s\S]*prefersReducedMotion\(\)/.test(shell) && /pointer-events:none/.test(template));

const i18nKeys = [
  'match_expression_aria','match_expression_title','match_expression_open','match_expression_close',
  'match_expression_emoji_tab','match_expression_quick_tab','match_expression_target','match_expression_all',
  'match_expression_mute','match_expression_unmute','match_expression_failed','match_expression_report','stage_open_profile',
  ...emojiIds.map(id => 'expression_' + id), ...quickIds.map(id => 'expression_' + id),
  ...errorReasons.map(reason => 'server_reason_' + reason),
];
check('all expression/profile/error strings exist and are non-empty in all three locales',
  i18nKeys.every(key => locales.every(locale => typeof locale[key] === 'string' && locale[key].trim())));
check('client references stable i18n keys instead of hard-coded user-visible phrases',
  ['match_expression_title','match_expression_open','match_expression_close','match_expression_target','match_expression_all','match_expression_mute','match_expression_unmute'].every(key => shell.includes("t('" + key + "')")) &&
  client.includes("'match_expression_failed'"));
check('locale key sets remain isomorphic',
  JSON.stringify(Object.keys(locales[0]).sort()) === JSON.stringify(Object.keys(locales[1]).sort()) &&
  JSON.stringify(Object.keys(locales[0]).sort()) === JSON.stringify(Object.keys(locales[2]).sort()));

function sourceFiles(relative) {
  const root = path.join(ROOT, relative);
  const out = [];
  const visit = directory => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (/\.(?:js|mjs|cjs|json)$/.test(entry.name)) out.push(full);
    }
  };
  visit(root);
  return out;
}
const gameAndRuleFiles = [
  ...sourceFiles('public/src/games'),
  ...sourceFiles('shared/rules'),
  ...sourceFiles('server/gameplay'),
];
check('Social Match implementation does not touch game/rule/authority source trees',
  gameAndRuleFiles.every(file => {
    const text = fs.readFileSync(file, 'utf8');
    return !/(match-expression-v1|match_expression|emoji_wave|quick_hello)/.test(text);
  }));
check('QA ownership explicitly assigns both new files to qaRelease',
  Array.isArray(ownership.owners && ownership.owners.qaRelease) && ownership.owners.qaRelease.includes('qa/social-match-contract.js') && ownership.owners.qaRelease.includes('qa/social-match-online.js'));
check('frozen scope keeps free text, persistence, games/rules and production work out',
  /不开放任意用户输入的局内自由文本/.test(requirement) && /不写 Direct Chat 历史、数据库、Supabase、Replay、moveLog/.test(requirement) && /不修改六款规则、游戏文件、共享 Rule Core/.test(requirement) && /不提交、不推送/.test(requirement));

if (failures) {
  console.error('SOCIAL_MATCH_CONTRACT_FAILURES=' + failures);
  process.exitCode = 1;
} else {
  console.log('SOCIAL_MATCH_CONTRACT_ALL_PASS');
}
