'use strict';

/* UI Repair P0.9: Direct Chat presentation-only contract. */
const fs=require('fs'),path=require('path');
const ROOT=path.join(__dirname,'..');
const read=file=>fs.readFileSync(path.join(ROOT,file),'utf8');
const template=read('public/index-template.html'),shell=read('public/src/core/02-app-shell.js'),online=read('public/src/online/03-websocket.js'),server=read('server/index.js');
const locales=Object.fromEntries(['zh-CN','en-US','uk-UA'].map(lang=>[lang,JSON.parse(read('public/locales/'+lang+'.json'))]));
const failures=[];function check(name,ok,detail){console.log((ok?'PASS':'FAIL')+'  '+name+(ok||!detail?'':' :: '+detail));if(!ok)failures.push(name);}

check('会话连接/刷新状态使用可访问 live status',/id="chat-list-status"[^>]*role="status"[^>]*aria-live="polite"/.test(template)&&/online\.chatListPending\?t\('chat_refreshing'\)/.test(shell));
check('会话目录暴露 aria-busy 并有真实 loading 分支',/id="chat-conversation-list"[^>]*aria-live="polite"[^>]*aria-busy="false"/.test(template)&&/list\.setAttribute\('aria-busy',online\.chatListPending\?'true':'false'\)/.test(shell)&&/online\.chatListPending&&!conversations\.length/.test(shell));
check('聊天列表与历史请求拥有成对 pending 生命周期',/chatListPending:false, chatHistoryPending:\{\}/.test(online)&&/requestChatList[\s\S]{0,220}chatListPending=true/.test(online)&&/case 'chat_state':[\s\S]{0,80}chatListPending=false/.test(online)&&/requestChatHistory[\s\S]{0,260}chatHistoryPending\[String\(peerUid\)\]=true/.test(online)&&/case 'chat_history':[\s\S]{0,220}chatHistoryPending\[String\(peerUid\)\]=false/.test(online));
check('真实断线会清理聊天加载态而不会影响已缓存正文',/if\(!this\.connected\)\{this\.chatListPending=false;this\.chatHistoryPending=\{\};\}/.test(online)&&!/if\(!this\.connected\)[^\n]*this\.chatHistory=\{\}/.test(online));
check('会话入口有公开玩家 aria-label 与未读计数语义',/row\.setAttribute\('aria-label',t\('chat_open_conversation'/.test(shell)&&/badge\.setAttribute\('aria-label',t\('chat_unread_count',unread\)\)/.test(shell));
check('消息线程显示日期分隔且正文继续走 raw text 节点',/function chatDayLabel/.test(shell)&&/chat_day_today/.test(shell)&&/chat_day_yesterday/.test(shell)&&/chat-day-label/.test(shell)&&/chatRawNode\('div','chat-message'/.test(shell));
check('历史分页保留当前阅读位置而非强制跳到底部',/chatPreservePeer/.test(shell)&&/chatPreviousHeight/.test(shell)&&/messages\.scrollHeight-previousHeight\+previousTop/.test(shell)&&/if\(online\.requestChatHistory\([\s\S]{0,180}older\.setAttribute\('aria-busy','true'\)/.test(shell)&&!/online\.requestChatHistory\(peerUid,meta\.nextBeforeSeq\);renderPlayerChat\(\)/.test(shell));
check('历史空态区分加载中与真正无消息',/chatHistoryPending/.test(shell)&&/chat-loading-state/.test(shell)&&/!historyPending&&!rows\.length&&!pending\.length/.test(shell));
check('移动输入包含 send 键提示、安全区和 44px 操作',/id="chat-input"[^>]*enterkeyhint="send"/.test(template)&&/padding-bottom:max\(12px,env\(safe-area-inset-bottom,0px\)\)/.test(template)&&/\.chat-load-older\{[^}]*min-height:44px/.test(template));
for(const key of ['chat_refreshing','chat_history_loading','chat_day_today','chat_day_yesterday','chat_open_conversation','chat_unread_count'])check('三语存在 '+key,Object.values(locales).every(locale=>typeof locale[key]==='string'&&locale[key].trim()));
check('P0.9 未增加或更改服务端聊天消息类型',/direct-chat-v1/.test(server)&&!/(chat_day_today|chat_refreshing|chatPreservePeer)/.test(server));
if(failures.length){console.error('UI_CHAT_PRESENTATION_CONTRACT_FAILED: '+failures.join('、'));process.exit(1);}console.log('UI_CHAT_PRESENTATION_CONTRACT_ALL_PASS');
