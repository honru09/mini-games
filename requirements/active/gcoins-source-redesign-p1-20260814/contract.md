# G Coins Source Redesign P1 合同

- 原子需求：沿用 `ART-026`，不新增 Requirement ID。
- 选中候选：`ART-026-GCOINS-P1-CANDIDATE-B`。
- 源稿状态：`reference-only / source-only`（保留在 `art-source/`，不直接作为生产资源）。
- runtime 状态：`OWNER_AUTHORIZED_ART_CLEARANCE`、本地可逆 `default-on`，稳定运行时 ID 为 `P-GCOINS-ICON-V1`，feature flag 为 `mg_art_gcoins_p1_v1`。
- P0 `ART-026-GCOINS-SOURCE-CHROMA-V1` 与生产 `P-003` 必须保留。
- 允许派生：仅 `art-source/` 中 Alpha、192/96/64/44px 与审查板。
- 禁止越权：未经稳定 ID/SHA/provenance、机器技术/视觉/相似风险、fallback、feature flag 与回滚合同，不得进入 `public/assets`、Manifest、商城默认项或线上资源；本批已具备合同的派生文件可进入本地 runtime 候选。
- 回滚：删除 P1 active task、P1 Catalog 条目、P1 source-only 目录和本批报告/日志条目；不得删除 P0 或生产 fallback。

> 历史裁决（historical-as-of，2026-08-14）：原“candidate-only/default-off/禁止 public Manifest”只适用于未取得所有者清除的阶段。当前人工清稿、Reviewer B、IP/法律意见与 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE`，不构成开发阻塞；外部受限素材政策不变。
