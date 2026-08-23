# T7 P14 — Supabase Reward/AI Outbox Cadence

## 范围

把正式 Supabase 开启时的 Reward 与 AI Learning outbox 重试从两个原生 interval
迁移到一个 `ServerClockTimer` owner。保留幂等 RPC、leader-only、多实例单写者、失败重试与启动时补偿语义。

## 复用需求

- `TECH-039`：统一 Timer/Adapter 架构与回滚边界。
- `TECH-040`：健康扫描和定时器生命周期治理。
- `TECH-052`：连续主线、证据和发布冻结。

## 不在本批

本批不执行真实 Supabase 迁移、RLS、并发、备份恢复、多实例生产租约、设备/网络矩阵或线上部署。
