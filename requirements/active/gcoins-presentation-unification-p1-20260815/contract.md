# G Coins 表现深模块合同

> Historical-as-of 2026-08-15：本合同的 P-003 seam 仍是兼容 fallback；后续 owner-cleared `P-GCOINS-ICON-V1` runtime 不改变本合同的经济、协议与回滚边界。

## Stable authority

```text
displayName = G Coins
legacyFallback = 💵
runtimeAssetId = P-GCOINS-ICON-V1 (fallback P-003)
authorityFields = coins / currency
```

本批只负责 Presentation。数值来源、购买、奖励、幂等、流水、Supabase 与协议均不属于该模块。

## API

`currencyAmountNode(value, options?)` 返回一个复合金额节点：

- 可见结构固定为 decorative `currencyIcon()` + `.currency-amount-value`；
- 节点使用 atomic `role=img`，自身 `aria-label` 为完整 `currencyAmountText()` 或调用方传入的安全 `formattedText`；内部图标与数值均对辅助技术隐藏，避免 generic span 命名失效或重复朗读；
- `sizeClass` 只控制图标尺寸，`valueClass` 只追加数值样式类；
- `signed=true` 与 `currencyAmountText()` 同语义；
- 非有限数值回退 `0 G Coins`；
- `formattedText=∞ G Coins` 时只显示 `∞`，但读屏标签保留完整品牌名。
- `formattedText` 只接受以当前 `currencyName()` 结尾的完整可信金额；裸数字或畸形字符串自动回退由 `value` 生成的 `currencyAmountText()`，避免未来再次产生缺品牌名的可访问标签。

## Consumer rule

- 余额/价格/玩家列表等带图标金额不得直接调用 `currencyIcon()` 再手拼数字。
- Reward Breakdown 等纯文本句子继续使用 `currencyAmountText()` / `currencyName()`，不强行插入 DOM 图标。
- 内部 `coins`、比赛结果旧 `coins=1` 标志和 `reward.currency` 不重命名。

## Language and failure

- 三语言只新增稳定系统标签，不翻译 `G Coins` 品牌名。
- 金额节点的读屏标签不依赖资源加载；P-003 加载失败后显示既有 `💵` fallback，数值保持可见。
- 语言切换会通过既有表面重绘刷新外围标签；金额品牌名三语一致，不产生旧语言泄漏。

## Rollback

移除 `currencyAmountNode()` 消费并恢复原页面拼接即可回滚；不得删除 P-003、旧 fallback、P0/P1 source-only 素材、经济字段或历史证据。
