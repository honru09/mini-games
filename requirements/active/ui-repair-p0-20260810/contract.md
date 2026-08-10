# UI Identity Preview Contract v1

## Avatar Media

- `.avatar-stage` 与 `.mini-avatar-stage` 的直接媒体子节点只能是 `canvas` 或 `.avatar-art-v2`；两者必须使用相同圆形 mask、尺寸、z-index 和 object-position。
- `frame-ring` 只围绕媒体，不改变媒体几何；effect 只改变表现，不改变账号装备数据。
- `effect-4` 的旋转目标必须是伪元素/装饰层，禁止旋转 stage 或媒体。

## Premium Background Playback

- `applyPremiumBackground(element,id,context)` 继续返回布尔成功值并保留旧调用兼容。
- 新增本地播放控制只能作用于给定 element；默认 profile 行为仍按可见性/页面状态自动播放。
- 播放条件为：资源 animated、未 reduced-motion、element 可见、页面可见、调用方允许播放。
- cleanup 后必须固定 poster/fallback，并移除 observer、visibility listener 和播放控制句柄。

## Shop Preview

- 预览只读 account 当前身份与临时候选 item，不调用 `saveAccount()`、`syncProfiles()` 或 WebSocket。
- 切换候选前必须 cleanup 旧预览。
- 商品卡选择使用当前语言 `aria-label` 与 `aria-current`；卡为可聚焦 `group`，避免把含购买/装备按钮的容器误标为 `option`。Enter/Space 只在卡本身获得焦点时触发，内部按钮保持原行为。

## Failure / Reduced Motion

- 图片失败：展示现有 CSS/Canvas/poster fallback。
- reduced-motion：背景固定 poster，播放按钮禁用并说明静态预览；所有 CSS 动画由全局媒体规则压缩。
