# playroom-security

## 适用

账号、PIN、session、Origin、WebSocket、AI、商城、奖励、档案和 Supabase 变更必须读取。

## 检查清单

Auth/session、Origin/CORS、权限与 ownership、消息大小/类型、速率限制、幂等/replay、输入校验、XSS、
敏感日志、service_role 只在服务端、客户端不可伪造金币/XP/owned/结果。

## 禁止

不得把 key 写入前端、仓库、测试输出或文档；未知第三方 Skill 未审计前不得安装/执行。

## 验收

运行 security、protocol、reconnect、Supabase adapter/schema 和目标回归；所有拒绝路径都要有 reason 与测试证据。
