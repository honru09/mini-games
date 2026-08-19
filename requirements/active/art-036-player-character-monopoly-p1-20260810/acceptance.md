# ART-036 验收

- [x] source-only 角色与大富翁实体方向板生成并有逐字 Prompt/provenance。
- [x] 角色四/八向表现约束、实体格子/建筑/机会卡/道具方向和 fallback 清晰可审计。
- [x] 素材库条目为 `reference-only`，source/preview 哈希、许可、远端键和路径审计通过。
- [x] 生产 Manifest、public/assets、角色 schema、商城、Monopoly Authority/规则均未改变。
- [ ] 当前两张方向板仍未取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，不能宣称 ART-036 runtime/产品完成；先补齐稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险、runtime 派生、Manifest/预算、fallback、feature flag 与回滚。
- [ ] 取得逐族 `OWNER_AUTHORIZED_ART_CLEARANCE` 后，可进入可逆 default-on runtime 候选；人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，缺失不得阻塞开发，也不得伪造成 PASS。
- [x] 外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁用；设备/网络/Supabase 只保留 `RELEASE_EVIDENCE_PENDING`，发布须当前用户明确命令。

Historical-as-of（2026-08-10）：旧验收把人工清稿、Reviewer B、IP Review 与 Golden Set 完成作为 runtime 前置；该 candidate-only/default-off 顺序只作历史记录。
