# 当前构建可见矩阵与缺陷收口 PROVE P4

状态：`COMPLETED_LOCAL / LOCAL_ONLY / NOT_RELEASED`

## Goal

为 G Coins P1 后的当前本地构建重新建立单一 Codex in-app Chromium 完整可见矩阵，并把本轮真实发现的路由深滚动、Monopoly 390×844 fallback 密度和乌克兰语数量语法三个 Acceptance Gap 一次性修正；修正后重新采集精确绑定新构建的 current 证据。

## IN

- 1440×900、1024×768、768×1024、390×844、844×390 五档 Home/Games/Playline/Profile 真实导航。
- Shop、Direct Message、Achievement、Room Lobby 与六款人机 Game Stage。
- 任意主页面深滚动后切换四区必须回到 `scrollY=0`；不得影响 Game Stage 内部滚动和退出恢复。
- 390×844 Monopoly 永久 DOM/Wave B fallback 的格子、棋子、骰子和可访问文本密度收口。
- uk-UA 的 games/wins/remaining wins 数量语法；zh-CN/en-US key 集与占位符继续同构。
- light/dark、visible reduced-motion、forced-colors、console、横向溢出、裸 key、44px 和模拟清理。

## OUT

- Rule、Authority、Protocol、Reward、Replay、AI、Supabase、账号、生产或线上发布。
- default-off Ghost3D 开关、正式 GLB/美术或 P-003 替换。
- 第二独立浏览器、物理 Android/iPhone/Tablet、真实网络整形和真实性能。

## Non-negotiable

- 先完成整轮真实可见缺陷收集，再一次性实现创造性修正；三语言、报告、双构建和重复性测试统一放在批次末尾。
- 当前证据必须绑定最终 `public/index.html` 的 characters、bytes 与 SHA-256；任何构建变化立即降为 historical-as-of。
- 只能修已归回 `TECH-027/UI-027/UI-028/UI-037/GAME-045/UI-029/TECH-005` 的 Acceptance Gap，不新增伪需求或越过外部门禁。
- 临时 viewport、reduced-motion、forced-colors、主题和语言必须在结束时恢复；标签页留在安全平台页。
- 未收到当前明确发布命令，不 commit、push、GitHub Pages 或 Render。

## 已复现缺陷

- Profile 深处关闭成就弹层后，真实底部导航切换 Games 仍保留 `scrollY=1300`，同页再次点击也不回顶。
- 390×844 Monopoly fallback 的 24 格长文字、玩家 marker 与中央骰子明显互相压叠。
- uk-UA Profile 显示 `1 ігор / 1 перемог / ще 1 перемог`，不符合乌克兰语数量规则。

## Expected UX

玩家从任意主页面切换区域都从新页面顶部开始；Monopoly 在小屏仍像完整游戏棋盘而不是重叠网页文字；乌克兰语数量自然正确。修正后五档四区、共享表面和六款局内继续保持零横溢出、零裸 key、可返回和安全降级。
