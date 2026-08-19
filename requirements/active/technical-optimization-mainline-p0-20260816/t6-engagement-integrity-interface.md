# T6 Engagement Integrity Shadow Interface

状态：`LOCAL_IMPLEMENTED / DEFAULT_OFF / AUDIT_ONLY / NOT_RELEASED`

## 边界

T6-P0 只观察 Tank Authority 已接受的动作摘要。它不判断作弊、不扣币、不封禁、不改变 Reward/XP/胜场，不写 Replay、Analytics、Supabase 或客户端协议。

## 开关与生命周期

- `ENABLE_ENGAGEMENT_INTEGRITY_SHADOW` 默认 `0`；独立于 Rule Authority、Tank Delta 与 Reward 开关。
- Tank 新局在 Authority 创建后初始化 Human/AI bounded cohort；结算在现有 Reward/result 回执完成后读取 audit snapshot，再 dispose。
- 重连、reset、离房、超时、换局和异常均清理引用；异常 fail-open，合法输入继续旧路径。

## 输入合同

只允许固定类别摘要：`gameId`、`mode`、`actorSlot`、`actorClass`、`sourceClass`、`actionClass`、`acceptedAt`、`sequenceClass`、`reconnectEpoch`、`inputModality`。服务端传 `inputModality=unobserved`，不传 UID、matchId、payload、坐标、文本、token 或设备轨迹。重复、旧序号、非法 tick/match、限流和 spectator mutation 不计数。

## 输出合同

只输出 `auditOnly`、accepted count、transition/repeat ratio、APM、entropy、confidence、bounded reasons 与数值 Metrics。单动作样本的 entropy 标为不可用；任何输出都不得含 `verdict`、`penalty`、`currency`、`xp` 或封禁动作。

## 回归

`qa/engagement-integrity.js` 覆盖纯模块边界、TTL、容量、时钟回退、隔离和不可变快照；`qa/engagement-integrity-online.js` 覆盖 flag 0/1、真实 Tank WS、Human/AI/Test Admin/spectator、重复/非法/限流、Reward/result 公共字段不变和完整清理。
