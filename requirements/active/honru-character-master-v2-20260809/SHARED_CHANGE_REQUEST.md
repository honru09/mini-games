# Shared Change Request：Honru v2 素材库登记

## 共享文件

- `asset-library/catalog.json`：新增一个 `reference-only` Honru v2 生成候选及 Prompt/hash/Alpha 派生路径。
- `scripts/asset-library-audit.js`：补齐 Schema 已允许但审计器尚未实现的 source-only 分支。

## 消费者与兼容

- 生产 `asset_manifest.json`、前端、服务端、商城、账号和游戏均不消费此条目。
- 既有 `integrated-local-only` 资产继续要求与生产 Manifest 对齐。

## 失败与回滚

- 任一路径越界、文件/hash/尺寸不符、远端键非空或 reference-only 指向 `public/` 都必须失败。
- 删除新 Catalog 条目并回滚审计器的 reference-only 分支即可恢复；Honru v1 与线上 SVG 不变。
