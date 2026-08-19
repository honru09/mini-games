# Ghost Game 首屏、游戏包与动效性能预算合同

本合同把资源与动效预算写成可审计的本地基线；它不是低端真机 FPS 证据，也不把合成构建体积当作真实网络体验。

## 预算层级

| 层级 | 目标 | 证据边界 |
| --- | --- | --- |
| Shell | 首屏只加载必要 HTML/CSS/核心脚本；Three/GSAP island、游戏包和非首屏素材按需 lazy-load | 构建/Manifest/SW QA 可证明请求边界；真机冷启动仍 `NOT_EXECUTED` |
| Game Stage | 单局只挂载当前游戏所需 DOM/Canvas/Renderer；离开、隐藏、销毁时暂停并释放计时器、监听器、动画和资源 | 生命周期/合同测试可证明清理；真实 GPU/内存仍 `NOT_EXECUTED` |
| Motion | GSAP 只动画 transform、opacity、autoAlpha；有限 target、单 timeline/语义事件、stagger 代替重复 tween；不动画 width/height/top/left/margin/padding | 源码/专项 QA 可证明实现规则；60fps 需真实设备测量 |
| Assets | 正式 runtime 资产必须有 Manifest ID、尺寸/格式/Alpha、poster/fallback、lazy/decode/失败回退和 source/runtime provenance | 素材审计可证明记录；原创资产还需逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE`。人工/IP/Golden Set 是可选咨询；真实网络下载只保留发布证据待决 |
| Lists | 长列表只动画可见项；避免每帧创建 tween，频繁跟随使用可复用 tween/quickTo 等 seam | 源码合同可证明策略；低端设备滚动 FPS 仍 `NOT_EXECUTED` |

## 必须记录的指标

- 构建产物字符数/字节数与 SHA-256。
- Manifest 中 integrated、source-only、reference-only、default-off 的数量和路径安全性。
- 首屏/游戏 island 是否进入 Service Worker 安装缓存；运行时按需缓存版本。
- 每个动效批次的目标数量、持续窗口、`prefers-reduced-motion` 分支、hidden/offscreen 暂停和 dispose/kill 证据。
- 真实设备上才可记录的冷/热加载、FCP/LCP、帧耗、FPS、GPU/纹理内存和网络整形结果；没有设备就写 `NOT_EXECUTED`。

## 禁止事项

- 不用 CSS class、静态截图、占位数字或“看起来流畅”宣称达到 60fps。
- 不把所有节点都设置 `will-change`/`force3D`，不动画布局属性，不在每帧创建 timeline/tween。
- 不用 ScrollTrigger 驱动局内输入或权威状态；滚动页才可单独走对应 skill。
- 不把仍为 source-only、未取得逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE` 的原创图片或任何 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材打进 integrated runtime 或商城默认项；可选 Golden Set 咨询不是开发前置。

## 关闭条件

本合同只在预算、请求边界、动效规则和清理证据通过后标记 `implemented`。最新浏览器、第二浏览器、Android/iPhone/Tablet、真实网络、低端 FPS/GPU/内存保持 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；原创 Ghost-native 美术按 `OWNER_AUTHORIZED_ART_CLEARANCE` 独立推进，人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 仅为可选咨询；生产发布仍需用户当前明确命令。
