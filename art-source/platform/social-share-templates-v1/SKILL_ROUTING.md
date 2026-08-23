# P2-09 Skill Routing

依照 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，本批九个图像入口逐项登记：

- `imagegen`: `NOT_APPLICABLE` — 复用项目已清除原创底图，精确三语文字由代码原生模板承载。
- `ai-image-generation`: `NOT_APPLICABLE` — 不需要外部多模型 raster 候选或供应商任务。
- `gpt-image`: `NOT_APPLICABLE` — 不生成新插画，避免文字误差和品牌漂移。
- `image`: `APPLIED` — 用于社交卡构图、层级、可见事实和小尺寸可读性约束；保留
  Serge Shima / `github.com/smixs/visual-skills` 的 CC-BY-4.0 attribution。
- `happy-image-gen`: `NOT_APPLICABLE` — 不需要多供应商图像生成。
- `html-to-image`: `APPLIED` — 使用本地 HTML/CSS 精确排版与确定性 Review 页面。
- `website-screenshot`: `NOT_APPLICABLE` — 本批用已连接的本地 Browser 直接采集项目预览，
  不调用外部截图 API。
- `code-to-image`: `NOT_APPLICABLE` — 不生成代码传播图。
- `og-image`: `APPLIED` — 使用 1200×630 OG 比例、文字安全区和小尺寸可读性规范。

外部参考输入和第三方传输均为 0；P1-06 底图为本项目 `OWNER_AUTHORIZED_ART_CLEARANCE`，
没有调用 blocked-license PSD/RPG/UI 素材。

