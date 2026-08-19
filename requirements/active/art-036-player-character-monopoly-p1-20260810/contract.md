# ART-036 Source Contract v1

## 稳定标识

- 批次：`art-036-player-character-monopoly-p1-20260810`
- 状态：`reference-only`
- 运行时权威仍为 `public/assets/manifests/asset_manifest.json`；本批 source manifest 不能替代它。
- Player Character 只消费 `player-character-v1` 的公开 slot ID；美术文件不改变 slot schema。

## 必备文件

- `PROMPT_AND_PROVENANCE.md`
- `ART_REVIEW_CHECKLIST.md`
- 角色方向板、Monopoly 实体棋盘方向板、拒绝候选（如有）
- 素材库条目：来源、许可、sourcePath、sourceSha256、previewPath、promptPath、model、状态、远端键为空

## 表现约束

- 角色最多 Base + Shade + Highlight，左上主光、右下接触影；不使用塑料 PBR、过度 Bloom、伪文字或无意义粒子。
- 玩家角色、Honru、Logo、Avatar、Frame、Background 和 NameFx 的身份层分离。
- 任何资源失败时只回退程序化角色/既有 Monopoly 表现，不影响规则、位置、奖励、Replay 或联机协议。

## 审批状态

`technical_draft → manual_cleanup_pending → reviewer_b_pending → ip_review_pending → golden_set_pending → approved_runtime_candidate`

本批最高只允许 `manual_cleanup_pending`，未完成自然人审查前不可进入 `approved_runtime_candidate`。
