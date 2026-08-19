# Tank Ghost3D P5 — Shared Change Request

状态：`APPROVED_FOR_LOCAL_IMPLEMENTATION_BY_FROZEN_CONTRACT`

## Requested shared edits

- `public/index-template.html`：新增 Tank slot/ready/fallback CSS；canvas pointer-transparent；把窄屏 D-pad 的 40px 修回至少 44px。
- `scripts/build.js`：让 Presenter 位于 `tank.js` 前；不改构建模型。
- `package.json` / `scripts/quality-gates.js`：注册五个 Tank Ghost3D 专项。
- `public/sw.js`：只升级 cache version，仍不把 Three/GSAP/Tank entry 放进安装 shell。
- `public/index.html`：仅由 build 同步生成。

## Explicitly rejected shared edits

- 不改 `public/src/online/03-websocket.js`；现有 `silent=true` 统一解释为静态 reconcile。
- 不改 `public/src/core/08-ghost3d-foundation.js`、server、shared rule、协议、Reward、Replay、AI、数据库或资产 manifest。

## Rollback and QA

移除 Presenter 模块注册和精确 opt-in 后，现有 DOM Tank 行为保持不变；任何 runtime failure 自动回退。共享改动必须通过 build-drift、Tank Controls、布局、DOM、i18n、Quality Gates 和完整测试。
