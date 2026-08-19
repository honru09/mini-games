# T7 Server Clock/Timer P6

状态：`FOCUSED_VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## Requirement 归属

本批是既有 Server 深模块与测试隔离主线的 Shared Repair，复用：

- `TECH-039`：重大架构选择、兼容与回滚证据；
- `TECH-040`：Server/WebSocket 代码健康与深模块收口；
- `TECH-052`：隔离 Adapter、测试分组与可验证 seam。

本批不新增玩家能力、协议、持久数据或 Requirement ID。

## 目标

在不改变 protocol、Rule/Authority、Reward、Replay、Economy、Social 或玩家 wire 的前提下，建立 server wall clock / Timer 的首个真实 seam：生产使用真实 Node Timer Adapter，测试使用 Manual deterministic Adapter；调用方只学习 `now / schedule / dispose` 三入口 Interface。

当前 P6 只迁移 Operational Metrics：

- `OperationalMetrics` 构造时注入的 `now` 改为 `ServerClockTimer.now()`；
- `metricsHistorySweep` 的周期调度改为 `ServerClockTimer.schedule()`；
- server close 与 bootstrap 失败路径调用 `dispose()` 清理 owner。

这不等于 server-wide Timer virtualization。heartbeat、Room/Presence retry、Tournament、reconnect、spectator delay、Chat/Expression delay、Reward/AI outbox 与四套 gameplay tick 仍使用既有原生时间/Timer，T7 总体继续为 `partial`。

## 范围内

- `server/boundaries/server-clock-timer.js` 深 Module。
- 外部 Interface：`now()`、`schedule(spec)`、`dispose()`。
- `createNodeClockTimerAdapter()` 与 `createManualClockTimerAdapter()` 两个真实 Adapter。
- owner cleanup、同 owner replacement、generation/stale callback guard、幂等 cancel/dispose、callback/Adapter 异常隔离。
- Manual Adapter 的确定性向前推进、FIFO、interval catch-up 与有界 callback 数。
- Operational Metrics cadence/now 接线、失败分类和原 Metrics wire 兼容。
- focused QA、Timer Audit 与本事实包。

## 不在范围内

- 不迁移 `server/index.js` 其余 `Date.now()`、`new Date()`、`setTimeout()`、`setInterval()` 或 `AbortSignal.timeout()`。
- 不虚拟化 `server/testing/isolated-node-process.js` 的真实 wall clock、`hrtime`、timeout/kill 或 child process。
- 不改变 `/api/metrics`、`/api/metrics/history`、`/api/metrics/export` 的鉴权、响应形状、CSV、审计、错误 reason 或 Cluster forwarding。
- 不改变 Rule Authority tick、比赛开始/结束时间、奖励资格/数值、daily/achievement、Replay TTL、Chat 时间戳或任何 wire 字段。
- 不声称完整 `npm test`、Quality Gates、当前确定性构建、当前浏览器矩阵、第二浏览器、真机、真实网络、真实 Supabase/多实例或生产发布证据。

## 回滚

回滚时：

1. 把 Operational Metrics 的 `now` 注入恢复为 `Date.now`；
2. 把 `metricsHistorySweep` 恢复为原生 `setInterval` + `unref`；
3. 移除 `ServerClockTimer` require/实例、focused QA 与 package script 接线。

回滚不修改 Metrics history、incident、Analytics、Supabase schema、玩家档案或任何用户数据。
