# DATA Preflight Acceptance

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于真实 Supabase 或共享 Gate 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前 `GATE-SUPABASE-PRODUCTION` 的开发状态为 `NON_BLOCKING_FOR_DEVELOPMENT`，缺失的真实生产证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`；这不表示迁移、RLS、并发、备份、恢复、回滚或多实例证据已经完成，也不授予发布权限。下方旧结果仅为历史留档，不再阻塞开发；发布仍须当前用户明确命令。

- `PASS`：当前进程只记录五类 Supabase/DB 环境变量均不存在，不输出值。
- `PASS`：`psql / pg_dump / pg_restore` 本机可用。
- `PASS`：Production Ops 默认 dry-run 明确为零连接、零写入、零备份。
- `PASS`：同 project ref、不同 database 的恢复演练被 fail-closed；不同 project ref 继续要求显式确认。
- `PASS`：Schema、Production Readiness、fake Adapter 专项通过。
- `NOT_EXECUTED`：真实数据库连接、备份、迁移、RLS、并发、恢复、回滚、Cluster 和线上发布。
- `BLOCKED`：`GATE-SUPABASE-PRODUCTION` 保持阻塞，直到四类 required evidence 全部完成。
