# T7 Heartbeat Sweep Timer P12

## 目标

把服务端 heartbeat 周期纳入统一 `ServerClockTimer` owner lease，并让单个会话、房间或赛事异常不能永久停止后续扫描。该批次只治理 heartbeat lifecycle 的时间采样、owner、异常隔离与释放，不改变玩家协议、房间规则、赛事规则、奖励、持久化或前端。

## 范围

- 唯一周期 owner：`heartbeat-sweep`。
- 周期仍为 `clamp(floor(HEARTBEAT_TIMEOUT_MS / 4), 1000, 10000)`。
- 单次 tick 全链复用 lease 注入的 `now`：访客到期、普通心跳超时、房间 AFK、赛事清理和 expired resume TTL。
- 访客到期继续 `session.close(true)`；普通心跳超时继续 `session.close()`，保留 reconnect 机会。
- 会话、房间、赛事和 resume TTL 分域隔离；错误记录失败仍不能让 repeat owner 失活。
- HTTP server close 统一 `dispose()` ServerClockTimer。

## 非目标

正式 token TTL、其他 Room/Tournament lifecycle、Chat/Expression delay、Reward/AI outbox cadence、gameplay tick、transport deadline、Metrics `generatedAt`、前端/3D/美术/音效、真实设备/网络/Supabase 与发布。

## 复用需求

复用 `TECH-039`、`TECH-040`、`TECH-052`；这是既有 T7 架构治理的 Acceptance Gap/Shared Repair，不新增玩家产品 Requirement ID。
