# Ghost Game 总指挥执行入口

状态：`ACTIVE_COMMAND_PLANE`  
生效日期：2026-08-12

## 来源与裁决

本文件把两份用户指定总指挥报告压缩成可执行入口；原子需求事实仍只来自 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json`。报告中的 240 项是写作时快照，当前机器事实为 242 项，不回退、不删除。

- `D:/下载/Ghost Game 主线总指挥报告.md`  
  SHA-256 `FB47398FDBEA18CBF43CA8057A397863D98E39159B0704B96695ED598CB2BDBD`
- `D:/下载/Ghost Game 3D 游戏技术与实施总指南.md`  
  SHA-256 `23771CEAF5E14AB3B5454D88E7C294451F84AB649C30A94CE4FD1057508BD406`
- 用户 2026-08-19《Ghost Game 2.5D 游戏重推指南》（附件 SHA-256
  `E6FD38CE8338CBFCCFD76AEE54932C088DE398386CBAB090B9813229D89397E7`）
  覆盖此前“六款默认 Ghost3D”表现方向：保留 Ghost3D 为冻结的可选实验层，当前表现主线改为
  Vanilla DOM/CSS/Canvas + GSAP 的统一 2.5D 空间语言。

冲突裁决顺序：用户当前明确命令 > 本文件的阶段顺序 > 原子需求台账事实 > 分类进度报告。长报告负责设计意图与论证，本文件负责每次执行时的短路径。

## 唯一主线

1. `CONTROL`：冻结范围、修 release/status drift、把外部依赖合并为共享 Gate。
2. `CLOSE`：现有 UI + 2.5D DepthScene/Camera/Transition + Gomoku 完整可见 Demo 收口；Ghost3D Foundation 只保留兼容与可选实验，不再扩张。
3. `PROVE`：第二浏览器、Android、iPhone、Tablet、双方向、三语言、双主题、reduced-motion、真实网络。
4. `DATA`：真实 Supabase 凭证、加密备份、迁移、RLS、隔离恢复、回滚、并发、多实例、Cluster。
5. `ART`：已有 Honru/Emoji/G Coins/Player Character/游戏素材按 `OWNER_AUTHORIZED_ART_CLEARANCE` 完成精修、机器视觉/技术/相似风险审查、runtime 派生与设备验收；人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 仅为可选咨询。
6. `PARITY`：六款共享 2.5D 空间语言、规则、Authority、输入、性能与 fallback 达到统一下限；Three.js 仍为可选实验适配器。
7. `LOOP`：Quick Play、教学、AFK/计时/投降、Durable Recovery、角色经济和经济观测。
8. `COMMUNITY`：Playline 生产治理；其后才是 Global Chat、Guild 与更广 UGC。
9. `PLATFORM`：Native、Store、新游戏和未来 Renderer 扩展。

当前产品阶段是 `FEATURE-MATURE / PRODUCTION-EVIDENCE-PENDING`；默认动作是 `CLOSE → PROVE → POLISH → RELEASE`，不是继续堆功能。

## 需求治理

- Defect：归回原需求修复项。
- Acceptance Gap：增加原需求的 acceptance / next / evidence。
- Shared Repair：用覆盖组统一治理跨页面共同问题。
- 只有新增玩家能力、协议、持久数据、经济事实、社交关系/UGC、平台或明显范围变化时，才创建新 Requirement ID。
- 一批只允许一个主要产品目标；发现外部门禁时可做下一阶段准备，不切入无关新方向。
- 用户可见能力必须有可见证据；静态合同、DOM/VM 和无截图自动化不能把视觉状态提升为 `verified`。

## 2.5D Presentation 与冻结 Ghost3D Foundation

当前生产表现固定分层：

```text
Rule / Authority / Protocol
          ↓
Semantic Presentation Model + Input Command + Motion Event
          ↓
DepthScene / CameraSystem / Semantic Motion
          ↓
DOM + CSS + Canvas + lazy GSAP Adapter
          ↓
静态 DOM/Canvas fallback
```

- `DepthScene` 统一 background/world/foreground 三层；`CameraSystem` 只表达 overview/hover/enter/active/focus/impact/result/exit 语义，不拥有规则或输入。
- 单步动效用 GSAP Core，多步转场用 Timeline，所有动效遵循 transform/autoAlpha、可清理、reduced-motion 与性能门禁；局内权威状态不得依赖 ScrollTrigger。
- 页面和 Game Stage 保持 `DOM Shell + Canvas/DOM Arena + DOM HUD/Controls/Social`；Three.js/GLB 仅存在于冻结的可选实验层，不进入当前 2.5D 主线。
- 首个 2.5D Demo 固定为 Home → Games → Gomoku → Result → Games，必须使用真实语义事件并提供静态回退；再按 Gomoku → Ludo → Monopoly → Xiangqi → Tetris → Tank 推广。

## Motion 与 GSAP 门禁

- 设计或修改网页、Game Stage、3D Camera、UI+3D 同步动效前，先读取对应 GSAP 官方 skill；所有批次都用 `gsap-performance` 复核。
- 单步用 Core，多步编排用 Timeline；滚动页面才允许 ScrollTrigger，局内输入和权威状态禁止依赖 ScrollTrigger。
- 动效来源必须是语义事件；规则层不出现 `gsap.to()`，Renderer/Motion Adapter 决定视觉实现。
- 动效优先 transform/autoAlpha，实例可 kill/revert；离屏/切后台/离开页面暂停或释放；reduced-motion 保留即时、可理解的静态反馈。
- “更多动效”解释为覆盖更多有意义的状态与转场，不以并发数量、持续时间或粒子数量为目标；性能、清晰度和输入优先。

## 每批完成定义

1. 现有 Requirement 或真正新能力已归类。
2. IN/OUT、Authority、所有权、回滚和外部门禁已冻结。
3. 实现没有越过 Renderer、协议、数据、经济或美术审批边界。
4. 专项、共享、失败/取消/断线/重开/切账号、a11y、i18n、reduced-motion、性能与清理均有证据。
5. 玩家可见变化已做真实浏览器/设备验收；工具不可用时保持 `NOT_EXECUTED`。
6. 台账、状态、报告和三日志只记录真实达到的状态。
7. 只有用户当前任务明确要求发布时，才 commit/push/deploy。

## 共享 Gate

- `GATE-DEVICE-BROWSER-NETWORK`
- `GATE-SUPABASE-PRODUCTION`
- `GATE-ART-GOLDEN-SET`

Master 优先解除高扇出 Gate；同一个 Gate 不在几十条需求中重复制造新需求。`GATE-DEVICE-BROWSER-NETWORK` 与 `GATE-SUPABASE-PRODUCTION` 的开发状态为 `NON_BLOCKING_FOR_DEVELOPMENT`、发布状态为 `RELEASE_EVIDENCE_PENDING`，直到真实设备/网络或生产 Supabase 证据可复核。`GATE-ART-GOLDEN-SET` 仅对原创 Ghost-native 资产适用 `OPEN_BY_OWNER_AUTHORIZATION`：满足 M0 North Star、稳定 ID/SHA/provenance、机器技术/视觉/相似风险审查、fallback 与回滚的 `OWNER_AUTHORIZED_ART_CLEARANCE` 后，可以进入可逆 default-on runtime 与发布候选；发布仍只由用户当前明确命令触发。不得把可选人工/IP 咨询伪造成 PASS。外部 `blocked-license / EXTERNAL_REFERENCE_ONLY` 素材继续保持原许可状态与 runtime 禁止边界，但用户已授权的受控全信息 reference lane 可将任务相关文件、预览、PSD/AI/EPS 结构与语义库存提供给已安装本地 Skill 或已配置第三方 Skill；每个输入必须记录路径、SHA-256、provider、model、taskId 与 transmissionScope，外部影响候选在相似性与 provenance 复核前只能保持 `SOURCE_ONLY_EXTERNAL_INFLUENCED`。

## 审批方式

审批与等待边界以 `requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md` 为准。可确定性验证的技术 Reviewer、哈希/Alpha/污染/尺寸、对比度、a11y、i18n、性能、fallback、Manifest、缓存、自动回归和本地浏览器证据默认继续执行，不需要用户逐项确认。第二浏览器、真机、真实网络和生产 Supabase 属于外部环境发布证据。对原创 Ghost-native 资产，人工清稿、独立自然人 Reviewer B、IP/法律意见和逐资产 Golden Set 是 `OPTIONAL_ADVISORY_EVIDENCE`：可以记录风险和返工建议，但不作为开发、runtime 或未来发布先决条件，也绝不能伪造成 PASS。用户已确认的 M0 North Star 加稳定 ID、版本、SHA、provenance、机器技术/视觉/相似风险审查、fallback、回滚和 feature flag 合同可形成 `OWNER_AUTHORIZED_ART_CLEARANCE`；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材只保留 URL、hash、许可与任务元数据，不得作为任何 Skill 的分析、参考、编辑或生成输入。任何结论都不自行触发发布，仍需用户当前明确命令。
