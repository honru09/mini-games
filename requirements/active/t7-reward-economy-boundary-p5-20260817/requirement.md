# T7 Reward/Economy Boundary P5

## 目标

在不改变 Reward Resolver 数值、profile 投影、WebSocket `result_ok`/`result_error`、Supabase RPC 或历史字段的前提下，把“奖励确认后的本地 outbox、幂等、按账号串行化和远端重试”从 `server/index.js` 收口到独立深模块。

本批复用既有 `ECO-001`–`ECO-006`、`ECO-024`、`TECH-040` 与 `TECH-052`，不新增玩家能力或 Requirement ID。

## 范围内

- `server/boundaries/reward-economy.js` 的 `enqueue/retry/dispose` Interface。
- JSON runtime 与 isolated memory 两个 detached Adapter；legacy `pendingRewardSync` 字段保持兼容。
- `resultId` 幂等、冲突拒绝、单账号 mutation 串行、远端成功/duplicate 成功终态、失败保留 outbox。
- Test Admin/guest 排除；凭证、会话、原始对局局面和文本不进入 outbox。
- `server/index.js` 的 `syncRewardRow` / `retryPendingRewardSync` 兼容接线；现有 profile projection、Reward Resolver、analytics、history/reward_history/economy_ledger wire 继续由既有 owner 负责。

## 不在范围内

- 不重写 `server/reward-engine.js` 的数值和资格策略。
- 不把客户端、Renderer、AI、Replay 或社交正文接入经济边界。
- 不宣称真实 Supabase/RLS、跨实例 lease/PubSub、备份恢复、设备/网络或线上发布证据；fake Supabase 只验证调用契约。
- profile projection、daily task/achievement side effects 和 server 全局 clock/Timer 仍是后续纵切。

## 回滚

移除 boundary 注入与 focused QA 即可恢复原 `syncRewardRow`/`retryPendingRewardSync`；保留 `pendingRewardSync` 数据、`apply_reward_v1` RPC、resultId 和既有流水，不删除用户数据。
