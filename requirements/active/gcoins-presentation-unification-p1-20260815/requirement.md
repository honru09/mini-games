# G Coins 当前构建表现统一 P1

> Historical-as-of 2026-08-15：本批次最初只验证 P-003。后续 `P-GCOINS-ICON-V1` 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并进入独立的本地可逆 runtime；当前状态以 `requirements/active/gcoins-source-redesign-p1-20260814/OWNER_AUTHORIZED_ART_CLEARANCE-20260816.md`、Manifest 与专项 runtime QA 为准。

状态：`LOCAL_IMPLEMENTED / SINGLE_BROWSER_PARTIAL / NOT_RELEASED`

## Goal

把 Home、Profile、Shop、排行榜、玩家列表与 Reward 中所有用户可见金额统一到一个深模块表现 seam，消除各页面自行拼接图标、数字、品牌名和管理员无限余额造成的格式与可访问性漂移，同时保持经济权威、数值、协议、字段和未审批美术完全不变。

## IN

- 在 `public/src/core/06-assets.js` 增加统一 `currencyAmountNode(value, options)`，复用稳定 `P-003` 图标、`G Coins` 品牌名和 `💵` 资源失败 fallback。
- 迁移 Home 私有身份卡、本人/公开 Profile、Profile 编辑器、Shop 余额与全部价格、全局/房间排行榜、玩家列表的手工 `currencyIcon + value` 组合。
- 正常余额、正负奖励、非数值输入和 Test Admin `∞ G Coins` 的确定性显示与 ARIA 合同。
- 图标在金额复合节点内为 decorative，复合节点提供唯一完整金额读屏标签，避免重复朗读。
- 仅在最后统一补三语言的余额/可用/档案元信息标签、CSS、QA、报告和三日志。

## OUT

- 不修改 `server/reward-engine.js`、商品价格、奖励阈值、`coins/currency` 字段、WebSocket 消息、Supabase、Test Admin 权限或玩家公开投影。
- 不把 G Coins P1 Candidate B 接入 `public/assets` 或 Manifest；`P-003` 与 `💵` fallback 保持。
- 不把文档/测试中的历史 `💵` 数值说明误判为产品 UI 缺陷。
- 不修改美术、游戏规则、Authority、Replay、AI、社交正文、账号或线上环境。

## Non-negotiable

- UI 只能格式化服务端/既有档案给出的数值，不得产生、扣除、纠正或缓存货币。
- Test Admin 无限余额只在既有私有身份表面显示，不能进入排行榜、公开档案、协议或数据库。
- `currencyIcon()` 仍是单图标兼容入口；金额消费者必须优先使用 `currencyAmountNode()`。
- 语言、主题和 reduced-motion 不改变金额事实；资源失败仍能看见合法 fallback。
- 未收到当前明确发布命令，不 commit、push、Pages 或 Render deploy。

## Known Existing Behavior

- 正式名称、文本 seam 和 P-003 已存在；三语言品牌名均为 `G Coins`。
- 当前运行时字面 `💵` 仅存在于 `CURRENCY` fallback 与历史错误映射，属于合法兼容边界。
- 10 个用户可见位置仍直接调用 `currencyIcon()` 并手工拼数字、余额、局数或价格；部分 fallback 使用 `G Coins 10`，与规范 `10 G Coins` 顺序不一致。
- Test Admin 的 `testAdminCurrencyText()` 返回 `∞ G Coins`，若再配单独图标/标签会出现视觉或读屏重复。

## Expected UX

所有页面都以同一稳定图标、同一数字字形和同一 `数值 + G Coins` 读屏语义显示余额与价格；管理员私有表面显示 `∞`，普通玩家保持真实数值。Shop、Profile、Home、排行榜和玩家列表不再因各自拼接而出现顺序、间距、重复品牌名或辅助技术重复朗读。
