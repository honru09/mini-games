# Requirements Governance P0 验收

## 台账与追溯

- [x] 长需求的每个原子要求均映射到既有或新增唯一 ID。
- [x] 新增来源入口、请求覆盖组、依赖图通过机器检查，无未知来源、孤儿 ID 或依赖环。
- [x] 已完成、部分完成、计划、受阻与未执行的状态不被夸大。

## 白皮书与报告

- [x] 白皮书写入产品核心排序、约 10% Ghost Game 差异化、赛事隐藏裁决与长期全球地区目录。
- [x] 七份 2026-08-10 进度报告由生成器确定性生成，第二次运行 `changed=0`。
- [x] 历史一次性报告已归档但未删除，所有受影响链接与 sourceCatalog 已更新。
- [x] 当前入口只突出总进度、六分类进度和最新本地收口。

## 边界与验证

- [x] 没有修改运行时代码、规则、协议、奖励、Supabase 或美术资产。
- [x] `npm run test:progress-ledger` 已通过；`quality:gates` 与 `git diff --check` 将与紧接的 UI Repair P0.1 一并运行。
- [x] 三份中文简易日志已与连续 UI Repair P0.1 一并更新。
- [x] 未 commit、push 或部署。

## Known Issues

- 长期愿景只登记架构方向，不代表已进入开发或发布日期承诺。
- 人工美术审批、真实设备和真实 Supabase 继续保持 blocked/not_executed。

## Rollback

按 `plan.json` 的回滚说明恢复台账和生成器；归档报告根据归档清单原路移回。
