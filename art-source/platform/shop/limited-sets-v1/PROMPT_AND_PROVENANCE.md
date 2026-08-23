# P2-11 Prompt and Provenance

## 模型化艺术指导（未调用远端生成）

Model: `gpt-image-2` prompt grammar only  
Quality: `high` review target  
Size / Ratio: `1536×1024 / 3:2` source master

Prompt:

> Create one 3:2 seasonal collection vault illustration for the Ghost Game shop. Scene: four floating shop
> islands arranged around a clear central plaza — spring signal garden, summer cloud harbor, autumn archive
> lantern court, winter observatory. Subject: the original cream paper-cut ghost/controller mascot stands in
> the center with Q-style ghost hands; every island presents four empty collection plinths and controller-shaped
> architecture. Important Details: thick ink outline, tactile painted paper, warm cream cloud sea, distinct
> seasonal palettes, readable quadrant silhouettes, carefully connected stone paths, no baked interface copy.
> Use Case: responsive shipped shop collection hero with live localized DOM controls layered above or beside it.
> Constraints: original Ghost-native design, no price, no countdown, no inventory badge, no logos, no watermark,
> no commercial-game style imitation, no human hands.

## 确定性派生

- Codex 内置 `imagegen`（GPT Image 2 quality high）生成 `seasonal-vault-hero-master-v1.png`；host-managed 调用未暴露 taskId，按真实状态记录，不伪造编号。
- `scripts/generate-shop-limited-sets-v1.js` 从锁定的项目自有母版确定性派生 desktop/mobile/poster 三个 WebP 与 Review contact sheet。
- Runtime 文案全部由三语 locale 真实 DOM 输出，图中不烘焙任何文字、价格或商品事实。
- 四套映射只引用现有商品：`avatars / frames / effects / backgrounds`；服务器经济权威不变。

## 外部参考影响与拒绝项

生成完成后，本地 Skill 复核完整 836 文件、18,567,721,249 bytes 外部库存索引及 3,819 个 PSD/AI/EPS 结构审计上下文，
并查看四个商城相关 PSD 的层名、尺寸与对象计数。只吸收“商城应有分组、主视觉、商品列表、购买按钮”
这类通用信息架构事实；明确拒绝其蓝白弹窗、金币包、气球、旗帜、按钮轮廓、贴纸、角色、图层几何、
像素、色板和文案。最终图形从 Ghost/controller North Star 独立构建，保持 blocked-license 隔离。
