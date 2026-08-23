# P0-12 本地验收 — Game Icon System v2

状态：IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING

- 资产族：`P-GAME-ICON-SYSTEM-V2`。
- 覆盖：六款游戏 `icon 44/64/96`、`cover-crop`、`theme-icon`、`selected-object`，以及 12 个状态 marker 的 `24/32/44` 派生，共 72 个 WebP runtime 变体、36 个确定性 SVG 源稿与 4 张机器检查板。
- 消费：Home 六款预览、Games 卡片封面与 AI badge、Profile 游戏卡、Game Stage 标题、Room Launchpad、Seat/Room/Lobby 状态；选中物件在 pointer hover 与 keyboard focus 稳定预览，并保持 pointer-through。同卡重复选择与高频 Game Stage 标题更新均复用既有图像节点。
- Marker 覆盖：12 类 marker 全部具有受控派生和 resolver；当前真实产品状态消费 `ai / online / ready / waiting / live / ranking` 六类，其余 `solo / multiplayer / card / room / locked / error` 保留为未强行塞入界面的可用原子。
- 回退：图标 `v2 → Emoji`，封面 `v2 crop → 旧 320/640 cover → Emoji`，marker 保留 Lucide/CSS/text 语义；Manifest、存储、解码、撤销旗标与节点移除均 fail-closed。
- 权威边界：只消费既有真实 UI 状态，不派生或修改游戏可用性、AI、房间、排行、规则、Authority、Protocol、Reward、Economy、Replay 或持久化。
- 并行安全：P0-10/P0-11/P0-12 资产族仍各自独占生成目录，并额外共用全局 Manifest/Catalog 注册表锁，防止四窗口并发读改写丢条目。
- 机器证据：32 项资产/注册表/消费合同与 39 项 DOM/VM 运行时合同通过；总 runtime `142914 bytes`，低于 `1 MiB` 预算；reduced-motion 与 forced-colors 保留静态语义反馈。
- 可见证据：当前构建真实浏览器矩阵、第二桌面浏览器、物理 Android/iPhone/Tablet、真实 50/100/200ms 网络与低端 GPU/FPS/热量/内存均保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。
