# Motion System v1

## 原则

Motion 只解释状态变化，不成为规则真相，不阻塞输入。所有动作由 Anticipation → Action → Impact/Overshoot → Settle 四段组成；允许根据事件省略 Anticipation，但不得省略可取消的 Settle/静态终态。

## 四段式

| 阶段 | 占比 | 典型行为 |
|---|---:|---|
| Anticipation | 10%–20% | 微后撤、吸气、压缩、炮管后压 |
| Action | 35%–50% | 落子、移动、发射、投掷、表情爆发 |
| Impact | 10%–20% | 1.08 上限过冲、局部抖动、≤100ms hit-stop |
| Settle | 20%–35% | 1.08 → 0.97 → 1.00，回到可继续交互状态 |

## 时长基线

- Hover 80–120ms；Button Press 90–130ms；Card Enter 180–240ms。
- 棋子落下 160–220ms；飞行棋逐格 120–180ms/格；骰子 450–650ms。
- Persona Reaction 700–1300ms；Emote 900–1600ms；Result 600–900ms；Idle 2.2–4.0s。
- 输入视觉响应 ≤120ms；任何网络或 AI 等待不能由动画阻塞按钮事件。

## L0–L4 与密度

- L0 静态；L1 微交互；L2 状态转场；L3 关键 Gameplay；L4 环境氛围。
- 大厅同时活动 L4 ≤2，Profile ≤3，Game Shell =0。只有焦点商品、当前玩家和关键事件允许 L3/L4。
- 页面离屏、`document.hidden`、非当前商品/背景时暂停；reduced-motion 使用 poster 或 L0/L1。

## 抢占与取消

- 新输入可抢占 Hover/Idle/Preview；结算只能抢占非关键 Ambient。
- 旧局、旧回合、旧 Persona 响应必须按现有 session/turn 机制废弃。
- 动画取消后直接落到合法静态状态；不留下 transform、opacity、scroll lock 或不可点击遮罩。

## 安全

- 禁止高频全屏闪白；一秒不超过三次闪烁。
- 主要冲击优先使用形变、位移、局部高光、粒子和 ≤100ms hit-stop。
- reduced-motion 禁用位移型大幅 Motion、无限闪烁和循环背景；状态信息必须保留。

## 事件表最小字段

每个事件记录 `eventId / layer / duration / phases / interruptible / reducedFallback / offscreenPolicy / poster / inputBlocked=false`。Golden Set 至少覆盖 UI press、Avatar react、Persona 八状态、五子棋 place/win、飞行棋 roll/launch/move/capture/home/result。
