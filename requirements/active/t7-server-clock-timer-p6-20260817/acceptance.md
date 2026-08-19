# P6 本地验收

当前结论：`FOCUSED_VERIFIED_LOCAL / T7 PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

P6 已证明一个真实 Clock/Timer seam，并只把 Operational Metrics cadence 与其构造注入的 `now` 接入。它不是 server-wide Timer virtualization，也不提升 `TECH-040`、`TECH-052` 或 T7 为 complete/verified/released。

## 已达到

- [x] `ServerClockTimer` 外部 Interface 只有 `now / schedule / dispose`。
- [x] 生产 Node Adapter 与 Manual deterministic Adapter 同时存在，形成真实 seam。
- [x] Node Adapter 隐藏 raw handle、timeout/interval clear 与 `unref()`。
- [x] Manual Adapter 支持只向前推进、deadline FIFO、repeat catch-up、取消与 `10000` callback 上界。
- [x] 同 owner replacement 使用 generation；旧 lease cancel 不能取消新 lease，callback 执行前有 active/owner/disposed guard。
- [x] cancel/dispose 幂等；server close 与 bootstrap 失败均释放 runtime owner。
- [x] callback、arm、disarm、dispose 与 `now` 异常经稳定 context 隔离，不把原始异常带入 wire。
- [x] `now()` 只接受非负安全整数；`null`、字符串、浮点、危险访问器与跨越 `Number.MAX_SAFE_INTEGER` 的 Manual deadline 均 fail-closed。
- [x] Node/Manual Adapter 同时执行 `0x7fffffff` 最大延迟合同，避免超长 Node Timer 溢出为近即时回调。
- [x] repeat callback 对 Promise 使用单飞语义；resolve 后恢复 cadence，reject 只报错一次并取消 owner，pending 期间 cancel/replacement/dispose 均可 fence 迟到结果。
- [x] schedule 解析期间的 dispose/reentrant mutation、`onError` 内 owner replacement/dispose 与同步 arm 的 late handle 均不会让旧 callback 复活。
- [x] `OperationalMetrics` 的 `now` 注入使用 `serverClockTimer.now()`。
- [x] `metricsHistorySweep` 使用 owner `operational-metrics-history` 的 `schedule()`。
- [x] `/api/metrics*` 的鉴权、历史、CSV、审计和错误 wire 专项保持通过。
- [x] Manual Adapter 未 monkey-patch `Date.now`、global Timer、env 或 module cache。

## Focused 证据

```text
node --check server/index.js
npm run test:server-clock-timer
node qa/timer-audit.js
node qa/server-boundary-adapters.js
node qa/metrics-online.js
```

上述命令均于 2026-08-18 当前共享树本地退出码 0；Clock/Timer 专项覆盖 23 个边界场景并输出 `SERVER_CLOCK_TIMER_ALL_PASS`，Timer Audit 输出 `TIMER_AUDIT_ALL_PASS`，Metrics Module 为 13/13，Metrics online 输出 `METRICS_ONLINE_ALL_PASS`。

## P6 后完整收口证据

- [x] `node qa/technical-optimization-mainline-contract.js`：退出码 0。
- [x] `npm run quality:gates`：退出码 0，输出 `QUALITY_GATES_FAST_ALL_PASS`。
- [x] 完整 `npm test`：退出码 0，包含 pretest/test/posttest 与 P6、音效、Tank、Xiangqi 等共享树现有回归。
- [x] 本轮 Quality Adapter 接线后的两轮 `node scripts/build.js` + `node scripts/build.js --check` 均为 `2,070,498 characters / 2,085,121 UTF-8 bytes / SHA-256 B49347FE9A9EDE743F3C5F677CBE16BAA26236493320F914DE03D5603DE8BABA`，无构建漂移。

## 主线收口边界

P6 的主线合同、当前确定性构建与完整回归已经绑定同一稳定快照；P6 没有玩家可见变化，因此未生成新的浏览器证据。server-wide clock/Timer 仍保持 partial，不得把本批 focused 通过冒充全局虚拟化。

## 保留缺口

- [ ] Auth/Profile、Room/Presence、Match Protocol、Chat/Playline 等现有 `now` 注入点尚未统一迁移。
- [ ] guest/reconnect、Room recovery、Tournament、spectator/social delay 尚未迁移。
- [ ] heartbeat、Reward/AI outbox sweep 尚未迁移。
- [ ] Tank/Tetris/Xiangqi/Monopoly gameplay tick 与 Authority 时间尚未迁移。
- [ ] transport `AbortSignal.timeout()` 尚未迁移。
- [ ] 当前浏览器矩阵、第二浏览器、Android/iPhone/Tablet、真实网络、真实 Supabase/多实例和生产发布均未执行。

## 非声明

P6 没有玩家可见 UI 变化，不产生新的浏览器证据；不得借用历史浏览器矩阵证明当前 P6 构建。它也不改变 protocol、Rule/Authority、Reward、Replay、Economy、Social、Supabase schema 或玩家 wire，未执行 commit、push、Pages、Render 或生产数据写入。
