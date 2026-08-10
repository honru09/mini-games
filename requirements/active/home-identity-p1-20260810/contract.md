# Home Identity P1 冻结合同

## Presentation boundary

1. `renderGhostHome()` 是唯一运行时消费者；identity strip 必须挂在现有 `#home-engagement-pulse` 内，不能创建独立首页卡或新路由。
2. 正式账号门槛必须在所有私有读取与 `avatarStageNode` 调用之前成立：`account && !account.ephemeral`。
3. 头像由现有 `avatarStageNode(account, size)` 生成并在 identity section 设为 `aria-hidden="true"`；不得渲染装备 ID、商品名或未审批资源。
4. 昵称由 `nameFxNode(account, rawName)` 或 `textContent` 写入并标记 `data-i18n-raw`；昵称原文不进入 `t()`。
5. 等级由现有权威 `account.level` 做最小安全数值归一化，再通过本地化 `profile_level_short`（`Lv.%s`）显示；不得读取/显示 XP。

## Aggregate and fallback behavior

1. 既有收藏 X/Y 仍来自 `CollectionRarityCatalog.deriveOwnedCollection(account.owned)`；identity strip 不枚举 `owned`。
2. catalog 缺失、owned 缺失、派生抛错或 malformed account 时，身份条可隐藏/清空，pulse 其余内容和既有导航仍可用。
3. 访客/未登录必须保持 pulse 隐藏，且动态测试应证明 catalog spy 与 avatar helper 均未被调用。

## Interaction and accessibility

1. identity section 使用稳定 `aria-labelledby`/本地化 label；头像节点 `aria-hidden`，昵称节点 raw。
2. Profile、Chat、Shop 继续只调用现有 `setAppRoute`/`openShop`；不调用 `online.send`、`requestPurchase`、`saveAccount`。
3. 既有 close/navigation 控件保持至少 44px；identity strip 不添加动画；`prefers-reduced-motion` 下仍能理解全部信息。
4. `<=640px` identity strip 单列，昵称/等级可安全换行且不造成横向溢出。

## Privacy and rollback

- identity strip 不展示 coins、xp、价格、owned ID、商品名、购买记录、好友明细、playerCharacter slot/ID、gameCosmetics ID 或未审批图片。
- 回滚只需移除 identity markup、渲染小段、locale key 和专项 QA/package 注册；无服务端、协议、数据迁移或经济补偿。

