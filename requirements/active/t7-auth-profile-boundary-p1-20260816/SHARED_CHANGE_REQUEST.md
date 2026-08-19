# Shared Change Request — `server/index.js`

状态：`MASTER_APPROVED_FOR_NARROW_SEAM`

主代理已确认当前没有其他 agent 修改 `server/index.js`，允许本任务实施以下共享变更：

1. import `server/boundaries/auth-profile.js`；
2. 在 `db.users` 建立后创建 JSON/runtime Adapter 与 AuthProfileBoundary；
3. 把原 token helper 改为 `session(command)` 兼容 wrapper；
4. 把原 private/public/compare/update helper 改为 `profile(command)` 兼容 wrapper；
5. `hello/profile_get/profile_compare/profile/logout` 使用边界结果。

不得修改消息类型/字段、密码/PIN 算法、Supabase schema/queue、Reward/Social 权限、前端或发布配置。回滚只需恢复原 helper，不迁移数据。
