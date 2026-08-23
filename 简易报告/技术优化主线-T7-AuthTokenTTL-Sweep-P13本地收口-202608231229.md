# 技术优化主线 T7 — Auth Token TTL Sweep P13 本地收口简报（2026-08-23 12:29）

## 一句话结论

正式账号 Session Token 的过期清扫已接入既有 Auth/Profile boundary 和 ServerClockTimer，专项回归通过；当前仍是 `LOCAL_ONLY / NOT_RELEASED`，不代表真实 Supabase、多实例、设备或线上证据。

## 本批完成

- `server/boundaries/auth-profile.js` 新增 `sweep_expired`：单次时间采样，清理过期、未来签发和畸形记录；保留 legacy bare hash 的既有迁移语义。
- 清扫返回扫描/更新/清除/失败统计，`changedUids` 只用于内部持久化；Adapter 写入失败会恢复原数组，避免半写入。
- `server/index.js` 新增 `auth-token-expiry-sweep` 唯一 repeat lease；Cluster 开启时仅 leader 执行。
- 发生清理时保存本地 JSON、同步正式 Supabase profile，并让已失效的当前会话收到 `session_expired` 后关闭，释放房间和私聊占用。
- 未新增 auth 原生 `setInterval`，服务器关闭继续由统一 `serverClockTimer.dispose()` 清理。

## 各方向距离最终闭环

沿用 242 项台账权重快照；本批主要提升技术数据与跨平台方向，未把本地回归提升为外部发布证据：

| 方向 | 本地实现 | 最终闭环 |
| --- | ---: | ---: |
| 美术与品牌 | 52.8% | 46.3% |
| 界面与交互 | 75.0% | 67.8% |
| 游戏与局内体验 | 72.1% | 67.9% |
| 社交与玩家关系 | 60.6% | 60.3% |
| 经济成长与商业化 | 75.9% | 71.7% |
| 技术数据AI与跨平台 | 68.5% | 62.8% |
| 整体 | 67.8% | 62.9% |

百分比是治理快照，不是浏览器、真机、生产 Supabase 或发布承诺。

## 验证

- `node qa/auth-profile-boundary.js`：`AUTH_PROFILE_BOUNDARY_ALL_PASS assertions=12`。
- `node qa/timer-audit.js`：`TIMER_AUDIT_ALL_PASS`。
- `node --check server/boundaries/auth-profile.js`：通过。
- `node --check server/index.js`：通过。

- `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- 完整 `npm test`：退出码 `0`。
- `node scripts/build.js --check`：通过；当前 `public/index.html` 为 1,808,578 characters / 1,822,431 UTF-8 bytes / SHA-256 `6AA8EF0C1CE035DD8008C7A5479495029B54779088404977F2FFA735219E9246`。
- `node scripts/validate-project-state.js`、`node qa/brief-report-contract.js`、`node qa/progress-ledger.js`、`git diff --check`：通过（仅保留 Git 的换行转换提示，无空白错误）。

## 保留缺口与下一主线

真实 Supabase/RLS/并发/备份恢复、多实例生产租约、第二浏览器、Android/iPhone/Tablet、真实网络整形、低端性能和发布仍未执行。下一序列继续迁移其他低风险 lifecycle timer，再批量处理 outbox cadence、gameplay tick 与 transport deadline；不修改游戏规则、奖励数值或生产数据。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。本批未提交、未推送、未触发 GitHub Pages 或 Render。
