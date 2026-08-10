# UI-037 / GAME-045 Runtime Contract v1

状态：`FROZEN / CODE_FALLBACK_ONLY`

本地后续已实现 `MonopolyCharacterPresentation.project(input)` 与现有 marker 的代码原生 fallback；完整 AuthorityEnvelope/transition Adapter、UI 状态矩阵和 ART-036 正式资源仍不接入。

## Module、Interface、Seam、Adapter、Depth、Leverage、Locality

### Module

下一实施批新增一个只读的 `MonopolyPresentationAdapter` Module。它将有序的权威 Monopoly 帧和公开 Seat 身份投影归一为可渲染的表现帧；它不生成行动、不保存经济字段、不决定规则，也不拥有 DOM 以外的持久状态。

### Interface

该 Module 对调用者只暴露三个入口，保持 Interface 小而稳定：

```text
consume(input) -> { accepted, frame, fallbackReason? }
reset(matchId?) -> void
destroy() -> void
```

`input` 仅可为以下三种有来源标识的输入：

```text
{
  source: 'started' | 'rule_state' | 'rejoined' | 'spectator_snapshot' | 'result',
  matchId: string,
  seats: PublicSeat[],
  presentation: MonopolyCosmeticPresentation | null,
  authority: MonopolyRuleSnapshot | null,
  transition: MonopolyTransition | null,
  receivedAt: number
}
```

- `rule_state` 的 `authority` 来自完整 WebSocket 事件 `msg.payload`，`transition` 由同一事件根级字段 `msg.transition` 在本地主线转交给 Module；这不新增服务器协议。
- `rejoined` / `spectator_snapshot` 的 `authority` 可来自 `monopolyRuleSnapshot`，但 `transition` 必须是 `null`，以消除补帧走格的假象。
- `PublicSeat` 只能含当前 `publicSeat()` 已公开字段，尤其 `playerCharacter:{schemaVersion,characterId,slots}`；不得附带 `owned`、`equipped` 内部 commerceId、price、coins、purchase history、token、PIN、password 或 Profile 私有字段。
- `MonopolyCosmeticPresentation` 只保留既有 `tokenSkin` 表现选择。它与 Player Character 互不替代：前者是游戏外观，后者是公开身份表现。

`frame` 至少包含：`matchId`、`revision`、`stateHash`、`phase`、`currentPlayerId`、`round`、`terminal`、`players[]`、`action`、`countdown`、`animation`、`accessibility` 和 `fallback`。每个 `players[]` 项有 `playerId`、`seatId`、权威 `pos`、临时 `visualPos`、公开身份投影或 fallback、`online` 与安全的展示标签。

### Seam

唯一权威到表现的 Seam 位于 `MonopolyPresentationAdapter.consume(input)`：

```text
MonopolyRuleAuthority snapshot / existing event envelope
        + room PublicSeat[] + existing cosmetic presentation
        -> MonopolyPresentationAdapter
        -> read-only frame
        -> Monopoly DOM renderer
```

这个 Seam 让规则、WebSocket 转发与 Monopoly DOM 可以独立变化：权威层改变时只调整输入归一；角色渲染改变时只调整 DOM renderer；动作、奖励和 Replay 不跨越该 Seam。

### Adapter

- `AuthorityEnvelopeAdapter` 是未来 `03-websocket.js` 中的薄 Adapter：保留现有 `monopoly_rule_state` wire 形状，将 `{ payload, transition }` 一起交给 Module。当前代码仅传 `payload`，因此不能在未完成该 Adapter 前承诺连续走格。
- `SeatProjectionAdapter` 将当前本局压紧后的 `seatId` 与 `state.players[playerId]` 配对。只能在 `playerId === seatId`、编号连续且人数一致时映射；否则返回 `seat_mapping_invalid` fallback。
- `CharacterRenderAdapter` 只读取有效的 `player-character-v1` 公开投影。审批资源不可用时，它必须画出确定性的程序化/既有 token，而不是读取 `art-source/`、`asset-library/` 或未审批 Manifest 项。
- `MonopolyStageRenderer` 是 frame 的消费者。它不能修正 `pos`、猜测事件、倒计时结算或把视觉结果写回 Authority。

### Depth、Leverage、Locality

这个 Module 把位置校验、事件连续性、Seat 映射、角色隐私裁剪、motion 判断、恢复降级和屏幕阅读器文案状态收进一个 Interface。Depth 来自调用者只提交一个标准输入就能得到安全 frame；Leverage 是 WebSocket、重连、观战和本地渲染共享相同决策；Locality 是角色/位置/fallback 的修复不再散落在 `monopoly.js`、`03-websocket.js`、Seat Rail 和 CSS 调用点。

## Authority input contract

可信 `MonopolyRuleSnapshot` 需要满足：

| 字段 | 使用方式 | 禁止用途 |
|---|---|---|
| `protocol === 'monopoly-rule-v2'` | 版本门禁 | 不匹配时不渲染定制状态 |
| `matchId` | 与当前 Game Shell 严格相等 | 不得跨局复用旧角色动画 |
| `revision` | 严格单调去重；仅相邻值可获得动画资格 | 不可用客户端时间替代 |
| `stateHash` | 调试/测试稳定性证据 | 不作为玩家可编辑状态 |
| `serverNow`、`auctionEndAt` | 只显示倒计时；以新快照校正 | 客户端到点不得自行 close auction |
| `state.players[playerId].pos` | 决定最终站位 | `visualPos` 不得覆盖它 |
| `state.current`、`state.phase`、`state.round` | 当前回合、操作可用性和状态提示 | 不得用来授予奖励 |
| `state.owners`、玩家 money/props/alive | 地产、支付、破产和排名展示 | 不得从 DOM 回写 |
| `state.lastEvent` / 根级 `transition` | 在连续版本下驱动短暂提示/动画 | 缺失时不得猜测连续路径 |
| `terminal`、`winner`、`order` | 结算只读展示 | 不得替代服务端正式结算 |

接受条件：`matchId`、protocol、player 数、位置区间（0–23）、`revision`、`state` 结构和 Seat 映射必须全部通过。失败后调用既有静态 Monopoly 表现，并保留可理解的中性状态提示；不抛异常、不阻塞退出、不发送补救行动。

## State matrix

| 表现状态 | 真实输入 | UI / 操作 | motion 与 fallback |
|---|---|---|---|
| `entering` | `started` 的 Seat、matchId、presentation | 显示 Seats、加载棋盘和“等待权威状态” | 无权威 snapshot 时显示静态 token；禁用 Monopoly 行动 |
| `roll_ready` | `phase:'roll'`、`current`、当前玩家 | 只让当前真人显示掷骰按钮；其他人显示轮到谁 | 不动画位置；身份无效时无身份 token |
| `roll_resolving` | 连续 `revision` + `transition.events` 的 roll/move | 锁定重复行动，展示骰子结果和当前玩家 | 仅可信连续转场逐格；无 transition/reduced-motion 直接落到权威 `pos` |
| `landing` | transition 的 `land` / authority `pos` | 显示格子名称、地标/地产归属 | 短暂强调格子；资源失败退回文字与颜色 |
| `chance` | transition 的 `chance`、`state.lastEvent` | 显示可关闭的机会卡；焦点进入卡片 | 重连仅静态摘要，不能重新抽卡或重复音效 |
| `buy_decision` | `phase:'buy'`、`pendingProperty`、`current` | 当前真人可见买/拍卖；其他角色只读 | 不使用角色动作来推断价格或可买性；未知状态隐藏动作 |
| `payment` | `rent`、`tax`、`purchase` transition 或新权威 money/owners | 显示只读金额和归属变化 | 丢 transition 时显示新权威结果，不重放扣款 |
| `auction` | `phase:'auction'`、`auction`、`auctionEndAt` | 合格真人可见现有出价操作；观战/非合格者只读 | 倒计时仅展示；本地到期等待服务器 `close_auction` 事件 |
| `bankrupt` | `players[id].alive === false`、终局/transition | 显示该玩家退出棋局和名次变化 | 静态淡出可替代动画；不删除 Seat、档案或记录 |
| `trade_unavailable` | 当前规则没有交易 action/state | 不显示可提交交易；如产品需解释，只显示本地化不可用文案 | 不伪造交易窗口或资产变化 |
| `disconnected` | Seat `online:false` / rejoin 过程 | 显示在线状态，不改变权威位置 | 暂停本地装饰动画，不推断弃权或自动移动 |
| `rejoined` | `rejoined.monopolyRuleSnapshot` + 当前 Seats | 重新绑定角色和静态棋盘，恢复可用动作 | 永远 `animation:'snap'`，丢弃旧动画队列 |
| `spectator` | `spectator_snapshot`、role | 显示相同棋盘与身份，但无 mutation 控件 | 所有角色静态同步；不将观众映射为玩家 |
| `terminal` | `terminal/order/winner`、正式 result | 显示权威结算和既有 Reward 流程 | 仅在服务端结果后展示；角色资源失败不遮挡结算 |
| `protocol_or_asset_fallback` | 无效 snapshot、Seat 映射失败、资源解码失败 | 继续现有棋盘/`character` 或 `car` token、文本状态 | 不访问未审批资源；不会中断对局、退出或重连 |

## Player Character consumption contract

1. 每个规则玩家先按 `playerId` 定位本局 `seatId`，再读取该 Seat 的 `playerCharacter` 公开投影。不能通过昵称、uid、头像数组顺序或本地 roster 猜映射。
2. `schemaVersion !== 'player-character-v1'`、缺 Slot、未知 ID、非对象、重复 Seat、AI/空 Seat、访客异常或资源不可用，都使用安全的程序化/既有 token fallback。
3. Player Character 仅决定表现标签和经批准的形象选择；它不得影响掷骰、位置、伤害、租金、买地、拍卖资格、倒计时、匹配、奖励、XP、胜场、AI、Replay 或结果。
4. Legacy `tokenSkin:'car'` 仍可决定当前已发布的 car/character token；它不能授予 Player Character Slot，也不能被角色 Slot 反向覆盖。
5. `Honru`、Logo、Avatar、Frame、Effect、NameFx、购买背景和 Player Character 是独立身份层，不得以其中任一层冒充另一个层。

## Accessibility, i18n and responsive contract

- 所有新状态标题、骰子、机会卡、买/拍卖、断线、恢复、观战和 fallback 文案使用三语言 locale；禁止新硬编码文案与运行时中文替换表。
- 当前行动、骰子结果、支付、拍卖出价和断线恢复用短暂 `aria-live` 提示；机会卡/结算遵守已有 dialog 焦点进入、Tab 循环、Esc/背景关闭与焦点恢复。
- 触控操作至少 44px；390×844、844×390、1024×768、1440×900 不横向滚动。Seat Rail 不得覆盖主行动。
- `prefers-reduced-motion`、低性能/资源失败、重连、观战快照和跳 revision 一律静态定位；不要求用户等待动画结束才能操作或恢复。

## Failure and rollback

- 无效/乱序/跨 matchId 帧：忽略该帧，保留最后一个已接受 frame；若没有已接受 frame，走既有 Monopoly renderer。
- 连续性失效：清空临时动画队列，采用权威位置 `snap`；不能补发 roll/buy/pass/bid/close_auction。
- 角色/图片失败：回退当前 `♟` 或 `🚗` 等既有 token 表现；不得读取 `art-source/` 或把方向板直接当精灵图。
- future Adapter、renderer、i18n 或样式被撤销后，删除对应 UI-037/GAME-045 实施文件并重新运行构建即可；Authority、用户资产、角色经济、规则快照与数据库无需迁移或回滚。

## Explicit gates before runtime work

1. ART-036：自然人清稿、Reviewer B、IP Similarity Review、Golden Set 均有可审计通过记录。
2. ECO-029：独立正式任务完成 active catalog、价格权威、`apply_purchase_v1`、并发/RLS、备份/恢复/非破坏回滚和安全回归；未启用时只显示 P0 default/fallback。
3. UI-037/GAME-045：先分配源码/测试所有权，再实现 `AuthorityEnvelopeAdapter`、`MonopolyPresentationAdapter`、renderer 和三语；专项 QA 覆盖上表所有状态、重连、观战、乱序和回退。
4. 浏览器/设备：四档本地浏览器、第二桌面浏览器、Android/iPhone/Tablet、reduced-motion 与真实网络整形完成前，不写成生产验证。
