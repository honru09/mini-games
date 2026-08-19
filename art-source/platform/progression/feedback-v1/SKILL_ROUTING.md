# P0-09 图像 Skill 路由

资产族：`P-PROGRESSION-FEEDBACK-ART-V1`  
路由日期：2026-08-19  
任务 ID：`exec-d58f44a9-b320-4f24-bf04-c312f8c0d285`

| Skill 入口 | 状态 | 用途/理由 |
|---|---|---|
| `imagegen` | `APPLIED` | 使用 Codex 内置 imagegen 生成透明 4×2 原子母板；输出已保存到 workspace 并做 Alpha/尺寸审查。 |
| `ai-image-generation` | `NOT_APPLICABLE` | 本批已由内置 imagegen 完成；未启用 Inference.sh 多模型、未登录、未付费。 |
| `gpt-image` | `NOT_APPLICABLE` | 未使用 CLI/API；本批不需要额外 GPT Image 2 路由或外部凭证。 |
| `image` | `NOT_APPLICABLE` | 本批视觉约束直接来自项目 M0 North Star 和 imagegen 提示词；未调用外部 Visual Skills 提示词执行链。 |
| `happy-image-gen` | `NOT_APPLICABLE` | 未选择多供应商路由；没有自动创建密钥或切换付费渠道。 |
| `html-to-image` | `NOT_APPLICABLE` | 输出是透明插画原子，不是精确文字/UI mockup；文字继续由 DOM/i18n 提供。 |
| `website-screenshot` | `NOT_APPLICABLE` | 本批生成阶段不摄取网页；浏览器可见证据另按共享设备 Gate 记录。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是文档代码视觉。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG/社交分享卡。 |

所有入口均有真实状态；未应用的入口没有被描述为生成成功。外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 库本批未作为输入，runtime 许可边界不变。
