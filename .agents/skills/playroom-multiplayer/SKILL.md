# playroom-multiplayer

## 适用

修改 WebSocket、房间、观战、赛事、多人游戏、服务端结算或重连时必须读取。

## 协议前置

每个新消息必须写明 C→S/S→C、字段约束、Authority、幂等键、序列、重连快照、向后兼容、非法消息、频控和测试。
同步更新服务端 dispatcher、客户端 `onMessage`、协议注册表和 Authority Matrix。

## 安全边界

客户端只能提交输入/声明；位置、击杀、排名、奖励、金币、XP 和 owned 等权威字段由服务端确认。
任何重复 action、stale seq、跨房间身份、超大 payload 和错误 Origin 都必须有拒绝测试。

## 验收

运行 protocol、authority、security、reconnect、spectator、tournament 和 E2E；只要任一关键闸门未执行，状态不能为 `production-ready`。
