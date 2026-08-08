# Ghost Game P0 验收标准

- 原创 Ghost Game Logo 在 24px/48px/大标题均清晰，黑白反转可用；Honru 不含第三方角色、皇冠、服饰、构图或受保护素材。
- 首次未认证只显示登录前品牌页；三语言和主题切换无需登录。
- 用户名实时检查具备防抖/requestId；服务端并发下仍拒绝重复用户名。
- 注册成功直接登录；不存在用户与错误凭证显示不同本地化消息；密码/PIN/Key/token 不出现在日志与公开 payload。
- 旧 PIN 注册、登录和 token 自动登录测试继续通过；旧账号可绑定用户名密码。
- 访客不进入 JSON/Supabase，显式退出后 token 与账号立即失效；TTL 到期清理。
- Home/Games/Chat/Profile 四区使用同一路由；手机底栏只在 `<=640px` 出现，平板与桌面使用顶部导航；Games 包含且仅包含六款现有游戏。
- 日/夜主题覆盖认证、主页、游戏页、弹层、按钮、输入、Toast；个人档案背景在切换时 DOM class 与商品 ID 不变化。
- Honru 签到单日幂等；聊天有鉴权、Origin、限频、超时、响应白名单与离线 fallback。
- `npm run test:i18n`、`node qa/dom-smoke.js`、新增 auth/guest/companion/navigation QA、`npm run quality:gates`、完整 `npm test` 通过。
- 本地 Chromium 完成 1440/768/390/360、三语言、双主题、登录/注册/访客/四区/游戏回退视觉 QA；未执行实机项继续标记 `NOT_EXECUTED`。

## 2026-08-09 验收结果

- 自动化：`npm run quality:gates` 与完整 `npm test` 通过。
- 本地 Chromium：1440/768/390/360、三语言、双主题、注册/登录/退出、四区、Honru 离线聊天和签到通过。
- 证据：`evidence/browser-visual-qa-20260809.md`。
- 真实 Supabase、第二浏览器、真实移动设备、网络整形和 30 分钟会话仍为 `NOT_EXECUTED`；RC 保持 `BLOCKED`。
