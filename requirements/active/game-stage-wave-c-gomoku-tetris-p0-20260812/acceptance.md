# Wave C 五子棋 / Tetris 验收

- [x] 五子棋过程链、生命周期、终局单调性与过程状态隔离通过专项 QA。
- [x] Tetris 过程链、多实例单写者、Authority/观众、终局单调性与过程状态隔离通过专项 QA。
- [x] 两款规则坐标、快照、AI、联机、Replay、奖励和协议保持不变。
- [x] reset/restore/reconnect/destroy 清理 timer/tween，迟到回调无效。
- [x] reduced-motion 直达稳定态且不丢状态含义。
- [x] 专项测试纳入 `test:game-stage-density-final` 与完整 `npm test`。
- [x] i18n、DOM、Game Stage、规则/Authority、Timer、Quality Gates 与完整回归通过。
- [x] 双构建字节数与 SHA-256 稳定：逻辑 1,251,511 bytes / 磁盘 1,266,060 bytes / `6B823D0E2F2399EB622799E4E1DEC6EEBC43F7DA02E78075C80F0A51E910AF1D`。
- [x] 台账、PROJECT_STATUS、AGENTS、WHITEPAPER、七份报告和三份中文日志同步。
- [ ] 最新本地桌面/平板/390×844/844×390、双主题、visible reduced-motion、第二浏览器、真机与真实网络如实记录；连接器不可用时保持 `NOT_EXECUTED`。
- [x] 不提交、不推送、不部署。
