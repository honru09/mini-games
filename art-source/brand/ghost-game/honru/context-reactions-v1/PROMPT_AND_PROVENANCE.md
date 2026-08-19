# P-HONRU-CONTEXT-REACTIONS-V1 — Prompt and provenance

## Current source decision

用户在 2026-08-18 明确要求：继续使用之前的 Honru 形象，只单独把人类式手改成 Q 版幽灵手，其他视觉保持不变。正式母稿：

`source/honru-hand-corrected-master-v1.png`

该母稿保留：三段火焰形头顶、原白/奶油配色、脸部淡红晕、十字方向键左眼、四圆按钮右眼、微笑、双脚和原始构图；仅把左右拳手换成两个连续单团、无指/无拇指/无掌部结构的 Q 版幽灵手。

## Generation method

- Tool: Codex built-in `imagegen` surgical image edit.
- Input: user-provided local reference `C:/Users/wangxr/AppData/Local/Temp/codex-clipboard-a51df130-1e4a-4134-a915-65a17dad64a6.png`.
- No third-party external asset pixels, PSD layers, AI objects, logos or commercial characters were used as image inputs for this edit.
- Background contract: square 1:1, uniform `#00FF00` chroma-key retained for the existing alpha pipeline.
- Rejected candidates: the earlier multicolor design master, black/white redesign, and any hand variant with finger-like lobes remain outside `source/`, `public/assets/`, Manifest and runtime.

## Exact edit brief

```text
Perform a surgical local edit of the attached original Honru image. Preserve every part of the reference exactly except the two side hands.

Keep unchanged: the three rounded flame-like top peaks, original white and pale-cream colors, original blush marks, thick dark outline, D-pad left eye, four-button right eye, smile, body shape, two lower ghost feet, pose, scale, camera framing, solid neon-green background, and all lighting/shading.

Change only the left and right human-like clenched hands. Replace each with a cute Q-version ghost hand: a single smooth rounded oval/teardrop ghost nub attached to the same short arm, with a softly scalloped outer edge, like a tiny floating ghost puff. The two replacement hands must match the original white/pale-cream palette and dark outline, remain in the same approximate locations and size, and read clearly at small size.

Strictly remove all human hand anatomy: no fingers, no thumb, no palm, no knuckles, no fingernails, no finger gaps, no fist folds, no human wrist. Do not alter the head, flames, colors, blush, face, body, feet, or background. Output the same square 1:1 image with the exact uniform #00FF00 background.
```

## Final derivatives and status

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_RUNTIME_DEFAULT_ON / NOT_RELEASED`。内置图像生成在母图完成后达到平台额度上限；未切换到未授权付费供应商。16 个 Context 与 16 个 Quick visual 均由 Alpha 身份锚以确定性 Sharp 合成派生，逐文件 SHA/bytes/dimensions/Alpha、Atlas、审查板和回退记录见 `asset-family-manifest-v1.json`。

母图是唯一身份锚。运行时保留旧 Honru 九状态、Mascot SVG、既有 Emoji/Unicode 与本地化文字 fallback，不改变 match-expression protocol、Rule Authority、Reward、Replay、Direct/Match Chat 或持久化。
