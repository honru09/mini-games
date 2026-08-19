# P5 本地验收（已完成本地验证）

当前结论：`VERIFIED_LOCAL / LOCAL_ONLY / NOT_RELEASED`。P5 已接入本地 JSON runtime，并通过完整自动化回归；不提升 T7 为 complete，不解除 Supabase/设备/网络 Gate。

已完成：

- `reward-economy-v1` 只暴露 `enqueue/retry/dispose`。
- Memory/JSON Adapter detached state、容量上界、legacy `pendingRewardSync` 兼容。
- 同 uid 串行、resultId 幂等/冲突、先落 outbox 后远端、失败保留与 duplicate 成功。
- Test Admin/guest/disabled 排除与敏感字段 fail-closed。
- `server/index.js` 的本地 `syncRewardRow`、启动/周期 retry 接入；Reward Resolver 和结果 wire 未改。

专项入口：

```text
npm run test:reward-economy-boundary
node qa/reward-system.js
node --experimental-websocket qa/supabase-adapter.js
```

保留缺口（P5-6）：

- 真实 Supabase migration/RLS/并发、加密备份/隔离恢复/回滚、多实例 lease/PubSub、真实设备/网络和发布证据。
