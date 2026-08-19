# Requirements Governance P0 合同

本批没有运行时消息或数据协议变更。

- 机器事实源：`requirements/PRODUCT_REQUIREMENTS_LEDGER.json`。
- 唯一性：一个原子需求只有一个 ID 和一个分类；跨领域只使用 `related`。
- 追溯：每个 `source` 必须存在于 `sourceCatalog`，每个需求必须至少属于一个 `requestCoverage` 组。
- 状态：只使用 `verified / implemented / partial / planned / not_executed / blocked`。
- 替代：新需求与旧需求冲突时保留旧 ID 和历史，更新 `next/phase/related` 记录新裁决，不物理删除历史要求。
- 报告：七份报告只能由生成器覆盖；报告日期来自 ledger `snapshotDate`。
- 发布：本批终态为 `LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`，不得触发任何线上状态变化。
