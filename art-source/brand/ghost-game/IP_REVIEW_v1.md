# Ghost Game 品牌资产 IP Similarity Review v1

## A. Ghost Game Mark / Wordmark

- Asset ID：`brand.ghost-game.mark.v1` / `brand.ghost-game.wordmark.v1`
- Artwork Version：`v1`
- Commerce/Runtime ID：待主任务登记；当前文件路径固定
- Source / License：项目内手工几何 SVG / 项目自有
- Prompt / Model / Task ID / Date：确定性 SVG，无模型；见 `PROMPT_AND_PROVENANCE_v1.md`；2026-08-08
- Source SHA-256：Mark `df7d06e492b23cd35199596499550797bae828f30820e18a0f96745b5244b452`；Wordmark `203d86fca82f1a86583fe200c8eb2b7ca72d47fe9a8d6bf1363db824945a669e`
- 人工重绘范围：100%，从空白 64×64 几何路径构建
- Reviewer A / Date：Codex 结构与相似性自检 / 2026-08-08
- Reviewer B / Date：`PENDING`（主任务视觉验收人）

| 项目 | PASS/FAIL | 说明 |
|---|---|---|
| 黑色剪影 | PASS | 闭合幽灵/手柄双读轮廓，无可识别第三方角色特征 |
| 头饰/服饰组合 | PASS | 无服饰；顶部仅为幽灵本体的单一几何火苗 |
| 道具/武器 | PASS | 无独立道具或武器，身体本身构成手柄 |
| 徽记/文字 | PASS | Mark 无文字；Wordmark 为自建几何线段，无字体或第三方徽记 |
| 构图 | PASS | 正方形中心标记与横向字标为通用品牌构图 |
| 表情与嘴型组合 | PASS | 仅通用小弧线微笑，眼睛承担控制器语义 |
| 高潮 Pose | PASS | 静态正视图，无商业角色 Pose |

原创识别点：

1. 幽灵身体与双握把通过同一条闭合路径完成，不使用“幽灵拿手柄”的常见叠加图式。
2. 十字键左眼与四圆点右眼均为透明负形，黑白反转后语义保持不变。
3. 由火苗头、宽肩、双握把和短弧笑组成的低频 64×64 几何比例。

去 AI 味检查：

- [x] 无手指或肢体生成错误
- [x] 轮廓闭合、无断线/粘连
- [x] 无伪文字、乱码、第三方徽记
- [x] 无材质、塑料皮、镜头光斑或无意义粒子
- [x] 24px 负形按像素尺度设计，并已用浏览器渲染稿降采样实测
- [x] 灰度与纯剪影可读
- [ ] Reviewer B 完成独立相似性检查

裁决：`PASS_FOR_P0_INTEGRATION`；最终品牌发布仍等待 Reviewer B 与页面视觉矩阵。

## B. Honru Generated Candidate

- Asset ID：`brand.ghost-game.honru.generated-candidate.v1`
- Artwork Version：`generated-candidate-v1`
- Commerce/Runtime ID：无；禁止接入运行时
- Source / License：项目自有 Codex ImageGen 输出；无第三方输入
- Prompt / Model / Task ID / Date：见 `PROMPT_AND_PROVENANCE_v1.md` / `local:exec-593647f3-a75e-4f27-b59e-e11dde3b9e2c` / 2026-08-08
- Source SHA-256：`d1c9b2486e82bc5d7e94df90f1182e285e2f5b59ba788b9896a14bca112c1da9`
- 人工重绘范围：0%，尚未清稿
- Reviewer A / Date：Codex 源文件与肉眼初审 / 2026-08-08
- Reviewer B / Date：`PENDING`

| 项目 | PASS/FAIL | 说明 |
|---|---|---|
| 黑色剪影 | PENDING | 火焰外轮廓较复杂，需降频后再做相似性复核 |
| 头饰/服饰组合 | PASS | 无服饰，火焰属于本体 |
| 道具/武器 | PASS | 无道具或武器 |
| 徽记/文字 | PASS | 无文字、徽记或第三方 Logo |
| 构图 | PENDING | 正面贴纸角色构图通用，但需二次独立审查 |
| 表情与嘴型组合 | PENDING | 控制器眼与小尖牙需在清稿后重新确认原创比例 |
| 高潮 Pose | PASS | 中性正视漂浮 Pose |

去 AI 味检查：

- [x] 手部数量和遮挡关系肉眼可解释
- [x] 无伪文字、乱码或第三方徽记
- [ ] 真正透明背景（当前是 24-bit RGB 伪棋盘格）
- [ ] 火焰与手部闭线人工清理
- [ ] 阴影、灰阶和边缘光简化
- [ ] 44/64px 分档重修形
- [ ] Reviewer B 独立审查

裁决：`PENDING / SOURCE_ONLY / DO_NOT_SHIP`。

## C. Honru Deterministic Mascot

- Asset ID：`brand.ghost-game.honru.mascot.v1`
- Artwork Version：`v1`
- Commerce/Runtime ID：`brand.honru.mascot.v1`
- Source / License：项目内手工确定性 SVG / 项目自有
- Prompt / Model / Task ID / Date：无生成模型；见 `PROMPT_AND_PROVENANCE_v1.md`；2026-08-08
- Source SHA-256：`42c6442efc3d86ef6d939d936bff3c83a59c46c63002fa817ea4551da3a2de64`
- 人工重绘范围：100%；未以生成候选或第三方截图作为矢量化输入
- Reviewer A / Date：Codex 结构、来源与相似性自检 / 2026-08-09
- Reviewer B / Date：`PENDING`

| 项目 | PASS/FAIL | 说明 |
|---|---|---|
| 黑色剪影 | PASS | 圆润幽灵本体、五段火焰边与短肢体构成低频原创轮廓 |
| 头饰/服饰组合 | PASS | 无服饰；火焰边属于本体轮廓 |
| 道具/武器 | PASS | 无道具与武器 |
| 徽记/文字 | PASS | 无文字、徽记、外链或第三方 Logo |
| 构图 | PASS | 中性正视漂浮 Pose，为通用角色展示构图 |
| 表情与嘴型组合 | PASS | 控制器双眼与通用小弧笑，比例由项目内独立确定 |
| 高潮 Pose | PASS | 无商业角色标志性动作 |

裁决：`PASS_FOR_P0_INTEGRATION`；它是当前唯一允许进入运行时的 Honru 资产。正式品牌定稿仍等待 Reviewer B。
