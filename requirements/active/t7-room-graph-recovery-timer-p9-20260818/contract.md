# Room Graph Recovery Timer P9 合同

## Seam

周期 owner 固定为 `room-graph-recovery`，由 `serverClockTimer.schedule({ delayMs, repeat: true, run })` 创建；队列清空或 server dispose 时调用返回 lease 的 `cancel()`。

## 不变量

1. 恢复队列、record.recover、onRecovered 和失败/quarantine 语义保持不变。
2. 不引入第二个 clock、全局 Date.now patch 或玩家可见 wire 字段。
3. 同一 owner 最多一个 lease；队列为空时不保留周期任务。
4. Timer Adapter/ServerClockTimer 的异常仍通过已有 operational error seam 隔离。
5. 真实设备、网络、Supabase 与发布证据不由本地测试推导。
