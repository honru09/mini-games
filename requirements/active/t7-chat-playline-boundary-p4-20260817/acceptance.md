# P4 本地验收

## 当前结论

`WIRED_LOCAL_VERIFIED`：`server/boundaries/chat-playline.js` 已通过本地 JSON lane 接入 `server/index.js` 的 Direct Chat 与 Playline caller；Supabase 配置时保留既有事务 RPC fallback。该状态不提升 T7、`TECH-040` 或任何生产/发布状态。

## 已验证

- 两个公开 Module 方法与协议常量稳定，发送/已读 mutation 在边界内串行化。
- JSON canonical/legacy 与 memory Adapter 的 detached state、commit 和故障边界。
- 正式账号/访客/Test Admin/显式失效 actor 的 admission。
- 已识别的 Test Admin 目标在 history/send/read 保持稳定 `test_admin_isolated` reason；含脏历史的会话不会进入 list/unread 投影。
- 文本 NFC/控制符净化、500 code point/2000 UTF-8 bytes、纯文本消息投影。
- 好友/陌生人/Block、消息幂等冲突、历史分页、未读汇总、入站且单调的已读。
- 四类发送频控的 reservation rollback 和 Adapter 故障时不确认消息。
- Playline 四动作委托、私有字段净化、未知动作/异常 fail-closed。
- Module 不依赖传输、页面、数据库客户端或玩家经济实现。
- 本地 caller 接线保持既有 `chat_state/chat_history/chat_send_ok/chat_message/chat_read_ok/chat_error` 与 `playline_*` wire；WebSocket 广播、session 生命周期和 Cluster fan-out 继续由 caller 负责。

本地接线后的兼容回归也通过：`node --experimental-websocket qa/player-chat-online.js`（`PLAYER_CHAT_ONLINE_ALL_PASS`）、`node --experimental-websocket qa/playline-online.js`（`PLAYLINE_ONLINE_ALL_PASS`）与 `node --experimental-websocket qa/security-online.js`（`SECURITY_ALL_PASS`）。

执行：

```text
node qa/chat-playline-boundary.js
CHAT_PLAYLINE_BOUNDARY_ALL_PASS assertions=22
```

## 未执行 / 保留风险

- Supabase 配置时 Chat 仍走既有 `send_direct_message_v1` / `apply_direct_message_read_v1` 事务 RPC fallback；真实 Supabase/RLS/备份恢复、多实例 PubSub、第二浏览器、真机或真实网络尚未执行。
- `createJsonRuntimeChatPlaylineAdapter` 的 legacy shape 与本地接线不等于生产事务或跨实例一致性；server 全局 clock/Timer 也不在本批范围。
- history/read 的查询频控顺序与旧 inline/Supabase caller 保持一致：先 reserve，再解析目标；Test Admin 隔离不会成为查询频控旁路。
