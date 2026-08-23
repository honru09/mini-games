# P2-03 图像 Skill 路由

本批没有新外部图像输入；只对已清除的 P0-08 本地 Context runtime 做确定性编排与接触表派生。

| Skill 入口 | 状态 | 用途 |
|---|---|---|
| `imagegen` | `NOT_APPLICABLE` | 不生成新位图；复用已清除 runtime。 |
| `ai-image-generation` | `NOT_APPLICABLE` | 不需要多模型生成。 |
| `gpt-image` | `APPLIED` | 复核贴纸册五槽结构与身份连续性提示规范；未调用需 Key CLI。 |
| `image` | `APPLIED` | 复核网格构图、标签留白与小尺寸可读性；保留 CC-BY-4.0 attribution。 |
| `happy-image-gen` | `NOT_APPLICABLE` | 无新供应商生成。 |
| `html-to-image` | `NOT_APPLICABLE` | Runtime 由 DOM/CSS 展示，不生成文字海报。 |
| `website-screenshot` | `NOT_APPLICABLE` | 浏览器可见证据另行记录，本批不摄取外部页面。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是代码传播图片。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG 分享卡。 |

输入范围仅为项目自有 P0-08 Manifest/runtime；外部 blocked-license 输入、传输与 Runtime 均为 0。
