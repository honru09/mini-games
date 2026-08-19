# Reward/Progression Projection 深 Module 合同（P7）

## Interface

```js
const projection = createRewardProgression({ policy, adapter, now, ...policyHooks });
projection.apply({ user, reward, meta: { resultId, matchId, at, opponentIds, opponentKey, durationMs, meaningfulActions } });
projection.dispose();
```

`reward` 已由 `resolveMatchReward()` 生成，P7 只验证并投影，不重新计算。公开回执仅含 `ok/status/uid/resultId/row/reward/reason` 等稳定字段；raw 异常、凭证、token 与私有 Supabase 字段不跨 seam。

## 顺序与不变量

1. Test Admin 在 projection 前 virtual short-circuit，不写 profile、history、ledger、Analytics 或 outbox。
2. 普通用户先在 detached draft 上规范化，再按固定顺序投影 reward fields → played/total/wins → daily/tasks → achievements → recentResults → row/effects。
3. `eligible=false` 不增加正式局数、货币、XP、胜场、daily 或成就；只有 `afk` 使用 Resolver 的 `streakAfter`。
4. 同一 `(uid,resultId)` 相同上下文返回 `duplicate`，不重复副作用；不同 reward/meta 返回 `idempotency_conflict`。
5. Adapter commit 失败返回稳定 `reward_progression_commit_failed`，canonical user 不产生半提交。
6. 所有奖励相关时间使用同一个有限非负安全整数 `meta.at`；缺失时只由注入 clock 提供兼容 fallback。
7. P5 `syncRewardRow()` 仍在 caller 中调用；Supabase 远端失败仍是 queued/retry，不回滚已确认本地 profile projection。

## Adapter

- JSON runtime Adapter：包住当前 `db.users/history/rewardHistory/economyLedger/events` 与既有审计函数。
- Memory Adapter：完全 detached state，用于 Interface QA。
- Supabase 不新增 Adapter；继续由 P5 reward-economy seam 负责。
