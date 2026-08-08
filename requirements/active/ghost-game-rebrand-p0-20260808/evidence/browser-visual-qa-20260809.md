# Ghost Game P0 本地浏览器视觉验收

时间：2026-08-09 00:37（Asia/Tokyo）
环境：本地 Chromium / `http://localhost:8090/`

## 已执行

- 1440px：登录、注册、Home、Games、Chat、Profile、设置、昼夜主题、中文/英文/乌克兰语。
- 768px：顶部导航、双栏/单栏降级、Hero 与 Honru 比例。
- 390px：Home/Games/Chat/Profile、底部四项导航、内容滚动和浮层遮挡复核。
- 360px：独立登录 Page、语言/主题入口、登录/访客/旧 PIN 迁移入口、纵向滚动。
- 注册 `ghostqa0808` 后直接进入 Home；用户名密码重新登录成功。
- Honru 无 Key 离线回复清楚说明退化；每日签到首次数与重复请求幂等。
- 显式退出后旧 App 已重新设为 `hidden + inert + aria-hidden`，不再透出 Profile。
- 手机端使用 Chat 底栏替代浮动 Honru；Profile/Games 操作卡不再被遮挡。
- 浏览器开发日志：`[]`，没有 error/warning。

## 发现并修复

1. 390px 浮动 Honru 遮住欢迎卡和 Profile 操作：手机隐藏浮层，保留 Chat 底栏；平板/桌面继续显示浮层。
2. 显式退出只打开认证卡、旧 App 仍可见：退出统一调用 `requireGhostAuth('login')`，恢复独立认证 Page 隔离。
3. E2E AI 环境仅等待 socket、未等待认证：测试改为 `_authenticated` 后开局，避免认证回执销毁未认证测试局。

## NOT_EXECUTED

- 第二桌面浏览器
- Android、iPhone Safari、真实 Tablet
- 真实 Supabase migration/RLS/并发/备份/回滚
- 真实网络整形
- 30 分钟 Synthetic Session

以上项目未执行前，Release Candidate 继续为 `BLOCKED`，本证据不得解释为 production-ready。
