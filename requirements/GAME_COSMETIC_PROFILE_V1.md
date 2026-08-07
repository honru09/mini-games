# GAME_COSMETIC_PROFILE_V1

## 当前实现

Profile 保存 `cosmeticSchemaVersion=1` 与 `gameCosmetics`；Supabase 列为 `profiles.game_cosmetics jsonb`。六款游戏仅允许以下稳定 ID：

```json
{
  "gomoku": {"pieceSkin":"classic|glow"},
  "ludo": {"baseSkin":"classic|cyber","pieceSkin":"classic|jet","diceSkin":"classic|cyber"},
  "monopoly": {"tokenSkin":"character|car"},
  "tank": {"tankSkin":"classic|cyber"},
  "tetris": {"blockSkin":"classic|neon","backgroundSkin":"classic|grid"},
  "xiangqi": {"pieceSkin":"classic|jade"}
}
```

服务端对所有 Profile 输入执行白名单归一化；未知、缺失、旧数据均回退默认 ID。`started`、`rejoined` 与 spectator snapshot 只广播当前对局需要的公开装备 ID，并转换为各游戏已有 `setCosmetic()` 消费结构。

## 隐私与经济边界

- Public：`cosmeticSchemaVersion`、已装备游戏 Cosmetic ID。
- Private：`owned`、价格、余额、购买记录、PIN、session token。
- 比赛 Presentation 禁止包含任何 Private 字段。
- 当前这些原型外观不新增商城商品、价格或购买入口；本协议不修改平台 💵 经济。
- 外观不能改变 Hitbox、合法动作、随机种子、伤害、攻击、棋钟或结算。

验证：`qa/game-cosmetic-profile.js` 覆盖合法装备、未知 ID fallback、公开档案、双方 Match Metadata 一致性和私有字段隔离。
