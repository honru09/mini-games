# Reward/Economy 深模块合同（P5）

## Interface

```js
const boundary = createRewardEconomyBoundary({
  adapter,
  enabled,
  now,
  isExcluded,
  remoteApply,
});

await boundary.enqueue({ uid, user, row });
await boundary.retry({ userResolver });
boundary.dispose();
```

公开结果只含 `ok`、稳定 `reason`、`resultId`、`queued/synced/pending` 等有限字段；远端异常文本、凭证和 profile 私有字段不得跨边界。

## 不变量

- `uid`、`resultId`、`game`、`mode` 缺失或畸形时 fail-closed。
- 同一 `(uid,resultId)` 同一行只保留一个 outbox；不同内容返回 `idempotency_conflict`。
- 本地持久化先于远端调用；远端失败保留可重试条目，远端 `applied` 或 `duplicate` 都是成功终态。
- 同一 uid 的 enqueue/retry 串行，不同 uid 不共享顺序锁。
- Test Admin、访客和 disabled lane 不写 outbox、不调用远端。
- Adapter load/save 使用 detached plain state，容量有界；异常只返回 `server_unavailable`。

## 所有权边界

| 责任 | Reward/Economy Boundary | 现有 caller / Resolver |
| --- | --- | --- |
| outbox、幂等、串行、重试 | 负责 | 提供 row/user |
| Reward 数值、资格、等级曲线 | 不负责 | `server/reward-engine.js` |
| profile projection、daily/achievement side effects | 不负责（本 P5） | `applyResolvedProgress` |
| Supabase SQL/RLS/RPC 实现 | 不负责 | 注入 `remoteApply` |
| result wire、广播、session | 不负责 | `server/index.js` |
