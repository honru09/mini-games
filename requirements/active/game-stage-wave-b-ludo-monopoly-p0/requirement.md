# Game Stage Wave B：飞行棋 + 大富翁 P0

状态：`REQUIREMENT_FROZEN`

## Goal

在既有统一 Game Stage 和 Wave A 回滚基线上，把飞行棋与大富翁从“棋盘放进网页”推进到真正可读的代码原生对局舞台：一眼识别棋盘、当前玩家、下一操作、骰子、排名/地产/机会卡/拍卖状态；保持经典规则与既有联机安全边界。

## IN

- 飞行棋：实体路线、骰子、掷骰/选棋状态、当前回合、排名、观战/等待状态。
- 大富翁：实体棋盘、骰子、当前回合、地产/机会卡/支付/拍卖状态、交易不可用说明、角色 fallback。
- 统一 Wave B flag、Wave A 严格回滚、storage 异常 fail-closed、桌面/平板/手机/低高度横屏布局、三语、ARIA、reduced-motion 和 safe-area。
- 共享模板中的代码原生布局只消费稳定 seam，不读取未审批美术或经济私有字段。

## OUT

- 服务器、WebSocket、规则、AI、奖励、Replay、商城、数据库、Authority、角色公开投影协议。
- Honru Emoji、ART-034/ART-036 正式素材、交易 Authority、远端素材和 GSAP 运行时依赖。

## Completion

两款游戏专项合同、共享布局合同、既有规则/AI/表现回归和完整构建通过；当前只完成本地 `implemented`，因浏览器连接器保存权限、第二浏览器、真机和真实网络门禁未执行，不能声明 `verified` 或发布。
