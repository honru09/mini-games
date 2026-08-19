# 技术优化主线 T7 Reward/Progression Projection P7 收口

## 一句话结论

P7 已把已解析 Reward 的 profile/daily/achievement/recentResults 投影与审计 plan 收进 `reward-progression-v1` 深 Module，并通过完整共享回归与确定性双构建；T7 继续 partial。

## 做了什么

- 新增单一 `apply` Interface、detached prepare/commit、JSON runtime Adapter 与 Memory Adapter。
- 固定 `meta.at` 贯穿 daily rollover、reward row、economy ledger 与奖励 Analytics。
- online/solo 结算保持原 result wire、P5 outbox、AI learning、daily claim、Supabase schema/RPC 与 saveDB owner。
- 增加重复/冲突、阻断/AFK、访客、Test Admin、hostile input、边界日期和 Adapter failure 回归。

## 用户现在能看到什么

本批没有新增玩家可见界面；变化是服务端奖励成长投影的所有权和可测试性更集中。

## 还没做什么

- server-wide clock/timer、heartbeat、outbox sweep 与 gameplay tick 尚未迁移。
- 真实 Supabase/RLS/并发/备份恢复/多实例、第二浏览器、真机、真实网络与发布均未执行。

## 验证

- `npm run test:reward-progression`、`node qa/reward-system.js`、`node --experimental-websocket qa/daily-tasks.js`：通过。
- `npm run quality:gates`、完整 `npm test` 与两轮确定性双构建均通过；构建为 `2,061,199 characters / 2,075,822 bytes / 297C9362…EC856`。

## 风险与下一步

保留 `applyResolvedProgress` 兼容薄包装，降低滚动回退风险；下一步先完成共享质量门禁，再进入下一个 server clock/timer owner，不切入生产 Gate。

## 发布状态

`VERIFIED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。未提交、未推送、未部署。

## 追溯入口

- `requirements/active/t7-reward-progression-projection-p7-20260818/`
- `server/boundaries/reward-progression.js`
- `qa/reward-progression.js`
