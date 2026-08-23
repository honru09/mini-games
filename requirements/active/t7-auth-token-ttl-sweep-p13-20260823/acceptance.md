# P13 本地验收

当前结论：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

## 已实现

- [x] `Auth/Profile` boundary 新增 `session({ action: 'sweep_expired' })`，单次采样时间并统计扫描、更新、清除和失败数量。
- [x] 过期、未来签发、畸形 token 均 fail-closed；legacy bare hash 仍按既有迁移语义处理。
- [x] Adapter 写入失败恢复原 token 数组，不把内部 `changedUids` 暴露到 wire。
- [x] 服务端使用唯一 `auth-token-expiry-sweep` repeat lease；多实例开启时仅 Cluster leader 执行。
- [x] 清扫后持久化 JSON、同步正式 Supabase profile，并向当前已失效会话发送 `session_expired` 后强制关闭。
- [x] server close 复用既有 `serverClockTimer.dispose()`，未新增原生 auth `setInterval`。

## 专项证据

- [x] `node qa/auth-profile-boundary.js`：`AUTH_PROFILE_BOUNDARY_ALL_PASS assertions=12`。
- [x] `node qa/timer-audit.js`：`TIMER_AUDIT_ALL_PASS`。
- [x] `node --check server/boundaries/auth-profile.js`。
- [x] `node --check server/index.js`。

## 保留缺口

- 真实 Supabase/RLS/并发/备份恢复、多实例生产租约和线上会话证据仍未执行。
- 第二浏览器、Android/iPhone/Tablet、真实网络与低端性能仍属于 PROVE 外部门禁。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。本批不提交、不推送、不部署。
