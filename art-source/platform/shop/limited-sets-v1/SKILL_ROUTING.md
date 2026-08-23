# P2-11 Skill Routing

依照 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，九个入口逐项登记：

- `imagegen`: `APPLIED` — 中断前已用 Codex 内置 host-managed 图像生成产生一张 1536×1024 原创主视觉；输出已复制进 workspace，主机未返回可登记的远端 taskId。
- `ai-image-generation`: `NOT_APPLICABLE` — 不需要外部多模型候选或供应商任务。
- `gpt-image`: `APPLIED` — 使用 Brand Systems Gallery 与 craft 的模块板、统一身份和材质分层方法形成原创构图规范；未调用 CLI/API、未产生费用。
- `image`: `APPLIED` — 使用 GPT Image 2 五槽提示结构、multi-panel、电商产品层级与小尺寸审查；保留 Serge Shima / `github.com/smixs/visual-skills` 的 CC-BY-4.0 attribution。
- `happy-image-gen`: `NOT_APPLICABLE` — 不需要多供应商生成。
- `html-to-image`: `NOT_APPLICABLE` — Runtime 无文字烘焙，Review 由项目自有 PNG/Sharp 确定性合成。
- `website-screenshot`: `NOT_APPLICABLE` — 本批不采集外部网站，localhost 可见证据另走项目浏览器链。
- `code-to-image`: `NOT_APPLICABLE` — 不是代码传播图。
- `og-image`: `NOT_APPLICABLE` — 不是社交分享卡。

本地 Skill 上下文纳入完整外部库存索引、结构审计与四个商城相关 PSD 的路径/hash/结构语义；
没有第三方传输或像素输入。许可继续为 `EXTERNAL_REFERENCE_ONLY / blocked-license`。
