# Progression Identity P1：六款分游戏胜场称号

状态：`IMPLEMENTED_LOCAL_PENDING_EXTERNAL_VISUAL`
时间：2026-08-10（Asia/Tokyo）

## Goal

只消费服务端权威 `wins`，为六款游戏分别建立 `1/10/50/100/1000` 胜场称号阶梯，并在本人主页与他人公开档案中展示当前称号和下一目标。

## IN

- 六款固定游戏、五级固定阈值，共 30 个差异化三语称号。
- `shared/progression/victory-mastery.js` 提供 Node/浏览器共用的只读、确定性派生目录。
- 服务端 `profileObj()` 从权威 `u.wins` 派生 `mastery`；旧账号无需数据库迁移即可按历史胜场恢复。
- 本人主页六款卡展示当前称号、首胜目标和距离下一档还差多少胜；公开 Profile 展示已解锁称号。
- 负数、小数、超大数、不可转换值、继承属性、未知游戏和原型污染输入安全归一化。
- 三语言、移动端长文案换行、权威 Profile 加载和客户端伪造回归。

## OUT

- 不修改 Reward Resolver、金币、XP、等级、胜场写入、Supabase Schema/RPC、AI、Replay、游戏规则或协议。
- 不创建独立“授予”流水；称号是 `wins` 的幂等确定性投影，不另存数据库，避免双写和迁移漂移。
- 不生成或启用未审批图片徽章；当前徽章为代码原生符号，正式美术资产另走审批。
- 不提交、不推送、不部署。

## 验收

- `node qa/victory-mastery.js`、`npm run test:i18n`、Profile/响应式/DOM 专项与 `qa/security-online.js` 全部通过。
- 完整 `npm test` 132.2 秒 ALL_PASS；首次完整链唯一失败为 `qa/metrics-online.js` 固定端口碰撞，修为临时空闲端口后专项与全链均通过。
- 双构建一致：937242 characters；物理 951343 bytes；SHA-256 `41C9F1A26C050C7F3705C5DD0422567C0F6D219E630B99D57E4AD7D967E34142`。
- localhost 可见复核仍受机器保存权限阻断；第二浏览器、真机/平板及可见三语言长文案验收未执行。
