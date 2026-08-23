# P2-10 / P-TOURNAMENT-BROADCAST-OVERLAY-V1

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / IMPLEMENTED_LOCAL / RELEASE_EVIDENCE_PENDING`

本单元把已有 `tournament_state` 的已本地化展示投影组织为 Ghost-native 赛事播报叠层：
赛事状态、轮次、当前领先者和最多三桌赛况。叠层是纯表现层，原赛事标题、排名、操作与
身份徽章仍保留为真实 DOM；叠层自身 `aria-hidden=true`，避免重复朗读。

## IN / OUT

- IN：已有赛事标题、状态、`round=0` 等待首轮与正式轮次、排名第一项和桌况展示字符串；
  三语言实时刷新、320px 起布局、可访问 dialog、forced-colors、reduced-motion、页面隐藏暂停、
  迟到 Adapter 释放、P1-06 `card-tournament` 底图复用、feature flag 与旧卡回退。
- OUT：视频/音频流、直播推流、录制、Replay、延迟缓存、弹幕、观战权限、赛事创建/绑定/
  判负/恢复、Room/Rule/Authority/Protocol、Reward、Chat、Analytics、Supabase 或持久化。
- Authority：`GAME-028 / GAME-029 / UI-034` 的赛事、观战和入口边界不变；本模块不推导、
  修改或发送任何比赛事实，普通玩家赛事入口继续默认隐藏。`GAME-028` 仍为 planned / future
  expansion；本单元不把装饰 Overlay 冒充高级延迟观战、反串通或播放控制能力。

## 回滚

将 `mg_art_tournament_broadcast_overlay_v1=0` 后，赛事状态弹层回到 P1-06 的
`card-tournament` 装饰底图。模块缺失、输入拒绝或运行时异常时走同一旧卡 fallback；
reduced-motion、后台页面和 GSAP 加载失败保留完整静态 Overlay，不影响原赛事操作。
