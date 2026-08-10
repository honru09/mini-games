# UI Repair P0.3：聊天空态语言收口简易报告（2026-08-10 09:16）

## 本次发现

玩家私聊功能本身已具备好友、历史、未读、已读、离线留言和移动端布局，但会话行把整个 row 标记为 `data-i18n-raw`，使“开始对话”等系统空态在切换语言后被错误当作玩家原文，属于语言覆盖遗漏。

## 本次修正

- `public/src/core/02-app-shell.js`：会话行不再整体标记原文；玩家昵称和真实消息预览继续通过 `chatRawNode` 保护；无消息时使用 `t('chat_start_conversation')`，可连续切换三语言。
- `qa/player-chat-contract.js`：新增回归断言，确认系统空态可本地化、玩家原文仍安全、未引入 innerHTML。
- 已重新构建 `public/index.html`，未改玩家聊天协议、服务端、数据库、权限或消息正文处理。

## 验证

- `node qa/player-chat-contract.js`：PLAYER_CHAT_CONTRACT_ALL_PASS。
- `node --experimental-websocket qa/player-chat-online.js`：PLAYER_CHAT_ONLINE_ALL_PASS。
- `npm run test:i18n`、`node qa/dom-smoke.js`、Room/Lobby、Responsive、Profile 专项：全部通过。
- `npm run quality:gates`：QUALITY_GATES_FAST_ALL_PASS。
- 最后小修后再次运行 `node qa/social-match-contract.js`：SOCIAL_MATCH_CONTRACT_ALL_PASS。
- 最终 `npm test`：ALL_PASS，152.5 秒；此前一次性 `reconnect-online` 启动波动未在本次链中复现。
- 当前构建 `public/index.html`：907134 bytes；SHA-256 `CB7E359D3A98E9BB1419FDFB80B08297462A4795B6C12D09C06F80AB57709142`。

## 后续仍开放

聊天 UI 的更深层社交功能（自由房聊、更多消息操作）仍需独立社交批次；第二浏览器、Android/iPhone/Tablet、reduced-motion 可见验证和真实网络整形仍是外部闸门。当前不提交、不推送、不部署。
