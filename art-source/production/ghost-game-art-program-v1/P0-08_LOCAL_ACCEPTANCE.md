# P0-08 本地核销 — Honru Context Reactions v1

核销状态：`IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

- Source/Runtime：`100%` — 16 Context 源 PNG + 16 Runtime WebP；16 Quick 源 PNG + 4×4 Atlas；3 张审查板。
- 本地实现：`100%` — Manifest allowlist、双 Flag、解码激活、九状态/Mascot/文字回退、快捷选择器/气泡/定向飞行、spectator/celebration/rematch 入口与清理均已接入。
- 机器证据：`100%` — `qa/honru-context-reactions-v1.js` 覆盖 ID、SHA、尺寸、Alpha、Atlas、路径、防篡改、确定性、fallback、reduced-motion、mute、cleanup 与 Authority 隔离。
- 当前构建浏览器可见证据：`0% / NOT_EXECUTED`。
- 第二浏览器、真机、真实网络：`0% / RELEASE_EVIDENCE_PENDING`。
- 发布：`0% / NOT_RELEASED`。

本单元没有实现聊天图片协议。`match-expression-v1` 仍只发送原有 6 个 quick ID；Direct Chat 与 Match Chat 仍为纯文字。

顺序进度：总计 `8 / 33 = 24.24%`；P0 `8 / 12 = 66.67%`；P1/P2 `0%`。下一单元为 `P0-09 / P-PROGRESSION-FEEDBACK-ART-V1`。
