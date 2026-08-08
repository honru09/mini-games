# Shared Change Request

## 高风险文件

- `server/index.js`
- `server/gameplay/metrics.js`
- `public/src/online/03-websocket.js`
- `public/index.html`（仅由 `scripts/build.js` 生成）

## 字段与消息

- Replay 增补：`publicAt`、`shareTokenHash`、`shareExpiresAt`，消息 `replay_share` / `replay_shared`。
- Tournament 增补：`tournament_forfeit` / `tournament_forfeited`，`tournament_recover` 增加必填 `targetUid`。
- Metrics 增补：版本化历史快照、alerts、ops incidents、CSV 导出。

## 消费者

- 服务端房间/赛事/审计存储。
- WebSocket 前端消息分派、Replay 与 Tournament UI。
- 管理员静态仪表盘。
- QA、README、PROJECT_STATUS、交接报告和白皮书。

## 回滚点

- Replay 新字段缺失时按旧记录处理：参与者可见，公开记录按创建时间计算延迟。
- Tournament 新消息不替换自动房间权威结算。
- Metrics v2 可通过移除新增路由退回原 `/api/metrics` 单快照；管理令牌边界不降级。

## 验证

- `qa/replay-sharing.js`
- `qa/tournament-recovery-online.js`
- `qa/metrics-online.js`
- `npm test`
- `npm run validate:project`
- `npm run quality:gates`
