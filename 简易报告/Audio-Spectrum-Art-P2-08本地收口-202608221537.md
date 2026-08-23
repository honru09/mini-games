# Audio Spectrum Art P2-08 本地收口

## 一句话结论

`P2-08 / P-AUDIO-SPECTRUM-ART-V1` 已完成本地实现、主审修正和完整机器验收：Settings 现在拥有 Ghost-native 代码原生频谱，但音频权威、浏览器解锁、静音和声音合成仍由既有 Audio Runtime 管理。状态为 `LOCAL_ONLY / NOT_RELEASED / RELEASE_EVIDENCE_PENDING`。

## 做了什么

- 在 Settings 音频区加入 12 柱幽灵轮廓频谱，覆盖 silent、locked、ready、music、live、paused 状态。
- `GhostAudioRuntime` 只发布脱敏表现 envelope：accepted cue 类别、强度、左右声像、主题 track、有效可听布尔值与本地生命周期状态。
- 新增独立懒加载 GSAP Core Adapter，只用 scaleY/autoAlpha、有限 repeat=1、kill/settle/dispose；不使用 ScrollTrigger 或持续循环。
- 新增三语文案、双主题、窄屏、forced-colors、reduced-motion、hidden 和 feature flag 回滚。
- 本批没有生成位图或音频文件，九个图像 Skill 均按代码原生边界登记为 `NOT_APPLICABLE`。

## 用户现在能看到什么

正式账号进入 Settings 后，本地构建会显示与 accepted cue 和主题音乐状态相匹配的幽灵频谱；关闭声音或把有效音量调到 0 时显示静音，不会伪装成正在播放。动效不可用或减少动态效果时仍保留清楚可读的静态谱形。

## 还没做什么

- 当前浏览器会话停在登录页，因此没有擅自创建账号；当前构建 Settings 频谱可见流程保持 `NOT_EXECUTED`。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络整形和低端性能仍未执行。
- 没有生成新的主题音乐/音效文件；外部 AudioCraft、ElevenLabs、fal 候选继续隔离且未伪造产物。
- 没有修改 Rule、Authority、Protocol、Reward、Replay、AI、Chat、Analytics 或 Supabase。

## 验证

- `npm run test:audio-spectrum`：11/11 通过。
- `npm run test:audio`：完整音频链通过。
- `node qa/audio-runtime.js`：11/11 通过。
- `npm run test:i18n`、`node qa/dom-smoke.js`：通过。
- `npm run quality:gates`：`QUALITY_GATES_FAST_ALL_PASS`。
- 隔离端口 `COSMETIC_PROFILE_PORT=19445` 的完整 `npm test`：退出码 0。
- `node scripts/build.js --check`：通过。

## 风险与下一步

- 主审已修正零音量伪 Live 和弹层关闭后的迟到 Adapter 泄漏，并加入回归断言。
- 严格下一可执行单元为 `P2-09 / P-SOCIAL-SHARE-TEMPLATES-V1`；它属于分享卡/OG 图像批次，必须重新执行图像 Skill 编排和最高质量视觉审查。

## 发布状态

当前本地构建为 2,091,345 characters / 2,106,098 bytes / SHA-256 `D7B483C3769A28CB63FF3C00A72B9D8548FDA7CE7797E7EB842AB71A805B7F82`。未 commit、未 push、未触发 GitHub Pages、Render 或生产数据写入。

## 追溯入口

- `art-source/platform/audio-spectrum-art-v1/`
- `art-source/production/ghost-game-art-program-v1/P2-08_LOCAL_ACCEPTANCE.md`
- `public/src/core/22-audio-runtime.js`
- `public/src/core/30-audio-spectrum-art.js`
- `public/audio-spectrum-motion-entry.js`
- `qa/audio-spectrum-art-v1.js`

## 阶段百分比

- 美术生产总计划：28/33 = 84.85%。
- P0：12/12 = 100%。
- P1：9/9 = 100%。
- P2：7/12 = 58.33%。
- P2-08 本地实现与机器证据：100%；当前构建浏览器可见、真机、真实网络、发布：0%。
