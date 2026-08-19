# Supabase GATE-SUPABASE-PRODUCTION 生产环境指南

本指南为 Ghost Game 的 Supabase 生产环境准备与验收提供了完整的端到端说明。
所有步骤均为了满足 `MAINLINE_CONTROL_ROUTING.json` 中定义的多实例与持久化要求。

> 当前状态：`NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`。本指南是待执行手册，不是完成证明；下面所有清单默认未勾选。缺少真实凭证时只运行本地静态/fake 回归，不连接、不写入，也不得把 OpenAPI surface 预检冒充生产表/RPC、RLS、并发、幂等、备份、恢复、回滚或多实例 PASS。

## 1. 创建正式 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard/projects)。
2. 点击 **New Project**。
3. 选择你的组织（Organization），并为项目命名（推荐 `mini-games-prod`）。
4. 设置一个**高强度的数据库密码**，将其妥善保存在安全的密码管理器中，切勿随处粘贴。
5. 选择离你的 Render 服务最近的区域（如 `Tokyo (ap-northeast-1)` 或 `Singapore (ap-southeast-1)`）。
6. 点击 **Create new project** 并等待项目初始化完毕。

## 2. 获取必要凭证

在项目初始化完成后，你需要获取以下凭证以用于配置：

*   **Project URL**: 进入 `Settings` -> `API`。复制 `Project URL` (形如 `https://[project-ref].supabase.co`)。
*   **Service Role Key**: 在同一页面的 `Project API keys` 部分，复制 `service_role` secret (以 `sb_secret_` 开头)。**注意：此密钥极度敏感，可绕过 RLS 权限，仅限服务端使用。**
*   **Database URI**: 进入 `Settings` -> `Database`。在 `Connection string` -> `URI` 中，选择 **Session pooler** (端口 5432) 并复制连接字符串。

## 3. 设置后端环境变量 (Render)

使用项目中提供的 `scripts/render-env.js` 工具（或手动在 Render 控制台）配置生产环境变量：

```powershell
$env:RENDER_KEY='rnd_xxx' # 你的 Render API Key
$env:SUPABASE_URL='https://[project-ref].supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY='sb_secret_...' # 仅服务端 service_role secret；旧 SUPABASE_KEY 仍兼容但同样只能服务端使用
$env:ENABLE_CLUSTER_COORDINATION='0' # 默认关闭；也可以不设置
node scripts/render-env.js
```

在真实 `production-acceptance.sql`、加密备份、隔离恢复、非破坏回滚和双实例/多实例证据全部完成并由主代理复核前，`ENABLE_CLUSTER_COORDINATION` 必须保持 `0`（或未设置）；本地 OpenAPI 预检、fake Adapter 和单实例状态不能授权把它改为 `1`。

## 4. 执行生产迁移与验证 (Schema Migration)

系统配备了一个强大的生产向导与运维 PowerShell 脚本，它整合了加密备份、迁移和回滚。

运行向导脚本（交互式）：
```powershell
powershell -ExecutionPolicy Bypass -File scripts/supabase-production-wizard.ps1
```
按照向导的步骤输入你的 Project URL、Service Role Key 和 PostgreSQL URI。

向导会在后台执行：
1. 验证 Schema 合同 (调用 `qa/supabase-schema.js`)
2. 执行 Dry-run 模拟
3. 进行初始备份
4. 运行 `supabase/schema.sql` 完成数据库结构构建
5. 运行 `supabase/production-acceptance.sql` 以验证所有表权限（RLS）以及集群 RPC 是否准备就绪

## 5. 多实例与恢复演练测试

生产门禁要求证明不仅可以备份，还能隔离恢复。向导会提示你输入一个作为“恢复演练目标”的备用空白 Supabase 项目的 URI。

一旦验证，系统会自动将正式库的数据（即使是空状态）导出，并向演练目标库执行 `pg_restore`，随后在目标库执行生产验收脚本，确保**恢复操作绝对可靠**。

如果在未来需要进行**非破坏性回滚**（如遇到生产事故仅停用多实例集群功能而不删减用户数据），可运行：
```powershell
$env:NON_DESTRUCTIVE_ROLLBACK_CONFIRM='REVOKE_CLUSTER_RPC_ONLY'
powershell -ExecutionPolicy Bypass -File scripts/supabase-production-ops.ps1 -Action rollback -Execute
```

## 6. 运行 fail-closed 预检与真实验收

`supabase-gate-checklist.js` 现在只做只读 OpenAPI surface discovery。它只向严格校验过的 `https://<project-ref>.supabase.co/rest/v1/` 发一个 HTTP `GET`，绝不调用 RPC、提交空参数、执行迁移或写入生产；响应正文不会写入证据，异常也会脱敏。没有真实凭证时输出 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`；即使 OpenAPI 文档包含全部预期表路径和 RPC `POST` 路径，也只输出开发预检 `PRECHECK_PASS_RELEASE_EVIDENCE_PENDING`，`overallPass` 永远为 `false`。它不会把任意非 404、路径探测或两个相同的无效 400 响应冒充表/RPC、RLS、并发或幂等证据。

退出码也保持 fail-closed：

- `0`：只表示本地 OpenAPI 开发预检完成，生产发布证据仍为 `RELEASE_EVIDENCE_PENDING`；
- `2`：缺少或未配置合法的 server-only 凭证，结果为 `NOT_EXECUTED`，不会发请求；
- `1`：已配置凭证但预检请求/响应不合约，结果为 `PRECHECK_FAILED`，不会产生生产结论。

URL 必须是无路径、无端口（默认 443）、无 query/hash、无用户信息的 Supabase project origin；任意其他 HTTPS 主机、内网地址或自定义路径都会在本地 fail-closed。

```powershell
node scripts/supabase-gate-checklist.js
```

该预检只会：
- 确认 server-only 环境变量存在且 URL 是合法 Supabase project origin；
- 要求 `/rest/v1/` 返回 HTTP 200、正确 Content-Type、合法 OpenAPI 2/3 JSON；
- 从 OpenAPI schema 发现预期表、并要求 RPC 具备文档化的 `POST` operation（仅开发预检，不是权限/存在性证明）；
- 把 RLS、有效事务幂等/并发、备份、恢复、回滚和多实例全部保持 `NOT_EXECUTED`。

真实 Gate 证据必须分别来自：

1. `scripts/supabase-production-ops.ps1 -Action acceptance -Execute` 对 `supabase/production-acceptance.sql` 的数据库角色/RLS/租约/游标事务内验收；
2. `backup` 产生的受限 ACL 且实际加密、可由 `pg_restore --list` 读取的 `.dump`；
3. 不同 Supabase project ref 的 `restore-drill` 隔离恢复；
4. `rollback` 的非破坏回滚证据；
5. 有效、唯一 QA 事务身份下的真实并发与幂等终态，以及双实例租约/PubSub/单写者验证。

这些证据没有全部生成、脱敏、绑定项目/时间并复核前，`GATE-SUPABASE-PRODUCTION` 的发布状态始终是 `RELEASE_EVIDENCE_PENDING`。开发通道保持开放，但不得开启 Cluster 或宣称生产一致性。

## 7. GATE-SUPABASE-PRODUCTION 清单回顾

- [ ] 建立独立的 Supabase 生产实例并记录脱敏 project identity。
- [ ] 正确挂载 `schema.sql`，且只读 OpenAPI 预检无缺项。
- [ ] 执行 `production-acceptance.sql` 且通过真实数据库角色/RLS/越权阻断测试。
- [ ] 使用有效唯一 QA 身份完成真实 RPC 幂等与并发验收；无效 400 或存在性探测不计证据。
- [ ] 成功执行至少一次受限 ACL 且实际加密的备份，生成可验证 `.dump`。
- [ ] 在不同 project ref 的隔离目标库完成 `pg_restore` 恢复演练。
- [ ] 完成非破坏回滚与双实例租约/PubSub/单写者验收。
- [ ] 汇总全部原始证据后由主代理复核；仍需当前用户明确发布命令。
