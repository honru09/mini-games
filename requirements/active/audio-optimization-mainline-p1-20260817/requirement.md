# 音效主线 P1：统一语义反馈与六款游戏音频收口

状态：`AUTHORIZED / IMPLEMENTED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

## 归类

本批是既有 `GAME-037`（六款操作音效、震动和状态反馈）与 `GAME-038`（高频音效变体与完整共享 FX）的 Acceptance Gap / Shared Repair；不新增 Requirement ID。主线遵循 `CLOSE → PROVE`，设备、真实网络、PWA 音频恢复和发布证据仍归 `GATE-DEVICE-BROWSER-NETWORK`。

## Goal

建立一个可回退、可测试、可关闭的 `UnifiedFeedbackAdapter`，使六款游戏、大厅和结算反馈遵循同一语义 cue vocabulary：一次已接受的合法动作只产生一次反馈，音频、震动和空间声像互不阻塞游戏规则；随后为高频 cue 提供 2–4 个确定性程序化变体、用户设置和生命周期证据。正式外部素材仍是隔离的候选 lane，不是本批 runtime 前提。

## IN

- `FeedbackBus` 的 cue 白名单、去重、频控、队列和隐私边界作为唯一语义入口。
- `LocalFeedbackAdapter` 的 WebAudio/haptic fallback、用户手势 unlock、StereoPanner 可选声像、八声部上限和 dispose 契约。
- Gomoku、Ludo、Monopoly、Tank、Tetris、Xiangqi 的 accepted-action / accepted-authority 反馈迁移。
- SFX、Music、Haptics、Spatial Audio、Reduced Effects、Master/SFX/Music/Haptics 音量的本地设置键、三语设置 UI 和后台/失焦恢复契约。
- `public/assets/manifests/asset_manifest.json` 中六款游戏的 `audio` metadata；正式资源接入前保留 WebAudio 程序化 fallback。
- 静态/VM/现有专项 QA、音频候选的 provenance/license 记录和可逆 feature flag。

## OUT

- 不改变 Rule、Authority、Protocol、Replay、Reward、Economy、Social、AI 或数据库字段。
- 不把原始键位、指针轨迹、聊天、玩家身份、token、URL、Prompt 或正文放入 cue、日志或资产生成请求。
- 不在没有凭证与许可证据时调用 fal.ai、ElevenLabs 或把 AudioCraft CC-BY-NC 权重作为商业发布资产。
- 不宣称 HRTF/真 3D、真机/第二浏览器/真实网络或发布完成；不自动 commit、push、Pages 或 Render。

## Non-negotiable

1. cue 只能是固定 `type/id/intensity/pan`，`type` 来自白名单；敏感/未知字段 fail-closed。
2. cue 必须绑定已接受的动作、本地提交或服务端 Authority snapshot；pointer-down、预测、重复 snapshot 不单独发声。
3. 音频、震动、StereoPanner、AudioContext、资源解码失败均静默回退，不影响输入、结算或网络状态。
4. hidden、静音、reduced-effects、切局、重连、spectator、切账号和销毁都清空待播放队列、旧 generation 与 AudioNode；生命周期监听器在 reset 时保留、在 dispose 时成对移除。
5. 高频事件具有 2–4 变体或明确的程序化变体选择，并受总线音量、声部和频控上限约束。

## 已落地实现（本批）

- `public/src/core/21-unified-feedback-adapter.js` 与 `22-audio-runtime.js` 已接入构建图；AudioContext 只在真实手势中创建/恢复，支持 SFX/Music/Haptics/Spatial/Reduced Effects、音量、后台/失焦、reduced-motion、静音、reset/dispose 和三条程序化 Music bed。
- FeedbackBus 与 Unified Adapter 同步 84 个 cue；每个 cue 显式映射到 56 个音色族，每族 2–4 个确定性变体，总 active voice（SFX + music）上限 8 / 32 cue·s⁻¹ / 去重边界保持不变。
- 六款游戏的本地 accepted-action 与 Tank/Tetris/Xiangqi/Monopoly Authority accepted receipt 已接线；终局结果根据 viewer/draw 显式选择 `match_win`/`match_loss`/`match_draw`/`match_terminal`，不再只看 `coins`。
- 平台 auth、room/presence、Direct Chat、reward/achievement，以及设置、商城购买/装备、社交、Playline、局内表情/房聊、每日任务和资料保存，只在本地提交或服务端接受/去重守卫内播放；音频上下文不含正文、身份、token 或协议 payload。
- 六款 Manifest 统一声明 `unified-procedural-v1` + `webaudio-fallback`；候选资产治理与外部生成 preflight 已记录，但没有生成或接入二进制。

## Known Existing Behavior

`01-utils.js` 的 `sfx()/haptic()/playFeedback()` 仍保留为兼容 shim，但不再是新 caller 的直接路径；全局 `.btn` click listener 已移除。正式外部音频文件仍不存在，六款 runtime 继续使用程序化 fallback。第二浏览器、真机、PWA 锁屏/耳机切换、真实网络和发布证据仍属于共享 Gate。

## Expected UX

玩家在合法落子、移动、掷骰、射击、消行、将军/终局和结算时获得清晰的一次性反馈；可分别关闭音效、音乐、震动和空间声像，切换语言/主题不改变设置；浏览器不支持 WebAudio 或用户未解锁时界面和对局继续正常工作。
