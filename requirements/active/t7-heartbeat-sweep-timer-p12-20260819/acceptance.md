# P12 本地验收

当前结论：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

## 已达到

- [x] heartbeat 原生 interval 迁移为唯一 `heartbeat-sweep` repeat lease。
- [x] 单次 tick 复用 lease `now`，并把 `clearExpiredResumes(now)` 纳入同一采样时间。
- [x] 访客 `close(true)`、普通超时 `close()`、AFK、赛事和 resume TTL 原语义保持。
- [x] 新增 `HeartbeatSweepIsolation` 小接口与 Manual Clock 动态故障注入；同 tick 后续分域和第二 tick 均继续运行。
- [x] Timer Audit 只在 heartbeat 源码块内锁定 owner、时间、隔离上下文、关闭语义、schedule error 与 server dispose。

## 已运行证据

- [x] `node --check server/index.js`
- [x] `npm run test:server-clock-timer`：`SERVER_CLOCK_TIMER_ALL_PASS`、`HEARTBEAT_SWEEP_ALL_PASS`
- [x] `npm run test:technical-optimization-t7`：全部通过
- [x] `node qa/timer-audit.js`：`TIMER_AUDIT_ALL_PASS`
- [x] Room/Presence 43 项、Ghost Auth、Connection Route、Reconnect Online：全部通过
- [x] Tournament unit、Auto、Atomic、Recovery：全部通过
- [x] 独立端口 `qa/e2e-online.js`：`E2E_ALL_PASS / E2E_EXIT=0`

## 本批末待统一完成

- [ ] `npm run quality:gates`
- [ ] 专用 QA 端口完整 `npm test`
- [x] 并行前端/3D/美术源码已确定性聚合为 2,099,543 characters / 2,114,168 bytes / `E21CAA1CDC1D7E8B2FCD35A74DEB5A1A98CAAD69384A0F7D3C7AC77541693526`，`node scripts/build.js --check` 只读通过；该身份不冒充浏览器证据
- [ ] 台账、状态、七份进度报告、简易报告入口和三日志最终同步

## 保留缺口

正式 token TTL、其他 Room/Tournament lifecycle、Chat/Expression delay、Reward/AI outbox cadence、gameplay tick、transport deadline、Metrics `generatedAt`、第二浏览器/真机/真实网络/真实 Supabase 与发布仍未执行。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。未提交、未推送、未部署。
