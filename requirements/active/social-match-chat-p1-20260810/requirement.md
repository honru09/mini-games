# Social Match P1：房间自由文本聊天

状态：`LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`

时间：2026-08-10（Asia/Tokyo）

## Goal

在沉浸式 Game Stage 内提供真正的房间文字交流：中央有界历史、头像旁短气泡、未读、输入框、举报和静音；服务器权威签发发送者、席位和时间，并执行净化、幂等、频控与 Block 逐接收者过滤。

## IN

- 新协议 `match-chat-v1`：`match_chat_send/sync` 与 `match_chat_state/message/ok/error`。
- 正式真人玩家发送；访客和观众只读；AI 不能发送。
- NFC/控制符净化，最多 160 Unicode 字符、640 UTF-8 bytes、4 行。
- `(senderUid,messageId)` 单局幂等，10 秒/60 秒/单局有界频控。
- 服务端内存最多保留本局最近 50 条；重连/观战显式同步，观众遵守延迟。
- 消息不进入 moveLog、Replay、奖励、AI 学习、Analytics、数据库或 localStorage。
- 客户端中央历史、头像/名字、日期/时间、未读、头像旁气泡、举报、本地静音、手机输入与 reduced-motion。

## OUT

- 不做跨房间、群组、附件、语音、端到端加密或数据库持久化。
- 不生成/启用未审批 Honru Emoji；基础文字功能使用代码原生表现。
- 不修改六款规则、Reward、Replay、AI 或 Supabase。
- 不提交、不推送、不部署。
