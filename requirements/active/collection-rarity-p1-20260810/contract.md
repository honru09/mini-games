# Collection Rarity Catalog P1 冻结合同

## Pure catalog

- 模块名：`CollectionRarityCatalog`；`schemaVersion: 1`。
- 键：`category + stable numeric id`；允许类别仅为 `avatars`、`frames`、`effects`、`backgrounds`、`game_cosmetics`。
- 层级仅为 `starter`、`uncommon`、`rare`、`epic`，顺序固定且不从价格或其他商品字段计算。
- `entryFor(category, id)` 对未知、继承属性、Symbol、对象和越界值返回 `null`，不抛异常、不猜级别。
- `deriveOwnedCollection(owned)` 只读取自身数组属性，按类别/ID 去重，返回冻结的 `ownedCount`、`catalogCount`、`unknownOwnedCount` 和每档计数；不返回 price、coins、purchase、reward、ledger 或时间信息。

## Consumers

- 本人 Profile 只传入 `account.owned`，仅本地渲染。
- 商城卡只用 `entryFor(category,item.id)` 读取标签；未识别项不显示伪造标签。
- 不触碰公开 Profile / `profile_compare` / WebSocket / 服务器投影。

## Compatibility and rollback

- 老 owned ID 或损坏数据保持原有 owned 计数，不影响购买、装备或展示；只在稀有度区计为未编目。
- 回滚为移除 browser build 中的纯模块与两个消费者；不会留下任何持久化或协议状态。
