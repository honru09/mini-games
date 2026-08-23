# P0-12 Game Icon System v2 验收

- [x] 36 个源稿、72 个 runtime 变体和 4 张检查板的 SHA/尺寸/Alpha/字节登记一致。
- [x] Manifest、Catalog、稳定 ID、Owner Clearance、feature flag 与一键回退完整。
- [x] Home、Games、Profile、Game Stage、Room/Seat/Lobby 只消费表现状态。
- [x] selected-object 不拦截输入，动画仅使用 transform/opacity，并支持 reduced-motion。
- [x] selected-object 在鼠标悬停和键盘焦点稳定可见；同卡重复选择不销毁或重复解码。
- [x] Game Stage 标题按 gameId 复用图标节点；房间可开局状态使用 ready marker。
- [x] forced-colors 隐藏装饰像素并恢复 Emoji/Lucide/CSS/text 语义。
- [x] marker 加载、失败和关闭旗标时不显示占位圆点，也不留下挤压 Lucide 的空槽。
- [x] v2、旧封面和 Emoji 三段封面回退经过可执行合同。
- [x] P0-10/P0-11/P0-12 生成器使用跨资产族共享注册表锁，避免并行读改写丢失 Manifest/Catalog 条目。
- [x] 不修改 Rule、Authority、Protocol、Reward、Economy、Replay、AI 或持久化。
- [ ] 当前构建完整浏览器可视矩阵、第二浏览器、真机、真实网络和低端性能证据（外部门禁）。
- [ ] commit/push/Pages/Render/生产发布（无当前明确发布授权）。
