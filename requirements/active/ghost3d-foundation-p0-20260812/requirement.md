# Ghost3D Foundation P0 Requirement

## Outcome

为 `TECH-049` 收口一个 Renderer-independent 的深 Module。它只接收已经语义化的表现状态、输入命令、动作事件和环境/生命周期消息；它不读取平台环境，也不拥有游戏事实。外部 Module 只导出 `create(options)` 与 `QUALITY`，创建出的实例只拥有 `apply(message)`、`snapshot()`、`dispose()` 三个方法。

任一外部 Adapter 无效、挂载/渲染/生命周期调用失败或上下文丢失时，Module 内部切入不可导出的程序化 fallback。该批次建立共享 seam、Node 本地证据和无副作用的 core build 注册：生成产物可定义全局 Module，但没有游戏创建实例、注入 Adapter 或呈现 3D。

## In Scope

- 无依赖、框架无关的 CommonJS/global Module；导出 own keys 精确为 `create`、`QUALITY`，没有工厂别名或公开 fallback 工厂。
- 单一消息入口 `apply(message)`：`frame`、`input`、`motion`、`lifecycle`（`suspend` / `resume` / `hidden` / `visible`）、`quality`、`context-lost`、`recover`、`environment`。
- immutable data projection、严格单调 revision、terminal 单向锁存，以及 `onInput` callback seam。
- 注入 Adapter 的 mount/render、语义 motion 转发、`HIGH` / `BALANCED` / `LOW` / `FALLBACK`、私有 programmatic fallback、上下文丢失和显式 recover。
- suspend/resume、迟到 Adapter generation/render callback 丢弃、幂等 dispose。
- 环境状态只通过 `apply({ type: 'environment', reducedMotion })` 和 lifecycle 消息注入；核心源码不注册或读取平台环境事件。
- 专项 QA 只经 `create()`、`apply()`、`snapshot()`、`dispose()` 穿越外部 seam，并静态检查窄 Interface 与禁止的平台 token。
- `scripts/build.js` 只在所有游戏实现前确定性拼接这个未调用的 core Module；`package.json` 全量回归与 `scripts/quality-gates.js` 都执行同一专项 QA。此注册不是游戏集成，也不增加 Renderer/engine/Three vendor。

## Out of Scope

- 不修改 Rule、Authority、Protocol、Replay、Reward、AI、Economy、Social 或任何现有 Game Stage；不创建 Game Adapter、mount、输入设备绑定或运行时 3D scene。
- 不引入具体 Renderer、动画运行时、GLB/纹理、正式美术、输入设备绑定或可见 3D scene。
- `THREE r185/0.185.1` 官方策略仅为研究/未来实现决策；本批不 vendoring、不 import、不加载 Three.js，也不把 GLB/glTF 引入 runtime。
- 不宣称 3D visual verified；第二浏览器、真实设备/网络和 `GATE-DEVICE-BROWSER-NETWORK` 仍为外部门禁。

## Authority and rollback

规则/权威层只拥有语义状态；Foundation 只拥有表现生命周期和 Adapter 选择。Adapter 只能消费 immutable projection，不能写入输入、规则或持久状态。回滚为删除 Foundation/QA 及 inert build/test/gate 注册；现有 Canvas/DOM/Wave B fallback 保持不变，本批次没有数据迁移。
