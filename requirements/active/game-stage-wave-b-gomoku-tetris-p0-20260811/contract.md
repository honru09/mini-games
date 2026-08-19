# Wave B 五子棋 / Tetris 冻结合同

## Authority

- 五子棋继续使用既有 15×15 逻辑坐标、快照和客户端规则校验。
- Tetris 继续使用 `tetris-rule-v3` / 既有 AI 与本地 fallback；任何视觉状态不得进入 Authority payload。

## Presentation

- 只允许新增 DOM class、ARIA/本地化状态、代码原生材质与可清理表现状态。
- 五子棋保留 `mg_art_tabletop_wave_a`、`mg_art_gomoku_v1` 和 M0 双闸门的既有语义。
- Tetris 保留 `mg_art_tabletop_wave_a`、`mg_art_tetris_v1` 的既有语义。
- `prefers-reduced-motion` 禁止依赖位移/闪烁理解状态。

## Layout

- 桌面 Arena 与 Command 使用有限高度，禁止空白把有效游戏内容推散。
- 390×844 与 844×390 禁止页面横向溢出；内部必要滚动不得解锁 document 滚动。
- 七项 Tetris 控制和所有主操作至少 44×44px。

## Failure / rollback

- 新代码原生 Wave B class 可通过 `mg_art_game_stage_wave_b_v1='0'` 严格回退当前 Wave A。
- localStorage 异常、未知值或运行时清理失败均使用当前 Wave A。
- 不新增网络消息，不存在滚动发布顺序依赖。
