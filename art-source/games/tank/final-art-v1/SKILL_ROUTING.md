# P1-02 Tank Final Art v1 — 图像 Skill 路由

状态：`ACTIVE / LOCAL_ONLY / NOT_RELEASED`

| 入口 | 状态 | 本批用途与边界 |
| --- | --- | --- |
| `imagegen` | `APPLIED` | 使用 Codex 内置图像生成生成 source arena、透明原子板与语义 VFX 板；选中产物复制进 workspace。 |
| `ai-image-generation` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 本机无 `belt` 与登录状态，不自动安装、登录、付费或索取密钥。 |
| `gpt-image` | `APPLIED` | 已读取 Gaming Gallery 与 craft，以 GPT Image 2 的 5-slot、结构优先和多面板一致性规则设计 Prompt；本机无 CLI/uv/API key，实际生成走内置工具。 |
| `image` | `APPLIED` | 采用 GPT Image 2 模型、5-slot、Golden Rules、Structural/Multi-panel/Creative Direction 指导；CC-BY-4.0 attribution：Serge Shima / smixs visual-skills。 |
| `happy-image-gen` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 本机无 EXTEND.md、Bun 与可解析 provider key；不运行 setup、不自动登录或切换付费供应商。 |
| `html-to-image` | `NOT_APPLICABLE` | 本批主资产为游戏场景和透明视觉原子；检查板由本地确定性脚本生成。 |
| `website-screenshot` | `NOT_APPLICABLE` | 生成前尚无新 runtime；接入后用本地浏览器采集项目可见证据。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是代码传播图片。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG/分享卡批次。 |

## 受控 reference lane

- 项目 North Star：`component-demo.png`、`core-ui-style-board-draft-v1.png`、`tank-style-board-clean-draft-v2.png`。
- 外部完整库存上下文由 `asset-library/external-source-register-20260813.json` 提供：836 个外部文件、18,567,721,249 bytes、44,145 PNG 帧、288 PSD / 35,107 图层记录、361 AI、3,170 EPS，以及 Q 版 UI 与 RPG 动作语义库存。
- 本批任务相关外部预览只通过用户授权的全信息 reference lane 提供给内置 Skill：`11.png` 用于“爆炸动作分帧覆盖”语义，不采用其角色、轮廓、配色、像素或文案；`火山素材 (61).jpg` 用于“HUD 图标必须单义、清晰、小尺寸可读”的结构语义，不采用其图标轮廓、排布、颜色、像素或文字。
- 外部输入继续是 `EXTERNAL_REFERENCE_ONLY / blocked-license`。生成结果先为 `SOURCE_ONLY_EXTERNAL_INFLUENCED / SIMILARITY_REVIEW_REQUIRED`；源像素/图层及未清除输出不得进入 Runtime。
