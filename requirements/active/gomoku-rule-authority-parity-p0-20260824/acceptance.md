# 五子棋完整服务端规则权威 P0 验收

状态：`IMPLEMENTED_LOCAL / BROWSER_NOT_EXECUTED / LOCAL_ONLY / NOT_RELEASED`

## 合同

- 协议冻结为 `gomoku-rule-v1`。
- 15×15 自由五子棋，无禁手；任意方向连续五子或以上判胜，满盘无五连判和棋。
- `gomoku_action` 只接受 `{matchId, seq, row, col}`；服务端权威维护回合、Last Seq、revision、稳定哈希和终局结果。
- 已协商且两级开关开启时拒绝旧 `move`、客户端 `game_state` 和客户端结果 claim；旧 capability 或任一开关关闭时回退旧 relay。
- 重连、观众和 AI Controller 共用权威快照；旧客户端不能恢复正在运行的 Authority 对局。
- Undo 只允许最后落子者、每局一次；回滚棋盘但不回退 seq/revision。

## 本批修正

- `GomokuRules.deserialize()` 现在校验棋子数量/奇偶、当前玩家、最后落子、终局类型，并拒绝终局前已存在五连的伪造快照。
- 浏览器客户端严格校验 `lastSeq` 与历史 `seq` 的数值、单调性和席位边界；重连/观战/恢复/销毁会清除未确认的 AI 学习候选，避免迟到状态误强化。
- Match Protocol 终局结果覆盖继续校验 slot 唯一、席位集合、rank/coins 合同，并保留 Authority/Adapter 原子回滚。

## 机器证据

- `npm run test:gomoku-rule-core`：PASS（含伪造终局快照拒绝）。
- `npm run test:gomoku-rule-authority`：PASS。
- `node qa/game-stage-wave-b-gomoku.js`：PASS（含客户端序号/历史 fail-closed）。
- `node --experimental-websocket qa/gomoku-rule-authority-online.js`：PASS。
- `node --experimental-websocket qa/gomoku-protocol-fallback-online.js`：PASS。
- `node qa/match-protocol-boundary.js`：PASS。
- `npm run quality:gates`：PASS（`QUALITY_GATES_FAST_ALL_PASS`）。
- `npm test`：PASS（`E2E_ALL_PASS`，posttest 完整回归通过）。
- 浏览器连接器、第二浏览器、真机、真实网络、真实 Supabase：`NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。

## 明确边界

Authority 输入暂未进入旧 `moveLog`/Replay；确定性回放仍归 `GAME-031`。本批没有 commit、push、Pages、Render 或生产数据写入。
