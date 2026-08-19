# 受控本地传输预检 P0 需求冻结

状态：`ACCEPTED_LOCAL_CONTROLLED_PREFLIGHT`

## 目标

在不冒充真实网络整形的前提下，用确定性本地调度覆盖 Tetris、Tank、Direct Chat 与 Room resume 的延迟、乱序、重复、断连和旧连接隔离 seam；同时修复审查中发现的 Tetris v3 重连后出站序号归零缺陷。

## 对应原子需求

- `TECH-030`：只增加 Acceptance Gap 的本地预检证据，状态继续 `blocked`。
- `GAME-048`：缺陷归回现有 Tetris 实现；状态继续 `implemented`。

## IN

- Tetris Authority 接受 `seq=1` 后提前到达 `seq=3`，重复 3 与迟到 2 不得改变权威状态。
- Tetris 客户端从合法重连快照恢复本人已确认的动作序号；错误 match、旧 revision 与畸形 player seq 不得污染发送器。
- Tank 断线立即清空持续输入；旧本地连接 epoch 的未确认输入在进入 Authority 前丢弃，新 epoch 才能继续。
- Direct Chat 通过生产 `FakeWebSocket.onmessage` 闭包验证旧 socket 无副作用，并以 `10→2→duplicate 10→11` 证明数值排序和 ID 去重。
- 同连接 reset 保留 capability，真实 close 清空 capability；离房后迟到 room update 不复活旧房间继续由既有专项覆盖。

## OUT

- 不使用 `tc/netem`、代理、VPN、路由器规则或真实 50/100/200ms 网络整形。
- 不连接第二浏览器、Android、iPhone、Tablet、Render、Supabase 或生产账号。
- 不新增协议字段、server-side connection epoch、奖励、Replay、AI、数据库或社交持久化事实。
- 不 commit、push、deploy 或发布。

