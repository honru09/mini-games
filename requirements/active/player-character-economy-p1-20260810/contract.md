# Player Character Economy v1 Contract

## 1. Domain terms

- **Character slot**：`body | face | hair | top | bottom | footwear | accessory` 之一。slot 是 presentation seam，不是游戏实体或规则字段。
- **commerceId**：服务端商城使用的整数商品 ID。它是购买/owned/requestId 事务的键，不等同于 `runtimeId` 或美术文件路径。
- **runtimeId**：角色渲染层消费的白名单 ID，例如 P0 默认的 `body-paper-01`；未知 runtimeId 必须回退默认。
- **owned**：服务端确认已拥有的 commerceId 集合。客户端只能读取，不能提交为权威状态。
- **equipped**：服务端从已拥有商品解析出的 slot → commerceId 选择；公开侧只看解析后的 `player-character-v1` 投影。
- **public projection**：可发给本人 Profile、公开 Profile、Seat 或未来游戏 renderer 的最小对象；不带经济字段。

## 2. Private adapter shape (proposed, not wired)

角色经济适配器只允许在现有 Profile/owned 容器内增量保存，候选形状如下；本批不写入生产档案：

```json
{
  "owned": {
    "player_character": [3001, 3301]
  },
  "playerCharacter": {
    "schemaVersion": "player-character-v1",
    "characterId": "character-base-01",
    "slots": {
      "body": "body-paper-01",
      "face": "face-dot-01",
      "hair": "hair-none",
      "top": "top-hoodie-01",
      "bottom": "bottom-shorts-01",
      "footwear": "footwear-sneakers-01",
      "accessory": "accessory-none"
    }
  }
}
```

- `player_character` 是**预留类别名**，当前没有被 `SHOP_PRICES` 或 `apply_purchase_v1` 激活。
- `3000–3999` 仅为未来角色商品的保留 ID 命名空间，不代表商品已售卖；当前 active catalog 为空。
- 价格不在本模块复制。未来接入必须从服务端 `SHOP_PRICES`/等价 RPC 读取同一 expected price，并拒绝客户端 `price`。

## 3. Pure module interface

`server/player-character-economy.js` exports frozen constants and side-effect-free functions:

- `normalizeEconomyState(value, options?)`：过滤 owned、解析已拥有装备，返回新对象；未知/访客/旧值使用 P0 默认角色。
- `publicProjection(value)`：调用 P0 安全投影，只保留 `schemaVersion/characterId/slots`。
- `validatePurchaseIntent(input, options?)`：校验预留类别、整数 commerceId、requestId 形状和服务端价格 resolver；不扣币、不发放商品。未激活目录返回 `catalog_not_enabled`。
- `equipOwned(state, commerceId, options?)`：仅在服务端已确认 owned 且目录项 active 时生成新 equipped 状态；否则返回默认/fallback 原因。
- `rememberRequest(state, requestId)` / `hasRequest(state, requestId)`：无副作用地维护最多 100 条 requestId，供未来原子事务适配；重复只分类为 replay，不重复授予或扣款。

`options.catalog` 只用于未来 Master 集成或纯测试注入；默认生产目录为空，避免在 ART-036/真实价格/RPC 未完成时误激活商品。

## 4. Public projection

```json
{
  "schemaVersion": "player-character-v1",
  "characterId": "character-base-01",
  "slots": {
    "body": "body-paper-01",
    "face": "face-dot-01",
    "hair": "hair-none",
    "top": "top-hoodie-01",
    "bottom": "bottom-shorts-01",
    "footwear": "footwear-sneakers-01",
    "accessory": "accessory-none"
  }
}
```

经济字段 (`owned`, `coins`, `price`, `purchaseRequests`, `requestId`, `equipped` 的内部 commerceId、token/PIN/password) 永不离开 authority 层。任何接收者拿到未知 ID 都按 P0 fallback 渲染。

## 5. Purchase/equip authority seam

未来正式接入必须按下列顺序执行：

1. 服务端先用现有 requestId 规则和账号身份校验请求；访客、AI、观众、过期 session 拒绝。
2. 服务端从唯一商品目录解析 category/commerceId/expected price；客户端 price 只作不可信提示。
3. 在账号锁/RPC 事务内检查重复 requestId、owned、余额，成功后才追加 owned 和经济流水。
4. 事务成功返回后，服务端调用 `equipOwned` 解析 slot；客户端只接收 `publicProjection`。

当前 `apply_purchase_v1` 没有 `player_character` 分支，步骤 2–3 尚不能执行；不得通过 `avatars`/`game_cosmetics` 借道。

## 6. Failure matrix

| 输入/状态 | 结果 |
|---|---|
| 缺/旧 schema | P0 default projection；不改 uid/资产 |
| 未知 commerceId / runtimeId | 丢弃该项，slot 回 default |
| owned 不是数组、污染键、超长值 | 空 owned + default projection |
| 访客/ephemeral | 不产生持久收藏或装备；default projection |
| requestId 缺失 | 由未来服务端生成一次性 ID；纯模块不自行扣款 |
| requestId 畸形 | `invalid_purchase_id`，无状态变化 |
| 重复 requestId | `replayed: true`，无二次扣款/授予 |
| 未拥有却 equip | `not_owned`，保留原装备/default |
| 并发调用 | 每次返回隔离新值；真正余额/锁由 RPC 保证 |
| 目录未激活 | `catalog_not_enabled`，不改变现有商城 |

## 7. Non-Pay-to-Win invariant

角色数据只可被 presentation consumer 读取。任何 server/gameplay path 不得读取角色 slot 来决定合法动作、伤害、速度、骰子、匹配、奖励、XP、胜场、AI 候选或 Replay 内容；角色资源失败只能回退视觉。

