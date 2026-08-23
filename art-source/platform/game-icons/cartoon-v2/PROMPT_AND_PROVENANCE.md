# P0-12 Game Icon System v2 — Prompt 与 provenance

模型指导：GPT Image 2 五槽视觉规格；视觉锚点使用 Codex 内置 ImageGen，最终生产使用确定性 SVG + Sharp。

## ImageGen 视觉锚点 Prompt

Use case: `stylized-concept`  
Asset type: Ghost Game six-game icon and semantic-marker concept sheet  
Input images: Image 1 is the project-owned component/state structure North Star; Image 2 is the project-owned finish/material North Star. Use only their high-level Ink/Paper geometry, outline, hard-shadow, two-level cel shading, restrained palette and state clarity; create new game symbols.

Scene: one 4×4 concept sheet on warm Paper `#FFF9F2`, evenly spaced cells, no readable text.  
Subject: six large original icons — Gomoku as two contrasting stones crossing a tiny grid, Ludo as a toy airplane following a four-point route, Monopoly as a compact city block plus one die, Tank as a squat toy tank inside a protective arena shield, Tetris as a stepped four-block cluster with one clean impact notch, Xiangqi as an original horse-head chess seal over a nine-grid hint. Ten smaller semantic markers cover AI, human/online, solo, multiplayer, card/share, ready, waiting, live match, ranking, and room.  
Important Details: Ink `#211923` closed round outlines; Paper/Cream surfaces; Green/Teal/Blue/Purple/Pink/Coral/Gold used sparingly; one base, one shade, optional highlight; left-upper light and short right-lower hard contact shadow; strong distinct silhouettes; one purposeful asymmetry per game; readable at 44px; selected-object variants may feel like shallow 2.5D cardboard toys while remaining flat web-game atoms.  
Use Case: visual art-direction anchor for deterministic SVG/WebP runtime assets across Home, Games, Profile, Room, ranking and mode/status surfaces.  
Constraints: original Ghost-native symbols; no logos, words, letters, watermarks, fake UI text, human hands, faces, commercial-game crowns, franchise-specific costumes, copied emblems, photo texture, soft plastic PBR, neon bloom, glassmorphism or dense particles. Keep every icon isolated and fully visible inside its cell.

## Runtime 约束

- 核心六图标：44 / 64 / 96。
- 每款角色：`icon`、`cover-crop`、`theme-icon`、`selected-object`。
- 共享 marker：AI、solo、online/multiplayer、game-card/share、ready、waiting、live、ranking、room、locked/error。
- 无烘焙文字；主题不改变 Ink/轮廓/物件身份；reduced-motion 选择 static；forced-colors 回退 CSS/Lucide/Emoji。
- fallback：v2 WebP → 当前 640/320 cover crop 或 Lucide/CSS marker → `GAMES[id].icon` Emoji。
- 资产只改变 presentation，不改变规则、Authority、Protocol、Reward、AI 决策、房间状态、排行数据、经济或持久化。

## ImageGen 执行记录

- Provider/model：Codex built-in ImageGen（平台托管；未使用本机 API Key）。
- Task ID：`exec-009d2d60-e1e8-4eaf-b1b4-dac423ec4f71`。
- Output：`review/imagegen-concept-board-v1.png`。
- SHA-256：`7A5BE124A22FC14C112C48638C966294F9C1A11CC32A817F1227F5B0DE5250BC`。
- Bytes：1720807。
- 状态：`SOURCE_ONLY_VISUAL_ANCHOR / NOT_RUNTIME`；六款核心符号与十个 marker 只作为构图和语义复核，所有 runtime 像素由项目确定性 SVG + Sharp 重新绘制。
