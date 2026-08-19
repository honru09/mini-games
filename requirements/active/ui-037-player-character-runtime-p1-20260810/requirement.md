# UI-037 / GAME-045 — Player Character + Monopoly Runtime P1

状态：`CODE_FALLBACK_STATE_MATRIX_IMPLEMENTED / OWNER_ART_LANE_OPEN / RELEASE_EVIDENCE_PENDING`

时间：2026-08-10（Asia/Tokyo）

## Goal

冻结迷你大富翁在沉浸式 Game Shell 中的表现合同：以服务端权威位置、回合、阶段和重连快照驱动 UI；在正确的 Seat 上消费 `player-character-v1` 的**公开投影**；并为角色美术、网络事件、资源失败、观战和恢复定义可验证的 fallback。

本 active task 已在合同之后完成代码原生运行时纵切：权威状态 Adapter、完整局内状态栏、三语、机会卡 dialog、44px 操作边界、reduced-motion 与专项 QA 已落地；仍不把 `ART-036` source-only 素材、`ECO-029` 预留商品目录或任何新商城功能接入产品。

对应唯一台账：`UI-037`、`GAME-045`；已完成前置：`GAME-012`、`SOC-031`。`ART-036` 原创美术按 `OWNER_AUTHORIZED_ART_CLEARANCE` 开放可逆 runtime 候选；`ECO-029` 的正式生产经济/数据库事务仍需真实 Supabase 发布证据，但不阻塞代码原生、local/fake adapter 与内部预览施工。

## 已核实的现状

- `server/gameplay/monopoly-rule-authority.js` 的 `snapshot()` 已提供 `protocol`、`matchId`、`revision`、`serverNow`、`stateHash` 和序列化后的 `state`；其中 `state.players[playerId].pos` 是位置真相源。
- 规则状态事件已由服务器以 `{ type:'monopoly_rule_state', payload:snapshot, transition }` 广播；当前 `public/src/online/03-websocket.js` 只将 `msg.payload` 传给 `onMonopolyRuleState`，因此同一事件根级的 `transition` 尚未进入 Monopoly 表现层。
- `rejoined`、观战快照和 `started` 已带 `seats`、`presentation` 与 `monopolyRuleSnapshot`；恢复快照没有可靠的连续动画历史，必须允许静态跳转。
- `server/player-character.js` 与客户端 `readPlayerCharacterPresentation()` 已定义 `player-character-v1` 的安全公开形状。公开 Slot 不是已拥有物品、价格、货币或装备事务。
- 当前 Monopoly `tokenSkin`（`character` / `car`）仍是既有 Game Cosmetic 表现，不等同于 Player Character，不能合并为同一收藏类别。

## IN

- 冻结进入、等待、当前回合、掷骰、移动、落点、机会卡、买地、租金/税费、拍卖、破产、结算、断线、重连和观战的真实状态矩阵。
- 冻结服务端位置到表现层的消费 Interface、序号/匹配校验、Seat 映射、动画资格与静态 fallback。
- 冻结角色公开投影的最小消费规则：只读取 `schemaVersion`、`characterId`、七个 Slot；任何异常值回退到既有程序化 token。
- 冻结三语言、键盘焦点、屏幕阅读器、44px 操作目标和 `prefers-reduced-motion` 的验收口径。
- 冻结下一实施批的文件所有权、回滚点和专项验证矩阵。

## OUT

- 不修改 `server/**`、`shared/**`、`public/**`、`qa/**`、`supabase/**`、`asset-library/**`、运行时 Manifest、全局台账、报告或日志。
- 不生成或接入 ART-036 位图、WebP、SVG、透明精灵、角色服装或实体棋盘资源；`reference-only` 不得转换为运行时候选。
- 不启用角色商品目录，不扣 G Coins，不发放/装备角色商品，不新增 `purchase` 消息，也不把 `player_character` 借道 Avatar 或 Game Cosmetic 类别。
- 不改变 `monopoly-rule-v2`、行动合法性、规则状态、位置、金币、奖励、AI、Replay、观战权限、赛事或房间协议。
- 不实现交易。当前权威规则没有交易状态或行动；UI 不得伪造“交易成功”或可提交的交易按钮。若未来立项交易，必须另立规则、经济、Replay、Authority 和安全任务。
- 不提交、推送或部署。

## Non-negotiable

- `state.players[playerId].pos`、当前玩家、回合、拍卖结束时间、终局顺序和结算只接受匹配的服务端权威快照；DOM、CSS、角色动画、客户端计时器与 localStorage 永远不是规则真相源。
- `visualPos` 只能是单次渲染过程中的临时表现值，不得回写 WebSocket、快照、Replay、AI、奖励、Analytics 或档案。
- `seatId` 与规则 `playerId` 的映射必须由本局服务器下发的压紧 Seat 序列确认；映射缺失、重复、越界或 `matchId`/protocol 不匹配时，不显示另一名玩家的角色，改用无身份的既有 token fallback。
- 只有连续、同局、递增的 `revision`，并且存在可信 `transition`/合法 `lastEvent` 时可以播放走格；重连、观战初始快照、跳号、版本切换、reduced-motion 或资源失败必须静态落在权威 `pos`。
- `ART-036` 的具体原创候选须取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 后才进入可逆 default-on runtime；人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 仅为可选咨询。`ECO-029` 可继续正式目录、Resolver、local/fake adapter、失败回退与内部预览开发；只有把生产持久化/并发写成已验证或执行真实生产发布时，才要求 `apply_purchase_v1`、真实 RLS、备份/恢复/回滚证据。
- 运行时新增静态文案必须同步 `zh-CN`、`en-US`、`uk-UA`，由 `t()` / i18n 属性渲染；用户昵称仅以 `textContent` 与 `data-i18n-raw` 处理。

## Completion definition

当前可确认的是**代码原生状态矩阵与安全 fallback 已实现**。UI-037/GAME-045 仍不能写成“正式角色美术完成”或“正式角色商城完成”；ART-036 尚需逐族取得所有者清除，ECO-029 生产经济及第二浏览器/真机/网络整形保持 `RELEASE_EVIDENCE_PENDING`。这些缺口限制对应完成声明与发布证据，不阻塞不依赖真实外部环境的开发。
