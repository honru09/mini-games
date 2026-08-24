# 技术优化主线 T7：Transport Deadline P20 本地收口

- 日期：2026-08-23 17:00
- 阶段：CLOSE
- 需求归属：TECH-039、TECH-040、TECH-052（不新增 Requirement ID）
- 状态：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## 本批完成

1. 新增 TransportDeadline 深模块，统一管理 outbound AbortSignal 的截止时间、父 signal、主动取消和 dispose。
2. DeepSeek AI 两次兼容请求共享同一 ServerClockTimer deadline；Supabase REST 请求不再直接调用 `AbortSignal.timeout`。
3. 生产 Cluster TelemetryExporter 通过注入的 `deadlineFactory` 使用同一 seam，既有 allowlist、重试和错误隔离保持不变。
4. deadline 调度失败 fail-closed，不扩大网络、凭证或数据边界；未改变协议、奖励、Supabase schema 或前端产物。

## 验证

- `node --check server/index.js`：通过
- `node --check server/cluster-coordinator.js`：通过
- `npm run test:technical-optimization-t7-transport`：通过
- `node qa/timer-audit.js`：通过
- `node qa/technical-optimization-mainline-contract.js`：通过
- `node qa/production-readiness-contract.js`：通过
- `node qa/progress-ledger.js`：242 requirements / 89 sources / 267 dependency edges 通过
- `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`
- 完整 `npm test`：退出码 0

## 边界与下一步

本批只完成 outbound deadline 本地纵切，未完成 Metrics `generatedAt`，也未执行真实 Supabase、设备、网络、多实例或线上发布。下一条主线是 Metrics generatedAt 的独立迁移；当前仍停在 `LOCAL_ONLY / NOT_RELEASED`。
