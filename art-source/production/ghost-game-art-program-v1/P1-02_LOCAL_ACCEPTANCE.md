# P1-02 Tank Final Art v1 本地收口

结论：`IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_VISIBLE_RECORDED / CURRENT_BUILD_VISIBLE_PENDING / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`

- 25 个项目自有确定性 SVG 母版、50 个 WebP variant；当前 runtime 376,668 bytes，占 6 MiB 预算 5.99%。
- 三层竞技场、12 个对象原子、8 个语义 VFX、2 个 camera preset 已登记稳定 ID/version/SHA/bytes/Alpha/provenance。
- 五张 ImageGen source board 全部保留 source-only；四张原子/VFX 图没有真实 Alpha，已明确拒绝 runtime extraction。
- 外部受限输入按用户授权的全信息 reference lane 传输；两项输入与五次调用的路径/SHA/provider/model/taskId/time/scope 已记录，许可仍为 `EXTERNAL_REFERENCE_ONLY / blocked-license`。
- `mg_art_tank_final_v1` 默认开启但可逆；Manifest、清除记录、路径或任一所需 WebP resolve/decode 失败时整族 fail closed。
- Tank 仅在表现层消费棋盘、墙体、坦克、炮弹、护盾和 VFX；Authority、Protocol、Snapshot、Prediction、Replay、Reward、Economy、HP、控制与身份未改变。
- desktop light/dark、390×844、reduced-motion、forced-colors、live fire、零横溢出、console warn/error=0 已绑定当前聚合构建 `FDD06C32…FC44`，并在单一 Codex in-app Chromium 重拍完成；证据仍仅属于本地单 Chromium 仿真。
- 797×642 中间横屏曾实测 Tank Final Art `active`、三层 decode、棋盘 440.19×381.5px、D-pad 44.32px、Fire 66.47px、HUD/控制全在 Rail 内且零横溢出；该窄证据绑定 `C5AFEA97…B413929E` 历史构建。
- 终审发现并修复 720/721 与 900/901 断点断崖：高度 ≥601px 的横屏从宽度 600px 起连续使用 300–380px 右侧 Command Rail，竖屏平板不受影响；最终聚合构建 1280×720 与 390×844 均零横溢出。
- 手机黑夜模式曾因平台 dark filter 使局内图标反白不可见；已用 Game Stage Ink/Cream 作用域覆盖修复并复核。
- 专项 Tank 控制/Authority、Game Stage 密度、Gameplay、DOM、2.5D、素材审计、Quality Gates 与确定性 build check 均通过。

构建身份：只以当次 `node scripts/build.js --check` 与自动 TECH-027 报告为准；上述可见证据均保留各自精确 hash，不冒充永久当前。

未执行：最新聚合构建的同场景重拍、第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端 FPS/GPU/热量/内存、人工清稿、Reviewer B、IP/法律意见、真实 Supabase 与生产发布。以上不阻塞本地开发，但不得冒充通过。
