# P0-07 Ludo Final Art v1 — Prompt 与来源

生产单元：`P0-07`；Family：`G-07-LUDO-FINAL-ART-V1`；源 ID：`ART-LUDO-FINAL-ART-V1`；version：`1`。

- Use case：`stylized-concept` / game asset family。
- Asset type：飞行棋棋盘与四机场、52 格路线语义、四阵营三姿态飞机、六面骰子 atlas、关键 VFX、2/3/4 人领奖台、4 皮肤与桌面/移动镜头板。
- Style/medium：项目自有 Pocket Tabletop / Ink-Paper-Cream 确定性 SVG；Sharp 本地派生 WebP；粗线、软阴影、无烘焙文字。
- Composition：棋盘 1056² 且 `data-route-cell-count="52"` / `data-airport-count="4"`；飞机/VFX/皮肤 512² Alpha；骰子 768×512、3×2 六面 atlas；镜头 1280×720 / 720×960。
- Constraints：真实路线、骰值、可移动棋子、吃子、额外回合、HOME、排名和玩家数继续由 DOM/规则/HTML 决定；素材只消费语义事件。
- Avoid：外部 Q 版 UI/PSD/AI/RPG、商标、文字、外链 `<image>`、脚本、动画 SVG、网络纹理或不可追溯输入。

34 个 source masters 由 `scripts/generate-ludo-final-art-v1.js` 确定性生成；68 个 normal/static WebP 为本地派生。逐文件 SHA、bytes、尺寸、Alpha 与 review boards 以 `asset-family-manifest-v1.json` 为事实源。

外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 素材未读取、复制、描摹、裁切、换色或接入，也未作为生成输入。They were not copied, traced, recolored, or used as generation inputs.

