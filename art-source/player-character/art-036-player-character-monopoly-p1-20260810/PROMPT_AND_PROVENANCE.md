# ART-036 Prompt and Provenance

批次：`art-036-player-character-monopoly-p1-20260810`
状态：`reference-only / manual_cleanup_pending`
生成方式：内置最高质量 `gpt-image-2`；本文件保存逐字 Prompt 与人工审批边界
许可：`project-owned-ai-generated`，仅作为 Ghost Game 内部方向稿

## 1. Player Character Direction Board

路径：`art-source/player-character/art-036-player-character-monopoly-p1-20260810/player-character-direction-board-draft-v1.png`

SHA-256：`048606E833D7C7BD7CDB8B213FC1BE32895F41181B620AC9A02E6249F683B153`

实际尺寸：1536×1024 PNG

逐字 Prompt：

```text
Use case: stylized-concept
Asset type: game character concept direction board, source-only reference
Primary request: Create an original Ghost Game player-character direction board for a pocket tabletop game platform. Show one independent player avatar, clearly separate from the brand mascot Honru and separate from the logo, with a compact readable full-body silhouette and four small pose studies for front, back, left-facing walk, and right-facing walk.
Scene/backdrop: clean warm Paper/Cream studio sheet with restrained layout and no UI
Subject: a cute but refined neutral player avatar built from simple geometric forms, paper-and-ink construction, a small hooded top, shorts, sneakers, a simple face with dot eyes and tiny mouth; no handheld prop; one purposeful asymmetric seam or patch shape that is original to Ghost Game
Style/medium: polished 2D sticker-cartoon concept art, crisp round ink contour, two-level cel shading, subtle paper grain, hand-designed silhouette, production art direction board; not photorealistic and not 3D
Composition/framing: landscape 1536x1024 art-direction sheet; one large hero pose on the left and four smaller consistent turnaround/step poses on the right; generous margins; all limbs fully visible and separated
Lighting/mood: fixed upper-left key light, short lower-right contact shadow, calm playful tabletop mood
Color palette: extreme black Ink and warm Paper/Cream with restrained one accent color only; strong grayscale readability in both light and dark themes
Materials/textures: low-frequency paper edge, one cloth fold, one sneaker sole shape; no glossy PBR
Text (verbatim): no text, no labels, no letters, no symbols, no logo, no watermark
Constraints: preserve the same character proportions, face, outfit, seam detail and palette across all five poses; make the silhouette usable at 64px and 44px; keep this source-only and non-production
Avoid: third-party game style imitation, recognizable commercial characters, crowns, weapons, armor, flags, heraldry, random badges, fake writing, extra characters, extra props, gradients, bloom, lens flare, plastic skin, photorealism, watermark
```

## 2. Monopoly Tabletop Direction Board

路径：`art-source/games/monopoly/art-036-player-character-monopoly-p1-20260810/monopoly-tabletop-direction-board-draft-v1.png`

SHA-256：`09569C0E5B239CD5AECACE3D6180AD8E2779E0BF9F3592DC26D1C6DB9FF65195`

实际尺寸：1254×1254 PNG（模型未遵循请求的横向尺寸，已记录，不进入运行时）

逐字 Prompt：

```text
Use case: stylized-concept
Asset type: board-game environment and prop direction board, source-only reference
Primary request: Create an original Ghost Game Monopoly-style pocket tabletop direction board, not a finished game screen. Show an elevated three-quarter view of a compact square board with a clear route of chunky paperboard tiles, four corner landmarks, a few simple blocky buildings, one opportunity-card prop and one currency/token prop. The board must be designed to support a small player avatar walking along the authoritative route later.
Scene/backdrop: warm Paper/Cream tabletop sheet with a restrained presentation-board layout and no UI chrome
Subject: one square physical board with 24 clearly separated large spaces, four distinctive but simple corner landmarks, low-rise paperboard buildings, a card stack and a single ghost-shaped coin/token motif; no readable writing
Style/medium: polished 2D sticker-cartoon tabletop concept art, crisp round Ink contour, two-level cel shading, subtle paper grain, low-frequency materials; not photorealistic and not 3D
Composition/framing: landscape 1536x1024; board centered with enough margin; route readable from above at a glance; no characters, no hands, no UI panels
Lighting/mood: fixed upper-left key light, short lower-right contact shadow, inviting tactile tabletop mood
Color palette: Ink black, Paper/Cream base, restrained muted green/teal/blue/coral/gold accents; strong grayscale and light/dark theme readability
Materials/textures: paperboard edge, simple folded-card thickness, a few broad wood/paper grain marks, hard 3–5px grounding shadows; no glossy PBR
Text (verbatim): no text, no letters, no numbers, no fake writing, no logo, no watermark
Constraints: exactly 24 route spaces, four corners visibly special, clear empty lane for a future avatar pawn, all geometry simple enough to redraw by hand; source-only and non-production
Avoid: copying any commercial board game layout, recognizable trademarks, crowns, flags, heraldry, random symbols, fake typography, extra players, dice clutter, gradients, bloom, lens flare, photorealism, watermark
```

## 3. Review and runtime boundary

- 两张图都只作 source/reference；未人工清稿，未通过 Reviewer B、IP Similarity Review 或 Golden Set。
- 未进入 `public/assets`、`asset_manifest.json`、商城、角色目录或任何运行时旗标。
- 方向板不能替代 `player-character-v1` schema，也不能改变 Monopoly 24 格服务端规则、位置、奖励或 Replay。
