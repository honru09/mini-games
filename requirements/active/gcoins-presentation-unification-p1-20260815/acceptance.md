# G Coins 当前构建表现统一 P1 验收

状态：`LOCAL_IMPLEMENTED / SINGLE_BROWSER_PARTIAL / NOT_RELEASED`

> Historical-as-of 2026-08-15：下列 P-003/Candidate B 行记录本批验收时点；2026-08-16 后的 owner-cleared runtime 证据见 G Coins Source Redesign P1 clearance、Manifest 与 `qa/g-coins-runtime.js`。

- [x] 运行时 `💵` 仅剩资源 fallback 与历史错误映射两处合法兼容边界。
- [x] `P-003` 保持 runtime；P1 Candidate B 保持 reference-only / DO_NOT_ENABLE。
- [x] 一个复合金额节点覆盖全部带图标用户可见金额消费者。
- [x] 普通值、signed、无效值与 Test Admin 私有 `∞ G Coins` 有确定性 VM 回归。
- [x] 金额复合节点只朗读一次完整值，内部图标为 decorative。
- [x] Home/Profile/Shop/排行榜/玩家列表/Reward 的格式和三语外围标签一致。
- [x] 旧 `coins/currency` 字段、价格、奖励、协议、Supabase 和公开投影不变。
- [x] 专项、UI、i18n、PWA v13 更新链、Quality Gates 与确定性双构建纳入最终批测。
- [x] 当前构建单浏览器可见抽查通过，第二浏览器/真机/真实网络诚实记录 `NOT_EXECUTED`。
- [x] 台账、路由、报告、三日志与中文简报完成；本批未发布。
