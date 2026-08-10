# GAME-045 合同验收（文档冻结批）

状态：`LOCAL_CODE_AND_STATE_MATRIX_ACCEPTED — art/device gates remain`

## 主负责人后续本地收口

- [x] 以 `MonopolyCharacterPresentation.project(input)` 作为纯代码原生 fallback seam，消费 `players/seats/current/phase/source/reducedMotion`，返回权威位置、显示位置、状态、朝向和固定 fallback；不进入 Rule Core。
- [x] Monopoly marker 仅使用现有 CSS/DOM 与 `♟/🚗`，并在资源未审批时显式标记 `code-fallback`；无 ART-036 图片、Manifest、商城或 Supabase 变更。
- [x] `qa/monopoly-character-presentation.js` 已覆盖首帧/快照/重连、移动、朝向、阶段、破产、结算、私有字段裁剪、reduced-motion 和构建顺序。
- [x] 代码原生 Adapter 已覆盖 `revision/stateHash/transition`、连续合法 move、重连/观战 snap、reduced-motion 与生命周期清理。
- [x] UI-037 代码原生状态矩阵、状态栏、拍卖倒计时与机会卡 dialog 已完成并通过专项回归。
- [ ] 获批 ART-036 renderer、Golden Set 与设备/浏览器视觉验收仍未完成。

## 本批通过项

| 检查项 | 状态 | 证据/说明 |
| --- | --- | --- |
| GAME-045 对应台账、前置和实际现状已审阅 | PASS | `requirement.md` 的已审阅事实与 `execution.json.evidenceRead` |
| Rule Core 的 `pos/alive/current/phase/terminal/winner/placements` 与 Authority 的 `matchId/revision/stateHash/transition` 均有消费语义 | PASS | `contract.md` 第 2–4 节 |
| 连续 revision + 合格 `move` 才允许步进；首帧/重连/观战/跳跃/异常一律 snap | PASS | `contract.md` 第 3 节和状态矩阵 |
| 玩家角色只读消费 `player-character-v1` 公开投影，私有经济/凭证字段被排除 | PASS | `contract.md` 第 2、5 节 |
| Rule Core、Authority、Protocol、Replay、Reward、AI、UI-037 控制与商城没有被本合同越界承担 | PASS | `requirement.md` OUT 与 `contract.md` 第 5 节 |
| 资源失败、unknown projection、reduced-motion、离房/destroy 都有现有 marker/CSS/DOM fallback | PASS | `contract.md` 第 3、5、6 节 |
| ART-036 未审批资源保持 source-only/reference-only，未设任何默认开启 runtime 路径 | PASS | `requirement.md` 不可协商项 5；`contract.md` 第 5 节 |
| 本批文件所有权不碰共享台账、日志、状态、代码和测试 | PASS | `ownership.json` 与 `execution.json.notExecuted` |

## 明确未通过/未执行项（不得借用本批 PASS 宣称完成）

- [x] 代码原生 `MonopolyPresentationAdapter` / Frame Builder 已实现并接入已有根级 `transition` 转发。
- [x] 代码原生 DOM 表现 Adapter 与资源安全 fallback 已实现；未审批 ART-036 资源仍未进入 Manifest/runtime。
- [x] `UI-037` 的进入/回合/骰子/移动/落点/机会卡/买地/支付/拍卖/破产/断线/重连/观战/结算/fallback 可见状态矩阵已实现。
- [ ] ART-036 的人工清稿、Reviewer B、IP Similarity Review、用户 Golden Set 和真实运行时资源审批尚未完成。
- [ ] 角色服装购买、owned/equipped、Supabase RPC/RLS/并发/备份与回滚尚未完成。
- [x] GAME-045 专项自动化、完整 `npm test`、E2E 与 Quality Gates 已通过。
- [ ] 第二浏览器、Android/iPhone/Tablet、reduced-motion 可见和真实网络整形仍未完成。
- [ ] 没有 commit、push 或部署。

## 未来实现验收最低线

1. 新 Module 的 Interface 测试要覆盖连续 revision、回绕、负步、缺 move、错误 move、旧/重复 revision、match 切换、资源失败、Seat/角色投影异常、重连、观战、destroy 与 reduced-motion。
2. 在线测试要证明角色 Render Plan 的最终格始终等于权威 `state.players[].pos`，且 Roll/Buy/Pass/Bid/Auction/结果、RNG、重复 seq、重连、奖励与 Replay 的现有回归不变。
3. 运行时美术接入只能在批准资源、Manifest/hash/license、poster/静态 fallback、字节/内存预算和默认关闭旗标齐备后进行；加载失败时仍显示当前 `m-marker`。
4. 必须完成三语言、昼夜主题、1440×900、1024×768、390×844、844×390、第二浏览器和真机/真实网络验证；overlay 不可覆盖控制、破坏焦点、滚动锁或触控目标。
