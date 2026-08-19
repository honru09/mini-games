# Playroom Project Execution OS

本目录是 Playroom 的项目级执行制度。它不是第三方脚本集合，而是未来 Agent 必须遵守的可审计工作流。

## 强制生命周期

```text
DRAFT → REQUIREMENT_FROZEN → PLANNED → IMPLEMENTING → VERIFYING → ACCEPTED
```

需求变化必须显式进入 `CHANGE_REQUEST`，不能在实现中默默扩大范围。

## 任务前置

1. 读取根目录 `AGENTS.md`、`README.md`、`HIGH_RISK_FILES.md`、`PROJECT_STATUS.json`。
2. 运行 `node scripts/project-recon.js --check`，只读确认 dirty worktree、生成文件、热文件和高风险共享文件。
3. 在 `requirements/active/<task>/` 建立 `requirement.md`、`plan.json`、`ownership.json`、`execution.json`、`acceptance.md`。
4. 跨模块修改先冻结数据/协议契约，再实现消费者。
5. 每个任务声明 `IN`、`OUT`、`OWNED_FILES`、`SHARED_DEPENDENCIES`、`FORBIDDEN_FILES`。

## 角色与所有权

- Builder：只修改 ownership.json 中明确拥有的文件。
- Reviewer：独立检查架构、协议、安全和范围，不替 Builder 宣布通过。
- QA：运行目标测试、浏览器/视觉检查并记录证据。
- Master：处理共享高风险文件、集成、最终回归和发布。

共享文件（例如 `server/index.js`、`scripts/build.js`、游戏注册表）需要先写
`SHARED_CHANGE_REQUEST`，再由 Master 集成。

## 完成声明

任何任务都必须提供：Changed Files、Tests、Visual/Manual QA、Not Executed、Known Issues、Evidence。
没有证据的条目只能是 `implemented`，不能写成 `verified` 或 `production-ready`。

真实设备、真实 Supabase、真实网络整形未执行时必须写 `NOT_EXECUTED`，不得用桌面自动化冒充。

## 质量闸门

发布前依次通过：Syntax、Static Rules、Unit/Gameplay、Protocol、Security、Reconnect、DOM、E2E、
Visual Smoke、Build Drift、Docs/Assets/Status Sync。配置见 `requirements/QUALITY_GATES.json`。

## 项目级 Skills

见 `.agents/skills/`。第三方 Skill 使用 `REFERENCE → PILOT → APPROVED` 生命周期，安全问题标 `BLOCKED`；未经仓库、许可、脚本、网络、破坏性命令与密钥边界审计不得进入 `PILOT/APPROVED`。当前 GreenSock 官方 GSAP skills 已审计并登记为 `APPROVED`。
