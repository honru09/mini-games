# Server Clock/Timer 深 Module 合同（P6）

状态：`FOCUSED_VERIFIED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

## Module、Interface 与 seam

`ServerClockTimer` 是 `server/index.js` 与具体 wall clock / Timer Implementation 之间的 seam。其外部 Interface 固定为三个入口：

```js
const clockTimer = createServerClockTimer({ adapter, onError });

clockTimer.now();

const lease = clockTimer.schedule({
  owner: 'operational-metrics-history',
  delayMs: METRICS_HISTORY_INTERVAL_MS,
  repeat: true,
  run({ owner, generation, now }) {
    operationalMetricsBoundary.capture(false);
  },
});

clockTimer.dispose();
```

调用方不接触 raw Node handle、Manual queue、`setTimeout/setInterval` 类型或 Adapter token。小 Interface 隐藏调度、清理、generation、异常和两套 Adapter Implementation，从而提供 depth、leverage 与 locality。

## Interface 合同

### `now()`

- 返回有限、非负、取整后的 Unix epoch 毫秒。
- Adapter 返回畸形值或抛错时，通过 `onError('server_clock_now', error)` 分类记录，并返回最后一个合法时间；不把原始异常写入 wire。
- `dispose()` 后返回最后合法时间，不重新访问已释放 Adapter。

### `schedule(spec)`

`spec` 仅接受：

- `owner`：非空稳定 owner 名；
- `delayMs`：有限非负整数；repeat timer 至少为 1ms；
- `repeat === true`：周期调度，否则为 one-shot；
- `run({owner,generation,now})`：本次触发 callback。

成功返回冻结的 `{ok:true,generation,cancel}`；非法输入、已 dispose 或 Adapter arm 失败返回稳定 `{ok:false,reason}`。

稳定 reason 仅包括：

- `clock_timer_disposed`；
- `clock_timer_invalid_schedule`；
- `clock_timer_unavailable`。

同一 owner 再次 schedule 时，旧 lease 先失效并产生新 generation。callback 执行前必须同时校验：Module 未 dispose、token active、owner 当前仍指向该 token。旧 generation、迟到 callback 与旧 lease 的 `cancel()` 均不能影响新 lease。

`cancel()` 幂等。callback 同步抛错或 Promise reject 时，异常经 `server_clock_callback` 分类隔离，并停止该 lease，避免重复错误风暴。

### `dispose()`

- 幂等取消全部 owner 并释放 Adapter；
- 清空 owner registry 并推进内部 generation；
- Adapter disarm/dispose 异常只经 `onError` 分类记录，不逃逸到 server lifecycle。

## Adapter seam

生产与测试通过同一内部 seam 工作：

| Adapter | 必需入口 | 隐藏 Implementation |
| --- | --- | --- |
| Node Timer Adapter | `now / arm / disarm`，并提供 owner cleanup `dispose` | `Date.now`、原生 timeout/interval、clear、raw handle、自动 `unref()` |
| Manual deterministic Adapter | `now / arm / disarm`，并提供 owner cleanup `dispose` | `dueAt + sequence` queue、FIFO、interval 重排、取消与确定性推进 |

Manual test control 另提供 `advanceBy / advanceTo / pendingCount / current / dispose`，但它不是生产 Module Interface，禁止传入 wire caller 或 child env。

Manual 时间只能向前；跨过多个 interval 时按 deadline 顺序确定性执行；单次 advance 最多执行 `10000` 个 callback，超出后 fail-closed，避免无限循环。

## 所有权边界

| 责任 | ServerClockTimer | 现有 caller / Module |
| --- | --- | --- |
| wall clock 读取、Timer arm/disarm | 负责 | 不直接使用 raw handle（已迁移 scope） |
| owner、generation、stale guard、dispose | 负责 | 提供稳定 owner，并保留业务状态 guard |
| callback 异常隔离 | 负责 | `onError` 记录分类结果 |
| Metrics capture、历史、鉴权、CSV、审计 | 不负责 | `OperationalMetrics` |
| Cluster forwarding | 不负责 | `server/index.js` / Cluster owner |
| protocol、Rule/Authority、Reward、Replay、wire | 不负责 | 原 owner 保持不变 |

## P6 精确接线边界

- `server/index.js` 只把 `OperationalMetrics` 的 `now` 注入和 `metricsHistorySweep` cadence 接入该 Module。
- Metrics schedule 失败只记录 `metrics_history_schedule`；不改变 HTTP wire。
- `server.once('close')` 与 bootstrap catch 调用全局 `dispose()`。
- `currentGameplayMetrics()`、其他 Module 内部时间 fallback 及 server 其余 raw Timer 尚未全部迁移，不能描述为 server-wide deterministic runtime。
- `IsolatedNodeProcess` 继续使用真实 Node wall clock/module cache/env；Manual Adapter 只证明显式 in-process seam。

## 后续迁移顺序

1. 复用同一个 `now` 到 Auth/Profile、Room/Presence、Match Protocol、Chat/Playline 等已有显式注入点；Reward profile/daily 另立 ownership 批次。
2. 按 owner 迁移 guest cleanup、reconnect、Room recovery、Tournament retry/advance 与 spectator/social delay。
3. 再迁移 heartbeat、Reward/AI outbox sweep。
4. gameplay tick 最后逐游戏迁移，只把相同 epoch 传给已有 Authority Interface，不改 Rule、effect ordering 或 wire。
5. AI/Supabase 的 `AbortSignal.timeout()` 属于 transport deadline，后续独立处理。

## 回滚合同

恢复 Metrics 的 `Date.now` 和原生 `setInterval` 即可撤销 P6 runtime 接线；保留 Operational Metrics Module、JSON 数据、协议、奖励与玩家数据。回滚不需要 schema migration 或数据删除。
