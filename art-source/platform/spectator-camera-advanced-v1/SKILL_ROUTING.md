# P2-05 Skill Routing

本单元仅使用项目现有 DOM/CSS/Canvas 与 GSAP 代码，不生成或编辑位图。因此九个
图像入口均按资产管线如实登记为 `NOT_APPLICABLE`：

- `imagegen`: `NOT_APPLICABLE` — 无位图输出。
- `ai-image-generation`: `NOT_APPLICABLE` — 未调用外部供应商。
- `gpt-image`: `NOT_APPLICABLE` — 无图像提示词或 raster 产物。
- `image`: `NOT_APPLICABLE` — 视觉约束来自 M0 North Star 与现有 2.5D 设计系统。
- `happy-image-gen`: `NOT_APPLICABLE` — 未配置或调用供应商。
- `html-to-image`: `NOT_APPLICABLE` — 不交付 UI mockup/截图资产。
- `website-screenshot`: `NOT_APPLICABLE` — 本批只保留机器合同证据。
- `code-to-image`: `NOT_APPLICABLE` — 不生成文档传播图。
- `og-image`: `NOT_APPLICABLE` — 不生成分享卡。

视觉运行时遵循 `gsap-core`、`gsap-timeline` 与 `gsap-performance`：只用 transform/
autoAlpha、可 kill 的有限 timeline、reduced-motion 静态等价态，不使用 ScrollTrigger。
