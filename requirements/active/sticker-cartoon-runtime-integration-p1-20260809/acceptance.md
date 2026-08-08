# P1 验收标准

- P1 总开关与五子棋分开关默认关闭，且只有两者都严格等于 `1` 时启用。
- 旧 `mg_art_gomoku_v1` 的默认/关闭语义不变；P1 关闭时线上现状逐级回退可用。
- 新运行时资产版本化保存，不覆盖 M0 Draft 源、现有木纹资产或 fallback。
- Asset Manifest 路径、hash、预算、fallback、load、flag 与实际文件一致，SVG 通过安全扫描。
- 五子棋仍为精确 15×15；点击交点、落子数组、五连、AI、快照、重开和联机不因美术改变。
- 资源加载失败或开关损坏时完整回退且无空白、无崩溃、无输入阻塞；reduced-motion/离屏保持同一静态底材且无新增动画、计时器或持续重绘。
- P1 视觉符合 M0 Ink/Paper、粗圆轮廓、两级明暗、低频材质、右下接触影；不复制商业游戏构图或资产。
- Light/Dark × zh-CN/en-US/uk-UA × 360/390/768/1024/1440 无横向溢出、棋盘裁切、文字烘焙、主题冲突或控制台错误。
- `npm run quality:gates`、完整 `npm test`、Build Drift、Sticker/Asset/Gomoku 专项 QA 全部通过。
- 未经人工预览与 IP 双人审查，开关保持默认关闭，任务不得标记 `production-ready` 或扩展到其他 M0 批次。
