# Ghost Game 图像 Skill 编排与许可隔离

状态：`ACTIVE / LOCAL WORKSTATION INSTALLED / RELEASE-NEUTRAL`  
生效日期：2026-08-18

## 触发与完成条件

新位图、UI mockup、宣传图、分享卡、角色图、游戏贴图或参考图编辑批次开始前，读取本文件并在该资产族的 provenance 目录建立 `SKILL_ROUTING.md`。九个入口必须逐项得到以下一个真实状态：

- `APPLIED`：本批实际按对应 Skill 执行，并记录用途、输入、输出和任务标识。
- `NOT_APPLICABLE`：该入口与资产类型不匹配，并记录一句理由。
- `UNAVAILABLE_EXTERNAL_CREDENTIAL`：入口需要未配置的账号、CLI、API Key 或付费服务；不把缺凭证扩大为项目开发阻塞。

九项均有状态、最终生成或确定性派生路径已记录、许可隔离已复核，才算完成 Skill 路由。安装本身不等于调用，提示词建议不等于生成，静态合同不等于可见验收。

## 九个入口

| 入口 | 当前角色 | 调用边界 |
|---|---|---|
| `imagegen` | Codex 内置默认位图生成/编辑 | 普通项目位图首选；无需 API Key；SVG、HTML/CSS、Canvas 等代码原生资产按 Skill 规则记 `NOT_APPLICABLE` |
| `ai-image-generation` | Inference.sh 多模型候选 | 仅在 `belt` 已安装并完成用户授权时执行；不得自动登录、付费或索取聊天中的密钥 |
| `gpt-image` | GPT Image 2 提示词图库与可选 CLI | 图库可用于原创提示词结构；CLI/API 只有用户明确选择且本机已有 `OPENAI_API_KEY` 时执行 |
| `image` | Visual Skills 艺术指导与模型适配提示词 | 用于构图、镜头、可见事实和约束审查；使用时保留其 CC-BY-4.0 attribution 要求 |
| `happy-image-gen` | 多供应商能力路由 | 仅选择已配置供应商；不得自动创建密钥、切换付费渠道或把缺供应商写成生成成功 |
| `html-to-image` | 精确排版、UI mockup、信息卡片 | 文本和几何必须精确时优先；第三方 API 不可用时可用项目本地 HTML/CSS 截图链并如实记录 |
| `website-screenshot` | 已授权页面的可见证据 | 只截取本项目或用户明确授权页面；不得用它摄取外部受限视觉作为生成参考 |
| `code-to-image` | 文档中的代码视觉 | 只服务文档/传播，不作为游戏 Runtime 美术原子 |
| `og-image` | OG/社交分享卡 | 仅在分享卡批次适用；最终文字仍需三语、字体和小尺寸可读性复核 |

## 固定编排

1. 从原子需求和 33 单元生产台账冻结资产用途、尺寸、状态覆盖、fallback 与预算。
2. 先用 `image`、`gpt-image` 和项目 M0 North Star 整理原创视觉说明；不引用商业游戏、在世艺术家或外部素材文件作为风格捷径。
3. 根据输出类型选择 `imagegen`、`html-to-image` 或项目确定性 SVG/Canvas 管线。Inference.sh 与 Happy 只作为已授权、已配置时的候选比较，不替代默认路径。
4. 用 `website-screenshot` 采集本项目运行时可见证据；`code-to-image` 和 `og-image` 只在各自输出类型适用时执行。
5. 最终文件进入 workspace，登记稳定 ID、版本、SHA-256、尺寸、字节、Alpha、Prompt/provenance、来源许可、技术/视觉/相似风险审查、feature flag 与回滚。
6. 只有满足项目 `OWNER_AUTHORIZED_ART_CLEARANCE` 合同的原创 Ghost-native 资产才可成为可逆 Runtime 候选；Skill 安装、调用或输出本身不会自动提升授权状态。

## 受控全信息 reference lane

- 外部 Q 版 UI/PSD/AI/EPS/RPG 素材继续标记 `EXTERNAL_REFERENCE_ONLY / blocked-license`，但九个 Skill 必须能够掌握完整库存上下文：URL、源路径、SHA-256、容器/预览清单、许可观察、结构/图层/对象计数、任务用途、相似风险与 runtime 禁止边界。库存本身是可发现的事实，不等于授权或项目所有权。
- 在用户当前授权与供应商已配置的前提下，任务相关外部文件、预览、PSD/AI/EPS 结构和语义对象可通过受控 reference lane 提供给本地 Skill 或已配置第三方 Skill；不自动登录、付费、上传全部仓库或索取聊天密钥。每次输入必须登记 `sourcePath`、`sourceSha256`、`provider`、`model`、`taskId`、`transmissionScope`、发送时间与返回任务标识。
- Skill 可以分析、参考、编辑或生成受控输入，但外部许可状态不因“被看见”而提升：源像素/图层、外部导出物与未清除的外部影响候选不得直接进入 `public/assets`、Manifest、商城或默认 runtime。输出先标为 `SOURCE_ONLY_EXTERNAL_INFLUENCED / SIMILARITY_REVIEW_REQUIRED`，只有重新以 Ghost-native 原创重绘并完成项目机器 provenance/相似风险/回滚审查，才可能进入所有者清除轨道。
- 禁止直接像素/图层复制、描摹、换色、去水印或把外部文件伪装为项目自有资产；所有参考关系、相似风险与拒绝项必须写入 provenance。`blocked-license` 仍是许可警告与 runtime 禁止状态，不被改写成 `OWNER_AUTHORIZED_ART_CLEARANCE`。
- 所有 API Key、token 和供应商账号留在本机环境变量或其官方凭证存储中；provenance 只记录供应商/模型/任务 ID，不记录密钥值。服务条款、数据保留、跨境传输和费用边界在首次启用供应商时单独记录。

## 当前工作站安装登记

2026-08-18 已通过 Codex `skill-installer` 导入：

- `inference-sh/skills` → `ai-image-generation`
- Codex 系统预装 → `imagegen`
- `wuyoscar/GPT-Image2-Skill` → `gpt-image`
- `html2png/skills` → `html-to-image`、`website-screenshot`、`code-to-image`、`og-image`
- `smixs/visual-skills` → `image`
- `iamzhihuix/happy-claude-skills` → `happy-image-gen`

新安装 Skill 从安装后的下一轮 Codex 对话开始自动加载；每轮仍按 Skill 触发规则完整读取实际 `SKILL.md`，不得用本登记代替当前指令。
