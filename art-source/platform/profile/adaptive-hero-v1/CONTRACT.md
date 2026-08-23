# P2-12 / P-PROFILE-ADAPTIVE-HERO-V1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING`

本单元是 Profile Hero 表现层：复用既有 Premium Background、Ghost-native Game Icon System
和现有身份/角色资产，并叠加 `art-source/platform/profile-adaptive-hero-v1/` 中的原创观测台主视觉，依据服务端已存在的 `played` 与 `wins` 聚合确定性地突出玩家常玩游戏。

## 边界

- `score = played × 2 + wins × 3`；平分按胜场、局数和冻结游戏顺序稳定裁决。
- 只读取既有公开/本人 Profile 投影，不新增字段、协议、owned、购买、Reward、经济、数据库或 AI 事实。
- 图标、背景和角色失败时回退既有 CSS/Emoji/文字 Profile Hero；关闭表现 flag 不影响原 Hero。
- 原创主视觉只作为装饰背景；用户名、局数、胜场和操作继续由 DOM 输出，图片不烘焙业务事实。
- 桌面、移动、reduced-motion 与 forced-colors 均保留静态可理解状态；不使用 ScrollTrigger，不在规则层使用动效。
- 位图族的 Manifest、SHA、provenance、fallback 和回滚详见 `art-source/platform/profile-adaptive-hero-v1/`。

## 回滚

设置 `mg_art_profile_adaptive_hero_v1=0` 或模块失败时，Hero 移除 adaptive 节点并保留原身份、背景、角色和操作按钮。
