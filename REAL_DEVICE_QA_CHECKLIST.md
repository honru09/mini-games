# Mini Games Gameplay 第二/第三阶段真实设备 QA 清单

状态：**NOT_EXECUTED**  
原因：本次 Codex 环境没有可直接操作的 Android、iPhone 与平板实机，也无法可靠测量设备发热、锁屏恢复、Safari 手势和真实震动。自动化与桌面 DOM/触控桩结果不能替代实机结论。

## 执行矩阵

| 环境 | 状态 | 重点 |
|---|---|---|
| Desktop Chrome | NOT_EXECUTED（仅完成本地内置 Chromium 定点预览，不等于完整矩阵） | WebSocket、键盘、长局、后台标签恢复 |
| Desktop Edge / Firefox | NOT_EXECUTED | 布局、音频、WebSocket |
| Android Chrome | NOT_EXECUTED | 横屏、虚拟摇杆、震动、发热、锁屏恢复 |
| iPhone Safari | NOT_EXECUTED | Touch、页面滚动抑制、AudioContext、刘海安全区 |
| Tablet | NOT_EXECUTED | 横竖屏切换、棋盘尺寸、多 Mini Board |

## 必测场景

- Tank：横屏；移动与射击并发；50/100/200ms 网络与抖动；3 分钟完整局；多次重生；页面不滚动；记录 FPS、长帧、发热。
- Tetris：Touch、Hard Drop、Hold、Incoming、Target、多人 Mini Board；5 分钟完整局；后台/锁屏恢复。
- 五子棋 / 飞行棋 / 大富翁 / 象棋：360px 宽度；44px 触控目标；棋盘不溢出；Modal/HUD 不遮挡；观战不可输入。
- Reconnect：玩家和观众分别断网、切后台、锁屏，再在窗口内恢复。
- Reduced Motion：六款游戏状态保持正确，动画可跳过，恢复不依赖重播。
- Audio：静音设置、切后台后不重复播放、动作音画同步。

## 记录模板

`设备｜系统/浏览器｜方向｜场景｜平均 FPS｜长帧数｜发热｜结果｜问题链接`

每条真实设备/浏览器证据还必须记录：`buildSha256`、`buildBytes`、浏览器与系统精确版本、方向、PWA/普通标签页、音频状态、后台/锁屏恢复、网络配置、截图/录像路径和失败链接。当前构建的可机读单浏览器矩阵索引到 `requirements/active/latest-browser-visible-matrix-prove-p4-20260815/evidence/current-local-browser-matrix.json`；单一 in-app Chromium、CSS viewport 或本地受控传输不得填写为第二浏览器、物理设备或真实网络。

只有实际完成上述实机测试并填写证据后，才可把本文件状态改为 `EXECUTED`。

## 第三阶段已完成的定点预览（不升级矩阵状态）

- Tank：本地内置 Chromium 连续运行约 2.4 秒，棋盘、坦克、控制器和尺寸节点保持身份稳定，控制台无 warning/error。
- Tetris：本地内置 Chromium 连续运行约 2.8 秒，布局、主井、13 个池化方块节点、控制器和尺寸保持稳定，控制台无 warning/error。
- 上述证据只用于验证“持续重建 DOM 导致闪屏”的修复，不覆盖 3/5 分钟长局、第二桌面浏览器、移动设备、发热、锁屏、震动或真实网络。
