# Honru Character Master v2：原创角色母图候选

## Goal

在不覆盖现有 Honru v1 生成候选和线上确定性 SVG、不扩大 M0 批量生产范围的前提下，生成一张更接近项目 Art Bible、低生成感、可继续人工闭线与动画拆层的 Honru v2 正面角色母图候选。

## IN

- 以现有 Honru 身份语义为参考：幽灵身体本身兼具手柄轮廓、左眼十字键、右眼四圆键、顶部低频幽灵火苗、简化双手与友好小弧笑。
- 以 M0 Teacher 仅作高层视觉语法参考：粗闭合 Ink 轮廓、Paper/Cream、两级平涂、上左主光、右下小接触形、44–64px 情绪可读。
- 使用内置 ImageGen 生成一张单角色、正面/轻微三分之四视角、全身、无道具的色键源；随后本地移除纯色色键并验证 Alpha。
- 保存版本化色键源、透明候选、Prompt/provenance、技术审查、尺寸/哈希与 192/96/64/44px 派生预览。
- 将 source-only 候选登记到本地素材库 Catalog，并运行素材库与项目状态审计。

## OUT

- 不替换 `public/assets/brand/honru-mascot-v1.svg`、运行时 Manifest、登录页、Home Hero 或线上动画。
- 不生成八状态表、逐帧动画、Live2D/骨骼、表情包批次、Avatar 或商品。
- 不覆盖 `honru-generated-candidate-v1.png`、`honru-mascot-master-v1.svg`、M0 Teacher/Avatar 原稿或其 hash。
- 不使用用户的 503 截图、商业游戏角色、表情、构图或第三方资产作为编辑输入。
- 不把自动生成候选标记为正式母版、人工通过、Reviewer B 通过或 production-ready。

## Non-negotiable

- 身体必须是幽灵/手柄同一轮廓，不画成“幽灵拿着手柄”。
- 左眼必须清楚读作十字方向键，右眼必须是四个圆形按键；不得增加皇冠、盾牌、武器、服饰、文字、徽记或额外角色。
- 火苗轮廓最多三段主要圆润波峰，不使用写实火焰、碎屑、漂浮粒子或复杂尖刺。
- 主体只用 Ink/Paper/Cream 黑白体系；色键色不得进入主体。
- 背景必须为完全均匀的纯色键，无棋盘格、投影、地面、纹理、反射或渐变。
- 输出只进入 `art-source/` 和素材库 provenance，不进入 `public/`。

## Known Existing Behavior

- 线上运行时使用项目内手工确定性 SVG，已通过 P0 浏览器验收；Reviewer B 仍待执行。
- v1 生成候选为 1254×1254 RGB，棋盘格是像素内容，没有真实 Alpha，并且火焰、手部、灰阶与投影过复杂。
- M0 Teacher 有成熟的粗墨线与两级明暗语法，但人物身份和服饰不得迁移到 Honru。
- 当前工作树干净；本任务分支建立在已推送的 P1 验证分支之上。

## Expected UX

- 第一眼是可爱、灵动但克制的 Ghost Game 原创助手；缩到 64px 仍能读出幽灵手柄轮廓与两只控制器眼。
- 角色像经过人工矢量草图清理的 2D 贴纸，而不是光滑 3D、复杂 AI 插画或商业游戏角色仿作。
- 大尺寸可作为 Hero/聊天助手后续人工精修基础，小尺寸不会被碎火焰、灰阶噪声或伪透明背景破坏。
