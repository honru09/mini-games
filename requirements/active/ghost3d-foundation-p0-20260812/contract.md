# Ghost3D Foundation P0 Contract

## External Interface

```text
Ghost3DFoundation.create(options?) -> Instance
Ghost3DFoundation.QUALITY -> { HIGH, BALANCED, LOW, FALLBACK }

Instance own keys -> [apply, dispose, snapshot]
```

没有 `createGhost3D`、公开 fallback 工厂，或任何 presentation/input/lifecycle 方法别名。

`options` 可注入 `adapter`、初始 `quality`、初始 `reducedMotion`、`onInput(command, snapshot)` 与可选 `onFailure(failure, snapshot)`。Adapter 必须提供 `mount(context, done?)` 和 `render(frame, context, done?)`；可选 `motion`、`setQuality`、`environment`、`suspend`、`resume`、`contextLost`、`dispose`。方法可同步返回、返回 Promise 或使用 completion callback；非 dispose 的失败会切入内部 fallback。

## apply message union

```text
{ type: 'frame', frame }
{ type: 'input', command }
{ type: 'motion', event }
{ type: 'lifecycle', action: 'suspend' | 'resume' | 'hidden' | 'visible', reason? }
{ type: 'quality', quality: 'HIGH' | 'BALANCED' | 'LOW' | 'FALLBACK' }
{ type: 'context-lost', reason? }
{ type: 'recover', adapter }
{ type: 'environment', reducedMotion: boolean }
```

`apply` 返回 frozen result：成功含 `accepted:true` 和当前 `snapshot`，拒绝含稳定 `reason` 和当前 `snapshot`。环境观察、后台/前台事件和具体输入采集属于调用方；核心只消费上述注入消息。

## Semantic state contract

- `frame`、`command`、`event` 只接受 plain data；不可投影值、循环、危险 key 与宿主对象不会穿过 seam。已接受的数据会深冻结并与调用者对象断开。
- frame 的 `revision` 是非负安全整数；缺失时首帧为 `0`，之后递增。每个显式 revision 必须严格大于前一个。
- `terminal:true` 或 terminal phase/status 一旦被接受即锁存；之后 frame 和 input 都拒绝。input/motion 必须绑定当前 revision；suspend 时 input/motion 拒绝。
- motion 保留语义并补入 `reducedMotion`、`instant`；Adapter 决定静态或动态表现。有效 motion 在 mount 或质量/环境配置未完成时仍会被冻结并以 `accepted:true, forwarded:false` 返回；所有 `forwarded:false` 的 motion 都绝不交给 Adapter、排队或重放，最新 frame 保证最终状态。
- 只有 `adapterReady && configurationReady && !suspended && !resumePending` 时才尝试调用 Adapter `motion`；每个已接受 motion 的 `forwarded` 都是稳定布尔值，且仅实际调用了 Adapter `motion` 时为 `true`，未支持或未就绪时为 `false`。suspend/resume-pending 维持既有拒绝边界。
- 每次 Adapter 替换、fallback、suspend 或 dispose 都失效旧 generation/render callback；迟到完成不得改变 snapshot 或触发新的 fallback。

## Lifecycle and recovery

- `lifecycle:hidden` 与 `lifecycle:suspend` 仅暂停表现并保留最新 frame；对应 `visible` / `resume` 解除其原因后重放最新 frame。
- `context-lost` 通知当前 Adapter 后立刻切入内部 `FALLBACK`；`recover` 必须携带一个新的有效 Adapter。
- `quality:FALLBACK` 显式切换 fallback；非 fallback quality 只在有效 Adapter 上生效，恢复必须显式发生。
- `dispose()` 清空 frame、失效所有异步工作并对每个已安装 Adapter 至多调用一次 dispose；重复调用返回同一终态快照。
