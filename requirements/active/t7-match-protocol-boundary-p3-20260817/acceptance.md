# T7 Match Protocol Boundary P3 验收

状态：`VERIFIED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

## 已完成

- [x] Tetris/Xiangqi/Monopoly action 与 timer transition 共用 `command/transition` seam。
- [x] JSON runtime 与 isolated memory/runtime Adapter 具备 detached `load/save/commit` 状态合同。
- [x] match/generation/authority/member/session/seq/revision fences 与错误净化。
- [x] effect 预校验、固定顺序、terminal 幂等、late timeout 防重复。
- [x] Adapter/Authority/local persistence fault 的 room 与 Authority checkpoint 回滚。
- [x] server/index 真人、AI v2 action 和三套 v2 timer transition 接线；legacy fallback 保留。

## 本地验证

- `node qa/match-protocol-boundary.js`：`MATCH_PROTOCOL_BOUNDARY_ALL_PASS assertions=21`。
- `npm run test:match-protocol-boundary`：通过（含 node syntax check）。
- `npm run test:technical-optimization-t7`：Metrics/Auth/Profile/Room/Presence/Isolation 全部通过（Room/Presence 43 项）。
- `node --experimental-websocket qa/rule-authority-online.js`、`qa/reconnect-online.js`、`qa/e2e-online.js`、`qa/tournament-auto-online.js`、`qa/security-online.js`：通过。
- `node --experimental-websocket qa/tetris-protocol-fallback-online.js`：通过，`TETRIS_GUIDELINE_SCORING=0` 回退保持兼容。
- `node --check server/boundaries/match-protocol.js`、`node --check server/index.js`、`git diff --check`：通过。

## 未执行 / 发布边界

第二浏览器、Android/iPhone/Tablet、真实网络整形、真实 Supabase 迁移/RLS/备份/隔离恢复/回滚、多实例、人工美术咨询、commit/push/Pages/Render/生产发布均为 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。

T7 总体仍为 `partial`；下一序列是 Chat/Playline，再是 Reward/Economy。Node 子进程 wall-clock/module-cache/env 的 fresh-child 窄合同已由 `IsolatedNodeProcess`/双 lane probe 本地验证；server 全局 clock/Timer 虚拟化仍未完成。
