# 接线说明（已审核）

已按最小 compatibility wrapper 接入 `server/index.js`，保持现有 wire：

1. 本地 JSON lane 使用 `createJsonRuntimeChatPlaylineAdapter({ shape: 'legacy', read, commit })`，观察 `db.chatMessages/db.chatReads/db.nextChatSeq`，并复用 `trimChatData/saveDB`。
2. `handleChatList/History/Send/Read` 的本地策略经过 `boundary.chat`；wire 构造、session 广播、Cluster 事件和错误翻译仍由 caller 负责。
3. `playline` 实例通过 `boundary.playline` 统一委托 list/publish/remove/report，并继续使用现有内容模块与 feature flag。
4. 配置真实 Supabase 时 Direct Chat 保留既有事务 RPC fallback；这不是生产 Gate 的替代证据。
5. 专项、Direct Chat/Playline 在线、安全回归与完整质量门禁通过后，状态为 `WIRED_LOCAL_VERIFIED`；外部证据仍后置。

接线前不得把当前合同证据描述成 `SOC-027/028/029` 或共享 Supabase Gate 的解除证据。
