# P1-04 Xiangqi Final Art v1 技术审查与相似风险评估

结论：`TECHNICAL_PASS / SIMILARITY_RISK_LOW`

## 1. 架构与性能复核

- **渲染技术栈**: 原生 Vanilla DOM + CSS + Canvas + GSAP 2.5D，零 Three.js / WebGL 重依赖；
- **内存与资源预算**:
  - 50 个 WebP 变体总字节数约 850 KiB，远低于 6 MiB 预算限制；
  - SVG 母版全部经由 Sharp 在构建期离线转码，无客户端转码开销；
- **无障碍与暗色主题**:
  - 装饰性图层与特效全部标记 `aria-hidden="true"`；
  - 核心着法提示、将军报警、吃子记录与时钟维持纯文本 DOM 呈现；
  - 支持 `prefers-reduced-motion` 静态静帧降级（自动使用 `-static` 变体）。

## 2. 相似风险审查

- 棋盘与棋子在遵循传统中国象棋规则规格（9列10行、九宫格、楚河汉界）的前提下，采用了 Ghost Game 独创的 Tabletop 纸张/印章/双层浮雕墨水描边风格；
- 棋子书法体字形与木纹边框采用扁平 2.5D 色彩渐变，与市面常规写实象棋软件形成明显的风格区隔；
- 相似风险评估：`SIMILARITY_RISK_LOW`。
