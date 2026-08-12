'use strict';

/* Direct Message presentation contract after the Playline migration.
 * The dialog is created by 07-playline.js from one template mount; this file
 * deliberately does not assert the removed standalone Chat page markup.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');
const template = read('public/index-template.html');
const presenter = read('public/src/core/07-playline.js');
const shell = read('public/src/core/02-app-shell.js');
const online = read('public/src/online/03-websocket.js');
const server = read('server/index.js');
const locales = Object.fromEntries(['zh-CN', 'en-US', 'uk-UA'].map(lang => [lang, JSON.parse(read(`public/locales/${lang}.json`))]));

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` :: ${detail}`}`);
  if (!ok) failures.push(name);
}

check('全局 DM 使用单一 mount，由 presenter 惰性创建 dialog',
  /id="direct-message-overlay-root" class="hidden" aria-hidden="true"/.test(template) &&
  !/id="direct-message-dialog"/.test(template) &&
  !/data-app-route="chat"/.test(template) &&
  /function ensureDirectStructure\(\)[\s\S]*data-direct-message-dialog/.test(presenter) &&
  /makeElement\('section', 'direct-message-dialog'\)/.test(presenter));

check('会话状态提供可访问 live/busy 反馈',
  /setSystemText\(status, o && o\.chatListPending \? 'direct_message_loading'/.test(presenter) &&
  /status\.setAttribute && status\.setAttribute\('role', 'status'\)/.test(presenter) &&
  /status\.setAttribute && status\.setAttribute\('aria-live', 'polite'\)/.test(presenter) &&
  /status\.setAttribute && status\.setAttribute\('aria-busy', o && o\.chatListPending \? 'true' : 'false'\)/.test(presenter));

check('列表与历史分别呈现连接中、加载中和空态',
  /direct_message_connected/.test(presenter) &&
  /direct_message_disconnected/.test(presenter) &&
  /o && o\.chatListPending && !conversations\.length/.test(presenter) &&
  /historyPending && !rows\.length && !pending\.length/.test(presenter) &&
  /direct_message_loading_history/.test(presenter) &&
  /!historyPending && !rows\.length && !pending\.length/.test(presenter));

check('聊天请求的 pending 生命周期成对收敛',
  /chatListPending:false, chatHistoryPending:\{\}/.test(online) &&
  /requestChatList\([^)]*\)[\s\S]{0,260}chatListPending=true/.test(online) &&
  /case 'chat_state':[\s\S]{0,180}chatListPending=false/.test(online) &&
  /requestChatHistory\(peerUid,beforeSeq\)[\s\S]{0,300}chatHistoryPending\[String\(peerUid\)\]=true/.test(online) &&
  /case 'chat_history':[\s\S]{0,380}chatHistoryPending\[String\(peerUid\)\]=false/.test(online) &&
  /if\(!this\.connected\)\{this\.chatListPending=false;this\.chatHistoryPending=\{\};\}/.test(online));

check('断线清除加载态但保留已缓存历史',
  /if\(!this\.connected\)\{this\.chatListPending=false;this\.chatHistoryPending=\{\};\}/.test(online) &&
  !/if\(!this\.connected\)\{[^}]*this\.chatHistory=\{\};/.test(online));

check('发送中的消息有 pending bubble，成功移除、失败可重试',
  /this\.chatPending\.set\(id,\{[^}]*status:'sending'\}/.test(online) &&
  /case 'chat_send_ok':[\s\S]{0,240}this\.chatPending\.delete\(clientId\)/.test(online) &&
  /case 'chat_error':[\s\S]{0,420}\.status='failed'/.test(online) &&
  /direct-message-bubble mine pending/.test(presenter) &&
  /item\.status === 'failed'[\s\S]*sendChatMessage\(peerUid, item\.text, id\)/.test(presenter));

check('玩家原文使用 textContent，系统状态使用 i18n',
  /function setRawText\(node, value\)[\s\S]*node\.textContent[\s\S]*data-i18n-raw/.test(presenter) &&
  /function setSystemText\(node, key\)[\s\S]*setAttribute && node\.setAttribute\('data-i18n', key\)/.test(presenter) &&
  /setRawText\(name, peer\.name/.test(presenter) &&
  /setRawText\(body, message\.text \|\| ''\)/.test(presenter) &&
  !/\.innerHTML\s*=/.test(presenter));

check('移动 dialog 占满安全区并保持 44px 触控目标',
  /padding-bottom:max\(12px,env\(safe-area-inset-bottom,0px\)\)/.test(presenter) &&
  /\.direct-message-composer textarea,.direct-message-composer button,.direct-message-header button\{min-height:44px;\}/.test(presenter) &&
  /@media \(max-width: 640px\)[\s\S]*height:100dvh[\s\S]*direct-message-dialog\.thread-open/.test(presenter) &&
  /\.direct-message-conversation-row[^\n]*min-height:56px/.test(presenter));

check('reduced-motion 关闭 DM 转场与滚动动画',
  /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.direct-message-overlay \*/.test(presenter) &&
  /scroll-behavior:auto!important/.test(presenter) &&
  /animation-duration:\.01ms!important/.test(presenter) &&
  /transition-duration:\.01ms!important/.test(presenter));

check('dialog 具备命名、模态、Esc/背景关闭与焦点循环',
  /card\.setAttribute && card\.setAttribute\('role', 'dialog'\)/.test(presenter) &&
  /card\.setAttribute && card\.setAttribute\('aria-modal', 'true'\)/.test(presenter) &&
  /card\.setAttribute && card\.setAttribute\('aria-labelledby'/.test(presenter) &&
  /event && event\.key === 'Escape'[\s\S]*DirectMessage\.close\('user'\)/.test(presenter) &&
  /event\.shiftKey && \(index <= 0\)[\s\S]*items\[items\.length - 1\]\.focus\(\)/.test(presenter) &&
  /event\.target === root[\s\S]*DirectMessage\.close\('user'\)/.test(presenter));

check('打开/关闭拥有滚动锁、aria-hidden 和 opener 焦点生命周期',
  /classRemove\(mounts\.root, 'hidden'\)[\s\S]*setAttribute && mounts\.root\.setAttribute\('aria-hidden', 'false'\)/.test(presenter) &&
  /acquireDirectLock\(mounts\.root\)/.test(presenter) &&
  /releaseDirectLock\(\)/.test(presenter) &&
  /classAdd\(root, 'hidden'\)[\s\S]*setAttribute && root\.setAttribute\('aria-hidden', 'true'\)/.test(presenter) &&
  /directState\.opener[\s\S]*previous\.focus\(/.test(presenter));

check('游戏舞台忙碌时不覆盖 DM，离开舞台自动收起',
  /directState\.stageBusy = gameStageBusy\(\)[\s\S]*if \(directState\.stageBusy\)[\s\S]*return false/.test(presenter) &&
  /ghostgame:shellchange[\s\S]*directState\.stageBusy[\s\S]*closeDirectInternal\('game_stage_busy'/.test(presenter) &&
  /direct_message_game_stage_busy/.test(presenter));

check('presenter 只消费 direct-chat-v1 facade，不创建新 DM wire 类型',
  ['requestChatList', 'requestChatHistory', 'sendChatMessage', 'markChatRead', 'chatState', 'chatHistory', 'chatPending', 'chatDrafts'].every(key => presenter.includes(key)) &&
  !/type\s*:\s*['"](?:dm_|direct_message_)[^'"]+['"]/.test(presenter) &&
  /direct-chat-v1/.test(online) &&
  /type:'chat_state'|type: 'chat_state'/.test(server));

for (const key of [
  'direct_message_title', 'direct_message_loading', 'direct_message_loading_history',
  'direct_message_connected', 'direct_message_disconnected', 'direct_message_ready',
  'direct_message_enter_hint', 'direct_message_guest_readonly', 'direct_message_unread_count', 'direct_message_sent',
]) {
  check(`三语言存在 ${key}`, Object.values(locales).every(locale => typeof locale[key] === 'string' && locale[key].trim()));
}

if (failures.length) {
  console.error(`UI_CHAT_PRESENTATION_CONTRACT_FAILED: ${failures.join('、')}`);
  process.exit(1);
}
console.log('UI_CHAT_PRESENTATION_CONTRACT_ALL_PASS');
