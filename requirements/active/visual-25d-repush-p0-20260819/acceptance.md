# 2.5D P0 本地验收

当前结论：`IMPLEMENTED_LOCAL / CURRENT_BUILD_FOCUSED_GOMOKU_UNDO_PASS / HISTORICAL_SINGLE_CHROMIUM_STAGE_MATRIX / LOCAL_ONLY / NOT_RELEASED`。

- [x] 用户新指南已覆盖旧“六款 Ghost3D 默认主线”。
- [x] 2.5D DepthScene、八模式 CameraSystem、Honru、Page Transition、GameStage 语义层存在并通过合同。
- [x] Three.js/Ghost3D runtime 已安全退役清除；静态 DOM/Canvas fallback 与 2.5D 唯一主线保留。
- [x] `npm run test:visual-25d` 与 `qa/visual-25d-only-runtime.js` 通过，禁止 renderer/loader/SW cache/feature flag 回流。
- [x] 历史 `0DE4CD5C…0EE64E` 构建的桌面 Home/Games/Gomoku、390×844 和真实落子 `impact → active` 部分可见证据已如实记录。
- [x] 历史完整机器回归基线：`4BCB2727…96A98` 曾通过 `QUALITY_GATES_FAST_ALL_PASS`、完整 `npm test` 与确定性双构建，并绑定当时的单 Chromium Stage 矩阵；该矩阵不迁移到后续构建。
- [x] Ludo、Monopoly、Xiangqi、Tetris、Tank 已接入共享 `GameStage25D` 语义事件桥接；只消费已有 Wave C 表现状态，保留 DOM/Canvas fallback、reduced-motion 与生命周期清理，不进入规则/Authority/Protocol。退出/路由、快速重进、impact 恢复和后台迟到计时器竞态已收口并进入专项行为回归。
- [x] 六款既有 accepted-action/phase/result 语义已映射为 `ring / sweep / burst / lift / slash / focus / spin / result` 八类差异化 FX；色调、强度、方向、节点预算、手机减量、reduced-motion、forced-colors 与后台/退出清理合同均已实现。
- [x] `depth-motion-25d-v3` 已将常规落子、锁定与开火收敛为非位移 scale pulse；Enter/Focus/Result 仍使用克制 timeline，仅动画 transform/autoAlpha，临时 `will-change` 与 GSAP 属性会在完成/中断后清理，不引入 ScrollTrigger。
- [x] Immersive Game Stage v2 已把页面改为固定全视口 Arena、紧凑 Header/Seat Rail、自适应 HUD Dock；低高度横屏使用单一右侧 HUD 轨道，桌面/平板/手机为底部 Dock。Ludo/Monopoly 过程/排名 Meta 从 Arena 旧侧窗迁入 HUD DOM，六款按独立控制高度预算。
- [x] 当前 `4BCB2727…96A98` 构建在单一 Codex in-app Chromium 完成 6 视口 × 6 游戏共 36 个 Game Stage 场景检查：360×800、390×844、844×390、768×1024、1024×768、1440×900；页面横/纵溢出为 0，所有已渲染操作高度至少 44px，棋盘、Tetris 对手井、Tank 摇杆/D-pad/开火均完整。六张当前构建截图与 SHA 已记录在 `evidence/immersive-stage-20260820/current-build-visible-matrix.json`。
- [x] 当前 `176D108F…37D9FC` 构建完成五子棋/象棋悔棋专项：建房可配置、每局全房间一次、只允许最后落子者撤回、AI 局回退完整一轮、象棋 Authority revision/seq 单调且新局重置；双客户端 WebSocket 专项通过。
- [x] 当前构建 390×844 单 Chromium 聚焦可见复核：方向盘为 0、棋盘/棋框比例均为 1、页面零溢出、棋子保持圆形且无持久方框；悔棋使用后为 `used + disabled`；建房从飞行棋切回象棋时复选框与 payload 状态一致。径向反馈的 1 核心 + 8 射线 + 4 粒子与有界清理由当前自动化合同覆盖。证据见 `evidence/gomoku-xiangqi-undo-20260821/current-build-focused-verification.json`。
- [x] 当前 `176D108F…37D9FC` 构建已通过完整 `npm run quality:gates`（`QUALITY_GATES_FAST_ALL_PASS`）与完整 `npm test`（exit 0）；最终 `node scripts/build.js --check` 仍为 1,967,839 characters / 1,982,521 UTF-8 bytes / 同一 SHA。
- [x] 2026-08-22 接管审计在当前 `7BCA9218…F41DF2` 构建修复 Tetris/Xiangqi Final Art 死接入与象棋 Manifest 角色漂移；两款均在 1280×720、390×844、uk-UA dark 与 visible reduced-motion 下实际 `active`，零横溢出、console warn/error=0。证据见 `evidence/current-build-tetris-xiangqi-final-art-20260822.json`。
- [ ] 当前最新构建的完整 Home→Games→六款 Game Stage→Result→Games 终局链路、三语言、双主题与 visible reduced-motion 全矩阵；本批只完成当前构建 Game Stage 布局/操作矩阵。
- [ ] 第二浏览器、Android/iPhone/Tablet、真实网络、低端 FPS。
- [ ] 六款终局 Result/退出 Transition 与逐语义 FX 的当前构建逐项截图；本批六张截图覆盖布局与操作代表场景，不冒充所有 FX 状态。

本批不改变三条共享 Gate，也不触发部署或发布。
