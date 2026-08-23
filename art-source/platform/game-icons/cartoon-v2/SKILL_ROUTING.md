# P0-12 图像 Skill 路由

资产族：`P-GAME-ICON-SYSTEM-V2`  
路由日期：2026-08-19  
本地任务 ID：`p0-12-game-icon-system-v2-20260819`

| Skill 入口 | 状态 | 用途/理由 |
|---|---|---|
| `imagegen` | `APPLIED` | 使用两个项目自有 M0 North Star 文件生成原创六游戏图标与语义 marker 视觉锚点；内置任务 ID `exec-009d2d60-e1e8-4eaf-b1b4-dac423ec4f71`。最终 runtime 不直接使用模型像素，而由确定性 SVG + Sharp 重绘派生。 |
| `ai-image-generation` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | `belt` 不可用，未登录、付费或上传。 |
| `gpt-image` | `APPLIED` | 已读取 Gaming Gallery 与 craft；用 GPT Image 2 五槽结构冻结画布、六个主题物件、marker 语义、小尺寸和原创限制；未调用付费 CLI。 |
| `image` | `APPLIED` | 已按 GPT Image 2、golden rules、UI/social pattern 与 creative direction 复核轮廓、材质、色板和 44px 可读性。Prompt guidance adapted under CC-BY-4.0；Serge Shima / smixs visual-skills。 |
| `happy-image-gen` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 未发现 EXTEND.md、Bun 或任何已配置供应商凭证；未运行 setup、登录、付费或上传。 |
| `html-to-image` | `NOT_APPLICABLE` | 交付是透明无文字图标原子；检查板由本地确定性 Sharp 管线生成，不调用第三方 HTML API。 |
| `website-screenshot` | `NOT_APPLICABLE` | 生成阶段不摄取网页；当前构建可见证据仍由设备/浏览器 Gate 单独记录。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是代码传播图。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG/社交分享卡。 |

## 输入与许可边界

- 项目自有 North Star A：`art-source/ui/sticker-v1/component-demo.png`，SHA-256 `135DB655DC400FB35F960045B510EE450E007CCFAD03E308DEBF65E222DB1F61`。
- 项目自有 North Star B：`art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png`，SHA-256 `184E24BFD5C52F54FA240366787A0751E5078038E4FBDA17B91C61219F2B4DE5`。
- 外部库存上下文：836 项、aggregate SHA-256 `A7151ED3C6B32FD1306962ACCD42F8F838A8E5B8D1EA54F4FC4A56397842298F`，许可继续为 `EXTERNAL_REFERENCE_ONLY / blocked-license`。
- 本批让 Skill 掌握库存数量、许可、用途与 runtime 禁止边界，但不传输任何外部文件、预览、像素、图层、archive member 或向量对象；因此不存在外部输入 task/transmission 记录。
- 外部素材仍不得进入 `public/assets`、Manifest、商城或默认 runtime；最终输出必须是 Ghost-native 原创重绘。

ImageGen 输出：`review/imagegen-concept-board-v1.png`，SHA-256 `7A5BE124A22FC14C112C48638C966294F9C1A11CC32A817F1227F5B0DE5250BC`，1720807 bytes，source-only visual anchor。
