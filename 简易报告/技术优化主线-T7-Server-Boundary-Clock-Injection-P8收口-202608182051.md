# 技术优化主线 T7 Server Boundary Clock Injection P8 收口

## 一句话结论

P8 已在不覆盖美术、音频和 Ghost3D 并行窗口改动的前提下完成本地验证：六个既有 Server Boundary 统一使用 `serverNow → ServerClockTimer.now()`，完整 Quality Gates 与 `npm test` 通过；T7 仍为 partial，项目保持 `LOCAL_ONLY / NOT_RELEASED`。

## 做了什么

- 将 Auth/Profile、Room/Presence、Match Protocol、Chat/Playline、Reward/Economy、Reward/Progression 的显式 `now` 接线集中到单一 `serverNow` seam。
- 保留各 Boundary 的 Interface、Memory/JSON Adapter、wire、数据、奖励与协议所有权，不扩大为全局时间虚拟化。
- 独立复跑 Tank Delta 在线回归，确认此前一次失败是并行测试时序/构建状态漂移，协议白名单与 v1 fallback 未放宽。
- 接纳其他窗口对 `public/index.html` 与 GameModuleLoader 的最新本地修改，只同步当前构建哈希和治理文档，不回退未知改动。

## 用户现在能看到什么

本批没有新增页面或游戏玩法；服务端边界的时间依赖更集中、更可测。前端当前快照为并行窗口合并后的本地版本。

## 还没做什么

- heartbeat、guest/reconnect、Room/Tournament lifecycle、Chat/Expression delay、Reward/AI outbox cadence、游戏 tick、transport deadline 与 Metrics `generatedAt` 尚未迁移。
- 第二浏览器、Android/iPhone/Tablet、真实网络整形、真实 Supabase/RLS/并发/备份恢复/多实例与发布均未执行。
- 未执行 commit、push、GitHub Pages、Render 或生产数据写入。

## 验证

- `node --experimental-websocket qa/tank-snapshot-delta-online.js`：`TANK_SNAPSHOT_DELTA_ONLINE_ALL_PASS`。
- `npm run reports:progress`、`node qa/progress-ledger.js`、`node qa/technical-optimization-mainline-contract.js`、`node qa/brief-report-contract.js`：通过。
- `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- `npm test`：退出码 0，完整 pretest/test/posttest 链通过。
- `node scripts/build.js --check`：`2070498` characters / `2085121` UTF-8 bytes / SHA-256 `0F7CD4F94730F3A90B32BE191549EF7858BF22940EBC05FD86994F15C7079D95`。
- `git diff --check`：通过。

## 风险与下一步

T7 仍保持 `partial`，下一批按 owner 继续迁移低风险 lifecycle timer；heartbeat、outbox、gameplay tick、transport deadline 后置分批。外部设备、Supabase 与发布 Gate 继续保持开发开放、发布证据待决。

## 发布状态

`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。按当前发布策略不自动上线。

## 追溯入口

- `requirements/active/t7-server-boundary-clock-injection-p8-20260818/`
- `server/index.js`
- `qa/timer-audit.js`
- `public/index.html`（当前本地快照）
