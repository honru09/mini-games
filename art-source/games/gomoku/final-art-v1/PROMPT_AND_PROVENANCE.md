# P0-06 Gomoku Final Art v1 — Prompt 与来源

生产单元：`P0-06`；Family：`G-02-GOMOKU-FINAL-ART-V1`；源 ID：`ART-GOMOKU-FINAL-ART-V1`；artwork version：`1`。

## 生成规范

- Use case：`stylized-concept` / game asset family。
- Asset type：五子棋局内棋盘材质、成对棋子材质、无文字语义 VFX、桌面/移动镜头参考板。
- Scene/backdrop：Ghost Game Pocket Tabletop；Ink / Paper / Cream 线条语言，保留可读网格和状态文案安全区。
- Subject：15×15 五子棋棋盘、黑/白双方成对材质、落子/胜线/和棋/思考/观战/重连语义。
- Style/medium：项目自有确定性 SVG 几何与路径，随后由 Sharp 派生静态 WebP；无外部图像、无纹理采样、无文字烘焙。
- Composition/framing：棋盘 1056×1056；材质与 VFX 512×512 Alpha；镜头板 desktop 1280×720、mobile 720×960，所有边界在 viewBox 内。
- Lighting/mood：柔和边缘高光、实体桌游阴影；胜线使用金色，连接/思考使用青/蓝，警示不覆盖可读 HUD。
- Constraints：规则网格、星位、玩家席位、状态文本与结果由 Canvas/DOM/i18n 维护；素材只消费语义事件；保留 Wave A、M0、Canvas/CSS 与 Ghost3D fallback。
- Avoid：任何 Logo、商标、外部 Q 版 UI/PSD/AI/RPG 素材、外部图片、文字、滤镜脚本、`<image>` 引用、动画 SVG、网络资源或不可追溯输入。

## 来源与授权边界

18 个 source masters 由本仓库生成器 `scripts/generate-gomoku-final-art-v1.js` 按上述项目自有方向确定性生成；36 个 WebP 为同一 source 的本地派生（normal/static 两路保持同一像素源，reduced-motion 由运行时选择 static 路径）。完整 source/runtime SHA、bytes、尺寸、Alpha 与路径以同目录 `asset-family-manifest-v1.json` 为唯一事实源。

外部素材仅保持 `EXTERNAL_REFERENCE_ONLY / blocked-license` 隔离状态：本批次没有读取、复制、解压、描摹、裁切、换色、作为生成输入、写入 Manifest 或接入 Runtime。 They were not copied, traced, recolored, or used as generation inputs.
