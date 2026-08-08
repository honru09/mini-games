# M0 验收标准

- Art Bible v1 明确定义原创色板、轮廓、比例、Facial Kit、两级明暗、材质、光照、字体与授权。
- Design System v3 覆盖 Button/Card/Modal/Room Seat/Shop/Avatar/Badge/Toast 的 default/hover/pressed/focus/disabled/loading/error/owned/equipped 状态。
- Motion System v1 覆盖四段式动作、L0–L4、reduced-motion、离屏暂停、输入不阻塞和安全闪烁。
- Golden Set 同时包含 1 Persona×8 状态、4 Avatar、核心 UI、五子棋与飞行棋完整纵切，且都通过统一风格审查。
- IP Similarity Review 逐资产记录原创轮廓、服饰、道具、徽记、构图、Pose 与来源/许可结论。
- `commerceId`/owned/equipped/价格/协议/规则不变，`artworkVersion` 可切换且旧账号数据回归通过。
- 资源失败、reduced-motion、低性能与离屏时 fallback 可用；首屏 ≤500KB、单游戏 ≤1.5MB、atlas ≤2048²。
- 昼夜双主题×三语言×360/390/768/1024/1440 通过视觉、overflow、灰度、对比度、键盘与 44px 验收。
- M0 未获得人工 Golden Set 决议前，任务状态不得超过 `implemented`，不得开始全量批量生产。
- 真实设备、真实 Supabase、真实网络整形和 30 分钟会话未执行时，RC 继续 `BLOCKED`，不得写 `production-ready`。
