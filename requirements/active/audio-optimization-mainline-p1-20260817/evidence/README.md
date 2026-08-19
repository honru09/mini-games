# Evidence

本目录保存音效主线的机器回归、VM 输出、浏览器/设备截图、Manifest/provenance 样本和人工风险记录。当前已完成本地运行时、六款游戏、平台/设置/商城/社交/Playline/局内表达/房聊/每日任务/资料保存 cue 和候选治理；外部音频候选生成、真机、第二浏览器、真实网络、PWA 锁屏/后台恢复仍为 `NOT_EXECUTED`。

当前可复核入口：

- `npm run test:audio`
- `node qa/audio-cue-inventory.js --strict`
- `node qa/audio-authority-contract.js`
- `node qa/platform-audio-cues.js`
- `node qa/audio-platform-coverage.js`
- `node qa/audio-generation-governance.js`
- `node scripts/build.js --check`

当前构建证据记录在 `audio-local-regression-20260817.json`：音频/i18n/DOM/E2E、质量门禁与完整 `npm test` 串行聚合均通过；构建身份明确标为 `historical_as_of_capture`，因为共享工作区仍可能被其他主线改写。完整测试结果记录为 exit code 0，不把历史时序尝试误写为当前失败。

覆盖扩展的当前构建与专项结果记录在 `audio-platform-coverage-20260818.json`；它只证明正式源图、cue 同构、accepted/rejected 分支、隐私和去重合同，不提升为真实设备听感或发布证据。

最新当前构建捕获（SHA-256 `1CFC9A4E…51C31ACB`）记录在 `audio-platform-coverage-20260818-current.json`；旧的 `82D85384…248FE90` 文件保留为历史捕获，不再作为当前构建身份。

该证据也保留了共享质量门禁的边界：捕获时音效/构建/质量门禁为通过，之后复跑时发现非音效 renderer entry 被工作树其他批次改写，造成 loader/Service Worker digest、Ludo perspective 合同和 TECH-027 生成报告身份检查失败。音效批次没有改动 renderer、SW、Three entry 或进度报告；这些失败应由对应 renderer/治理批次修复，不得被音效收口报告隐藏。

证据文件名应包含日期和阶段，例如 `audio-feedback-contract-YYYYMMDD.json`。自动化结果只能证明代码合同，不得提升为跨设备可见验收或发布证据。外部素材必须保留来源、license、prompt provenance、SHA-256、feature flag 和 rollback；受限/blocked-license 素材不得进入 runtime。候选 registry 已锁定五个用户指定上游的 commit 与适用的本地 skill hash，但四个生成候选仍没有 output/hash/job/path，game-creator 只是 `REFERENCE_ONLY`；不能把“计划调用”描述为已生成。
