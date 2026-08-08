# Pocket Tabletop Sticker Art Bible v1

状态：`IMPLEMENTING / HUMAN_REVIEW_REQUIRED`
适用：平台 Shell、Avatar、AI Persona、表情、五子棋、飞行棋及后续六款游戏。
机器令牌：`design-tokens.v1.json`；表情契约：`facial-kit.v1.json`。

## 1. 视觉母题

目标是“口袋桌游 × 高表现力贴纸卡通”，不是复制任何商业游戏。没有 Logo 时，玩家仍应从粗深色轮廓、紧凑 Q 版比例、两级赛璐璐、左上主光、右下接触影、强剪影和短促弹性反馈辨认出 Ghost Game。

允许借鉴的只有高层语法：大几何轮廓、夸张但可读的情绪、少而清晰的明暗层次、圆角和关键 Pose。禁止复制第三方角色、皇冠、服饰组合、徽记、武器、表情帧、封面构图和高潮 Pose。Supercell 官方政策明确限制基于其资产创建新产品及未经许可修改资产：https://supercell.com/en/fan-content-policy/ 。

## 2. 当前基线裁决

- 六张软 3D 大厅封面只保留三分之四桌游构图、玩家语义色和回滚价值，不是 Golden Set。
- Avatar v2 的 Pixel / Anime / Landscape / Animal / Neon / Technology 六种风格全部视为 legacy fallback，不从其中任选一套扩张。
- 五子棋写实木纹、俄罗斯方块玻璃霓虹、飞行棋圆点/Emoji 都保留为 fallback；规则坐标、命中、快照、AI 和联机协议不得进入美术状态。
- 毛玻璃与 Lucide 只保留结构和语义，品牌主路径逐步换成 Ink/Paper/Cartoon Icon v2。

## 3. 色板与主题

唯一权威色值见 `design-tokens.v1.json`。核心为 Ink `#211923/#443443`、Paper `#FFF9F2`、Cream `#F3E5C4`，辅以 Green/Teal/Blue/Purple/Pink/Coral/Gold/Brown。

运行时只有 `light` 与 `dark`：白天为云海/大气层，黑夜为深空星场。双主题只能替换 Background、Panel 与 Accent。以下内容跨主题绝对不变：Ink、轮廓档位、角色比例、材质语法、左上主光、右下接触影、组件结构、玩家身份编码和购买背景。玩家不能只靠颜色区分。

正文对比度至少 4.5:1，大字与非文本边界至少 3:1；这与 WCAG 2.2 的 AA 基线一致：https://www.w3.org/TR/WCAG22/ 。

## 4. 线稿、贴纸边与比例

- 所有线使用 Round Cap / Round Join；外轮廓偏差不得超过档位的 ±10%。
- 内线为外轮廓的 55%–70%；1× 输出不得出现小于 1.5px 的语义线。
- Avatar/Persona/Emote 可用短边 4%–6% 的 Paper 贴纸边；棋盘、普通 UI 和规则格线不强加贴纸边。
- Persona 为 1.9–2.3 头身；Avatar 头部占画布 62%–74%，主体占 78%–88%，安全区至少 8%。
- 高情绪嘴宽为脸宽 45%–65%，手势放大 1.2–1.45 倍并必须人工修形。
- 功能棋子不强制加脸；轮廓、圆角、两级明暗、接触影和大部件负责品牌统一。

精确档位见 Token 文件：24 / 32 / 44 / 64 / 96 / 192 / 512px。

## 5. 两级赛璐璐与材质

每个主要形体最多 Base + Shade + 可选 Highlight：Base 72%–85%，Shade 10%–22%，Highlight 3%–8%。Shade 向 Ink 混合 12%–18%，Highlight 向 Paper 混合 18%–26%。角色和棋子禁止多层软渐变、磨皮、强 Bloom、镜面 PBR 和照片纹理。

材质必须低频：木材 2–4 条宽木纹；纸板一条压边；金属一块高光和 1–3 个大铆钉；玻璃/糖果一条边缘亮带；石材 2–3 个大切面；布料 1–2 条大褶皱；草木/云为大团块。96px 以下删除全部非语义材质线。

## 6. 光照与接触影

主光固定左上约 45°，接触影向右下。Contact Shadow 使用 `rgba(33,25,35,.22)`，X 偏移约宽度 2.5%，Y 偏移约高度 4.5%。24–32px 图标禁用投影。按钮使用 3–5px 硬底影；Pressed 时主体下移 2–3px并缩短底影。

## 7. Facial Kit 与 Persona

`facial-kit.v1.json` 固定 16 类情绪 × L1/L2/L3。L1 用于大厅/Profile，L2 用于房间/AI 对局，L3 只用于 Emote、KO、结算和关键事件。脸部必须拆为左右眉、左右眼/瞳孔、嘴、脸颊和泪/汗层，禁止把每种表情画成不可复用的整张脸。

Golden Persona 为 `teacher`，八状态固定为 `idle / think / confident / surprised / win / lose / taunt / recover`。人格只改变表达，不改变 AI 搜索、候选、难度或学习模型。

## 8. Golden Set 范围

- Persona：`teacher` × 8 状态。
- Avatar：`commerceId 100 / 117 / 124 / 141`，分别验证人类、无脸场景、动物、机械非人；只递增 `artworkVersion`。
- 核心 UI：Button、Card、Modal、Room Seat、Shop Card、Avatar、Badge、Toast 全状态。
- 游戏：五子棋与飞行棋完整棋盘、棋子、状态、动效、结算纵切。
- 新旗标全部默认关闭：`mg_art_sticker_m0_v1`、`mg_ui_sticker_v1`、`mg_persona_sticker_v1`、`mg_avatar_golden_v1`、`mg_art_gomoku_sticker_v1`、`mg_art_ludo_sticker_v1`。

## 9. 字体与三语

Display 建议 Nunito Sans 800/900，正文 Noto Sans/Noto Sans SC 400/600，控件 700；必须保留 PingFang SC、Microsoft YaHei UI、Segoe UI、system-ui fallback。自托管前必须固定版本、上游、SHA-256、OFL 文本和 subset 范围，并计入首屏预算。

英文/乌克兰语预留至少 35% 横向扩展；数字使用 tabular nums。除 Logo 与固定棋子符号外，UI 文字不得烘焙进图片。Glyph Gate 必须覆盖三个 locale 全字符及 `ҐґЄєІіЇї`。

## 10. 去 AI 味与原创性

生产 Prompt 禁止出现“某商业游戏风格”或在世艺术家姓名，禁止上传、裁切、描摹或修改第三方游戏资产。所有生成结果必须经过人工闭合线稿、形体简化、颜色归并和小尺寸重画，不能原图直接缩放上线。

200% 放大必须做到：零畸形手指、错误遮挡、伪文字、断裂轮廓、材质串色和光向冲突；每个角色至少一个有设计目的的非对称特征；最多一个主道具、两个环境 FX 组；禁止无意义粒子、镜头光斑、景深散景、塑料皮肤和全边缘发光。

每个资产必须填写 `IP_REVIEW_TEMPLATE.md`，记录来源/许可、Prompt/模型/任务 ID、原图 hash、人工改动、轮廓/服饰/道具/徽记/构图/Pose 七项结论、至少三个原创识别点和两名评审者。任一评审仅看剪影或高潮 Pose 就能稳定识别具体第三方角色时一票否决。

## 11. 小尺寸与验收

- 交付适用档位的 512/256/128/96/64/48/44/32/24px 1×/2× Contact Sheet。
- Avatar/Persona 64px 时眼眉口分离，关键负空间至少 2px；44px 情绪五人盲测至少四人一秒内正确。
- 四 Avatar 黑色剪影识别率至少 90%；24px 图标五人语义盲测至少 80%。
- 五子棋黑白子在正常、灰度和昼夜双主题中 100% 可区分；飞行棋四方同时使用颜色 + 机翼/鼻锥/纹样。
- 360px 布局下规则落点、棋盘线和状态标志不低于 2 CSS px；200% 文本缩放不丢主要行动。
- 首屏新增资源 ≤500KB，单游戏懒加载 ≤1.5MB，单 atlas ≤2048² 且 ≤1MB，移动解码工作集目标 ≤80MB。
- 所有非必要动画支持 reduced-motion、离屏暂停、静态 poster，且不阻塞输入；一秒闪烁不超过三次。

Art Bible Review 100 分制：剪影/轮廓/比例 20，色板/对比 15，赛璐璐/材质/光影 15，表情 15，UI 适配 10，小尺寸/灰度 10，工程/fallback/预算 5，原创性/provenance 10。总分 ≥85、各项 ≥80%、无一票否决，并获得人工决议才算通过。

## 12. 发布边界

Art Bible、Golden Set Style Review、IP Similarity Review、Integration/Performance/A11y、Feature Flag Release 必须顺序通过。M0 未获人工 Golden Set 决议前不得批量翻新 48 Avatar、Legacy Avatar、其余四款完整游戏或昼夜主题背景，也不得将状态写为 `verified` 或 `production-ready`。
