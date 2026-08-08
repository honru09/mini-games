# Pocket Tabletop Sticker M0：Art Bible 与 Golden Set

## Goal

在当前视觉商城 P0 完整验收并部署后，以仓库六款游戏、两种正式玩法、稳定商品 ID 和现有服务端权威边界为事实源，建立 `Pocket Tabletop Sticker × Expressive Sticker Cartoon` 的 Art Bible v1、Design System v3、Motion System v1 与 Golden Set 闸门。Golden Set 必须同时证明 Persona、Avatar、平台 UI、五子棋和飞行棋属于同一原创视觉世界，未通过评审不得批量翻新 48 Avatar 或其余游戏。

## IN

- Art Bible v1：原创色板、Ink/Paper Token、轮廓档位、比例、两级赛璐璐明暗、材质、接触影、Facial Kit 16×L1/L2/L3、三语字体/fallback 与授权记录。
- Design System v3：Button、Card、Modal、Room Seat、Shop Card、Avatar、Badge、Toast 的结构、状态、六主题映射与 44px/对比度要求。
- Motion System v1：Anticipation / Action / Impact / Settle 四段式、L0–L4 密度、reduced-motion、离屏暂停、输入不阻塞与闪烁限制。
- Golden Set：1 个 AI Persona 的 8 状态、4 个 Avatar、核心平台 UI、五子棋与飞行棋的棋盘/棋子/状态/动效/结算完整纵切。
- Source Manifest v2：`commerceId` 与 `artworkVersion` 分离，记录来源、许可、Prompt/模型、hash、尺寸、pivot、poster、fallback、字节预算、加载时机与 feature flag。
- IP Similarity Review：参考图只提取高层视觉语法；逐资产完成轮廓、服饰、道具、徽记、构图与高潮 Pose 原创性检查。
- Visual QA：六主题、三语言、360/390/768/1024/1440、多尺寸读图、灰度、对比度、资源失败、reduced-motion 和性能预算。

## OUT

- 不恢复已删除游戏、同机热座、旧经济或旧白皮书的 11 款/三模式描述。
- 不修改 `server/index.js`、`server/reward-engine.js`、`server/gameplay/**`、`shared/rules/**`、`supabase/schema.sql` 或联机协议。
- M0 未通过前不批量重绘 48 Avatar、Legacy Avatar、六主题背景或其余四款游戏完整包。
- 不直接复制《皇室战争》或任何商业游戏的角色、皇冠、服饰、构图、表情帧、图标和受保护资产。
- 不把当前软 3D 过渡封面描述为最终 Sticker Cartoon 完成状态。
- 不安装/运行未通过 `requirements/skills-registry.json` 审计的第三方 Skill 或未知脚本。

## Non-negotiable

- 运行时仍以 Web/CSS/Canvas/DOM 为主，规则坐标与合法性继续由现有代码/服务端权威决定；美术和动画不能成为规则真相。
- `commerceId`、owned、equipped、价格和历史账号兼容不因重绘改变；仅升级 `artworkVersion`。
- 所有动画有静态/reduced-motion fallback；首屏新增美术 ≤500KB，单游戏懒加载包 ≤1.5MB，atlas ≤2048²。
- 主题只改变背景与 Accent，不改变线粗、比例、材质语法、光照方向或组件结构。
- `asset_manifest.json` 是运行时机器事实源，素材库只做 provenance sidecar，不建立第二套 runtime authority。
- 每批都包含源文件或可编辑替代母版、运行时、poster、fallback、manifest、许可、预算、pivot、事件表和 QA 证据。

## Known Existing Behavior

- 当前平台仍是毛玻璃、软 3D、Lucide、Emoji 与多种 Avatar 画风混合体系。
- 六张大厅封面工程接入已实现，但属于可回滚的软 3D 过渡批次。
- Avatar v2 100–147、Legacy Avatar 0–55、Premium Background 20–31 与现有外观 ID 必须兼容。
- 五子棋与俄罗斯方块已有旧视觉纵切；飞行棋、大富翁、坦克、象棋当前主要是 CSS/Canvas/DOM fallback 或仅大厅封面。
- 真实 Supabase、真实移动设备、第二浏览器、真实网络整形和 30 分钟会话仍未完成，因此 RC 保持 BLOCKED。

## Expected UX

- 玩家不看 Logo，仅凭 Avatar、Persona、按钮、商城卡、棋子和胜负反馈也能识别同一品牌。
- 44–64px 下主要情绪与棋子剪影一眼可读，粗黑轮廓、圆角、两级明暗和右下接触影保持一致。
- 六主题只改变氛围；中文、英文和乌克兰语布局都不烘焙文字进图片、不截断主要行动。
- 操作反馈快速、短促、可打断；高情绪只在关键事件出现，非焦点内容保持静态或低幅 Idle。
