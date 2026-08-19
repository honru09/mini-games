# G Coins P1 source-only 候选 Prompt 与来源

状态：`SOURCE_REFERENCE_ONLY + OWNER_AUTHORIZED_ART_CLEARANCE_RUNTIME_DERIVATIVE / NON_BLOCKING_FOR_DEVELOPMENT`

历史来源状态（`historical-as-of`）：`OWNER_CLEARANCE_PREPARATION / NON_BLOCKING_FOR_DEVELOPMENT`；该阶段已完成，不是当前人工审批阻塞。

当前政策（2026-08-16）：原始 Candidate B 与 Alpha 继续只留在 `art-source/`，保持 `SOURCE_ONLY`；其原样 44/64/96/192px 派生已通过 `OWNER_AUTHORIZED_ART_CLEARANCE` 进入独立、可逆的本地 runtime 条目 `P-GCOINS-ICON-V1`。此前 `OWNER_CLEARANCE_PREPARATION` 阶段已完成机器清关包；P-003 与 `💵` fallback 永久保留。稳定 runtime ID/版本/SHA/provenance、机器技术/视觉/相似风险、fallback、feature flag 与回滚包见 `requirements/active/gcoins-source-redesign-p1-20260814/OWNER_AUTHORIZED_ART_CLEARANCE-20260816.md`。人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 只是 `OPTIONAL_ADVISORY_EVIDENCE`，不阻塞继续开发。外部 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材永久禁用，发布仍须当前用户明确命令。

## 生成边界

- 生成日期：2026-08-14（JST）
- 生成路径：Codex 内置最高质量 `image_gen`；运行时管理具体模型部署，项目不伪造未暴露的精确版本。
- 参考输入仅为项目自有 Honru 身份锚点：
  - `art-source/brand/ghost-game/honru/cleanup-candidate-v1/alpha/honru-cleanup-candidate-v1-alpha.png`
  - `art-source/brand/ghost-game/honru/v2/honru-character-master-v2-flat-transparent-draft-v1.png`
- 外部 RPG / Q 版 UI 素材没有作为生成输入，也没有复制、裁切、描摹、换色或上传。
- 三次调用各生成一个独立方向；旧 P0 候选没有被覆盖。

## Candidate A｜角色徽章方向（未选）

- 任务/文件标识：`exec-f32279ad-d349-47e7-9d63-35f4640a7d0c`
- 文件：`source/gcoins-p1-candidate-a-chroma.png`
- SHA-256：`36b79d6ce878006430bf6721389d768a2e5bff7d9b96d7006d310932ae8b3745`
- 决议：Honru 识别强，但更像金属角色徽章，44px 下层级偏多；保留为未选候选。

```text
Use case: stylized-concept
Asset type: premium game UI currency icon candidate for Ghost Game, designed to remain legible at 44 px
Primary request: create one original G Coins token that fuses a ghost seal and a game controller into a single unmistakable silhouette. The token should feel collectible and ownable, not like a generic round casino coin.
Input images: Image 1 and Image 2 are project-owned Honru identity references only; preserve the recognizable warm-ivory ghost/flame silhouette, thick near-black ink outline, left D-pad eye, right four-button eye, and restrained cute confidence. Do not copy the pose or render a full mascot.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Subject: one centered front-facing rounded shield/medallion token. Its outer rim subtly forms the shoulders and tapered flame crown of a friendly ghost while the inner negative space suggests controller grips. The center face uses exactly one left D-pad and exactly four small right buttons as the identifying eyes. No mouth is necessary unless it survives as one tiny clean curve.
Style/medium: polished hand-authored 2D game icon, vector-like shapes with slight tactile metal depth, crisp deliberate contours, compact premium mobile-game readability
Composition/framing: one object only, perfectly centered, square canvas, generous equal padding, strong silhouette, no perspective tilt
Lighting/mood: calm premium studio readability with minimal controlled highlights; no cast shadow
Color palette: near-black ink, warm ivory enamel, restrained muted champagne-metal and cool silver edge accents; do not use #00ff00 in the subject
Materials/textures: mostly flat enamel and a narrow brushed-metal rim; no noisy texture
Constraints: background must be one uniform #00ff00 with no shadows, gradients, texture, reflections, floor plane, or lighting variation; subject fully separated from background with crisp edges; readable at 44 px; original design; no letters, no numbers, no currency symbols, no words, no logo text, no watermark, no scene, no extra tokens
Avoid: generic circular poker chip, photographic coin, overly glossy 3D render, excessive bevels, fake embossed text, tiny filigree, asymmetrical accidental details, AI-like ornamental clutter, external game references, brand imitation
```

## Candidate B｜六角幽灵币方向（技术首选）

- 任务/文件标识：`exec-4d03c60c-2b63-4b88-8633-32ce09c83465`
- 色键源：`source/gcoins-p1-candidate-b-chroma.png`
- 色键源 SHA-256：`6a99bea413410f62520a2abe16ce3ab341c9e0337bd21a383350fc9f578dd04a`
- Alpha：`alpha/gcoins-p1-candidate-b-alpha.png`
- Alpha SHA-256：`d62909d4827d427d5e499299fb2a7e839866a3ddc9e7b701d53c3e1cc542854c`
- 决议：币形、Honru 身份和 44px 可读性三者最平衡；仅是机器技术首选，不是人工清稿、Reviewer B、IP 或 Golden Set 通过。

```text
Use case: stylized-concept
Asset type: premium game UI currency icon candidate for Ghost Game, readable at 44 px
Primary request: create one original compact G Coins token using a bold ghost-controller crest cut into a distinctive rounded hexagonal coin. It must look like a real collectible platform currency while staying unmistakably Ghost Game.
Input images: Image 1 and Image 2 are project-owned Honru identity references only. Preserve only the identity grammar: warm-ivory ghost flame crown, heavy near-black ink contour, left eye as a D-pad cross, right eye as exactly four controller buttons. Do not reproduce the full character, arms, blush, body pose, or mascot proportions.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Subject: one centered front-facing rounded hexagonal token with six gently softened corners. A simple warm-ivory ghost head crest is inset into a near-black center field; the crest has one clean flame peak, one left D-pad eye and exactly four right button dots. The outer rim has one narrow champagne-metal band and one cool-silver edge. Make the crest and rim share one continuous, intentional silhouette rather than placing a generic logo on a generic coin.
Style/medium: hand-authored 2D mobile-game icon, vector-clean geometry, restrained tactile enamel and metal, thick decisive outlines, very limited highlight shapes
Composition/framing: one object only, front-on orthographic view, centered, generous equal padding, no tilt
Lighting/mood: premium but flat-readable, minimal controlled edge highlight, no shadow
Color palette: near-black, warm ivory, muted champagne gold, tiny cool-silver edge; do not use #00ff00 in the subject
Constraints: uniform #00ff00 background only, no shadows, gradients, texture, reflections, floor or lighting variation in the background; crisp separated edges; high contrast; survives 44 px; exactly one D-pad and exactly four right buttons; no mouth, no text, no letters, no numbers, no currency symbol, no wordmark, no watermark, no scene, no extra tokens
Avoid: circular poker chip, full mascot body, cute sticker pose, photographic coin, gem, crown, star, laurel, excessive bevel, decorative filigree, noisy microdetails, glossy AI-render look, external game references, brand imitation
```

## Candidate C｜极简手柄币方向（未选）

- 任务/文件标识：`exec-c2ba3fc5-a827-4d8f-939e-0a61a3432954`
- 文件：`source/gcoins-p1-candidate-c-chroma.png`
- SHA-256：`566e32d352608311573a3937cf85890669cbedc602d5147a5b80d20ad0456e84`
- 决议：小尺寸最清楚，但更像平台图标而不是可收藏货币；保留为未选候选。

```text
Use case: stylized-concept
Asset type: production-minded game UI currency icon candidate for Ghost Game, optimized for 44 px and 64 px
Primary request: design one original ultra-clean G Coins token where the coin itself becomes a ghost-controller silhouette. This direction must be flatter, simpler and more graphic than a rendered collectible badge.
Input images: Image 1 and Image 2 are project-owned Honru identity references only. Preserve the warm-ivory ghost-flame language, near-black outline, left D-pad eye, and right eye made of exactly four buttons. Do not copy the full mascot body, hands, blush, mouth, pose or proportions.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for local background removal
Subject: one centered front-facing compact coin. Start from a bold near-black disk, then integrate one ivory flame peak into the top edge and two shallow controller-grip notches into the lower edge so the outer contour itself reads as both token and ghost-controller. In the center, use one large left D-pad and exactly four large right dots as negative-space identity marks. Add only one narrow muted champagne rim following the same contour.
Style/medium: hand-drawn vector-clean 2D game icon, flat enamel, confident thick linework, balanced optical spacing, nearly no shading, premium editorial simplicity
Composition/framing: one object only, orthographic front view, centered, generous padding, symmetrical mass with a subtly lively flame tip
Lighting/mood: flat graphic readability, only one restrained highlight strip if absolutely necessary, no shadow
Color palette: near-black, warm ivory, muted champagne; tiny cool-silver accent allowed; do not use #00ff00 in the subject
Constraints: background one exact uniform #00ff00 with no gradient, shadow, texture, reflection, floor or lighting variation; crisp isolated edge; readable at 44 px; no mouth; no text, letters, numbers, currency signs, words, watermark, scene, extra tokens, stars or ornaments
Avoid: generic poker chip, hex badge, full mascot, sticker pose, realistic or glossy 3D coin, fake engraving, multiple rim bands, filigree, crown, laurel, gem, particle effects, accidental extra buttons, AI-like microdetail, external game references, brand imitation
```

## 透明处理

Candidate B 通过技能自带 `remove_chroma_key.py` 以 border auto-key、soft matte、despill、12/220 阈值生成 Alpha。该步骤是机器抠图，不是人工可编辑清稿；详情见 `TECHNICAL_REVIEW_Reviewer_A.md`。
