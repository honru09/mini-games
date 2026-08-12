# Ghost Game 总指挥执行入口

状态：`ACTIVE_COMMAND_PLANE`  
生效日期：2026-08-12

## 来源与裁决

本文件把两份用户指定总指挥报告压缩成可执行入口；原子需求事实仍只来自 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json`。报告中的 240 项是写作时快照，当前机器事实为 242 项，不回退、不删除。

- `D:/下载/Ghost Game 主线总指挥报告.md`  
  SHA-256 `FB47398FDBEA18CBF43CA8057A397863D98E39159B0704B96695ED598CB2BDBD`
- `D:/下载/Ghost Game 3D 游戏技术与实施总指南.md`  
  SHA-256 `23771CEAF5E14AB3B5454D88E7C294451F84AB649C30A94CE4FD1057508BD406`

冲突裁决顺序：用户当前明确命令 > 本文件的阶段顺序 > 原子需求台账事实 > 分类进度报告。长报告负责设计意图与论证，本文件负责每次执行时的短路径。

## 唯一主线

1. `CONTROL`：冻结范围、修 release/status drift、把外部依赖合并为共享 Gate。
2. `CLOSE`：现有 UI + Ghost3D Foundation + 四款既有 Game Stage 可见收口。
3. `PROVE`：第二浏览器、Android、iPhone、Tablet、双方向、三语言、双主题、reduced-motion、真实网络。
4. `DATA`：真实 Supabase 凭证、加密备份、迁移、RLS、隔离恢复、回滚、并发、多实例、Cluster。
5. `ART`：已有 Honru/Emoji/G Coins/Player Character/游戏素材的人工作业、Reviewer B、IP Review、Golden Set、runtime 派生与真机验收。
6. `PARITY`：六款 3D/视觉、规则、Authority、输入、性能与 fallback 达到统一下限。
7. `LOOP`：Quick Play、教学、AFK/计时/投降、Durable Recovery、角色经济和经济观测。
8. `COMMUNITY`：Playline 生产治理；其后才是 Global Chat、Guild 与更广 UGC。
9. `PLATFORM`：Native、Store、新游戏和未来 Renderer 扩展。

当前产品阶段是 `FEATURE-MATURE / PRODUCTION-BLOCKED`；默认动作是 `CLOSE → PROVE → POLISH → RELEASE`，不是继续堆功能。

## 需求治理

- Defect：归回原需求修复项。
- Acceptance Gap：增加原需求的 acceptance / next / evidence。
- Shared Repair：用覆盖组统一治理跨页面共同问题。
- 只有新增玩家能力、协议、持久数据、经济事实、社交关系/UGC、平台或明显范围变化时，才创建新 Requirement ID。
- 一批只允许一个主要产品目标；发现外部门禁时可做下一阶段准备，不切入无关新方向。
- 用户可见能力必须有可见证据；静态合同、DOM/VM 和无截图自动化不能把视觉状态提升为 `verified`。

## Ghost3D Foundation

固定分层：

```text
Rule / Authority / Protocol
          ↓
Semantic Presentation Model + Input Command + Motion Event
          ↓
Renderer Contract
          ↓
Replaceable Renderer Adapter
          ↓
Three.js today / future renderer later
```

- 当前 Web Renderer 选 Three.js；Three.js 类型只存在于 Renderer implementation，不进入 shared rule、server、protocol、Replay、Reward、AI、Economy、Social 或持久状态。
- 正式资产路径为 Blender → 审批 → GLB/glTF →稳定 Asset ID → lazy-loaded runtime；资产不绑定 Renderer。
- Game Stage 保持 `DOM Shell + 3D Arena Canvas + DOM HUD/Controls/Social`。
- Wave B / Canvas / DOM / 程序化资源永久作为 fallback：`HIGH → BALANCED → LOW → FALLBACK`。
- 首个 3D Vertical Slice 固定为 Gomoku；先验证共享 Host、生命周期、Camera、Lighting、Input、Asset、Quality、Dispose 与 fallback，再复制到其他游戏。
- 六款顺序默认 Gomoku → Ludo → Monopoly → Xiangqi → Tetris → Tank；Tank 可独立 prototype，但不反向污染共享抽象。

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

Master 优先解除高扇出 Gate；同一个 Gate 不在几十条需求中重复制造新需求。

