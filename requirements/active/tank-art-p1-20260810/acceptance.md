# Tank Art P1 验收

## 自动化与资产

- [x] 每个候选有 Prompt、模型、尺寸、哈希、许可、source/runtime/fallback 关系。
- [x] 候选仍为 reference-only，asset manifest 不新增未审批 integrated 项。
- [x] 资产库审计、manifest、Tabletop 回退、DOM 和 reduced-motion 合同通过（本地自动化；真机未执行）。

## 人工闸门

- [ ] 原创轮廓/构图人工清稿。
- [ ] Reviewer B 独立复核。
- [ ] IP Similarity Review 通过。
- [ ] 用户 Golden Set 决议后才允许另立 runtime 接入任务。

## 边界

- [x] 不改 Tank Controls、Authority、规则、协议、奖励、Supabase 或用户数据。
- [x] 未审批前不默认开启、不发布。
