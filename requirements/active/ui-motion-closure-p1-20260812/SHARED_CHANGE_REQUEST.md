# Shared Change Request

## Requested Master-only changes

- `scripts/build.js`：在 `core/02-app-shell.js` 之前串入 `core/09-route-motion.js`；不改变其他模块顺序。
- `public/src/core/02-app-shell.js`：把现有 route 业务提交抽成同步、至多一次的 commit closure；调用 `GhostRouteMotion.transition()`，失败时直接 commit。
- `public/index-template.html`：移除/禁用重复的 `.app-route` 无条件 keyframe；加入 motion-owned class 的克制 CSS fallback、hidden/inert safety 与 reduced-motion settle。
- `package.json` / `scripts/quality-gates.js`：接入 Route Motion syntax/runtime/ESM/cache 专项；不复制整条测试链。
- `public/sw.js`：原子升级 cache version；DOM GSAP island 不进入安装 `SHELL`，继续同源 script runtime cache-first。
- `public/index.html`：仅在最终串行 build 生成。

## Compatibility

- 无 wire message、服务端、数据库、i18n key、路由 ID 或 URL 变化。
- `setAppRoute()` 不返回需要 await 的 Promise；所有现有调用者保持有效。
- 相同 route 的现有刷新行为保留，不播放整页 timeline。

## Tests and rollback

专项见 `plan.json`。任何集成失败均让 Motion Runtime unavailable，原同步 commit 完成导航；不得删改四区 HTML 或业务 renderer。
