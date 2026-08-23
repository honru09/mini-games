# P2-08 / P-AUDIO-SPECTRUM-ART-V1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING`

本单元为 Settings 音频区加入 Ghost-native 代码原生频谱。它消费
`GhostAudioRuntime.subscribeVisual()` 提供的脱敏表现 envelope：只包含 cue 类别、强度、
左右声像、主题 track 和本地生命周期布尔值。频谱不读取真实 PCM、AudioNode、麦克风、
录音、玩家文本、协议、规则、Replay、Reward、Chat 或持久数据。

## IN / OUT

- IN：12 柱幽灵轮廓、主题/accepted cue 静态谱形、有限 GSAP pulse、三语状态、双主题、
  窄屏、forced-colors、reduced-motion、hidden/dispose、feature flag 与 CSS 静态回退。
- 音量为零时按有效静音处理，不显示虚假的 Live cue；迟到的 GSAP Adapter 在弹层销毁后
  立即 dispose，不能重新挂载或保留上下文。
- OUT：新增音频文件、真实 FFT/AnalyserNode、麦克风、录音、主题音乐系统重写、Rule、
  Authority、Protocol、Reward、Replay、AI、Chat、Analytics 或 Supabase。
- 既有音频能力继续归 `GAME-037 / GAME-038`；本单元只补表现层，不创建新 Requirement。

## 回滚

将 `mg_art_audio_spectrum_v1=0` 后 Settings 保留原音频开关、音量和测试音；频谱 DOM、
订阅和懒 GSAP 模块均不创建。模块/GSAP 加载失败时保留静态 12 柱谱形，不影响音频。
