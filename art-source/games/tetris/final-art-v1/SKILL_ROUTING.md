# P1-03 Tetris Final Art v1 图像 Skill 路由表

> 遵循 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，对九个已安装图像 Skill 入口逐一评估并记录状态。

## 九个入口路由结果

| 入口 | 状态 | 评估与执行理由 |
|---|---|---|
| `imagegen` | `NOT_APPLICABLE` | 本批资产为 2.5D Tabletop Cream/Ink 俄罗斯方块高精度几何网格、原子方块、半调井框架与透明矢量 VFX，由项目自有确定性 SVG/Sharp 生成管线生成，不使用位图扩散模型。 |
| `ai-image-generation` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 本机未配置 Inference.sh 授权与 API 凭证；不阻塞本地确定性管线。 |
| `gpt-image` | `NOT_APPLICABLE` | 提示词与几何规范基于 Ghost Game M0 Tabletop North Star 原创设计，未使用 GPT Image 图库。 |
| `image` | `APPLIED` | 用于 2.5D 舞台三层（背景/井网格/边框）、7 种方块原子、透明特效与无障碍对比度审查。 |
| `happy-image-gen` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 本机未配置第三方多供应商商用凭证。 |
| `html-to-image` | `NOT_APPLICABLE` | 本批由 Node.js + Sharp + 确定性 SVG 生成矢量与无损 WebP，无需经由无头浏览器 HTML 截图。 |
| `website-screenshot` | `APPLIED` | 用于捕获俄罗斯方块在当前确定性构建下的 2.5D 舞台与局内可见证据。 |
| `code-to-image` | `NOT_APPLICABLE` | 非代码高亮分享图制作任务。 |
| `og-image` | `NOT_APPLICABLE` | 非 OpenGraph 社交卡片批次。 |

## 外部参考与许可隔离

- 外部 Tetris 风格与素材均按 `EXTERNAL_REFERENCE_ONLY / blocked-license` 标记，仅作为概念参考，禁止任何外部像素、图层或受限材质进入 runtime。
- 全部运行时资产均为项目自有的确定性 SVG 矢量母版，经由 Sharp 渲染为 WebP。
