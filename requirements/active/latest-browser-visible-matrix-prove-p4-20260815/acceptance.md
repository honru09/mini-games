# P4 验收

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

状态：`COMPLETED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

- [x] 首轮五档四区真实导航 20/20，零横溢出、零裸 key，且用真实玩家点击路径校准。
- [x] Shop、DM、Achievement、Room Lobby 与六款 390×844 Game Stage 已采集。
- [x] light/dark、zh-CN/en-US/uk-UA、visible reduced-motion 与 console 首轮已检查。
- [x] 深滚动后跨路由与同路由重选稳定回到顶部，Game Stage 滚动保存恢复不回归。
- [x] Monopoly 390×844 无长文字/marker/骰子互压，844×390 micro 也不互压，五档布局和可访问事实不丢失。
- [x] uk-UA 的 games/wins/remaining wins one/few/many/other 正确，三语 key/占位符同构。
- [x] 修正后五档四区、四共享表面、六 Stage、双主题、三语、reduced-motion、forced-colors、console 全部绑定当前构建。
- [x] viewport/media/theme/lang/dialog/Game Stage 清理完成；最终安全页。
- [x] 专项、i18n、Quality Gates、完整 `npm test`、双构建、报告和三日志完成。
- [x] 第二浏览器、真机、真实网络、Supabase 与人工美术继续 `NOT_EXECUTED/BLOCKED`。
- [x] 未 commit、push 或 deploy。
