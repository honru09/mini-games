# Avatar / 身份 / 动态背景 CLOSE P1 — RECON

## Current State

- `ART-020 / UI-022 / ECO-013` 已有圆形裁切、头像框、特效与商城组合预览，但身份构造分散在 Roster、Profile、Shop、Online 与 Playline。
- `ART-021 / UI-023 / ECO-014` 已有真实 animated WebP、poster → animated → poster/static fallback、IntersectionObserver、页面可见性、运行中 reduced-motion 和 release 清理；本批不重写该可靠生命周期。
- `SOC-001` 仍为 partial：排行榜/Profile/Seat 大部分入口已接入，但房间 Seat 在档案缓存未命中时丢 frame/effect/nameFx，邀请与私信列表/线程名、Playline 作者没有完整统一身份组合。
- Avatar v2 有 48 款多风格运行时资产；默认免费入口已策展为 100/101，历史已装备项继续兼容。Honru Pixel v3 四款仍是 source-only 候选。

## Hot Files

- `public/src/ui/07-roster.js`：Avatar 资产选择、Canvas fallback、frame/effect/nameFx 与兼容 Adapter。
- `public/src/online/03-websocket.js`：Seat、邀请、社交、房间浏览、排行榜消费者。
- `public/src/core/07-playline.js`：Playline 作者与 Direct Message 消费者。
- `public/src/shop/05-profile.js` / `public/src/shop/06-shop.js`：公开 Profile 与商城组合预览。
- `public/index-template.html`：Avatar/Frame/Effect/NameFx 和私信布局 CSS。

## Shared Files

- `public/src/core/06-assets.js`、三份 locale、`package.json`、`qa/dom-smoke.js`。
- `server/index.js` 已为 Seat、Social、Chat、Playline 下发权威公开外观字段；不得扩大成客户端权威。

## Generated Files

- `public/index.html` 只能由 `node scripts/build.js` 串行生成。
- 本批不生成新图片，不改 runtime Manifest/Catalog，不启用 source-only v3。

## Likely Conflicts

- 工作树含大量前序合法修改，热文件不可覆盖或格式化重写。
- `public/src/core/07-playline.js` 是 IIFE presenter，必须通过既有全局表现 seam 复用，不复制商城/档案逻辑。
- 头像动效不能在列表中无界自动运行；reduced-motion 与小尺寸默认静态。

## Existing Tests

- `qa/ui-identity-preview-contract.js`
- `qa/avatar-curation-background-contract.js`
- `qa/ui-profile-social-contract.js`
- `qa/ui-chat-presentation-contract.js`
- `qa/ui-playline-contract.js`
- `qa/shop-contract.js`
- `qa/dom-smoke.js` / `npm run test:i18n`

## Relevant Requirements

- 本批：`ART-020 / ART-021 / UI-022 / UI-023 / SOC-001 / ECO-013 / ECO-014`。
- 明确排除：`UI-037 / ART-036 / GAME-045`，它们属于大富翁角色 Renderer 主线。

## Risk Level

- **HIGH**：统一身份是跨 Home、Profile、Lobby、Seat、Social、Chat、Playline、Shop 的共享表现 seam；错误可造成玩家身份错配、XSS/raw 边界回归、动画过载或旧资产不可见。
- 回滚：消费者恢复使用兼容 `avatarStageNode/nameFxNode`，删除新增组合调用；不迁移账号、owned、商品、资产或协议数据。
