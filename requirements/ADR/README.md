# Ghost Game 架构决策记录（ADR）

这里记录会影响协议、数据、渲染、支付、跨端、性能或发布边界的长期架构决策。ADR 是决策追溯，不是需求台账；原子需求仍以 `requirements/PRODUCT_REQUIREMENTS_LEDGER.json` 为事实源。

## 何时必须建 ADR

- 改变 Rule / Authority / Protocol / Replay / Reward / Economy / Supabase 数据模型或跨实例一致性。
- 选择或替换 Renderer、GSAP/Three 运行时边界、PWA 缓存策略、远端素材存储、支付或发行平台。
- 改变安全、隐私、备份恢复、回滚或兼容性承诺。

## 固定规则

- 文件命名：`NNNN-简短主题.md`，编号只增不复用。
- 每份 ADR 必须说明状态（`proposed / accepted / superseded / rejected`）、范围、证据、替代方案、风险、回滚和受影响 Requirement ID。
- `proposed` 不代表已实现；`accepted` 也不代表已发布或生产就绪。
- 真实 Supabase、设备、网络和发布证据必须保留各自状态，不能由 ADR 文本替代；原创美术按所有者授权的 `OWNER_AUTHORIZED_ART_CLEARANCE` 执行，人工/Reviewer B/IP/逐资产 Golden Set 只作可选咨询且不得伪造为已完成。
- 尚未执行的外部证据必须写 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`；开发是否可继续以 `requirements/AUTOMATED_AND_HUMAN_GATE_POLICY.md` 为准，不能用“以后再看”模糊带过。
- 只有某项外部操作本身确实无法执行时才记录 `BLOCKED`，且该状态不得级联为无关本地开发的停工理由。
- 新 ADR 不得把密钥、密码、session token、用户正文或生产数据写入仓库。

## 模板

复制 [`000-template.md`](./000-template.md)，完成审阅后再分配下一个编号。已生效的决策要在 `AGENTS.md`、`WHITEPAPER.md` 或对应 active task 中引用，而不是重复复制整篇内容。

## 已登记决策

- [`ADR-001：PWA 精确安装与刷新三语言词典`](./001-pwa-offline-locale-cache.md) — `accepted`
- [`ADR-002：游戏作用域模块加载、哈希预热与确定性构建`](./002-game-module-loader-cache-build.md) — `accepted / LOCAL_ONLY / NOT_RELEASED`
- [`ADR-003：Operational Metrics 首个 Server Seam 与隔离测试分组`](./003-server-boundary-adapters-metrics.md) — `accepted / PARTIAL / LOCAL_ONLY / NOT_RELEASED`
