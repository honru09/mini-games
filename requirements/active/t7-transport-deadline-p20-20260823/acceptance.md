# T7-P20 本地验收

当前结论：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

## 已完成

- [x] 新增 `server/boundaries/transport-deadline.js`，仅暴露 `open/dispose/activeCount`，不依赖 fetch、持久化或业务协议。
- [x] deadline 使用注入的 `ServerClockTimer` one-shot lease，保留唯一 owner、超时 abort、父 signal 传播、主动取消、dispose 和异常隔离。
- [x] DeepSeek 两次兼容请求共享同一截止时间；Supabase REST 请求复用外部 signal 并统一清理；Cluster TelemetryExporter 由生产 `deadlineFactory` 注入。
- [x] 失败时不放宽请求边界：TransportDeadline 不可用直接 fail-closed，AI 仍走本地强策略/Companion 回退，Supabase 保留既有本地权威队列，Telemetry 保留既有错误记录。

## 专项证据

- [x] `node --check server/index.js`：通过。
- [x] `node --check server/cluster-coordinator.js`：通过。
- [x] `npm run test:technical-optimization-t7-transport`：`TRANSPORT_DEADLINE_ALL_PASS`。
- [x] `node qa/timer-audit.js`：transport deadline 接线通过。
- [x] `node qa/technical-optimization-mainline-contract.js`：通过。
- [x] `node qa/production-readiness-contract.js`：通过。
- [x] `node qa/progress-ledger.js`：242 requirements / 89 sources / 267 dependency edges 通过。
- [x] `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- [x] 完整 `npm test`：退出码 0。

## 保留缺口

Metrics `generatedAt` 尚未迁移到统一时间 seam；真实 Supabase/RLS/并发/备份恢复、多实例、第二浏览器、设备、真实网络和线上发布仍未执行。独立 TelemetryExporter 未注入工厂时的测试兼容回退不代表生产路径缺少 deadline。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。
