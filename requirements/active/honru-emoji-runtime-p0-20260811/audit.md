# Honru Emoji Runtime P0 现状审计

审计时间：2026-08-11（Asia/Tokyo）  
工作区：`D:\mini-games`  
审计性质：只读 recon + 合同冻结；本文件与同目录 `requirement.md`、`contract.md` 是本任务唯一新增文件。

## Current State

### 结论先行

协议和表现层的 Social Match P0/P1 已经存在且自动化通过；原创 Honru Emoji 资产、聊天共用适配器、atlas/poster、ART-025 正式轨迹素材和人工/IP/Golden Set 闸门都尚未完成。因此当前结论是：

> `GAME-023 = partial`；`ART-024 / ART-025 / SOC-017 = planned`。可以进入下一实现批次的合同评审，不能接入图片、不能默认开启、不能写成 production-ready。

### 需求台账事实

- `ART-024`：最少十个黑白 Q 版 Honru 原创 Emoji，`planned`；依赖 `ART-002`/`ART-011`。
- `ART-025`：局内投掷轨迹、弹出、命中素材，`planned`；现有程序化轨迹只是 fallback。
- `SOC-017`：原创 Honru Emoji 在聊天与局内共用，`planned`；依赖 `ART-024`。
- `GAME-023`：局内投掷原创 Emoji，`partial`；现有稳定语义 ID + Unicode fallback 已有，位图和最终轨迹未接入。
- `SOC-015`/`SOC-016` 已 `verified`：选择入口、目标、频控、队列、静音、Block、举报、观众和生命周期边界已经冻结。
- 台账 coverage group `emoji-expression-chat` 同时覆盖上述四个主 ID 与 `GAME-024/025`、`SOC-015/016/018`；本任务不修改台账。

### 现有运行时事实

| 事实 | 证据 | 审计判断 |
|---|---|---|
| WebSocket 客户端宣告 `match-expression-v1`/`match-chat-v1`，发送只含 `matchId/eventId/kind/expressionId/targetSeat` 或文字 | `public/src/online/03-websocket.js:1-7,358-372,584-605` | 协议已经足够承载稳定 ID；不需要为图片增加 wire 字段 |
| 服务端白名单正好十个 Emoji ID、四/十二/八十频控、300 条幂等、session/seat/time 权威和逐接收者 Block | `server/index.js:685-691,3783-3863` | 安全边界成熟；新图只能是表现替换 |
| Chat 服务端限 160 Unicode/640 bytes/4 行、最近 50 条内存、同样 Block/观众延迟 | `server/index.js:3866-3964` | 文字 Chat 合同已冻结，Emoji Chat 不能把图片 bytes 混进正文/持久化 |
| 当前 Emoji 选择盘、bubble、目标飞行都在 Game Stage app-shell，使用 Unicode map | `public/src/core/02-app-shell.js:388-433` | `04-social.js` 不是当前表达渲染 seam；不要把 Emoji 实现塞进成就/好友模块 |
| 当前目标飞行是 DOM rect → inert overlay，约 720ms；每席最多三条，900ms 客户端冷却，退出/重开清理 | `public/src/core/02-app-shell.js:400-425,561-576`; `public/index-template.html:1564-1573` | ART-025 可保留现有几何/时序作为 fallback，再替换素材层 |
| `public/src/core/06-assets.js` 只有九状态 `P-HONRU-STATES-V1` resolver，两个旧 Honru flag 严格字符串 `1` 双闸门 | `public/src/core/06-assets.js:73-76,155-203` | Emoji 必须新增独立 asset ID/flag；不能旁路九状态 resolver |
| Manifest 有 `P-002-HONRU-MASCOT-V1` 和 `P-HONRU-STATES-V1`，没有 Emoji 条目 | `public/assets/manifests/asset_manifest.json` | 目前没有可加载的原创 Emoji atlas/poster |
| Catalog 有九状态候选（`reference-only`）和本地运行时预览（`integrated-local-only`），没有 Emoji 项 | `asset-library/catalog.json` | 新 Emoji 尚未登记来源、hash、许可或远端键 |
| 线上/默认身份 fallback 仍是 `public/assets/brand/honru-mascot-v1.svg` | `public/assets/brand/honru-mascot-v1.svg`、Manifest `P-002-HONRU-MASCOT-V1` | 必须保留；Emoji 失败不应用 mascot 冒充表情 |

### 美术来源事实

- `art-source/style/ART_BIBLE_v1.md` 状态为 `IMPLEMENTING / HUMAN_REVIEW_REQUIRED`；要求 Ink/Paper/Cream、粗圆闭线、两级平涂、非第三方原创、44/64px 可读、≤1MiB atlas、reduced-motion/fallback 和顺序审批。
- Honru v2 母图 `art-source/brand/ghost-game/honru/v2/` 及九状态 `states-v1/` 都明确 `SOURCE_ONLY / HUMAN_REVIEW_REQUIRED / DO_NOT_SHIP` 或 `reference-only`；它们只能做身份/高层语法参考，不能当已批准 Emoji 母稿。
- `requirements/active/honru-expression-kit-v1-20260809/` 已有九状态 Alpha 自动审计（四角透明、绿色污染 0、三色归并、192/96/64/44 派生），但 Reviewer B/IP/Golden Set 未完成；该九状态批次不等于 Emoji 批次。

## Hot Files

以下是实现时最可能被触碰的 canonical source；本审计没有改动它们：

- `public/src/core/02-app-shell.js`：表达选择盘、Unicode fallback、目标投掷、bubble、mute 和生命周期。
- `public/src/core/06-assets.js`：Manifest allowlist、flag、按需加载、decode/fallback。
- `public/index-template.html`：Game Stage Command/Overlay 插槽、44px CSS、flight/bubble/reduced-motion 样式。
- `public/src/online/03-websocket.js`：协议 capability、发送/接收消息对；若 ID 不变应保持只读不改。
- `server/index.js`：白名单、身份、Block、频控、观众延迟、幂等和清理；HIGH，Master only。
- `public/src/core/04-social.js`：只负责成就/任务/最近一起玩；目前没有 Match Expression/Chat UI，不能误认为共享目录的现有入口。
- `public/assets/manifests/asset_manifest.json`、`asset-library/catalog.json`：资源机器事实/来源 sidecar；均属共享高风险文件。

## Shared Files

按 `HIGH_RISK_FILES.md` 与现有 active task ownership：

- `server/index.js`、`public/src/online/03-websocket.js`、`public/index-template.html`、`public/src/core/02-app-shell.js`、`public/index.html`、locale、`package.json` 是 Social Match 共享文件；普通 Agent 不能直接改，需 Master 的 `SHARED_CHANGE_REQUEST` 流程。
- `public/assets/manifests/asset_manifest.json` 是 MEDIUM/共享 Manifest；`asset-library/catalog.json`、`scripts/asset-library-audit.js` 是素材库共享文件。
- `public/src/games/**`、`shared/rules/**`、`server/gameplay/**`、`server/reward-engine.js`、`supabase/**` 明确禁止承载 Emoji 表现或协议。
- 既有 `honru-expression-kit-v1` ownership 把 `art-source/.../states-v1/**` 作为独占，并禁止 `public/assets/**`/`public/src/**`；新 Emoji 应新建独立目录，不能挤入旧任务。

## Generated Files

- `public/index.html` 是 `scripts/build.js` 生成产物，绝不能手改；实现批次若触碰模板/源码，必须双次 build、drift/hash 和完整质量门禁。
- 未来可生成的运行时资源是 `public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp`；本审计没有创建该目录或文件。
- `art-source/.../poster/` 只用于审查，不能作为线上运行时 authority；`asset-library` source/provenance 与 Manifest 必须同构但分层。

## Likely Conflicts

1. **协议 ID 与 Art-024 文案不完全一致**：现有十 ID 没有专用“投降”。改名、删除或把 `emoji_game` 偷换为投降都会破坏 `qa/social-match-contract.js` 和存量客户端；需产品先裁决。
2. **Chat 语义缺少 Emoji wire/adapter**：`match-chat-v1`/`direct-chat-v1` 目前是纯文字；把图片 URL/HTML/二进制塞入 `text` 会违反净化、隐私和持久化边界。SOC-017 只能先冻结共用目录，实际 Chat picker 需另立版本化协议或本地安全 token 适配。
3. **共享高风险文件均已有用户/其他 Agent dirty changes**：当前 worktree 的 `server/index.js`、`public/src/core/02-app-shell.js`、`public/src/online/03-websocket.js`、Manifest/Catalog、README、PROJECT_STATUS 等均显示修改，另有大量未跟踪 active task 目录。不得 reset、checkout、格式化或覆盖这些变化。
4. **生成产物 drift**：任何未来前端改动都必须经 `scripts/build.js`；手工向 `public/index.html` 加 Emoji 会造成 drift。
5. **审批顺序阻断默认开启**：`ART-010` Reviewer B 与 `ART-011` Golden Set 仍 blocked；自动 Alpha/Manifest QA 不能解除 `DO_NOT_SHIP`。
6. **外部设备证据缺失**：第二桌面浏览器、Android/iPhone/Tablet、真实网络整形、可见 reduced-motion 尚未完成；不能把现有 Chromium/静态 QA 当真机通过。

## Existing Tests

本次仅运行只读/静态测试，不运行会改写构建产物或持久数据的发布链：

| 命令 | 结果 | 真实覆盖 |
|---|---|---|
| `node qa/social-match-contract.js` | `SOCIAL_MATCH_CONTRACT_ALL_PASS` | 十个稳定 ID、服务端权威、Block、频控、目标 bubble、900ms 冷却、44px、reduced-motion、三语和无规则副作用 |
| `node qa/match-chat-contract.js` | `MATCH_CHAT_CONTRACT_ALL_PASS` | 文字净化/长度/频控/50 条内存/Block/观众只读、draft、报告、静音、44px、生命周期 |
| `node qa/honru-runtime-contract.js` | `HONRU_RUNTIME_CONTRACT_ALL_PASS` | 九状态 Honru 双旗标、Manifest allowlist、decode fallback、重连/replay/销毁隔离、规则/奖励/AI 边界 |
| `node scripts/asset-library-audit.js` | `ASSET_LIBRARY_AUDIT_ALL_PASS` | Catalog schema、路径/hash/许可/status、Manifest 同构、九状态 reference-only/public 分层 |
| `node qa/asset-manifest-v2.js` | `ASSET_MANIFEST_V2_ALL_PASS` | 既有封面、Sticker Gomoku、九状态 Honru 及其他 Manifest/预算/fallback/flag 回归 |
| `git diff --check` | exit 0（仅 CRLF warnings） | 当前 dirty patch 的空白检查 |

尚未执行：`qa/social-match-online.js`、`qa/match-chat-online.js`、完整 `npm test`、`npm run quality:gates`、真实浏览器/真机/网络整形、人工清稿、Reviewer B、IP Similarity Review、Golden Set。上述缺项不能由静态 PASS 推断完成。

## Relevant Requirements

- `requirements/PRODUCT_REQUIREMENTS_LEDGER.json:95,107,118,155,217-218,291-293,331-334`：ID、依赖、coverage group 和当前状态唯一来源。
- `requirements/active/social-match-p0-20260809/contract.md`：既有 `match-expression-v1` 消息、十个 ID、4/12/80 频控、300 幂等、Block/观众/静音/队列/回退合同。
- `requirements/active/social-match-chat-p1-20260810/contract.md`：`match-chat-v1` 文字边界、50 条内存、净化、Block、观众 delay、举报和清理。
- `requirements/active/honru-expression-kit-v1-20260809/contract.md`、`evidence/source-alpha-audit-202608090320.json`：Honru 透明、三色、派生尺寸和 `DO_NOT_SHIP` 事实。
- `requirements/active/honru-runtime-integration-p2-20260809/contract.md`：既有九状态双闸门、按需加载、v1 SVG fallback、replay/destroy 隔离。
- `art-source/style/ART_BIBLE_v1.md`：颜色、轮廓、原创、尺寸、atlas/性能、reduced-motion 和审批顺序。
- `HIGH_RISK_FILES.md`、`AGENTS.md`、`PROJECT_STATUS.json`：共享文件、禁止写入、生成产物、外部门禁和 release blocked 规则。

## Gap Audit

| 范围 | 现状 | 缺口 | 建议状态 |
|---|---|---|---|
| ART-024 素材 | 无十枚 Emoji 源/Alpha/flat/derived | 无 Prompt、hash、审查 packet、poster、atlas | `planned / not_executed` |
| ART-025 动作素材 | 只有 CSS/Unicode 720ms 程序化 fallback | 无原创飞行/命中/弹出素材及运动预算证据 | `planned / fallback_only` |
| SOC-017 聊天共用 | Match Expression 有十 ID；Direct/Match Chat 是文字 | 无共享目录 resolver、Chat picker 或版本化 Emoji wire | `planned / contract_only` |
| GAME-023 局内投掷 | targetSeat/Block/频控/队列/静音/轨迹代码已通过 | 仅显示 Unicode，未裁 atlas，未使用获批 Honru 图 | `partial` |
| Manifest/Catalog | 九状态 `P-HONRU-STATES-V1` 已登记，Emoji 无条目 | 无 `P-HONRU-EMOJI-V1`、cells/hash/budget/flags | `not_executed` |
| 审批 | Art Bible/Reviewer A 草稿及自动 Alpha 证据存在 | Reviewer B、IP、Golden Set、用户签字缺失 | `blocked` |
| 外部验收 | 既有 Social/Honru 静态 QA 全 PASS | online、第二浏览器、真机、网络、可见 reduced-motion 未执行 | `not_executed` |

## Recommended Minimum File Ownership

这是后续实现批次的最小所有权，不是本任务授权修改清单：

| 责任面 | 最小文件范围 | 推荐 owner/规则 |
|---|---|---|
| 美术源与审查 | `art-source/brand/ghost-game/honru/emoji-v1/**` | Art owner；独立保存 Prompt、Alpha、hash、Reviewer A/B、Golden Set；禁止写 `states-v1` |
| 素材库/Manifest | `asset-library/catalog.json`、`public/assets/manifests/asset_manifest.json`、`scripts/asset-library-audit.js` | Master/asset owner；共享高风险，先走变更请求；Manifest 是 runtime authority |
| 共享目录/resolver | 建议新建 `public/src/core/honru-emoji-catalog.js`（纯白名单/cell/fallback）与 `public/src/core/06-assets.js` 最小 resolver seam | Runtime owner；不把目录复制到 `04-social.js` 或游戏规则 |
| Game Stage 表现 | `public/src/core/02-app-shell.js`、`public/index-template.html` | UI/Motion owner；只换 atlas crop/轨迹表现，保留现有 target/queue/cleanup；Overlay 继续 inert |
| Chat 表现/适配 | `public/src/core/02-app-shell.js` 与既有 Chat 模块（必要时另建 `chat-emoji-v1` adapter） | Social owner；先确定 wire/持久化合同，再接 picker；不把图片塞入文字字段 |
| 协议/权威 | `server/index.js`、`public/src/online/03-websocket.js` | Master/serverProtocol/clientProtocol；若只替换 ID→asset，不应修改；任何新 Chat wire 必须成对更新并版本化 |
| QA | 新 `qa/honru-emoji-contract.js`，并扩展 `qa/social-match-contract.js`/`qa/match-chat-contract.js` 的目录同构断言；online tests 保持现有 owner | qaRelease；覆盖资产、flags、fallback、geometry、Block、spectator、lifecycle、i18n、performance |
| 构建/产物 | `scripts/build.js` → `public/index.html` | Master；禁止手工编辑生成产物；双 build/hash/drift 必须证据化 |
| 台账/报告/日志 | `requirements/PRODUCT_REQUIREMENTS_LEDGER.json`、`PROJECT_STATUS.json`、`LOG-*`、`简易报告/**` | Master only；本任务明确不修改 |

## Risk Level

`HIGH / BLOCKED_FOR_RUNTIME`

原因：涉及原创/IP审查与共享 Manifest/高风险前端文件；当前 worktree 已广泛 dirty；Art-024 语义存在“投降”与存量 ID 不一致；SOC-017 的聊天 wire 尚未定义；Reviewer B、Golden Set、真机和真实网络证据均缺失。合同可供下一步评审，运行时接入必须等这些阻断逐项解除。

## 审计收口

本任务只新增本目录三份 Markdown。现有代码/测试的通过证明的是安全的 Unicode/代码原生 fallback 与协议边界，不证明原创 Honru Emoji 已生成、已获批、已进入 Chat、已进入 Manifest、已默认开启或已上线。
