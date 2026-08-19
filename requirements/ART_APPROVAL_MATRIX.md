# Ghost Game 美术候选统一审批矩阵

状态：`LOCAL_GOVERNANCE_BASELINE / GATE-ART-GOLDEN-SET=OPEN_BY_OWNER_AUTHORIZATION / EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED`

本文件是 `GATE-ART-GOLDEN-SET` 的原创资产清除与风险咨询索引，不替代 `asset-library/catalog.json` 的来源/哈希事实，也不替代 `public/assets/manifests/asset_manifest.json` 的运行时事实。它把每个候选的版本、M0 North Star、机器审查、可选清稿/Reviewer/IP/Golden Set 咨询与回滚统一到同一张可审计清单，防止把“技术可用”或“可选咨询未执行”误写成虚假的人工/法律批准。

## 状态词典

| 状态 | 定义 | 可否进入默认 runtime |
| --- | --- | --- |
| `LEGACY_FALLBACK` | 已有线上/本地回退资产；不代表其已经通过本轮 Golden Set。 | 仅作为既有 fallback，禁止借此推导新候选获批。 |
| `SOURCE_ONLY_CANDIDATE` | 仅存在于 `art-source/` 或素材库 provenance；可审查、可重做。 | 否。 |
| `DEFAULT_OFF_TECHNICAL_PREVIEW` | 已有版本化 public 预览和严格默认关闭开关，只证明技术回退/生命周期。 | 否；除非另行满足 `OWNER_AUTHORIZED_ART_CLEARANCE`。 |
| `OWNER_AUTHORIZED_ART_CLEARANCE` | 仅限原创 Ghost-native 候选；用户已确认 M0 North Star，稳定 ID、版本、源 SHA-256、provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚路径均已冻结。 | 可作为可逆 default-on runtime 与发布候选；发布仍需用户当前明确命令，且不声称人工清稿、Reviewer B、IP/法律或 Golden Set 已 PASS。 |
| `EXTERNAL_REFERENCE_ONLY` | 外部素材或其目录/预览，许可未确认；在用户授权的受控全信息 reference lane 内可提供给本地或已配置第三方 Skill，并逐输入记录路径、SHA-256、provider、model、taskId、transmissionScope。 | 否；不得把源像素/图层直接复制进 runtime。外部影响输出先保持 `SOURCE_ONLY_EXTERNAL_INFLUENCED / SIMILARITY_REVIEW_REQUIRED`，必须重新 Ghost-native 重绘并完成 provenance/相似风险审查。 |

`TECHNICAL_PASS`、`ready`、`integrated-local-only` 只说明已声明的技术或本地预览边界；它们本身不等价于 `OWNER_AUTHORIZED_ART_CLEARANCE`，更不等价于人工清稿、Reviewer B、IP/法律意见或 Golden Set 已完成。

根据 `requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md`，技术 Reviewer、哈希、Alpha、污染、尺寸、数值对比度、小尺寸技术可读性、Manifest/fallback 和自动回归默认由机器继续并留证，不再等待用户逐项确认。人工清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`；真机/第二浏览器属于外部环境证据，而不是泛化的“人工审美确认”。这些咨询未执行时必须如实保留未执行状态，但不阻断原创资产的所有者清除、runtime 或未来发布。

## 统一清除与咨询顺序

1. 冻结稳定 ID、版本、源/预览 SHA-256、Prompt/provenance、许可和 fallback；外部受限或来源不明素材直接留在隔离轨道。
2. Reviewer A / 机器审查记录 Alpha、污染、尺寸、技术可读性、风格一致性与相似风险；发现确定性缺陷时直接返工。
3. 冻结 runtime 派生、Manifest、feature flag、失败回退与一键回滚；完成双主题、三语言、a11y、reduced-motion 和性能/解码的本地合同。
4. 主负责人核对 M0 North Star 与上述证据，为合格的原创 Ghost-native 资产逐族记录 `OWNER_AUTHORIZED_ART_CLEARANCE`；未取得该记录的具体候选保持原状态，不因整门开放而自动升级。
5. 取得所有者清除的资产可以进入可逆 default-on runtime 候选并继续本地浏览器/布局/性能验收；第二浏览器、Android/iPhone/Tablet 与真实网络作为 `RELEASE_EVIDENCE_PENDING` 单独记录，不阻塞不依赖它们的开发。
6. 人工可编辑清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 可在任意阶段追加为 `OPTIONAL_ADVISORY_EVIDENCE`；其缺失不得阻塞第 2–5 步，其结论也不得由机器伪造。
7. 任一候选若在机器审查、所有者复核或可选咨询中发现高风险，回到 `REWORK` 或隔离状态，旧 fallback 不被覆盖。
8. 任何发布仍需用户当前明确命令；所有者清除、机器 PASS 或可选咨询均不自行触发 commit、push、Pages、Render 或生产数据操作。

### 所有者授权的原创美术清除轨道

在 M0 North Star、稳定 ID、版本、源 SHA-256、provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与一键回滚均可复核后，原创 Ghost-native 候选可获得 `OWNER_AUTHORIZED_ART_CLEARANCE`，接入可逆 default-on runtime，以继续完成真实 UI、Game Stage、性能和可见性回归，并作为未来发布候选。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 仍可追加为风险咨询，但不改变该清除权；本条不把任何当前候选自动升级到该状态，也不把未执行的咨询写成 PASS。

`G-13-TANK-ART-P1-REJECTED` 永远不在此例外中。所有 `EXTERNAL_REFERENCE_ONLY` / `blocked-license` 外部素材仍不获得项目许可或 runtime 例外；在用户授权的受控全信息 reference lane 内可以提供给 Skill 作为任务相关输入，但必须逐输入留存 provenance，不得把源像素/图层直接复制、描摹、换色后接入 runtime，外部影响审计只保留在 source-only 与相似风险复核层。

## 候选矩阵

| 资产族 / 稳定 ID | 当前状态 | 冻结来源与 SHA | 人工清稿 | Reviewer A | Reviewer B / IP | Golden Set | 设备/主题矩阵 | Runtime 边界 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Ghost Mark / Wordmark：`P-001-GHOST-MARK`、`P-001-GHOST-WORDMARK` | `LEGACY_FALLBACK` | 手工 SVG；Manifest integrity 固定 | 手工几何母版 | 结构自检 | 历史文档仍 `PENDING` | 不作为新候选签字 | 后续持续回归 | 当前固定品牌标识；不得作为其他候选批准的替代证据。 |
| Honru v1：`P-002-HONRU-MASCOT-V1` | `LEGACY_FALLBACK` | 手工 SVG；Manifest SHA `42c644…2de64` | 手工 SVG | 结构自检 | 历史文档仍 `PENDING` | 不作为新候选签字 | 后续持续回归 | 当前唯一默认品牌角色 fallback。 |
| Honru v2：`BRAND-HONRU-CHARACTER-MASTER-V2-DRAFT` | `SOURCE_ONLY_CANDIDATE` | `1f4a02…790eb`；v2 provenance | 未完成可编辑分层重绘 | Draft `TECHNICAL_PASS` | `PENDING / PENDING` | 未签字 | `NOT_EXECUTED` | 不进 `public/`、Manifest、训练正样本或默认角色。 |
| Honru cleanup v1 | `SOURCE_ONLY_CANDIDATE` | cleanup provenance、Alpha/派生已固定 | AI-assisted，非人工清稿 | `TECHNICAL_PASS` | `NOT_EXECUTED / NOT_EXECUTED` | `DO_NOT_ENABLE` | `NOT_EXECUTED` | 不创建新 Manifest ID，不改现有旗标。 |
| Honru 九状态：`P-HONRU-STATES-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | 九个 flat/source SHA 与 WebP integrity/bytes 已固定 | 机器视觉精修完成；`thinking/lose` 保留 44px 文字辅助 | `TECHNICAL_PASS + OWNER_CLEARANCE` | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 所有者清除记录已落盘；额外 Golden Set 可选 | `RELEASE_EVIDENCE_PENDING` | 默认开启；素材总开关与局内分开关可独立回滚，v1 SVG 永久 fallback。 |
| Honru Emoji：`G-17`–`G-27` / `P-HONRU-EMOJI-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | 十枚 Alpha、40 派生、atlas/poster、Prompt/SHA 与 runtime WebP SHA 已固定 | 机器视觉精修完成；`angry/heart/cry` 保留小尺寸风险备注 | `TECHNICAL_PASS + OWNER_CLEARANCE` | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 所有者清除记录已落盘；额外 Golden Set 可选 | `RELEASE_EVIDENCE_PENDING` | Manifest-backed default-on；双 kill switch、Unicode/文字 fallback 与一键回滚保留。Direct/Match Chat 仍为纯文字，不扩协议。 |
| Honru Pixel Avatar v3 | `SOURCE_ONLY_CANDIDATE` | C2PA source / Alpha SHA 固定；精确 Prompt `NOT_RECOVERED` | 未完成 | 技术候选 | `NOT_EXECUTED / NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | 不进 Avatar catalog、商城、Profile/Room runtime；不得伪造补录 Prompt。 |
| G Coins source：P0 `ART-026-GCOINS-SOURCE-CHROMA-V1`；P1 `ART-026-GCOINS-P1-CANDIDATE-B` | `SOURCE_ONLY_CANDIDATE` | P0 `9d6d88…919ad` 保留；P1 B chroma `6a99be…dd04a`、Alpha `d62909…2854c`；A/C 未选稿亦保留 | P1 已机器抠图并生成 44/64/96/192px，仍未人工可编辑清稿 | 机器 `TECHNICAL_CANDIDATE`，B 为技术首选 | `NOT_EXECUTED / NOT_EXECUTED` | `NOT_EXECUTED` | 仅本地 light/dark/checker 审查板；第二浏览器/真机 `NOT_EXECUTED` | 源稿继续留在 `art-source/` 供审批；该 source ID 不直接进入 Manifest/runtime，P-003 SVG 与 `💵` 仍是永久 fallback 链。 |
| G Coins runtime：`P-GCOINS-ICON-V1`（source `ART-026-GCOINS-P1-CANDIDATE-B`） | `OWNER_AUTHORIZED_ART_CLEARANCE` | runtime 版本 1；主文件 `02af42…fb648`，44/96/192px 派生完整 SHA 与 provenance 已绑定；清除记录 `requirements/active/gcoins-source-redesign-p1-20260814/OWNER_AUTHORIZED_ART_CLEARANCE-20260816.md` 已落盘 | 机器视觉/技术精修完成；人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE` | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产 Golden Set 为可选咨询，未执行 | `RELEASE_EVIDENCE_PENDING`；当前仅本地浏览器/自动化合同 | Manifest-backed default-on（`mg_art_gcoins_p1_v1`）；加载、解码或 flag 失败回退 `P-003` SVG，再回退 `💵`；金额、价格、奖励、协议、Supabase 与权限不变。 |
| P0-01 Auth / Boot / PWA：`P-AUTH-GHOST-WAKE-BACKDROP-V1`、`P-AUTH-HONRU-SCENES-V1`、`P-BOOT-HONRU-CONTROLLER-V1`、`P-AUTH-STATUS-ICONS-V1`、`P-PWA-GHOST-WAKE-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | artwork v1；四套 Ghost Wake 源 SVG、八套 512px Honru Alpha、两套 Boot Alpha、六枚 64px 状态 SVG、双 Splash 与 192/512 Maskable 均有逐文件 SHA/bytes/dimensions；完整记录见 `art-source/platform/auth/ghost-wake-v1/asset-family-manifest-v1.json` 与同目录 clearance | 项目自有 M0/Honru 的确定性矢量与合成派生；已做机器接触表和小尺寸审查，人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/auth-art-contract.js` 验证 WebP/PNG/SVG/Alpha/Maskable/Manifest | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 当前本地浏览器可见证据待本批次补齐；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | Auth/Boot 为 Manifest-backed 双级 default-on flag，Manifest/路径/flag/加载/解码失败回退既有 Honru、Ghost Mark 与 CSS 环境；PWA 继续保留旧 any-purpose icon 和 HTML/CSS 启动壳回滚。外部 `blocked-license` 素材未作为输入。 |
| P0-02 Platform Scenes：`P-PLATFORM-SCENES-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | artwork v1；48 个 SVG source masters、80 个 WebP Runtime（含 layered/static/poster/mini）、4 张审查板与逐文件 SHA/bytes/dimensions/Alpha 已冻结；完整记录见 `art-source/platform/scenes/signal-worlds-v1/asset-family-manifest-v1.json` | 项目自有 M0 North Star 的确定性 SVG 几何与 WebP 派生；人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/platform-scenes-contract.js` 验证 80 路径、WebP、Alpha、Manifest、预算、回退与生命周期 | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 修复后本地浏览器可见证据 `NOT_EXECUTED`；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | 四区 route-aware layered background；reduced-motion 用 static、save-data 用 poster、flag/Manifest/decode/late result 失败回退既有 CSS cloud/star 环境；外部 `blocked-license` 素材未作为输入。 |
| P0-03 Shared Game Stage：`P-GAME-STAGE-SHARED-ART-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | artwork v1；11 个 SVG source masters、22 个 WebP Runtime（surface/frame 与 9 个无文字语义 VFX 的 static 变体）、1 张审查板与逐文件 SHA/bytes/dimensions/Alpha 已冻结；完整记录见 `art-source/platform/game-stage/shared-v1/asset-family-manifest-v1.json` | 项目自有 M0 North Star 的确定性 SVG 几何与 WebP 派生；人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/game-stage-art-contract.js` 验证路径、Alpha、Manifest、9 事件、回退与清理 | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 修复后本地浏览器可见证据 `NOT_EXECUTED`；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | Game Stage 仅在表现层按需加载；语义事件由 Motion Adapter 消费；失败回退同族 static 与现有 CSS/DOM stage；规则、协议、Replay、奖励与经济不读图。 |
| P0-04 Modal Header：`P-MODAL-ILLUSTRATION-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | artwork v1；27 个 512px SVG source masters、324 个 WebP Runtime（27 语义 × 4 tone × 3 size）、4 张审查板与逐文件 SHA/bytes/dimensions/Alpha 已冻结；完整记录见 `art-source/platform/modal/illustrations-v1/asset-family-manifest-v1.json` | 项目自有 M0 North Star 的确定性无文字 SVG 几何与 WebP 派生；人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/modal-art-contract.js` 验证 324 路径、Alpha、Manifest、预算与失败回退 | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 修复后本地浏览器可见证据 `NOT_EXECUTED`；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | `showModal()` 只在表现层挂载无文字插画，标题/正文/按钮仍由 HTML/i18n 提供；resolver/flag/decode 失败回退既有 CSS/HTML；外部 `blocked-license` 素材未作为输入。 |
| P0-05 Loading State：`P-LOADING-STATE-ART-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | artwork v1；12 个 512px SVG source masters、36 个 Alpha WebP Runtime、22 contexts、9 progress semantics 与 1 张审查板已冻结；完整记录见 `art-source/platform/loading/state-art-v1/asset-family-manifest-v1.json` | 项目自有 M0 North Star 的确定性无文字 SVG 几何与 WebP 派生；人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/loading-art-contract.js` 验证路径、Alpha、Manifest、预算与 spinner/HTML fallback | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 修复后本地浏览器可见证据 `NOT_EXECUTED`；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | `loadingNode()` 保留 spinner、live copy 与 DOM/CSS 数值，只按需挂载 aria-hidden 图；失败回退原 loading；外部素材未作为输入。 |
| P0-06 Gomoku Final：`G-02-GOMOKU-FINAL-ART-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | artwork v1；18 个 SVG source masters（4 棋盘 / 5 成对棋子材质 / 7 语义 VFX / 2 镜头）、36 个 WebP Runtime、1 张审查板；runtime `477,912` bytes / 4 MiB；完整记录见 `art-source/games/gomoku/final-art-v1/asset-family-manifest-v1.json` | 项目自有 M0 North Star 的确定性 Ghost-native SVG 几何与 WebP 派生；人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/gomoku-final-art-contract.js` 验证 SHA、尺寸、Alpha、Manifest、独立 resolver、VFX 语义、fallback 与规则隔离 | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 最新构建本地浏览器可见证据待本批次回归；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | 只改 Gomoku canvas/局内表现层；棋盘网格、落子合法性、snapshot、Replay、Authority、AI、奖励与协议不读图；Manifest/decode/flag 失败回退 Wave A/M0/Canvas/CSS/程序化 Ghost3D；外部素材未作为输入。 |
| P0-07 Ludo Final：`G-07-LUDO-FINAL-ART-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | artwork v1；34 个 SVG source masters（4 棋盘 / 12 阵营姿态飞机 / 3 路线原子 / 1 骰子 atlas / 5 VFX / 3 领奖台 / 4 皮肤 / 2 镜头）、68 个 normal/static WebP Runtime、2 张审查板；runtime `1,163,616` bytes / 8 MiB；完整记录见 `art-source/games/ludo/final-art-v1/asset-family-manifest-v1.json` | 项目自有 M0 North Star 的确定性 Ghost-native SVG 几何与 WebP 派生；九入口 Skill 路由已补记，人工可编辑清稿未执行 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/ludo-final-art-contract.js` 验证逐文件 SHA/尺寸/Alpha、52 路与 4 机场拓扑、Manifest、独立 resolver、VFX/领奖台语义、fallback 与规则隔离 | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 最新构建本地浏览器可见证据待本批次回归；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | 只改 Ludo 表现层；52 格路线、骰值、可移动性、吃子、额外回合、HOME、排名、snapshot、Replay、AI、Authority、Reward 与 Protocol 不读图；Manifest/decode/flag 失败回退 Wave A/CSS/DOM/程序化 Ghost3D；外部素材未作为输入。 |
| P0-08 Honru Context Reactions：`P-HONRU-CONTEXT-REACTIONS-V1` | `OWNER_AUTHORIZED_ART_CLEARANCE` | 用户确认 Q 手母图 SHA `6E670901…5144`；16 个 512px Context PNG、16 个 320px Alpha WebP、16 个 256px Quick PNG、1024²/4×4 Atlas、3 张审查板；runtime `629,746` bytes / 2 MiB | 母图仅替换人类手为无指/无拇指单团 Q 版幽灵手；其他身份特征不变；32 个派生为确定性项目内几何合成 | `TECHNICAL_PASS + OWNER_CLEARANCE`；`qa/honru-context-reactions-v1.js` 验证 SHA/尺寸/Atlas/确定性/防穿越/fallback/清理与 Authority 隔离 | `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED` | 逐资产额外 Golden Set 可选，未执行 | 当前构建浏览器可见证据 `NOT_EXECUTED`；第二浏览器/真机/真实网络仍 `RELEASE_EVIDENCE_PENDING` | Manifest-backed default-on；双 kill switch；Context→旧九状态→Mascot SVG，Quick→本地化文字。6 个 wire quick ID 不变；16 cell 不进协议；Direct/Match Chat 仍为纯文字。 |
| Tank：`G-12-TANK-ART-P1-CLEAN` | `SOURCE_ONLY_CANDIDATE` | `9eeab1…914e7`；方向板 | 未完成 sprite/map/base 清稿 | 可进入人工候选 | `NOT_EXECUTED / NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | 只作方向板；现有 CSS/Canvas fallback 保持。 |
| Tank：`G-13-TANK-ART-P1-REJECTED` | `SOURCE_ONLY_CANDIDATE` | `4e4dfa…fd2e` | 不适用 | `REJECTED` | 不适用 | `REJECT` | 不适用 | 永久隔离，不得重新使用或接入。 |
| Player Character：`G-14-PLAYER-CHARACTER-ART-036` | `SOURCE_ONLY_CANDIDATE` | `048606…b153` | 未完成 | 未完成 | `NOT_EXECUTED / NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | 不改角色 schema、商城、Profile、Seat 或 runtime。 |
| Monopoly：`G-15-MONOPOLY-ART-036` | `SOURCE_ONLY_CANDIDATE` | `09569c…5195`；实际 1254² | 未完成 | 未完成 | `NOT_EXECUTED / NOT_EXECUTED` | `NOT_EXECUTED` | `NOT_EXECUTED` | 不改 Rule/Authority；继续代码原生 fallback。 |
| M0 Teacher / Avatar / Core UI / Gomoku / Ludo | `SOURCE_ONLY_CANDIDATE` | `golden-set-source-manifest-v2.json` | Teacher/Avatar 未完成；UI/棋盘是 draft | Draft QA / Rule exact | 全部 `PENDING` | 未签字 | `NOT_EXECUTED` | 仅 G-02 的严格默认关闭技术预览例外；其他不得接入。 |
| Avatar v2 / Background v1 | `LEGACY_FALLBACK` | 现有 Catalog / Manifest | 历史素材 | 历史技术回归 | 未逐项补签 | 不作为新 Golden Set | 外部矩阵仍缺 | 已集成的历史 fallback，不能被称为正式统一风格新资产。 |
| 外部 RPG / Q 版 UI 素材 | `EXTERNAL_REFERENCE_ONLY` | external register：836 文件 SHA；3,819 份 PSD/AI/EPS 结构库存；仅保留 URL、hash、许可和来源元数据 | 不适用 | 目录与来源元数据审计已完成 | 授权/IP 未执行；无 Skill 输入 | 不适用 | 不适用 | `blocked-license`；不把源像素/图层直接放入 runtime/Manifest；外部素材只作审计记录。 |

## 素材完整性证据

- 原创候选仍为 14 族，加入 G Coins P1 后固定为 247 个文件：212 张 PNG 已逐图进入 14 张接触表，两张 SVG 按完整文件哈希登记且各有同族 PNG 可见稿，32 份 Markdown 与 1 份 HTML 已全文读取并记录；证据为 `requirements/active/art-approval-matrix-p1-20260814/evidence/original-14-family-complete-visual-inventory-20260814.json`。
- 外部素材 836 个容器/预览文件仍以逐文件 SHA-256 和 aggregate `a7151…298f` 固定输入；其中 288 PSD、361 AI、3,170 EPS 共 3,819 份分层/矢量源已只读解析，0 个失败。结构库存记录 35,107 个 PSD 图层记录、7,553 个组、1,078 个文本标记与 565 个智能对象标记；Illustrator 私有语义、字体字形和链接对象正文没有被冒充完整还原。
- 完整性和结构读取只回答“文件有没有漏、可解析结构有没有读”；它们不回答授权、原创相似性、人工清稿、视觉质量、Golden Set 或是否可进入 runtime。

## 审批记录格式

每次人工决议必须补入独立证据文件，至少包含：`stableId`、`artworkVersion`、source/preview SHA、日期、审阅人角色、七维相似度、利益冲突、结论、需要重做项、关联设备矩阵路径。不得只写“看起来不错”。

## 当前外部与可选咨询记录（不阻断原创美术清除）

- Art Bible 真人确认、独立自然人 Reviewer B、IP Similarity / 法律意见和逐资产 Golden Set 仍未执行；它们是可选风险咨询，不是原创资产清除或发布先决条件。
- 第二桌面浏览器、Android、iPhone、Tablet、昼夜主题、三语言、visible reduced-motion、性能/解码/失败回退仍未形成候选级真实证据。
- 默认关闭技术预览或 `OWNER_AUTHORIZED_ART_CLEARANCE` 候选是否长期保留，需后续由主负责人按本文件的明确合同决定；它不影响 `GATE-ART-GOLDEN-SET` 的 `EXPLICIT_OWNER_RELEASE_COMMAND_REQUIRED` 状态。
