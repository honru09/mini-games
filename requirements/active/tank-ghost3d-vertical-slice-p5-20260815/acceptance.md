# Tank Ghost3D vertical slice P5 — acceptance

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

状态：`IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL_EVIDENCE / DEVELOPMENT_OPEN / RELEASE_EVIDENCE_PENDING / LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`。

本批已完成 Tank Ghost3D 本地可替换表现纵切、自动化回归、Terra Max 双轴终审、单一 Codex in-app Chromium 可见复核、全链与双构建；该状态不等于跨设备、生产数据、正式美术或已发布。

## Focused suites

- [x] `qa/tank-ghost3d-contract.js`：Deep Module、双 gate、raw receipt、frame whitelist/freeze、local/authority/relay/replay、连续 +2/gap、事件优先级、generation/failure、零 Renderer input、serialize 隔离。
- [x] `qa/tank-ghost3d-renderer.js`：封闭 exports、程序化 13×15/17 Arena、5 tank/128 projectile/221 terrain 上界、插值无外推、无 per-packet timeline、质量/低动效、context/dispose。
- [x] `qa/tank-ghost3d-esm-graph.js`：只允许锁定 Three r185 + GSAP Core 的相对 lazy graph；无插件/Loader/GLB/texture/CDN/asset manifest。
- [x] `qa/tank-ghost3d-layout.js`：2–5 人、桌面/1024/390 竖屏/844 横屏；canvas pointer-transparent；board click、摇杆、D-pad、独立开火、键盘、HUD/Wave C 仍可用；D-pad ≥44px。
- [x] `qa/tank-ghost3d-cache.js`：Presenter 构建顺序、default-off 零 preload、版本化 lazy URL、SW 不 precache、support/import/render failure 恢复 DOM。
- [x] `npm run test:tank-ghost3d` 已注册到 pretest/full test 与 fast Quality Gates。

## Existing regressions

- [x] `node qa/ghost3d-foundation.js`
- [x] `node qa/tank-controls.js`
- [x] `node qa/tank-authority.js`
- [x] `node qa/game-stage-density-process-tank-xiangqi.js`
- [x] `node qa/game-stage-input-continuity.js`
- [x] `node qa/immersive-game-shell.js`
- [x] `node qa/dom-smoke.js` 与 `npm run test:i18n`
- [x] reconnect、spectator、E2E、load/memory/timer
- [x] `npm run quality:gates` 与完整 `npm test`
- [x] 确定性双构建字符数/字节数/SHA-256 一致。

## Vertical-slice matrix

| Dimension | Required proof | Current |
| --- | --- | --- |
| Visible result | default-off DOM 与临时 opt-in 程序化 3D Arena 明显不同 | `SINGLE_BROWSER_PARTIAL_EVIDENCE` |
| Real input | board click、keyboard、joystick、D-pad、fire 不被 canvas 截断 | `SINGLE_BROWSER_PARTIAL_EVIDENCE` |
| State/errors | local/AI、accepted authority、relay/replay/gap/malformed/failure | `IMPLEMENTED_LOCAL / AUTOMATED` |
| Multiplayer/spectator | 2–5 人、正式 authority、观战只读 | `2–5 CONTRACT / 2-PERSON VISIBLE / REAL 3–5 NOT_EXECUTED` |
| Reconnect/restore | static fresh generation，不补播 | `IMPLEMENTED_LOCAL / AUTOMATED` |
| i18n/raw | Renderer 无文字；DOM 继续三语言/raw 所有权 | `SINGLE_BROWSER_PARTIAL_EVIDENCE / THREE_LANGUAGES` |
| Accessibility | canvas hidden/pointer transparent；44px 控件 | `SINGLE_BROWSER_PARTIAL_EVIDENCE` |
| Reduced motion | 等价静态 frame，0 timeline | `AUTOMATED / CURRENT_BUILD_VISIBLE_RECHECK` |
| Performance | bounded pool、no per-packet tween、cleanup | `AUTOMATED / REAL DEVICE NOT EXECUTED` |
| Rollback | exact flag/failure 回到当前 DOM Tank | `IMPLEMENTED_LOCAL / AUTOMATED` |

## External gates

- [ ] 第二浏览器、Android、iPhone、Tablet、物理触控和 PWA。
- [ ] 真实延迟/抖动/丢包/乱序、低端 FPS/GPU/thermal/memory。
- [ ] Reviewer B、IP Review、Golden Set 后的正式 Tank Art runtime。
- [ ] commit、push、Pages/Render 部署只在新的明确用户命令后执行。

## Recorded local evidence

- `requirements/active/tank-ghost3d-vertical-slice-p5-20260815/evidence/single-browser-visible-verification-202608150945.json`
- `requirements/active/tank-ghost3d-vertical-slice-p5-20260815/evidence/camera-language-current-build-202608172134.json`
- `npm run test:tank-ghost3d`：ESM 32、Renderer 65、Presenter/bridge 49、layout 18、cache 15 全部通过。
- Ghost3D Foundation、Tank controls/authority、Tank/Xiangqi density、Game Stage input continuity、Immersive Shell、Tetris cache、i18n、DOM smoke、Quality Gates 与完整 `npm test` 全部通过。
- Terra Max `gpt-5.6-terra max` Standards/Spec 终审发现的 revision FX、receipt tick、防 import 永久锁死问题已修正并重新验证。
- 确定性双构建一致：1,579,631 characters / 1,594,165 bytes / SHA-256 `41E7C7562B9289ABA27D237D9C806D1B9565B71293453EDC47F9BF05AC5F383E`；本批仍为本地、default-off、未发布。
- 当前镜头构建：`public/index.html` 1,982,386 字符 / 1,997,009 bytes /
  SHA-256 `2C8D4F8B28255C15358C81122DFF9BE0479A0FD4DF3A75F8EAAB02A2CD95F1F1`；
  Tank Renderer SHA-256 `F86D0CC65A4B9AB7377072E2E26DE85593557800577F227C5B50F7B3306C4AAD`。

## Release boundary

本批没有 commit、push、GitHub Pages 或 Render 部署；设备/网络与 Supabase 开发通道保持 `OPEN`，发布证据仍为 `RELEASE_EVIDENCE_PENDING`。正式 Tank 美术继续留在 source/reference-only，未审批素材不进入 runtime。
