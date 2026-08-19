# Honru Cleanup Candidate v1 — Prompt 与来源

- 状态：`AI_ASSISTED_CANDIDATE`
- 工具：Codex built-in ImageGen（默认内置路径）
- 输入：`../v2/honru-character-master-v2-flat-transparent-draft-v1.png`，仅作为编辑目标与角色身份参考。
- 原则：版本化新增；未覆盖 v2、九状态、P2 WebP、Manifest 或程序化 fallback。
- 透明化：`remove_chroma_key.py`，border auto-key、soft matte、despill；检测到 Key `#08f514`。

## Final prompt

```text
Use case: precise-object-edit
Asset type: versioned Honru character master cleanup candidate for Ghost Game
Input image 1: edit target and strict identity reference
Primary request: perform a careful professional 2D line-art cleanup of the existing mascot only. Keep the exact same original character concept: one compact ghost and game-controller body, flame-like ghost crown, left eye is a bold gamepad D-pad cross, right eye is exactly four round face buttons, tiny curved smile, two small rounded hands, two controller-leg lobes.
Style/medium: premium flat sticker cartoon with intentional hand-drawn warmth, clean confident dark-ink contour, restrained two-tone cream paper shading, no glossy 3D rendering, no generic AI texture.
Composition: centered full character, generous even padding, perfectly front-facing, symmetrical controller readability while retaining slightly organic hand-drawn curves.
Color palette: near-black ink #201820, warm paper white #fff8ed, pale cream highlight #f3dfad only.
Scene/backdrop: perfectly flat solid #00ff00 chroma-key background for removal; uniform edge-to-edge, no shadow, no gradient, no texture, no floor.
Constraints: preserve silhouette and proportions closely; preserve left D-pad and exactly four right buttons; crisp readable details at 44/64/96/192 px; consistent outline thickness; no cast shadow, no contact shadow, no reflection, no text, no logo, no watermark; do not use green anywhere in the character.
Avoid: extra fingers, extra buttons, asymmetric eyes, gradients, photorealism, 3D plastic, fuzzy edges, clutter, copyrighted characters or recognizable franchise costume elements.
```

## 明确边界

该文件记录生成与技术处理事实，不代表人工清稿、独立 Reviewer B、法律意见、IP PASS、Golden Set PASS 或默认开启批准。
