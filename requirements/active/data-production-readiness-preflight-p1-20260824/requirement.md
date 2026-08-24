# DATA 生产准备只读预检 P1

状态：`MACHINE_VERIFIED_LOCAL / REAL_CREDENTIALS_NOT_AVAILABLE / NOT_RELEASED`

复用 `GATE-SUPABASE-PRODUCTION` 及既有 `TECH-016/017/018/020/021/022、SOC-027/028、ECO-006、GAME-009`，不创建新 Requirement ID。

## IN

- 默认 dry-run 的备份、迁移、验收、回滚顺序。
- Schema、RLS、service_role 权限、原子 RPC、Cluster lease/PubSub/Telemetry 合同。
- fake PostgREST Adapter 的购买、奖励、AI 学习、幂等和 outbox 回归。

## OUT

- 无真实凭证时不连接、不迁移、不备份、不恢复、不写生产数据。
- 静态/fake 结果不冒充真实 Supabase、多实例或恢复证据。

