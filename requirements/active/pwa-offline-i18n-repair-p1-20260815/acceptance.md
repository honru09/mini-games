# Acceptance

- [x] 红测稳定复现空 destination locale 未被 Service Worker 接管。
- [x] 三份 locale 在 GitHub Pages 子路径语义下离线命中真实词典。
- [x] query、Authorization、跨源、未知语言、POST、API、普通 JSON 与伪 script destination 均不缓存。
- [x] JSON 导航响应不能覆盖离线 HTML 壳层。
- [x] 六款 Ghost3D/GSAP lazy cache 合同保持。
- [x] 旧 v10 waiting 与关闭旧客户端后 v11 激活事实已记录。
- [x] v11 控制下断网启动与 zh-CN → en-US → uk-UA → zh-CN 均为 0 裸 key。
- [x] v13 将 locale 从通用 SHELL 分离，安装/运行时统一校验响应，在线刷新旧词典后离线仍保留新 key。
- [x] v11/v12 → v13 waiting/activate 真实本地链未强制 `skipWaiting()`；最终只保留 v13 cache。
- [x] 500、HTML、no-store、quota failure 与无 cache 503 分支均有 VM 回归。
- [ ] 第二真实桌面浏览器：`NOT_EXECUTED`。
- [ ] 物理 Android/iPhone/Tablet PWA 更新：`NOT_EXECUTED`。
- [ ] commit/push/deploy：`NOT_EXECUTED`。
