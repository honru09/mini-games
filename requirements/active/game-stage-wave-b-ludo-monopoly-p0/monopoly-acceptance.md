# Game Stage Wave B：大富翁 P0 验收

状态：`LOCAL_ONLY`

- [x] 默认 flag 建立 Monopoly Wave B stage、实体棋盘、回合、骰子、状态、地产、机会卡、
  支付、拍卖和交易 unavailable seam。
- [x] `mg_art_game_stage_wave_b_v1='0'` 严格保留当前 Wave A；其他值保持 Wave B；
  storage 读取异常 fail-closed 到 Wave A；运行时切换只改表现 DOM。
- [x] snapshot/serialize、规则、AI、联网消息、奖励、Replay、角色公开投影和 ART-036
  资源均未携带或消费 Wave B 状态。
- [x] 机会卡与拍卖状态只读；不存在交易 Authority、交易按钮或交易 mutation。
- [x] reset、destroy、离房/换局清除 wrappers、class/data、chance marker 与 timer，恢复
  原有节点父子顺序；reduced-motion 不新增表现 timer。
- [x] `node --check public/src/games/monopoly.js`、`node qa/game-stage-wave-b-monopoly.js`、
  `node qa/monopoly-rule-core.js`、`node qa/monopoly-character-presentation.js`、
  `node qa/monopoly-presentation-adapter.js`、`node qa/monopoly-auction.js` 通过。
- [x] 未修改共享 adapter/core、ludo.js、日志；Master 另行接入共享模板、QA 与本地构建；未提交、
  未推送、未部署。

## Local evidence

- `node qa/game-stage-wave-b-monopoly.js` → `GAME_STAGE_WAVE_B_MONOPOLY_ALL_PASS`。
- `node qa/game-stage-wave-b-ludo-monopoly-layout.js` → `GAME_STAGE_WAVE_B_LUDO_MONOPOLY_LAYOUT_ALL_PASS`。
- `node qa/monopoly-rule-core.js`、`qa/monopoly-character-presentation.js`、`qa/monopoly-presentation-adapter.js`、`qa/monopoly-auction.js`、`qa/ai-games.js`、`qa/gameplay-upgrade.js` → all pass。
- Visible browser, second browser, real devices and network shaping remain external gates; status stays `LOCAL_ONLY`.
