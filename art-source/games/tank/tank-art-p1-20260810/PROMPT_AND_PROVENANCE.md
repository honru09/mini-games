# Tank Art P1 Prompt & Provenance

## 资产批次

- 任务：`tank-art-p1-20260810`
- 用途：source-only 坦克大战视觉方向板；不是运行时 sprite sheet，也不是可直接上线的贴图。
- 模型：内置最高质量图像模型 `gpt-image-2`（built-in runtime-managed）
- 生成时间：2026-08-10 04:23–04:26（Asia/Tokyo）
- 输出尺寸：1536 × 1024 PNG
- 许可：`project-owned-ai-generated`
- 作者标识：OpenAI Codex for Ghost Game
- 生产接入：禁止；两个条目均为 `reference-only`。因素材库 Schema 要求 `runtimePaths` 至少一项，目录中的该字段仅重复指向 `art-source/` 源稿以满足审计，不代表已接入运行时；不写入 `public/assets/manifests/asset_manifest.json`。

## 初稿（已拒绝）

输出：`rejected/tank-style-board-draft-v1-symbol-noise.png`

- SHA-256：`4E4DFA8FDC94AFB643DFFD3B1059272A3037DA4375902652129FA79E3347FD2E`
- 文件大小：2,962,264 bytes
- Reviewer A 机器/视觉结论：拒绝进入候选集。画面出现幽灵徽记、旗帜、骷髅样符号、角落装饰和伪文字/符号噪声，违反原创标识、无文字和无商业 IP 相似性边界；保留仅作 rejected 证据。

### 初稿逐字 Prompt（生成调用恢复）

```text
Use case: stylized-concept. Asset type: source-only visual style board for a tabletop web game, not a final runtime sprite sheet. Create a polished original Ghost Game tank arena art direction board with four distinct small tank skin concepts arranged as separate readable studies: 1) ink-and-paper classic tank, 2) white jade and black stone tank, 3) faceted crystal tank, 4) restrained monochrome neon-accent tank. Include one compact top-down tabletop arena material inset with readable brick walls, steel walls, base pads, and subtle paper/cardboard texture. Style: handcrafted premium game concept art, clean deliberate thick black comic ink contours, simple cute proportions but precise industrial forms, restrained motion-line accents, high contrast black and off-white with only tiny muted gray accents, tactile paper/wood/stone surface, subtle 3D tabletop perspective, crisp silhouettes, coherent Ghost Game visual language. Composition: a clean museum-like design board with generous spacing, each tank fully visible in three-quarter view, arena inset clearly separated, no UI layout. Lighting: soft studio tabletop light, controlled shadows, strong legibility in both light and dark themes. Constraints: original silhouettes and original symbols only; no recognizable commercial game characters, no copied logos, no text, no letters, no numbers, no watermark, no weapons firing, no explosions, no clutter, no gradients that muddy black-white readability, no AI artifacts, no extra tanks beyond the four studies and one arena inset.
```

## 清理版（当前保留候选）

输出：`tank-style-board-clean-draft-v2.png`

- SHA-256：`9EEAB1B34B5014F66983026E9245DBC28EC7C8A48B6B11B4CB20267B0CF914E7`
- 文件大小：2,753,232 bytes
- Reviewer A 机器/视觉结论：通过“可进入人工审查”的 source-only 门槛。徽记、旗帜、伪文字与角落符号已移除；四辆坦克和右侧实体桌游竞技场保持清晰、黑白高对比、厚墨线和纸板/石材/玉石/晶体/克制科技材质方向。
- 尚未通过的事项：四辆坦克仍需人工确认小尺寸轮廓区分、材质是否遮挡命中/HUD、棋盘基地/钢墙语义是否足够明确；未做分层、透明边缘、运行时尺寸派生和真机性能验证。

### 清理版逐字编辑 Prompt（生成调用恢复）

```text
Edit the provided source-only tank art direction board. Preserve the exact overall layout: four separate tank studies on the left and center plus one compact tabletop arena inset on the right; preserve the black/off-white handcrafted paper, stone, jade, crystal, and restrained monochrome material direction. Make only these targeted corrections: remove every ghost logo, emblem, flag, banner, glyph, decorative pseudo-letter, badge, and symbol from all tanks, the arena, corners, and background; leave all surfaces completely free of logos and text. Standardize the four tanks so they share the same coherent base chassis proportions, wheel count, turret scale, barrel thickness, and clean industrial construction, while retaining their four distinct material skins. Simplify stray ornamental curls and noisy scratches. Keep crisp hand-inked contours, tactile studio lighting, strong black-white readability, generous spacing, no explosions, no characters, no watermark, no text, no extra objects, no AI artifacts. This is an original premium game concept board, not a commercial franchise imitation.
```

## 审批状态与下一步

| 门 | 状态 | 说明 |
|---|---|---|
| 最高质量生成与固定 SHA | 已完成 | 两版 PNG 均可复核 |
| Reviewer A 初审 | 已完成 | v1 拒绝；v2 允许进入人工候选 |
| 人工清稿 | 未完成 | 需要逐辆坦克、地图墙体/基地、边缘和小尺寸清稿 |
| Reviewer B 独立复核 | 未完成 | 必须由独立自然人完成 |
| IP Similarity Review | 未完成 | 需确认轮廓、符号、构图无可识别商业 IP 相似性 |
| Golden Set 决议 | 未完成 | 用户签字后才能建立独立 runtime 接入任务 |

在上述人工闸门完成前，候选只能存放于 `art-source/` 和素材库 provenance；现有 CSS/Canvas 表现继续作为唯一运行时 fallback。
