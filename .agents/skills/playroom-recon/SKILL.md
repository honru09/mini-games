# playroom-recon

## 目的

在任何大型修改前建立可复核的仓库事实，不修改文件。

## 必须读取

`AGENTS.md`、`README.md`、`HIGH_RISK_FILES.md`、`PROJECT_STATUS.json`、相关 requirements、最近提交和当前 `git status`。

## 必须检查

- dirty worktree、生成产物和源码来源；
- 最近活跃文件、共享文件和删除/迁移记录；
- 相关测试及其真实覆盖范围；
- 跨模块协议、账号、奖励、商城和 Supabase 依赖；
- 当前任务与既有未完成项的冲突。

## 输出格式

`Current State`、`Hot Files`、`Shared Files`、`Generated Files`、`Likely Conflicts`、`Existing Tests`、
`Relevant Requirements`、`Risk Level`。

## 禁止

侦察阶段禁止顺手改代码、安装未知依赖、删除用户改动或把自动化通过推断成实机通过。
