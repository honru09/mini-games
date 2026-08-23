# P-HONRU-SEASONAL-V1 — Prompt and provenance

生成模式：Codex 内置 `imagegen`；本地 `gpt-image` CLI 无 Key 且未调用。输入只包含项目自有、已所有者清除的 hand-corrected Honru 身份锚。

四个调用共享以下 identity-preserve 合同：

```text
Use case: stylized-concept
Asset type: Ghost Game seasonal mascot transparent source master
Input image 1: exact project-owned Honru identity anchor
Scene: one centered full-body mascot with generous transparent padding
Subject: preserve Honru's exact three-flame silhouette, white/pale-cream body, thick rounded near-black outline, blush, small smile, D-pad left eye, exactly four round buttons in the right eye, controller-body proportions, central leg gap, two feet, and two smooth single-lobe Q-version ghost hands
Important details: crisp hand-finished 2D sticker/cartoon rendering, restrained paper-like cream shading, readable at 96px, clean silhouette, one concrete seasonal gesture and one small accessory system
Use case: website/game mascot source master and deterministic WebP derivatives
Constraints: transparent background; no text, logo, watermark, border, UI, extra character, fake brand, human fingers, thumb, palm, knuckles, nails, finger gaps, realistic hand anatomy, body recolor, eye redesign, extra eye buttons, hidden face, 3D plastic, PBR, photorealism or commercial-IP imitation
```

Edition-specific change only：

- `spring-bloom`：一只圆润幽灵手轻托单枚小花芽，三至五片近身花瓣，淡薄荷与柔桃色只用于配件。
- `summer-cloud`：一只幽灵手接住一颗圆润水滴，短云带绕在身体外侧，淡青蓝只用于配件。
- `autumn-leaf`：双手近身怀抱单枚圆叶和一个收藏光点，暖琥珀只用于配件。
- `winter-star`：一只幽灵手托住六角雪花/星光，短奶油围巾位于脸下且不遮挡眼睛、身体负形或双脚，淡冰蓝只用于配件。

每个 edition 单独调用。任务：`exec-a63d8b96-ffcc-4ac4-93d2-478a860e5d93`（spring-bloom）、`exec-4d3e177c-407b-4e53-86b0-2b0e4ecbc1bf`（summer-cloud）、`exec-aa642cbc-0f30-4dad-a0a1-a8b3d9b4b533`（autumn-leaf）、`exec-c3f57c41-8521-465e-90e7-1b8976800d58`（winter-star）。四张源图保留统一 `#00FF00` 色键；第一次 spring 伪透明棋盘格候选因 RGB/no-alpha 被拒绝，不进入项目。`scripts/generate-honru-seasonal-v1.js` 以边缘色键、soft despill 和 Alpha 输出 4 张 1254×1254 RGBA 母版及 16 个 WebP 派生；接入前仍需 Manifest/resolver/QA。
