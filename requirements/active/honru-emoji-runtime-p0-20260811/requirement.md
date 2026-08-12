# Honru Emoji Runtime P0：ART-024 / ART-025 / SOC-017 / GAME-023 合同冻结

状态：`CONTRACT_ONLY / NOT_EXECUTED / DO_NOT_SHIP`

时间：2026-08-11（Asia/Tokyo）

本目录是独立的规格与现状审计任务。它不生成图片、不接入运行时、不修改协议、台账、素材库、Manifest、日志或构建产物。

## 需求追踪

| 台账 ID | 台账当前状态 | 本任务处理 | 依赖/边界 |
|---|---|---|---|
| `ART-024` | `planned` | 冻结十枚原创 Honru Emoji 的语义、素材分层、审批门槛 | 依赖 `ART-002`、`ART-011`；`ART-010/011` 仍是外部阻断 |
| `ART-025` | `planned` | 冻结局内投掷、命中、弹出和 reduced-motion 表现合同 | 复用已验收的 `match-expression-v1`；不改规则坐标 |
| `SOC-017` | `planned` | 冻结聊天与局内共用目录及隐私/回退边界 | 当前 Direct Chat/Match Chat wire 仍是文字合同，需另立接入变更 |
| `GAME-023` | `partial` | 审计现有 Unicode fallback，定义获批位图替换条件 | 依赖 `ART-024`、`ART-025`、`SOC-015`、`SOC-016` |

台账覆盖组为 `emoji-expression-chat`。本合同保留既有 `match-expression-v1` 的十个 `expressionId`，不重命名、不删除、不隐式增加第十一个 ID。

## Goal

建立一份可由美术、运行时、社交协议和 QA 共同消费的 Honru Emoji 目录：同一个稳定 ID 在聊天（未来获批的 Emoji 适配器）与局内表达中指向同一个原创资源/Unicode fallback；定向投掷只改变表现层，不改变对局、权限、奖励、回放或数据边界。

## IN

- 冻结十个稳定 Emoji 语义/ID、fallback glyph、目录顺序和 atlas cell 映射。
- 冻结 `art-source/brand/ghost-game/honru/emoji-v1/` 的源稿、Alpha、三色平涂、尺寸派生、poster、atlas、Prompt/provenance 和双人审查文件布局（本任务不创建这些素材）。
- 冻结未来运行时 `P-HONRU-EMOJI-V1` Manifest 组、`mg_art_honru_emoji_v1` 与 `mg_art_honru_emoji_throw_v1` 双闸门、默认关闭和 Unicode/可读文字 fallback。
- 冻结聊天/局内共用目录的消费规则：只传稳定 ID/文本，不传位图、HTML、SVG 片段或供应商 glyph；消息仍由既有服务端权威签发。
- 冻结目标席位投掷、队列、静音、reduced-motion、频控、Block、观众延迟、访客/AI边界及清理时机。
- 冻结可自动检查的 Alpha、尺寸、atlas/poster、字节预算、路径安全、Manifest/Catalog 同构、a11y 和 IP/Golden Set 闸门。
- 记录现有实现缺口、当前真实测试覆盖和后续最小文件所有权。

## OUT

- 不生成或编辑任何图片/视频/音频；不使用 ImageGen；不修改现有 Honru v1 SVG、Honru v2 母图或九状态源稿。
- 不修改 `server/index.js`、`public/src/online/03-websocket.js`、`public/src/core/02-app-shell.js`、`public/src/core/04-social.js`、`public/src/core/06-assets.js`、`public/index-template.html`、`public/index.html`、三语 locale、`asset-library/catalog.json`、`public/assets/manifests/asset_manifest.json`、QA、台账、报告、日志或素材。
- 不新增/修改 WebSocket 消息、capability、`expressionId`、`matchId`、`eventId`、`targetSeat`、Direct Chat/Match Chat 的持久化合同。
- 不把原图、Prompt、聊天正文、Emoji 事件、投掷轨迹写入规则快照、moveLog、Replay、奖励、AI 学习、Analytics、数据库、localStorage 或普通日志。
- 不提交、推送、部署或宣称 `verified`、`production-ready`；本任务终点是等待人工/IP/真机和用户发布闸门。

## 当前产品语义与 ID 冻结

下表是协议已经冻结的十个 ID（与 `Social Match P0` 的 Unicode fallback 完全一致）。美术可以替换 glyph/位图，但不得改变 ID 或其可识别语义。

| 顺序 | 稳定 `emojiId` | 语义（中文） | 语义（English） | 当前 fallback |
|---:|---|---|---|---|
| 1 | `emoji_wave` | 招手/友好微笑 | wave / friendly hello | `👋` |
| 2 | `emoji_thumbsup` | 赞/认可 | thumbs-up / approve | `👍` |
| 3 | `emoji_cheer` | 加油/欢呼 | cheer / encourage | `🎉` |
| 4 | `emoji_wow` | 惊讶 | surprised / wow | `😮` |
| 5 | `emoji_oops` | 疑惑/失误 | puzzled / oops | `😅` |
| 6 | `emoji_cry` | 哭泣/遗憾 | cry / regret | `😭` |
| 7 | `emoji_angry` | 生气/抗议 | angry / protest | `😠` |
| 8 | `emoji_sly` | 得意/调皮 | sly / playful | `😏` |
| 9 | `emoji_heart` | 喜欢/鼓励 | heart / care | `❤️` |
| 10 | `emoji_game` | 开玩/庆祝再来一局 | game / celebrate another round | `🎮` |

台账 `ART-024` 的历史描述还写有“投降”。当前线上十个稳定 ID 没有专用 `emoji_surrender`；本合同禁止把 `emoji_game` 或其他存量 ID 偷换成投降语义。若产品仍要求独立“投降”，必须另行修改台账、协议和兼容矩阵，不能在本批素材中悄悄复用旧 ID。

## 非谈判项

- Honru 身份锚点始终是“幽灵与手柄同体、左眼十字键、右眼四圆键”；状态姿态、嘴形、手势和火苗只能表达情绪，不能改变身份。
- 运行时目录必须与现有 `states-v1` 隔离：Emoji 不得冒充九状态，也不得复用 `mg_art_honru_states_v1`/`mg_art_honru_game_reactions_v1` 旗标。
- 资源、旗标、Manifest、解码或 atlas cell 任一失败都必须回到现有 Unicode fallback/可读文本，输入仍可用且不出现裸 ID。
- 只有服务端签发的 `senderUid/player/createdAt/protocol` 和既有 Block/频控结论才有权改变是否展示；客户端资产只是装饰。
- 人工清稿、Reviewer B、独立 IP Similarity Review、Golden Set 用户决议、Integration/Performance/A11y 和外部设备闸门按顺序通过前，状态为 `HUMAN_REVIEW_REQUIRED / DO_NOT_SHIP`。

## 预期验收终点

实现批次必须逐项证明：十个 ID 与目录同构；Alpha/尺寸/atlas/poster/hash/预算可复核；聊天与局内只消费同一 ID；定向轨迹、reduced-motion、静音、频控、Block、观众和生命周期没有越权；所有失败回退可玩；三语/a11y/真实设备和人工/IP证据齐全。任何一项缺失都只能标为 `partial` 或 `not_executed`。

