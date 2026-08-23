# P1-01 Monopoly Final Art v1 验收

- [x] 生产范围、Authority、2.5D 层级、fallback、预算与发布边界已冻结。
- [x] 九个图像 Skill 入口已逐项路由，缺外部凭证不扩大为开发阻塞。
- [x] 最高质量 source board 与透明原子完成并登记稳定 ID、SHA、尺寸、Alpha、字节和 provenance。
- [x] 机器技术/视觉/小尺寸/相似风险审查完成并取得 `OWNER_AUTHORIZED_ART_CLEARANCE`。
- [x] Manifest/Catalog、严格 feature flag、decode/撤销/节点移除失败回退与一键回滚完成。
- [x] 既有 Monopoly Presentation Adapter 只消费表现资产，不改变规则、协议、奖励、经济或数据。
- [x] 专项、i18n、DOM、2.5D、reduced-motion、forced-colors、Quality Gates 与完整 `npm test` 通过。
- [x] 当前构建单一 Codex Chromium 五视口局内可见矩阵：1280×720、1024×768、768×1024、390×844、844×390；三层 decode、26 个棋盘语义图节点、无横溢出、可见按钮 ≥44px，证据见 `evidence/current-build-monopoly-visible-matrix-20260821.json`。
- [x] 最新构建 `176D108F…037D9FC` 的局内重绘回归已在单一 Codex Chromium 聚焦复核：棋盘重绘后 `landing`/`purchase` VFX host 保持连接、三层 decode、26 个语义节点、零横溢出、可见按钮 ≥44px、console warn/error=0；未执行的其余 VFX、reduced-motion 与 forced-colors 仍诚实标为 `NOT_EXECUTED`，证据见 `evidence/current-build-monopoly-vfx-redraw-2026082112.json`。
- [ ] 第二浏览器、真机、真实网络和低端性能（外部门禁）。
- [ ] commit/push/Pages/Render/生产发布（无当前明确发布授权）。
