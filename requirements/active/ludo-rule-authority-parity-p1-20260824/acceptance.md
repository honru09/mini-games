# 飞行棋完整服务端规则权威 P1 验收

状态：`IMPLEMENTED_LOCAL / BROWSER_NOT_EXECUTED / LOCAL_ONLY / NOT_RELEASED`

## 合同

- 协议冻结为 `ludo-rule-v1`，2/3/4 人分别使用 `[0,2]`、`[0,1,2]`、`[0,1,2,3]` 起始阵营映射。
- 服务端权威生成骰面并维护 52 格公共轨道、起飞、终点 56、碰撞、六点额外回合、回合、revision、hash 与可信终局排名。
- `ludo_action` 只接受 `{matchId, seq, action:{type:'roll'|'move', token?}}`；客户端不能提交骰面或直接提交状态/结果。
- 两级开关与 capability 任一不满足时回退旧 `move` relay，保证滚动发布兼容；Authority 对局拒绝旧 `move` 与客户端结算 claim。
- 重连、观众和 AI Controller 使用同一权威快照；Replay 输入仍归 GAME-031。

## 本批实现

- `shared/rules/ludo.js`：规则核心、严格状态/动作校验、路径与碰撞、终点与排名、序列化/hash。
- `server/gameplay/ludo-rule-authority.js`：服务端骰子、seq、revision、可信事件与结果。
- `server/boundaries/match-protocol.js`、`server/index.js`、`server/gameplay/protocol.js`：协议协商、Adapter 原子回滚、AI/重连/观战快照和旧客户端回退。
- `public/src/games/ludo.js`、`public/src/online/03-websocket.js`、`public/src/ui/07-roster.js`：权威模式等待服务端状态，不再提交客户端骰面。

## 机器证据

- `npm run test:ludo-rule-core`：PASS。
- `npm run test:ludo-rule-authority`：PASS。
- `npm run test:protocol-version`：PASS。
- `npm run test:match-protocol-boundary`：PASS（既有 Gomoku/Tetris/Xiangqi/Monopoly 边界无回归）。
- `node qa/dom-smoke.js`：PASS。
- `npm run build`：PASS，确定性构建。
- 浏览器连接器、第二浏览器、真机、真实网络、真实 Supabase：`NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。

## 明确边界

本批不接入 GAME-031 确定性 Replay，不改变经济、AI 学习或美术资产；未执行 commit、push、Pages、Render 或生产数据写入。
