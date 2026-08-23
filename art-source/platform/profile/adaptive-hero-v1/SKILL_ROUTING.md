# P2-12 Skill Routing

本批复用已审批的本地 Game Icon、Premium Background 和 Player Character Runtime，并新增一张原创 Profile Hero 位图主视觉；位图族的完整 provenance 在 `art-source/platform/profile-adaptive-hero-v1/`。

- `imagegen`: `APPLIED` — 使用 Codex 内置 host-managed 图像生成原创 Profile Hero 主视觉。
- `ai-image-generation`: `NOT_APPLICABLE` — 未使用外部多模型供应商。
- `gpt-image`: `APPLIED` — 使用 GPT Image 2 prompt grammar 和 gaming/brand system 构图约束，未调用 CLI/API。
- `image`: `APPLIED` — 使用 prompt craft 与小尺寸可读性审查；保留 Serge Shima / `github.com/smixs/visual-skills` CC-BY-4.0 attribution。
- `happy-image-gen`: `NOT_APPLICABLE` — 无供应商生成任务。
- `html-to-image`: `NOT_APPLICABLE` — 不是精确排版 review 图。
- `website-screenshot`: `NOT_APPLICABLE` — 当前批次不采集外部页面。
- `code-to-image`: `NOT_APPLICABLE` — 不是代码传播图。
- `og-image`: `NOT_APPLICABLE` — 不产生分享卡。

既有资产继续按各自 family 的 `OWNER_AUTHORIZED_ART_CLEARANCE`、Manifest、SHA、fallback 和发布 Gate 约束运行；本单元不提升任何外部素材许可状态。
