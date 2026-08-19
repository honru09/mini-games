# T7 Reconnect Lifecycle Timer P11

## 目标

把已存在的 reconnect grace 过期、Presence 失败重试和显式离房失败重试纳入统一的 `ServerClockTimer` owner lease。该批次只治理服务端 timer 所有权与清理生命周期，不改变房间协议、席位、恢复窗口、Presence Adapter、奖励或前端。

## 范围

- `session.reconnectTimer`：reconnect grace 到期，以及 `expireDetachedSession()` 的 Presence 失败重试。
- `session.roomRemovalRetryTimer`：`Session.leaveRoom()` 的 Presence 删除失败重试。
- 每个 Session 一个 reconnect owner 和一个 room-removal owner；新 lease 替换同 owner 的旧 lease。
- 真实恢复、成功离房、Boundary 清理和 Session 关闭都能取消 lease；保留 native `clearTimeout` 兼容回滚分支。

## 非目标

heartbeat、正式 token TTL、Room/Tournament 其他 lifecycle、Chat/Expression delay、Reward/AI outbox、gameplay tick、transport deadline、Metrics `generatedAt`、真实设备/网络/Supabase 与发布。

## 约束

回调必须先清空 Session timer 字段，再执行过期或重试逻辑；失败重试沿用原有次数上限与退避；不新增 wire 字段，不改变 `resumeUntil`、`moveLog`、房间席位或广播语义。

