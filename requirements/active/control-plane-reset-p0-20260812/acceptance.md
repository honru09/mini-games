# Control Plane Reset P0 验收

- [x] 两份用户总指挥报告已由 `requirements/GHOST_GAME_MAINLINE_COMMAND.md` 统一指向。
- [x] 242 项需求各有且只有一个主线路由。
- [x] 路由统计固定为：NOW_CLOSURE 146、EXTERNAL_GATE 32、DEFERRED_MAINLINE 48、FUTURE_EXPANSION 16。
- [x] 外部依赖只收敛为三条共享 Gate：设备/浏览器/网络 7 项、Supabase 生产 10 项、人工美术 Golden Set 15 项。
- [x] TECH-027 当前 `Transport closed` 状态保留为 `partial`，未复用历史线上抽查证据冒充最新可见验证。
- [x] 七份分类报告和总报告已按 2026-08-12 快照生成，并逐条输出主线路由。
- [x] `qa/mainline-control-plane.js` 通过，覆盖路由唯一性、Gate 扇出、阶段顺序、状态语义和未来扩展优先级边界。
- [x] 无运行时、协议、数据库、奖励、AI、社交数据、美术 runtime 或线上发布变更。
- [x] 当前批次不提交、不推送、不部署；下一主线为 CLOSE/Ghost3D Foundation。
- [ ] 浏览器、真机、真实网络、真实 Supabase 和人工 Golden Set Gate：保持 `NOT_EXECUTED/BLOCKED`，由后续主线按 Gate 证据解除。

