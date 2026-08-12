# Honru Pixel Avatar v3 · 审批状态

| 门禁 | 状态 | 说明 |
|---|---|---|
| Prompt / provenance | `verified` | 已从本地 session 记录恢复并固定文件哈希 |
| Reviewer A 技术检查 | `implemented` | 尺寸、色彩模式、Alpha 四角与 source-only 边界已自动化 |
| 人工清稿 | `not_executed` | 需要逐点修正轮廓、halo、配饰和小尺寸毛刺 |
| Reviewer B | `not_executed` | 需要独立自然人复核轮廓、Pose、来源和一致性 |
| IP Similarity Review | `not_executed` | 需要与第三方/历史素材做相似性审查 |
| Golden Set | `not_executed` | 需要用户选择最终四件候选并签字 |
| 运行时矩阵 | `not_executed` | 44/64/96/192px、昼夜主题、移动端与 reduced-motion 未复核 |
| Manifest / Catalog / 默认头像 | `blocked` | 审批完成前禁止进入生产机器事实源 |

当前允许范围：source tree、技术 QA、素材库 provenance。当前禁止范围：`public/assets`、`asset_manifest.json`、`PLAYROOM_AVATARS` 默认 ID、商城价格/owned、Profile/Room runtime 与线上发布。
