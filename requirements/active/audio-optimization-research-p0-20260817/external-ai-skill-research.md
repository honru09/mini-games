# Ghost Game 音效/音频深度研究与下一步优化方案

日期：2026-08-17（Asia/Tokyo）  
状态：LOCAL_ONLY / NOT_RELEASED  
本批性质：音频能力盘点、第三方 skill 安装/安全审计、下一步方案；没有修改运行时代码、规则、协议、奖励、Replay、数据库、发布配置或线上数据。

## 1. 结论先行

项目不是“没有音效”，而是存在两条没有统一的音频路径：

1. public/src/core/01-utils.js:28-86 的旧全局 WebAudio sfx()/haptic()：8 个单音预设、无资源加载、默认直接播放；全站按钮 click 监听还会额外发声。
2. public/src/core/15-feedback-bus.js + public/src/core/17-local-feedback-adapter.js 的 T3 语义反馈深模块：默认关闭，只消费 Tank 的 tank_fire/tank_hit，支持 accepted-action、二维 pan、手势 unlock、8 声部、隐藏/静音/故障隔离和清理。

因此下一步不应先把 AI 生成的 MP3 散落到六个游戏里。最优顺序是：

**先把旧 sfx() 收口到一个统一 Audio Adapter → 补正式的 SFX/Music/Haptics 设置与生命周期 → 用 Tank 既有 accepted-action seam 做第一条完整纵切 → 再用 ElevenLabs/fal 做候选素材、AudioCraft 做研究性氛围草稿、WebAudio 做永久 fallback → 最后逐款迁移和真机验收。**

这属于既有 GAME-037/GAME-038 的 Acceptance Gap/Shared Repair，并与 GAME-040、TECH-029、UI-030、UI-031、TECH-033、TECH-049 关联；不应新造一个重复 Requirement ID。

## 2. 五个来源的安装与真实调用账本

### 2.1 已安装的 Codex skills

以下目录已通过 skill-installer 安装到个人 Codex skills 目录，并已完整读取 SKILL.md 及其引用文件：

| 来源 | 安装结果 | 用途 | 当前状态 |
|---|---|---|---|
| PlayableIntelligence/game-creator | C:\Users\wangxr\.codex\skills\add-audio、game-audio | WebAudio 事件审计、step sequencer、one-shot SFX、mute/lifecycle QA | 已按本批审计使用 |
| NousResearch/hermes-agent 的 AudioCraft skill | C:\Users\wangxr\.codex\skills\audiocraft-audio-generation | MusicGen/AudioGen/EnCodec 离线生成与后处理指南 | 已安装；本机生成 preflight 未通过 |
| affaan-m/ECC 的 fal skill | C:\Users\wangxr\.codex\skills\fal-ai-media | fal.ai MCP 的模型发现、估价、异步生成/取消 | 已安装；MCP/密钥缺失，未发生成请求 |
| elevenlabs/skills 的 sound-effects | C:\Users\wangxr\.codex\skills\sound-effects | ElevenLabs 文本到 SFX、loop、时长和 prompt influence | 已安装；API key 缺失，未发生成请求 |

facebookresearch/audiocraft 是模型/研究代码仓库，不包含 SKILL.md，所以没有把它误登记成一个 Codex skill；它由 Hermes skill 作为调用指南引用。

### 2.2 为什么没有伪造“调用成功”

本机只读 preflight 结果：

- 系统 Python：3.14.4；Codex bundled Python：3.12.13。
- 两个 Python 环境都没有 audiocraft、torch、torchaudio 或 transformers。
- ffmpeg 不在 PATH。
- 检出的 RTX 2060 为 6 GB VRAM，但这不能替代 AudioCraft 要求的 Python/PyTorch/依赖矩阵。
- FAL_KEY、ELEVENLABS_API_KEY、HF_TOKEN、HUGGINGFACE_HUB_TOKEN 均未设置。
- 当前可用 MCP 工具列表没有 fal.ai、ElevenLabs 或 AudioCraft 生成工具。

所以本批“调用所有 AI”的可复核结论是：**已调用/应用四套工作流的审计与方案能力；没有在无凭证或不兼容环境中谎报生成了音频样本。** 下一轮如果提供凭证和合适的 AudioCraft Linux 环境，可以按本报告的 prompt/验收表真实生成候选。

### 2.3 一手来源与关键限制

- [game-creator README](https://github.com/PlayableIntelligence/game-creator) 把 game-audio 定义为 Strudel/WebAudio 程序化音频，并提供 add-audio 工作流；其 README 同时注明 @strudel/web 为 AGPL-3.0。
- [game-creator add-audio skill](https://raw.githubusercontent.com/PlayableIntelligence/game-creator/main/skills/add-audio/SKILL.md) 要求先审计事件，再以 AudioManager/Bridge/music/sfx 分层、首次手势解锁、mute 和 build QA 收口。
- [game-creator game-audio skill](https://raw.githubusercontent.com/PlayableIntelligence/game-creator/main/skills/game-audio/SKILL.md) 建议纯 WebAudio one-shot SFX、look-ahead sequencer、master gain 和 reduced-motion/清理路径；Strudel 是可选项，不应默认引入。
- [AudioCraft 官方 README](https://raw.githubusercontent.com/facebookresearch/audiocraft/main/README.md) 要求 Python 3.9、PyTorch 2.1.0，并建议 ffmpeg；代码是 MIT，但模型权重是 CC-BY-NC 4.0。
- [AudioCraft requirements](https://raw.githubusercontent.com/facebookresearch/audiocraft/main/requirements.txt) 还固定了 CUDA-enabled PyTorch、xformers、torchaudio、numpy 等依赖；这不是浏览器运行时依赖。
- [Hermes AudioCraft skill](https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/creative/audiocraft-audio-generation/SKILL.md) 将 MusicGen 用于文本到音乐、AudioGen 用于文本到声音，并标注平台为 Linux/macOS；它本身是调用指南，不改变 AudioCraft 权重许可。
- [ECC fal skill](https://raw.githubusercontent.com/affaan-m/ECC/main/.agents/skills/fal-ai-media/SKILL.md) 要求配置 fal MCP 与 FAL_KEY，并提供 search/find/generate/result/status/cancel/estimate_cost 等工具；它的示例重点是 CSM-1B TTS 与 ThinkSound video-to-audio。
- [fal Audio Models](https://fal.ai/explore/audio-models) 当前列出 Beatoven SFX 等音频模型；[Stable Audio 3 Small SFX](https://fal.ai/models/fal-ai/stable-audio-3/small/sfx/audio-to-audio) 可做带文字引导的 SFX 变体，但必须走有凭证的 fal 调用和许可/成本审计。
- [ElevenLabs sound-effects skill](https://raw.githubusercontent.com/elevenlabs/skills/main/sound-effects/SKILL.md) 要求 ELEVENLABS_API_KEY，支持 duration_seconds 0.5–30 秒、prompt_influence、v2 loop 和 MP3/PCM/Opus 等输出。
- [ElevenLabs Sound Effects API](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) 明确 endpoint 是 /v1/sound-generation，输出是音频文件；[官方 sound-effects overview](https://elevenlabs.io/docs/overview/capabilities/sound-effects) 说明了 one-shot、loop 和生成计费边界。

## 3. 仓库音频现状（可复核路径）

### 3.1 当前实现

| 层 | 事实 | 影响 |
|---|---|---|
| 旧 fallback | public/src/core/01-utils.js:28-58 创建单一 _actx，预设 click/move/pop/place/capture/score/win/lose；resume() 由任意调用触发 | 没有 master bus、独立音量、变体、优先级或可观测的 voice budget |
| 旧 haptic | public/src/core/01-utils.js:60-66 直接 navigator.vibrate() | 没有正式设置、权限/能力状态、reduced-motion 分支或 accepted-action 语义 |
| 旧全局 click | public/src/core/01-utils.js:82-86 对所有 .btn 发 click | 会与 action-specific sfx() 重叠；pointer 不是合法动作事实 |
| 语义 bus | public/src/core/15-feedback-bus.js 白名单 11 类 cue、64 ID、32/s、16 queue、8 listeners、generation/hidden/mute/reduced-effects | 这是正确的外部 seam，应成为唯一游戏事件入口 |
| Tank adapter | public/src/core/17-local-feedback-adapter.js 只处理 fire/hit；显式 unlock() 后创建 AudioContext；最多 8 voice；StereoPanner 不可用时中心回退 | 已有最适合扩展的 deep module/Adapter |
| Tank caller | public/src/games/tank.js:37-40,126-156,564-585,1399-1400 从 accepted local/Authority snapshot 触发 fire/hit 和 pan | 可作为六款迁移的参考纵切；当前 feature flags 未在正式 runtime 开启 |
| 其他游戏 | Gomoku 1498 place；Ludo 1161 roll、1259 move/capture；Monopoly 1398 roll、1541 buy/pass；Tetris 749 KO；Xiangqi 1270 move/capture | 事件覆盖很稀疏，且部分直接调用旧全局函数 |
| 结果/奖励 | public/src/core/01-utils.js:618+ 的 Victory overlay 播放 win/pop；public/src/ui/07-roster.js:940+ 显示 Reward Breakdown，但没有统一 audio cue | 结果与奖励容易出现重复或缺失反馈 |
| 设置 | public/src/core/02-app-shell.js:8-90 只有主题和语言，没有 SFX/Music/Haptics/Spatial 开关 | 用户无法控制音量，也无法验证音频偏好持久化 |
| 构建 | scripts/build.js:56-60 只将 FeedbackBus/InputGate/LocalFeedbackAdapter 纳入确定性构建 | 新 Audio Adapter 必须显式加入构建图，不能手改 public/index.html |
| Manifest | public/assets/manifests/asset_manifest.json 的 Gomoku/Tetris 有 audio: "webaudio-fallback"，Ludo/Monopoly/Tank/Xiangqi 没有 audio 字段 | 音频资产治理还不是六款同构合同 |
| 文件资产 | public/assets 当前没有 wav/mp3/ogg/m4a/aac/flac/opus/webm 音频文件 | 任何生成音频都必须走 provenance、hash、license、fallback、flag、lazy-load |

### 3.2 当前最值得先修的缺陷

1. **pointer 与 accepted action 双触发风险**：全局按钮 click 会响一次，游戏 action 可能再响一次；Ludo 的 roll() 在合法性 guard 前调用 sfx('pop')（public/src/games/ludo.js:1161-1165），非法/观众/非当前回合调用也可能产生声音。
2. **playFeedback('shoot') 没有专用 catalog 项**：Tank fallback 会落到默认 click-like 音色，且 fire button haptic 与 accepted fire 的 fallback haptic 可能重叠。
3. **没有统一 master gain/偏好**：旧 _actx 不能一键静音、分离音乐/SFX、在隐藏/路由切换时暂停，亦不能报告 active voices。
4. **AudioContext 生命周期不完整**：没有 pagehide/visibilitychange/bfcache/断线/换局统一 suspend/resume/dispose。
5. **缺变体与节流**：GAME-038 要求 2–4 变体，但旧代码只有固定单音；高频事件（Tetris move、Ludo steps、Tank fire）没有优先级/重复抑制 catalog。
6. **设置与 i18n 缺口**：没有三语 audio labels、test tone、耳机/扬声器说明、haptic 单独开关和 reduced-motion 解释。
7. **音频不应进入权威状态**：所有 cue 必须是本地 presentation event；不得写入 Rule/Authority/Protocol/Replay/Reward/AI/Chat/Analytics 原文。

## 4. 所有可用音效板块地图

### 4.1 平台/大厅/社交/经济

| 板块 | 建议语义 cue | 优先级 | 备注 |
|---|---|---:|---|
| 首次解锁/音频测试 | audio.unlock, audio.test, audio.denied | P0 | 只在真实手势触发；失败静默并显示可访问文字 |
| Header/Nav/Modal | ui.focus, ui.confirm, ui.cancel, ui.error, ui.toggle | P0 | 取代全局 pointer click；键盘与触控同一 cue |
| Auth/Guest | auth.success, auth.error, guest.enter, logout | P1 | 不播放密码/用户名内容 |
| Home/Games 路由 | route.enter, game.select, quickplay.start | P1 | 轻量，避免每次导航都抢主旋律 |
| Room/Presence | room.created, room.joined, peer.join, peer.leave, ready, host.changed, reconnect.ok, reconnect.failed | P0/P1 | 只消费服务端稳定事件；spectator 可独立静音 |
| Match lifecycle | match.countdown, match.start, turn.self, turn.opponent, match.pause, match.resume, match.timeout, match.surrender, match.draw, match.win, match.loss | P0 | 所有六款共享 |
| Direct Chat/Match Chat/Emoji | chat.incoming, chat.sent, chat.unread, expression.received | P1 | 复用现有本地 mute；正文永不进入 cue |
| Playline | post.published, post.removed, report.sent | P2 | 生产 capability 仍受治理 Gate |
| Shop/Profile | shop.preview, shop.purchase.ok, shop.purchase.error, equip.ok, profile.saved | P1 | 与服务器确认/客户端点击分离，避免假成功 |
| Reward/Progression | reward.win, reward.draw, reward.loss, coins.gain, xp.gain, level.up, achievement.unlock, daily.claim | P1 | 只在 result_ok/权威回执后播 |
| PWA/网络 | offline.enter, online.restore, update.ready | P2 | 默认不吵；可用系统状态文字作为 fallback |

### 4.2 六款游戏事件矩阵

| 游戏 | P0 事件 | P1 事件/变体方向 | 声音风格 |
|---|---|---|---|
| Gomoku | gomoku.place, turn.self, match.win/loss/draw | last-move tick、五连完成升调、禁手/非法落子；place 2–4 个木/玉石微变体 | 温暖棋子、短木质 click、低密度 |
| Ludo | ludo.roll, ludo.move, ludo.capture, ludo.home, turn.self, 终局 | six/extra-turn、逐格移动只做合成节奏而非每帧发声；safe/base 变体 | 轻快桌游、骰子颗粒、避免连滚疲劳 |
| Monopoly | monopoly.roll, land, purchase, rent/pay, auction, bankrupt, 终局 | chance/jail/tax、bid tick、现金上升/下降 pitch 方向；只在 Authority transition 后播 | 纸牌/筹码/木质桌游，经济反馈可辨但不刺耳 |
| Tank | tank.fire, tank.hit, tank.ko, tank.respawn, match.win/loss | engine bed、wall ricochet、low-HP、2D pan、fire/hit 2–4 变体；不宣称 HRTF/真 3D | 低频炮声、短爆裂、pan 仅表现层 |
| Tetris | tetris.move, rotate, soft_drop, hard_drop, lock, line clear 1/2/3/4 | T-Spin、B2B、combo、perfect clear、garbage incoming/attack、KO；高频 move 需要 coalesce | 数字化 click/lock，clear 音阶按强度升阶 |
| Xiangqi | xiangqi.select, move, capture, check, checkmate, clock.low, timeout | 车/马/炮可轻微 timbre 变体；将军必须比普通移动更清楚 | 木棋/玉石/钟声，静态专注，低响度 |

### 4.3 BGM/环境层（后置）

- Home：昼夜主题各一条 45–90 秒可循环环境床；不要在首屏自动下载。
- Game Stage：每款只先做一条低密度 ambience；局内重要 cue 通过 ducking 让位。
- Result/Reward：短 stinger，不做持续 BGM。
- Spectator/Replay：使用本地偏好；Replay 不把声音写入 moveLog。

BGM 不是当前 P0。先完成 SFX、设置、生命周期和真机恢复，否则持续音乐会放大所有 autoplay、静音、后台和性能问题。

## 5. 推荐的深模块与 seam

### 5.1 推荐形状

保留 FeedbackBus 作为纯语义模块，把旧 sfx() 和 Tank adapter 合并到一个深的 UnifiedFeedbackAdapter。游戏 caller 只知道 cue 类型、稳定 id、强度和可选 pan；不知道 WebAudio、MP3、AI、缓存或平台。

示意 Interface（方案，不是本批实现）：

~~~js
const adapter = UnifiedFeedbackAdapter.create({
  bus,
  audioContextFactory,
  assetResolver,
  vibrate,
  now,
});

adapter.unlock();                         // 仅真实用户手势
adapter.setPreferences({ muted, sfxVolume, musicVolume, hapticsEnabled });
adapter.setLifecycle({ hidden, reducedMotion, reducedEffects });
adapter.dispose();
~~~

bus.emit({ type, id, intensity, pan }) 仍是游戏侧唯一入口。Adapter 内部隐藏：

- 稳定 cue catalog、优先级、2–4 变体和 deterministic variant seed；
- procedural WebAudio fallback；
- decoded buffer/压缩音频 adapter；
- master/SFX/music/haptic gain；
- voice budget、coalescing、ducking、pan 和无 StereoPanner 回退；
- visibility/pagehide/bfcache、AudioContext resume、资源 decode 失败和 dispose；
- 统计快照（active voices、skipped、decode failures、unlock attempts），但不含正文、prompt、昵称、聊天或 token。

这是真正有深度的 seam：生产可以有 procedural adapter 和 asset-buffer adapter，测试可以有 fake adapter；调用方不被供应商锁定。不要把 ElevenLabs/fal SDK 直接放进浏览器，也不要让 AudioCraft 成为线上依赖。

### 5.2 迁移顺序

1. 给 FeedbackBus 补共享 ui_*、match_*、reward_* 白名单，但保持固定字段和敏感字段拒绝。
2. 将旧 sfx() 改成兼容 shim，只转发到 Adapter；删除全局 .btn click 监听，所有声音由 accepted semantic action 发出。
3. 先迁移 Gomoku/Tank 两条窄路径：Gomoku 对齐 Ghost3D 首个纵切，Tank 复用 accepted Authority/pan。
4. 再迁移 Ludo/Monopoly/Xiangqi/Tetris，逐款加入 2–4 变体和事件级 QA。
5. 最后接 Manifest-backed 候选资产与 BGM；任何资源失败都回到 procedural fallback。

## 6. 四套 AI/skill 的分工与 prompt 方案

### Game Creator / WebAudio（现在就能落地）

- 负责：零依赖 runtime、AudioManager/Bridge、look-ahead BGM、one-shot SFX、首次手势解锁、mute、QA。
- 适合：UI、棋子、骰子、落块、短确认音；也是永久 fallback。
- 不建议：直接照搬 Phaser EventBus/UIScene 结构；本项目是原生 DOM + 自有 FeedbackBus。
- 不默认用 Strudel：AGPL-3.0 与当前零依赖/发布许可边界不匹配，除非另行完成许可 ADR。

建议 prompt：

~~~text
Audit Ghost Game's existing FeedbackBus and six game callers. Design a zero-dependency WebAudio
adapter that emits only after accepted semantic actions, has master/sfx/music/haptics preferences,
2-4 deterministic variants, 8-voice cap, hidden/reduced-motion/dispose handling, and permanent
procedural fallback. Do not touch Rule/Authority/Protocol/Replay/Reward or add npm dependencies.
~~~

### AudioCraft / Hermes（研究性草稿，不直接进生产）

- MusicGen：为 Home/Game Stage 生成 mood/tempo/乐器方向草稿。
- AudioGen：为 Tank、Monopoly、Ludo 等环境/材质类声音做候选探索。
- EnCodec/后处理：统一采样率、fade、响度和导出格式。
- 不能直接用于商业发布候选：官方权重 CC-BY-NC 4.0；必须先有独立许可结论。
- 本机目前不能真实生成：依赖、ffmpeg、Python/平台矩阵均未满足。

建议离线 prompt（仅研究样本）：

~~~text
short non-musical game sound design, 0.8 seconds, dry close-miked polished wood token
placed on a cream tabletop, soft transient, no voice, no melody, no reverb tail
~~~

### ElevenLabs Sound Effects（有 key 后的候选素材主力）

- 负责：高辨识度 one-shot、loop ambience、复杂 Foley/impact；支持时长、loop、prompt influence。
- 建议先做 6×4 事件候选（每款一个核心动作 + 一个结果动作），再人工筛选、trim、normalize、压缩。
- 生成结果只进 source-only candidate；写入稳定 asset id、原始 prompt、模型、时间、输出 hash、许可/账单记录和 fallback。
- 不在客户端暴露 key，不在 server runtime 实时生成，不把用户正文拼进 prompt。

建议 prompt 结构：

~~~text
[object/action], [material], [duration], [mix position], [mood], one-shot, no voice,
no music, clean attack, short tail, game-ready
~~~

例：falling tetromino hard drop, crisp glassy digital click, 0.18 seconds, centered, energetic, one-shot, no voice, no music, short tail, game-ready

### fal.ai Media（候选编排/变体与成本控制）

- 负责：在有 MCP/key 时搜索模型、先 estimate_cost，再异步生成/轮询/取消；适合把候选生产流程标准化。
- fal-ai-media skill 的示例偏 CSM-1B TTS、ThinkSound video-to-audio；实时六款 SFX 应优先选择官方音频目录中的 SFX 模型，而不是误用 TTS 或视频模型。
- 若用 Stable Audio 3 Small SFX 的 audio-to-audio，应先提供自有/已清除的 seed audio；不得用项目禁止的 external reference-only 素材作为输入。
- 所有生成在本地候选目录完成后才可进入 Manifest；浏览器只下载批准后的静态文件。

## 7. 分阶段实施与验收

### Phase A — Audio Contract / P0（当前 CLOSE 可做）

- 新 active task 冻结 cue 白名单、字段、优先级、变体、偏好键、lifecycle、回滚 flag。
- 新 UnifiedFeedbackAdapter 只接纯语义 bus；旧 shim 保留一轮兼容。
- 设置页加入 SFX/Music/Haptics/Spatial 四项和 test tone，三语同构；偏好先存 localStorage，不新增 profile/schema。
- 删除全局 pointer click 声音；Ludo/Monopoly 等 action 先 guard 再 emit。

验收：node --check、fake AudioContext VM、unlock-only、mute、reduced-motion、hidden、dispose、8 voice、pan fallback、duplicate/rate-limit、旧 caller parity。

### Phase B — Tank + Gomoku 纵切（P0/P1）

- Tank：保留 accepted Authority fire/hit/pan；加入 fire/hit/ko/respawn 的变体和 lifecycle。
- Gomoku：place/turn/result 接入同一 adapter，和 Ghost3D semantic frame 同步但不把音频塞进 Renderer/Rule。
- 浏览器只做本地可见/可听窄证据；不把单 Chromium 当跨设备验证。

### Phase C — 候选素材生产（P1）

- ElevenLabs/fal 生成自有 prompt 的 source-only 候选；AudioCraft 仅研究性草稿。
- 统一 48 kHz PCM/WAV 母版或项目决定的单一格式，响度目标、峰值、淡入淡出、loop seam、文件大小和命名规则。
- 更新 Manifest、asset-library provenance、fallback、feature flag、SW lazy cache；不预载首屏。

### Phase D — 六款迁移 + QA（P1）

- 按 Gomoku → Ludo → Monopoly → Xiangqi → Tetris → Tank 的产品顺序记录事件 coverage；Tank seam 可提前作为技术样板。
- 新增 qa/audio-feedback-contract.js、qa/audio-feedback-vm.js、qa/audio-asset-manifest.js，并接入 Quality Gates。
- 测试接受/拒绝/AI/联机/观众/重连/换局/重开/注销/切账号、三语、双主题、reduced-motion、keyboard/touch 等价。

### Phase E — PROVE / 发布证据（P0 Gate）

- 对应 GAME-040/TECH-029：Android、iPhone Safari、Tablet 横竖屏、PWA 安装、锁屏/后台恢复、耳机插拔、输出设备切换、真实 FPS/发热/长会话。
- 记录 AudioContext resume latency、decode latency、active voices、主线程长帧、缓存命中和音量偏好恢复。
- 缺真实设备/网络时状态保持 implemented/partial/NOT_EXECUTED；不能升级为 production-ready。

## 8. 资产/许可/安全门禁

- AudioCraft 代码 MIT 不等于权重可商用；模型权重 CC-BY-NC 4.0，本项目不能把它生成的候选直接标成可发布。
- ElevenLabs/fal 生成物的商用权利、账单、服务条款、输出归属和是否允许训练/再分发，要在候选 asset sidecar 中留证；没有凭证和条款证据就保持 source-only。
- 不使用任何 blocked-license / EXTERNAL_REFERENCE_ONLY 素材或其 prompt/reference。
- API key 只在本地受控环境变量/MCP secret；绝不进入 public/、Manifest、日志、Replay、Analytics、localStorage 或 git。
- 音频 cue 只允许稳定 ID、数值强度、pan 和本地状态；聊天正文、昵称、URL、prompt、token、reward 数值不得穿过音频 seam。
- 所有供应商候选必须有旧 procedural fallback；网络、decode、浏览器 codec、AudioContext 或 StereoPanner 失败时对局仍可玩。

## 9. 当前未执行项

- 未真实调用 fal.ai、ElevenLabs 或 AudioCraft 模型；原因是 MCP/API key/运行时依赖缺失，已如实记录。
- 未生成或写入任何音频文件。
- 未修改 public/src、scripts/build.js、Manifest、协议、数据库、Reward、服务端或 public/index.html。
- 未做第二浏览器、物理 Android/iPhone/Tablet、真实网络、真实音频恢复、生产 Supabase、commit/push/deploy。
- 研究后台代理曾因服务端 GitHub 429 连续失败；本报告改由主代理基于已安装原文和官方一手 URL 完成，未把失败代理冒充独立审查。

## 10. 最终建议

现在批准的下一步应是 **GAME-037/038 Audio Contract + UnifiedFeedbackAdapter P0**，而不是直接采购或批量生成 BGM。先把“一次合法动作 = 一次可控 cue = 一次可回退播放”做成可测深模块，再让 ElevenLabs/fal 负责候选音色，AudioCraft 负责研究氛围，Game Creator/WebAudio 负责 runtime 与永久 fallback。这样六款游戏获得统一的音频语言，同时不越过项目当前 CLOSE→PROVE、许可、设备、协议、经济和发布边界。
