# T7-P18 本地验收

当前结论：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

## 已完成

- [x] Tank、Tetris、Xiangqi、Monopoly 的服务端 gameplay tick 统一通过 `scheduleRoomGameplayTimer` 创建 repeat lease。
- [x] 每个房间使用独立 owner，避免跨房间互相覆盖。
- [x] Authority 推进统一使用 `ServerClockTimer` 提供的单次 `now` 样本。
- [x] room stop/restart/settle 与 server close 都通过统一 cancel seam 清理 tick。
- [x] 原有 Rule Authority、协议、结果顺序和兼容 fallback 保持不变。

## 专项证据

- [x] `node --check server/index.js`
- [x] `node qa/timer-audit.js`：gameplay tick lease 合同通过。
- [x] `node qa/gameplay-upgrade.js`：通过。
- [x] `node --experimental-websocket qa/rule-authority-online.js`：通过。
- [x] `node --experimental-websocket qa/tournament-auto-online.js`：通过。
- [x] `node qa/progress-ledger.js`：242 requirements / 87 sources / 267 dependency edges 通过。
- [x] `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- [x] 完整 `npm test`：退出码 0。

## 保留缺口

transport deadline、真实 Supabase/RLS/并发/备份恢复、多实例、设备、真实网络与线上发布仍未执行；本批不解除外部发布 Gate。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。
