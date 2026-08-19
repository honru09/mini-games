# 受控本地传输预检 P0 验收

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

状态：`ACCEPTED_LOCAL_CONTROLLED_PREFLIGHT / REAL NETWORK GATE BLOCKED`

## 已验收

- [x] Tetris v3 合法重连快照 `seq=7` 后首个真实控制发送 `seq=8`。
- [x] 错 match、旧 revision、畸形 seq 快照不能污染 Tetris 出站序号。
- [x] Tetris 乱序、duplicate 与 stale 拒绝后权威状态不变。
- [x] Tank 断线清除持续输入，旧本地 epoch 的未确认 `seq=2` 不进入 Authority，新 epoch 的 `seq=2` 才接受。
- [x] 旧 WebSocket 的 room/chat 回调不能污染新连接。
- [x] DM 以 2/10/11 证明数值排序，并按 ID 去重。
- [x] Terra Max 两轮审查发现的两项假阳性和 Tetris 负向覆盖缺口均已修正。
- [x] 专项、真实本地 WS 回归与完整 `npm test` 通过。
- [x] 最终 Quality Gates 与确定性双构建通过；能力状态与历史证据模式保持分层。

## 保持阻塞

- [ ] `TECH-030` 真实 50/100/200ms 延迟、抖动、丢包与乱序整形。
- [ ] 第二浏览器、Android、iPhone、Tablet、真实低端性能与两正式好友 UI。
- [ ] 当前 `0A6FE849…1CDB4` 构建完整浏览器可见矩阵。
- [ ] 生产发布。

本批不得描述为真实网络验证、跨设备验证或线上完成。
