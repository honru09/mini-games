# Game Stage Wave B：飞行棋 P0 冻结合同

状态：`REQUIREMENT_FROZEN`

## Goal

在不改变飞行棋玩法的前提下，为既有 Game Stage 增加一个代码原生、可严格回滚的 Wave B 表现纵切。玩家应能立刻辨认棋盘、骰子、当前行动者、下一操作，以及当前名次或观战/等待状态。

## IN

- `public/src/games/ludo.js` 内的 presentation-only DOM 层、稳定 class/data seam、ARIA 状态与代码原生文字层级。
- `qa/game-stage-wave-b-ludo.js`：默认、严格回滚、storage 异常、动态切换、快照隔离、当前回合/骰子/排名/观战等待和 destroy 回归。
- 本目录的飞行棋专属合同与验收记录。

## OUT

- 飞行棋 52 格轨道、起点、终点、掷骰、吃子、连掷六、胜负、计分和 2/3/4 人逻辑。
- AI 候选/学习、`scheduleAI()` 决策、奖励、Replay、商城、cosmetic 数据与 Tabletop Perspective 的逻辑语义。
- WebSocket、服务端、协议、快照 schema、持久化、共享 core、CSS 模板、构建产物、未审批图片或 SVG。

## Authority and data boundary

- `snapshot()` 保持既有 `{tokens,curIdx,phase,dice,over,winner}` 结构；Wave B class、状态、排名和 flag 不得写入 snapshot、serialize state、联网 move 或奖励 claim。
- `pids`、`START`、`TRACK`、`HOME`、token 位置和 Tabletop Perspective 只继续驱动现有规则/棋盘几何；Wave B 只能读取它们生成 DOM 标记。
- 任何现有骰子、棋子、AI、联机、replay 或 observer 生命周期必须保留原有入口和行为。

## Flag and rollback

- key 固定为 `mg_art_game_stage_wave_b_v1`。
- key 缺失或值不是精确字符串 `'0'` 时默认启用 Wave B。
- 只有精确字符串 `'0'` 回退至当前 Wave A 直接棋盘/命令 DOM；`false`、`null`、`'false'`、`'00'` 等均不得回退。
- `localStorage` 不可用、读取抛错或运行时表现层无法安全建立时，fail-closed 保留 Wave A。
- 运行时重新渲染可重新读取 flag；切换只重组 presentation DOM，不能重置局面或发送消息。

## Stable semantic seams

- Arena：`ludo-wave-b-stage`、`ludo-wave-b-arena`，并使用 `data-game-stage-wave-b="active"` 与 `data-ludo-stage="wave-b"`。
- Board：`ludo-wave-b-board-frame`、`ludo-wave-b-board`、`data-ludo-region="board"`。
- Command：`ludo-wave-b-command`、`ludo-wave-b-turn-hud`、`ludo-wave-b-dice`，骰子稳定使用 `data-ludo-control="dice"` 和 `data-ludo-dice-state`。
- State：`ludo-wave-b-meta`、`ludo-wave-b-turn`、`ludo-wave-b-state`、`ludo-wave-b-rankings`（别名 `ludo-wave-b-standings`）；Arena 根节点暴露 `data-ludo-phase`、`data-ludo-status`、`data-ludo-active-player`，排名项暴露 `data-ludo-player`、`data-ludo-rank`、`data-ludo-home`。
- 状态文字只复用现有三语 key；状态理解不依赖位移或闪烁，`prefers-reduced-motion` 不新增表现 timer。

## Lifecycle

- Wave B wrapper 只能重新托管既有 `board`、`turnHud` 和 `diceBtn`；回滚与 `destroy()` 必须将它们恢复为 Wave A 直接子节点并清理所有 Wave B class/data。
- 若表现节点构造抛错，当前实例锁定 Wave A 直到销毁，避免每次重绘重复尝试或污染输入生命周期。
- Seat Rail、Command Slot、规则/结算 Overlay、局内聊天和表达插槽不改变所有权或顺序。

## Motion and accessibility gate

- 本批不引入 GSAP、插件、常驻动画或新的表现 timer；已读取官方 `gsap-core` 规范确认本纵切只使用静态 DOM/CSS marker。
- 若后续增加动作表现，必须使用 scoped、可清理的 transform/autoAlpha、`prefers-reduced-motion` 静态分支，并补充性能/销毁证据；不得把动画状态写回规则层。
- 状态节点使用既有 `t()` key、`role=status`/`aria-live`；现有骰子按钮仍是唯一 mutation 入口并保持触控/键盘合同。

## State matrix

| Existing state | Wave B read-only expression | Rule boundary |
| --- | --- | --- |
| `roll` | current player, `data-ludo-dice-state="roll"`, roll-die prompt | existing `roll()` decides permission |
| `rolling` | rolling phase and current player | no local move/path inference |
| `pick` | choose-plane prompt and active movable phase | existing `pick()`/`applyPick()` validates |
| `over` | finished status and ranked home counts | existing result/Reward flow owns settlement |
| online opponent turn | `data-ludo-status="waiting"` and waiting prompt | no input/message mutation added |
| spectator | `data-ludo-status="spectating"`, read-only dice | existing spectator guards remain authoritative |
| AI turn | `data-ludo-status="thinking"` | `scheduleAI()`/candidate validation unchanged |
