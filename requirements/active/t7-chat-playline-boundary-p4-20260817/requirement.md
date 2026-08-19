# T7 Chat/Playline Boundary P0

## 归类

- 既有需求：`TECH-039`、`TECH-040`、`TECH-052`（Server Boundary / Shared Repair）。
- 不新增 Requirement ID，不改变 `SOC-009`–`SOC-033`、`UI-038` 的产品语义。
- 当前状态：`WIRED_LOCAL_VERIFIED`，`LOCAL_ONLY / NOT_RELEASED`。

## 目标

把 Direct Chat 的策略与存储 seam 从 `server/index.js` 的传输实现中抽出，并为既有 `server/playline.js` 提供一个可替换的调用 Adapter。保持 `direct-chat-v1`、`playline-v1` 的现有消息/结果语义，完成本地 JSON lane 接线与独立回归。

## IN

- actor admission：正式账号、访客、Test Admin、显式无效 session 的 fail-closed 结果。
- 好友/Block 关系检查、公开玩家投影白名单。
- Direct Chat 文本 NFC/控制符净化、500 Unicode/2000 UTF-8 bytes 上限。
- `chat_list/state`、`chat_history`、`chat_send`、`chat_read` 的纯策略结果。
- 90 天、每会话 500、全局 50,000 的有界内存状态；消息 `(senderUid, clientMessageId)` 幂等；已读游标单调且只能标记真实入站消息。
- JSON runtime 与 detached memory Adapter。
- Playline `list/publish/remove/report` 的既有 Module 委托和公共结果净化。

## OUT

- 本批只做 `server/index.js` 的本地 compatibility wiring，不修改 WebSocket wire、客户端、Supabase schema/RPC、Cluster 投递、Reward/Economy、Replay、Analytics、内容治理或生产配置；真实 Supabase 时保留既有 Direct Chat RPC fallback。
- 本批不宣称真实 Supabase、第二浏览器、真机、真实网络、多实例或发布证据。

## 回滚

删除新 Module、QA、active 合同与 `server/index.js` 的 boundary wiring 即可恢复既有 inline Direct Chat/Playline；本地接线保留 Supabase RPC fallback，未删除旧处理器。
