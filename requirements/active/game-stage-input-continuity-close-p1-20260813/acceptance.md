# Game Stage 输入连续性 CLOSE P1

本地完成：六款游戏统一复用 `showGame → enterImmersiveGameShell → createGameInstance`，局内返回和房主结束统一经过 `showHub/finishRoomGame`；`game-active` 锁定文档滚动，Arena/Seat/Command 保留内部滚动，wheel/touchmove/keydown 监听可清理；六款 ID 循环进入/退出后焦点、滚动位置、Shell 标记与监听器均无泄漏。

外部门禁保持未执行：最新本地浏览器可见复核、第二浏览器、Android/iPhone/Tablet、真实网络整形和 visible reduced-motion。该批不修改规则、Authority、协议、奖励、Replay、数据库或未审批美术，不提交、不推送、不部署。
