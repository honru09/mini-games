# Collection Rarity P1 不可变目录收口

时间：2026-08-10 15:59（Asia/Tokyo）

## 完成内容

- 建立五类 `category + ID` 的不可变显式目录，共 150 项，固定 Starter / Uncommon / Rare / Epic 四档。
- 本人 Profile 显示已编目进度和四档分布；商城每张可见商品卡显示三语稀有度标签。
- 未识别旧项保持“未编目”，不猜测等级；公开 Profile、好友比较和服务器不读取 owned 稀有度。

## 主负责人审核修正

- Terra Max 初版只覆盖 117 项商城/Playroom ID，遗漏新账号默认拥有的 avatar 0–29 与 frame/effect/background 0。
- 主负责人先补红灯，再将这 33 项基础资产显式纳入 Starter，避免正常新账号出现虚假“未编目”提示。
- 目录源码不含 price、coins、purchase、reward 或 ledger 推导；四档只是策展展示，不是掉率、价值或购买建议。

## 验证

- 专项、pretest、三语言、DOM、商城价格、Profile、Shop 布局全部通过。
- 完整 `npm test`：114.2 秒通过。
- 双构建一致：962213 characters、976327 physical bytes、SHA-256 `457169CB1982748D74CC2E1CBF145176802B0271D88A49B8B1963BC6712B7636`。

## 边界

- 未修改价格、购买、owned、装备、奖励、Supabase、规则、AI、Replay、公开投影或美术。
- 第二浏览器、Android/iPhone/Tablet、真实网络、localhost 可见复核和线上发布仍未执行。

下一条独立本地主线：Home Engagement P1，只使用聚合安全数据做可关闭、非强迫提示。
