# UI Motion Closure P1 Contract

## Deep module seam

`GhostRouteMotion` 是唯一 Motion Runtime。调用者只需知道：

```text
transition({ from, to, commit, reason }) -> { generation, status }
settle(reason) -> void
dispose(reason) -> void
snapshot() -> read-only state
```

- `from/to` 是四个合法 route ID 或 `null`。
- `commit()` 是同步且至多一次的路由 DOM/业务提交函数；Motion Runtime 不拥有 hash、认证、连接、Profile、Playline 或 Home 渲染。
- `transition()` 不返回需要调用者 await 的 Promise。所有页面导航先同步 commit；runtime 已就绪时只增强已提交目标页，首次 lazy-load 只预热后续调用。
- `generation` 单调递增；所有异步 loader 和 timeline callback 都必须验证 generation。

## State machine

```text
IDLE -> COMMITTED -> LOADING | ENTERING -> IDLE
          |            |          |
          +--------- settle ------+
```

- reduced-motion、document hidden、Game Shell active、相同 route、无目标节点、模块失败：`commit once -> settle -> IDLE`。
- 正常分支也先 `commit once`；adapter 只能读取已提交目标节点并播放 finite entrance。
- 新 transition：先 kill/revert 旧 context/timeline，再增加 generation；旧 callback 失效。
- `settle()` 必须清除 motion class/inline transform/opacity/visibility/will-change，并把 DOM 与当前 route 的 hidden/aria-hidden/inert 对齐。
- `dispose()` 除 settle 外还移除 visibility、media-query、shellchange listeners，并令未来调用只走同步 commit fallback。

## Route DOM contract

- `setAppRoute()` 在调用 Motion Runtime 前继续执行认证检查与 route normalize。
- 业务提交顺序保持：`ghostAppRoute` → ensureConnected/showHub → route visibility + nav aria → hash → route renderer → Hero timer。
- visibility helper 必须同时管理 `hidden`、`aria-hidden`、`inert`，并保证仅当前 route 可交互。
- runtime 不修改 focus；现有推荐游戏的显式 requestAnimationFrame focus 保持调用者所有。
- hashchange 和相同 route refresh 必须保持既有 Playline 刷新语义；相同 route 不播放整页转场。

## GSAP/runtime contract

- 固定 `GSAP 3.15.0`，页面 DOM island 使用官方同版本 `esm/index.js`、`esm/gsap-core.js`、`esm/CSSPlugin.js` 的最小闭合相对 ESM 图。
- `gsap.registerPlugin(CSSPlugin)` 只执行一次且先于 DOM tween；不得载入 ScrollTrigger 或任何其他插件。
- vendor 文件逐字保存上游版权/许可证头和 SHA-256 provenance；不得改写既有 Gomoku core-only 文件。
- 入口只在第一次有资格的不同 route 转场时 `import()`；单一 promise 去重。加载失败被记为本会话 unavailable，后续直接 fallback，不循环请求或 toast。
- timeline 使用 labels 和 position parameter，不用 delay 链；外层退出和新页进入使用 `x/y/scale/autoAlpha`，`overwrite:'auto'`，有限 target/stagger。
- `gsap.context(root)` 或等价本地 context 由 runtime 持有；route exit/replacement/dispose 先 kill timeline，再 revert context。

## Motion budget

- L0/L1：继续 CSS-first。
- L2 Route：同步 commit 后 enter 主体 `260ms`，有限 stagger 后完整窗口 `<=360ms`；位移 `<=16px`，scale 不低于 `0.985`。
- 每次 route 最多 1 个 timeline；target 总数建议 `<=12`，不得选择动态列表所有行、所有帖子或所有商品。
- 只在实际 tween 生命周期临时设置 will-change；settle 后删除。
- 页面离屏和 Game Shell active 时 L4/L2 并发为 0。

## Failure and compatibility

- 动态 import、模块 shape、plugin 注册、timeline 创建或 callback 失败：捕获后同步提交/settle；不得抛到全局或打断路由。
- classic build 顺序中 runtime bridge 在 app shell 之前定义；全局仅暴露一个窄对象，不泄漏 GSAP/Timeline/CSSPlugin。
- Service Worker 不把 GSAP DOM island 加入安装 `SHELL`；同源 ESM 首次使用后可按现有 script cache-first 缓存。cache version 与专项静态合同原子更新。
- 回滚：移除 motion bridge 调用或让 runtime unavailable；原同步 route visibility 与 CSS fallback 保持完整。

## Authority and data

本任务无服务端消息、字段、Authority、幂等、重连快照或数据库变化。路由 generation 仅是客户端表现层取消令牌，不持久化、不进入 Replay/Analytics/localStorage。
