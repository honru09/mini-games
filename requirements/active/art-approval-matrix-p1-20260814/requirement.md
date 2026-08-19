# Art Approval Matrix P1（2026-08-14）

状态：`REQUIREMENT_FROZEN`

## Goal

为既有 Ghost Game 美术候选建立统一可审计清除矩阵，明确 legacy fallback、source-only candidate、default-off technical preview、`OWNER_AUTHORIZED_ART_CLEARANCE` 与 external reference-only 的边界，既防止技术状态被误读为人工 Golden Set 批准，也防止可选咨询继续误阻塞原创资产施工。

## IN

- 复核既有 Catalog、Manifest、M0/Honru/Emoji/G Coins/Tank/ART-036/Avatar 与外部素材登记。
- 新增审批矩阵、候选状态定义、所有者清除顺序和后续可选人工证据格式。
- 为 TECH-031 / ART-028 / ART-030 追加治理级 QA，确保矩阵包含已知高风险候选、开放原创资产开发轨道并保留发布边界。

## OUT

- 不生成、编辑、清稿或接入任何图片、视频、音频、atlas、sprite、GLB 或 runtime asset。
- 不修改 Manifest、public/assets、前端、游戏规则、协议、奖励、商城、数据库、Render、GitHub Pages 或线上配置。
- 不代替自然人 Reviewer B、法务/IP 审查或用户 Golden Set 签字。

## Non-negotiable

- `GATE-ART-GOLDEN-SET` 为 `OPEN_BY_OWNER_AUTHORIZATION`；原创 Ghost-native 逐族满足 M0 North Star、稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚后，可取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并进入可逆 runtime 候选。
- 人工清稿、自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 仅为 `OPTIONAL_ADVISORY_EVIDENCE`；不得伪造 PASS，也不得再作为开发、runtime 或未来发布候选前置。
- 外部素材仍为 `reference-only / blocked-license`，不得复制、裁切、描摹、换色或作为生成输入。
- 对未审批候选，不得把 `TECHNICAL_PASS`、`ready`、`integrated-local-only` 写成生产美术通过。

## Expected UX

用户暂时看不到网页改变；得到的是后续审批和美术接入不会丢失、混淆或误上线的可追溯基础。
