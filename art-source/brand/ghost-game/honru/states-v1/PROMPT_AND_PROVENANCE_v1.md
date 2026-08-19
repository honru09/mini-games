# Honru Expression Kit v1 — Prompt 与来源

## Authority 与用途

- 身份参考：`art-source/brand/ghost-game/honru/v2/honru-character-master-v2-flat-transparent-draft-v1.png`
- 生成方式：Codex 内置 ImageGen；每个状态独立调用，未使用 CLI、第三方模型或商业游戏素材。
- 输出用途：原始来源与审计母稿；当前九状态已依据 `OWNER_AUTHORIZED_ART_CLEARANCE-20260816.md` 进入本地可逆 runtime。人工风格/IP意见为可选咨询，线上发布仍需用户当前明确命令。
- 透明流程：纯绿色色键源 → `remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --edge-contract 1 --despill` → Alpha PNG。
- 三色归并：使用 32 位色距计算，将可见 RGB 归并为 Ink `#211923`、Paper `#FFF9F2`、Cream `#F3E5C4`，保留 Alpha；曾发现 16 位色距会溢出并立即从 Alpha 源重建，错误中间产物未保留为正样本。

## 共同 Prompt 骨架

```text
Use case: illustration-story.
Asset type: original Honru character expression state source for Ghost Game, <STATE>.
Input image 1 is the identity reference and must be preserved.
Create one full-body Honru only, centered, on a perfectly flat solid #00ff00 chroma-key background for later removal.
Preserve the exact identity anchors: one ghost body fused with gamepad grips, left eye as a clear plus-shaped D-pad, right eye as four round buttons, three rounded flame peaks, tiny friendly mouth, thick rounded dark ink outline.
Style: hand-cleaned 2D sticker cartoon, Ink/Paper/Cream flat fills, two-level cel shading, simple rounded silhouette, subtly handmade line weight, no glossy 3D.
The chroma background must be perfectly uniform with no shadow, gradient, texture, floor, particles, reflection, text, watermark, extra characters, clothing, props, teeth, or commercial-game resemblance. Do not use green in the subject. Keep generous padding and crisp separated edges.
```

## 状态 Prompt 增量与追踪

| 状态 | Prompt 增量（原文） | ImageGen 任务 ID | 色键源 |
|---|---|---|---|
| idle | `State: relaxed idle with a gentle closed-mouth smile, arms open slightly and a calm welcoming posture.` | `exec-62344938-c449-4288-bdea-c055c8300860` | `chroma/honru-idle-chroma-draft-v1.png` |
| thinking | `State: thoughtful concentration, one hand touching the cheek, small focused mouth, eyebrows implied only by subtle eye orientation, no text or symbols.` | `exec-d043f551-f4db-4e7d-b34d-ce4d10cc244a` | `chroma/honru-thinking-chroma-draft-v1.png` |
| surprised | `State: cute startled surprise, both hands lifted near the cheeks, small round open mouth but no teeth, slightly widened eyes while the D-pad and four buttons remain clearly readable.` | `exec-c60c32c2-747a-4fb3-9b71-eb0b7eadee6c` | `chroma/honru-surprised-chroma-draft-v1.png` |
| win | `State: joyful victory, both arms raised in a small celebratory pose, bright curved smile, subtle rosy Cream cheek marks, a few simple Cream star shapes attached close to the silhouette only; no floating particles, crown or trophy.` | `exec-732f0a58-61d3-4e9d-a978-8ab733366b4a` | `chroma/honru-win-chroma-draft-v1.png` |
| lose | `State: gentle disappointed but lovable loss, shoulders lowered, arms hanging softly, small downturned curved mouth, two tiny Cream tear-drop marks near the cheeks but no realistic tears.` | `exec-a6d0eb4f-bf1c-415c-be79-94cc20a4c689` | `chroma/honru-lose-chroma-draft-v1.png` |
| recover | `State: reassuring recovery after a mistake, one hand giving a clear thumbs-up while the other rests near the body, warm small smile, upright posture, a tiny Cream sparkle is allowed but no medical object or text.` | `exec-0c4f6da3-8c7a-4445-9ae0-aee2bd5664ff` | `chroma/honru-recover-chroma-draft-v1.png` |
| waiting-invite | `State: friendly waiting invitation, one hand waving toward the player, the other hand open as if welcoming someone, patient small smile, upright slightly leaning-forward pose. No props or symbols.` | `exec-6023bbdd-0a39-4771-93c6-7ff4ac335bd3` | `chroma/honru-waiting-invite-chroma-draft-v1.png` |
| check-in | `State: warm daily check-in, one hand patting the top of its own flame like a friendly greeting and the other hand making a small heart-like gesture without adding a separate icon, eyes relaxed and smile gentle. No text, calendar, coins, or props.` | `exec-9868c4bb-954c-4f28-b697-01a02127b83c` | `chroma/honru-check-in-chroma-draft-v1.png` |
| playful | `State: mischievous but kind playful challenge, one hand making a tiny beckoning gesture and the other hand on the hip, cheeky sideways smile, lively tilt. Keep it friendly and non-aggressive; no insults or symbols.` | `exec-87d62c50-2070-429c-9b4b-9dda444a2161` | `chroma/honru-playful-chroma-draft-v1.png` |

## 派生规则

- `alpha/`：色键移除后的原始 RGBA。
- `flat/`：确定性三色归并后的首选候选。
- `derived/`：每个首选候选的 192/96/64/44px 正方形派生图。
- `preview-honru-expression-kit-draft-v1.png`：仅用于审查的九宫格，不是运行时资产。
- 完整 SHA-256、bbox、四角 Alpha、绿色污染和调色板证据见 `requirements/active/honru-expression-kit-v1-20260809/evidence/source-alpha-audit-202608090320.json`。

## 许可与审查状态

- License：`project-owned-ai-generated`。
- Author：`OpenAI Codex for Ghost Game`。
- 自动技术检查：`PASS`。
- 机器视觉/技术/相似风险：`OWNER_AUTHORIZED_ART_CLEARANCE` 必备检查已完成，详见同目录清除记录。
- 人工清稿、Reviewer B、IP/法律意见与额外 Golden Set：`OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，不得伪造成 PASS，也不再阻塞开发或 runtime。
- 发布：`LOCAL_ONLY / NOT_RELEASED`；只有用户当前明确发布命令才可进入线上发布流程。
