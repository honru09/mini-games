# Ghost Game M0 用户视觉 North Star 决议（2026-08-16）

状态：`USER_STYLE_DIRECTION_CONFIRMED / LOCAL_ONLY / NOT_RELEASED`

## 决议来源

用户明确确认：后续 Ghost Game 的卡片、角色、按钮、弹窗、结算、商城、房间、局内 HUD 与其他视觉方向，应完整对齐下列两张既有项目原创 M0 图；外部 UI 素材和随附前端代码只用于学习组件类型、状态覆盖、层级与交互工艺，不作为视觉皮肤、运行时代码或可复制资产。

## 唯一视觉基准

| 优先级 | 项目文件 | SHA-256 | 负责裁决 |
| --- | --- | --- | --- |
| A | `art-source/ui/sticker-v1/component-demo.png` | `135DB655DC400FB35F960045B510EE450E007CCFAD03E308DEBF65E222DB1F61` | Button/Card/Modal/Room Seat/Shop Card/Avatar/Badge/Toast 的结构、状态、焦点、可访问性与代码原生几何 |
| B | `art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png` | `184E24BFD5C52F54FA240366787A0751E5078038E4FBDA17B91C61219F2B4DE5` | 成品质感、暖纸画布、粗圆 Ink 轮廓、低频两级明暗、硬底影、玩具卡片、Q 版角色与克制彩色语义 |

用户本次附图与上述两个文件逐字节相同；不是“相似参考”，而是同一版本。发生冲突时，A 负责状态语义和可访问结构，B 负责完成度和视觉质感；任何后续软 3D、玻璃拟态、霓虹、写实 PBR 或外部 Q 版模板都不得覆盖这两项裁决。

## 必须保持的视觉语法

- 主轮廓使用 Ink `#211923`，Round Cap / Round Join；组件外轮廓清晰、闭合且有一致粗细。
- 主表面使用 Paper `#FFF9F2` 与 Cream `#F3E5C4`；Green/Teal/Blue/Purple/Pink/Coral/Gold 只承担语义和角色识别。
- Button/Card/Modal 使用紧凑圆角、右下接触影或 3–5px 硬底影；Pressed 通过下移和底影缩短表达，不靠模糊光晕。
- 每个主要形体最多 Base + Shade + 可选 Highlight；禁止照片纹理、塑料 PBR、强 Bloom、全边缘发光和大面积 blur-heavy glass。
- 角色与头像采用大头、强剪影、低频形体、少量非对称识别点和清晰五官；44–64px 仍需一眼读懂。
- 状态必须使用形状/图标/文字与颜色双编码；所有主要操作保持 44×44、焦点环、三语 35% 伸缩与 reduced-motion。
- 昼夜主题只改变环境 Background、Panel 映射与 Accent，不改变轮廓、角色比例、材质语法、组件结构或玩家身份编码。

## 产品覆盖顺序

1. 先建立代码原生 Token 与 Button/Card/Modal/Toast/Badge 的有限 Pilot，不改变 DOM 语义和业务协议。
2. 扩展 Room Seat、Lobby、Shop、Profile、DM、Playline、Auth 与 Outcome Surface。
3. 将同一语法用于六款 Game Stage 的 HUD、棋盘外壳、进程反馈和结算；规则 Canvas/Authority 永远独立。
4. 角色、Avatar、Honru、Emoji 与游戏美术使用同一 Character/Material Bible 生成 source-only 候选，再经过清稿、IP 与 Golden Set Gate。

## 外部参考边界

- 外部 PSD/AI/EPS、网页截图和前端代码只能回答“需要哪些组件/状态/布局/动效”，不能提供 Ghost Game 的线稿、色板、角色、图标、构图或 CSS 成品。
- 禁止复制第三方角色、服饰、徽记、高潮 Pose、商店卡、弹窗构图或特征组合；所有新增资产继续保留来源、Prompt、hash 与 IP Review。
- 不因本次用户方向确认而解除独立 Reviewer B、IP Similarity Review、人工清稿、逐资产 Golden Set、真机或发布 Gate。

## 当前边界

本决议确认的是“视觉方向”，不是对全部历史 M0 资产逐项批准，也不是运行时默认开启授权。`mg_art_sticker_m0_v1` 与各分闸门继续默认关闭；现有 CSS/Canvas/DOM fallback、商品 ID、规则、Authority、协议、经济、账号与数据结构均不改变。
