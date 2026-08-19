# P11 本地验收

当前结论：`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

## 已达到

- [x] reconnect grace 与 `expireDetachedSession()` Presence 失败重试使用按 Session 隔离的 `reconnect-expiry:<sessionId>` lease。
- [x] `Session.leaveRoom()` Presence 删除失败重试使用按 Session 隔离的 `room-removal-retry:<sessionId>` lease。
- [x] 回调先清空字段；成功恢复/离房与 Boundary 清理都能取消 lease。
- [x] 原有重试上限、退避、席位、恢复窗口和 wire 语义保持不变。
- [x] Timer Audit 增加 owner、取消、回调顺序与 Boundary cancel 适配断言。

## 运行证据

- [x] `node --check server/index.js`
- [x] `node qa/timer-audit.js`：`TIMER_AUDIT_ALL_PASS`
- [x] `node qa/connection-route-resilience.js`：`CONNECTION_ROUTE_RESILIENCE_ALL_PASS`
- [x] `node --experimental-websocket qa/reconnect-online.js`：`RECONNECT_ALL_PASS`
- [x] `node --experimental-websocket qa/e2e-online.js`：完成退出码 0
- [x] `node scripts/build.js --check`：当前工作树 `public/index.html` 2,077,538 characters / 2,092,161 bytes / SHA-256 `1CFC9A4E7D2F5CB16B7180437D6BA8080E0338B42E73AA614E4568CE51C31ACB`
- [x] `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- [x] 完整 `npm test`：专用 QA 端口集合下 `NPM_TEST_EXIT=0`，pretest/test/posttest 全链通过。

## 保留缺口

heartbeat、正式 token TTL、Room/Tournament 其他 lifecycle、Chat/Expression delay、Reward/AI outbox、gameplay tick、transport deadline、Metrics `generatedAt`、真实设备/网络/Supabase 与发布证据仍未执行。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。未提交、未推送、未部署。
