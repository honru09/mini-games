# Test Admin P0 — Recon

## Current State

- 当前发布基线为 `7fc6601`；工作树存在大量跨主线未提交变更，不能重置、覆盖或混入本批。
- 账号、会话、档案、商城、房间、结算、Replay、AI 学习、社交和赛事入口均集中在 `server/index.js`。
- 已有赛事管理员只由 `TOURNAMENT_ADMIN_UIDS` 环境变量授予，并仅在 `hello_ack.admin` 与 `tournament_recover` 使用；它不是安全的“无限资产”模型。
- 当前无测试管理员、无测试身份隔离，也没有可公开的管理员档案。

## Hot Files

- `server/index.js`：HIGH；认证、房间、商城、奖励、社交、Replay、AI、赛事。
- `server/gameplay/guards/index.js`：HIGH；赛事所有者/参与者约束。
- `scripts/render-env.js`：现有 Render 环境变量写入白名单尚不含测试管理员变量。

## Shared Files

- `server/index.js`、`server/gameplay/**`、`scripts/render-env.js`、`package.json`、文档与中央日志均由主负责人集成。
- `public/index.html` 是构建产物；本任务不直接修改前端或构建产物。

## Generated Files

- `public/index.html` 只能由 `node scripts/build.js` 生成；本任务的纯服务端模块不触发构建。

## Likely Conflicts

- `server/index.js`、`scripts/render-env.js` 和中央日志当前已脏，不能由子任务直接编辑。
- 现有 `TOURNAMENT_ADMIN_UIDS` 只能恢复赛事；若测试管理员要作为非参赛赛事创建者，需要主负责人对 `TournamentGuard` 做窄化兼容扩展。
- 当前 `normalizeOwned` 只认识固定五类资产；未来新增可购买类别必须显式接入测试管理员的目录投影，而不能以通配提权代替。

## Existing Tests

- `qa/security-online.js`：认证、档案伪造、商城、奖励、AI 及会话边界。
- `qa/tournament-recovery-online.js`：服务端赛事管理员恢复与正常赛事奖励隔离。
- `qa/game-cosmetic-profile.js`、`qa/supabase-adapter.js`、`qa/e2e-online.js`：外观、持久化适配与联机回归。

## Relevant Requirements

- 账号/密码和服务端权威边界：`AGENTS.md` 第 5 节。
- 安全检查：`.agents/skills/playroom-security/SKILL.md`。
- 高风险集成流程：`HIGH_RISK_FILES.md` 与 `requirements/OWNERSHIP_MATRIX.json`。

## Risk Level

**HIGH**：若把配置、权限或虚拟资产错误投影到普通账号，会造成可伪造经济/权限或污染正式数据。因此本批采用环境绑定、固定能力白名单、纯虚拟权益和默认隔离；共享入口仅通过主负责人集成。
