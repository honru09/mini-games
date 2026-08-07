# 项目需求增补索引

| 追加时间 | 需求文档 | 状态 |
|---|---|---|
| 2026-08-07 16:53 | [对局奖励与成长系统需求增补](<./Mini Games 对局奖励与成长系统需求增补.md>) | v1.0 已实现并通过本地回归 |
| 2026-08-07 23:18 | [Playroom Social Graph v1 协议与安全边界](./SOCIAL_GRAPH_V1_PROTOCOL.md) | v1.0 已实现并通过本地自动化/浏览器验收；生产 Supabase 待凭证 |

## 状态说明

- 本目录中的增补文档是后续产品与技术实现的需求依据。
- 当前实现以 `server/reward-engine.js` 为唯一奖励数值与等级曲线来源，并已同步独立胜场、Supabase `apply_reward_v1` 单事务 RPC、服务端、客户端 Reward Breakdown、数据库 schema、测试、README 与白皮书。
- `qa/reward-system.js`、`qa/security-online.js`、`qa/supabase-adapter.js` 与 `qa/e2e-online.js` 覆盖需求文档第 26 节的关键验收项。
- `qa/social-graph.js`、`qa/supabase-schema.js` 与 `deliverables/visual-qa/` 覆盖 Social Graph 请求状态机、Block 绕过、Report 证据、Presence Privacy、RLS 定义与 UI 入口。
- 真实 Supabase Staging、JSON 迁移、事务并发、RLS 实连和备份/恢复仍需在提供 `service_role` 凭证后单独验收。
