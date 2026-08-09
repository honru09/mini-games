# 玩家私聊与个人主页 P0 验收

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Chat 默认玩家消息，Honru 为独立子页且三个入口路由正确 | PASS | `qa/player-chat-contract.js` |  |
| 两正式好友在线双向发送，服务端权威 ID/seq/time/sender | PASS | `qa/player-chat-online.js` | seq 为十进制字符串 |
| 离线留言、会话列表、未读、已读、多 session 与重连恢复 | PASS | `qa/player-chat-online.js` | 含 token 淘汰旧连接拒推 |
| clientMessageId 幂等与冲突拒绝 | PASS | `qa/player-chat-online.js` |  |
| 非好友、Block、访客、越权历史、伪造 sender、超长与限频拒绝 | PASS | `qa/player-chat-online.js`、`qa/security-online.js` |  |
| 消息按纯文本渲染，正文不进入公开数据、Analytics、Replay 或普通日志 | PASS | `qa/player-chat-contract.js`、`qa/player-chat-online.js` |  |
| 本地有界留存与 Supabase 可重复 schema/RLS/revoke/索引 | PARTIAL | `qa/supabase-schema.js`、`qa/supabase-adapter.js` | 真实 Supabase 另行验收 |
| Desktop/Tablet 双栏与 Mobile 主从线程、safe-area、44px、reduced-motion | AUTOMATED_PASS | `qa/player-chat-contract.js`、`qa/ui-responsive-contract.js` | 真实视觉未执行 |
| 三语言同构并连续切换；昵称/签名/正文保持原样 | PASS | `npm run test:i18n`、`qa/player-chat-contract.js` |  |
| Profile 身份、成长、总战绩、六游戏、成就、展示、装扮、社交、任务分区 | PASS | `qa/profile-route-contract.js`、`qa/dom-smoke.js` | 不虚构字段 |
| 个人购买背景在昼夜切换后保持 | AUTOMATED_PASS | `qa/profile-route-contract.js`、`qa/ghost-shell-contract.js` | 本轮视觉未执行 |
| 玩家私聊专项、security、reconnect、social、schema/adapter、DOM/i18n 通过 | PASS | `evidence/automated-verification-202608091031.json` |  |
| `npm run quality:gates` 与完整 `npm test` 通过 | PASS | `evidence/automated-verification-202608091031.json` | npm test 119.8s |
| 360/390/768/1024/1440、双主题、三语言浏览器视觉 QA | NOT_EXECUTED | `evidence/browser-visual-qa-202608091031.md` | 连接可用但保存权限阻止 localhost |
| GitHub Pages/Render 推送、部署、HTTP/WS/线上浏览器冒烟 | NOT_EXECUTED |  | 网络当前阻断 |

## Known Issues

- 真实 Supabase 凭证尚未提供，无法完成真实迁移、RLS、并发、备份与回滚验收。
- Desktop 第二浏览器、Android、iPhone、Tablet 实机和真实网络整形尚未执行。
- Honru P2 已本地验证，但其提交仍因网络和工作区 `.git` 写权限限制未推送。

## Rollback

- 客户端从 capability 中移除 `direct-chat-v1` 并隐藏玩家消息面板，可独立回退到 Honru 子页。
- 服务端保留旧 Social Graph/Honru dispatcher；新 `chat_*` 分支可整体关闭且不影响游戏、奖励、商城和 Profile。
- Supabase 新表为增量 schema，不删除旧列/表；回滚应用时保留消息数据，不执行破坏性 DROP。
