# Tank Art P1 验收

## 自动化与资产

- [x] 每个候选有 Prompt、模型、尺寸、哈希、许可、source/runtime/fallback 关系。
- [x] 当前候选仍为 reference-only，asset manifest 不新增未取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 的 integrated 项。
- [x] 资产库审计、manifest、Tabletop 回退、DOM 和 reduced-motion 合同通过（本地自动化；真机未执行）。

## Owner-clearance 准入

- [ ] 补齐稳定 runtime ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、透明/尺寸派生、fallback、feature flag 与回滚。
- [ ] 形成逐族 `OWNER_AUTHORIZED_ART_CLEARANCE` 后，另立可逆 default-on runtime 接入与机器/浏览器验证。
- [ ] 第二浏览器、真机、真实网络与低端性能保持 `RELEASE_EVIDENCE_PENDING`；发布须当前用户明确命令。

## 可选咨询

- [ ] 人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`；缺失不得阻塞开发或 runtime，也不得伪造成 PASS。
- [x] 外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁用。

## 边界

- [x] 不改 Tank Controls、Authority、规则、协议、奖励、Supabase 或用户数据。
- [x] 未取得 owner clearance 的当前候选不默认开启；取得 clearance 后只允许可逆 default-on。任何状态均不自行授权发布。

Historical-as-of（2026-08-10）：旧验收把人工清稿、Reviewer B、IP Review 与 Golden Set 列为 runtime 前置；该 candidate-only/default-off 顺序仅保留为历史，不覆盖当前 owner-clearance 政策。
