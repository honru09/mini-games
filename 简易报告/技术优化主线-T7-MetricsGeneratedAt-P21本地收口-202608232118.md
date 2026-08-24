# 技术优化主线 T7：Metrics generatedAt P21 本地收口

- 日期：2026-08-23 21:18
- 阶段：CLOSE
- 需求归属：TECH-039、TECH-040、TECH-052（不新增 Requirement ID）
- 状态：`IMPLEMENTED_LOCAL / T7_LOCAL_SCOPE_COMPLETE / LOCAL_ONLY / NOT_RELEASED`

## 本批完成

1. Gameplay、Operational、Cluster 与 Telemetry Metrics 的 generatedAt 统一从 `serverNow` seam 取得。
2. Operational Metrics 每次 capture 只采样一个 epoch，并把同一值传入统计投影与净化；注入时钟异常不再偷读第二套系统时钟。
3. ClusterCoordinator 与 TelemetryExporter 继续保留既有字段、allowlist、RPC 与 deadline，只补显式 now 注入。
4. 没有修改 Rule/Authority、Reward、Replay、社交正文、Supabase schema、前端构建或生产配置。

## 当前验证

- `npm run test:technical-optimization-t7-metrics`：通过
- `node qa/timer-audit.js`：通过
- `node qa/technical-optimization-mainline-contract.js`：通过
- `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`
- 完整 `npm test`：首次发现并修正 `scheduleMatchSocialDelay` 误带 `at` 参数；专项房聊回归后全链重跑退出码 0

## 边界与下一步

T7 冻结的本地迁移范围至 P21 已实现，但这不代表 server 全局 Date.now 虚拟化，也不解除真实 Supabase、设备、浏览器与网络 Gate。下一步回到 CLOSE 阶段审阅剩余缺口；当前未发布线上。
