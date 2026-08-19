# Ghost Game 音效主线收口与下一步优化方案

日期：2026-08-18（Asia/Tokyo）  
状态：`IMPLEMENTED_LOCAL / LOCAL_ONLY / NOT_RELEASED`  
归类：既有 `GAME-037` + `GAME-038` 的 Acceptance Gap / Shared Repair，不新增 Requirement ID。

## 1. 结论

本批已经把“能响”收口为可治理的音频系统：

- 一个纯语义 `FeedbackBus` → 一个 `UnifiedFeedbackAdapter` → 一个浏览器生命周期 runtime。
- 84 个固定 cue，56 个明确 tone family；每个 family 2–4 个确定性变体；3 个低响度、无 timer 的程序化 music bed（home/game/result）。
- 六款游戏的合法本地动作和 Authority accepted receipt 已迁移；平台 auth、room/presence、chat、reward、设置、商城/装备、社交、Playline、局内表达/房聊、每日任务与资料保存也只在本地提交或接受/去重分支发 cue。
- 六款 Manifest 统一使用 `unified-procedural-v1` 与 `webaudio-fallback`；`public/` 没有未经批准的音频二进制。
- 运行时没有供应商 SDK、密钥、prompt、玩家正文、UID、token 或音频字段写入 Rule/Authority/Protocol/Replay/Reward/AI/Chat/数据库。

未完成且明确保持未完成：外部 AI 音频生成、真实设备/第二浏览器/PWA 锁屏与耳机输出切换、真实网络、生产发布。它们是下一阶段的 Gate，不被本地自动化冒充。

## 2. 全项目音效板块地图

| 板块 | 当前 cue / 反馈 | 触发事实 | 当前状态与优化重点 |
| --- | --- | --- | --- |
| 首次解锁与设置 | `ui_test`、SFX/Music/Haptics/Spatial/Reduced Effects、四类音量 | 真实 pointer/touch/key 手势或设置提交 | 已实现；需真机验证 suspended/锁屏恢复 |
| Header、导航、Modal | `ui_confirm`、`ui_cancel`、`ui_error`、`ui_toggle`、`route_enter`、`game_select` | 有效 UI handler/路由变更 | 已统一；不再使用全局 `.btn` click 声音 |
| 认证与账号 | `auth_success`、`auth_error` | accepted register/login/legacy_bind/guest 或失败 attempt | 已实现；不读出用户名/密码内容 |
| 房间与 Presence | `room_joined`、`peer_join`、`peer_leave`、`ready`、`host_changed`、`reconnect_ok`、`reconnect_failed`、`offline_enter`、`online_restore` | 服务端回执或 detached room snapshot diff | 已实现；相同 snapshot/重连 bootstrap 不重复播放 |
| 对局生命周期 | `match_countdown`、`match_start`、`turn_self`、`turn_opponent`、`match_pause`、`match_resume`、`match_timeout`、`match_surrender`、`match_draw`、`match_win`、`match_loss`、`match_terminal` | 倒计时/状态转移/终局事实 | 已实现；终局按 viewer/draw 显式选择，不以 coins 猜测 |
| Direct Chat / Match Chat | `chat_incoming`、`chat_sent`、`chat_unread`、`match_chat_incoming`、`match_chat_sent` | 新入站消息、首次 accepted receipt、unread 增长；房聊只在当前 match 的新 messageId 后 | 已实现；本地 Match Chat mute 同时抑制房聊声音，正文永不进入音频层 |
| 设置 / 主题 / 语言 | `settings_change`、`ui_confirm`、`ui_cancel` | 本地偏好、主题或语言提交成功；音量 slider 只在 change 结束时发 cue | 已实现；不恢复全局 `.btn` click，不对连续 `input` 洪泛发声 |
| 商城 / 装备 / Profile | `shop_purchase`、`shop_error`、`equip_change`、`profile_saved` | requestId/账号/品类/ID 匹配的购买回执，或本地装备/资料提交 | 已实现；重复/错账号回执不发声，购买超时使用错误 cue |
| Social / Playline | `social_update`、`social_error`、`playline_post`、`playline_error` | 服务端 accepted/rejected mutation；Playline presenter 接受当前账号 epoch 的回执 | 已实现；列表刷新与历史页不发成功 cue |
| 局内表达 / 每日任务 | `expression_received`、`daily_claim` | 当前 match 的新事件且非本人/未静音；首次 reward-bearing claimId | 已实现；UID、表情文本、奖励数值和 payload 不进入 cue |
| Reward / Growth | `reward_win`、`reward_draw`、`reward_loss`、`coins_gain`、`xp_gain`、`level_up`、`achievement_unlock` | `result_ok` 去重 guard 内的权威奖励 | 已实现；duplicate result 不重复播 |
| Gomoku | `gomoku_place`、`gomoku_line` | grid/history commit 后 | 已实现；撤销后重下使用局内 monotonic sequence |
| Ludo | `ludo_roll`、`ludo_move`、`ludo_capture`、`ludo_home` | accepted dice/token mutation 后 | 已实现；非法 roll 无音，移动/被吃/回家分离音色 |
| Monopoly | `monopoly_roll`、`monopoly_land`、`monopoly_purchase`、`monopoly_pay`、`monopoly_auction`、`monopoly_bankrupt` | 本地 commit 或 v2 Authority accepted transition | 已实现；full-rule click 不提前发声，步进声受低频策略约束 |
| Tank | `tank_move`、`tank_fire`、`tank_hit`、`tank_ko`、`tank_respawn` | 本地 accepted simulation 或 Authority snapshot delta | 已实现；prediction/bootstrap/silent snapshot 抑制，fire/hit/KO 支持二维 pan（不是 HRTF/真 3D） |
| Tetris | `tetris_move`、`tetris_rotate`、`tetris_soft_drop`、`tetris_hard_drop`、`tetris_lock`、`tetris_line_clear`、`tetris_garbage`、`tetris_ko` | accepted input、battle receipt 或 v3 rule snapshot | 已实现；battle v1 的 lock/clear 等待 receipt，bootstrap/repeat 零新增 cue |
| Xiangqi | `xiangqi_select`、`xiangqi_move`、`xiangqi_capture`、`xiangqi_check`、`xiangqi_checkmate`、`xiangqi_clock_low` | 合法 board commit、live rule snapshot、clock threshold | 已实现；Authority cue 只接受 `source='live'` 且 move number 单调 |
| Music / ambience | `home`、`game`、`result` 三个程序化 bed | 路由、开局、结算、再来一局 | 已实现但默认 Music 关闭；外部 BGM 仍候选隔离 |

## 3. 架构裁决

```text
accepted local action / accepted Authority receipt
                 ↓
       semantic cue {type,id,intensity,pan}
                 ↓
            FeedbackBus
                 ↓
       UnifiedFeedbackAdapter
          ↙       ↓        ↘
      WebAudio   Haptics   safe fallback
```

规则层只负责合法性与状态；音频只消费表现事件。AudioContext 的创建/恢复、音量、声部上限、panner fallback、hidden/pagehide、reduced-motion、dispose 都藏在 runtime/Adapter 内。这样未来可替换静态 buffer 或已批准 provider 素材，而不用改六款规则或协议。

## 4. 四条 AI / skill lane 的分工

| 来源 | 应用方式 | 当前可执行结论 |
| --- | --- | --- |
| [game-creator](https://github.com/PlayableIntelligence/game-creator) + `game-audio` | 借鉴 EventBus→AudioBridge、手势解锁、程序化 one-shot、QA 分层；不照搬 Phaser/Three 工程结构 | 已落地到项目自有 Bus/Adapter；不引入 Strudel/AGPL 依赖 |
| [AudioCraft](https://github.com/facebookresearch/audiocraft) + [Hermes AudioCraft skill](https://github.com/NousResearch/hermes-agent/blob/main/optional-skills/creative/audiocraft-audio-generation/SKILL.md) | MusicGen 做氛围草稿，AudioGen 做材质/环境草稿，EnCodec 做离线处理 | 当前 Windows/Python 3.14、缺 audiocraft/torch/torchaudio/transformers/ffmpeg；公开 checkpoint 的 HF token 是可选项，不是阻塞；AudioGen 16 kHz / MusicGen 32 kHz 到 44.1 kHz 的重采样和双 hash provenance 已冻结；模型权重 CC-BY-NC，候选只能 research-only，未生成 |
| [fal-ai-media skill](https://github.com/affaan-m/ECC/blob/main/.agents/skills/fal-ai-media/SKILL.md) | 有凭证后先 search/find/estimate_cost，再异步 generate/result/status/cancel；只在隔离目录生成候选 | 当前无 `FAL_KEY`、无 fal MCP；未发请求，候选保持 flag-off |
| [ElevenLabs sound-effects skill](https://github.com/elevenlabs/skills/tree/main/sound-effects) | 有凭证后生成 one-shot/loop SFX，做时长、响度、人工 artifact review，再进 Manifest | 当前无 `ELEVENLABS_API_KEY`；未发请求，候选保持 source-only |

`audio-candidate-register.json` 和 `external-generation-preflight.json` 记录了四个生成候选（AudioCraft SFX/Music、ElevenLabs、fal）与一个 game-creator 设计参考。四个生成候选都是 `PLANNED_NOT_GENERATED`，设计参考为 `REFERENCE_ONLY`；五个用户指定上游均固定 commit，已安装 workflow skill 固定本地 `SKILL.md` SHA-256。没有 output path、输出 SHA、job id 或伪造许可结论。

## 5. 下一阶段执行顺序

### P0：真实音频恢复证明（PROVE）

在提供可用设备/浏览器后，按同一当前构建验证：

1. Android Chrome PWA：首次手势、后台/锁屏、恢复、音量/震动、低电量。
2. iPhone Safari/PWA：AudioContext resume、静音键、蓝牙耳机插拔与输出切换。
3. Tablet 横竖屏和第二桌面浏览器：双账号房间、chat/reward 去重、reconnect。
4. 记录 unlock latency、resume latency、active voices、decode/cache、长帧和错误；没有这些证据不提升为 release-ready。

### P1：候选素材生产（凭证和许可就绪后）

- ElevenLabs/fal：先做 8–12 个高价值 one-shot（Tank fire/hit/KO、Tetris clear、Ludo roll/capture、Monopoly auction、Gomoku place、Xiangqi check），每个 2–4 候选；生成到 source-only quarantine。
- AudioCraft：只做听感研究，不进入商业 runtime，除非独立权利审查明确解除权重限制。
- 每个候选必须通过：真实文件 SHA-256、采样率/声道、峰值/响度、短 fade、loop seam、人工 artifact/语音污染检查、provider 条款和回滚 flag。
- 只有批准后的静态文件才能加 Manifest；失败/未解码/网络不可用必须回到 `AUDIO-FALLBACK-PROCEDURAL-V1`。

### P2：听感与可访问性优化

- SFX ducking：终局/奖励优先于普通 move，Tetris 高频 move 继续 coalesce。
- 增加本地“音效强度预设”（quiet/standard/clear），不增加协议字段。
- 为低听力/无声场景保留颜色、HUD、震动和文字反馈；reduced-motion 不等于关闭可理解反馈。
- 通过同一 cue ID 做遥测式本地诊断，但不记录玩家身份、正文或完整棋盘。

## 6. 发布前不可省略的 Gate

- 当前 `1CFC9A4E…51C31ACB` 音效捕获已通过 `npm run test:audio`、`npm run test:e2e`、确定性构建与 `public/index.html --check`；完整 `npm test` 与捕获时 `QUALITY_GATES_FAST_ALL_PASS` 绑定在此前的 `82D85384…248FE90` 历史构建。针对当前共享工作树的质量/进度复跑发现 Gomoku/Ludo/Monopoly/Xiangqi/Tetris/Tank renderer cache、PWA/Room Presence 合同和 TECH-027 报告身份漂移；这些失败已记录在 `evidence/audio-platform-coverage-20260818-current.json`，不归因于音效批次，也未由本批修复。后续代码变更仍必须重新运行这些门禁。
- 第二浏览器、实体 Android/iPhone/Tablet、真实网络、PWA 锁屏/耳机/输出设备。
- 外部 provider 凭证只在环境变量/MCP secret；绝不进入 `public/`、Manifest、日志、Replay、Analytics 或 localStorage。
- 不执行 commit/push/Pages/Render，除非用户在后续消息明确授权。

本轮覆盖扩展已融入正式源图与确定性构建：84 个 cue / 56 个 tone family；新增平台契约 `qa/audio-platform-coverage.js`，并保持程序化 fallback、外部候选隔离和所有共享 Gate 原状。最新当前构建证据见 `evidence/audio-platform-coverage-20260818-current.json`（SHA-256 `1CFC9A4E…51C31ACB`）；`82D85384…248FE90` 仅保留为历史捕获。

## 7. 当前证据入口

- `qa/audio-cue-inventory.js --strict`
- `qa/audio-authority-contract.js`
- `qa/platform-audio-cues.js`
- `qa/audio-platform-coverage.js`
- `qa/audio-generation-governance.js`
- `qa/audio-runtime.js`
- `qa/audio-tone-profiles.js`
- `qa/unified-feedback-adapter.js`
- `npm run test:audio`
