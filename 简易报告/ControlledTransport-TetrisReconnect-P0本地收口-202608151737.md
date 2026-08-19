# 受控本地传输与 Tetris 重连修复 P0 收口（2026-08-15）

## 一句话结论

Tetris 重连后第一步可能被当成旧动作的问题已修复，四条传输链路的确定性本地预检已通过；真实网络与设备 Gate 仍然阻塞，本批未发布。

## 主线切换进度

| 方向 | 本地实现进度 | 最终闭环进度 |
| --- | ---: | ---: |
| 美术 | 40.3% | 37.1% |
| 界面 | 75.0% | 67.8% |
| 游戏 | 69.2% | 66.4% |
| 社交 | 59.1% | 59.4% |
| 经济 | 75.9% | 71.7% |
| 技术 | 66.7% | 61.7% |
| 整体 | 64.7% | 60.9% |

本批只补缺陷与 Acceptance Gap，原子需求状态不变，因此百分比不变。外部真机、第二浏览器、真实网络、Supabase 与人工美术 Gate 继续按固定权重阻塞最终闭环。

## 做了什么

- Tetris 从已经完整校验的 v3 权威快照恢复本人动作序号；`seq=7` 后首个操作发送 `seq=8`。
- 新建本地受控传输预检，覆盖 Tetris 乱序/重复、Tank 断连与旧 epoch、DM 2/10/11 数值排序/去重、旧 WebSocket 回调隔离。
- 将测试接入 `test:chaos`、Quality Gates 和完整 `npm test`。
- Terra Max 两轮审查发现并纠正 Tank 与 DM 的测试假阳性风险，并补齐 Tetris 拒绝快照负向回归。
- 上一浏览器矩阵严格降为 `4141…0850` 历史 as-of；当前 `0A6F…1CDB4` 完整可见矩阵诚实保留 `NOT_EXECUTED`。
- 最终门禁发现并修正 `visualBrowser` 把历史证据模式误写成能力状态的问题；能力保持合法 `partial`，历史语义单独保存在 `evidenceMode`。

## 用户现在能看到什么

玩家在 Tetris 联机重连后继续操作时，不会再因为客户端动作序号从 1 重来而让第一步被服务器拒绝。其余变化主要是测试与证据治理，用户暂时看不到新界面或新美术。

## 还没做什么

- `TECH-030` 的真实 50/100/200ms 延迟、抖动、丢包和乱序整形仍为 `NOT_EXECUTED`。
- 第二浏览器、Android、iPhone、Tablet、两正式好友 UI 私聊与真实低端性能仍未执行。
- 当前新哈希的完整五档可见矩阵未重采；旧矩阵只对旧哈希有效。
- 未接入 Supabase、Render、生产账号或线上验证。

## 验证

- 受控传输、Gameplay、Network Chaos、Social Match、连接恢复、Tank Authority：全部通过。
- `node --experimental-websocket qa/reconnect-online.js`：通过。
- `node --experimental-websocket qa/rule-authority-online.js`：通过。
- 完整 `npm test`：通过，约 169.4 秒。
- 最终 `npm run quality:gates`：通过；确定性双构建两次哈希一致。
- 当前构建：1,580,313 characters / 1,594,847 bytes / SHA-256 `0A6FE8494AA5B14188D006E2FCDFA97AA7DAB438E127A6442FFF298BC5B1CDB4`。
- 真实网络、真机、第二浏览器与生产验证：`NOT_EXECUTED`。

## 风险与下一步

本地调度不能代替操作系统或真实链路的网络整形，测试侧 epoch 也不是新生产协议。下一条 PROVE 主线继续准备或执行真实外部环境矩阵；若环境仍不可用，则只做不会伪造 Gate 的高价值本地准备。

## 发布状态

`LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND / NOT_RELEASED`。未 commit、未 push、未触发 GitHub Pages 或 Render 部署。

## 追溯入口

- Active task：`requirements/active/controlled-local-transport-preflight-p0-20260815/`
- 原子需求：`TECH-030`、`GAME-048`
- 核心回归：`qa/controlled-transport-preflight.js`、`qa/gameplay-upgrade.js`
- 证据：`requirements/active/controlled-local-transport-preflight-p0-20260815/evidence/controlled-local-transport-preflight-202608151737.json`
