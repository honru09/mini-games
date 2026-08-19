# Ghost3D Foundation P0 Acceptance

> **Historical policy note（historical-as-of，2026-08-16）：** 本文中的旧 `BLOCKED`、人工美术、Reviewer B、IP/法律与逐资产 Golden Set 表述仅代表本文形成时的历史快照，不覆盖当前权威政策。原创 Ghost-native 资产满足 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可进行可逆 `default-on` runtime 接入；人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，未执行时须如实保留且不得冒充 `PASS`。设备/第二浏览器/真实网络与 Supabase Gate 当前为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁止复制、派生、作为生成输入、接入 runtime 或发布。任何接入结论均不授权发布，commit、push、Pages、Render 或生产发布仍须当前用户明确命令。

- [x] 已读取主线命令、当前四类路由、三条共享 Gate、两份 3D/总指挥报告和 `codebase-design` 指引。
- [x] Module own export 精确为 `create`、`QUALITY`；实例 own keys 精确为 `apply`、`dispose`、`snapshot`，不存在兼容别名或公开 fallback factory；无 CommonJS 的 `node:vm` browser-global 加载也只暴露 `globalThis.Ghost3DFoundation.create/QUALITY`，并可接受 cross-realm plain frame。
- [x] `apply` 覆盖 frame/input/motion/lifecycle/quality/context-lost/recover/environment，环境状态只由消息注入。
- [x] immutable frame/command/event projection、严格单调 revision、terminal 锁存和 `onInput` seam 已由专项 QA 覆盖；cycle、`NaN`、function、own `constructor`、dangerous key 与 throwing getter 被安全剔除，安全嵌套数据 deep-freeze 且不会污染 prototype。
- [x] Adapter mount/render、质量 ladder、motion forwarding、suspend/resume、context loss fallback、recover、迟到 generation/render callback 拒绝与幂等 dispose 已由专项 QA 覆盖；motion 在 mount 或 quality/environment 配置屏障中仍接受并冻结但以 `forwarded:false` 丢弃，当前配置完成后的新 motion 才以 `forwarded:true` 调用 Adapter，未支持 motion 同样稳定返回 `false`；mount pending 时的最新 quality/environment 配置屏障、quality/environment 独立异步失效序列与已由本 host dispose 的 adapter recover 拒绝也已覆盖。
- [x] 核心静态检查确认不存在 `document`、`window`、`matchMedia`、`addEventListener`、`removeEventListener`、`visibilityTarget`。
- [x] `node --check public/src/core/08-ghost3d-foundation.js` 与 `node qa/ghost3d-foundation.js` 本地通过（41 assertions）。
- [x] 只把 Foundation 作为 inert core 注册到 deterministic build、全量 `npm test` 生命周期和 Quality Gate；Foundation 本身不创建 scene、不注入 Adapter。后续六款游戏已在各自表现层通过同一 seam 懒加载 Three r185 Renderer；Rule/Authority/Protocol/Reward/Replay/AI 仍不消费 Renderer 对象。
- [ ] 真实浏览器、第二浏览器、Android/iPhone/Tablet、网络整形和可见 3D 证据：`RELEASE_EVIDENCE_PENDING`；`GATE-DEVICE-BROWSER-NETWORK` 的开发通道保持 `OPEN / NON_BLOCKING_FOR_DEVELOPMENT`。
- [ ] 正式 Renderer/GLB/美术接入：每个原创资产族补齐 `OWNER_AUTHORIZED_ART_CLEARANCE`、Manifest、fallback、flag 与回滚；Golden Set 与人工/IP 意见仅为可选咨询，不阻塞开发。
- [ ] `TECH-049` 仍只处于本地 implementation/contract evidence，不能升级为 visual verified 或 production-ready。

## 2026-08-18 Default-on 接入增补

- [x] 六款现有程序化 Three Renderer 已进入正式 local runtime：Gomoku、Ludo、Monopoly、Xiangqi、Tetris、Tank 在 Wave B 可用且 Ghost3D key 缺失时默认创建 lazy Renderer；只有对应 `mg_ghost3d_*_v1 = "0"` 才回滚到原 DOM/Canvas paint。
- [x] ready 后各 Game Stage 以 `data-ghost3d-ready="true"` 原子切换可替换 2D paint；HUD、按钮、键盘、DOM 输入与无障碍语义仍由原游戏持有。storage 异常、ESM/WebGL/context loss、Renderer failure、LOW 与 reduced-motion 均 fail-closed 到安全 fallback。
- [x] `qa/ghost3d-default-on-contract.js` 与六款专项 contract/layout/cache/ESM/Renderer 回归已通过；本增补只证明本地实现/合同，不生成跨浏览器、真机、真实网络或生产发布证据。
- [ ] GLB/贴图/正式生产美术尚未替换程序化几何；如要生成新资产，须当前用户明确确认 asset-gen 费用，并补稳定 ID、Manifest、SHA/provenance、许可边界、fallback、feature flag 与回滚。
