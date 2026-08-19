# 2.5D P0 本地验收

当前结论：`IMPLEMENTED_LOCAL / VISUAL_EVIDENCE_PENDING / LOCAL_ONLY / NOT_RELEASED`。

- [x] 用户新指南已覆盖旧“六款 Ghost3D 默认主线”。
- [x] 2.5D DepthScene、八模式 CameraSystem、Honru、Page Transition、GameStage 语义层存在并通过合同。
- [x] Three.js/Ghost3D 保留为冻结可选实验；精确回滚和既有 DOM/Canvas fallback 保留。
- [x] `npm run test:visual-25d` 通过；`qa/ghost3d-default-on-contract.js` 已改为冻结可选合同并通过。
- [ ] 当前稳定构建的真实浏览器可见 Home→Games→Gomoku→Result→Games 证据。
- [ ] 第二浏览器、Android/iPhone/Tablet、真实网络、低端 FPS。
- [ ] Ludo→Monopoly→Xiangqi→Tetris→Tank 的后续推广。

本批不改变三条共享 Gate，也不触发部署或发布。
