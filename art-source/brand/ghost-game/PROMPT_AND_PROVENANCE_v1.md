# Ghost Game / Honru Prompt 与来源记录 v1

记录时间：2026-08-08 20:54 +09:00
用途：P0 品牌标识与 Honru 概念探索归档。

## Ghost Game Mark / Wordmark

- 资产 ID：`brand.ghost-game.mark.v1`、`brand.ghost-game.wordmark.v1`
- 来源：项目内手工绘制的确定性 SVG；未调用生成模型，未描摹参考图。
- 作者工具：文本式 SVG 路径设计与人工几何审阅。
- 许可：项目自有；仅随本仓库与项目发布使用。
- 色彩：`currentColor` 单色；黑白反转不改变轮廓。
- Mark SHA-256：`df7d06e492b23cd35199596499550797bae828f30820e18a0f96745b5244b452`
- Wordmark SHA-256：`203d86fca82f1a86583fe200c8eb2b7ca72d47fe9a8d6bf1363db824945a669e`
- 运行时状态：`P0_CANDIDATE_ALLOWED`；仍需主任务完成页面集成与视觉矩阵。

设计提示：

```text
Create an original, flat, monochrome geometric logo for the temporary brand “Ghost Game”.
The ghost body itself must also read as a compact game controller: one closed silhouette,
two controller grips, one small ghost flame crest, a left eye cut out as a directional pad,
and a right eye cut out as four circular buttons. Add only a tiny curved smile.
Use currentColor, transparent negative-space controls, no gradient, no filter, no font,
no extra prop, no shield, no crown, no commercial-game silhouette, and no trademark.
It must remain identifiable at 24px and reverse cleanly between black and white.
```

## Honru 生成式候选

- 资产 ID：`brand.ghost-game.honru.generated-candidate.v1`
- 本地追踪 ID：`local:exec-593647f3-a75e-4f27-b59e-e11dde3b9e2c`
- 原始路径：`C:/Users/wangxr/.codex/generated_images/019fd719-6249-7543-9cae-8ab40f096da3/exec-593647f3-a75e-4f27-b59e-e11dde3b9e2c.png`
- 归档路径：`art-source/brand/ghost-game/honru/honru-generated-candidate-v1.png`
- SHA-256：`d1c9b2486e82bc5d7e94df90f1182e285e2f5b59ba788b9896a14bca112c1da9`
- 尺寸 / 像素格式：`1254×1254` / `24-bit RGB`，没有真实 Alpha；可见棋盘格属于像素内容。
- 来源：Codex 内置图像生成，项目自有生成结果；没有输入第三方图片。
- 运行时状态：`SOURCE_ONLY / DO_NOT_SHIP`。

原始逐字 Prompt 未嵌入 PNG，不能从文件恢复。以下为依据生成意图整理的可复现规范化 Prompt，不冒充原始逐字记录：

```text
Use case: stylized-concept
Asset type: original game companion mascot concept
Primary request: Design Honru, a cute black-and-white ghost spirit whose compact body also
suggests a game controller. The left eye is a clear directional pad and the right eye is
four round controller buttons. Give the character a lively flame-like crown made from its
own ghost energy, a friendly changing expression, small simple hands, and a bold readable
silhouette. Keep the design wholly original, with no copied commercial character, costume,
badge, pose, logo, or UI. Use clean closed black ink, restrained two-value shading, no text,
no watermark, no pseudo lettering, no weapons, no glossy 3D material, and no realistic fire.
Provide generous safe area for later manual cleanup and animation separation.
```

## 已知缺陷与下一步

1. 候选图的棋盘格是伪透明背景，且文件无 Alpha；必须重新抠图或重绘。
2. 火焰外沿、手部、投影和局部灰阶偏复杂，不适合作为 24–64px 标识。
3. 在进入运行时前需完成手工闭线、真正透明底、三档尺寸重修形、动作分层与第二位 IP reviewer 签字。
4. 禁止把用户参考截图、商业游戏表情或第三方角色作为编辑输入。

## Honru 确定性运行时母版

- 资产 ID：`brand.ghost-game.honru.mascot.v1`
- 母版路径：`art-source/brand/ghost-game/honru/honru-mascot-master-v1.svg`
- 运行时路径：`public/assets/brand/honru-mascot-v1.svg`
- SHA-256：`42c6442efc3d86ef6d939d936bff3c83a59c46c63002fa817ea4551da3a2de64`（母版与运行时副本一致）
- 来源：从空白画布手工构造的确定性 SVG；未描摹、未矢量化生成式候选，也没有使用用户截图或第三方图像作为编辑输入。
- 设计约束：黑白双值、闭合路径、左眼十字键、右眼四点键、通用小弧笑、幽灵火焰外轮廓与简化双手；无服饰、徽记、武器、文字、滤镜或外链。
- 运行时状态：`P0_ALLOWED`；正式商标/角色注册前仍需独立 Reviewer B。

## 拒绝资产

- `honru/rejected/honru-clean-alpha-rejected-v1.png`
- SHA-256：`27679d55470a98a13286a300f0d102c04196f949ae06954dba9b80b0079a7341`
- 原因：自动 Alpha 清理把 Honru 的白色身体错误地当成背景删除；仅保留为失败样本，禁止进入 manifest、`public/`、训练正样本或运行时回退链。
