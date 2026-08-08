# 协议与安全契约

## Replay v1.1

- `replay_list` 只返回参与者自己的回放，或已到 `publicAt` 的公开房回放。
- `replay_share` 只允许原对局参与者创建有时限的随机分享令牌；令牌不得进入公开列表或分析事件。
- `replay_get` 可接收 `replayId` 或 `shareToken`；私密房仍不得通过原始 `replayId` 被非参与者读取。
- 回放保留 7 天；公开房默认延迟 5 分钟；分享令牌不晚于回放过期。

## Tournament v1.1

- `tournament_forfeit`：参赛者只能判负自己；赛事管理员可明确指定该桌参赛者。
- `tournament_recover`：仅赛事管理员，必须明确指定被判负 uid，不再静默选择“第一个连接”。
- 两条路径都只处理已绑定、进行中、未结算的真实赛事房，并继续由服务端写入赛事结果。
- 赛事积分与金币、XP、普通胜场流水保持分离。

## Metrics v2

- `/api/metrics`、`/api/metrics/history`、`/api/metrics/export` 全部要求 `METRICS_ADMIN_TOKEN` Bearer 鉴权并限频。
- 历史只保存脱敏数值快照；CSV 不含账号、PIN、session、Profile、IP 或原始局面。
- 错误闭环只保存上下文枚举、错误类别、计数和时间；不保存错误消息、堆栈、请求体或密钥。
- 告警由服务端阈值计算，页面只展示结果，不在前端推断敏感原始数据。
- 管理页面不嵌入、不持久化管理令牌；令牌只保存在当前页面内存。

## Compatibility

- 新消息均为向后兼容增量；旧客户端仍可使用原 Replay 观看与赛事自动结果路径。
- 未设置管理令牌时 Metrics API 返回 503，不向普通用户降级开放。
