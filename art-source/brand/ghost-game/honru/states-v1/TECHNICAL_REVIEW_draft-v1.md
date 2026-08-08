# Honru Expression Kit v1 技术审查（Draft）

## 结论

九个状态均已形成色键源、RGBA Alpha、三色平涂和 192/96/64/44px 派生图。自动审计通过：9/9 Alpha 四角透明、可见绿色污染为 0、三色候选只含 Ink/Paper/Cream。

## 视觉一致性

- 九个状态均保留幽灵/手柄同体、左十字眼、右四圆眼。
- 轮廓、主体比例、火苗波峰和两级明暗与 Honru v2 母图一致。
- `thinking`、`lose` 在 44px 下口型差异较弱，但姿态仍可区分；后续运行时应配合本地化文本，不依赖图像单独传达复杂语义。
- `win` 含三个近身星形装饰；它们属于状态轮廓的一部分，不应转入规则、奖励或粒子系统。

## 技术边界

- 本批只在 `art-source/`；未修改 v1/v2 母图、`public/`、运行时 Manifest、协议、游戏状态或奖励。
- 三色归并的 16 位色距溢出已在审计中发现并由 32 位重建修复；错误中间产物未登记素材库。
- 当前仍不是动画分层资产；需要运行时时先用静态 PNG/WebP 纵切并保留现有 v1 fallback。

## 审查状态

`IMPLEMENTED / SOURCE_ONLY / HUMAN_REVIEW_REQUIRED / DO_NOT_SHIP`
