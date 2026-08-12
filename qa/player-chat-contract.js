'use strict';

/* Direct Chat contract after the Playline migration.
 *
 * This is intentionally a source contract: the page owns only the global
 * overlay mount and the DirectMessage presenter creates the dialog.  The
 * transport remains the existing direct-chat-v1 facade.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const template = read('public/index-template.html');
const shell = read('public/src/core/02-app-shell.js');
const presenter = read('public/src/core/07-playline.js');
const online = read('public/src/online/03-websocket.js');
const server = read('server/index.js');
const schema = read('supabase/schema.sql');
const locales = Object.fromEntries(['zh-CN', 'en-US', 'uk-UA'].map(lang => [lang, JSON.parse(read(`public/locales/${lang}.json`))]));

let failures = 0;
function check(name, ok) {
  console.log(`${ok ? 'PASS  ' : 'FAIL  '}${name}`);
  if (!ok) failures += 1;
}

check('四区外壳以 Playline 取代 Chat 主区',
  /const GHOST_APP_ROUTES = \['home','games','playline','profile'\]/.test(shell) &&
  /data-app-route="playline"/.test(template) &&
  !/data-app-route="chat"/.test(template));

check('旧 #/chat 深链归一到 #/playline 并打开全局 DM',
  /function routeFromHash\(\)[\s\S]*\(home\|games\|playline\|chat\|profile\)/.test(shell) &&
  /return match\[1\]==='chat'\?'playline':match\[1\]/.test(shell) &&
  shell.includes("const next='#/playline'") &&
  /function enterGhostApp\([\s\S]*const legacyChat=[\s\S]*location\.hash/.test(shell) &&
  /const legacyChat[\s\S]*\^#\\\/chat/.test(shell) &&
  /function enterGhostApp\([\s\S]*if\(legacyChat\)[\s\S]*DirectMessage\.open[\s\S]*btn-global-messages/.test(shell));

check('旧/未知 Chat view 只保留玩家语义，不复活 Honru Chat',
  /function chatViewFromHash\(\)\{\s*return 'players';\s*\}/.test(shell) &&
  /ghostChatView='players'/.test(shell) &&
  /function setChatView\(view,options\)[\s\S]*const next='#\/playline'/.test(shell) &&
  !/sendCompanion|renderCompanion|companionMessages|companionWelcome|\/api\/companion/.test(shell) &&
  !/id="(?:chat-tab-honru|honru-chat-view|honru-dock|companion-form|companion-input)"|btn-home-honru/.test(template));

check('Honru 签到协议仍与玩家私信分离',
  /function petHonru\(\)[\s\S]*type:'companion_checkin'/.test(shell) &&
  /function handleCompanionCheckin\(/.test(shell) &&
  /function initGhostShell\(\)[\s\S]*DirectMessage\.init\(\)/.test(shell));

check('模板只提供一个全局 DM overlay mount，入口委托 DirectMessage',
  /<div id="direct-message-overlay-root" class="hidden" aria-hidden="true"><\/div>/.test(template) &&
  /id="btn-global-messages"/.test(template) &&
  /id="btn-playline-open-messages"/.test(template) &&
  /globalMessages[\s\S]*DirectMessage\.open\(\{opener:globalMessages\}\)/.test(shell) &&
  /playlineMessages[\s\S]*DirectMessage\.open\(\{opener:playlineMessages\}\)/.test(shell));

check('DirectMessage 暴露稳定的 presenter API',
  /var DirectMessage = \{[\s\S]*init: directInit,[\s\S]*open: openDirect,[\s\S]*close: closeDirect,[\s\S]*accept: acceptDirect,[\s\S]*reset: directReset/.test(presenter) &&
  /global\.DirectMessage\.open = openDirect/.test(presenter) &&
  /global\.DirectMessage\.accept = acceptDirect/.test(presenter));

check('私信输入和服务端都执行 500 字/2000 UTF-8 bytes 边界',
  presenter.includes("input.setAttribute && input.setAttribute('maxlength', '500')") &&
  server.includes("if(count>500||Buffer.byteLength(text,'utf8')>2000)") &&
  /function normalizeChatText\(input\)[\s\S]*normalize\('NFC'\)[\s\S]*replace\(\//.test(server));

check('Enter 发送且 Shift+Enter 保留换行',
  presenter.includes("mounts.composer && mounts.composer.addEventListener") &&
  presenter.includes('sendDirectMessage(mounts.input && mounts.input.value)') &&
  presenter.includes("event && event.key === 'Enter' && !event.shiftKey") &&
  presenter.includes('sendDirectMessage(mounts.input.value)') &&
  presenter.includes("input.setAttribute && input.setAttribute('enterkeyhint', 'send')"));

check('玩家昵称、预览和正文均走 textContent/raw 标记',
  /function setRawText\(node, value\)[\s\S]*node\.textContent[\s\S]*data-i18n-raw/.test(presenter) &&
  /setRawText\(name, peer\.name/.test(presenter) &&
  /setRawText\(preview, item\.lastMessage\.text\)/.test(presenter) &&
  /setRawText\(body, message\.text \|\| ''\)/.test(presenter) &&
  !/\.innerHTML\s*=/.test(presenter));

check('草稿只驻留在按账号/会话隔离的内存 Map',
  /chatDrafts:new Map/.test(online) &&
  /o\.chatDrafts && directState\.peerUid\) o\.chatDrafts\.set\(String\(directState\.peerUid\)/.test(presenter) &&
  /o\.chatDrafts && typeof o\.chatDrafts\.get === 'function'/.test(presenter) &&
  !/localStorage[^\n]*chatDraft/i.test(online + presenter));

check('direct-chat-v1 capability 与四个 C→S 操作保持不变',
  /['"]direct-chat-v1['"]/.test(online) &&
  /requestChatList\([^)]*\)[\s\S]{0,220}type:'chat_list'/.test(online) &&
  /requestChatHistory\(peerUid,beforeSeq\)[\s\S]{0,260}type:'chat_history'/.test(online) &&
  /sendChatMessage\(peerUid,text,clientMessageId\)[\s\S]{0,320}type:'chat_send'[\s\S]*clientMessageId/.test(online) &&
  /markChatRead\(peerUid,throughSeq\)[\s\S]{0,220}type:'chat_read'/.test(online));

for (const type of ['chat_state', 'chat_history', 'chat_message', 'chat_send_ok', 'chat_read_ok', 'chat_error']) {
  const start = online.indexOf(`case '${type}':`);
  const handler = start >= 0 ? online.slice(start, start + 1800) : '';
  check(`客户端接收 ${type} 并交给 DirectMessage`,
    handler.includes('DirectMessage.accept(msg)') &&
    new RegExp(`type:'${type}'|type: '${type}'`).test(server));
}

check('服务端私信仍以 token/好友/Block 边界为权威',
  /function chatUser\(session,action,clientMessageId\)[\s\S]*userHasTokenHash\(user,session\.tokenHash\)/.test(server) &&
  /socialFriendship\(user\.uid,peerUid\)\|\|socialBlockedBetween\(user\.uid,peerUid\)/.test(server) &&
  /function chatValidSessions\([\s\S]*userHasTokenHash/.test(server));

check('Supabase Direct Chat 表仍启用 RLS 且只允许 service_role RPC',
  /create table if not exists direct_messages/.test(schema) &&
  /create table if not exists direct_message_reads/.test(schema) &&
  /alter table direct_messages enable row level security/.test(schema) &&
  /revoke all on table direct_messages from public, anon, authenticated/.test(schema) &&
  /grant execute on function send_direct_message_v1[\s\S]*to service_role/.test(schema) &&
  /grant execute on function apply_direct_message_read_v1[\s\S]*to service_role/.test(schema));

const requiredLocaleKeys = [
  'direct_message_title', 'direct_message_close', 'direct_message_send',
  'direct_message_loading', 'direct_message_loading_history', 'direct_message_ready',
  'direct_message_enter_hint', 'direct_message_unread_count',
];
for (const key of requiredLocaleKeys) {
  check(`三语言存在 ${key}`, Object.values(locales).every(locale => typeof locale[key] === 'string' && locale[key].trim()));
}

console.log(failures ? 'PLAYER_CHAT_CONTRACT_HAS_FAILURES' : 'PLAYER_CHAT_CONTRACT_ALL_PASS');
process.exitCode = failures ? 1 : 0;
