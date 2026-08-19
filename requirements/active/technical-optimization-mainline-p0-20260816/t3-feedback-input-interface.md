# T3 Feedback / Input Interface Draft

状态：`LOCAL_IMPLEMENTATION_DRAFT / NOT_RELEASED`  
范围：`GAME-037`、`GAME-038`、`GAME-014`、`GAME-044` 的本地深模块 seam；不改变 Rule、Authority、Protocol、Reward、Replay 或现有 Tank wire。

## FeedbackBus

`FeedbackBus.create()` 默认关闭。实例 Interface 只有：

- `emit(semanticCue)`
- `subscribe(localAdapter)`
- `setEnvironment(patch)`
- `dispose()`

Cue 是固定白名单而非任意文案，并必须带短、稳定的语义 `id`。Bus 以固定 64 个 ID 去重，并在 `emit()` 时检查固定 32/秒窗口；两者均为内存边界，零 timer。这样同一已接受动作的 pointer 与 accepted-action 两条上游路径不会双响。Tank 的 `tank_fire` / `tank_hit` 可携带归一化 `pan[-1,1]`，用于后续 default-off 左右声像 Adapter；模块本身不调用音频、震动、DOM、网络或持久化。`muted`、`audioEnabled`、`hapticsEnabled`、`hidden`、`reducedEffects` 独立收敛，`reducedMotion` 作为 Adapter 可见的静态提示，不阻断合法对局动作。

环境切换和 `dispose()` 递增本地 generation、清空固定队列；Adapter 失败被隔离且不抛回游戏循环。

## GameplayInputGate

`GameplayInputGate.create({ now, onIntent, bufferMs })` 默认关闭。实例 Interface 只有：

- `submit(semanticIntent)`
- `flush()`
- `reset(sessionConfig)`
- `dispose()`

`reset({ gameId, matchId, revision, bufferMs })` 显式绑定一个 match/revision 并开启新 generation，返回该受绑定的 session。调用方必须在换局、离房、重连、权威 revision 切换、失焦/可见性释放和销毁时调用 `reset()` 或 `dispose()`；该模块不会监听平台事件。

每个 intent 都必须带调用方生成的单调 `sequence`、短 `id` 和 gate 返回的 `generation`；输出给本地 Adapter 的冻结 record 补入 reset 绑定的 `matchId/revision`。它们是语义动作排序/幂等标识，不是原始设备数据，也不映射或修改既有 Tank/Tetris authority/wire sequence。重复、乱序、过期、旧 generation、未知字段和无效枚举均 fail-closed。

Tetris 保留枚举操作。Tank 统一为：

```text
{
  gameId: 'tank',
  type: 'control_state',
  direction: 'neutral' | 'up' | 'down' | 'left' | 'right' |
             'up_left' | 'up_right' | 'down_left' | 'down_right',
  firing: boolean,
  id, sequence, generation
}
```

因此八方向组合、停止/释放以及开火按下/松开均可无损表达，且不保存原始按键、触点或轨迹。后续 Tank Adapter 只把这个状态映射到既有 `sendTankInput({ seq, clientTick, input })`，并在 authority ack/reject 或重连时 reset；本模块不生成/修改该 wire `seq`。

`bufferMs` 只能为 50–100ms，默认 75ms；它是最大内存存活窗，不是延迟计时器。没有内部 timer：调用方在既有安全提交点调用 `flush()`，gate 在该时刻丢弃超时项并按接收顺序同步交给本地 `onIntent` Adapter。hidden 与 reduced-motion 不会使合法 input 被 gate 丢弃。
