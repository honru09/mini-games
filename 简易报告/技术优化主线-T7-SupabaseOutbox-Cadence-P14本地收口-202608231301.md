# 技术优化主线 T7 — Supabase Outbox Cadence P14 本地收口简报（2026-08-23 13:01）

## 一句话结论

Supabase 开启时的 Reward 与 AI Learning outbox 重试已由两个原生 interval 合并为一个 `ServerClockTimer` owner，保持 leader-only、幂等重试和失败隔离；当前仍为 `LOCAL_ONLY / NOT_RELEASED`。

## 本批完成

- 新增 `supabase-outbox-sync` repeat owner，统一驱动 `retryPendingRewardSync()` 与 `retryPendingAILearningSync()`。
- 未启用 Supabase 或当前实例不是 Cluster leader 时跳过；启用时保留原 `REWARD_SYNC_RETRY_MS` cadence。
- 两个 drain 使用 `Promise.allSettled`，分别记录 `supabase_reward_outbox_retry` / `supabase_ai_outbox_retry`，单类失败不会取消下一轮 lease。
- 两个 drain 在同一 lease 内串行，避免 Windows 原子 `saveDB()` rename 竞争；第一类失败仍会让第二类继续。
- 删除原有两个 outbox `setInterval`；服务器关闭沿用 `serverClockTimer.dispose()`。

## 各方向距离最终闭环

| 方向 | 本地实现 | 最终闭环 |
| --- | ---: | ---: |
| 美术与品牌 | 52.8% | 46.3% |
| 界面与交互 | 75.0% | 67.8% |
| 游戏与局内体验 | 72.1% | 67.9% |
| 社交与玩家关系 | 60.6% | 60.3% |
| 经济成长与商业化 | 75.9% | 71.7% |
| 技术数据AI与跨平台 | 68.5% | 62.8% |
| 整体 | 67.8% | 62.9% |

这是 242 项台账的治理快照；本批不把本地 Timer/静态 QA 当作真实 Supabase、多实例、设备或发布证据。

## 验证

- `node --check server/index.js`：通过。
- `node qa/timer-audit.js`：`TIMER_AUDIT_ALL_PASS`。
- 相邻 `node qa/auth-profile-boundary.js`：`AUTH_PROFILE_BOUNDARY_ALL_PASS assertions=12`。
- `node --experimental-websocket qa/supabase-adapter.js`：`SUPABASE_ADAPTER_ALL_PASS (26 assertions)`；首次全链出现的 Windows `EPERM` 临时文件锁已通过串行 outbox drain 修正并独立回归通过。
- P13 收口阶段已通过 `npm run quality:gates`、完整 `npm test`（退出码 0）、构建检查、状态/台账/简报合同和 `git diff --check`；当前构建 SHA-256 `6AA8EF0C1CE035DD8008C7A5479495029B54779088404977F2FFA735219E9246`。

## 保留缺口与下一主线

真实 Supabase/RLS/并发/备份恢复、多实例生产租约、第二浏览器、真机、真实网络、低端性能和发布仍未执行。下一序列继续处理其他低风险 lifecycle timer，再分批迁移 gameplay tick 与 transport deadline；规则、奖励数值和生产数据不变。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。本批未提交、未推送、未触发 GitHub Pages 或 Render。
