# M0 验收标准

> **Historical policy note（historical-as-of，2026-08-16）：** 本文中的旧 `BLOCKED`、人工美术、Reviewer B、IP/法律与逐资产 Golden Set 表述仅代表本文形成时的历史快照，不覆盖当前权威政策。原创 Ghost-native 资产满足 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可进行可逆 `default-on` runtime 接入；人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，未执行时须如实保留且不得冒充 `PASS`。设备/第二浏览器/真实网络与 Supabase Gate 当前为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁止复制、派生、作为生成输入、接入 runtime 或发布。任何接入结论均不授权发布，commit、push、Pages、Render 或生产发布仍须当前用户明确命令。

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
