# UI Repair P0.6 访客持久化动作提示收口

时间：2026-08-10 10:27（本地工作树）

## 完成内容

- 访客可打开商城并查看商品、价格和身份组合预览，不再被商城入口直接挡住。
- 所有未拥有商品的购买按钮显示 `aria-disabled`、三语言 title 与访客说明；点击只显示说明，不发送 `purchase`。
- `requestPurchase()` 增加直接调用保护，避免脚本或遗漏入口绕过 UI。
- 好友请求/接受/拒绝/取消、移除好友、Block/Unblock、Report 和主动邀请均在控件层显示访客不可持久化状态。
- 对应客户端方法在 WebSocket `send` 前再次阻断；访客局内表达的举报入口退化为只读气泡。
- 收到的房间邀请仍可接受/拒绝，加入房间、临时游戏和只读公开资料不受影响。
- 服务端 `requirePersistentUser()` 未改，继续作为永久购买和社交关系的最终权限边界。

## 主负责人审核与修正

Terra Max 子 agent 已按要求创建并分配只读审查，但其回传在代理通道中持续变成不可读的加密载荷，已被中断，未采用其任何不可审核结论或代码。主负责人亲自完成代码审查、实现和动态 VM 回归。

审核时特别修正两点：一是允许访客进入商城只读浏览，避免“完全挡住”造成的死路；二是保留收到的房间邀请与临时游戏行为，只阻断永久购买和社交关系类 mutation。

## 测试

- `node qa/ui-guest-affordance-contract.js`：通过（15 项）
- `node qa/ui-profile-social-contract.js`：通过
- `npm run test:shop-contract`：通过
- `npm run test:i18n`：通过
- `node qa/dom-smoke.js`：通过
- `npm run quality:gates`：通过（首次构建漂移后重新生成并稳定通过）
- 完整 `npm test`：通过，131.0 秒

## 构建证据

- `public/index.html`：917621 bytes
- SHA-256：`810A5D419A31AA796238E7B47D93CCBA08246CDBBD65BE47CF71D6A43780B7A8`

## 后续

下一独立小批为 UI Repair P0.7：公开 Profile 不在排行榜缓存时的权威加载态。第二桌面浏览器、Android/iPhone/Tablet、真实网络整形仍是外部闸门。当前未提交、未推送、未发布 GitHub Pages、未部署 Render。
