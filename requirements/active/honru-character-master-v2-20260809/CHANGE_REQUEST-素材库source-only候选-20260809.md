# Change Request：素材库 source-only 候选

## 触发原因

`asset-library/schema.json` 已允许资产状态 `reference-only`，但 `scripts/asset-library-audit.js` 仍把全部资产强制为 `integrated-local-only`，并要求所有非封面资产必须映射生产 Manifest。这会迫使未审核的 Honru v2 候选冒充运行时资产，违反本任务冻结边界。

## 变更

- `local-only` 审计允许 `integrated-local-only` 与 `reference-only`，两者都必须保持 `remoteObjectKey=null`。
- 只有 `integrated-local-only` 的非封面资产需要映射生产 Manifest。
- `reference-only` 资产单独要求 source、preview、runtimePaths 全部不进入 `public/`，且保持在 `art-source/`。

## 不变项

- Schema、远端存储状态、生产 Manifest、运行时路径和现有集成资产不改。
- source-only 不获得 runtime authority，不进入 `public/`，不表示人工/IP 通过。

## 验证与回滚

- 运行 `node scripts/asset-library-audit.js`、`npm run validate:project` 与 Quality Gates。
- 回滚本审计分支和 Honru v2 Catalog 条目即可；现有集成资产逻辑不受影响。
