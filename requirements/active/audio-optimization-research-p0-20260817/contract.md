# Audio Research Contract

## Scope and authority

本批是研究与治理批次，不新增玩家能力。音频属于 presentation seam；Rule、Authority、Protocol、Replay、Reward、AI、Economy、Social 和持久化不消费音频对象或供应商数据。

## Third-party skill lifecycle

五个来源均登记为 REFERENCE。只有完成仓库、许可、脚本、网络、破坏性命令和密钥审计后，才可进入 PILOT；本批没有升级任何来源。

## Proposed next seam

FeedbackBus 负责固定 cue vocabulary、stable id、强度、pan、去重、频控和生命周期；未来 UnifiedFeedbackAdapter 负责 AudioContext、asset buffer、procedural fallback、master/SFX/music/haptic gain、voice budget、decode、hidden/reduced-motion、unlock 和 dispose。游戏 caller 不直接创建 AudioContext 或调用第三方 SDK。

## Compatibility and rollback

旧 sfx()/haptic() shim 需在未来实现批次保留一轮；任何候选资产失败、许可撤回、codec/AudioContext/StereoPanner 不可用时，立即回退 procedural WebAudio。无需修改 wire、Rule、Authority、Reward 或 Replay。

## Privacy

cue 只允许稳定事件 ID、数值强度、pan 和本地生命周期字段；不得包含聊天正文、昵称、URL、prompt、token、奖励数值或原始输入轨迹。
