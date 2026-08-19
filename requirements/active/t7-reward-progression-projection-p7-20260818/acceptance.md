# P7 本地验收

当前结论：`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。P7 只在本地稳定快照完成声明范围。

## 已达到

- [x] `reward-progression-v1` 以单一 `apply` Interface 隐藏 profile、daily、achievement、recent result、row 与奖励 Analytics plan。
- [x] JSON runtime 与 Memory 两个 Adapter 通过同一 commit seam 工作。
- [x] Reward 数值、资格、等级曲线与 P5 outbox/Supabase RPC 未迁移、未复制、未改写。
- [x] `meta.at` 贯穿 daily rollover、row 与 economy/reward Analytics 时间。
- [x] online/solo 两个 `applyResolvedProgress` 调用点保持 result wire、saveDB、syncRewardRow 和 AI learning 外部顺序。
- [x] Test Admin、guest、blocked、AFK、duplicate/conflict、hostile accessor、bounded recentResults 与 adapter failure 已有专项回归。
- [x] `daily_task_claim` 仍由原 server handler 负责，P7 只更新任务进度。

## 当前验证

```text
node --check server/boundaries/reward-progression.js
node --check server/index.js
npm run test:reward-progression
node qa/reward-system.js
node --experimental-websocket qa/daily-tasks.js
```

上述命令均通过。

## P7 后完整收口证据

- [x] `node qa/technical-optimization-mainline-contract.js`：退出码 0。
- [x] `npm run quality:gates`：退出码 0，输出 `QUALITY_GATES_FAST_ALL_PASS`。
- [x] 完整 `npm test`：退出码 0，包含 P7 T7 pretest、daily、Supabase、security、E2E 与全部既有游戏回归。
- [x] 本轮 Quality Adapter 接线后的两轮 `node scripts/build.js` + `node scripts/build.js --check` 完全一致：`2,070,498 characters / 2,085,121 UTF-8 bytes / SHA-256 B49347FE9A9EDE743F3C5F677CBE16BAA26236493320F914DE03D5603DE8BABA`。

## 保留缺口

- [ ] server-wide clock/timer 其他 owner、heartbeat/outbox/gameplay tick。
- [ ] 真实 Supabase/RLS/并发/备份恢复/多实例、设备/网络与发布证据。

## 非声明

本批没有玩家可见 UI、美术、协议、数据库 schema、Supabase 生产数据或发布动作变化。
