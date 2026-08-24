# 技术优化主线 T7：Tournament Lifecycle Timer P15 本地收口

- 日期：2026-08-23 14:31
- 阶段：CLOSE
- 需求归属：TECH-039、TECH-040、TECH-052（不新增 Requirement ID）
- 状态：`IMPLEMENTED_LOCAL / T7_PARTIAL / LOCAL_ONLY / NOT_RELEASED`

## 本批完成

1. 赛事 abort retry 改为按赛事 ID 隔离的 `ServerClockTimer` one-shot lease。
2. 赛事下一轮推进改为按赛事 ID 隔离的 `ServerClockTimer` one-shot lease。
3. finished、expired、declined、cancelled 清理路径统一撤销两类 lease。
4. lease 调度失败进入已有 quarantine recovery queue，并记录稳定 operational context。
5. 原有 retry backoff、赛事顺序、原子补偿、幂等和 wire 合同保持不变。

## 验证

- `node --check server/index.js`：通过
- `node qa/timer-audit.js`：通过，新增赛事 timer lease 合同通过
- `node qa/room-presence-boundary.js`：43 assertions 通过
- `node qa/tournament.js`：通过
- `node qa/tournament-auto-room.js`：通过
- `npm run test:tournament-auto-online`：自动赛事与原子补偿线上协议回归通过
- `node qa/progress-ledger.js`：242 requirements / 84 sources / 267 dependency edges 通过
- `npm run quality:gates`：通过
- 完整 `npm test`：退出码 0

## 边界

本批未修改赛事规则、奖励、UI、Supabase 或发布配置；真实生产 Supabase、多实例、设备、网络、gameplay tick、transport deadline 与 match-chat delay 仍按共享 Gate 保持待决。
