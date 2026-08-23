# P2-12 Profile Adaptive Hero Contract

- `P-PROFILE-ADAPTIVE-HERO-V1` 是表现层美术族：根据本地已同步的 `played/wins` 聚合选择主玩游戏，仅改变 Profile Hero 的视觉焦点。
- 不新增 profile 字段、owned、购买、奖励、排行榜、协议、实时消息、AI、Replay、Analytics 或 Supabase 写入。
- `mg_art_profile_adaptive_hero_v1` 是唯一 flag，默认开启；`0` 或 Manifest/decode 失败时回退既有 CSS Hero、身份 HTML 与游戏 Emoji/SVG 图标。
- 桌面/移动/Poster/Static 四个派生版本均为原创项目资产，运行时只使用 allowlisted Manifest 路径。
- `P2-07` 继续冻结；本批不引入 Three.js、GLB 或新的 Renderer 链。
