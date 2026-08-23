# P12 本地验收

当前结论：`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

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

## 本批末统一完成

- [x] `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`
- [x] 完整 `npm test` 主链、E2E 与 WS close 通过；设备/网络 posttest 在并行构建证据降为 `historical_as_of` 后独立全通过
- [x] 当前确定性构建为 2,152,958 characters / 2,167,629 bytes / `5731F0D016AFF0A7403B609FE98A7A1D6D3453C13BCD99CFBFE4067090135921`，`node scripts/build.js --check` 只读通过；该身份不冒充浏览器证据
- [x] 台账、七份进度报告、简易报告入口和三日志最终同步

## 保留缺口

正式 token TTL、其他 Room/Tournament lifecycle、Chat/Expression delay、Reward/AI outbox cadence、gameplay tick、transport deadline、Metrics `generatedAt`、第二浏览器/真机/真实网络/真实 Supabase 与发布仍未执行。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。未提交、未推送、未部署。
