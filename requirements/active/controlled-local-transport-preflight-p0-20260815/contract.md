# 受控本地传输预检 P0 合同

## Authority 与所有权

- Tetris 最终状态只由 `TetrisRuleAuthority` 决定；客户端只从已经通过协议、match、revision 与全玩家结构校验的快照抬升本人出站 `battleSeq`。
- Tank 最终位置、开火、命中与排名只由 `TankAuthority` 决定；测试侧 epoch gate 只模拟旧本地连接输入不会进入 Authority，不宣称生产协议存在 server-side epoch。
- Direct Chat 的消息 ID、十进制 seq 和正文继续由服务端权威签发；客户端只按 ID 去重并按十进制数值顺序展示。
- Room resume 继续使用生产 WebSocket 闭包的 `this.ws === ws`、房间 ID guard 和真实 close/reset 生命周期。

## Fail-closed

- Tetris duplicate/stale 被拒绝后，快照、revision、hash 与 input log 不得变化。
- Tetris 错 match、旧 revision、非法 seq 快照不能抬升 `battleSeq`。
- Tank 旧 epoch 输入必须在 `acceptInput()` 前丢弃；断线清零后不得幽灵移动或开火。
- 旧 socket 的 room/chat 回调不得修改新连接状态。
- DM 测试必须包含 2 与 10，禁止只用 1/2/3 造成字典序假阳性。

## Gate 与回滚

- 证据类型固定为 `CONTROLLED_LOCAL_DETERMINISTIC_SIMULATION_ONLY`。
- `TECH-030` 保持 `partial`，`GATE-DEVICE-BROWSER-NETWORK` 为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`：本地确定性预检不能冒充真实网络证据，但真实整形环境缺失不得阻塞其他开发。
- 回滚时移除新 QA/脚本入口并撤销 Tetris `battleSeq` 回填；不需要数据迁移、协议回滚或用户资产变更。
