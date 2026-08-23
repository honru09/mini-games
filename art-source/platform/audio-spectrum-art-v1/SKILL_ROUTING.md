# P2-08 Skill Routing

本批交付物是 Vanilla DOM/CSS 与本地 GSAP 的代码原生频谱，不生成、编辑或导出位图。
依照 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，九个图像入口逐项登记如下：

- `imagegen`: `NOT_APPLICABLE` — Skill 明确要求代码原生视觉不要转成位图生成。
- `ai-image-generation`: `NOT_APPLICABLE` — 没有 raster 输出或供应商任务。
- `gpt-image`: `NOT_APPLICABLE` — 没有图像提示词或 GPT Image 产物。
- `image`: `NOT_APPLICABLE` — 构图由 M0 North Star、音频语义和现有设置设计系统确定。
- `happy-image-gen`: `NOT_APPLICABLE` — 没有多供应商图像输出。
- `html-to-image`: `NOT_APPLICABLE` — Runtime 直接交付 DOM/CSS，不生成 mockup 图片。
- `website-screenshot`: `NOT_APPLICABLE` — 当前只完成机器合同；可见验收保持 `NOT_EXECUTED`。
- `code-to-image`: `NOT_APPLICABLE` — 不生成代码传播图。
- `og-image`: `NOT_APPLICABLE` — 不生成 OG/分享卡。

动态表现遵循本轮已完整读取的 `gsap-core` 与 `gsap-performance`：单个有限 Tween、仅
`scaleY / autoAlpha`、活动时才设置 `will-change`、generation fencing、kill/dispose、
hidden/reduced-motion 静态降级；不使用 Timeline、ScrollTrigger 或持续循环。
