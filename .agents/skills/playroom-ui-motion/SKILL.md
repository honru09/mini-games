# playroom-ui-motion

## 视觉原则

Playroom 使用 Soft Futuristic Playroom：平台层安静、清晰、快速；玩家层允许个性化、霓虹和角色表达。
每个 Surface 最多一个主风格和一个辅助强调，禁止把多个案例拼成 AI 展示页。

## Motion Token

只使用 `MOTION_TOKENS.json` 中的 duration、distance、scale 和 easing。动效分 L0 Static、L1 Micro、
L2 State、L3 Gameplay Emphasis、L4 Ambient 五层；普通大厅动态背景最多 2 个，操作区不得被背景抢占。

## 性能与无障碍

Offscreen 动画暂停，未选中资源用 poster/fallback，游戏未进入前不加载大资源；尊重 `prefers-reduced-motion`。
动效必须帮助理解状态，不得延迟输入、遮挡 44px 触控目标或改变逻辑状态。

## 验收

重要 UI 必须有桌面和 390px/360px 证据；检查 Bounding Box、overflow、对比度、Console、网络错误和 reduced-motion。
