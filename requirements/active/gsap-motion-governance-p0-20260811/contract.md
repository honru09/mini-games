# GSAP Motion Governance P0 Contract

1. 当前零依赖前端的 L0/L1 简单效果保持 CSS-first；只有需要运行时控制、复杂编排、FLIP/SVG/拖拽或滚动叙事时才评估 GSAP。首次引入 runtime 必须先做 ADR、版本/加载/PWA/CSP/SRI/包体/失败 fallback/回滚验收。
2. 采用 GSAP 时，单步效果使用 `gsap-core`；多步效果使用 timeline 与 labels，不用一串 delay 模拟编排。
3. 运动优先 `x/y/scale/rotation/autoAlpha`，避免可由 transform 替代的布局属性动画。
4. 每个任务记录 L0–L4、`MOTION_TOKENS.json` 时长/距离/密度、token→ease 映射和 poster/offscreen 策略。CSS `cubic-bezier(...)` 若要求在 GSAP 中精确复用，使用已注册的 `CustomEase` 显式映射，不散落新 ease。
5. 原生 DOM 使用 `gsap.context(root)` / `ctx.revert()` 或 `gsap.matchMedia()` / `mm.revert()`；同时清理事件、Observer、ticker、ScrollTrigger、SplitText 等实例。旧 match/turn/route 回调必须废弃，回调不得触发 Authority mutation。
6. 使用 `gsap.matchMedia()` 或等价门禁覆盖响应式与 `prefers-reduced-motion`；低动效分支不得只减速，必要时直接静态呈现。离屏、路由退出和 `ghostgame:shellchange` 必须暂停/恢复或销毁；Game Shell 的 L4 ambient 并发固定为 0。
7. ScrollTrigger 只服务真实页面滚动叙事：注册一次并先于使用，只挂顶层 tween/timeline；i18n、图片、字体或路由布局变化后节流 `refresh()`，路由退出 `kill/revert`，生产禁止 markers，同一 trigger 不混用 scrub/toggleActions。Observer、ScrollSmoother、ScrollToPlugin 等滚动/指针插件也不得挂到 `#screen-game` 或 `[data-game-scroll-region]`。
8. 插件先注册一次、按需加载、记录选择理由；`gsap.utils` 无需注册。GSDevTools 和调试 marker 不进入生产。
9. 当前技术栈为原生 DOM/Canvas；React 迁移使用 `useGSAP`/scope/contextSafe/SSR 边界，Vue/Svelte 迁移使用 mounted 生命周期与 `ctx.revert()`，未迁移前不复制框架代码。
10. 动效不得改变服务器 Authority、规则、奖励、Replay、数据库或输入命中区。验收记录 bundle 增量、长任务、低端设备 P95 帧耗和 L4 并发；达到实际运行时纵切后再冻结量化阈值。
