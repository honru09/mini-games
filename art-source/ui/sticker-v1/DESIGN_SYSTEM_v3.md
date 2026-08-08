# Design System v3 · Sticker Components

本文件只冻结结构与状态，不默认启用运行时。视觉值来自 `../../style/design-tokens.v1.json`。

## 组件结构

- Button：Ink 外轮廓 + Paper/Accent 主体 + 3–5px 底影；Pressed 下移 2–3px。
- Card：Paper 面板、右下接触影、标题/状态/行动三区；不可用毛玻璃承担主层级。
- Modal：标题、说明、内容滚动区、固定主要行动；一个可达滚动容器。
- Room Seat：Avatar/空席、READY/Host/AI/Offline、主要行动和非颜色状态符号。
- Shop Card：资产预览、名称、价格/owned/equipped、购买/装备行动；selected 不得代替 equipped。
- Avatar：图像、fallback、锁定/owned/equipped、焦点环；圆形裁切保留 8% 安全区。
- Badge：文本 + 图形双编码，含 neutral/info/success/warning/error/owned/equipped。
- Toast：图标、短标题、说明、可选行动；success/warning/error 明确区分且不只靠颜色。

## 必须状态

| 组件 | 状态 |
|---|---|
| Button | default / hover / pressed / focus / disabled / loading / error |
| Card | default / hover / pressed / focus / disabled / loading / error |
| Modal | opening / open / loading / error / closing |
| Room Seat | empty / human / ai / ready / host / offline / takeover |
| Shop Card | default / preview / owned / equipped / insufficient / loading / error |
| Avatar | default / selected / locked / owned / equipped / loading / error |
| Badge | neutral / info / success / warning / error / owned / equipped |
| Toast | info / success / warning / error / action / dismissed |

## 可访问性与响应式

- 所有可交互控件桌面和移动端均至少 44×44 CSS px；键盘焦点环不得被阴影/overflow 裁切。
- 正文 ≥4.5:1，图形/边界 ≥3:1；状态必须同时使用文字、图形或形状。
- 中文、英文、乌克兰语均不烘焙进图；为英/乌预留 35% 横向空间。
- 360/390/768/1024/1440 下主要行动可见；Modal 只有一个主要滚动容器。
- reduced-motion 只移除非必要运动，不移除 loading/error/owned/equipped 等信息。

## 运行时边界

`mg_ui_sticker_v1` 与总闸门 `mg_art_sticker_m0_v1` 在人工 Golden Set 通过前默认关闭。关闭后完整回退现有 soft-futuristic UI，不改变 DOM 语义、账号、商城、规则、奖励或联机协议。
