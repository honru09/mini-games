# 当前构建单浏览器可见矩阵 PROVE P3 验收

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

状态：`LOCAL_CURRENT_BUILD_SINGLE_BROWSER_COMPLETE / EXTERNAL_GATE_BLOCKED`

## 当前构建与浏览器

- [x] 磁盘、`localhost:8080` 与 `127.0.0.1:8090` 均为 1,580,313 characters / 1,594,847 bytes / `0A6FE849…1CDB4`。
- [x] 只使用一个 Codex in-app Chromium；未把第二标签冒充第二浏览器。
- [x] 复用现有正式 QA 会话；未创建账号、未记录敏感凭证或玩家正文。

## 已采集

- [x] 五档 viewport × Home/Games/Playline/Profile；20/20 路由正确，零横溢出、零裸 key、`scrollY=0`。
- [x] Shop、DM、Achievement、Room Lobby；滚动锁、关闭与 DM 焦点恢复正常。
- [x] 六款 Game Stage 进入/退出；每款 Stage/Arena/Command/Back 均存在，Seat Rail 为两席。
- [x] zh-CN/en-US/uk-UA、light/dark、visible reduced-motion、forced-colors、console warn/error 0。
- [x] 临时 viewport/媒体模拟全部复位；最终回到 Home、zh-CN、light、非 Game Stage。

## 保持阻塞

- [ ] 第二桌面浏览器、物理 Android/iPhone/Tablet。
- [ ] 真实网络整形、双正式好友跨浏览器 UI、真实性能/音频/恢复。
- [ ] Supabase、生产与发布。

## 结论

- [x] `TECH-027` 获得当前 `0A6FE849…1CDB4` 单浏览器部分证据，状态保持 `partial`。
- [x] `GATE-DEVICE-BROWSER-NETWORK` 保持 `BLOCKED`，没有把 CSS viewport 冒充真机或第二浏览器。
- [x] 本批 `LOCAL_ONLY / NOT_RELEASED`，未 commit、push、Pages 或 Render deploy。
