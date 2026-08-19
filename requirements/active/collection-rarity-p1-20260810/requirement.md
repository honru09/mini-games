# Collection Rarity Catalog P1：收藏稀有度展示目录

状态：`IMPLEMENTED_LOCAL_AUTOMATION_VERIFIED`
时间：2026-08-10（Asia/Tokyo）

## Goal

为现有稳定商城 ID 建立一个不可变、显式策展的只读稀有度目录；本人 Profile 显示收藏目录进度与稀有度分布，商城每张可见商品卡显示其三语稀有度。稀有度仅是展示信息，不参与价格、购买、装备、奖励或持久化。

## IN

- `avatars`、`frames`、`effects`、`backgrounds`、`game_cosmetics` 当前稳定 ID 的显式映射；包含新账号默认免费 `avatar 0–29` 与 `frame/effect/background 0`。
- 四档展示标签：`starter`、`uncommon`、`rare`、`epic`。
- 本人 Profile 的目录化收藏进度与分布；商城卡上的稀有度标签。
- 三语言、窄屏换行和 reduced-motion 下静态可读的样式。
- 纯模块、失败优先 QA、构建顺序变更请求。

## OUT

- 不按 `price`、金币、动画标志或任何可计算商业字段推导稀有度。
- 不改价格、购买、owned、equip、Reward、Supabase、服务端、规则、AI、Replay、协议、美术或资源 manifest。
- 不向公开 Profile、好友比较、排行榜、聊天或任何服务器消息增加 owned/稀有度字段。
- 不提交、推送或部署。

## Non-negotiable

1. 每个当前可见稳定商品 ID 必须在目录中由人工显式列出；未知/历史 ID 不得猜测稀有度。
2. 目录对象、条目和派生结果均须冻结；异常/继承/不可转换输入安全降级。
3. Profile 只消费本机 `account.owned`，公开档案与好友比较继续保持窄化投影。
4. 稀有度不可作为价格、掉率、竞争压力或购买暗示；界面只使用中性收藏文案。

## Known Existing Behavior

- `SHOP` 和 `PLAYROOM_AVATARS` 是当前浏览器商品/头像消费者，服务端 `SHOP_PRICES` 是购买权威。
- Profile Journey 只计算 owned 分类去重总数，不暴露购买记录、价格或他人 owned。
- 当前本人 Profile 的收藏区仅显示五类原始 owned 数量；商城卡已有名称、价格、购买和装备状态。

## Expected UX

- 本人 Profile：在“收藏”区看到“已编目 X / Y”及 Starter / Uncommon / Rare / Epic 的中性分布；无法识别的旧项只显示未编目数量，不被虚构分级。
- 商城：每张当前可见商品卡在名称附近看到可读、三语的稀有度小标签；原有价格、购买、拥有和装备操作不变。
