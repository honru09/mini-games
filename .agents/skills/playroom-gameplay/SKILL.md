# playroom-gameplay

## 适用

修改六款游戏规则、AI、观战、序列化、动效、统计或重连时必须读取。

## 不可破坏的契约

- Logical State 与 Presentation State 分离；cosmetic 不得改变规则。
- `serialize()`/`deserialize()` 必须可恢复；`getMatchStats()` 只读且可审计。
- spectator 不能改变状态；reduced-motion 不能删掉规则反馈。
- 重连可直接渲染最终状态，不依赖旧动画重播才能恢复。
- 新规则必须有 Rule Core、Authority 边界、客户端回退和专项测试。

## 验收

至少运行目标游戏 Rule Core、Gameplay Upgrade、对应 authority、DOM 和 E2E 测试，并记录 PASS/NOT_EXECUTED。
