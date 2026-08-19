# GAME-045 — 大富翁玩家角色表现消费者 P1

状态：`CODE_FALLBACK_AND_UI_MATRIX_IMPLEMENTED / ART_DEVICE_GATED / LOCAL_ONLY`

时间：2026-08-10（Asia/Tokyo）

对应台账：`GAME-045` — 大富翁实体棋盘与玩家虚拟形象规则同步行走纵切。

前置顺序：`GAME-012`（已验证的 Monopoly Rule Authority）→ `SOC-031`（已实现的公开 Player Character 投影）→ `ART-036`（当前仅 source-only）→ 本任务；`ECO-029` 只在未来需要购买/装备角色商品时才成为额外前置。`UI-037` 是同一权威快照的并行 UI 消费者，不由本任务代做。

## Goal

冻结一个只读、可回退的表现消费链：大富翁在线局只在收到并验证 `monopoly-rule-v2` 服务端权威状态后，才让玩家的公开角色投影表现为待机、按格行走、落点或结算状态。它必须让视觉效果更像一个完整游戏，但永远不能成为规则、位置、回合、拍卖、奖励、Replay、AI 或网络协议的第二真相源。

本批已在合同之后完成代码原生表现消费者与 UI-037 状态矩阵；**不接入未审批 ART-036 运行时美术**。当前真实画面继续使用既有 CSS/DOM 棋盘、`m-marker`、`♟/🚗` token 与 Tabletop Wave A 底材。

## 已审阅事实

- `shared/rules/monopoly.js` 的 `state.players[id].pos`、`alive`、`current`、`phase`、`terminal`、`winner`、`placements` 是规则状态；`applyAction()` 的 `monopoly_transition.events` 可包含带 `from/to/steps` 的 `move`。
- `server/gameplay/monopoly-rule-authority.js` 用 `monopoly-rule-v2` 快照提供 `matchId`、`revision`、`serverNow`、`stateHash`、`state` 与 `auctionEndAt`；服务器对在线动作、RNG、拍卖关闭和结果保持权威。
- `public/src/games/monopoly.js` 当前在 `onMonopolyRuleState()` 中将权威 `state.players[].pos` 映射为本地 `visualPos` 并立即 `renderBoard()`；它没有角色表现 Module，也没有批准的角色资源消费路径。
- `server/player-character.js` 仅公开 `player-character-v1` 的 `schemaVersion`、`characterId`、固定 `slots`；它不含 owned、价格、余额或资产路径。
- `G-14-PLAYER-CHARACTER-ART-036` 与 `G-15-MONOPOLY-ART-036` 是素材库中的 `reference-only` source draft。`public/assets/manifests/asset_manifest.json` 目前只登记 Monopoly 大厅封面，Monopoly 棋盘仍是 `css-dom-fallback`。

## IN

- 冻结规则状态到表现状态的矩阵、接收顺序、版本/重连处理、步进行走、朝向、待机、破产和结算表现语义。
- 冻结未来深 Module 的小 Interface、Seam、输入验证、不变量、严格 fallback 与清理规则。
- 冻结公开 Seat → `player-character-v1` → 角色渲染的隐私边界；昵称、真实 Avatar、Frame、Effect、NameFx 仍是现有身份层，玩家角色不得取代它们。
- 为 `UI-037`、未来 ART-036 运行时审批和专项 QA 定义明确的交接点与验收条件。

## OUT

- 不修改 `shared/rules/monopoly.js`、`server/gameplay/monopoly-rule-authority.js`、`server/index.js`、`public/src/games/monopoly.js`、WebSocket 消息、快照结构、Replay、AI、奖励、拍卖、商城或 Supabase。
- 不制作、裁切、压缩、复制、注册或加载任何角色/棋盘位图、SVG、atlas、3D/GLB 或动画；不读 `art-source/` 作为运行时资源。
- 不新增角色商城商品、价格、owned/equipped mutation、角色经济字段或 i18n 文案。
- 不把 `player_character` 借道 Avatar、Frame 或 `game_cosmetics`；不把 Honru/Logo 当作玩家角色。
- 不 commit、push、Pages/Render 发布或部署。

## 不可协商项

1. **规则权威不变。** 在线局的逻辑位置只来自匹配 `matchId` 的服务端 `monopoly-rule-v2` 快照。表现代码不得生成、修正、预测或回写 `pos`、骰子、phase、winner、auction、资金或结果。
2. **只读公开身份。** 角色表现只可读取经现有公共 Seat/公开档案投影的 `player-character-v1`；不得读取或泄露 owned、价格、余额、购买历史、token、PIN、密码或私有 profile。
3. **无可验证步进即不动画。** 首帧、重连、观战加入、revision 跳跃、缺失/不匹配 transition、乱序或损坏数据必须直接落到最新权威格；不得用客户端骰子、上一帧猜测或昵称推断一条移动路径。
4. **视觉永不阻塞游戏。** 行走、待机、结算和资源失败均不能阻塞 Roll/Buy/Pass/Bid、倒计时、断线恢复、输入、规则广播或胜负结算；表现 overlay 必须 `pointer-events:none`。
5. **ART-036 当前仍零接入，但开发轨道已开放。** 当前候选在逐族取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 前保持 `reference-only`；满足 M0 North Star、稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、运行时 Manifest/预算/QA、fallback、feature flag 与回滚后，可进入可逆 default-on 角色/实体棋盘候选。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 仅为可选咨询。

## 完成定义

本批完成仅表示六份合同文档一致、可供后续实现使用。它**不表示** GAME-045、UI-037、ART-036 或角色商城已实现，更不表示角色美术已获批准。未来运行时纵切只有在独立实现任务完成专项自动化、三语言、双主题、reduced-motion、桌面/平板/手机、资源失败、重连/观战与完整回归后，才可从 `planned` 升级。
