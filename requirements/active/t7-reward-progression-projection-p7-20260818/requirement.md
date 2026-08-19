# T7 Reward/Progression Projection P7

状态：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## Requirement 归属

本批是既有经济与技术边界的 Shared Repair，复用 `ECO-001`、`ECO-006`、`ECO-024`、`TECH-040` 与 `TECH-052`，不新增 Requirement ID。

## 目标

把 `server/index.js` 中对已解析 Reward 的 profile、daily、achievement、recent result、history/rewardHistory 与奖励 Analytics 投影收进 `reward-progression-v1` 深 Module。`server/reward-engine.js` 继续是唯一货币、XP、资格、等级与连胜数值 Authority；P5 `reward-economy-v1` 继续负责 outbox、幂等重试与 Supabase `apply_reward_v1`。

## 范围内

- `server/boundaries/reward-progression.js` 的单一 `apply()` Interface。
- detached profile prepare、daily/achievement/recentResults 派生、旧 reward row 形状和有序 Analytics plan。
- JSON runtime Adapter 与 Memory Adapter；Adapter commit 失败时 fail-closed。
- 统一使用 settlement `meta.at` 生成 daily key、row、economy ledger 与奖励 Analytics 时间。
- `server/index.js` 的 online/solo 两个旧调用点经兼容薄包装接入。
- focused QA、既有 Reward/Daily/Supabase/E2E 回归接线。

## 不在范围内

- 不重算或调整 Reward 数值、资格阈值、等级曲线、AI cap 或 repeat decay。
- 不接管 `daily_task_claim`、claimId 幂等、商城购买、AI learning、match_completed/replay/wire/broadcast。
- 不修改 P5 outbox、Supabase schema/RLS/RPC、玩家 profile wire、Timer、前端、美术或发布。

## 回滚

恢复 `applyResolvedProgress()` 的旧实现并移除 P7 package/Quality Gate/QA 接线；不删除历史、用户数据、outbox 或数据库字段。
