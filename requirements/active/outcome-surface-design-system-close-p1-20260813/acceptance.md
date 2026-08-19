# Outcome Surface Design System CLOSE P1

## 本地验收边界

- Victory、Reward Breakdown 与 Achievements 共享 `ghost-outcome-surface` 语义层级：状态标识、核心信息、明细和下一步动作。
- Victory 不再生成随机高饱和彩带；保持代码原生、Ghost-native Ink/Cream + 平台玻璃视觉，不接入任何外部角色、图标、字体、PSD/AI/PNG。
- Reward 只展示服务端返回的 Reward Breakdown，不计算、不改写奖励数值。
- 三类面板复用现有 `GhostSurfaceMotion` 懒加载 Adapter；多步反馈使用有限 GSAP Timeline，只动画 transform/autoAlpha，关闭、隐藏、reduced-motion、离开时清理。
- 仅 Victory/Reward 两个结果面板可在沉浸式 Game Shell 内播放；普通平台弹层继续在 Game Shell 活跃时静态降级。
- dialog topmost、Escape/Tab、焦点恢复、44px、移动安全区、三语言与主题对比保持成立。

## 明确不做

- 不修改 `server/reward-engine.js`、规则、Authority、Protocol、Replay、数据库、商城价格或经济配置。
- 不复制、描摹、换色或导入外部素材；外部登记继续为 `reference-only / blocked-license`。
- 不把自动化冒充为第二浏览器、真机、真实网络、forced-colors、visible reduced-motion 或人工 Golden Set 通过。
