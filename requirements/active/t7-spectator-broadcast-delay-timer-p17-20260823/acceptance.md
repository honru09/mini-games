# T7-P17 本地验收

当前结论：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`。

## 已完成

- [x] 普通房间广播的观众延迟使用统一可取消 `ServerClockTimer` lease。
- [x] 每个房间维护有界 pending spectator delay 集合。
- [x] room reset/settle/leave 会取消普通广播、局内表达和房聊全部延迟 lease。
- [x] 回调继续校验观众连接仍存活且仍在当前房间。

## 专项证据

- [x] `node --check server/index.js`
- [x] `node qa/timer-audit.js`：普通广播 spectator lease 合同通过。
- [x] `node qa/social-match-contract.js`：通过。
- [x] `node qa/match-chat-contract.js`：通过。
- [x] `node --experimental-websocket qa/match-chat-online.js`：通过。
- [x] `node qa/progress-ledger.js`：242 requirements / 86 sources / 267 dependency edges 通过。
- [x] `npm run quality:gates`：通过。
- [x] 完整 `npm test`：退出码 0。

## 保留缺口

gameplay tick、transport deadline、真实 Supabase/RLS/并发/备份恢复、多实例、设备和真实网络仍未执行；本批不解除外部发布 Gate。

## 发布状态

`LOCAL_ONLY / NOT_RELEASED`。
