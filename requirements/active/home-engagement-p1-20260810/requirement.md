# Home Engagement P1：首页社交与收藏脉冲

状态：`LOCAL_ACCEPTED_AWAITING_MASTER_INTEGRATION`
时间：2026-08-10（Asia/Tokyo）

## Goal

为正式账号首页添加一张可关闭、按本地日期恢复的“社交与收藏脉冲”卡，让玩家温和地看到已有在线好友、已有成长方向和本人收藏的安全聚合进度，并能直接前往既有 Profile、Chat、Shop。

## IN

- 首页新增语义化、可关闭的脉冲卡；只对 `account && !account.ephemeral` 显示。
- 只读消费 `CollectionRarityCatalog.deriveOwnedCollection(account.owned)` 的聚合结果，以及 `online.socialState.friends` 的已有 presence。
- 展示已有成长方向，不创建或计算新的奖励、目标、稀有度或社交关系。
- 本地、按账号和本地日期保存关闭状态；`localStorage` 不可用时安全退化为不持久关闭。
- 三语、双主题、键盘、可访问关闭按钮、最小 44px 控件与手机单列布局。
- 复用既有 Profile / Chat / Shop 路由动作。

## OUT

- 不修改 server、协议、WebSocket、数据库、Supabase、购买、价格、奖励、规则、AI、Replay、assets 或未审批美术。
- 不显示或写入 owned ID、余额、价格、购买记录、好友名单、私聊正文或任何新持久用户数据。
- 不增加自动开局、自动购买、弹窗、推送、排名比较、羞辱性或强迫性文案。
- 不提交、推送或部署。

## Non-negotiable

1. 收藏内容只能是目录已知项的聚合数和目录总数；不得把单个 ID 或商业字段写入首页 DOM。
2. 关闭状态仅为本地展示偏好，按账号和当地日期隔离；异常 storage 不得打断首页渲染。
3. 访客和未登录状态不能读取或展示任何私有收藏/社交聚合。
4. 所有新增系统文字必须在三份 locale 中同构；动态用户原文不得进入本功能。

## Known Existing Behavior

- Home Engagement P0 已有推荐游戏、成长目标和 Games/Profile 路由。
- `CollectionRarityCatalog` 已在浏览器构建中、只读、不可由价格推导。
- `online.socialState` 已在登录会话中维护好友 presence；没有时使用安全空值。

## Expected UX

- 正式账号在首页看到一张平静的“社交与收藏脉冲”卡：在线好友数量、收藏编目进度与当前既有成长方向。
- 三个明确动作分别前往个人主页、玩家聊天和商城；不触发任何 mutation。
- 点击关闭后该账号当天不再看到卡；次日自动恢复。关闭后焦点回到已有首页推荐入口。
- 访客与未登录玩家不会看到这张私有卡，首页既有 P0 引导保持不变。
