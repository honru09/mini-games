# Tank Ghost3D vertical slice P5 — frozen contract

## 1. Authority firewall

```text
committed local/AI Tank state OR accepted raw tank-authority-v1 receipt
  -> TankGhost3DPresenter
  -> frozen Tank3DFrame + optional bounded semantic event
  -> Ghost3DFoundation
  -> optional Tank Three Renderer Adapter
```

不存在反向箭头。Presenter/Renderer/GSAP 不得修改或确认输入、位置、碰撞、射击、命中、重生、排名、结果、Replay、Reward、AI、协议、数据库或任何玩家数据。

## 2. Deep Module Interface

```text
TankGhost3DPresenter.create(readModel)
  -> { commit(), snapshot(), dispose() }
```

- `commit()` 同步读取当前已提交事实，验证、冻结、去重并投递；lazy import、Foundation host、slot、generation、adapter epoch、fallback 和 cleanup 全部私有。
- `snapshot()` 只返回冻结诊断，不返回 raw receipt、游戏状态、DOM、token、Renderer 或可变对象。
- `dispose()` 幂等且永久失效。
- `tank.js` 只在现有 `render()` 的安全尾部调用一次 `commit()`；reset/root change/source change 由 `readModel()` 的 epoch/mount/receipt 变化驱动新静态 generation。

## 3. Exact gate and source trust

Renderer 仅在以下两个条件同时成立时允许 import：

```text
localStorage.getItem('mg_art_game_stage_wave_b_v1') !== '0'
localStorage.getItem('mg_ghost3d_tank_v1') === '1'
```

storage 异常、缺失 exact opt-in、Wave B 关闭、Replay、online legacy relay、错误 match/protocol/人数/网格/tick、未接受或乐观状态均禁用并恢复 DOM。

online `onAuthoritySnapshot()` 必须在现有校验成功后、把权威位置混入 DOM 本地平滑前，保存一份深裁剪 raw receipt。receipt 只存在内存，不进入 `snapshot/serialize/moveLog/Replay/Analytics/AI/Reward/DB`。live 只接受同 match 且严格更大的 `serverTick`；重复相同投影忽略，重复 tick 不同投影 fail-closed。

正常服务端广播来自偶数 tick，因此离散语义事件只允许 `serverTick === previous.serverTick + 2`。更大 gap 可更新静态最终帧但不得补播事件；bootstrap/reconnect 使用现有 `silent=true`，统一作为静态 `reconcile`，不修改 WebSocket。

## 4. Frozen frame

```text
{
  kind: 'tank-3d-frame-v1',
  revision: non-negative safe integer,
  origin: {
    source: 'local' | 'live' | 'reconcile',
    matchId?: non-empty string,
    serverTick?: non-negative safe integer,
    continuity: 'interpolate' | 'snap'
  },
  arena: {
    width: 15 | 17,
    height: 13,
    season: 'spring' | 'summer' | 'autumn' | 'winter',
    cells: 13 rows × width of 0 | 2 | 3
  },
  playerCount: integer 2..5,
  tanks: [{ id, x, y, direction, hp, alive, shielded }],
  projectiles: [{ id, owner, x, y, direction }],
  terminal: boolean,
  winner: integer -1..4
}
```

上限为 5 tanks、128 projectiles、221 terrain cells。数值必须 finite 且在 Arena 合理边界内。

Frame 明确排除 input、ack、seq、clientTick、fire/respawn 时间、shots/hits/kills/deaths/damage/placement、倒计时、昵称/UID/头像/聊天、外观资产、奖励、库存、AI、Replay、raw payload、DOM、函数、URL、Three/GSAP 对象。Presenter 可私下读取 counters 作为事件验证 guard，但不向 Renderer 输出。

## 5. Continuity and semantic events

本地/AI 只有相同 generation 的连续 committed render 才可插值/推导；online 只有相同 match 的连续 `+2` accepted raw receipt 才可。首帧、reset、restore、Replay、silent bootstrap、source/match/root/size change、tick gap、context recovery、terminal 均 `snap`。

每个 frame 最多选择一个事件，优先级固定：

```text
tank_ko > tank_hit > tank_fire > tank_spawn
```

事件必须由前后 counters/alive/hp/projectile 的单一无歧义转变精确证明，携带 target frame revision、generation 内唯一 eventId、seat、位置和仅 fire 所需方向。多事件、来源不连续或因果不明只静态呈现。Authority result 不是 Frame 来源；收到结果时 optional slot 退回 DOM，由既有结算层接管。

## 6. Renderer and input ownership

Adapter factory 只接收 mount、quality、reducedMotion、ready/error/context callbacks，返回 Foundation 既有 `mount/render/motion/setQuality/environment/suspend/resume/contextLost/dispose`。没有 `onInput`、raycast、command、click、touch、wheel 或 keyboard callback。

Canvas 永远 `aria-hidden=true`、`role=presentation`、`tabindex=-1`、`pointer-events:none`。`.tank-board` pointer fire、摇杆、D-pad、键盘、独立开火、HUD、玩家/聊天、Wave C、结算和可访问节点永久由 DOM 持有。ready 只能隐藏 board 内纯绘制叶节点，不得隐藏 board 根或输入命中层。

## 7. Interpolation, GSAP and performance

- Snapshot 更新只替换 Renderer 私有 `fromPose/targetPose`；最多约 90ms 内插，不外推。不得在 tick/packet/rAF 中创建 tween/timeline/mesh/material/geometry/texture。
- 固定池：5 tanks、128 projectiles、最多 221 terrain instances、少量预分配 FX proxy；不按帧无界增长。
- HIGH：一个 active timeline，最多 3 child tweens；BALANCED 最多 2；LOW/reduced-motion 0 timeline。只使用 120/180/260ms Motion Tokens。
- GSAP 只驱动 Adapter 私有 FX pose；不得参与位置插值、规则、输入、网络节奏或 DOM layout。禁止 CSSPlugin、ScrollTrigger、loader、GLB、texture、CDN、repeat/yoyo 和 ambient loop。
- hidden/suspend 停止 animation loop；resume/recover 先静态同步最新 frame，不补播历史事件；新 frame/事件 kill 当前有限 timeline。

## 8. Lifecycle and failure

Presenter generation 隔离 match/reset/source/root/context；Adapter epoch 隔离每个 import/factory/ready/error/context callback。所有 late import、rAF、ResizeObserver、GSAP completion 均检查两者。hard import/support/mount/first/later render failure 在当前 generation sticky，不得被每个实时 tick 重试。

任何失败立即清除 ready、恢复 DOM paint，游戏继续。Context loss 销毁旧 Adapter，以 fresh Presenter generation 和最新可信 frame 静态恢复。Dispose 清除 canvas、loop、observer/listener、timeline/context、geometry/material/renderer，且幂等。

## 9. Art and release

P5 本批只使用程序化 geometry 与现有 vendor，不在该历史纵切中接入 `ART-035`、asset manifest、GLB、纹理或 source-only 候选。设备与 Supabase Gate 为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；原创 Art Gate 为 `OPEN_BY_OWNER_AUTHORIZATION`，后续逐资产取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可另行接入可逆 runtime 候选。人工/IP/Golden Set 仅为可选咨询。本合同不授权 commit、push、deploy 或 production release。
