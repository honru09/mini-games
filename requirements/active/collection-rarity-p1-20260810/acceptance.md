# Collection Rarity Catalog P1 验收

- [x] 专项 QA 证明目录覆盖当前 `SHOP`、`PLAYROOM_AVATARS`、默认免费 `avatar 0–29`、默认 `frame/effect/background 0` 与游戏外观稳定 ID，共 150 项且无重复/漏项。
- [x] 专项 QA 证明目录及派生结果冻结，异常输入安全，未知 ID 不被分级。
- [x] 专项 QA 证明源代码没有以 `price` 推导稀有度，也不输出商业/购买字段。
- [x] 专项 QA 证明本人 Profile 使用本地 owned 显示目录进度/分布，公开 Profile/好友比较不消费 owned。
- [x] 专项 QA 证明商城各类别可见卡使用稀有度标签，原购买/装备路径未改。
- [x] `npm run test:i18n`、`node qa/dom-smoke.js`、`node qa/shop-contract.js`、Profile 相关回归通过。
- [x] 生成构建只通过 `node scripts/build.js` 写入 `public/index.html`；不手改生成物。
- [ ] 浏览器连接器仍受本机保存权限阻断时如实记为 `NOT_EXECUTED`，不以静态 QA 代替可见验收。

主负责人修正 Terra 初版漏掉默认免费集合导致新账号误报“未编目”的问题，并增加正常 starter 账号零误报回归。完整 `npm test`：114.2 秒通过。双构建：962213 characters / 976327 physical bytes / SHA-256 `457169CB1982748D74CC2E1CBF145176802B0271D88A49B8B1963BC6712B7636`。
