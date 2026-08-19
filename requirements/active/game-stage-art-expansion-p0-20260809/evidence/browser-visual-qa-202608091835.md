# Game Stage + Tabletop Wave A 本地浏览器证据

时间：2026-08-09 18:35（Asia/Tokyo）
环境：Codex in-app Chromium，本地 `http://127.0.0.1:8081/`，一次性访客；未发送真实凭证。

## 已执行

- 登录前 Page → 访客登录 → Home → Games → AI 五子棋/Tetris。
- 默认桌面与 `390×844`；light/dark；Profile 与玩家 Chat。
- 五子棋：Stage Header、两席、Arena、Command Tray、Cream/Ink 15×15 棋盘可见。
- Tetris：`tabletopArt=wave-a`、3 个井节点、7 个操作按钮；修复后 Arena `clientWidth=329`、`scrollWidth=329`，可见预览卡位于 Arena 内。
- 390px：`documentElement.scrollWidth <= innerWidth`；Tetris 控件矩形为六个 `45×52`、一个 `307×44`。
- Honru Chat/Dock/表单选择器计数为 0；玩家消息标题存在；Profile 有“主页”标题且不含“保持独立于昼夜主题”。
- 页面控制台 warning/error 为 0。

## 浏览器发现并闭环

1. Seat `infos=null` 被错误显示为 `false`：改为非数组不渲染 detail，并补合同测试。
2. `online.player` 与 UID 暂时不一致时可能误标本人：改为 UID 优先，重排等待权威 `room_update`。
3. 390px Tetris 双列产生 Arena 内部横向滚动：移动端改为单列/自适应预览，七控件至少 44px。

## NOT_EXECUTED

- 第二桌面浏览器。
- Android Chrome、iPhone Safari、真实 Tablet。
- 真实弱网/丢包/限速整形。
- M0/P1/P2 未审批位图/SVG 的 Reviewer B/IP/Golden Set。

本证据是本地浏览器模拟，不等于真机或独立人工美术审批。
