# Honru Emoji v1 技术审查（Reviewer A）

状态：`TECHNICAL_CANDIDATE / NOT_APPROVED_FOR_RUNTIME`

## 已验证

- 10/10 源稿均为 1254×1254 PNG；Alpha 输出为 RGBA，四角透明。
- 色键移除使用技能规定的 `remove_chroma_key.py` 参数；Alpha 可见像素的绿色污染扫描为 0。
- 192/96/64/44px 四档派生共 40 个；`poster` 为 640×360、`atlas` 为 1024×768，4×3 的最后两个 cell 为空。
- 44px strip 可见复核：十字眼、四点眼和主要手势仍可分辨；未发生透明角被裁掉。
- 所有文件只在 `art-source/brand/ghost-game/honru/emoji-v1/`，未进入 `public/`、Manifest、运行时或线上。

## 未通过/待人工

- 未检查最终 flat 三色清稿、压缩后 WebP、解码错误回退和真实浏览器内存预算。
- `angry` 的眉/嘴形、`heart` 的心形比例、`cry` 的泪滴需要 Reviewer B 做原创性与小尺寸语义复核。
- 未完成独立 IP Review、Golden Set 决议、真机与 reduced-motion 可见证据；本候选必须保持 `reference-only/default-off`。

## 结论

技术源稿可进入人工清稿队列，不能直接接入生产。后续接入必须严格使用冻结的十个 `emojiId`，并保留 Unicode/可读文字 fallback。
