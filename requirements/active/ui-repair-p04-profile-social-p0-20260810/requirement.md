# UI Repair P0.4：公开身份与社交操作一致性

## 目标

修复排行榜、玩家列表、玩家私聊与公开 Profile 中的玩家原文边界、键盘入口和社交弹层生命周期，使真实昵称/签名保持原文，系统文案持续支持三语言，并让所有公开身份入口可由键盘访问。

## IN

- 公开 Profile、排行榜、玩家列表、社交列表、邀请/举报/Block 弹层。
- 玩家原文与系统 i18n 文案的分节点渲染。
- 既有 `setupAccessibleOverlayDialog`、Modal Scroll Lock 与焦点恢复。
- 独立专项 QA、三语言与完整回归。

## OUT

- 不改好友、邀请、举报、Block、Direct Chat 的服务端协议和权限。
- 不改游戏规则、奖励、Replay、AI、经济数值、Supabase 或生产配置。
- 不接入未审批美术，不提交、不推送、不部署。

