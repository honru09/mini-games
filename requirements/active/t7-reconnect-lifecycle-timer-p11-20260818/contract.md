# P11 合同

1. `reconnect-expiry:<sessionId>` 是 reconnect grace 与 Presence 失败重试的唯一 owner。
2. `room-removal-retry:<sessionId>` 是 `leaveRoom()` 删除失败重试的唯一 owner。
3. `cancelReconnectTimer()` 与 `cancelRoomRemovalRetryTimer()` 先从 Session 脱离字段，再调用 lease `cancel()`；native handle 只作为兼容分支。
4. `scheduleReconnectTimer()` 与 `scheduleRoomRemovalRetryTimer()` 不直接把 native timeout 写入 Session；ServerClockTimer 失败时记录分类 operational error。
5. lease 回调先把 Session timer 字段置空，旧 lease 不能通过 owner/generation fence 重入新 lease。
6. Room/Presence Boundary 的旧 timer 清理调用统一经过 `cancelServerTimer()`，因此 lease 与旧 native handle 都安全。
7. P11 不改变 reconnect grace、resume、房间移除、重试上限/退避、广播和协议。

