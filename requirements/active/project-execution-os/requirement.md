# Playroom Project Execution OS

状态：`IMPLEMENTING`

## Goal

把研究报告中的 Project Skills、需求冻结、文件所有权、质量闸门、证据化验收、Motion System、Capability 状态和发布制度落地为仓库基础设施。

## IN

- 10 个项目级 Skill 规范与第三方 Skill 注册表。
- `PROJECT_STATUS.json`、`HIGH_RISK_FILES.md`、`MOTION_TOKENS.json`。
- 需求任务目录模板与当前任务状态记录。
- 静态状态校验、Recon、Quality Gates、Evidence Manifest 和 GitHub Pages state gate。
- README、AGENTS、WHITEPAPER 和三份中文日志同步。
- 副窗任务分支审阅、报告归档和融合简报。

## OUT

- 不迁移 React/Framer/GSAP。
- 不自动安装或执行未经审计的第三方 Skill。
- 不改变六款游戏规则、经济权威、账号权限或 WebSocket 数据契约。
- 不把未执行的真实设备、真实 Supabase 或真实网络验收标成完成。

## Non-negotiable

- 生成的 `public/index.html` 只能由 build 更新。
- HIGH 风险共享文件由 Master 集成。
- 没有证据的条目不能超过 `implemented`。
- 每次改动完成前更新三份中文日志。

## Expected UX

未来 Agent 能从项目内 Skill 和机器状态直接继承执行规则；用户可以从状态矩阵、简易报告和证据清单看到真实进展和未执行项。
