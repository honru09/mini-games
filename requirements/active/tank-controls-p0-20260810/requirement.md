# Tank Controls P0 — 坦克大战输入可靠性

状态：`REQUIREMENT_FROZEN`

时间：2026-08-10（Asia/Tokyo）

## Goal

把坦克大战的移动与开火从“能点但容易卡住/误触”的网页控件，升级为沉浸式 Game Shell 内可靠的桌面与移动控制：键盘持续输入、移动端 360° 摇杆视觉与八方向数字映射、独立开火、可访问四方向降级、触控捕获、失焦/断线/销毁释放，以及四档响应式安全区适配。

对应统一台账：`GAME-044`；复用已验证基线 `GAME-013`、`UI-014/UI-015/UI-016`。

## IN

- 桌面保留 WASD/方向键移动与 Space 开火；按住可持续输入，窗口失焦、页面隐藏、离开 Shell 和销毁时统一释放。
- 移动端使用 Pointer Events 摇杆：显示可见底座、摇杆头、方向/力度反馈；以角度量化为上/右/下/左及四个斜向组合，死区内归零，支持长按、离界移动、`pointercancel`、`lostpointercapture` 和多指并行开火。
- 独立开火按钮支持按住连发与点击一次，不能因 pointer/click 双路径重复发射；移动状态与开火状态互不清除。
- 提供四方向按键降级与键盘可达名称/状态；Pointer Events、触觉 `navigator.vibrate` 或 `setPointerCapture` 缺失时仍可正常游戏。
- 控件远离系统边缘，遵守 safe-area、`touch-action`、`overscroll-behavior` 与 44px 触控下限；不拦截 Shell 的游戏事件传播，不使用 `stopPropagation()`。
- 本地、休闲房主中继和 `tank-authority-v1` 只复用既有 `{up,right,down,left,fire}` 输入对象与单调 `seq`；不新增 WebSocket 字段或服务端规则。
- 同步中英乌静态/辅助文案，加入专项合同 QA；构建产物由 `scripts/build.js` 生成。

## OUT

- 不重做 Tank 皮肤、地图材质、基地角色化视觉或未审批 Honru/Sticker 资源（对应 `ART-035`，另立 Tank Art P1）。
- 不修改 `server/**`、`server/gameplay/tank-sim.js`、`shared/**`、`supabase/**`、奖励、Replay、AI、赛事、商城、好友/聊天或账号数据。
- 不改变 `tank-authority-v1`、`tank-host-relay-v1` 消息、字段、序列规则、碰撞/伤害/排名和结果结算。
- 不承诺阻止 iOS/Android 操作系统级边缘返回手势；通过边缘安全间距、页面锁与输入释放降低误触，真机仍需单独验收。
- 不生成图片，不开启任何冻结美术旗标，不提交、推送或部署。

## Non-negotiable

- `public/index.html` 只能通过 `node scripts/build.js` 生成，禁止手工编辑。
- 既有 `normalizeInput`、`sendMove`、`sendTankInput` 与 `seq` 语义保持兼容；输入释放若需要上送，必须使用新的单调序列且不能在销毁后发送。
- 摇杆方向必须可以表达八个扇区；服务端仍接收布尔组合，不能把模拟坐标或角度写入协议。
- 移动与开火状态独立；释放一个指针不能抹掉另一个指针或键盘状态。
- 事件监听使用稳定函数引用并在 `destroy()` 清理；不得新增常驻计时器或 `stopPropagation()`。
- `prefers-reduced-motion` 下不强制摇杆/按钮动画；反馈仍保留静态方向和可访问状态。
- 普通浏览器/测试桩缺少 Pointer Capture、Vibration、matchMedia 或 window blur 能力时不抛异常、不阻塞开局。

## Known Existing Behavior

- 当前摇杆只按主轴映射四方向，没有 Pointer Capture/离界释放；pointer/click 开火路径可能重复。
- `keyboardInput` 被摇杆清理和开火共用，释放摇杆会误清除并行开火；窗口失焦、页面隐藏和销毁没有统一输入清零。
- 服务端 `tank-authority-v1` 已接受五个布尔键并校验单调序列、tick、速率和玩家身份；无需改变权威层。

## Expected UX

- 进入坦克大战后，手机/平板可以按住摇杆向任意方向移动，摇杆头跟手并显示方向；斜向不会退化成横向或纵向，松手、滑出、切后台后立即停下。
- 右侧/独立开火键与移动同时可用，按住持续射击，点击只触发一次；不会因为一次触控收到两次射击。
- 键盘用户可用 WASD/方向键与 Space；无 Pointer Events 的设备仍能用四方向按钮或键盘；所有按钮可见、可聚焦、有三语名称。
- 桌面、平板、390px 手机竖屏和 844×390 横屏不横向溢出，控制区不贴系统边缘；主题切换和 reduced-motion 不改变功能。
