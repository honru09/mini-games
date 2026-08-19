# Shared Change Request — Social Match P0

状态：`APPROVED_FOR_MASTER_INTEGRATION`

## 共享/高风险文件

- `server/index.js`：公开 Seat 外观字段、`match-expression-v1` 权威/幂等/频控/Block/观众过滤。
- `public/src/online/03-websocket.js`：能力声明、发送方法、三类接收消息与 Profile 请求。
- `public/src/core/02-app-shell.js`：统一 PlayerIdentity、选择盘、气泡、投掷表现与清理。
- `public/index-template.html`：Command 内专用容器及响应式/reduced-motion 样式。
- `public/src/core/00-i18n.js` 与三份 locale：稳定错误 reason 和新增 UI 文字。
- `package.json` 与 `public/index.html`：专项测试登记；生成产物只由 build 产生。

## 兼容

- 新能力协商默认关闭发送入口；旧客户端忽略新服务端消息。
- 不改变 move、Rule Authority、Replay、Reward、AI、Supabase 或游戏快照。
- 未审批图片不进入运行时；fallback 由语义 ID 驱动，未来换图不改协议。

## 回滚

- 删除 capability、消息处理、表达 UI 和 Seat 扩展公开字段即可完整回滚。
- 回滚不触及房间、用户、好友、聊天、规则、奖励或持久数据。

