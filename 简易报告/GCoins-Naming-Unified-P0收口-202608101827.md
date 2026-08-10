# G Coins Naming / Unified Currency P0 本地收口（2026-08-10 18:27）

## 结论

G Coins 已冻结为 Ghost Game 平台货币的正式用户可见品牌名。内部余额字段 `coins`、奖励字段 `currency`、奖励数值、商城价格、购买扣款、Supabase schema/RPC 和协议均未改变。

## 已完成

- 新增 `currencyName()` 与 `currencyAmountText()`，和既有 `currencyIcon()` 组成唯一显示 seam；商城价格、奖励总结、Profile 余额、好友邀请和档案货币统计均已迁移到该 seam。
- zh-CN / en-US / uk-UA 统一增加 `currency_name`、`currency_aria`、`currency_legal`；G Coins 品牌名不翻译，法律说明随界面语言切换。
- 旧 `💵` 保留为资源失败 fallback 和历史兼容符号，不再作为正式货币名称。
- G Coins 源稿已登记到 `asset-library/catalog.json`：1254×1254、SHA-256 `9D6D8870329B04B5A136F66449498656B7601BEE15AFBDABC2A73EAA030919AD`、Prompt/provenance 完整；状态为 `reference-only/source-only`，生产 Manifest 未引用。
- 服务端余额不足提示使用 G Coins 品牌名，`reason=insufficient_balance` 保持兼容。

## 验证

- `node qa/g-coins-contract.js`：ALL_PASS
- `npm run test:i18n`：ALL_PASS
- `node scripts/asset-library-audit.js`：ALL_PASS
- `node qa/dom-smoke.js`：ALL_PASS
- `npm run test:shop-contract`：ALL_PASS
- `node qa/reward-system.js`：ALL_PASS（奖励数值保持原样）
- `node qa/progress-ledger.js`：ALL_PASS（233 项、7 份报告、61 个来源）
- `node scripts/quality-gates.js`：ALL_PASS
- 完整 `npm test`：ALL_PASS（221 秒）
- 构建：`public/index.html` 990079 bytes，SHA-256 `E9516112DB8D4C47D1A79B5BB9FA0844162F6AB051B3679A3A1B9236110672F0`
- 连续双构建：同一长度与同一 SHA-256

## 未完成与门禁

G Coins PNG 尚未抠图/清稿，Reviewer B、IP Review、Golden Set 尚未执行；因此未生成运行时 WebP/SVG，也没有替换现有 P-003 生产图标。`ECO-012` 继续保持 partial：历史报告和测试说明中的 `💵` 只做兼容审计，不会在本批删除。

本批仅本地修改，未提交、未推送、未发布线上。
