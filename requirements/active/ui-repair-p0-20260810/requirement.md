# UI Repair P0.1 — 统一玩家身份与真实动态背景预览

状态：`REQUIREMENT_FROZEN`

时间：2026-08-10（Asia/Tokyo）

## Goal

解决用户直接指出的“头像是方的、头像框是圆的、Avatar 还在转圈、动态背景不是真实预览”问题：让程序化 Canvas 和 Avatar v2 图片使用同一圆形裁切、头像框与特效规则；商城背景预览成为可触屏/键盘控制的真实个人身份组合预览，并在 reduced-motion 下明确降级为静态海报。

对应台账：`ART-020 / ART-021 / UI-022 / UI-023 / ECO-013 / ECO-014`。

## IN

- 统一 `.avatar-stage` / `.mini-avatar-stage` 中 Canvas 与 `.avatar-art-v2` 的圆形裁切、居中、尺寸与 stacking。
- 头像框 1–8 与特效 1–4 同时适用于 Canvas 和 Avatar v2 图片。
- 特效 4 不再旋转整个头像；改为只旋转独立装饰环，头像本体保持正向。
- 商城 Avatar/Frame/Effect 预览复用真实统一身份组合，而非各自孤立样品。
- 商城动态背景预览显示背景、当前头像、头像框、昵称效果和遮罩的真实组合。
- 动态背景提供显式播放/暂停按钮，支持触屏、键盘和状态文案；reduced-motion 时禁用播放并明确显示静态预览。
- 预览切换和关闭商城时释放 IntersectionObserver、visibility listener 与动画资源。
- 商城商品卡可通过键盘选择预览，以可聚焦 `role=group + aria-current` 表达当前预览，避免与内部购买/装备按钮形成错误嵌套。
- 新文案同步 zh-CN/en-US/uk-UA。
- 新建专项 UI 合同 QA；运行商城、响应式、i18n、DOM、Build Drift 与完整回归。

## OUT

- 不生成或替换任何图片，不启用未审批 Honru/Sticker 资产。
- 不改变商品目录、价格、owned/equipped、购买消息或奖励经济。
- 不实现房间 UI、赛事隐藏、排行榜、公开 Profile、私聊滚动或局内自由文本聊天；这些进入 P0.2–P0.4 / Social Match P1。
- 不修改游戏规则、服务端、WebSocket、Replay、AI、Supabase、PWA 或生产配置。
- 不 commit、push 或部署。

## Non-negotiable

- `public/index.html` 只能由 `node scripts/build.js` 生成。
- 动画必须尊重 `prefers-reduced-motion`，不能阻塞购买/装备操作或造成头像本体旋转。
- 预览是临时状态，不能修改 account、服务端 Profile 或 localStorage。
- 动态背景资源失败时保留 poster/CSS fallback，不能出现空白卡片。
- 商品卡内部购买/装备按钮的键盘行为不能被预览快捷键吞掉。
- 所有可触控按钮至少 44px；手机/平板/桌面布局不产生文档横向溢出。

## Known Existing Behavior

- `.avatar-art-v2` 当前固定 `border-radius:4px`，Canvas 却为 `50%`；这是圆方不一致的直接根因。
- 头像框/特效选择器只覆盖 Canvas；Avatar v2 图片无法完整继承。
- `.avatar-stage.effect-4` 当前旋转整个 stage，导致头像本人转圈。
- premium background 文件本身是动画 WebP，但商城主要依赖 hover/focus 临时切换；触屏没有可靠播放入口。
- `applyPremiumBackground()` 已有 IntersectionObserver、页面可见性与 reduced-motion 基线，可在不引入依赖的前提下增加显式播放状态。

## Expected UX

- 无论头像来自 Canvas 还是 Avatar v2，在商城、Profile、Seat、排行榜和聊天中都保持同样的圆形裁切与头像框内边距。
- 特效环可以动，但玩家头像始终正向、可识别。
- 在商城选择背景后，左侧预览像缩小的真实个人主页：背景在后、身份组合在前；手机用户也能点按钮播放/暂停。
- 开启系统“减少动态效果”时，预览自动使用静态 poster，按钮说明当前是静态模式。
