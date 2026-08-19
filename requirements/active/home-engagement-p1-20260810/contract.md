# Home Engagement P1 冻结合同

## Presentation boundary

1. `renderGhostHome()` 是唯一运行时消费者；卡片不能新增消息类型、HTTP 请求、服务器 mutation 或新数据库字段。
2. 正式账号才可读取 `account.owned` 并调用 `CollectionRarityCatalog.deriveOwnedCollection`；结果仅投影 `ownedCount`、`catalogCount` 和可选固定稀有度聚合，禁止 ID/价格/余额/购买记录。
3. 在线好友数只从已有 `online.socialState.friends` 的 presence 聚合；不渲染姓名、UID、关系明细或私聊内容。
4. 成长方向只复用 P0 已有 level/streak/recommended-game 文案，不写入进度。

## Local dismissal

1. key 必须同时由本地日期与正式账号身份组成；不同账号当天互不影响。
2. 读取、写入、日期/身份异常与 `localStorage` 拒绝都必须安全返回；失败时卡片保持可见，不报错、不降级到服务器。
3. 次日 key 不同，因此卡片自动恢复；不必清理历史 key。

## Interactions and accessibility

1. Close 是真实 `<button type="button">`，带本地化 `aria-label`、不小于 44px，关闭后把焦点交回可见首页入口。
2. Profile、Chat、Shop 三动作只能调用已有 `setAppRoute('profile')`、`setAppRoute('chat')`、`openShop()`。
3. 卡片在 `<=640px` 单列，主题只使用现有 CSS 令牌；`prefers-reduced-motion` 下不依赖动画理解。

## Compatibility and rollback

- 缺失 `CollectionRarityCatalog`、收藏、好友、presence、路由或 storage 时安全隐藏对应值或使用零值；首页其余部分照常工作。
- 回滚只需移除本卡、闭包 helper、词典和 QA；无数据迁移、协议状态或服务端补偿。
