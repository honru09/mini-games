# Project Execution OS Contract

本任务不新增游戏协议。它新增的是 Agent/质量治理契约：

- 状态：`DRAFT → REQUIREMENT_FROZEN → PLANNED → IMPLEMENTING → VERIFYING → ACCEPTED`。
- 所有权：`requirements/OWNERSHIP_MATRIX.json`；HIGH 文件由 Master 集成。
- 证据：测试、浏览器/视觉、手工和 NOT_EXECUTED 均写入 acceptance/evidence。
- 生成物：`public/index-template.html + public/src/** → scripts/build.js → public/index.html`。
- 发布：先 secret/staged diff 审计，再 GitHub push 和 Render 手动部署；key 只能由环境变量注入。
