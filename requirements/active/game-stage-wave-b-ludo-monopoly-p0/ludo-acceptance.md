# Game Stage Wave B：飞行棋 P0 验收

- [x] 默认 flag 建立飞行棋 Wave B Arena、Board、Command、Dice、Turn、State 和 Rankings seam。
- [x] `mg_art_game_stage_wave_b_v1='0'` 严格保留当前 Wave A DOM；其他值保持 Wave B。
- [x] storage 读取失败或表现层构造异常 fail-closed 到 Wave A；运行时切换只改表现 DOM。
- [x] 棋盘、骰子、当前回合、选择/掷骰状态、排名、观战/等待状态都具备稳定 class/data/ARIA 语义。
- [x] snapshot、serialize、规则、AI、联机消息、奖励与 Replay 未携带 Wave B 状态。
- [x] Wave B `destroy()` 清除 wrapper/标记并恢复既有输入清理。
- [x] `node --check public/src/games/ludo.js`、专项 QA、既有飞行棋 AI/强度/Gameplay/DOM 回归通过。
- [x] Terra 专属实现未修改服务端/协议/资产/总台账/日志；Master 另行接入共享 Wave B CSS、QA 与本地构建；未提交、未推送、未部署。

## Local evidence

- `node qa/game-stage-wave-b-ludo.js` → `GAME_STAGE_WAVE_B_LUDO_ALL_PASS` (17 checks)。
- `node --check public/src/games/ludo.js` → exit 0。
- Existing Ludo-inclusive checks: `qa/ai-games.js`, `qa/ai-strength.js`, `qa/gameplay-upgrade.js`, `qa/tabletop-perspective-contract.js`, `qa/tabletop-art-runtime.js`, `qa/dom-smoke.js` → all pass.
- `npm run test:i18n` → `ALL_PASS` / `I18N_RUNTIME_ALL_PASS`.
- `git diff --check` on owned files → no whitespace errors (only existing CRLF normalization warning).
- Browser/real device/network visible verification intentionally not run; the saved localhost permission blocks the in-app connector. Master rebuilt `public/index.html` locally; no release was made.
