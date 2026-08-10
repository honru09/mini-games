# Profile Journey P1：个人主页下一目标纵切

状态：`IMPLEMENTED_LOCAL_PENDING_EXTERNAL`
时间：2026-08-10（Asia/Tokyo）

## Goal

在已有 Profile P0 信息架构上增加明确、可操作的下一目标，不重复堆叠统计：最近胜场称号、成就进度、收藏规模分别直达现有 Games、成就和商城入口。

## IN

- 只读派生 `ProfileJourney`，消费服务端 Profile 中的 `wins/mastery`、已解锁成就和 owned 分类计数。
- 三张目标卡：最近可达称号、成就完成度、收藏件数。
- 确定性目标选择、异常输入安全、三语言、44px、手机单列。
- 所有操作复用既有路由/弹层，不新增 wire message。

## OUT

- 不做好友横向比较、排行榜施压或误导性稀有度。
- 不修改奖励、商城价格/购买、owned 写入、数据库、协议、规则、AI、Replay 或美术资产。
- 不提交、不推送、不部署。
