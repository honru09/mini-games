# PWA / 跨平台 Web 基线

状态：`VERIFIED_LOCAL_CONTRACT`

- `public/manifest.webmanifest`：Ghost Game 安装名、scope、standalone、192/512 PNG 与 SVG 品牌图标。
- `public/index-template.html`：Apple touch icon 指向 192px PNG。
- `public/sw.js`：HTML network-first、版本化静态缓存、旧缓存清理。
- API、WebSocket、Authorization、token/session/message/chat 查询不缓存。
- 昼夜切换同步浏览器 `theme-color`。
- `qa/production-readiness-contract.js`、DOM、Build Drift、`npm run quality:gates` 与 182.9 秒完整 `npm test` 通过。

边界：这是网页/PWA 跨桌面与移动安装基线，不等于微信小程序、iOS/Android 原生包或应用商店发布；后者需要账号、证书、域名配置、真机与商店审核。
