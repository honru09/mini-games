# 当前构建单浏览器可见矩阵 PROVE P2 验收

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

状态：COMPLETED LOCAL SINGLE-BROWSER / EXTERNAL GATE REMAINS BLOCKED

## 本批完成边界

- “当前构建”证据必须记录 `public/index.html` 的 SHA-256 与字节数；不同哈希只能作为历史证据。
- 当前构建已完成五档 Home/Games/Playline/Profile、Shop/DM/成就/房间大厅、六款 Game Stage、三语言、双主题、visible reduced-motion 与 forced-colors；工具栏 44×44、Tab/输入 44px、Logo 昼夜可见、3px 键盘焦点、零裸 key、零横向溢出与零最终 CDP 事件。
- 旧 P1 五档四区矩阵继续保留，但对应 `BFBD2109…`，在新全矩阵完成前只称历史批次。
- PWA 离线三语证据不能替代 Games、弹层或 Game Stage 全矩阵。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络、双正式好友 UI、真实性能/音频/恢复、生产环境均保持未执行。

## 外部门禁

`GATE-DEVICE-BROWSER-NETWORK` 继续为 `BLOCKED`；`TECH-027` 继续 `partial`，其余六个外部需求继续 `blocked`。
