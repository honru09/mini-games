# Home Identity P1 Recon

状态：`RECON_COMPLETE`
时间：2026-08-10（Asia/Tokyo）

## Current State

- Home Engagement P0/P1 已提供 Hero、推荐/成长入口，以及正式账号-only 的 `#home-engagement-pulse` 社交/收藏聚合卡。
- `renderGhostHome()` 是首页动态渲染入口；当前 pulse 已从 `CollectionRarityCatalog.deriveOwnedCollection(account.owned)` 读取聚合 X/Y，并从既有 `online.socialState.friends` 读取 presence 数量。
- `avatarStageNode(profile, size, extraCls)` 与 `nameFxNode(profile, name)` 已是现有身份呈现 seam；Profile/Shop/Seat 已使用它们。`profile_level_short` 已在三语词典中提供 `Lv.%s`/等价本地化格式。
- `CollectionRarityCatalog` 是只读目录，返回 `ownedCount/catalogCount` 等聚合，不返回价格、余额、购买或 ID 投影。
- 工作树包含大量其他未发布改动；本批次只附加 Home pulse 内的身份条，不覆盖周边任务。

## Hot Files

- `public/src/core/02-app-shell.js`：`renderGhostHome()`、既有 pulse 账号/收藏/导航 seam。
- `public/index-template.html`：pulse markup、token CSS、响应式断点。
- `public/locales/zh-CN.json`、`en-US.json`、`uk-UA.json`：新增身份条系统文案。
- `qa/home-identity-p1-contract.js`：本批次静态边界与动态 VM 行为合同。
- `package.json`：专项脚本注册；保留现有脏树脚本内容。

## Shared Files

- 只读消费者：`public/src/ui/07-roster.js`（`avatarStageNode`/`nameFxNode`）、`shared/progression/collection-rarity-catalog.js`。
- 只读状态：`account`、已有 pulse X/Y、`online.socialState`、现有 `setAppRoute`/`openShop`。
- `public/index.html` 仅由 `node scripts/build.js` 生成，禁止手改。

## Generated Files

- `public/index.html` 是构建产物；实现与测试不得直接编辑。

## Likely Conflicts

- `02-app-shell.js`、模板、三语和 `package.json` 已被其他本地批次修改；补丁必须是最小附加，不格式化/重排邻近内容。
- 访客/未登录分支必须在调用 `avatarStageNode` 或读取 `owned` 之前短路；缺 catalog/owned 只能安全降级而不能抛错。
- 不能把身份展示误扩展为商品详情、经济字段、player-character/game-cosmetics 投影或新的首页卡。

## Existing Tests

- `qa/home-engagement-contract.js`、`qa/home-engagement-p1-contract.js`：Home P0/P1 既有导航、聚合、访客和 dismiss 回归。
- `qa/collection-rarity-catalog.js`、`qa/victory-mastery.js`、`qa/ui-identity-preview-contract.js`、`qa/profile-route-contract.js`：目录、成长、身份预览和 Profile 路由边界。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`node qa/ui-responsive-contract.js`、`node qa/ghost-shell-contract.js`：共享 UI 回归。

## Relevant Requirements

- UI-011：首页个性化展示与获得路径；本批次只实现已装备身份组合与等级入口，不实现购买/获得逻辑。
- Home Engagement P1：继续复用 pulse 的收藏 X/Y、Profile、Shop 动作；正式账号-only、只读、三语、移动单列。
- Collection Rarity P1：只消费安全聚合，不暴露 owned ID 或商业字段。
- Progression Identity P1：等级/称号是只读投影；本批次仅显示既有本地化等级短标签。

## Risk Level

`MEDIUM`：client-only 轻量 UI，但 Home Shell、三语、构建产物和账号私有边界共享度高。以红测、动态账号矩阵、静态隐私扫描和指定回归降低风险。

