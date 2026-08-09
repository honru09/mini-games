# 玩家私聊与个人主页 P0 冻结合同

状态：`FROZEN`

## 协议版本与能力

- capability：`direct-chat-v1`。
- 会话 ID：`dm:` + 双方 UID 按字典序排列后的服务端派生值；它不是秘密，客户端传入的 conversationId 只作游标定位，服务端仍重新推导并校验成员。
- 消息正文与昵称均是用户原文，不进入 i18n 替换。

## C→S

- `chat_list { limit? }`
  - `limit` 可选，整数 1–100，默认 50。
  - 返回当前账号参与的会话摘要；新登录/重连客户端也可主动拉取。
- `chat_history { peerUid, beforeSeq?, limit? }`
  - `peerUid` 必须是非访客正式账号；`beforeSeq` 可选正整数；`limit` 为 1–50，默认 30。
  - 当前好友或双方既有消息参与者可读取；任一方向 Block 时拒绝。
- `chat_send { peerUid, clientMessageId, text }`
  - `clientMessageId` 为 12–80 位 `[A-Za-z0-9._:-]`；发送者维度唯一。
  - `text` 净化后 1–500 Unicode 字符，仅当前好友且无 Block 可发送。
- `chat_read { peerUid, throughSeq }`
  - `throughSeq` 为该会话中已实际存在且接收方可见的正整数；已读游标只能单调递增。

## S→C

- `chat_state { version:'1.0', conversations, unreadTotal }`
  - `conversations[] = { conversationId, peer, lastMessage?, unreadCount, readThroughSeq, peerReadThroughSeq }`。
  - `peer` 只含公开档案白名单字段；`lastMessage` 只发给会话参与者。
- `chat_history { conversationId, peer, messages, hasMore, nextBeforeSeq, readThroughSeq, peerReadThroughSeq }`。
- `chat_message { conversationId, message, unreadCount, duplicate? }`
  - `message = { id, seq, senderUid, recipientUid, text, createdAt }`，其中 `seq` 始终以十进制字符串传输。
  - 推送给发送者除源连接外的其他有效 session 与接收者全部有效 session；非参与者永不接收。
- `chat_send_ok { clientMessageId, messageId, seq, message, duplicate }` 只返回源连接，由源连接用完整服务端消息替换乐观气泡，避免双事件重复渲染。
- `chat_read_ok { conversationId, readerUid, throughSeq, readAt }`，同时通知双方在线 session。
- `chat_error { action, reason, clientMessageId? }`。

## Authority、幂等与排序

- senderUid、conversationId、messageId、seq、createdAt 全由服务端签发。
- 每个会话 `seq` 严格单调递增；排序以 `seq` 为准，时间仅展示。
- 发送幂等键为 `(senderUid, clientMessageId)`：完全重复返回原消息；目标或正文不同返回 `idempotency_conflict`。
- 已读幂等键为 `(readerUid, conversationId, throughSeq)`，只允许推进，不允许回退；重复读为幂等成功。
- 客户端临时消息只由 `clientMessageId` 对账；不能用客户端时间或 sender 字段覆盖服务端结果。

## 关系与权限

- 发送：双方必须是当前好友、均为正式账号、任一方向均无 Block。
- 历史：当前好友或已有消息的双方参与者可以读取；任一方向 Block 后双方均拒绝读取。
- 解除好友：会话摘要保留、历史只读、发送拒绝 `not_friends`。
- Block：即时阻断发送/历史，会话从摘要与总未读中排除，不继续通过最后消息或计数暴露内容；解除 Block 后按历史参与权限恢复只读，重新成为好友后才可发送。
- 访客：所有 `chat_*` 玩家消息请求拒绝 `guest_forbidden`；Honru HTTP/签到保持独立。

## 净化、频控与留存

- 正文 NFC 规范化，去除 NUL、危险 C0 与双向覆盖控制符，将 CRLF/CR 统一为 LF并首尾裁剪；使用 Unicode code point 计数，长度上限 500 且 UTF-8 不超过 2000 bytes。
- 正文按纯文本传输和 DOM `textContent` 渲染；不做 HTML、Markdown、链接预览或服务端翻译。
- 每账号发送上限：10 秒 8 条、60 秒 30 条、24 小时 500 条；列表/历史/已读使用独立有界频控。
- 本地每会话最多 500 条、全局最多 50,000 条、最长保留 90 天；裁剪时同步保护游标不越界。
- Supabase 表使用参与者索引、会话序号唯一索引、发送幂等唯一索引；启用 RLS 并 revoke `public/anon/authenticated`，只由 service-role 服务端访问。
- 普通日志、Analytics、Metrics、Replay、Profile、Leaderboard 和通用举报 payload 不含正文；后续消息举报只能由服务端按 messageId 提取受限上下文。

## 断线、重连与兼容

- 断线期间 UI 只读并保留未提交输入；重连认证成功后主动 `chat_list`，打开会话再按最后 seq 拉取历史。
- 草稿只保存在当前账号的页面内存，不写浏览器 `localStorage`；退出或切换账号立即清空。
- 离线接收者上线后通过 `chat_state` 获取未读和最后消息，通过 `chat_history` 获取正文。
- 不认识 `direct-chat-v1` 的旧客户端忽略新消息，既有 Social Graph/Honru 协议不变。
- 首页“去聊天”和主导航 `#/chat` 打开玩家消息；Honru 入口使用 `#/chat?view=honru`。无 query 时不得自动切到 Honru。

## 稳定错误 reason

- `not_authenticated`、`guest_forbidden`、`invalid_target`、`conversation_unavailable`、`invalid_client_message_id`、`empty_message`、`message_too_long`、`rate_limited`、`idempotency_conflict`、`invalid_cursor`、`message_not_found`、`server_unavailable`。

## Profile 展示合同

- Own Profile 仅消费既有权威字段，不自行修改 `coins/xp/level/wins/totalWins/owned/achievements/dailyTasks`。
- 胜率：`totalWins / total`，`total <= 0` 时为 `null` 并显示 `—`；六游戏胜率同理使用 `wins[game] / played[game]`。
- XP 进度使用服务端 `xpProgress`；若缺失，显示安全占位而不猜测曲线。
- 最近一起玩读取私有 `playmates`；公开 Profile 不暴露该字段。
- 好友、消息、Block、邀请均复用 Social Graph 与 direct-chat 关系状态，不建立第二份客户端关系真相源。
