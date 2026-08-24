# Replay Authority 输入投影简易报告（2026-08-24 10:20）

## 本批完成

GAME-031 已接入 `replay-authority-v1`。Gomoku、Ludo、Tetris、Xiangqi、Monopoly 的服务端 Authority 成功动作现在会进入独立有界 `replayInputLog`；Tetris 的 server tick/garbage 自动动作也进入该流。回放落盘时由同一 shared Rule Core 验证 match、每席 seq、动作合法性与稳定 hash，并保存脱敏 `deterministic` 摘要。

旧 `moveLog`、Replay v1.1 的七天 TTL、公开延迟、分享哈希、撤销和 2.5D cinematic 播放器均保持兼容；聊天、表情、奖励、AI 学习、凭据和玩家正文不进入该投影。

## 验证结果

- `npm test`：exit code 0。
- `npm run test:replay-sharing`：PASS（含 Replay Authority 8 项专项断言）。
- `npm run build -- --check`：PASS。
- `npm run test:progress-ledger`：PASS，242 项需求。
- `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- 当前构建：`public/index.html` 1,825,915 characters / 1,839,768 bytes / SHA-256 `86E6DF923C5DFD5A21E9ADBBCFFCA02CD7282CCFE979E5B74C1B4532429377E1`。

## 阶段性未完成（已由最终收口段落更新）

此处记录的是本报告早期阶段：Tank Authority 时间轴与六款完整终局/自动推进逐事件对账当时尚未完成。当前浏览器、第二浏览器、真机、真实网络、Supabase、多实例与线上发布仍为 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。最终状态见下方“六款生命周期收口”与“最终核销”。

## 当时的下一主线

继续 GAME-031：补 Tank Authority timeline，再做六款 deterministic replay 的完整终局/自动推进对账；不把当前局部投影冒充完整回放（历史记录）。

## 追加进展（2026-08-24，深度继续）

Tank Authority timeline 已完成本地实现并接入回放保存：`TankAuthority.replayLog` 记录客户端输入与服务器 fixed tick，每条事件带 `timelineSeq`、`at`、`serverTick` 和脱敏 projection hash；`saveReplayForRoom()` 将其转换为 `authorityInputLog`，并以开始时间、时长和席位数调用 Tank 专用 verifier。verifier 对时间倒退、时间轴/服务器 tick 乱序、跨 match、输入 seq、来源和 hash 不一致全部 fail-closed。

本次新增 2 项 Tank 专项场景，Replay Authority 断言总数由 8 项增至 10 项；`node --check server/gameplay/tank-sim.js`、`node --check server/gameplay/replay-authority.js`、`node --check server/index.js`、`node qa/replay-authority.js` 与 `npm run test:replay-sharing` 已通过。GAME-031 仍为 `partial`：六款终局、自动推进、重连和跨实例逐事件对账，以及浏览器/真机/真实网络/Supabase/发布证据仍未完成。本轮未 commit、push、Pages、Render 或生产数据写入。

下一主线：完成六款 deterministic replay 的终局、自动推进、重连与跨实例对账，并继续保持旧 `moveLog`/Replay v1.1 兼容。

## 追加进展（2026-08-24，六款生命周期收口）

六款本地生命周期合同现已接入 `replay-lifecycle-v1`：回放保存时统一记录 start、Authority/服务器自动事件、断线/恢复 epoch、实例顺序和 terminal；终局 hash、排名、自动事件顺序、重连相位与实例全局序号均会 fail-closed 校验。Tetris 的 server garbage 与 time-limit finish 已进入 canonical projection，Monopoly 自动 close-auction 写入 server-sourced input log；旧 `moveLog`、Replay v1.1 分享/撤销/TTL 和视觉播放器继续兼容。

`qa/replay-authority.js` 现为 13 项断言，覆盖六款生命周期、终局缺失、重连乱序、实例顺序、Tetris 自动垃圾/时间终局；`npm run test:replay-sharing` 与每日任务回归通过。若未启用真实 Cluster，回放摘要明确标记 `single_instance_only`；真实 Supabase 租约 fencing、生产跨实例事件、备份恢复与线上证据仍未执行，但 GAME-031 的本地实现已完成。

下一主线：在真实 Supabase/隔离多实例环境执行 Cluster lease、fencing、事件顺序、备份/恢复/回滚和并发验收；不把本地合同替代生产证据。

## 最终核销（2026-08-24）

本轮已完成 GAME-031 本地闭环：六款游戏的终局、服务器自动推进、重连恢复、实例全局顺序与逐事件 hash 对账均由 `replay-authority-v1` + `replay-lifecycle-v1` 覆盖；Tank fixed-tick、Tetris garbage/time-limit、Monopoly close-auction 均纳入 canonical replay。`npm test`、`npm run quality:gates`、`npm run test:replay-sharing`、`npm run test:progress-ledger`、`node qa/brief-report-contract.js` 与 `npm run build -- --check` 全部通过。

仍未执行且不能本地冒充的只有外部证据：真实 Supabase Cluster lease/fencing、生产多实例逐事件对账、备份/恢复/回滚/并发、当前浏览器与第二浏览器、真机、真实网络和线上发布。本轮未 commit、push、Pages、Render 或生产数据写入。
