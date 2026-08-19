# DATA Preflight Contract

## IN

- 检查环境变量是否存在，只记录布尔状态，不读取或输出值。
- 验证 PostgreSQL 客户端、默认 dry-run、Schema/Production Readiness/fake Adapter 合同。
- 修复 `restore-drill` 的 project-ref 隔离缺陷并加入回归。
- 同步现有十项 Requirement、共享 Gate、状态、简报与三日志。

## OUT

- 不连接真实 Supabase，不执行备份、迁移、acceptance、恢复、回滚或并发写入。
- 不启用 `ENABLE_CLUSTER_COORDINATION`，不修改 Render 环境，不提交、推送或部署。
- 不新增产品能力、协议、数据表、经济数值、UI 或美术资产。
- fake PostgREST、静态 SQL、dry-run 和本地 QA 只记为 `LOCAL_STATIC_OR_FAKE_ONLY`，不得解除生产 Gate。

## 安全边界

- 恢复演练源与目标必须属于不同 Supabase project ref；同项目即使数据库名不同也必须 fail-closed。
- 真实执行必须先具备可验证加密备份位置、受控生产直连、独立隔离项目和显式确认。
- 任何连接串、secret、账号、正文或原始数据库响应都不得进入仓库、日志或报告。
