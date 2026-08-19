# Server Boundary Clock Injection P8 合同

## Seam

调用方只持有一个稳定函数：

```js
const serverNow = () => serverClockTimer.now();
```

Auth/Profile、Room/Presence、Match Protocol、Chat/Playline、Reward/Economy、Reward/Progression 的既有 Interface、Adapter 与错误语义保持不变。P8 不增加新的 clock Interface，也不把 `ServerClockTimer` 实例传入业务 Module。

## 不变量

1. 六个 Boundary 读取同一 `ServerClockTimer` 合法 epoch/fallback。
2. Boundary 单元测试仍通过各自 `now` 注入进行确定性验证；调用方集成只验证 wiring。
3. P8 不调度 Timer，不改变 callback ordering、wire 时间字段或持久化形状。
4. server close/bootstrap failure 继续由 P6 `dispose()` 统一释放。
5. 其他原生 clock/timer owner 继续显式列为未迁移，不能把 P8 描述为 server-wide virtualization。
