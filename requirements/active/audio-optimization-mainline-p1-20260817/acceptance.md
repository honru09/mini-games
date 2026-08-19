# Acceptance（2026-08-17 本地收口）

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| 主线与归类冻结为 GAME-037/GAME-038 Acceptance Gap | PASS | `requirement.md`, `MAINLINE_CONTROL_ROUTING.json`, ledger | 不新增 Requirement ID |
| cue 白名单、敏感字段、频控、去重与生命周期合同可执行 | PASS | `contract.md`, `qa/audio-feedback-contract.js`, `qa/feedback-bus.js`, `qa/unified-feedback-adapter.js` | 84 个 cue 与统一 Adapter 已同步 |
| accepted-action / accepted-authority 单触发规则 | PASS（本地静态/VM） | `qa/audio-cue-inventory.js --strict`, `qa/audio-authority-contract.js`, 六款游戏源码 | v2 Authority 只消费 accepted receipt/snapshot；v1 客户端规则路径只消费本地合法 commit；重复 snapshot、预测、观众/非法输入不产生新增 cue；Authority 真实设备行为仍待 PROVE |
| SFX/Music/Haptics/Spatial/Reduced Effects 设置 | PASS（本地） | `public/src/core/02-app-shell.js`, `public/src/core/22-audio-runtime.js`, `qa/audio-runtime.js`, `qa/dom-smoke.js` | 三语、音量、测试音、手势 unlock 和生命周期已覆盖 |
| 六款游戏 audio Manifest metadata | PASS（本地） | `public/assets/manifests/asset_manifest.json`, `qa/audio-generation-governance.js` | 六款统一 `unified-procedural-v1` + `webaudio-fallback` |
| WebAudio/haptic/panner 失败回退、dispose、hidden/reduced-effects | PASS（本地 VM） | `qa/unified-feedback-adapter.js`, `qa/audio-runtime.js`, `qa/local-feedback-adapter.js` | 不代表真机输出设备/锁屏行为 |
| 六款高频 cue 的 2–4 变体与正式素材 | PASS（程序化变体）；外部素材 NOT_EXECUTED | `qa/audio-tone-profiles.js`, `audio-candidate-register.json`, `qa/audio-generation-governance.js` | 56 个音色族；无外部二进制，AudioCraft 仍 research-only |
| 平台 auth/room/chat/reward 音效接受分支 | PASS（本地） | `public/src/online/03-websocket.js`, `qa/platform-audio-cues.js` | cue 不携带正文、UID、token 或协议 payload |
| 设置/商城/装备/社交/Playline/局内表达与房聊/每日任务/资料保存 | PASS（本地） | `public/src/core/01-utils.js`, `public/src/core/02-app-shell.js`, `public/src/core/07-playline.js`, `public/src/shop/06-shop.js`, `public/src/ui/07-roster.js`, `qa/audio-platform-coverage.js` | 新增 13 个语义 cue；只在本地提交或匹配的 accepted reply 后触发，无全局 `.btn` click 回退 |
| 第二浏览器、Android/iPhone/Tablet、PWA/锁屏音频恢复 | NOT_EXECUTED | `evidence/README.md`, `external-generation-preflight.json` | 属于 `GATE-DEVICE-BROWSER-NETWORK` 外部 Gate |
| 发布、commit、push、Pages、Render | NOT_EXECUTED | `execution.json` | 需要用户明确命令 |

## Known Issues

- `public/src/core/01-utils.js` 的旧 `sfx()/haptic()/playFeedback()` 仅保留为兼容 shim；新游戏 caller 已通过 `audioCue` 进入 accepted-action seam。切局、重连、spectator、切账号会调用 `resetPresentationAudio()`；倒计时由 `cancelCountdown()` 失效保护。
- 没有正式外部音频文件；候选注册表明确禁止伪造 output/hash，AudioCraft 研究草稿不能直接商业发布。
- 自动化不替代真机后台/锁屏、耳机切换或跨浏览器证据。

## Rollback

关闭统一 Adapter 或未来外部候选的独立 default-off flag，解除 Adapter 订阅并恢复旧程序化反馈；当前不存在虚构的逐款 runtime flag。删除本目录和 QA 文件不触碰协议、数据或资产。
