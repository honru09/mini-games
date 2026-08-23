# P0-11 Avatar Frame / Effect 视觉规格与 provenance

模型指导：GPT Image 2 的五槽规格结构（仅用于视觉规格，没有 API 调用）；最终生产路径为确定性 SVG + Sharp。

- Scene：512×512 透明画布，圆形头像保护区居中，原子必须能派生至 44/64/96/192。
- Subject：8 个 Frame 与 8 个 Effect；Frame 位于头像前层外缘，Effect 位于头像后层外缘。
- Important Details：纸白、墨黑与少量青绿/金黄/紫/珊瑚/蓝点缀；粗而连续的轮廓、有限纹理、稳定负空间；亮底/暗底和 high-contrast 均可分离。
- Use Case：Profile、Shop、Seat、DM 与 Playline 的统一身份组合；decorative-only，不承载名字、价格或 owned 状态。
- Constraints：保护脸部和圆形裁切；44px 仍可识别；无 baked text、水印、外部品牌、商业游戏专属符号、源像素复制或描摹；dynamic 只作为有限 transform/opacity hook。

以项目自有 M0 North Star 为唯一视觉锚点。实现：project deterministic SVG + Sharp；输出为 Ghost-native SVG 源稿与 WebP 运行时派生。未复制、描摹、换色或传输任何 blocked-license 外部素材。

动态边界：reduced-motion 使用 static，forced-colors 使用 high-contrast。
