# playroom-plan

## 目的

把需求转为冻结范围和可验收的原子计划；规划阶段只读。

## 必须产出

在 `requirements/active/<task>/` 写入 `requirement.md`、`plan.json`、`ownership.json`、`execution.json`、`acceptance.md`。

`requirement.md` 必须包含 Goal、IN、OUT、Non-negotiable、Known Existing Behavior、Expected UX。
`plan.json` 必须列出依赖顺序、风险、测试和回滚点；`ownership.json` 必须列出 owned/shared/forbidden 文件。

## 状态规则

开始施工前必须是 `REQUIREMENT_FROZEN`；需求变化进入 `CHANGE_REQUEST`，重新规划后才能继续。

跨模块任务先冻结 `contract.md`（字段、消息、Authority、幂等、重连和失败行为）。

## 禁止

不能一边侦察一边实现，不能让子任务自行扩大范围，不能将共享文件默认为可并行编辑。
