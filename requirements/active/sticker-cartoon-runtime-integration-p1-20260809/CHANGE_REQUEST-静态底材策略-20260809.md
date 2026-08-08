# Change Request：静态底材的 reduced-motion / 离屏策略

日期：2026-08-09（Asia/Tokyo）
状态：已接受并写入 `requirement.md`、`contract.md` 与 `acceptance.md`

## 原因

侦察后确定 P1 唯一新资源是 998 bytes 的静态 SVG 底材，不含动画、计时器、滤镜或持续 Canvas 循环。原冻结文字要求 reduced-motion、低性能或离屏时回退旧木纹，会额外制造主题闪烁、重复加载和没有收益的设备分支；这与 M0 总契约“使用 poster/静态状态”并不冲突，因为本资源本身就是静态状态。

## 变更

- 双开关开启且资源校验/解码成功时，reduced-motion、页面隐藏或元素离屏继续使用同一静态 Sticker 底材。
- P1 不新增 requestAnimationFrame、interval、动画 GIF/WebP、Canvas idle loop 或 IntersectionObserver；只在既有游戏重绘事件中绘制。
- 不新增未经实机校准的 `deviceMemory` / `saveData` 低性能阈值。998 bytes SVG 继续受 1.5MB 预算和安全扫描约束。
- 开关关闭、Manifest 失败、路径非法、加载/error 或 decode reject 仍必须回退旧木纹，再回退程序化 Canvas。

## 不变项

- 15×15、坐标、规则、AI、联机、快照、回滚链和默认关闭契约不变。
- 后续若加入动画，必须另写 Change Request 并实现 reduced-motion poster、离屏暂停与输入不阻塞。
