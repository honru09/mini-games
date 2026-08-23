# P2-12 Machine Visual Review

- Profile Hero 使用原创观测台 Raster 主视觉 + DOM/CSS 层；未引入外部像素或第三方 Runtime 依赖。
- 六款游戏均有明确 tone token；无 featured game 时显示本地化空态。
- Hero 图标为装饰性 `aria-hidden` 节点，Profile 身份、局数和胜场仍由可读 DOM 提供。
- `prefers-reduced-motion` 移除 transform/will-change；`forced-colors` 隐藏 glow 并恢复系统颜色。
- 机器静态审查入口：`qa/profile-adaptive-hero-v1.js`；真实浏览器/真机矩阵仍为发布证据待执行。
