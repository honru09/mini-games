# 项目需求增补索引

| 追加时间 | 需求文档 | 状态 |
|---|---|---|
| 2026-08-07 16:53 | [对局奖励与成长系统需求增补](<./Mini Games 对局奖励与成长系统需求增补.md>) | v1.0 已实现并通过本地回归 |
| 2026-08-07 | [Gameplay Authority Matrix](./AUTHORITY_MATRIX.md) | 第三阶段最终代码口径 |
| 2026-08-07 | [Gameplay Protocol Registry](./PROTOCOL_REGISTRY.md) | v1/v2 能力、错误码与兼容合同 |
| 2026-08-07 | [Gameplay Cosmetic Profile V1](./GAME_COSMETIC_PROFILE_V1.md) | 已接入并通过自动化回归 |

## 状态说明

- 本目录中的增补文档是后续产品与技术实现的需求依据。
- 当前实现以 `server/reward-engine.js` 为唯一奖励数值与等级曲线来源，并已同步独立胜场、Supabase `apply_reward_v1` 单事务 RPC、服务端、客户端 Reward Breakdown、数据库 schema、测试、README 与白皮书。
- `qa/reward-system.js`、`qa/security-online.js`、`qa/supabase-adapter.js` 与 `qa/e2e-online.js` 覆盖需求文档第 26 节的关键验收项。
- 真实 Supabase 迁移与生产环境经济指标观察仍需在提供 `service_role` 凭证后单独验收。
- `gameplay-v2-audit.md` 与 `gameplay-v2-protocol-design.md` 是第二阶段历史基线；第三阶段当前事实以 Authority Matrix、Protocol Registry 和最终报告为准。
