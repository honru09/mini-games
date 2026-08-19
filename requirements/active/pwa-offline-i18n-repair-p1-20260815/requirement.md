# PWA Offline i18n Repair P1

状态：`LOCAL_REGRESSION_VERIFIED`

## Goal

修复 Service Worker 离线恢复 HTML 后三语言词典不可用、界面显示裸 key 的 P1 缺陷，同时保持 API/WS/Auth/Chat/其他 JSON 不缓存。

## IN

- 真实 `public/sw.js` install/fetch VM 红绿回归。
- 三语言精确同源校验安装、network-first 刷新、HTML-only navigation cache、cache v13；v11 浏览器证据保留为历史起点。
- 单一 Codex in-app Chromium 的旧 worker waiting、新 worker 激活、断网启动和三语切换证据。
- 回归 `TECH-005/007/008` 与 `UI-029`，不创建新 Requirement ID。

## OUT

- 不提供完整离线游戏或离线账号。
- 不强制 `skipWaiting()`，不修改规则、协议、奖励、数据库或美术。
- 不把单浏览器证据描述为真机/跨浏览器验证，不发布。
