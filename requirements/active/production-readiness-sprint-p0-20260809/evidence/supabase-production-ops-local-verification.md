# Supabase Production Ops 本地验证

时间：2026-08-09 13:54（Asia/Tokyo）

已通过：

- `node qa/supabase-schema.js`：新旧表、RLS、service-role RPC、租约 fencing、持久事件和游标静态合同通过。
- `node qa/production-readiness-contract.js`：生产运维默认 dry-run、先备份、事务迁移、恢复隔离目标、非破坏回滚与 payload 白名单通过。
- `powershell -File scripts/supabase-production-ops.ps1 -Action plan`：无连接、无写入的 dry-run 通过。
- `npm run quality:gates` 与 `npm test`：通过。

真实状态：`BLOCKED_EXTERNAL`。本机/Render 没有真实 Supabase URL、service-role secret 或 DB URL；本机也没有 PostgreSQL 客户端，Docker daemon 无法启动。上述证据不能替代真实项目迁移、RLS、并发、加密备份、恢复或回滚。
