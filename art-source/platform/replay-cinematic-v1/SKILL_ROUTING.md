# P2-06 Skill Routing

本单元为代码原生 2.5D 表现，没有生成或编辑位图。九个图像入口全部如实登记：

- `imagegen`: `NOT_APPLICABLE` — 无 raster 输出。
- `ai-image-generation`: `NOT_APPLICABLE` — 未调用供应商。
- `gpt-image`: `NOT_APPLICABLE` — 无图像生成。
- `image`: `NOT_APPLICABLE` — 使用既有 M0/2.5D 视觉约束。
- `happy-image-gen`: `NOT_APPLICABLE` — 无供应商任务。
- `html-to-image`: `NOT_APPLICABLE` — 不交付 mockup 图片。
- `website-screenshot`: `NOT_APPLICABLE` — 当前未采集浏览器证据。
- `code-to-image`: `NOT_APPLICABLE` — 不生成代码传播图。
- `og-image`: `NOT_APPLICABLE` — 不生成分享卡。

动效实际遵循 `gsap-core`、`gsap-timeline`、`gsap-performance`：由现有
CameraSystem 懒加载 Timeline，只用 transform/autoAlpha，有限实例可 kill，无 ScrollTrigger。
