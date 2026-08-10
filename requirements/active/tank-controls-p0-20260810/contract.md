# Tank Controls P0 Contract

状态：`FROZEN`

## DOM 与所有权

- `#game-extra .tank-realtime-controls` 是唯一控制根，新增 `data-tank-control-deck`。
- `.tank-joystick` 为 Pointer Events 摇杆底座，`.tank-joystick-knob` 为跟手视觉，`.tank-joystick-direction` 为可访问方向/力度状态。
- `.tank-dpad` 含四个真正的 `<button>`（`data-tank-direction=up/right/down/left`），作为键盘/触控降级；`.tank-fire` 是唯一独立开火按钮，具有 `aria-pressed`。
- `.tank-control-hint` 只显示本地化操作提示；玩家输入和昵称不通过 `innerHTML` 注入。

## 输入合同

| 来源 | 内部状态 | 输出 |
|---|---|---|
| 键盘 | `keyboardMovement` + `keyboardFire` | `normalizeInput({...movement, fire})` |
| 摇杆 | `joystickPointerId` + 八扇区 `joystickMovement` | 同一布尔输入对象 |
| D-pad | 每个按钮的 pointer/keyboard hold | 同一布尔输入对象 |
| 开火 | `firePointerIds` / click fallback | 只改变 `fire`，不清移动 |

- 组合优先级为“来源并集”：摇杆释放不能清键盘/D-pad，开火释放不能清移动；相反方向同时按下由既有 `normalizeInput` 归零。
- 摇杆半径内设死区；角度按 8 个 45° 扇区映射到相邻两个布尔方向。摇杆回中发送一次全 false（含 fire 的当前真实值）。
- `pointerdown` 尝试 `setPointerCapture(pointerId)`；`pointerup`、`pointercancel`、`lostpointercapture`、`window.blur`、`document.visibilitychange(hidden)`、`destroy()` 都必须释放对应状态。
- Pointer Events 不可用时，D-pad 和键盘仍可操作；Vibration 不可用时只跳过触觉，不影响输入。

## Authority / 序列 / 重连

- 只调用既有 `opts.sendMove({protocol:'tank-host-relay-v1',matchId,seq,act:'input',input})` 或 `opts.sendTankInput({seq,clientTick,input})`；禁止发送角度、力度、坐标、DOM 状态或新消息。
- 每次实际输入状态变化最多产生一次上送；释放/失焦产生中性输入时沿用现有单调 `seq`。
- 重连/权威快照沿用当前 `ack` 与 `keyboardMovement` 恢复显示；断线、离房、观战和结束不保留旧指针状态。
- 非玩家/观众/回放状态拒绝本地控制，不发送输入；服务端仍是 Tank Authority 的位置、碰撞、弹道、伤害和排名真相源。

## Failure / 回滚

- 控件缺失或异常时，保留 `game-extra`、键盘和服务端状态；不阻塞开局。
- 浏览器 API 缺失只降级对应能力，不改变协议和规则。
- 回滚只撤销 `tank.js`、Tank Controls 样式、三语控制文案和专项 QA，再运行构建；不需要迁移或回滚任何服务端/用户数据。
