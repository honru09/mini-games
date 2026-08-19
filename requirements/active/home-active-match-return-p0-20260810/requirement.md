# Home Active Match Return P0 需求

## 目标

用户从仍有效的联机对局切到 Home 后，显示“返回当前对局”，点击回到同一个 Game Stage 实例。

## 显示前提

- 已连接且已认证；非观众、非 replay/reconnect 中。
- 存在 room/game/matchId，`currentGame` 与 `currentGameId` 对应当前 online.game。
- 当前 match 未结算；若 seats 可用，本人仍是 human seat。
- 未知或异常状态安全隐藏。

## 禁止

不调用 `send/join/startOnlineGame/select_game`，不写 localStorage，不重建棋盘，不触碰结算、奖励、Replay、经济、数据库或素材；不显示 room code、matchId、token、对手昵称或私有经济字段；不承诺跨设备/跨重启恢复。
