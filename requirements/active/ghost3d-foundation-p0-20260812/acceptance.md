# Ghost3D Foundation P0 Acceptance

- [x] 已读取主线命令、当前四类路由、三条共享 Gate、两份 3D/总指挥报告和 `codebase-design` 指引。
- [x] Module own export 精确为 `create`、`QUALITY`；实例 own keys 精确为 `apply`、`dispose`、`snapshot`，不存在兼容别名或公开 fallback factory；无 CommonJS 的 `node:vm` browser-global 加载也只暴露 `globalThis.Ghost3DFoundation.create/QUALITY`，并可接受 cross-realm plain frame。
- [x] `apply` 覆盖 frame/input/motion/lifecycle/quality/context-lost/recover/environment，环境状态只由消息注入。
- [x] immutable frame/command/event projection、严格单调 revision、terminal 锁存和 `onInput` seam 已由专项 QA 覆盖；cycle、`NaN`、function、own `constructor`、dangerous key 与 throwing getter 被安全剔除，安全嵌套数据 deep-freeze 且不会污染 prototype。
- [x] Adapter mount/render、质量 ladder、motion forwarding、suspend/resume、context loss fallback、recover、迟到 generation/render callback 拒绝与幂等 dispose 已由专项 QA 覆盖；motion 在 mount 或 quality/environment 配置屏障中仍接受并冻结但以 `forwarded:false` 丢弃，当前配置完成后的新 motion 才以 `forwarded:true` 调用 Adapter，未支持 motion 同样稳定返回 `false`；mount pending 时的最新 quality/environment 配置屏障、quality/environment 独立异步失效序列与已由本 host dispose 的 adapter recover 拒绝也已覆盖。
- [x] 核心静态检查确认不存在 `document`、`window`、`matchMedia`、`addEventListener`、`removeEventListener`、`visibilityTarget`。
- [x] `node --check public/src/core/08-ghost3d-foundation.js` 与 `node qa/ghost3d-foundation.js` 本地通过（41 assertions）。
- [x] 只把 Foundation 作为 inert core 注册到 deterministic build、全量 `npm test` 生命周期和 Quality Gate；没有现有游戏调用 `create()`、注入 Adapter 或创建 3D scene，未添加 Three.js/GLB/vendor/engine 依赖。
- [ ] 真实浏览器、第二浏览器、Android/iPhone/Tablet、网络整形和可见 3D 证据：受 `GATE-DEVICE-BROWSER-NETWORK` 阻塞。
- [ ] 正式 Renderer/GLB/美术接入与 Golden Set：受 `GATE-ART-GOLDEN-SET` 阻塞。
- [ ] `TECH-049` 仍只处于本地 implementation/contract evidence，不能升级为 visual verified 或 production-ready。
