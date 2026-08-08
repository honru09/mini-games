# M0 当前风格与系统缺口审计

## 结论

现有工程管线可复用，但现有视觉不能通过 Golden Set：六封面是统一度较高的软 3D 过渡版；48 Avatar 同时混用像素、动漫、风景、3D 动物、霓虹半写实和科幻写实；平台仍是毛玻璃 + Lucide；五子棋木纹、Tetris 霓虹玻璃、飞行棋圆点/Emoji 互不统一。

## 保留为结构或 fallback

- stable commerce/runtime ID、owned/equipped/价格契约。
- `asset_manifest.json` 的运行时路径、fallback、lazy load 和 feature flag 思路。
- 母图到多尺寸 runtime 的衍生管线与素材库 hash/license 审计。
- `MOTION_TOKENS.json` 的 L0–L4、reduced-motion、输入不阻塞结构。
- 六封面的三分之四桌游构图、Logo 的口袋桌游盒概念、Lucide 的功能语义。

不得删除这些现有内容；M0 新旗标默认关闭。

## 主要缺口

- 主题仍会改写玩家色；目标要求主题只改背景/Panel/Accent。
- 桌面按钮全局最小高度仍有 38px，M0 要求全尺寸 44px。
- Offscreen pause 只覆盖部分背景，Avatar/CSS 无限动画没有统一执行层。
- Asset/Library 仍为 v1，缺 `commerceId/artworkVersion/pivot/poster/budget/load/featureFlag/IP Review`。
- 运行时资源路径仍有硬编码，Source Manifest v2 不能冒充 runtime authority。
- Persona 只有 Emoji/文字表达，缺八状态视觉资产；五子棋/飞行棋缺 Sticker 完整纵切。

## 小尺寸风险

- Landscape Avatar 无人物/表情；Neon/Technology 64px 下脸小且细节噪声重。
- 五子棋/象棋细网格在约 210px 卡宽下衰减；大富翁建筑密度偏高。
- 飞行棋棋子视觉约 10–16px，虽触控容器可达 44px，但不满足 Sticker 剪影闸门。

## 当前证据

- `art-source/platform/avatars/v2/avatar_catalog_preview.jpg`
- `public/assets/ui/game_covers/*_320.webp`
- `public/assets/board/gomoku/`
- `public/assets/board/tetris/`
- `public/src/games/ludo.js`
- `public/index-template.html`
- `MOTION_TOKENS.json`
- `public/assets/manifests/asset_manifest.json`
- `asset-library/catalog.json`

风险：`HIGH`。Art Bible 未获人工确认、IP Review 未完成、真实设备未执行时，任务不得超过 `implemented`。
