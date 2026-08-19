# Ghost Game 全量美术生产计划 v1

状态：`IN_PROGRESS / LOCAL_ONLY / NOT_RELEASED`

本目录把用户附件中的全量美术需求冻结为 33 个严格有序的核销单元：P0 12 个、P1 9 个、P2 12 个。执行顺序以 `production-ledger-v1.json` 为准；附件中的每项需求均保留，不因合并为权威母版而消失。

当前进度：`9 / 33 = 27.27%`；P0：`9 / 12 = 75%`；P1/P2：`0%`。已核销单元均为 `IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`；当前构建的本地代码/资产/机器证据为 `100%`，当前构建浏览器可见证据、第二浏览器/真机/真实网络/发布证据为 `0%`。下一单元严格为 `P0-10 / P-PLAYER-CHARACTER-LAYERED-V1`。

## 2026-08-19 2.5D 重排

用户已把视觉技术主线改为 `Vanilla DOM + CSS + Canvas + GSAP` 的共享 2.5D 空间语言。现有 Ghost3D/Three 代码与证据冻结保留为兼容/实验层，不删除、不继续作为六款美术必经路径。美术默认交付改为前景/中景/背景母版、透明原子、接触阴影、遮罩和语义 VFX；GLB/复杂模型不再是当前单元的完成条件。完整映射见 `ART_2_5D_REALIGNMENT_20260819.md`。

这次重排不改变 33 个单元数量、P0→P1→P2 顺序、已完成百分比、Honru 已确认形象、资产 SHA/clearance 或发布状态。`P2-07` 保留原 Requirement/Family ID，但冻结为只有 Gomoku 2.5D Demo 出现可复核能力缺口时才重启的可选实验。P0-09 继续是下一严格单元。

## 执行规则

1. 同一时间只核销一个资产单元；先完成 P0，再完成 P1，最后完成 P2。
2. 同一角色、图标、背景、舞台或状态插画只维护一个权威母版，页面和尺寸变体从母版派生。
3. 复合 Source Board 只能证明方向与覆盖，不能冒充透明 Runtime Atom。
4. 背景、角色、材质、道具和棋子使用美术资产；文字、数值、棋盘网格、计时、进度填充和聊天正文继续由 DOM/CSS/Canvas 提供。
5. 原创资产满足稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚后，才记录 `OWNER_AUTHORIZED_ART_CLEARANCE`。
6. 外部 Q 版 UI/PSD/AI/RPG 继续保持 `EXTERNAL_REFERENCE_ONLY / blocked-license`，但可在用户授权和供应商已配置时通过受控全信息 Skill reference lane 作为分析/参考/生成输入；每次记录输入 SHA、供应商/模型/任务 ID。源像素/图层不得直接进入 Runtime，外部影响候选先保持 source-only 并完成相似风险审查。
7. Source Catalog、治理 Catalog 与 Runtime Manifest 分层维护；`OWNER_AUTHORIZED_ART_CLEARANCE` 不是 `asset-library/catalog.json` 的 status 值。
8. 任何本地清除或测试都不自行触发 commit、push、Pages、Render 或生产数据写入。
9. 新图像批次先执行 `requirements/ART_GENERATION_SKILL_PIPELINE.md`，在资产族 provenance 中逐项记录九个 Skill 入口的适用性与真实执行状态；Skill 输出不自动取得所有者清除。

## 统一回滚链

```text
新版本化 Runtime Asset
  -> 上一稳定 Runtime Asset
  -> DOM / CSS / SVG / Canvas / Unicode
  -> 冻结的程序化 Three/Ghost3D 可选兼容层（非当前必经路径）
```

加载失败、解码失败、哈希漂移、路径越界、flag 缺失或非法值、Renderer context loss、组件销毁和迟到异步结果都必须 fail closed 到该链路。
