# G Coins Source Redesign P1（2026-08-14）

状态：`OWNER_AUTHORIZED_ART_CLEARANCE_LOCAL_RUNTIME`（原始 Candidate B 源稿仍为 `reference-only`；派生 runtime 为可逆、default-on 的本地候选）

> 当前裁决（2026-08-17）：原先“source-only/default-off/等待人工或 Golden Set”的表述仅保留为 `historical-as-of` 审计记录。项目所有者已授权原创 Ghost-native 资产按 `OWNER_AUTHORIZED_ART_CLEARANCE` 轨道继续开发；人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`，不阻塞开发或 runtime。外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材仍永久禁止进入 runtime。

## Goal

在不覆盖 P0、不改变经济/协议/运行时的前提下，为 `ART-026` 生成多个最高质量 Ghost-native G Coins 候选，选出一个可供机器技术/视觉/相似风险审查与逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE` 的 source-only 技术首选；人工清稿与 Golden Set 仅保留为可选咨询。

## IN

- 只使用项目自有 Honru 身份锚点。
- 内置最高质量 ImageGen 每次一个候选，保留完整 Prompt、任务标识和 SHA。
- 对技术首选执行色键抠图、44/64/96/192px 派生、light/dark/checker 可读性与绿色污染检查。
- 同步 Catalog、审批矩阵、ART-026、项目状态、简报和三日志。

## OUT

- 不修改经济、协议、商城价格/余额、Supabase 或线上发布；在取得本批所有者清除合同后，允许将稳定 ID 的派生文件镜像到 `public/assets`/Manifest，并保留 P-003 回退。
- 不把机器抠图写成人工清稿，不把 Reviewer A 写成 Reviewer B；可选咨询仍不得伪造成 PASS。
- 不使用外部素材作为生成输入，不复制、裁切、描摹或换色外部资产。

## Expected UX

当前批次保留 Candidate B 源稿与完整 provenance，同时已形成一套可审计、可回滚、在 44px 仍可识别的本地 G Coins runtime 派生包。runtime 仅通过 Manifest、feature flag 与 P-003 fallback 接入，不改变经济事实或发布状态。

## 历史裁决（historical-as-of）

2026-08-14 的 `REQUIREMENT_FROZEN`、`source-only`、`default-off` 与“人工 Gate 阻塞”只代表候选生成阶段；当前所有者清除和 runtime 证据以本目录的 `OWNER_AUTHORIZED_ART_CLEARANCE-20260816.md`、Manifest 与专项 QA 为准。
