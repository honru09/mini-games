# P0-07 图像 Skill 路由记录

资产族：`G-07-LUDO-FINAL-ART-V1`  
记录日期：2026-08-18  
性质：本资产族在九入口流程安装前已由项目确定性 SVG 母版派生 WebP；本记录只补真实路由，不追认或伪造第三方调用。

| Skill 入口 | 状态 | 本资产族理由 |
|---|---|---|
| `imagegen` | `NOT_APPLICABLE` | 最终资产是代码原生 SVG 体系及确定性 WebP 派生，符合内置 Skill 的“不用于既有矢量系统”边界。 |
| `ai-image-generation` | `NOT_APPLICABLE` | 未使用多模型候选，也未把任何外部文件发送给 Inference.sh。 |
| `gpt-image` | `NOT_APPLICABLE` | 未调用 GPT Image 2 CLI/API；Prompt/provenance 只记录项目确定性几何。 |
| `image` | `NOT_APPLICABLE` | 本批视觉说明在安装前已冻结，不补造事后艺术指导调用。 |
| `happy-image-gen` | `NOT_APPLICABLE` | 未选择任何外部供应商或付费生成路径。 |
| `html-to-image` | `NOT_APPLICABLE` | 资产是棋盘、飞机、骰子、VFX 与领奖台原子，不是排版或 HTML mockup。 |
| `website-screenshot` | `NOT_APPLICABLE` | 当前构建浏览器可见证据尚未执行；静态审查板不冒充网页截图。 |
| `code-to-image` | `NOT_APPLICABLE` | 不生产代码展示图。 |
| `og-image` | `NOT_APPLICABLE` | 不生产 OG 或社交分享卡。 |

外部 Q 版 UI/PSD/AI/EPS/RPG 素材始终为 `EXTERNAL_REFERENCE_ONLY / blocked-license`；本资产族没有读取其像素/图层、没有复制/描摹/换色，也没有把它们作为 reference image、截图、蒙版或生成输入。
