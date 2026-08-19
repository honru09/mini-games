# G Coins 命名与统一货币显示 P0

## 目标

冻结 Ghost Game 平台货币的正式用户可见名称为 **G Coins**，并让余额、价格、奖励、排行榜和档案等界面通过同一货币显示 seam 渲染。内部 `coins`、`currency` 字段、奖励数值、商城价格、Supabase 列名与既有协议保持兼容，不在本任务中改经济规则。

## 范围

- 正式显示名：`G Coins`（三语言保持品牌名不翻译）。
- 旧 `💵` 仅作为资源加载失败时的视觉 fallback 与历史数据/测试兼容符号，不再作为正式名称。
- 统一 `currencyIcon()` 的资源、ARIA、fallback 和 `currencyAmountText()` 文本 seam。
- 货币政策：仅限 Ghost Game 平台内使用；不可兑换现金、不可提现、不可转赠。
- G Coins 图标源稿登记到素材库；当前具体候选在取得逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE` 前保持 `source-only/reference-only`。满足 M0 North Star、稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚后可进入可逆 runtime manifest 候选；人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 仅为可选咨询。

## 非范围

- 不调整 Reward Resolver 数值、每日上限、商城价格、购买扣款、胜场/XP、Supabase schema/RPC、AI、Replay 或部署。
- 不把尚未取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 的原创 PNG 或任何 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材接入 `public/assets`；所有者清除后的原创候选仍须保留 flag、fallback 与一键回滚。

## 验收

1. 三语言 locale 均存在同构的 `currency_name`、`currency_aria` 与 `currency_legal`。
2. `currencyIcon()` 是唯一运行时图标入口；文本余额/价格使用 `currencyAmountText()` 或既有 icon + 数值组合。
3. 内部字段和数值回归全部保持原样；旧 `💵` fallback 仍可用。
4. G Coins 源稿有 Prompt/provenance、SHA-256、尺寸和 reference-only 状态；生产 Manifest 不引用它。
5. `npm run test:i18n`、货币专项、素材库审计、构建与完整 `npm test` 通过。
