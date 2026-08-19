# Honru Emoji v1 技术审查（Reviewer A）

状态：`TECHNICAL_PASS / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_RUNTIME_DEFAULT_ON / NOT_RELEASED`

## 已验证

- 10/10 源稿均为 1254×1254 PNG；Alpha 输出为 RGBA，四角透明。
- 色键移除使用技能规定的 `remove_chroma_key.py` 参数；Alpha 可见像素的绿色污染扫描为 0。
- 192/96/64/44px 四档派生共 40 个；`poster` 为 640×360、`atlas` 为 1024×768，4×3 的最后两个 cell 为空。
- 44px strip 可见复核：十字眼、四点眼和主要手势仍可分辨；未发生透明角被裁掉。
- source-sidecar 文件继续只在 `art-source/brand/ghost-game/honru/emoji-v1/`；固定 SHA 的 1024×768 runtime atlas 与 640×360 poster 已在所有者清除后进入 `public/assets/brand/honru/emoji-v1/` 与生产 Manifest。当前只接入本地 runtime，未发布。

## 当前补充验证与可选咨询

- 压缩 WebP 尺寸/hash/预算、Manifest clearance/path/cell、解码/资源失败回退、双 kill switch 与本地单 Chromium 的 picker/投掷/reduced-motion 已有当前证据。
- `angry` 的眉/嘴形、`heart` 的心形比例、`cry` 的泪滴仍可由自然人 Reviewer B 或 IP/法律顾问提供原创性与小尺寸语义建议；这些是 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，不是 runtime 前置。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络和低端性能为 `RELEASE_EVIDENCE_PENDING`。外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁用。

## 结论

技术源稿、runtime 派生、稳定 ID/SHA/provenance、机器视觉/相似风险、fallback、feature flag 与回滚已形成 `OWNER_AUTHORIZED_ART_CLEARANCE`。当前可逆 default-on 接入必须继续严格使用十个冻结 `emojiId`，保留 Unicode/可读文字 fallback，且不改变 Chat 纯文字协议；发布仍须当前用户明确命令。

Historical-as-of（2026-08-11）：原审查状态为 `TECHNICAL_CANDIDATE / NOT_APPROVED_FOR_RUNTIME`，结论要求保持 `reference-only/default-off` 并等待人工清稿、Reviewer B/IP/Golden Set。该 candidate-only/default-off 结论不能抹掉，但只描述当时尚无 owner clearance 的源稿阶段，不覆盖 2026-08-16 当前事实。
