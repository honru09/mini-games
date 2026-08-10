# 沉浸式 Game Shell P0

状态：`REQUIREMENT_FROZEN`

## Goal

把现有 Wave A Game Stage 从页面中的大卡片升级为真正占满浏览器视口的游戏 Shell：进入任一六款游戏后，平台导航与页面滚动退出交互路径，返回、规则、重开、结束、玩家席位、状态、棋盘/战场和游戏控制都位于同一 Shell 内；退出时准确恢复大厅滚动与焦点。

对应统一台账：`UI-014`、`UI-015`、`UI-016`、`GAME-020`，复用已验证基线 `UI-013`、`GAME-019`、`GAME-021`。

## IN

- `#screen-game` 使用 `100dvh`、安全区和固定视口层，不再受 `#app` 最大宽度与外层页面 padding 限制。
- `body/html.game-active` 禁止文档滚动、滚动链、下拉刷新和页面回弹；只允许显式标记的 Seat、Arena、Command 内部滚动区消费滚动。
- 对局激活时屏蔽会触发页面滚动的 Space、方向键、PageUp/PageDown、Home/End 默认行为，但继续把事件交给游戏本身。
- Shell 激活时保存进入前的滚动位置与焦点；进入后聚焦 Shell，Tab 在 Shell 内循环；打开规则/结算等外部弹层时主动让行；退出后恢复滚动和有效焦点。
- Header、Seat Rail、Arena、Command Tray 全部留在视口内；手机为 Arena + 底部 Command，平板/桌面为 Arena + 侧边 Command，低高度横屏使用紧凑双列。
- 保持桌面、平板、手机横竖屏的安全区、44px 控件、reduced-motion 与键盘可访问性。
- 建立稳定的 `data-game-shell-slot`：`header / seats / arena / command / overlay`，为后续 Emoji、Match Event、玩家主页和 HUD 提供不改规则层的挂载点；本轮只建立空 Overlay，不实现这些后续功能。
- 进入/退出发出内部 `ghostgame:shellchange` 事件，只含 `{active, gameId}`，不进入 WebSocket、Replay、奖励或持久化。
- 新建独立 Shell 合同 QA，覆盖 DOM、CSS、生命周期、输入隔离、焦点恢复、弹层让行、重复进入/退出和扩展插槽。

## OUT

- 不实现 Emoji 投掷、实时表情、局内文字聊天、点击玩家主页或 Match Event 内容。
- 不修改六款规则、AI、服务端协议、奖励、商城、Supabase、Replay、观众权限或对局结果。
- 不生成新图片，不开启 M0/P1/P2 冻结资源，不改变 Wave A 美术覆盖分数。
- 不修改 `server/**`、`shared/**`、`supabase/**`、`public/assets/**` 或高风险消息注册表。
- 本轮不提交、不推送、不触发 GitHub Pages 或 Render；默认终点为 `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`。

## Non-negotiable

- `public/index.html` 只能由 `scripts/build.js` 生成，禁止手改。
- 页面级滚动锁必须幂等；重复 `showGame()` 不累加监听器，重复 `showHub()` 不产生负计数或错误恢复。
- 规则弹层、结算弹层、认证弹层等位于 Shell 外时，Shell 焦点边界与输入拦截必须让行，不能把用户焦点抢回棋盘。
- 文本框、输入框、选择器和 contenteditable 获得焦点时，不拦截其 Space/Home/End/方向键编辑语义。
- 不调用 `stopPropagation()`；游戏键盘监听器仍能收到操作，只阻止浏览器页面滚动默认行为。
- Touch/Wheel 只锁页面级滚动，不破坏 Canvas 点击、按钮、Tank 指针控制或未来手势事件传播。
- 所有内部滚动区必须 `overscroll-behavior: contain`，并保持可见焦点与滚动条可用；不能用全局 `touch-action:none` 粗暴禁用全部交互。
- `prefers-reduced-motion` 下不得新增强制动画；视觉背景继续在游戏时降密度。
- 本地 Chromium 模拟不能冒充 Android、iPhone 或真实 Tablet；真机仍保留 `NOT_EXECUTED`。

## Known Existing Behavior

- Wave A 已提供 Header、真实 Seat Rail、Arena、Command Tray 和六款表现层，默认覆盖 `52/100`。
- `showGame()` 当前只隐藏 Hub、显示 Stage 并给 `body` 加 `game-active`；`showHub()` 移除 class，但没有独立滚动、焦点或输入生命周期。
- `#screen-game` 当前最大宽度 1440px，仍位于最大宽度 1280px 的 `#app` 内，外层有页面 padding；Arena 与 Command 主要按普通页面卡片布局。
- Modal 已使用 fixed backdrop；Shell 固定层必须保持在 Modal 以下的 stacking context。
- 六款游戏与联机 E2E 已依赖既有 `btn-back / btn-rules / btn-restart / btn-end-game` ID 和 `board-area / game-extra` 容器，ID 不能变化。

## Expected UX

- 点击开始后，画面立即成为完整游戏界面，不再像网页里嵌着一个播放器；滚轮、空格或手指滑动不会把整页推走。
- 玩家始终能在同一视口找到返回、规则、重开/结束、席位、当前状态和操作区。
- 手机优先把棋盘/战场留给主要空间，席位横向查看，控制区在底部内部滚动；桌面和平板在右侧保持清晰控制区。
- 打开规则弹层时键盘和滚轮正常操作弹层；关闭后焦点回到 Shell；退出游戏后回到进入前的大厅位置。
- 后续新增局内 Emoji、玩家卡片或 Match Event 时使用冻结插槽和事件，不需要重构 Shell 或触碰规则协议。
