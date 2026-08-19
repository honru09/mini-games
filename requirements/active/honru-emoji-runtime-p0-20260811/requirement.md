# Honru Emoji Runtime P0：ART-024 / ART-025 / SOC-017 / GAME-023 合同冻结

状态：`LOCAL_IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / RELEASE_EVIDENCE_PENDING / NOT_RELEASED`

原始冻结时间：2026-08-11（Asia/Tokyo）  
当前事实同步：2026-08-16（Asia/Tokyo）

本文件保留 2026-08-11 冻结的稳定 ID、安全和表现合同，并以 2026-08-16 的 runtime、Manifest、所有者清除记录与 QA 为当前事实。此次同步只修改本目录三份文档，不修改 runtime、Manifest、QA、台账、状态、日志、报告、构建或发布面。

## 2026-08-16 当前权威事实

- 原创资产组 `P-HONRU-EMOJI-V1` 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，状态是本地实现、未发布；这不是人工签字、法律结论或线上发布授权。
- 十个稳定 ID 已有逐枚源稿、1254×1254 RGBA Alpha、192/96/64/44px 派生、1024×768（4×3、256px cell）Alpha WebP atlas 和 640×360 WebP poster。atlas 最后两格透明。
- runtime atlas 为 `public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp`，302,314 bytes，SHA-256 `63108f289eab68f096cae59e2c32623e9e09b67fbebebb3383cc317494530d6a`；poster 为 `public/assets/brand/honru/emoji-v1/honru-emoji-poster-v1.webp`，67,146 bytes，SHA-256 `ec4b5a263839367a6ddcb9ced1b1b58fa2cbd24b0812b290be17eb7da84b9e35`。
- 生产 Manifest 已登记 `status: ready`、`clearance: OWNER_AUTHORIZED_ART_CLEARANCE`、十个 cell、十个 Unicode fallback、组合预算与 `default_enabled: true` 双旗标合同。
- 当前本地 runtime 已在既有 `match-expression-v1` 表现层中默认启用 atlas：表达选择器、头像旁 Emoji 气泡和面向目标席位的定向投掷均使用同一稳定 ID/cell；资源或解码失败继续显示 Unicode glyph/本地化可读文字。
- `mg_art_honru_emoji_v1` 是总 kill switch；`mg_art_honru_emoji_throw_v1` 只控制定向投掷图片表现。值缺失或严格等于字符串 `"1"` 时默认开启，任意其他值关闭对应图片路径；总开关关闭时选择器、气泡和投掷全部回到 fallback，投掷开关关闭时选择器与静态气泡仍可使用 atlas。
- `Direct Chat (direct-chat-v1)` 与 `match-chat-v1` 仍是纯文字协议，未实现图片消息、Emoji token 消息或 Chat 图片 adapter。`SOC-017` 因此只能是 `partial`，不得写成聊天图片协议已经完成。
- `ART-025` 的当前事实是：Honru 图片 atlas 已被放入既有 DOM/CSS 程序化 `sender Seat → target Seat` 轨迹；没有另造投掷权威、规则坐标、协议字段或持久数据，也没有完成另行规划的精细投掷/命中/弹出素材包。
- 人工清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，不阻塞开发、runtime 或未来发布候选，也不得冒充 PASS。外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁用。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能和线上最新构建属于 `RELEASE_EVIDENCE_PENDING`；本地实现不等于发布，任何 commit、push、Pages 或 Render 仍须用户当前明确命令。

## 需求追踪

以下状态来自 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 的 2026-08-16 当前事实；本次文档同步不修改台账。

| 台账 ID | 当前状态 | 当前已达到 | 仍保留的真实边界 |
|---|---|---|---|
| `ART-024` | `implemented` | 十枚原创 Honru Emoji、来源/哈希、atlas/poster、Manifest 与所有者清除后的 default-on runtime 已落盘 | 外部发布证据待补；可选人工/IP/Golden Set 咨询未执行 |
| `ART-025` | `planned` | 当前 atlas sprite 已用于既有程序化定向轨迹与落点气泡 | 更精细、可打断的投掷/命中/弹出表现素材仍是独立规划；不改变权威或协议 |
| `SOC-017` | `partial` | 局内表达使用同一稳定 ID、atlas cell 与 Unicode fallback | Direct Chat 和 match-chat-v1 仍纯文字；未来 Chat Emoji 必须另立版本化协议与审查 |
| `GAME-023` | `implemented` | 选择器、头像气泡、目标席位投掷、双 kill switch、fallback、reduced-motion 与清理路径已本地实现 | 第二浏览器、真机、真实网络和发布证据待补 |

覆盖组仍为 `emoji-expression-chat`。本合同复用现有 `match-expression-v1` 的十个 `expressionId`，不重命名、不删除、不隐式增加第十一个 ID。

## Goal

让同一个稳定 Emoji ID 在当前局内表达中确定地映射到同一个原创 Honru atlas cell 与 Unicode/文字 fallback，同时把该目录保留为未来 Chat Emoji adapter 的唯一候选来源。定向投掷只改变客户端表现，不改变对局权威、身份、权限、Block、频控、奖励、回放、数据库或协议。

## 当前已实现范围

- 冻结并实现十个稳定 Emoji 语义/ID、fallback glyph、目录顺序和 atlas cell 映射。
- 保留 `art-source/brand/ghost-game/honru/emoji-v1/` 的 chroma、Alpha、flat、四档派生、atlas、poster、Prompt/provenance 与机器技术审查记录。
- 以 `P-HONRU-EMOJI-V1`、版本化本地 Manifest、`OWNER_AUTHORIZED_ART_CLEARANCE` 和双 kill switch 解析 runtime atlas；不把路径或位图放入 wire。
- 在现有 `match-expression-v1` 选择器、头像旁气泡和定向投掷中按需解码 atlas；失败不阻塞输入，回到 per-ID Unicode 和本地化可读文字。
- 保留既有 `targetSeat`、幂等、频控、Block、观众延迟、访客/AI 发送边界、本地静音、reduced-motion 和离开/换局/重连清理。
- 由 `qa/honru-emoji-contract.js` 与 `qa/honru-emoji-runtime.js` 固定资产、Manifest、default-on/kill-switch、路径、cell、fallback 与聊天纯文字边界。

## OUT / 尚未实现

- 不新增/修改 WebSocket 消息、capability、`expressionId`、`matchId`、`eventId`、`targetSeat`，也不修改 `direct-chat-v1` 或 `match-chat-v1` 的 `text` 合同。
- 不把局内 atlas 接入误写为 Direct Chat/Match Chat 图片消息；若未来需要发送 Emoji token 或图片，必须另立版本化协议、净化、权限、持久化、兼容和回滚设计。
- 不新增规则坐标、Authority、Rule Core、Replay、Reward、AI、Analytics、Profile、Supabase 或经济字段。图片 atlas 只是现有程序化轨迹中的装饰 sprite。
- 不把原图、Prompt、聊天正文、Emoji 事件、投掷轨迹写入规则快照、moveLog、Replay、奖励、AI 学习、Analytics、数据库、localStorage 或普通日志。
- 不把可选人工清稿、Reviewer B、IP/法律意见或 Golden Set 写成完成/PASS；不让任何外部受限素材进入 source、生成输入、runtime 或发布。
- 不提交、推送、部署或宣称跨设备/生产就绪。

## 当前产品语义与 ID 冻结

下表是既有协议和当前 atlas 共同冻结的十个 ID。美术版本可以更新，但不得改变 ID、顺序或可识别语义。

| 顺序 | 稳定 `emojiId` | 语义（中文） | 语义（English） | fallback |
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

台账 `ART-024` 的历史描述曾出现“投降”，但现有十个稳定 ID 没有 `emoji_surrender`。本合同继续禁止把 `emoji_game` 或其他存量 ID 偷换成投降语义；若产品新增独立投降表达，必须另行修改台账、协议和兼容矩阵。

## 非谈判项

- Honru 身份锚点始终是“幽灵与手柄同体、左眼十字键、右眼四圆键”；姿态、嘴形、手势和火苗只表达情绪，不能改变身份。
- Emoji 与 `P-HONRU-STATES-V1` 九状态完全隔离，不复用 `mg_art_honru_states_v1` / `mg_art_honru_game_reactions_v1`。
- Manifest 身份、clearance、路径、atlas 几何、cell 或 decode 任一异常都 fail-closed 到 Unicode/文字；输入、协议和服务器事件不受影响。
- 只有服务端签发的 `senderUid/player/createdAt/protocol` 与既有 Block/频控/观众延迟结论有权决定展示资格；客户端图片不产生权威。
- Catalog 中 G-17–G-27 继续作为 `reference-only` 来源/provenance sidecar，独立的 `P-HONRU-EMOJI-V1` 条目只记录 `integrated-local-only` runtime 投影；二者都不取代包含 clearance 的生产 Manifest 作为运行时唯一机器事实源。
- `OPTIONAL_ADVISORY_EVIDENCE` 缺失不阻塞，`EXTERNAL_ENVIRONMENT_REQUIRED` 缺失只保持发布证据待决；两者都不得伪造成完成。外部受限素材没有例外。

## 验收终点

当前本地实现必须持续证明：十个 ID/目录/cell/fallback 同构；Alpha、尺寸、atlas/poster/hash/预算可复核；选择器、头像气泡和定向轨迹只消费同一 Manifest 资源；双 kill switch、404/decode/非法 cell、reduced-motion、静音、频控、Block、观众和生命周期均安全回退；Direct Chat/Match Chat 仍纯文字；无规则/权威/持久化副作用。真实设备与网络保持 `RELEASE_EVIDENCE_PENDING`，可选人工/IP/Golden Set 保持 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，当前整体保持 `NOT_RELEASED`。
