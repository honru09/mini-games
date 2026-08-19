# Tank Ghost3D vertical slice P5 — requirement

状态：`IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL_EVIDENCE / DEFAULT_OFF / LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`

时间：2026-08-15（Asia/Tokyo）

## Goal

在不改变 Tank Authority、输入、规则、协议、结算或未审批美术的前提下，为坦克大战补齐最后一款 Ghost3D 本地纵切：程序化 Three Arena、2–5 人实时位置/弹道的有界插值、少量可验证语义反馈、永久 DOM 输入/HUD 与失败回退。

对应既有需求：`GAME-051 + TECH-049`；维护 `GAME-044` 的 44px 触控合同。本批不建立新 Requirement ID。

## Current State / RECON

- `public/src/games/tank.js` 当前为约 1,283 行高风险单体，已有 13×15/17 Arena、2–5 人、本地 20Hz 固定步进、`tank-authority-v1`、旧 `tank-host-relay-v1`、八方向摇杆、D-pad、键盘、独立开火、增量 DOM 节点池与 `spawn → terminal` Wave C；P5 新增 Presenter/Renderer seam 后仍保持 Authority 与 DOM 所有权。
- 服务端 Authority 以 50ms 固定步进模拟，但只在偶数 `serverTick` 广播；正常 live receipt 的连续 delta 是 2。客户端现有 `onAuthoritySnapshot()` 会把权威坐标与本地预测坐标混合平滑，因此 Three 不能从写回后的 `tanks` 数组读取 online 权威事实。
- `qa/tank-controls.js`、`qa/tank-authority.js` 和 `qa/game-stage-density-process-tank-xiangqi.js` 已覆盖输入释放、服务端位置/射击/命中/击毁/重生/终局、Wave C、重连快照和四档布局。
- `ART-035` 的 Tank P1 源稿当前仍为 `source-only / reference-only`，因为尚未记录逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE`；后续机器技术/视觉/相似风险审查、Manifest/fallback/feature flag/回滚与 runtime 集成可以继续。人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 均为可选咨询。
- 当前窄屏 CSS 把 D-pad 降到 40px，违反既有 44px 触控合同；本批作为 `GAME-044` Defect 修复，不新增需求。

## Design It Twice 裁决

三个 `gpt-5.6-terra`、`reasoning_effort=max` 子 agent 分别提交最小 Interface、最大扩展性和热路径最简三套只读设计。最终采用最小与实时流方案的混合：

```text
TankGhost3DPresenter.create(readModel)
  -> { commit(), snapshot(), dispose() }
```

online 由 `tank.js` 在现有校验通过后、DOM 平滑前保存裁剪后的 authority receipt；Presenter 只读取 receipt。旧 relay、乐观预测和 Replay 不进入 3D。高频快照只更新 Three 私有插值目标，绝不创建 GSAP timeline。

## IN

- 精确 opt-in：Wave B 未关闭且 `mg_ghost3d_tank_v1 === '1'`。
- 独立 Tank Presenter 深模块、同源 lazy Three r185 + GSAP Core Renderer、HIGH/BALANCED/LOW/reduced-motion、context loss、resize、hidden/shell lifecycle、sticky failure 与幂等 dispose。
- 单机/AI 已提交状态；online 仅验证成功的 `tank-authority-v1` 原始 receipt。
- 程序化 Arena、砖墙/钢墙、最多 5 辆坦克、最多 128 发可见弹道；固定对象池/InstancedMesh。
- `spawn/fire/hit/ko` 中每个连续事实最多选择一个最高优先级反馈；位置和弹道由 Three 自身有界插值。
- 保留所有 DOM 控件、HUD、Wave C、玩家/社交、结算和可访问语义；修正窄屏 D-pad 为至少 44px。
- 五个专项、现有 Tank/联机/布局/生命周期回归、Quality Gates、全链与单一 Chromium 部分可见复核；第二浏览器、真机、真实网络与低端性能仍是外部门禁。

## OUT

- 不改 `server/**`、`shared/**`、Authority、WebSocket wire/capability、协议、奖励、Replay、AI、数据库、Supabase、Analytics、赛事或账号数据。
- 不修改 `Ghost3DFoundation`，不建立通用实时游戏抽象，不接入 GLB、纹理、Loader、CDN、Manifest 或 `ART-035` 图片。
- 旧 `tank-host-relay-v1`、普通 `onRestore()`、Replay、乐观预测继续 DOM-only。
- 不 commit、不 push、不 deploy；第二浏览器、真机、真实网络与低端 FPS 保持 `RELEASE_EVIDENCE_PENDING`，不阻塞后续开发；本批没有给具体美术候选记录所有者清除。

## Hot / shared / generated files

- Hot：`public/src/games/tank.js`、`public/src/games/tank-ghost3d-presenter.js`、`public/three/tank-entry.js`。
- Shared：`public/index-template.html`、`scripts/build.js`、`scripts/quality-gates.js`、`package.json`、`public/sw.js`。
- Generated：`public/index.html` 只由 `node scripts/build.js` 生成。
- Likely conflicts：Tank DOM root 重建、authority 坐标平滑、pointer-through canvas、Service Worker cache version、巨大 dirty worktree。

## Risk level

`HIGH`：实时多玩家 + 高频状态 + GPU 生命周期 + 永久输入连续性。用 default-off、深模块、raw receipt、generation/adapter epoch、bounded pool、static gap/recovery 与 DOM fallback 控制。
