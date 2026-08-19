# Honru Emoji Runtime P0 现状审计

原审计时间：2026-08-11（Asia/Tokyo）  
当前事实复核：2026-08-16（Asia/Tokyo）  
工作区：`D:\mini-games`  
当前性质：文档事实同步；runtime、Manifest、QA 与台账只读

> 本文件的 2026-08-16 章节是当前结论。原 2026-08-11 结论仅在末尾作为 `historical-as-of` 审计轨迹保留，不再覆盖当前治理政策、所有者清除、Manifest 或 runtime 事实。

## 2026-08-16 Current State

### 结论先行

`P-HONRU-EMOJI-V1` 已取得 `OWNER_AUTHORIZED_ART_CLEARANCE`，十枚稳定 Honru Emoji、atlas、poster、Manifest 与可逆 default-on 消费链已经在当前本地代码中实现：选择器、头像旁 Emoji 气泡和目标席位定向投掷共同消费本地 atlas，并保留 Unicode/文字 fallback、双 kill switch、reduced-motion 与生命周期清理。

当前仍是 `LOCAL_ONLY / NOT_RELEASED`。这项实现没有新增 Rule/Authority/Protocol/Replay/Reward/AI/数据库字段；Direct Chat 与 `match-chat-v1` 仍为纯文字。设备、第二浏览器、真实网络和线上最新构建只保持 `RELEASE_EVIDENCE_PENDING`；人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 是未执行的可选咨询，不阻塞本地 runtime 或未来发布候选。

### 当前需求台账事实

| 台账 ID | 2026-08-16 状态 | 当前判断 |
|---|---|---|
| `ART-024` | `implemented` | 十枚源/Alpha/四档派生、atlas/poster、provenance、clearance、Manifest 与 default-on runtime 已落盘 |
| `ART-025` | `planned` | 当前图片 atlas 已用于既有程序化定向轨迹；独立精细投掷/命中/弹出素材包仍未实现，且不得改变权威/协议 |
| `SOC-017` | `partial` | 局内表达共用稳定 ID/cell/fallback 已实现；Direct Chat 与 match-chat-v1 图片/Emoji token 协议未实现 |
| `GAME-023` | `implemented` | 选择器、头像气泡、targetSeat 投掷、fallback、双 kill switch、reduced-motion 与清理已本地实现 |
| `SOC-015` / `SOC-016` | `verified` | 既有入口、目标、频控、队列、静音、Block、举报、观众和生命周期边界继续生效 |

这些状态来自 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json`；本次只同步三份文档，没有修改台账、状态或报告。

## 当前资产与 Manifest 事实

| 事实 | 当前证据 | 判断 |
|---|---|---|
| 十个 ID 固定为 `emoji_wave`、`emoji_thumbsup`、`emoji_cheer`、`emoji_wow`、`emoji_oops`、`emoji_cry`、`emoji_angry`、`emoji_sly`、`emoji_heart`、`emoji_game` | server/app-shell allowlist、QA、Manifest cells | ID、顺序与 Unicode fallback 同构；没有第十一个或 `emoji_surrender` |
| 十枚 source/Alpha/192/96/64/44px 派生与审查 packet 已落盘 | `art-source/brand/ghost-game/honru/emoji-v1/` | Alpha 四角透明、可见绿色污染 0；来源/provenance 可复核 |
| runtime atlas 为 1024×768、4×3、256px cell，末两格透明 | `public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp` | 302,314 bytes；SHA-256 `63108f289eab68f096cae59e2c32623e9e09b67fbebebb3383cc317494530d6a` |
| runtime poster 为 640×360 | `public/assets/brand/honru/emoji-v1/honru-emoji-poster-v1.webp` | 67,146 bytes；SHA-256 `ec4b5a263839367a6ddcb9ced1b1b58fa2cbd24b0812b290be17eb7da84b9e35` |
| Manifest 存在 `P-HONRU-EMOJI-V1` | `public/assets/manifests/asset_manifest.json` | `status: ready`、`clearance: OWNER_AUTHORIZED_ART_CLEARANCE`、`default_enabled: true`、十 cells/fallbacks、组合预算 1,232,896 bytes |
| 每族所有者清除记录完整 | `OWNER_AUTHORIZED_ART_CLEARANCE.md` | 授权 default-on 可逆 runtime；不冒充人工/IP/法律或发布授权 |
| Catalog G-17–G-27 仍为 `reference-only` | `asset-library/catalog.json` | 仅表示来源/provenance sidecar 不进入 public；不表示 Manifest runtime 家族仍是 source-only |
| Catalog `P-HONRU-EMOJI-V1` 为 `integrated-local-only` | `asset-library/catalog.json` | 只投影 owner-cleared atlas/poster 的本地 runtime 路径与 SHA；Manifest 仍是 runtime authority |

## 当前 runtime 事实

### 资产解析

- `public/src/core/06-assets.js` 冻结 `P-HONRU-EMOJI-V1`、两个独立开关和十个稳定 ID。
- `ownerClearedDefaultOnFlagEnabled()` 把缺失值或严格字符串 `"1"` 解释为开启，其他值关闭；storage 异常 fail-closed。
- `resolveHonruEmojiCell()` 校验 Manifest `runtime_id/status/clearance/path/default_enabled/flags`、atlas 几何和 cell 边界，只返回版本化本地 URL 与冻结裁切信息；未知 ID、路径替换、错误 clearance 或越界 cell 均返回 `null`。
- 总开关 `mg_art_honru_emoji_v1` 关闭全部图片；`mg_art_honru_emoji_throw_v1` 只关闭定向投掷图片，不关闭选择器与头像旁静态 Emoji。

### 已接入的局内消费者

- `public/src/core/02-app-shell.js` 的表达选择器、头像旁 Emoji 气泡与定向投掷共用 `resolveHonruEmojiCell()` 和 `MATCH_EXPRESSION_EMOJI_FALLBACK`。
- atlas 在相关表面可见时按需 decode；成功后使用 CSS background-position 裁 cell，失败保留 Unicode glyph/本地化 label，按钮仍可操作。
- `targetSeat` 图片沿既有约 720ms DOM rect → inert Game Stage overlay 的程序化轨迹飞行；落点仍由现有 Seat 气泡承担。`quick_*` 不飞。
- 这只是 ART-025 轨迹上的 sprite 替换，没有新增投掷权威、命中判定、规则坐标、协议字段或持久化。ART-025 剩余的精细素材包仍是 `planned`。
- reduced-motion 取消飞行但保留静态气泡；换局、离开、结束、真实断开、新 match、静音与 timer 到期继续清理 flight/bubble，迟到 decode 回调受节点连接与 match 绑定保护。

### 协议、Chat 与数据边界

- `match-expression-v1` wire 仍只传 `matchId/eventId/kind/expressionId/targetSeat`；Manifest path、asset ID、atlas cell 与图片 bytes 不进入 wire。
- `direct-chat-v1` 与 `match-chat-v1` 仍只消费经过净化的 `text`。当前没有 Chat Emoji picker、inline token、图片 URL、二进制或 atlas adapter，因此 `SOC-017` 必须保持 `partial`。
- 图片不进入聊天正文、普通日志、moveLog、Replay、Reward、AI 学习、Analytics、Profile、数据库、Supabase、localStorage 或用户经济状态。
- 身份、session、player、时间、Block、频控、幂等、观众延迟与举报仍由既有服务器合同决定；客户端图片永远只是装饰。

## Gate 与发布边界

- `GATE-ART-GOLDEN-SET` 对该原创资产族已是 `OPEN_BY_OWNER_AUTHORIZATION`；`OWNER_AUTHORIZED_ART_CLEARANCE` 允许可逆 default-on runtime 与未来发布候选。
- 人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 保持 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`。缺失不阻塞，也不得写成 PASS、签字或法律结论。
- 外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁用，不能复制、描摹、裁切、换色、作为生成输入、接入 runtime 或发布。
- `GATE-DEVICE-BROWSER-NETWORK` 对开发是开放的，对发布仍是 `RELEASE_EVIDENCE_PENDING`：第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能、真实读屏与线上当前构建尚未由本项证明。
- 当前未 commit、push、Pages 或 Render deploy；发布仍只接受用户当前明确命令。

## 当前专项 QA 与检查面

| 命令/证据 | 当前覆盖 |
|---|---|
| `node qa/honru-emoji-contract.js` | 十个 ID、源/Alpha/派生、atlas/poster/hash/bytes、Catalog/Manifest 原子状态、clearance、default-on flags、consumer、Chat 纯文字和历史审计降级 |
| `node qa/honru-emoji-runtime.js` | 缺失值默认开启、总/投掷 kill switch、静态/flight 分离、Manifest 单飞、路径/clearance/cell/ID fail-closed、storage 异常 |
| JSON 解析 `public/assets/manifests/asset_manifest.json` | Manifest 语法与 `P-HONRU-EMOJI-V1` 当前字段 |
| `OWNER_AUTHORIZED_ART_CLEARANCE.md` | M0 North Star、source/runtime SHA、机器风险审查、fallback、回滚、可选咨询与发布边界 |

自动化通过只能证明本地合同与技术实现；不能替代第二浏览器、真机、真实网络、人工/IP/Golden Set 咨询或线上发布证据。

## 当前 Gap Audit

| 范围 | 当前达到 | 剩余缺口 | 当前语义 |
|---|---|---|---|
| ART-024 | 十枚素材、atlas/poster、clearance、Manifest/runtime | 外部发布证据 | `implemented / not released` |
| ART-025 | atlas sprite 已用于既有程序化飞行/落点 | 独立精细投掷/命中/弹出素材包 | `planned`，不影响当前 GAME-023 runtime |
| SOC-017 | 局内 stable ID/cell/fallback 共用 | Direct Chat/match-chat 图片或 token 协议 | `partial` |
| GAME-023 | 选择器、气泡、投掷、fallback、kill switch、清理 | 第二浏览器/真机/网络/线上证据 | `implemented / release evidence pending` |
| 可选咨询 | 所有者清除已完成 | 人工清稿、Reviewer B、IP/法律、Golden Set | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，不阻塞 |
| 外部素材 | 严格隔离 | 无允许路径 | 永久禁用 |

## 保留的设计与所有权合同

- `public/src/core/06-assets.js` 继续拥有 Manifest allowlist、旗标、按需加载和失败回退；不要在 Chat、游戏规则或每个消费者复制第二套 cell 表。
- `public/src/core/02-app-shell.js` 继续拥有现有选择器、Seat 气泡、DOM 轨迹、静音和生命周期；ART-025 只能深化表现，不能进入 Rule/Authority。
- `server/index.js` 与 `public/src/online/03-websocket.js` 继续拥有 `match-expression-v1` 协议与权威；纯图片替换不应改 wire。
- Direct Chat/Match Chat 若未来新增 Emoji token，必须另立版本化协议、安全/持久化/兼容审查，不得把图片塞入 `text`。
- `public/index.html` 仍是构建产物，不能手改；Manifest/Catalog/共享 runtime 文件继续按项目所有权规则维护。
- 十个稳定 ID 没有“投降”；不得把 `emoji_game` 偷换语义。

## 2026-08-11 Historical-as-of 审计轨迹

审计时间：2026-08-11（Asia/Tokyo）

以下内容只记录当时为何建立合同，不是当前阻塞：

- 当时协议已有十个稳定 ID、Unicode 选择器/气泡、程序化 targetSeat 轨迹、Block/频控/观众/清理；这一发现仍是当前“只换表现、不改协议”的设计基础。
- 当时尚无 Emoji 源图、atlas/poster、Manifest 条目、独立 resolver 或图片消费者；`ART-024 / ART-025 / SOC-017` 当时为 planned，`GAME-023` 当时为 partial。
- 当时 `direct-chat-v1` / `match-chat-v1` 已经是纯文字，这一边界至今不变。
- 当时风险记录为 `HIGH / BLOCKED_FOR_RUNTIME`，原因是尚未生成资产、尚无 clearance 且旧政策把人工/IP/Golden Set 当阻断。该判断已被 2026-08-16 的 `AUTOMATED_AND_HUMAN_GATE_POLICY`、`OWNER_AUTHORIZED_ART_CLEARANCE`、当前 Manifest/runtime/QA 事实取代，绝不能继续用于阻止 owner-cleared 本地 runtime。
- 当时发现的“没有 `emoji_surrender`”、共享高风险文件所有权、Manifest 是 runtime authority、Catalog 是来源 sidecar、图片不得进入协议/数据、程序化 fallback 必须保留等设计结论继续有效。

## 审计收口

当前可陈述的事实是：`P-HONRU-EMOJI-V1` 已获所有者清除并在本地选择器、头像气泡和定向投掷中 default-on、可回滚地实现；Direct Chat 与 match-chat-v1 仍纯文字；ART-025 没有新增权威/协议且精细素材包仍 planned；可选人工/IP/Golden Set 咨询未执行但不阻塞；设备/网络只缺发布证据；外部受限素材永久禁用；整体未发布。
