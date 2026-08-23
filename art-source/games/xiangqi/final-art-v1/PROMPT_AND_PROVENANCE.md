# PROMPT_AND_PROVENANCE.md — Xiangqi Final Art v1

## 1. 资产基本信息

- **Family ID**: `G-16-XIANGQI-FINAL-ART-V1`
- **Source ID**: `ART-038-XIANGQI-FINAL-ART-V1`
- **生成日期**: 2026-08-21
- **创建者**: Ghost Game Core Art & Engine Team
- **工具链**: Node.js v20.x, Sharp 0.33.x (effort=3, quality=86), Pure SVG Vector Generation

---

## 2. 提示词设计与视觉规范 (Prompt & Art Direction)

### 2.1 调色板与材质哲学
- **宣纸与茶木基底**：`cream (#F3E5C4)`, `paper (#FFF9F2)`, `wood (#C49A6C)`, `ink (#211923)`
- **红方阵营**：朱砂红 `redPiece (#B85245)`, 阴影 `redDark (#6B251E)`, 釉光 `redLight (#FFEBE8)`
- **黑方阵营**：黛青蓝 `blackPiece (#315D78)`, 阴影 `blackDark (#1A394C)`, 釉光 `blackLight (#E8F3FA)`
- **点缀与特效**：琉璃金 `gold (#F1B640)`, 翡翠绿 `jade (#5EAAA2)`, 玄铁灰 `steel (#34363B)`

### 2.2 棋子设计
- 14 款精雕圆形棋子，采用双层倒角同心圆边框、手绘阴影与高光反射；
- 正面内嵌端正楷书/隶书字形：
  - 红方 7 子：帅、仕、相、傌、俥、炮、兵
  - 黑方 7 子：将、士、象、馬、車、砲、卒

### 2.3 棋盘分层设计
- `board-background`：温润木纹茶色底台，带有古典金丝嵌边与柔和环境接触阴影；
- `board-midground`：精确 9×10 中国象棋网格、九宫格斜线（九宫）、楚河汉界（Chu River Han Border）典雅篆书水印；
- `board-foreground`：2.5D 漫反射光影覆盖与纸张纤维质感层。

### 2.4 语义反馈特效 (Semantic VFX)
- `vfx-check`：红色将旗凌厉破空格局与警戒光弧；
- `vfx-checkmate`：金色决胜封印与斩击切线；
- `vfx-last-move`：四角精准直角定位框与行棋路径指示；
- `vfx-selected`：碧玉金边呼吸光环与锁定准星；
- `vfx-capture`：水墨飞溅与木质受击冲击波；
- `vfx-clock-warning`：读秒预警脉冲环。

---

## 3. 来源审计与合规证明 (Provenance & Compliance)

- **无第三方未经授权模型**：未使用任何云端黑盒 API 或未授权数据；
- **100% 规则一致性**：所有网格坐标、棋子尺寸与特效锚点严格对齐中国象棋规则体系；
- **无障碍兼容**：支持 `prefers-reduced-motion` 静态降级变体与 `forced-colors: active` 高对比度适配。
