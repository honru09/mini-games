# Audio Mainline Contract

## UnifiedFeedbackAdapter

`UnifiedFeedbackAdapter.create({ bus, enabled, settings, audioContextFactory, vibrate, variantResolver, now })` 返回冻结接口：

```text
unlock() -> { accepted, reason } | Promise<{ accepted, reason }>
setSettings(patch) -> { accepted, reason }
reset(scope) -> { accepted, reason }
snapshot() -> bounded scalar diagnostics
dispose() -> bounded terminal snapshot
```

`bus` 是 `FeedbackBus` 实例。Adapter 只订阅已规范化 cue，不读取 DOM、输入事件、Rule state、账号、网络或持久化。AudioContext 只能在调用方明确的真实用户手势中由 `unlock()` 创建/恢复；同步浏览器返回冻结结果，异步 `resume()` 返回可等待的结果 Promise，pending/reject 均不得提前标记 unlocked。当前实现为零依赖的程序化 WebAudio；外部 provider 不在浏览器运行时。

## Cue wire

唯一 cue 字段为 `type`, `id`, `intensity`, `pan`。允许的 `type` 以 `15-feedback-bus.js` 的 84 项 `EVENT_TYPES` 为唯一机器事实，并由 `qa/audio-cue-inventory.js --strict` 强制与 Unified Adapter 的 `CUE_TYPES` 完全同构；范围覆盖平台、设置、商城、社交、Playline、局内表达/房聊、对局生命周期以及六款游戏，不再保留早期 11 项 pilot 子集。仅 Tank 的 `tank_fire` / `tank_hit` / `tank_ko` 允许非零 `pan`，范围 `[-1, 1]`；`intensity` 范围 `[0, 1]`，`id` 使用完整 1–64 字符安全包络。所有未知、敏感、访问器或原型字段 fail-closed。

## Authority / accepted-action rule

- 本地单机：在既有规则函数返回合法且状态提交成功后发 cue。
- 联机：Tank/Tetris/Xiangqi/Monopoly 的 v2 Authority 路径只在服务端已接受的 Authority snapshot / result 或 accepted receipt 后发 cue；Gomoku/Ludo 及仍使用 v1 客户端规则的路径，以本地规则 commit + 输入门禁通过后的 accepted-action 作为表现确认。该区别不提升客户端权威，也不改变 Rule/Authority/Protocol 边界。
- `id` 必须由 match/session/generation/semantic sequence 或等价稳定事实组成；同一事实重放必须被总线去重。
- pointer/keyboard/touch handler、预测路径、旧回调、重复 snapshot 不得直接调用音频 primitive 或旧 `sfx()`。
- Audio Adapter 只能消费 cue；不得把 cue 反向写入 Rule、Authority、Replay、Reward、Analytics 或 wire。

## Settings

布尔键冻结为：`mg_audio_sfx`, `mg_audio_music`, `mg_audio_haptics`, `mg_audio_spatial`, `mg_audio_reduced_effects`；音量键冻结为 `mg_audio_master_volume`, `mg_audio_sfx_volume`, `mg_audio_music_volume`, `mg_audio_haptics_volume`，范围 `[0,1]`。首次使用采用产品默认值（SFX/Haptics/Spatial 开、Music/Reduced Effects 关）；已存在但畸形的存储值不会覆盖安全默认值。设置 UI 只更新本地表现层环境，不进入 profile、奖励、聊天或网络协议；语言文案必须存在于三份 locale。

## Variants and budgets

每个高频 cue 至少保留 2 个、最多 4 个（即 2–4） deterministic variants；`variantResolver(type, id, variantCount)` 不接受玩家原文或随机不可复现输入。总线保持 16 queue / 8 listeners / 64 recent IDs / 32 cues per second；Adapter 的总 active voice 上限为 8（SFX 与 music layer 合计），缺 StereoPanner 时居中输出。

## Lifecycle and fallback

`hidden`, `muted`, `reducedEffects`, `reset`, `dispose` 清空待播放队列和旧 generation；`reset` 还停止/断开当前 AudioNode，但保留生命周期订阅以便下一局继续，`dispose` 才取消订阅并关闭由 Adapter 自己创建的 context。图构建失败也必须关闭该次创建的 context 并允许下一次真实手势重试；异步 `AudioContext.resume()` 拒绝必须返回失败并保持可重试；`navigator.vibrate()` 返回 `false` 计为静默失败，Haptics 音量为 0 时不得调用 vibrate。所有 WebAudio/vibrate/decoder/panner 错误 fail-silent：运行时已安装时保持静音/视觉文字反馈，只有 runtime 不存在的兼容宿主才回到旧 `playFeedback()` shim，绝不阻塞合法动作。reduced-motion 保留可理解的即时静态反馈；reduced-effects 只抑制高频/非关键 cue，必须保留错误、终局和奖励结果 cue。

## Manifest / provenance

六个 `runtime_id` 必须有 `audio` 字段，至少为 `webaudio-fallback` 或经过许可审查的稳定 asset ID。生成候选必须记录源、模型、版本、SHA-256、license、prompt provenance、feature flag 和 rollback；AudioCraft CC-BY-NC 仅研究草稿，外部受限素材不得进入 runtime。

## Compatibility and rollback

缺少 FeedbackBus、设置、资源或 AudioContext 时继续兼容 shim / 无声反馈路径。程序化基线可通过 SFX/Music/Haptics 设置或撤下统一 Adapter 全局回滚；每个未来外部候选拥有自己独立的 default-off feature flag。回滚只关闭 Adapter/候选素材并由 `emitAcceptedAudioCue()` 恢复兼容表现，不修改对局结果、协议、历史 Replay 或用户数据；当前不伪造尚未实现的逐游戏 runtime flag。

## 当前本地实现边界

- 运行时已经落在 `public/src/core/21-unified-feedback-adapter.js` 与 `22-audio-runtime.js`；FeedbackBus/Adapter 的实际词汇为 84 个 cue，全部显式映射至 56 个 2–4 变体音色族。
- 六款游戏和平台接受分支已通过 `audioCue` / `emitPlatformAudioCue` / `emitUiAudioCue` 接线；`qa/audio-cue-inventory.js --strict`、`qa/audio-authority-contract.js`、`qa/platform-audio-cues.js`、`qa/audio-platform-coverage.js` 验证去重、隐私与 Authority 顺序。
- `audio-candidate-register.json` 与 `external-generation-preflight.json` 是候选治理，不是资产授权；外部生成、第二浏览器、真机、PWA 锁屏/耳机、真实网络和发布仍为 `NOT_EXECUTED`。
