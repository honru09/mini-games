# Social Match P1 房间自由文本聊天验收

当前状态：本地验收完成，等待外部设备闸门与用户发布指令。

## 协议、安全与数据边界

- [x] `match-chat-v1` capability 与发送、同步、状态、实时消息、幂等回执和稳定错误成对登记。
- [x] 客户端只提交 `matchId/messageId/text`；服务端权威签发 sender、席位、时间和协议。
- [x] 正式真人可发送；访客和观众只读；AI、旧 capability、错误 match 和无效席位被拒绝。
- [x] NFC、危险控制符、160 Unicode 字符、640 UTF-8 bytes、4 行和 10 秒/60 秒/单局频控由服务端执行。
- [x] `(senderUid,messageId)` 单局有界幂等；同 ID 不同正文冲突；最近 50 条仅保存在当前房间内存。
- [x] Block 按每个接收会话重新过滤；观众历史和实时消息都遵守 spectator delay。
- [x] 正文不进入 moveLog、Replay、奖励、AI 学习、Analytics、数据库、localStorage 或普通日志；举报只保存批准的 match/message ID 上下文。

## 表现、可访问性与生命周期

- [x] Game Stage Command Slot 提供独立中央历史、未读、输入、头像/名字/时间、举报和本地静音。
- [x] 头像旁短气泡有界、可举报、计时器可清理；玩家名字和正文走 raw `textContent` 路径。
- [x] 访客和观众显示只读状态；移动端 Enter 发送、Shift+Enter 换行、44px 控件、安全区与 overscroll 合同存在。
- [x] reduced-motion 禁止气泡入场动画但不隐藏文字；三语言 key 同构。
- [x] 收到新消息重渲染时保留当前对局的内存草稿；离开、结束、换局和销毁会清空草稿、消息、未读、气泡和 timer。

## 自动化与发布边界

- [x] `node qa/match-chat-contract.js`、`node --experimental-websocket qa/match-chat-online.js`：ALL_PASS。
- [x] 旧 Social Match 静态、生命周期与在线专项：ALL_PASS。
- [x] Game Stage 专项和完整 `npm test`：ALL_PASS；旧源码切片已限定到各自模块边界。
- [x] 不修改六款规则、Reward、Replay、AI、Supabase 或未审批美术。
- [x] 未 commit、未 push、未触发 GitHub Pages 或 Render。
- [ ] 第二桌面浏览器、Android/iPhone/Tablet、真实网络整形和可见 reduced-motion 验收。
- [ ] 原创 Honru Emoji 的人工清稿、Reviewer B、IP Review 与 Golden Set；通过前继续默认关闭。

最终构建 bytes、SHA-256、完整质量门禁与报告同步结果记录在 `execution.json` 和本轮简易报告。
