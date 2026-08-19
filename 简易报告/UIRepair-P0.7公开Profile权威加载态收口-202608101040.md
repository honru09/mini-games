# UI Repair P0.7 公开 Profile 权威加载态收口

时间：2026-08-10 10:40（本地工作树）

## 完成内容

- 当玩家不在 `lastServerLB.list` 时，`openProfileModal()` 改为调用既有 `profile_get`，不再直接提示“未找到”。
- 新增可取消、命名、带滚动锁的 Profile loading dialog，使用 `profile_loading` 三语文案。
- `online.requestProfile()` 记录 `pendingPublicProfileUid`；`profile_data` 按 UID 绑定成功/空响应，安全公开资料仍走现有缓存函数。
- 取消或切换对象后，迟到响应不会重新打开旧 Profile；null 响应会清理 loading 并显示本地化 not-found。
- 未修改 server profile projection、私有字段、社交协议、数据库、价格或任何游戏规则。

## 主负责人审核与修正

首版专项回归先捕获了一个真实边界：取消后迟到的 `profile_data` 仍会走旧的无 pending 渲染路径。已删除该回退分支，使所有 Profile 响应必须绑定当前 pending 请求；随后完整回归通过。

## 测试

- `node qa/ui-profile-loading-contract.js`：通过
- `node qa/ui-profile-social-contract.js`：通过
- `node qa/profile-route-contract.js`：通过
- `npm run test:i18n`：通过（1336 keys）
- `node qa/dom-smoke.js`：通过
- 完整 `npm test`：通过，172.2 秒

## 构建证据

- `public/index.html`：920073 bytes
- SHA-256：`492036CBC9783566C58FC81887533B6E275EFE947727C0BCDC470D3FBEBFA761`

## 后续与边界

下一独立 UI 批次为商城密度、试穿层级和商品卡视觉排版。第二桌面浏览器、Android/iPhone/Tablet、真实网络整形和 visible reduced-motion 仍是外部闸门。当前未提交、未推送、未发布 GitHub Pages、未部署 Render。
