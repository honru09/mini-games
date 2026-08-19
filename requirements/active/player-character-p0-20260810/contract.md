# Player Character v1 Contract

## Module Interface

- `schemaVersion`: `player-character-v1`
- `normalizeStored(value)`: 接受未知存储值，返回新对象、固定字段、白名单 ID 与默认 fallback。
- `publicPresentation(value)`: 只返回公开装备投影；私有/未知字段全部丢弃。

## Stable Fields

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

## Authority / Privacy / Failure

- 服务端档案是唯一权威；P0 不接受客户端 `playerCharacter` 写入。
- Profile/Seat 只下发上述字段，不下发 owned、price、coins、xp、purchase history、token、PIN 或密码。
- 未知 schema、未知 ID、缺 slot、数组、原型污染键或超长字符串全部按字段回退默认值。
- 旧档案加载时补默认值但不改变 uid、昵称、资产、战绩、语言或 `gameCosmetics`。
- 客户端/资源失败时只回退确定性程序化角色，不影响规则、坐标、结果、奖励或 Replay。

## Future Consumers（不在 P0 实现）

- `ART-036`：角色/服装源稿与审批。
- `ECO-029`：收藏、购买、owned/equipped 权威事务。
- `GAME-045`：大富翁按服务端位置驱动行走、朝向、停靠与重连跳转。
- 坦克/棋盘未来只读同一公开投影，另立表现任务。
