# Home Engagement P1 Recon

状态：`RECON_COMPLETE`
时间：2026-08-10（Asia/Tokyo）

## Current State

- Home Engagement P0 已在 `renderGhostHome()` 提供三步引导、推荐游戏和只读成长目标；正式账号与访客已有安全分流。
- `CollectionRarityCatalog` 已在前端构建中加载，只能从 `account.owned` 产出编目数量、目录总数和固定稀有度聚合；它不读取价格、余额或购买记录。
- `online.socialState.friends` 是已有的前端社交状态，好友 presence 已用于 Profile/Chat 的只读展示。
- 工作树很脏且含多个未发布任务；本任务只允许触碰指定的首页、三语、QA 和 task-record 文件，不能覆盖其他改动。

## Hot Files

- `public/src/core/02-app-shell.js`：首页动态渲染及既有路由动作。
- `public/index-template.html`：首页结构、双主题 CSS 和响应式规则。
- `public/locales/*.json`：三语同构词典。
- `package.json`：专项 QA 注册。

## Shared Files

- 只读消费者：`shared/progression/collection-rarity-catalog.js`。
- 只读状态：`online.socialState`、`account.owned`、现有成长字段。
- 不修改 server、WebSocket、商城、规则、Reward、AI、Replay、Supabase 或 assets。

## Generated Files

- `public/index.html` 是构建产物，绝不手改；验证阶段由 `node scripts/build.js` 生成。

## Likely Conflicts

- 多个未提交任务也改动 App Shell、模板、三语与 package；补丁必须最小且仅附加本纵切，不重排或格式化周边。
- `CollectionRarityCatalog` 只允许本地本人聚合；不能将 owned ID 传入 DOM，不能把它带到公共 Profile 或协议。

## Existing Tests

- `qa/home-engagement-contract.js`：P0 推荐、成长、访客与路由回归。
- `qa/collection-rarity-catalog.js`：目录显式性、本人 Profile/商城安全消费者和公开泄漏边界。
- `qa/profile-journey.js`、`qa/profile-compare-contract.js`：既有成长与隐私回归。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`node qa/ghost-shell-contract.js`、商城/Profile 合同：共享 UI 回归。

## Relevant Requirements

- Home Engagement P0：只读、非强迫、三语、移动端和无服务器 mutation。
- Profile Journey P1：成长信息只读、无羞辱/虚假稀有度。
- Profile Compare P1：公开/好友比较不可扩张为 owned、余额或购买记录。
- Collection Rarity Catalog P1：只能使用聚合、绝不价格推导。

## Risk Level

`MEDIUM`：实现本身是 client-only UI，但 Home Shell、模板、词典与构建产物都被其他本地任务共同使用。以静态边界测试、动态状态矩阵和既有跨页回归降低风险。
