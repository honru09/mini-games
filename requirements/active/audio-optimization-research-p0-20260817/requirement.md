# Audio Optimization Research P0

状态：ACCEPTED

## Goal

盘点 Ghost Game 全部可用音效板块，安装并审计用户指定的第三方音频 skills，形成不越过 Rule/Authority/Protocol/Reward/Replay/许可/发布 Gate 的下一步音效优化方案。

## IN

- 六款游戏、平台 Shell、房间/Presence、社交、Shop/Profile、Reward/Progression、PWA 生命周期的音效事件地图。
- 旧 WebAudio、FeedbackBus、Tank LocalFeedbackAdapter、设置、构建、Manifest 与 QA 证据审计。
- game-creator audio skills、AudioCraft/Hermes、fal.ai media、ElevenLabs sound-effects 的安装、调用前置条件、许可和 fallback 分工。
- GAME-037/GAME-038 Acceptance Gap 与 GAME-040/TECH-029/TECH-033/TECH-049 关联建议。

## OUT

- 不生成或提交音频文件。
- 不修改运行时代码、规则、协议、服务端、数据库、Reward、Replay、Manifest、构建产物或线上配置。
- 不执行 commit、push、Pages、Render、真实 Supabase、真机或真实网络验收。

## Non-negotiable

- 第三方 skills 只登记为 REFERENCE，未经独立审计不得升级。
- AudioCraft 模型权重的 CC-BY-NC-4.0 限制不能被 MIT 代码许可覆盖。
- API key 不进入仓库、前端、日志、localStorage、Replay、Analytics 或音频 cue。
- 音频只消费本地 presentation/accepted-action 语义，不进入权威状态。

## Known Existing Behavior

旧全局 sfx()/haptic() 与默认关闭的 FeedbackBus/LocalFeedbackAdapter 并存；当前只有 Tank 有 accepted-authority spatial audio 纵切；设置页没有正式音频偏好；public/assets 没有音频文件。

## Expected UX

下一批应先实现一次合法动作对应一次可控、可静音、可回退、可测试的 cue，再逐款加入 2–4 变体和候选音频资产。
