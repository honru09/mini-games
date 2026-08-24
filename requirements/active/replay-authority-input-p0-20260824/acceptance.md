# GAME-031 Replay Authority input projection

状态：`IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING / NOT_RELEASED`

## 已完成

- 服务端为 Gomoku、Ludo、Tetris、Xiangqi、Monopoly Authority 成功动作保留独立 `replayInputLog`；Tank 使用 `TankAuthority.replayLog` 保存输入与 fixed-tick 事件；不把聊天、表情、奖励、AI 学习或凭据写入该流。
- `server/gameplay/replay-authority.js` 使用相同的 shared Rule Core 进行 seq、match、动作合法性和稳定 hash 验证。
- 回放保存时写入有界 `authorityInputLog` 与脱敏 `deterministic` 摘要；Tank 事件包含 protocol、matchId、source/kind、时间轴序号、serverTick 与 projection hash，并使用开始时间/时长/席位配置重演；既有 `moveLog`、TTL、分享哈希、撤销和视觉播放器保持兼容。
- 缺少 Authority input、重复/乱序 seq、跨 match、非法动作均 fail-closed，不提升为 deterministic replay。
- Tank 时间轴会拒绝时间倒退、timelineSeq/serverTick 乱序、错误 match、客户端 seq 冲突、非法来源和 hash 不一致。
- `replay-lifecycle-v1` 为六款回放统一记录并校验 `start → authority/automatic → reconnect → instance → terminal` 顺序；终局 hash、排名、断线 epoch、服务器自动事件和实例全局序号均有 fail-closed 合同。
- Tetris server garbage 与 time-limit finish 已进入 canonical projection；Monopoly 自动 close-auction 写入 server-sourced input log。

## 验证

- `node --check server/gameplay/replay-authority.js`
- `node --check server/index.js`
- `node qa/replay-authority.js`
- `npm run test:replay-sharing`（含 10 项 Replay Authority 专项断言）
- Tetris server tick/garbage projection is covered by the replay QA and does not consume client seq.
- Tank input + fixed tick timeline replay、hash tamper、timeline order、match tamper 均由 `qa/replay-authority.js` 覆盖。
- 六款生命周期、终局缺失、重连乱序和多实例全局序号场景由 `qa/replay-authority.js` 覆盖。

## 外部证据边界

- Tetris client action、server tick/garbage、time-limit finish 与自动推进已进入 canonical projection，并由回放专项覆盖。
- Tank Authority timeline 已完成输入/fixed-tick/hash 重演、终局与保存接线；六款终局及生命周期顺序合同均已由本地回归覆盖。
- 六款共同的本地终局、自动推进、重连恢复、实例全局序号与逐事件 hash 对账已完成；GAME-031 的本地实现不再标记为 partial。
- 真实 Supabase Cluster 的跨实例事件、租约 fencing、备份恢复、生产并发和线上多实例证据仍未执行，因此不能把本地 `single_instance_only` 升级为生产 verified。
- 当前浏览器、第二浏览器、真机、真实网络、Supabase、多实例与发布仍 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。
- 本批未执行 commit、push、Pages、Render 或生产数据写入。
