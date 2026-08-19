# P12 合同

1. `heartbeat-sweep` 是 heartbeat 周期的唯一 owner；不得重新直接持有原生 `setInterval`。
2. `run({ now })` 的单一时间样本同时驱动访客/普通连接超时、房间 AFK、赛事 cleanup/snapshot 与 `clearExpiredResumes(now)`。
3. 访客到期必须 `session.close(true)`；普通 heartbeat timeout 必须 `session.close()`，不能意外改成强制退出而丢失 reconnect 机会。
4. `HeartbeatSweepIsolation.run(context, operation)` 在同步分域异常后返回失败并记录分类错误，异常不得逃逸到 `ServerClockTimer` 使 repeat lease 永久取消。
5. 访客通知、强制关闭和延迟清理彼此隔离；通知或关闭失败不得阻止后续清理。
6. session/room 的属性读取与动作都处于逐项隔离内；单个损坏对象不得跳过同 tick 后续实体或下一 tick。
7. heartbeat schedule 失败只记录 `heartbeat_sweep_schedule` operational error；HTTP server close 调用 `serverClockTimer.dispose()`。
8. P12 不改变 heartbeat/AFK/赛事阈值、协议、席位、Reward、Replay、持久化、前端或线上配置。
