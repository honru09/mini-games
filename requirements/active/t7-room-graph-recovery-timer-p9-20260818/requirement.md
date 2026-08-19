# T7 Room Graph Recovery Timer P9

状态：`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## Requirement 归属

本批是既有 Room/Presence 恢复流程的 Shared Repair，复用 `TECH-039`、`TECH-040` 与 `TECH-052`，不新增玩家能力、协议、持久数据或 Requirement ID。

## 目标

把 `roomGraphRecovery` 的低风险周期扫描从原生 `setInterval` 迁移到 P6 `ServerClockTimer.schedule()`，让 owner、取消、server close 与异常隔离复用同一生命周期 seam。

## 范围内

- `roomGraphRecoveryQueue` 仍由现有 Room/Presence 事务拥有。
- 仅迁移周期触发与停止，不改变恢复函数、重试顺序、quarantine、房间 wire 或赛事编排。
- 保留恢复队列为空时的即时 lease cancel 和恢复失败时的既有 fail-closed 行为。

## 不在范围内

- 不迁移 heartbeat、guest/reconnect、Chat/Expression delay、Reward/AI outbox、gameplay tick、transport deadline 或其他高扇出时间 owner。
- 不改变 Room/Presence Adapter、Supabase、协议、奖励、前端、美术、音频、3D 或发布。

## 回滚

恢复 `setInterval(runRoomGraphRecoverySweep, ROOM_GRAPH_RECOVERY_SWEEP_MS)` 与 `clearInterval` 兼容分支即可；保留 P6 Timer Module 与 P8 Boundary 接线不变。
