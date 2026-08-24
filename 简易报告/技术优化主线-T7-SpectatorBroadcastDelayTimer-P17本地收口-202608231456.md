# 技术优化主线 T7：Spectator Broadcast Delay Timer P17 本地收口

- 日期：2026-08-23 14:56
- 阶段：CLOSE
- 需求归属：TECH-039、TECH-040、TECH-052、SOC-012、UI-035（不新增 Requirement ID）
- 状态：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## 本批完成

1. 普通房间广播的 spectator delay 改为可取消 `ServerClockTimer` lease。
2. 房间 reset/结束/离开时统一清理普通广播、局内表达和房聊延迟 lease。
3. 延迟回调继续检查观众连接存活和房间归属，保持原 wire 与顺序。

## 验证

- `node --check server/index.js`：通过
- `node qa/timer-audit.js`：通过
- `node qa/social-match-contract.js`：通过
- `node qa/match-chat-contract.js`：通过
- `node --experimental-websocket qa/match-chat-online.js`：通过
- `node qa/progress-ledger.js`：242 requirements / 86 sources / 267 dependency edges 通过
- `npm run quality:gates`：通过
- 完整 `npm test`：退出码 0

## 边界

gameplay tick、transport deadline、真实 Supabase、多实例、设备与真实网络仍保持待决；本批未发布线上。
