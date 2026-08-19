# Player Character P0 验收

## 模块

- [x] 未知/畸形/污染输入全部规范化为固定 schema 与白名单 ID。
- [x] 返回对象为新值，调用者不能修改共享默认值或目录。
- [x] 公开投影只含 `schemaVersion/characterId/slots`。

## 集成与安全

- [x] 新旧账号、访客、公开 Profile、Room Seat、重连得到一致安全投影。
- [x] 客户端 Profile mutation 不能写入/伪造 `playerCharacter`。
- [x] owned、余额、价格、购买历史、token/PIN/password 不进入公开投影。
- [x] `gameCosmetics`、Avatar/Frame/Effect/NameFx/Lang 和旧账号数据不回归。

## 边界

- [x] 不改大富翁/六款规则、Authority、奖励、Replay、AI、商城或 Supabase。
- [x] ART-036/ECO-029/UI-037/GAME-045 保持后续状态；没有用 CSS/Emoji 冒充完整虚拟形象。
- [x] 未提交、未推送、未部署。

## 本地证据

- `node --experimental-websocket qa/player-character-contract.js`：15 项通过。
- `node --experimental-websocket qa/game-cosmetic-profile.js`、`qa/room-seats.js`、`qa/security-online.js`、`qa/reconnect-online.js`、`qa/e2e-online.js`：通过。
- `node qa/social-match-contract.js` 与 `node --experimental-websocket qa/social-match-online.js`：Player Character 扩展 Seat 合同后通过。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`npm run quality:gates`、`npm run test:progress-ledger`：通过。
- 首次完整主链曾因 Social Match 在线测试未更新 Seat allowlist 而失败；主负责人补充 `playerCharacter` 安全形状断言后专项复跑通过。修正后的完整 `npm test`：通过（115.2 秒）。
- 连续两次 `node scripts/build.js` 产物 SHA-256 一致：`8D0600B5A720A60DCA472440E9C5BB809DB27BC876FA910F5D9A7ACF19504968`。
