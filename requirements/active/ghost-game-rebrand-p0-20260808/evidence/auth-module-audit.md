# Ghost Game 认证凭据纯模块审计证据

- 范围：`server/auth-credentials.js` 与独立回归 `qa/ghost-auth-credentials.js`。
- 边界：模块不读取数据库、不创建会话、不记录日志、不接触网络；本纵切未接入 `server/index.js` 或 Supabase。
- 用户名：4–20 位 ASCII 字母数字，必须同时至少包含一个字母和一个数字；唯一规范值为小写，拒绝 trim 后偷渡。
- 密码：8–64 位可打印 ASCII，允许空格、英文、数字与符号任意组合；不 trim、不 lowercase，拒绝控制字符和非 ASCII 输入。
- 哈希：Node `crypto.scrypt` 异步调用，参数 `N=16384,r=8,p=1`，16-byte 随机盐，32-byte 摘要；持久格式为 `s3$16384$8$1$<salt-base64url>$<digest-base64url>`。
- 防枚举：用户不存在、哈希畸形或版本未知时仍执行同参数 dummy scrypt，再固定返回 false；比较使用 `timingSafeEqual`。
- 公开 helper：校验结果不回显密码、密码长度或任何变换值；哈希解析器、dummy 材料和低层 KDF 不导出。
- 回归命令：`node qa/ghost-auth-credentials.js`。
- 预期终态：`GHOST_AUTH_CREDENTIALS_ALL_PASS`。
- 未执行：WebSocket 消息接入、旧 PIN 绑定迁移、持久化唯一索引、真实 Supabase 并发验收；由 Master 集成阶段完成。
