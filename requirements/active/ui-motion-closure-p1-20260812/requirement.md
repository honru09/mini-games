# UI Motion Closure P1 Requirement

状态：`REQUIREMENT_FROZEN / LOCAL_ONLY`

## Goal

在不改变 Home / Games / Playline / Profile 路由语义的前提下，为四区外壳建立一条可中断、可降级、可销毁的 L2 页面转场纵切。简单 hover、press、loading 与单状态反馈继续 CSS-first；只有旧页退出、路由原子提交、新页分层进入这类多步编排使用 GSAP Core + Timeline。

本任务复用现有需求 `UI-028` 与 `TECH-054`，不创建新的产品需求 ID。

## IN

- 一个窄的 `GhostRouteMotion` 深模块及其唯一外部 Interface：`transition / settle / dispose / snapshot`。
- `setAppRoute()` 继续拥有认证、历史、连接、路由渲染和业务副作用；每次调用同步完成原子提交，Motion Runtime 只编排提交后的新页分层进入。
- Home / Games / Playline / Profile 四区使用同一语义状态机，并允许基于路由顺序选择轻微方向；不得给每个页面复制独立实现。
- 首次实际 DOM GSAP 纵切所需的固定版本、同源、最小闭合 ESM 图；CSSPlugin 在使用前只注册一次。
- 首次交互才 lazy-load；加载中、加载失败、页面隐藏、Game Shell active、模块异常时立即走同步 CSS/DOM fallback，导航本身不得等待网络或模块。
- 使用 `transform` 与 `autoAlpha`；进入内容只选择有意义的标题、主内容与关键操作，限定数量和 stagger，避免整页所有节点同时运动。
- 每次新路由、hashchange、重复导航、页面隐藏、Game Shell 激活、reduced-motion 变化和 dispose 均能 kill/revert 旧工作并落到确定终态。
- `prefers-reduced-motion` 使用等价静态状态；不是放慢或把内容隐藏。
- 专项静态/VM、路由、i18n、DOM、构建、Quality Gates 与完整回归。

## OUT

- 不修改游戏局内输入、Game Stage 动作、Authority、Rule Core、Protocol、Reward、Replay、AI、Economy、Social、Supabase 或服务器。
- 不用 ScrollTrigger、Observer、ScrollSmoother、Flip、SplitText、GSDevTools、React/Vue/Svelte 生命周期代码或 CDN。
- 不以持续粒子、超长时长、更多并发或所有元素一起飞入来冒充质量。
- 不修改当前 Hero 轮播、商城、私信、Profile 数据、Playline 协议和 Games workspace 的业务状态机。
- 不把自动化/VM 结果写成浏览器、真机、真实网络或 visual verified。
- 不 commit、push、GitHub Pages 或 Render 部署。

## Non-negotiable

1. `setAppRoute()` 的同步兼容行为必须始终保持：无论 GSAP 是否就绪，目标页都在本次调用内完成显示、hash/aria/渲染副作用并允许现有下一帧 focus。
2. 任何时刻最多一条路由 timeline 和一次 loader promise；迟到模块或旧 transition 不能改变最新路由。
3. 隐藏页必须 `hidden=true`、`aria-hidden=true`、`inert=true`；目标页在提交后必须全部清除。动效不得留下不可见但可聚焦/可点击的节点。
4. 路由切换不夺取焦点、不阻塞按钮、hashchange、后退/前进、输入或 WebSocket keepalive。
5. 只动画 `transform/autoAlpha`；不动画 width/height/top/left/margin/padding，不测量或重排巨型布局来制造转场。
6. DOM GSAP 文件与 Gomoku generic-object core-only 图严格分开；不得改变五子棋 vendor hash、import graph 或专项合同。
7. `prefers-reduced-motion`、页面隐藏、Game Shell active、加载失败必须落到相同可读终态。
8. `public/index.html` 是生成产物，只能由 `scripts/build.js` 在 Master 集成阶段生成。

## Known Existing Behavior

- `setAppRoute()` 目前同步设置 `ghostAppRoute`，调用 `showHub()`，用 `.hidden` 切换四个 `[data-app-route]`，同步导航 `aria-current`、hash、Home/Profile/Playline 渲染和 Hero timer。
- `.app-route` 当前每次解除 hidden 都用同一 `ghostRouteIn` CSS keyframe 进入，没有旧页退出、代际取消、隐藏页 inert/aria-hidden 合同或 runtime cleanup。
- GSAP `3.15.0` 已为 Gomoku Three.js vendor `esm/gsap-core.js`；它只 tween generic object，不含 DOM CSSPlugin，不能直接承担本任务的 DOM x/y/autoAlpha。
- `MOTION_TOKENS.json` 已定义 70/120/180/260/360/600ms、2/4/8/16px、L0–L4 与 offscreen/reduced-motion/input policy。
- 浏览器连接器当前在插件加载前即 `Transport closed`；这一运行时限制与项目页面无关。

## Expected UX

- 点击或通过浏览器前进/后退切换四区时，路由状态即时提交；已就绪的 Motion Runtime 让新页标题、主内容、关键操作在约 360ms 内有层次地进入。首次 lazy-load 只预热下一次转场，不延迟或重放当前页面。
- 连续快速切换时永远以最后一次导航为准，不闪回、不双页重叠、不残留点击层。
- 手机与桌面共享相同语义；方向和距离克制，不干扰底部/顶部导航即时反馈。
- 低动效、后台、游戏中或加载失败时直接、安静地显示正确页面，功能完全等价。
