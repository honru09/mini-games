# 2.5D 表现合同

1. `DepthScene` 只拥有 background/world/foreground 三层空间 token；不得拥有规则、输入、网络、奖励或持久化。
2. `CameraSystem` 只暴露 `to(mode, options)`、`focus(target, options)`、`shake(options)`、`settle/destroy`；模式固定为 overview/hover/enter/active/focus/impact/result/exit。
3. 游戏只发出语义事件（如 `piece_landed`、`result`、`exit`），不得直接调用全局镜头或 GSAP。
4. 单步动效使用 GSAP Core，多步编排使用 Timeline；只动画 transform/autoAlpha/CSS variables，频繁指针更新使用 RAF/CSS 变量或 `quickTo` 复用；不得高频改写 top/left/width/height。
5. 页面离开、状态替换、隐藏、reduced-motion 和销毁必须 kill/clear 所有 Timeline、timer、RAF、listener；reduced-motion 保留等价静态反馈。
6. 2.5D 缺失、禁用或异常时立即回到既有 DOM/Canvas/静态资产；`mg_visual_25d_v1` 只允许精确 `"0"` 回滚。
7. Three.js/Ghost3D 代码只在冻结的可选实验层；2.5D 生产层不得引用 Three、Ghost3DHost、规则或协议字段。
8. 美术交付优先为 background/midground/foreground 透明原子、阴影、光晕和 reduced-motion/低带宽版本，不把文字、数值、网格或 Timeline 烘焙进图片。
