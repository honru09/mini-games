# Shared Change Request — `scripts/build.js`

状态：`INTEGRATED_UNDER_MASTER_DELEGATION_AND_VERIFIED_LOCAL`

## Requested change

在既有 `victory-mastery.js` 与 `profile-journey.js` 之后、`core/02-app-shell.js` 之前追加：

```js
'../../shared/progression/collection-rarity-catalog.js',
```

## Why

`CollectionRarityCatalog` 是无副作用 UMD 纯展示模块。本任务的本人 Profile 与商城消费者需要在单一 browser build 中读取它；不加载时消费者会安全隐藏稀有度，不影响购买或装备。

## Consumers and compatibility

- `public/src/core/02-app-shell.js`: 只读本机 `account.owned`，显示目录进度/分布。
- `public/src/shop/06-shop.js`: 只读 item ID，显示标签。
- 无服务器、WebSocket、Supabase、价格、owned 写入、装备或奖励消费者。

## Verification / rollback

- 已运行 build、专项 catalog QA、i18n、DOM、Shop/Profile 回归与 Build Drift gates，均通过。
- 回滚仅删除此一 MODULES 条目和两个只读消费者；无数据迁移。
