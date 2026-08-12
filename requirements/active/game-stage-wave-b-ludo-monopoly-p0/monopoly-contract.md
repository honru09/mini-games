# Game Stage Wave B：大富翁 P0 冻结合同

状态：`REQUIREMENT_FROZEN`

## 目标

在不改变迷你大富翁规则、AI、联网协议、奖励或角色公开投影的前提下，把现有
Game Stage 的代码原生棋盘提升为可读的 Wave B 表现层。玩家应能一眼辨认实体棋盘、
骰子、当前回合、当前地产/机会卡、支付与拍卖状态，以及观战/等待/结算状态。

## 范围与所有权

- 允许修改：`public/src/games/monopoly.js`、本目录 Monopoly 专属合同/验收文档、
  `qa/game-stage-wave-b-monopoly.js`。
- 不修改：`public/index-template.html`、共享 core/adapter、`ludo.js`、服务端、
  `shared/rules/**`、协议、奖励、AI、Replay、商城、locale、资源、Manifest、日志、
  构建产物、台账、提交/推送/部署。
- 既有 `MonopolyPresentationAdapter`、`MonopolyUiState`、
  `MonopolyCharacterPresentation` 是只读依赖；本批不重新实现它们。

## 权威与数据边界

1. Wave B 只消费既有 `players/pos/alive/current/phase/round/over/winner`、地产所有权、
   `auctionState` 和机会卡/支付表现。`snapshot()`、`serialize()`、AI 候选、`onMove`、
   WebSocket payload、奖励/Replay 均不得含 Wave B class/data 或临时视觉位置。
2. 在线 `monopoly-rule-v2` 的 `matchId/revision/stateHash/transition` 仍由现有
   `MonopolyPresentationAdapter` 校验；Wave B 不猜骰子路径、不补播重连/观战历史，
   不修改 `authorityReady` 或规则行动。
3. `player-character-v1` 只通过已有公开 Seat 投影消费，始终使用现有
   `code-fallback` marker；不读取 `art-source`、`asset-library`、owned、价格、余额、
   token、PIN、密码或任何 ART-036 source-only 资源。
4. 当前规则没有交易 Authority。Wave B 可以暴露稳定的只读 `trade=unavailable` 语义，
   但不得创建交易按钮、消息、状态或“交易成功”文案。

## Flag、回滚与 storage 异常

- key 固定为 `mg_art_game_stage_wave_b_v1`。
- 缺失、`null`、`false`、`'false'`、`'00'` 或其他非精确 `'0'` 值默认启用 Wave B。
- 只有精确字符串 `'0'` 回退现有 Wave A 直接棋盘/命令 DOM。
- `localStorage` 缺失、读取抛错或表现层无法建立时 fail-closed 到 Wave A；不得抛异常、
  重置局面或发送网络动作。
- 运行中重新渲染可重新读取 flag；切换只移动/标记现有节点，不改变规则状态、回合、
  角色投影、输入队列或奖励。

## 稳定表现 seam

Wave B 开启时，`area`/stage 暴露 `data-game-stage-wave-b="active"`、
`data-monopoly-phase`、`data-monopoly-status`、`data-monopoly-active-player`；并建立：

- `.monopoly-wave-b-stage` / `.monopoly-wave-b-arena`：唯一表现根与实体棋盘舞台。
- `.monopoly-wave-b-board-frame` / `.monopoly-wave-b-board`、
  `data-monopoly-region="board"`：代码原生 24 格实体棋盘与可定位 cell。
- `.monopoly-wave-b-command`、`.monopoly-wave-b-turn-hud`、
  `.monopoly-wave-b-dice`、`data-monopoly-control="dice"`、
  `data-monopoly-dice-state`：回合、骰子与既有操作入口。
- `.monopoly-wave-b-state`、`.monopoly-wave-b-property`、`.monopoly-wave-b-chance`、
  `.monopoly-wave-b-auction`、`.monopoly-wave-b-trade`：状态、地产、机会卡、拍卖和
  交易不可用的只读语义；状态文字复用已有三语 key。
- 每个实体格与玩家资金 chip 可暴露 `data-monopoly-cell`、`data-monopoly-cell-type`、
  `data-monopoly-player`、`data-monopoly-active`、`data-monopoly-alive`，仅供样式/QA。

Wave A 回滚必须恢复 `board`、`moneyRow`、`actionRow`、`settleBtn`、`stageState` 的
原有父节点顺序，并移除全部 Wave B class/data、meta 节点、倒计时 timer 和 chance
动态标记。`destroy()`、`resetLocal()`、换局、离房均执行同一清理边界。

## 状态矩阵

| 已有状态 | Wave B 只读表达 | 操作约束 |
| --- | --- | --- |
| `roll` | 当前玩家/轮次、骰子 `roll`、实体棋盘 | 仍由现有 `roll()` 决定权限 |
| `moving`/`resolving` | 骰子 `moving`、当前玩家移动中 | 不推断路径、不锁死恢复 |
| `buy` | 当前地产名称/价格、购买状态 | 只调用现有 buy/pass/auction action |
| `chance` | 机会卡状态与现有 dialog seam | 不生成新抽卡或规则动作 |
| rent/tax/purchase/payment event | 只读支付状态 | 不从 DOM 写回现金/产权 |
| `auction` | 当前价、竞价者、服务器倒计时 | 到期只等服务器；不本地 close |
| 破产/终局 | bankrupt/terminal/winner marker | 只读既有结算/Victory 流程 |
| spectator/等待/重连/fallback | 对应 status/data/ARIA | 所有 mutation 仍被现有代码拦截 |

## 动效与无障碍门禁

- 本批不引入 GSAP 运行时、插件或常驻动画；仅使用已有代码原生 DOM/CSS marker。
  设计审核已读取官方 `gsap-core` 与 `gsap-performance`：若未来加入动作表现，必须
  仅使用 scoped、可清理的 transform/autoAlpha、`prefers-reduced-motion` 静态分支，
  并记录销毁/离屏暂停与性能证据。
- Wave B overlay/marker 不捕获指针，44px 操作仍由既有按钮提供；状态节点使用已有
  `t()` key、`role=status`/`aria-live`，不新增硬编码中文。

## 回归最低线

`qa/game-stage-wave-b-monopoly.js` 必须覆盖默认/精确 0/未知值/storage 异常、运行时
切换、实体棋盘/骰子/回合/机会卡/买地/支付/拍卖/交易 unavailable/观战等待/结算、
snapshot/serialize 隔离、destroy/reset 清理、reduced-motion 与现有角色 fallback。

