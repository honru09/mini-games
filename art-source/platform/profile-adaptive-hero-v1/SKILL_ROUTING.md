# P2-12 Skill Routing

依照 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，九个入口逐项登记：

- `imagegen`: `APPLIED` — Codex 内置 host-managed 生成原创 1536×1024 Profile Hero 主视觉。
- `ai-image-generation`: `NOT_APPLICABLE` — 未启用外部多模型供应商。
- `gpt-image`: `APPLIED` — 使用 GPT Image 2 五槽提示结构与游戏视觉图库约束构图；未调用 CLI/API。
- `image`: `APPLIED` — 使用 GPT Image 2 prompt craft、gaming/brand system 构图与小尺寸可读性审查；保留 Serge Shima / `github.com/smixs/visual-skills` CC-BY-4.0 attribution。
- `happy-image-gen`: `NOT_APPLICABLE` — 不需要多供应商比较。
- `html-to-image`: `NOT_APPLICABLE` — 无烘焙文字或精确 UI 排版。
- `website-screenshot`: `NOT_APPLICABLE` — 不采集外部页面；本地可见证据走项目浏览器链。
- `code-to-image`: `NOT_APPLICABLE` — 不是代码传播图。
- `og-image`: `NOT_APPLICABLE` — 不是社交分享卡。

本批使用完整外部库存索引作为受控上下文元数据；没有传输外部像素/图层，许可继续为 `EXTERNAL_REFERENCE_ONLY / blocked-license`。
