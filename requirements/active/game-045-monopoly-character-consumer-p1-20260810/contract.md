# GAME-045 表现消费合同 v1

状态：`FROZEN — no runtime adapter exists`

## 1. 领域词汇与深 Module 设计

本任务的未来 **Module** 暂定为 `MonopolyCharacterPresentation`。它的职责不是“再实现一次大富翁”，而是把已验证的权威位置变为可取消、可降级的 Render Plan。它应当是一个**深 Module**：调用方只学习很小的 **Interface**，而 revision 去重、合法步进判定、角色公开投影净化、reduced-motion、资源失败与生命周期清理都留在 Module 的 **Implementation** 内部。

唯一外部 **Seam** 位于现有 `gameMonopoly().onMonopolyRuleState()` 已完成协议/match 验证之后、`renderBoard()` 之前。未来调用方只交付一份不可变的权威帧并消费返回的 Render Plan；Module 不直接操作 WebSocket、Rule Core、奖励、Replay 或数据库。

在 ART-036 通过前，唯一可用的表现 **Adapter** 是当前 `m-marker` 的确定性 fallback；本地代码原生 fallback consumer 已实现。经审批且登记到 runtime Manifest 的角色资源 Adapter 是未来第二个 Adapter；它未存在前，不能用 source draft 假装已经接入正式角色 runtime。

这种放置带来 **Leverage**：同一 revision/重连/fallback 逻辑可被在线棋盘、观战和未来录像展示复用；也带来 **Locality**：位置动画错误不会散落在 Roll、Chance、Auction、Seat 或规则代码中。

## 2. 唯一输入 Interface

未来 Frame Builder 只能从已经通过既有协议检查的在线权威快照构造如下只读输入；它不得把客户端猜测、自由文本或私有档案混入其中。

```text
MonopolyPresentationFrame {
  source: 'monopoly-rule-v2',
  cause: 'live' | 'room-restored' | 'reconnect' | 'spectator-bootstrap',
  matchId: non-empty string,
  revision: non-negative safe integer,
  stateHash: non-empty string,
  serverNow: finite integer,
  state: {
    players: [{ id, pos, alive }],
    current: integer,
    phase: 'roll' | 'resolving' | 'buy' | 'chance' | 'auction' | 'finished',
    terminal: boolean,
    winner: integer,
    placements: integer[]
  },
  transition?: {
    type: 'monopoly_transition',
    player: integer,
    events: [{ type, player?, from?, to?, steps?, ... }]
  },
  publicSeats: [{ playerIndex, playerCharacter? }],
  motion: 'full' | 'reduced'
}
```

`publicSeats[].playerCharacter` 只能是现有 `publicPresentation()` 的白名单投影：

```json
{
  "schemaVersion": "player-character-v1",
  "characterId": "character-base-01",
  "slots": {
    "body": "body-paper-01",
    "face": "face-dot-01",
    "hair": "hair-none",
    "top": "top-hoodie-01",
    "bottom": "bottom-shorts-01",
    "footwear": "footwear-sneakers-01",
    "accessory": "accessory-none"
  }
}
```

Interface 只需两项操作：

```text
accept(frame) -> PresentationPlan
reset(reason: 'new-match' | 'leave' | 'destroy' | 'protocol-fallback') -> PresentationPlan
```

`PresentationPlan` 只描述 `idle | walk | land | celebrate | hidden | fallback`、每位玩家的显示格、朝向、静态/动画意图和 fallback 原因。它不包含可执行动作、货币、文本、真实头像 URL、owned、价格、token 或任何规则可写字段。DOM/Canvas 仅作为下游 Adapter 消费这个 Plan；未获批的图片路径绝不进入 Plan。

## 3. 权威、顺序与位置不变量

1. 接受帧的前提是 `source === 'monopoly-rule-v2'`、`matchId` 等于当前实例、`revision` 严格大于已接受 revision、`stateHash` 和 players 结构有效。旧 revision、重复 revision、不同 match、空快照或未知协议均丢弃，不重播动画。
2. 首帧、`room-restored`、`reconnect`、`spectator-bootstrap`、revision 跳跃大于 1 或先前没有同 match 的权威位置时，所有存活玩家直接 `snap` 到 `state.players[id].pos`，随后为 `idle`；不补播历史路径。
3. 只有同时满足下列条件，某位玩家才可以从 `from` 步进到 `to`：
   - 帧来自连续的 `revision = previous + 1` 的 live 更新；
   - `transition.type === 'monopoly_transition'`，并有唯一对应该玩家的 `move` event；
   - event 的 `from` 等于上一份已接受权威 `pos`，event 的 `to` 等于本帧该玩家权威 `pos`；
   - `from/to` 都位于当前 `MonopolyRules.CELLS.length` 的闭区间内，`steps` 为当前 Rule Core 已定义的 `-2` 或 `2..12`，且环形模运算恰好得到 `to`；
   - 玩家在目标帧仍为 `alive`，且 motion 不是 `reduced`。
4. 任一条件不成立时立即 `snap` 到目标格，记录仅供本地可观察性使用的 fallback reason；不得反推 step、不得从骰子或 Chance 文案合成 move。以后扩展新移动类型必须先提升本合同版本和专项测试。
5. 行走期间逻辑 `state.players[].pos` 已经是目标权威位置；`renderPos` 仅是表现临时值，不能送回 `snapshot()`、`serialize()`、WebSocket、Replay、AI、奖励、Analytics 或 profile。
6. 任何后续有效 revision、`reset()`、game destroy、离房、重开、matchId 变化或资源失败都要取消未完成动画，并立即以最新权威位置重建静态 Plan；不得留下 timer、RAF、DOM 节点、焦点或跨局角色。
7. 角色的 `playerIndex` 只映射当前权威 Seat/玩家索引，不能按昵称、Avatar、uid 文本或颜色猜测。AI、访客、旧档案、观战者、缺 Seat、未知 schema/slot 都回退各自当前 token，不阻塞任何玩家。

## 4. 规则位置 → 表现状态矩阵

| 权威帧/规则状态 | PresentationPlan | 角色意图 | 交互与规则约束 | 严格 fallback |
| --- | --- | --- | --- | --- |
| 首帧、重连、观战加入、`room-restored` | 全员直接定位至当前 `pos` | `idle` | 不回放骰子或行走；UI-037 独立显示当前 phase | 当前 `m-marker` + `♟/🚗`，无资源请求 |
| `phase=roll`，无合格 move | 当前玩家高亮，其余静止 | `idle` | Roll 权限仍完全由现有客户端/服务器决定 | 静态 token |
| 连续 live 帧含合格 `move` | 按 `steps` 在 24 格环上逐格表现；最终格必须等于权威 `to` | `walk-cw` 或 `walk-ccw` 仅由 steps 正负决定 | 动画不可禁用按钮、延后 rule snapshot 或改行动权 | reduced-motion、数据异常、资源失败均直接落点 |
| `phase=resolving`，但没有合格 move | 当前权威格保持 | `land` 后转 `idle` | Chance/税/租金等由权威状态与 UI-037 展示 | 直接静止，不猜测中间格 |
| `phase=buy` | 停在可购买 property 的权威格 | `land/idle` | Buy/Pass 仍是既有 Rule Authority action；角色不点击棋盘 | 当前 token + 既有购买按钮 |
| `phase=chance` | 停在触发格；短暂 event 只由权威 transition/UI 显示 | `land/idle` | 不把卡片文本写入角色资源，也不合成下一段移动 | 无 transition 时静止 |
| `phase=auction`，`auctionEndAt` 存在 | 所有存活角色停在最新权威格 | `idle` | 倒计时可按 `serverNow` 视觉计算，但绝不关闭拍卖或出价 | 当前 token；到期只等待服务器 revision |
| `alive=false` 或破产已在权威帧出现 | 从棋盘角色层移除/置 `hidden` | `hidden` | 不可因表现消失而改变 placements、财产或胜负 | 既有 bankrupt UI，禁止残留角色 |
| `terminal=true` / `phase=finished` | 以 `winner` 和 `placements` 的权威值布置结果态 | 冠军 `celebrate`，其余 `idle` 或 `hidden` | 不自行按钱数/视觉顺序选冠军；Reward/Victory Overlay 继续现有流程 | 静态 token + 既有 Victory Overlay |
| 新 match、退出、destroy、协议/资源/角色投影失败 | 清空旧 Plan 和异步任务 | `fallback` / `hidden` | 不残留到下一局，不影响房间或输入 | 恢复现有 CSS/DOM 表现 |

## 5. 资产、隐私与 UI-037 的 Seam

- `ART-036` 当前两张方向板为 `reference-only`：它们只能帮助人工审核和未来 Adapter 设计，不能成为 `<img>`、CSS URL、Canvas texture、Shop 预览或 Manifest 条目。
- 只有以下全部完成后，才可以另立 runtime integration 任务：人工清稿、Reviewer B、IP Similarity Review、用户 Golden Set、可审计源/许可/hash、运行时 Manifest 条目、poster/静态 fallback、字节/内存预算、双主题/三语言/a11y/reduced-motion/资源失败 QA。届时新增旗标必须默认关闭，只有严格显式启用才可选用批准资源。
- 角色资源失败、浏览器解码失败、离屏、低性能或 unknown runtime ID 时，Adapter 只可使用当前 marker/token 与 CSS/DOM board。不能回退到 `art-source/`，不能降级为第三方作品，不能隐式打开 M0/P1/Honru draft。
- `UI-037` 读取同一权威快照来显示进入、回合、骰子、事件、交易、拍卖、断线恢复和结算。GAME-045 只提供非交互的角色 Render Plan，不能复制 UI-037 的控制按钮、文本、计时或对话框；这样两个 Module 在同一 Seam 共享真相，却保持各自 Interface 小而深。

## 6. 性能、可访问性与回滚

- 行走使用有限、可取消的 CSS transform/transition 或同等有限动画；禁止常驻 RAF、无限 particle、每帧重建棋盘，禁止为角色表现新建游戏计时器。
- `prefers-reduced-motion`、低性能降级和离屏恢复一律生成静态 Plan；信息仍由文本状态、Seat Rail 和既有 victory/reward dialog 表达。
- 角色 overlay 需 `aria-hidden=true`、`pointer-events:none`；玩家身份、回合、资金、买卖和结果继续由可读 HTML 表示。不得使原本 44px 操作目标变小或被遮挡。
- 未来单独旗标关闭、Manifest 失败或删除未来 Adapter 时，回滚到现有 `gameMonopoly` 的 marker/board 路径，不迁移数据、不改变 Rule Core/Authority，不需要回滚玩家档案或经济流水。
