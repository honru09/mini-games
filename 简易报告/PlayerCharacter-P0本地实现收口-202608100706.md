# Player Character P0 本地实现收口简报

时间：2026-08-10 07:06（Asia/Tokyo）
状态：本地实现并完成自动化回归；未提交、未推送、未部署

## 本批完成

- 新增 `server/player-character.js` 深模块，固定 `player-character-v1` schema、角色/slot 白名单和默认值。
- `normalizeStored()` 统一处理旧档案、缺失字段、未知版本、未知 ID、超长字符串、数组、原型污染和畸形对象；每次返回隔离的新对象。
- `publicPresentation()` 只返回 `schemaVersion/characterId/slots`，不携带 owned、价格、金币、XP、购买记录、token、PIN 或密码。
- 服务端接入 starterUser、旧 JSON 迁移、Supabase 缺列 fallback、本人 Profile、公开 Profile、Room Seat、AI/观众/访客和重连。
- 客户端只读缓存服务端角色投影，没有新增 Profile mutation、商城装备 UI 或美术假实现。
- Social Match Seat allowlist 已同步 `playerCharacter`，并追加固定 schema/slot/敏感字段回归。

## 验证结果

- `node --experimental-websocket qa/player-character-contract.js`：15 项通过。
- `node qa/social-match-contract.js`、`node --experimental-websocket qa/social-match-online.js`：通过。
- Cosmetic、Room Seats、Security、Reconnect、E2E：通过。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`npm run quality:gates`、`npm run test:progress-ledger`：通过。
- 修正后的完整 `npm test`：通过，耗时 115.2 秒；构建产物同步为 865,973 bytes。
- 连续两次 `node scripts/build.js` 产物 SHA-256 一致：`8D0600B5A720A60DCA472440E9C5BB809DB27BC876FA910F5D9A7ACF19504968`。
- 说明：上述字节数与哈希是 07:06 Player Character P0 历史快照；后续 UI-037/GAME-045 表现 Adapter 已追加构建内容。当前 canonical 产物以 [UI037-GAME045代码原生表现Adapter收口-202608100816.md](UI037-GAME045代码原生表现Adapter收口-202608100816.md) 与 `PROJECT_STATUS.json` 的 896153 bytes / `870B1A52…F91976` 为准。

## 主负责人审核与纠正

- Terra Max 完成核心模块、服务端投影、客户端只读缓存和专项测试。
- 审核发现 Social Match 在线测试仍按旧 Seat allowlist 拒绝新增安全字段；已补充 `playerCharacter` 公开形状与敏感字段断言，复跑主链通过。
- 未修改六款规则、Authority、奖励、Replay、AI、商城价格/owned、Supabase schema、运行时美术 Manifest。

## 下一主线

`SOC-031` 已实现；按依赖进入 `ART-036` 与 `ECO-029` 分支，再进入 `UI-037 / GAME-045`。本阶段不生成角色图、不启用未审批素材，真实 Supabase、第二浏览器、真机和网络整形仍是外部闸门。
