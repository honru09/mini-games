# 技术优化主线 T7 Room Graph Recovery Timer P9 收口

## 一句话结论

P9 已将 Room Graph Recovery 的低风险周期扫描迁移到 `ServerClockTimer` owner lease，并通过 Timer Audit、ServerClockTimer 与 Tournament Atomic Online 回归；T7 继续 `partial`，项目保持本地未发布。

## 做了什么

- 固定 `room-graph-recovery` owner，使用 `serverClockTimer.schedule({ delayMs, repeat: true, run })` 创建周期 lease。
- 队列清空时通过 lease `cancel()` 停止周期；server close 继续由统一 `serverClockTimer.dispose()` 清理。
- 保留 Room/Presence Adapter、quarantine、事务恢复、赛事编排、广播顺序和错误语义。
- 增加 Timer Audit 的 owner/取消静态合同；没有修改前端、美术、音频、3D 或玩家 wire。

## 用户现在能看到什么

没有新增玩家可见界面或玩法；房间恢复周期的计时所有权更集中，恢复队列为空时不再保留原生 interval。

## 还没做什么

- heartbeat、guest/reconnect、Chat/Expression delay、Reward/AI outbox、gameplay tick、transport deadline 与 Metrics `generatedAt` 仍未迁移。
- 第二浏览器、真机、真实网络、真实 Supabase/RLS/并发/备份恢复/多实例与发布均未执行。

## 验证

- `node --check server/index.js`：通过。
- `node qa/timer-audit.js`：`TIMER_AUDIT_ALL_PASS`。
- `node qa/server-clock-timer.js`：`SERVER_CLOCK_TIMER_ALL_PASS`。
- `node --experimental-websocket qa/tournament-atomic-online.js`：`TOURNAMENT_ATOMIC_ONLINE_ALL_PASS`。
- `git diff --check`：通过。

## 风险与下一步

P9 只覆盖一个低扇出生命周期 owner；下一步仍按顺序评估其他 lifecycle timer，heartbeat、outbox、gameplay tick 与 transport deadline 必须拆分验证，不能在同一批混合迁移。

## 发布状态

`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。未提交、未推送、未部署。

## 追溯入口

- `requirements/active/t7-room-graph-recovery-timer-p9-20260818/`
- `server/index.js`
- `qa/timer-audit.js`
- `qa/tournament-atomic-online.js`
