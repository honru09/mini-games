# Game Stage Wave B：五子棋 + 俄罗斯方块 P0

状态：`REQUIREMENT_FROZEN`

## Goal

把已经上线但仍像 52/100 基础骨架的五子棋与俄罗斯方块局内，升级为清晰、紧凑、真正有游戏感的代码原生 Wave B 纵切；优先修复桌面巨大空白、信息层级弱、Tetris HUD/预览拥挤和操作区缺少节奏的问题。

## IN

- 五子棋 Arena / 状态 / 最后落子 / 棋盘比例 / 桌面与移动排版。
- Tetris 主井、Hold/Next/对手预览、战斗 HUD、七项控制的视觉层级和全端排版。
- 共用 Game Stage 在两款游戏中的密度、留白、Panel 高度和状态层级。
- light/dark、zh-CN/en-US/uk-UA、44px、键盘、触控、reduced-motion、safe-area。
- 旧 Wave A 与独立游戏美术 flag 的严格回滚。

## OUT

- 服务器、WebSocket、规则、AI、奖励、Replay、商城、数据库与任何协议变化。
- Honru Emoji runtime、图片消息或局内表达 wire 变化。
- 未审批 Sticker/Honru/Tank/ART-036/G Coins 位图进入 `public/assets` 或 Manifest。
- 飞行棋、大富翁、坦克、象棋的 Wave B 实现；它们只进入差距矩阵，不夹带修改。

## Non-negotiable

- 规则坐标、快照、AI 候选、联机消息和 Tetris v3 Authority 完全不变。
- 不用背景大图伪装成可交互游戏；棋盘/方块/命中区域继续由代码生成。
- 所有新增状态必须有三语言、reduced-motion 和资源失败 fallback。
- 视觉强化不能遮挡 Seat Rail、Command Slot、规则/结算 Overlay 或局内聊天/表达插槽。
- 本批只本地验收，不提交、不推送、不部署。

## Known Existing Behavior

- 线上 `da3d05c` 已含 fixed `100dvh` Game Shell、五插槽、Seat Rail、`match-expression-v1`、`match-chat-v1` 与 Wave A。
- 当前五子棋桌面棋盘清晰但 Arena 下方留白过大、信息/进程表达弱。
- 当前 Tetris 主井/对手井/文字互相拥挤，Hold/Next 文案重叠，主区利用率与操作层级不足。
- Honru 十枚 Emoji 仍是 source-only；当前局内表达使用稳定 Unicode fallback。

## Expected UX

- 一眼能分辨“谁在行动、当前局面、主要游戏区域、下一操作”。
- 五子棋棋盘成为稳定视觉中心，状态与坐标辅助克制且不干扰落子。
- Tetris 主井、Hold/Next、对手与战斗状态不重叠；桌面紧凑、移动端单列自然。
- 页面仍像进入一个游戏，而不是把棋盘塞在网页卡片里。
