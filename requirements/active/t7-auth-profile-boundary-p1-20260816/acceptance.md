# T7 Auth/Profile Boundary P1 验收

状态：`VERIFIED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

- [x] Module 只暴露 `session/profile`，Adapter 只暴露 `get/list/put/remove`。
- [x] JSON/runtime 与 in-memory 两个 Adapter 都通过同一 Interface 测试。
- [x] deterministic clock 覆盖 TTL、旧 record 迁移和五会话淘汰。
- [x] logout 只撤销当前 token；其他 token 继续有效。
- [x] username/password、旧 PIN、legacy bind、guest 的回归保持原 wire（`npm run test:ghost-auth`）。
- [x] private/public/read/compare 投影字段完全兼容，public/compare 不泄漏私有字段。
- [x] Profile update 白名单拒绝 coins/XP/level/wins/owned/auth/purchase 等权威 mutation。
- [x] Test Admin 继续不进入公开/compare 投影。
- [x] Supabase Adapter 回归证明 schema/payload/队列时机未改变（`npm run test:supabase`）。
- [x] `server/index.js` 改动仅限冻结的窄 seam；`git diff --check` 通过。
- [x] 本专项未修改 package/台账/路由/PROJECT_STATUS/根日志/简易报告/前端/美术/发布文件。

## 证据

- `node --check server/boundaries/auth-profile.js`
- `node --check server/index.js`
- `node qa/auth-profile-boundary.js` → `AUTH_PROFILE_BOUNDARY_ALL_PASS assertions=10`
- `npm run test:ghost-auth` → credentials + online 全通过（14 项线上回归）
- `npm run test:security` → `SECURITY_ALL_PASS`
- `npm run test:supabase` → `SUPABASE_ADAPTER_ALL_PASS (26 assertions)`
- `node --experimental-websocket qa/profile-compare-online.js` → `PROFILE_COMPARE_ONLINE_ALL_PASS`
- `node qa/profile-compare-contract.js` → `PROFILE_COMPARE_CONTRACT_ALL_PASS`
- `npm run test:technical-optimization-t7` → boundary/isolated metrics 全通过
- `node --experimental-websocket qa/test-admin-security.js` → `TEST_ADMIN_SECURITY_ALL_PASS`
- `node --experimental-websocket qa/game-cosmetic-profile.js` → `GAME_COSMETIC_PROFILE_ALL_PASS`
- `node qa/social-guards.js` → `SOCIAL_GUARDS_ALL_PASS`
- `git diff --check` → 通过

## 未覆盖的发布证据

完整 `npm test` / `npm run quality:gates` 需待并行前端/美术 lane 合并并更新确定性构建哈希后由主代理统一执行。真实 Supabase/RLS、备份恢复/回滚、多实例、第二浏览器、真机和真实网络仍是发布证据，不能由本地回归冒充。当前没有 commit、push 或部署。
