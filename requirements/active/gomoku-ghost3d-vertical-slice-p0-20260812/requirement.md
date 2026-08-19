# Gomoku Ghost3D Vertical Slice P0 Requirement

状态：`REQUIREMENT_FROZEN / LOCAL_ONLY`

## Outcome

为 `TECH-049` 建立第一条真实 Three.js 游戏纵切：五子棋继续以既有 15×15 规则、联机快照和输入函数为唯一事实源，Ghost3D Foundation 只接收语义 frame/input/motion/lifecycle，Three.js Adapter 只负责可替换的程序化 3D 表现。该纵切默认关闭，失败时 Wave B Canvas 与既有键盘/触控输入始终可用。

## In Scope

- 固定版本的 Three.js `r185 / 0.185.1` 与 GSAP `3.15.0` 同源 ESM vendor 图、许可证和 SHA-256 provenance。
- `public/three/gomoku-entry.js` 私有 Renderer Adapter：15×15 厚棋盘、实体棋子、Camera、Lighting、Raycast、质量阶梯、reduced-motion、context-loss、dispose。
- 经典五子棋到 Ghost3D Foundation 的语义 frame/input/motion/lifecycle bridge；精确旗标 `mg_ghost3d_gomoku_v1 === '1'` 才启用。
- 首次成功 render 后才进入 ready/pointer-active；HIGH 首镜头与落子采用可 kill 的 labeled GSAP timeline，LOW/reduced-motion 直接进入静态稳定态。
- Wave B overlay、键盘与触控永久 fallback；模块加载、WebGL、渲染、context loss、恢复和销毁失败都不能阻止游戏。
- 专项 QA、正式测试链、状态/台账/报告/中文日志以及本地可见复核。

## Out of Scope

- 不修改规则、Authority、Protocol、Replay、Reward、AI、Economy、Social、数据库或持久状态。
- 不引入 GLB/glTF、纹理、Loader、Shader、物理、未审批图片或正式 Golden Set。
- 不删除或弱化 Wave B / Canvas / DOM fallback。
- 不把单机 VM/DOM 合同描述为浏览器、真机、性能或 `3D_VISUAL_VERIFIED`。
- 不 commit、push、GitHub Pages 或 Render 部署。

## Authority and rollback

规则和服务端继续拥有真实局面、合法性、回合与结果；Renderer 只能投影不可变语义数据，Raycast 只能发出逻辑格命令，最终仍由原输入路径校验。回滚只需关闭/删除默认关闭的五子棋 Ghost3D bridge 与 ESM island；Wave B、规则、协议和数据均无需迁移或回滚。

