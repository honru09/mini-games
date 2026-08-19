# P0-09 Reward / Progression Feedback Art — Prompt and Provenance

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED`

## 生成任务

- Provider：`OpenAI Codex built-in imagegen`
- Model：内置模型名称未由工具暴露
- Task ID：`exec-d58f44a9-b320-4f24-bf04-c312f8c0d285`
- 用途：P0-09 `P-PROGRESSION-FEEDBACK-ART-V1`
- 输出：透明 4×2 原子母板，随后由项目本地 Sharp 确定性切片和派生
- 母板：`art-source/platform/progression/feedback-v1/source/ai/progression-feedback-atlas-master-v1.png`
- 母板 SHA-256：`4DFDE26C2426430FA3BA42C51F7BC067F3600EF169A9312555BFDADB359C94EC`
- 母板尺寸/Alpha：`1672×941 / RGBA / genuine alpha`

## 输入及角色

本次只传入项目自有或已取得所有者清除的图像，未传入外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 文件：

| 输入 | 角色 | SHA-256 |
|---|---|---|
| `art-source/ui/sticker-v1/component-demo.png` | 项目 M0 North Star，粗黑轮廓、状态组件和可读性参考 | `135DB655DC400FB35F960045B510EE450E007CCFAD03E308DEBF65E222DB1F61` |
| `art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png` | 项目 M0 North Star，卡片材质、阴影和配色参考 | `184E24BFD5C52F54FA240366787A0751E5078038E4FBDA17B91C61219F2B4DE5` |
| `public/assets/ui/currency/gcoins-v1/gcoins-icon-192-v1.png` | 已清除 G Coins 材质参考；禁止重画或替换本体 | `AAC1DDC47EB931A612E1EF9ACF97D1215EBBDB591E818CA0CFDC33B15D40F421` |

## 最终提示词

```text
Use case: stylized-concept
Asset type: project-owned game UI reward and progression feedback atom sheet
Primary request: Create one polished 4 by 2 grid of eight isolated, text-free feedback illustrations for Ghost Game: XP sparkle/star, level-up ascending chevrons with radiant halo, completed task clipboard/check, achievement medal/shield, win-streak flame with three rising sparks, collection treasure capsule/chest, unlock key/open lock, and reward burst/confetti ring. These are transparent foreground atoms for CSS/Canvas/GSAP 2.5D UI motion.
Input images: Image 1 and Image 2 are the project-owned visual North Star for thick ink outlines, warm cream surfaces, sticker-like depth and state colors. Image 3 is the project-owned approved G Coins mark for palette/material reference only; do not redraw, mutate, imitate, or include that mark in any cell.
Scene/backdrop: genuinely transparent background; no panel, no card, no floor, no surrounding scene.
Style/medium: original Ghost-native Q-version game UI illustration; thick dark plum-black outline; warm cream highlights; restrained teal, blue, gold, coral and violet accents; small contact shadows contained within each atom; crisp at 64px.
Composition/framing: exact 4 columns by 2 rows; one centered atom per equal cell; generous safe padding; no overlap; consistent apparent scale; clean separations suitable for deterministic slicing.
Lighting/mood: friendly premium game feedback, energetic but controlled.
Constraints: no text, numbers, letters, logos, watermarks, human hands, characters, faces, brand marks, gamepad symbols, coins, currency signs, baked UI cards, or external franchise motifs. Do not include the referenced G Coins icon. Preserve genuine alpha transparency. Each cell must have one clear silhouette and remain readable at 44px. Original design only.
```

## 本地派生

- 8 个 AI 母板 cell 通过 `scripts/generate-progression-feedback-art-v1.js` 裁切、Alpha trim、居中为 512×512 source atom。
- G Coins atom 由现有 192×192 owner-cleared PNG 确定性居中并加独立接触阴影；货币本体像素未变。
- 9 个语义 ID 各生成 96/160/256 三档 WebP，共 27 个 runtime 变体，runtime `310,540 bytes / 2 MiB`。
- 文字、金额、XP、等级、任务进度、成就状态、收藏数量和解锁文案都留在 HTML/i18n；图片是 decorative presentation only。
- 2.5D 消费：透明前景原子由现有 `GhostSurfaceMotion`/GSAP transform、autoAlpha 和有限 Timeline 消费；reduced-motion 只保留静态等价图。

## 许可、传输和拒绝项

- 许可：项目自有 AI 生成母板 + 项目自有确定性派生；G Coins 来源继续使用原有 `OWNER_AUTHORIZED_ART_CLEARANCE`。
- `transmissionScope`：本地 Codex 内置 imagegen 任务，仅传递上表三项项目自有输入；没有第三方供应商上传。
- 未读取、未上传、未复制、未描摹、未换色任何外部 blocked-license 像素或图层。
- 母板不是 runtime；所有外部影响候选仍按 `SOURCE_ONLY_EXTERNAL_INFLUENCED / SIMILARITY_REVIEW_REQUIRED` 规则处理。本批无外部影响候选。
