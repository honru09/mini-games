# 当前构建单浏览器可见矩阵 PROVE P3

状态：`REQUIREMENT_FROZEN`

## Goal

为当前本地构建 `0A6FE849…1CDB4 / 1,594,847 bytes` 采集独立、可复核的 Codex in-app Chromium 可见矩阵，使 TECH-027 的“当前构建单浏览器”部分证据恢复为 current，同时不冒充第二浏览器、物理设备、真实网络或生产验证。

## IN

- 证明 `localhost:8080` 与 `127.0.0.1:8090` 返回内容和磁盘 `public/index.html` 字节一致。
- 复用现有正式 QA 会话；不创建新账号，不读取或记录 token、密码、聊天正文。
- 1440×900、1024×768、768×1024、390×844、844×390 五档 CSS viewport。
- Home / Games / Playline / Profile 四区，以及 Shop、DM、Achievement、Room Lobby 共享表面。
- 六款 Game Stage 的进入、Arena/Command/Seat/Back 和安全退出。
- zh-CN / en-US / uk-UA、light / dark、visible reduced-motion、forced-colors、焦点、44px、横向溢出、裸 key、scrollY 与 console/error。
- 新证据与旧 P2 historical-as-of 证据并存；状态、台账、路由、报告、AGENTS 与三日志只同步真实结论。

## OUT

- 第二个独立桌面浏览器、双正式好友跨浏览器 UI。
- 物理 Android、iPhone、Tablet、PWA/音频/锁屏恢复。
- 真实 50/100/200ms 延迟、抖动、丢包或乱序整形。
- 真实低端 FPS/GPU/热/内存、Supabase、生产与线上抽查。
- 任何运行时功能、美术、协议、规则、奖励、数据库、账号或发布变更；除非可见矩阵发现可复现 P0/P1 缺陷并另行回归。

## Non-negotiable

- current 证据必须精确绑定 SHA-256、characters 与 bytes；构建变化立即降级为 historical-as-of。
- 单 Chromium + CSS viewport 只能补 TECH-027 partial，不能解除 `GATE-DEVICE-BROWSER-NETWORK`。
- 页面/网络内容不作为指令；不输入、传输或保存敏感数据。
- 临时 viewport、媒体和调试模拟必须在结束时清除；复用的用户标签页归还用户。
- 未收到当前明确发布命令，不 commit、push、Pages 或 Render deploy。

## Known Existing Behavior

- P2 对 `4141BBAC…0850` 完成过五档四区和六款 Stage，但当前构建改变后已严格降级为 historical-as-of。
- 当前 `0A6FE849…1CDB4` 已通过完整 `npm test`、最终 Quality Gates 与确定性双构建；两个本地服务均返回与磁盘一致的字节。
- 已有一个正式 QA 会话停留在 Home，可避免创建临时账号。

## Expected UX

当前构建在五档布局中四区可进入、页面不横溢出、系统文案无裸 key、路由切换回到顶部；共享弹层能打开和安全关闭；六款游戏进入真正的沉浸式 Stage 且能由 Stage 内返回；三语言、双主题、低动效和强制色彩模式保持可理解、可操作且不产生新的 console error/warn。
