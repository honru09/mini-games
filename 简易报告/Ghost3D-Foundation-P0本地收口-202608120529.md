# Ghost3D Foundation P0 本地收口（2026-08-12 05:29）

## 结果

`TECH-049` 的 Foundation 子能力已在本地实现：模块对外仅有 `create` / `QUALITY`，实例仅有 `apply(message)` / `snapshot()` / `dispose()`。它只接收语义 frame、input、motion、quality、environment 与 lifecycle；Adapter、私有 programmatic fallback、异步 generation 和 dispose 生命周期均留在模块内部。

Foundation 仅以 inert core 方式注册到确定性构建、全量测试入口与 Quality Gate：没有现有游戏调用 `create()`、挂载 Adapter、创建 renderer/scene 或引入 Three.js/GLB/vendor。

## 玩家可见效果

当前没有任何玩家可见的 3D 变化。现有 Wave B/Canvas/DOM 路径和 fallback 保持原样。

## 三轮 reviewer 修正

1. 移除宽 Interface 与 DOM/平台耦合，冻结唯一的窄 seam。
2. 校正异步 mount/configuration 顺序、stale quality/environment 完成回调，以及仅允许 fresh adapter recovery。
3. 校正 motion readiness，并加入 VM browser-global、cross-realm frame、hostile projection 的外部 seam QA。

## 当前证据

- `node --check public/src/core/08-ghost3d-foundation.js` 与 `node qa/ghost3d-foundation.js`；专项当前为 41 条本地断言。
- `requirements/active/ghost3d-foundation-p0-20260812/` 的合同、验收和本地执行记录。
- `requirements/THREEJS_OFFICIAL_INTEGRATION_STRATEGY_20260812.md`：Three `r185` / `0.185.1` 仅为官方研究与未来实施策略。

## 开放 Gate 与下一步

浏览器/第二浏览器/Android/iPhone/Tablet/真实网络仍为 `GATE-DEVICE-BROWSER-NETWORK`；正式美术和 GLB 仍为 `GATE-ART-GOLDEN-SET`。Three vendor、ESM island、game Adapter 和可见 3D 均未执行。

下一步只允许 Gomoku 3D vertical slice，继续保持程序化路径和 Wave B/Canvas/DOM fallback。线上仍是 `da3d05c`；本批没有 commit、push、deploy 或发布声明。
