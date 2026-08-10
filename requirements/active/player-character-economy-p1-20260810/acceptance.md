# ECO-029 Player Character Economy P1 验收

## Contract / pure module

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| 固定 slot 白名单与 P0 default 不漂移 | PASS | `server/player-character-economy.js` | 纯函数回归 |
| unknown/old/malformed/污染输入安全 fallback | PASS | `qa/player-character-economy-contract.js` | 不修改输入、不共享可变默认值 |
| public projection 只含稳定公开字段 | PASS | `qa/player-character-economy-contract.js` | 无 owned/price/coins/requestId/token |
| requestId 校验、重复分类、有界历史 | PASS | `qa/player-character-economy-contract.js` | 不自行扣款 |
| 角色外观不影响胜负/规则/奖励 | PASS | `contract.md` | 本批无游戏路径改动 |

## Explicitly NOT_EXECUTED

- [x] 正式角色商品目录、服务端价格注册和商城 UI。（明确未执行）
- [x] `purchase`/equip 消息在 `server/index.js` 的 Master 集成。（明确未执行）
- [x] Supabase `apply_purchase_v1` 类别/RPC/并发/RLS/备份/回滚迁移。（明确未执行）
- [x] ART-036 资源、Manifest、Monopoly/GAME-045、UI/i18n、真实设备和生产部署。（明确未执行）

## Known Issues

- 当前生产目录为空；任何注入的测试目录只用于纯函数验证，不会使线上商品可购买。
- 角色经济私有字段尚未写入现有 Profile/Supabase；旧账号和访客只能得到 P0 default。
- 需要 Master 评审 `SHARED_CHANGE_REQUEST.md` 后，另立 schema/RPC 兼容任务才能完成正式事务。

## Rollback

保留现有 `player-character-v1`、商城和 `game_cosmetics` 不变；删除本批新增纯模块/测试和 active 目录即可，用户资产、余额、规则与公开 Seat 不受影响。

## Local evidence (to fill)

- `node qa/player-character-economy-contract.js`：8 组合同断言通过。
- `node --check server/player-character-economy.js`：通过。
- `git diff --check`：通过。
- `npm test`：Player Character P0 与 ECO-029 双 pretest、完整主链全部通过（106.6 秒）。
- 未执行 commit、push、Pages/Render、真实 Supabase、真机或人工美术/IP 验收。
