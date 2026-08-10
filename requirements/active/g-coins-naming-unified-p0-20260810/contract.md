# G Coins P0 合同

## 稳定契约

```text
displayName = "G Coins"
legacyFallback = "💵"
internalBalanceField = "coins"
internalRewardField = "currency"
```

`displayName` 是品牌名，zh-CN / en-US / uk-UA 均保留 `G Coins`；解释性法律文案随语言翻译。`legacyFallback` 只在图标加载失败或旧兼容测试中出现。

### 运行时 seam

- `currencyIcon(sizeClass?)` 创建带 `role="img"`、本地化 `aria-label`、项目图标和 `💵` fallback 的节点。
- `currencyName()` 返回本地化品牌名，词典缺失时安全回退 `G Coins`。
- `currencyAmountText(value, { signed? })` 只格式化显示文本，不改变数值；示例 `+3 G Coins`、`10 G Coins`。
- 任何 server message、奖励、商城或 Profile 逻辑仍使用原字段；UI 层不得读取或写入新 `gCoins` 字段。

### 资产门禁

`gcoins-source-chroma-v1.png` 是最高质量模型生成的 source-only 色键母图，尺寸 1254×1254，状态 `reference-only`。抠图、人工清稿、Reviewer B、IP Review、Golden Set 和 runtime 转换均是后续独立门禁。

## 回滚

移除 `currencyName/currencyAmountText` 调用即可回到 `💵` 文本；`currencyIcon` 的 `currency_cash.svg` 与旧字段不变。不得通过回滚删除素材源稿或 provenance。
