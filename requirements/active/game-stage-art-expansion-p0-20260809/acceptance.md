# Game Stage + Tabletop Art Wave A Acceptance

> **Historical policy note（historical-as-of，2026-08-16）：** 本文中的旧 `BLOCKED`、人工美术、Reviewer B、IP/法律与逐资产 Golden Set 表述仅代表本文形成时的历史快照，不覆盖当前权威政策。原创 Ghost-native 资产满足 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可进行可逆 `default-on` runtime 接入；人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，未执行时须如实保留且不得冒充 `PASS`。设备/第二浏览器/真实网络与 Supabase Gate 当前为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁止复制、派生、作为生成输入、接入 runtime 或发布。任何接入结论均不授权发布，commit、push、Pages、Render 或生产发布仍须当前用户明确命令。

| Gate | Required result |
|---|---|
| Visual coverage | 默认可见运行时覆盖固定矩阵达到 `52/100`，六款均计入底材和核心实体 |
| Game Stage | 六款均有 Header、Seat Rail、Arena、Command Tray，重复刷新不产生重复 ID/监听 |
| Online seats | 显示真实昵称/头像/Host/AI/READY/offline/current/spectator；只读取既有状态 |
| Local/AI seats | 使用实例玩家数与当前玩家，不伪造在线 UID/房主状态 |
| Art rollback | `mg_art_tabletop_wave_a=0` 回退旧表现；规则/快照/坐标完全相同 |
| Honru Chat removal | 无 Chat 子页、首页对话入口、Dock、表单、快捷问题；旧 hash 归一到玩家消息 |
| Preserved Honru | 签到协议、安全后端兼容、品牌资产与可选局内反应仍通过原边界测试 |
| Copy cleanup | `profile_route_intro` 展示段和 `profile_kicker` 不再出现在 UI |
| i18n | 三份 locale key 同构，英/乌无中文或裸 key，连续切换通过 |
| Responsive | 360/390/768/1024/1440 无横溢、控制无遮挡、触控 ≥44px、safe-area/reduced-motion 生效 |
| Gameplay | 六款初始化、AI、权威规则、重连、观战、E2E、奖励不回归 |
| Build | `public/index.html` 由 build 生成且无漂移 |
| External truth | 不把模拟浏览器写成真机，不把 code-native Wave A 写成 M0/Honru 人工/IP 批准 |

## 发布前验收结果（2026-08-09 18:35 +09:00）

- `52/100` 默认可见覆盖矩阵完成：共用 Stage 16、六底材 18、六核心实体 18。
- `npm run quality:gates` 11.351 秒全通过；完整 `npm test` 130.370 秒全通过；构建前后 `public/index.html` SHA-256 一致。
- 本地 in-app Chromium 已检查默认桌面与 `390×844`：五子棋/Tetris、light/dark、Profile、玩家 Chat、无页面横溢、Tetris Arena 无内部横溢、7 个按钮最小 44px、控制台无 warning/error。
- 浏览器发现并纠正：席位 `false` 泄漏、UID/重排瞬态误标、Tetris 390px 内部横向滚动与触控尺寸。
- `NOT_EXECUTED`：第二桌面浏览器、Android/iPhone/Tablet 真机、真实网络整形、独立 Reviewer B/IP/Golden Set。M0/P1/P2 未审批资源继续默认关闭。
- 当前为 `VERIFIED_RELEASE_PENDING`；线上部署完成前不写 `ACCEPTED/RELEASED`。

## 线上发布结果（2026-08-09 19:05 +09:00）

- 功能提交 `7fc6601e43df912a596dba671c9edcd8bfccf6a7` 已推送 `main`。
- Render 部署 `dep-d9s4u0v40ujc73cka1tg` 为 `live`，GitHub Pages workflow `31307142193` 为 `success`。
- Pages 与 Render 均 HTTP 200、包含 `game-stage-command` / `tabletop-art-runtime-wave-a`，且没有 Honru Chat/Form DOM；两端正文逐字节一致，与本地构建规范化换行后 SHA-256 均为 `0db35a5aa57605c2e61ea03be83ce38edc77a4930426b02f03ffdf6f15b8e770`。
- 生产 WebSocket 冒烟通过双人 READY/落子同步与 4 人房三人开局/结算/结束本局。
- 线上 in-app Chromium `1280×720` 完成登录前 Page、一次性访客、六游戏、AI 五子棋 Stage/Wave A/无横溢/0 console warning-error 抽查。
- 当前任务状态为 `ACCEPTED_RELEASED`；总 RC 仍因真实 Supabase、真机/第二浏览器/真实网络和独立人工美术审批保持 `BLOCKED_EXTERNAL`。
