# Shared Change Request：G Coins 表现统一 P1

## Shared files

- `public/src/online/03-websocket.js`：只把在线排行榜与玩家列表的手工金额拼接替换为共享 `currencyAmountNode()`；消息、连接、重连、排序、字段与 mutation 均不变。
- `package.json` / `scripts/quality-gates.js`：仅登记新的确定性表现 QA。
- 控制面与文档：只在完成后同步真实状态。

## Compatibility

- `coins`、`currency`、`u.coins` 与所有协议 payload 原样保留。
- helper 不写状态、不缓存余额、不触发网络；旧 `currencyIcon()` 与 P-003/fallback 保留。
- 共享在线文件不新增/删除消息、不改变 callback、capability、房间或会话生命周期。

## Verification

- 静态检查在线文件只减少直接 `currencyIcon()` 手拼，并保留 `u.coins` 读取。
- 跑 G Coins 表现专项、现有 Social/DOM/Shop 回归、i18n、Quality Gates 与构建漂移。

## Rollback

只恢复两个在线消费者的旧 DOM 拼接；无需回滚协议、服务端、数据库或玩家数据。
