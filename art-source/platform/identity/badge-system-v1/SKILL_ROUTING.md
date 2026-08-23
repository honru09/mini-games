# P1-09 图像 Skill 路由

| Skill 入口 | 状态 | 本批用途 / 理由 |
|---|---|---|
| `imagegen` | `NOT_APPLICABLE` | 最终产物是需要与现有图标系统严格一致、可确定性重建的小尺寸 SVG/WebP，不适合生成式位图。 |
| `ai-image-generation` | `NOT_APPLICABLE` | 不需要多模型位图候选或 LoRA；确定性矢量路径已满足输出。 |
| `gpt-image` | `APPLIED` | 读取 Brand Systems & Identity Gallery 与 craft，形成多模块品牌板、固定结构、小尺寸与原创/IP 约束；没有调用 CLI/API。任务标识 `local-art-direction-p1-09-gpt-image`。 |
| `image` | `APPLIED` | 使用 GPT Image 2 模型选择、五槽 prompt、明确色值与约束审查；输出记录在 `PROMPT_AND_PROVENANCE.md`。任务标识 `local-art-direction-p1-09-image`；保留 CC BY 4.0 attribution。 |
| `happy-image-gen` | `NOT_APPLICABLE` | 本批没有需要供应商路由的生成式位图。 |
| `html-to-image` | `NOT_APPLICABLE` | Runtime 原子无文字或复杂排版；HTML 截图会降低小尺寸确定性。 |
| `website-screenshot` | `NOT_APPLICABLE` | 本批未获得匹配当前构建的浏览器可见验收；不伪造截图证据。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是代码传播图。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG/社交分享卡。 |

最终派生路径：项目确定性 SVG → Sharp 32/48/64 WebP → Manifest/Catalog → DOM 只读消费者。九个入口均已路由，不把 prompt 审查冒充付费模型生成。

