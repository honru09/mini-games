# P1-01 Monopoly Final Art v1 — 图像 Skill 路由

状态：`ACTIVE / LOCAL_ONLY / NOT_RELEASED`

| 入口 | 状态 | 本批用途与边界 |
| --- | --- | --- |
| `imagegen` | `APPLIED` | 使用 Codex 内置 `image_gen` 生成最高质量 source board 与项目资产；项目绑定产物必须复制进 workspace。 |
| `ai-image-generation` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 本机无 `belt` 与登录状态，不自动安装、登录、付费或索取密钥。 |
| `gpt-image` | `APPLIED` | 已读取 Gaming/Character Gallery 与 craft，以 GPT Image 2 的 5-slot、约束和多面板一致性规则设计 Prompt；CLI 不可用且无 `OPENAI_API_KEY`，实际生成走内置工具。 |
| `image` | `APPLIED` | 使用 GPT Image 2 模型选择、5-slot、Golden Rules、Structural/Multi-panel/Character/Creative Direction 指导；保留 CC-BY-4.0 attribution：Serge Shima / smixs visual-skills。 |
| `happy-image-gen` | `UNAVAILABLE_EXTERNAL_CREDENTIAL` | 本机无 EXTEND.md、Bun 与可解析 provider key；不运行 setup、不自动登录或切换付费供应商。 |
| `html-to-image` | `NOT_APPLICABLE` | 本批主资产为手绘感游戏位图与透明原子；确定性检查板后续由项目脚本生成，不用 HTML 冒充源美术。 |
| `website-screenshot` | `NOT_APPLICABLE` | 当前尚未接入 runtime；接入后另用于本项目页面可见证据，不摄取外部受限视觉。 |
| `code-to-image` | `NOT_APPLICABLE` | 不是代码传播图片。 |
| `og-image` | `NOT_APPLICABLE` | 不是 OG/分享卡批次。 |

补充入口：`asset-gen` 需要付费第三方 API，且本批不要求 GLB/骨骼/视频；不调用。最终视觉事实只由内置生成、项目 M0 North Star 与确定性本地派生组成。

## 输入许可与传输边界

- `art-source/ui/sticker-v1/component-demo.png`：项目自有 M0 结构 North Star。
- `art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png`：项目自有 M0 质感 North Star。
- `art-source/games/monopoly/art-036-player-character-monopoly-p1-20260810/monopoly-tabletop-direction-board-draft-v1.png`：项目自有 G-15 source-only 内容方向。
- 上述三个项目自有文件允许传给内置 `image_gen`；外部 `blocked-license / EXTERNAL_REFERENCE_ONLY` 库不作为本批生成输入。
- 每次调用登记 provider/model/taskId/input SHA/transmissionScope；密钥值永不写入仓库。
