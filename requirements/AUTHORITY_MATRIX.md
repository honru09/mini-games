# Gameplay Authority Matrix（第三阶段最终代码口径）

状态只使用 `CLIENT`、`PARTIAL_SERVER`、`SERVER_COORDINATION`、`SERVER_RULE_AUTHORITY`。本表描述当前默认新客户端路径；协商不到 v2 时按协议注册表回退到明确的 v1 能力，不把 fallback 写成默认 Authority。

| Game | Rules | Time | Damage / Economy | Result | Status | 证据 |
|---|---|---|---|---|---|---|
| Gomoku | CLIENT | CLIENT | N/A | CLIENT claim + server consensus settlement | CLIENT | `public/src/games/gomoku.js`、`qa/e2e-online.js` |
| Ludo | CLIENT | CLIENT | N/A | CLIENT claim + server consensus settlement | CLIENT | `public/src/games/ludo.js`、`qa/e2e-online.js` |
| Monopoly | Server shared Rule Core；旧客户端回退 Auction v1 | Server turn / seeded dice / auction deadline | Server cash、property、rent、chance、auction、bankruptcy | Server terminal + settlement | SERVER_RULE_AUTHORITY | `shared/rules/monopoly.js`、`server/gameplay/monopoly-rule-authority.js`、`qa/rule-authority-online.js` |
| Tank | Server simulation | Server match time / tick | Server collision、projectile、damage、respawn | Server | SERVER_RULE_AUTHORITY | `server/gameplay/tank-sim.js`、`qa/tank-authority.js`、Tank focused E2E |
| Tetris | Server shared Rule Core；旧客户端回退 Coordination v1 | Server start / fall / deadline | Server lock、clear、attack、garbage、KO | Server | SERVER_RULE_AUTHORITY | `shared/rules/tetris.js`、`server/gameplay/tetris-rule-authority.js`、`qa/rule-authority-online.js` |
| Xiangqi | Server shared Rule Core；旧客户端回退 Clock v1 | Server clock | N/A | Server terminal / timeout | SERVER_RULE_AUTHORITY | `shared/rules/xiangqi.js`、`server/gameplay/xiangqi-rule-authority.js`、`qa/rule-authority-online.js` |

## 口径说明

- `CLIENT`：服务端不重演完整游戏规则；结果仍需多方一致 claim，并由服务端做奖励与幂等结算。
- `PARTIAL_SERVER`：只覆盖某个子系统。
- `SERVER_COORDINATION`：服务端权威开局、攻击、KO、名次等协调，但不重放完整规则。
- `SERVER_RULE_AUTHORITY`：服务端复用无 DOM Rule Core 验证动作、推进状态并产生终局。
- `ENABLE_RULE_AUTHORITY_V2=0` 是紧急兼容开关；默认新客户端会协商 `tetris-rule-v2`、`xiangqi-rule-v2`、`monopoly-rule-v2`。
- 自动化验证不等于真实设备/真实网络验证。当前 Authority 能力为 `AUTOMATED_VERIFIED`，在设备矩阵完成前不能写 `PRODUCTION_READY`。
