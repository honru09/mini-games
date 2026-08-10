# match-chat-v1 冻结合同

1. 客户端只能提交 `matchId/messageId/text`；`senderUid/player/createdAt/protocol` 全由服务端签发。
2. 只有当前 active match 的正式真人席位可以发送；访客、观众、AI、旧 capability、错误 match 均拒绝。
3. 服务端按接收会话重新验证 token 与 Block；发送者始终能收到自己的权威回显，屏蔽者不收到对方消息。
4. 文本 NFC、去危险控制符、trim，限制 160 字/640 bytes/4 行；DOM 只用 `textContent` raw 路径。
5. 单局最近 50 条只在房间内存；新局、结束、房间销毁必须清理。不得写 `moveLog/Replay/Analytics/db/localStorage`。
6. 观众只能读取且遵守现有 spectator delay；同步历史也不能绕过 delay。
7. 举报只保存批准的 `messageId/matchId` 上下文，不复制正文到报告、日志或 Analytics。
8. 生命周期必须清理气泡 timer、消息、未读、输入与面板；reduced-motion 禁止入场动画但不隐藏文字。
