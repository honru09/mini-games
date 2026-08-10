# Home Identity P1：首页身份条

状态：`REQUIREMENT_FROZEN`
时间：2026-08-10（Asia/Tokyo）

## Goal

在既有 `#home-engagement-pulse` 内加入轻量 identity strip，让正式账号在首页看见当前已装备头像组合、昵称和本地化等级，同时保留既有收藏 X/Y、Profile 与 Shop 导航。该批次仅为本地只读展示。

## IN

- 仅在现有 `#home-engagement-pulse` 内增加一个语义化 identity section；不新增首页卡。
- 仅正式账号（`account && !account.ephemeral`）显示 identity strip。
- 通过现有 `avatarStageNode(account, size)` 显示当前 avatar/frame/effect；不把任何装备 ID/商品字段写入可见文本。
- 通过 `nameFxNode` 或 raw `textContent` 显示昵称，并标记玩家原文边界。
- 通过现有三语 `profile_level_short`（或同构新增 key）显示本地化 `Lv.N`。
- 继续使用 pulse 已有收藏 X/Y、`setAppRoute('profile')`、`setAppRoute('chat')` 与 `openShop()` 动作。
- 缺失 catalog、缺失/畸形 owned、storage 或可选呈现 helper 时安全降级，首页其余内容照常渲染。
- 语义标签、头像 `aria-hidden`、既有 44px 按钮、手机单列、无新增动画。

## OUT

- 不新增第三张首页卡，不改 Home P0/P1 的社交/收藏聚合语义或关闭逻辑。
- 不显示 coins、xp、价格、owned ID、商品名、购买记录、朋友明细、playerCharacter slot/ID、gameCosmetics ID 或未审批图片。
- 不调用 `online.send`、`requestPurchase`、`saveAccount`，不添加网络/协议/持久化状态。
- 不修改 server、online、reward、rules、AI、Replay、Supabase、assets、art-source 或生成的 `public/index.html`。
- 不实现购买、装备、获得路径或新的成长计算。

## Non-negotiable

1. 访客/未登录路径不得调用 `avatarStageNode`，也不得读取 `account.owned`；形式上必须先通过正式账号分支。
2. `avatarStageNode` 是唯一头像组合渲染 seam；身份条只展示其 DOM，不枚举 avatar/frame/effect ID。
3. 昵称必须走 raw `textContent`/`nameFxNode`，防止 i18n 覆盖用户原文；系统 label/等级必须走三语 key。
4. catalog/owned 缺失或抛错只能隐藏/清空可选身份与收藏值，不得中断首页。
5. 保持现有 pulse 三个动作、关闭焦点恢复、X/Y 聚合与本地/响应式合同。

## Known Existing Behavior

- `renderGhostHome()` 已在正式账号可见分支调用 `CollectionRarityCatalog.deriveOwnedCollection(account.owned)`，并渲染在线好友、收藏 X/Y、成长方向。
- `avatarStageNode`/`nameFxNode` 在 `07-roster.js` 已被 Profile、Shop、Seat 等消费者使用；无需改其实现。
- `profile_level_short` 已在三份 locale 同构，格式为本地化等级短标签。
- 既有 pulse 按账号/本地日期 dismiss，访客隐藏，三个按钮已有 44px 样式与路由动作。

## Expected UX

- 正式账号在 pulse 标题/指标下看到一个安静的身份条：头像组合、昵称和 `Lv.N`；avatar 是装饰性、昵称可被辅助技术读取。
- 收藏进度仍显示原有编目 `X / Y`，Profile/Shop 按钮行为不变。
- 访客/未登录看到原有 Home 引导与 pulse 隐藏状态，不触碰私有身份/owned。
- 在手机上身份条单列、可换行，不依赖动画理解；缺数据时保留安全空态或仅隐藏身份条。

