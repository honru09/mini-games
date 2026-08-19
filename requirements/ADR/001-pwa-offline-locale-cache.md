# ADR-001：PWA 精确安装与刷新三语言词典

- 状态：`accepted`
- 日期：2026-08-15
- 决策人：Ghost Game 主负责人（本地实现）
- 影响 Requirement：`TECH-005`、`TECH-007`、`TECH-008`、`UI-029`

## 背景

Service Worker 可以离线恢复 HTML 壳层，但 `fetch('locales/*.json')` 的 `request.destination` 为空。旧策略只缓存 image/style/script/font/manifest，因此网络断开且没有运行时词典时，i18n 返回空对象，界面直接显示 `app_title`、`nav_games` 等 key。

## 决策

- 安装时显式预缓存 `zh-CN`、`en-US`、`uk-UA` 三份完整词典。
- locale 不进入通用 `SHELL/cache.addAll()`；安装时以 `cache: no-cache` 单独获取，并只接受同源 `basic`、成功、`application/json`、非 `no-store` 响应。任一词典无效会删除新 generation 半成品并拒绝安装，旧 active cache 保持不变。
- 精确 locale 运行时采用 network-first；在线成功会刷新离线词典，网络/响应失败回退最后合法 cache。Cache Storage 写入失败不丢弃本次有效在线响应。
- 运行时只接受相对当前 worker 的同源、无 query、GET、精确三语 URL。
- `privateRequest` 必须先于 locale 和通用静态缓存判断。
- 通用 destination 缓存显式排除所有 `.json`；API、WS、Authorization、Chat、Token 和其他 JSON 继续不缓存。
- 成功导航响应只有 `Content-Type: text/html` 才能覆盖离线 `index.html`。
- Cache generation 以 v13 原子升级；不强制 `skipWaiting()`，避免正在进行的对局被新 worker 中途接管。

## 不在范围内

- 不预缓存 Three、GSAP、Ghost3D entry、GLB 或未审批美术。
- 不实现完整离线游戏、离线账号或离线联机。
- 不解除真机、第二浏览器、真实网络或发布 Gate。

## 替代方案

- 把 `json` 加入通用 destination：拒绝，会扩大敏感 JSON 缓存面。
- i18n 内嵌所有词典到 HTML：拒绝，会放大首屏并重复数据。
- 安装后立即 `skipWaiting()`：拒绝，可能让活跃对局跨版本运行。

## 证据与验收

- 本地合同/测试：`qa/pwa-offline-i18n.js`、`qa/production-readiness-contract.js`、六款 Ghost3D cache QA、`npm run quality:gates`、完整 `npm test`。
- 单浏览器证据：`requirements/active/pwa-offline-i18n-repair-p1-20260815/evidence/local-browser-offline-i18n-20260815.json`。
- 外部门禁：第二浏览器、物理 Android/iPhone/Tablet 和真实网络为 `NOT_EXECUTED / BLOCKED`。

## 风险、兼容与回滚

- 旧 generation 正在控制的标签页会让 v13 保持 waiting；用户关闭最后一个旧客户端并重新进入后才激活。这是避免对局中途切换的兼容选择。本地复核真实经历 v11 → 未收口 v12 → v13，两次都未强制 `skipWaiting()`。
- 回滚时恢复上一版 `public/sw.js` 与 cache generation；三份公开 locale 不含账号或用户数据，删除 v13 cache 不影响权威数据。

## 后续动作

- 在真机 PWA 更新矩阵中验证旧标签关闭/重新进入、后台恢复和离线三语。
- 若未来词典版本独立演进，先建立版本一致性合同，不将任意 JSON 纳入缓存。
