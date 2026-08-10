# UI Repair P0.9 冻结合同

1. P0.9 只消费既有 `chat_state/chat_history/chat_message/chat_send_ok/chat_read_ok/chat_error`，不得创建新 wire 消息。
2. 玩家昵称、消息正文和好友自定义文本继续走安全 raw text 节点；系统文案和日期标签必须走三语 `t()`。
3. 会话列表的刷新 pending 只反映客户端请求生命周期；真实断线清理 pending 时不得清除已缓存历史或草稿。
4. 历史分页必须保留用户当前阅读位置；新消息/新会话仍可滚到底部，但加载旧页不能强制跳底。
5. 发送、重试、已读、Block、访客和非好友只读权限全部由既有客户端/服务端边界决定，UI 不能绕过。
6. 移动输入遵守安全区、reduced-motion 和 44px 触控目标；桌面双栏、手机主从布局保持不变。
