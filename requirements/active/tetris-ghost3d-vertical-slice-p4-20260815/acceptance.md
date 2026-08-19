# Tetris Ghost3D vertical slice P4 — acceptance boundary

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

Status: `IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL_EVIDENCE / DEVELOPMENT_OPEN / RELEASE_EVIDENCE_PENDING / NOT_RELEASED`.

This acceptance record separates the completed local implementation and one
Chromium's partial visible evidence from the external proof that remains
blocked. It does not promote `GAME-048` or `TECH-049` to cross-device visual
verification and does not change a shared Gate.

## Frozen baseline

- [x] Reuse `GAME-048 + TECH-049`; create no Requirement ID.
- [x] Select the A+C hybrid after three independent Terra Max Interface designs.
- [x] Exact opt-in requires Wave B plus `mg_ghost3d_tetris_v1 === '1'`.
- [x] Scope is one current observed well; opponents remain DOM mini wells.
- [x] Online 3D accepts only committed `tetris-rule-v3`; legacy protocols remain DOM-only.
- [x] DOM 18×10 well, seven touch controls, keyboard, Hold/Next/Incoming, Wave C, KO and result UI are permanent.
- [x] Renderer input is zero; accepted `piece_locked` is the only lock motion and accepted terminal frames add one revision-bound presentation-only result event.
- [x] Rule, server, protocol, reward, replay, AI, database, GLB, textures, runtime art, and release are outside P4.

## Required focused suites

| Suite | Required minimum proof |
| --- | --- |
| `qa/tetris-ghost3d-contract.js` | Deep Module Interface; exact gate/Wave B prerequisite; frozen 18×10 focus frame; field exclusion; local/v3-only source trust; optimistic mismatch; stale/gap/malformed; one motion; KO vs match terminal; generation/epoch; zero renderer input; DOM/serialize isolation. |
| `qa/tetris-ghost3d-renderer.js` | Closed exports; procedural well/blocks; first-render ready; aria/pointer transparency; bounded pools; HIGH single timeline; BALANCED/LOW; reduced-motion static; suspend/resume; context recovery; idempotent disposal. |
| `qa/tetris-ghost3d-esm-graph.js` | Closed relative lazy graph; approved Three r185 + GSAP Core only; no CSSPlugin/ScrollTrigger/loader/GLB/texture/CDN/asset manifest. |
| `qa/tetris-ghost3d-layout.js` | DOM root, KO, previews, process rail, opponents, keyboard and seven controls remain reachable; desktop, 1024×768, 390×844, and 844×390 do not clip or intercept input through root rebuild/fallback. |
| `qa/tetris-ghost3d-cache.js` | Presenter is concatenated before Tetris caller; optional Renderer is not preloaded/install-shell content; exact opt-in lazy-loads a versioned URL; support/import/render failure returns to DOM. |

Add `npm run test:tetris-ghost3d`, include it in pretest/full test when files
exist, and register all focused checks in the fast Quality Gates.

## Required existing regressions

- `node qa/ghost3d-foundation.js`
- `node qa/tetris-rule-core.js`
- `node qa/tetris-battle-protocol.js`
- `node --experimental-websocket qa/tetris-protocol-fallback-online.js`
- `node qa/game-stage-wave-b-tetris.js`
- `node qa/game-stage-density-process-tetris.js`
- `node qa/game-stage-input-continuity.js`
- `node qa/rule-authority.js`
- `node --experimental-websocket qa/rule-authority-online.js`
- `node --experimental-websocket qa/reconnect-online.js`
- `node --experimental-websocket qa/spectator-room.js`
- i18n, DOM, immersive Game Shell, Quality Gates, and full `npm test`.

## Vertical-slice matrix

| Dimension | Required proof | Current status |
| --- | --- | --- |
| Visible result | Default DOM and temporary opt-in procedural well are distinct while controls/HUD/opponents remain usable. | `SINGLE_BROWSER_PARTIAL_EVIDENCE` |
| Real input | Existing keyboard and all seven touch controls keep their identity and submit only through the DOM game. | `KEYBOARD_AND_HARD_DROP_VISIBLE / PHYSICAL_TOUCH_NOT_EXECUTED` |
| State/errors | Local/AI/v3 live lock; optimistic mismatch; old protocol; stale/gap/malformed; import/WebGL/render/context failures. | `IMPLEMENTED_LOCAL / AUTOMATED` |
| Multiplayer/spectator | 2–5 player state with one observed well; focus switch/bootstrap is static and spectator remains read-only. | `2_AND_4_PLAYER_VISIBLE / 5_PLAYER_AND_SECOND_BROWSER_NOT_EXECUTED` |
| Reconnect/restore | Fresh static generation; no lock replay. | `IMPLEMENTED_LOCAL / AUTOMATED` |
| i18n/raw | DOM owns all text; Renderer has no user/raw copy. | `SINGLE_BROWSER_PARTIAL_EVIDENCE / THREE_LANGUAGES` |
| Accessibility | Canvas hidden/pointer-transparent; KO, controls, keyboard, names and focus remain unobscured. | `SINGLE_BROWSER_PARTIAL_EVIDENCE / PHYSICAL_TOUCH_NOT_EXECUTED` |
| Reduced motion | Equivalent final well with zero active timeline. | `SINGLE_BROWSER_PARTIAL_EVIDENCE / CURRENT_BUILD_RECHECK` |
| Performance | Lazy graph, bounded 184-cell capacity, one timeline, on-demand render, cleanup and four target layouts. | `LAYOUT_VISIBLE / REAL_DEVICE_PERFORMANCE_NOT_EXECUTED` |
| Rollback | Flag/Wave B/failure restores exact current DOM game and invalidates stale work. | `IMPLEMENTED_LOCAL / AUTOMATED` |
| Authority/art | No rule/protocol/reward/replay/data mutation and no unapproved asset. | `IMPLEMENTED_LOCAL / ART_GATE_BLOCKED` |

## External and release evidence

- [ ] Second desktop browser and two formal accounts.
- [ ] Physical Android, iPhone Safari, Tablet, touch, orientation, PWA/restore.
- [ ] Real latency/jitter/loss/reorder and low-end FPS/GPU/thermal/memory.
- [ ] Reviewer B, IP Review, and user Golden Set for any later approved art.
- [ ] Commit, push, Pages/Render deploy, and production release require a new explicit user command.

Static contracts and automated tests cannot clear a shared Gate or promote
`TECH-049` beyond its documented partial status.

## Recorded local evidence

- `requirements/active/tetris-ghost3d-vertical-slice-p4-20260815/evidence/single-browser-visible-verification-202608150145.json`
- `requirements/active/tetris-ghost3d-vertical-slice-p4-20260815/evidence/camera-language-current-build-202608172134.json`
- `npm run test:tetris-ghost3d`: ESM graph 88 assertions, Renderer 121
  assertions, Presenter/bridge, layout and cache all pass.
- Applicable Wave B/Wave C, input continuity, Tetris Rule/Battle/v3 fallback,
  Rule Authority local/online, reconnect and spectator regressions pass.
- Final `npm run quality:gates` and full `npm test` (147.9 seconds) pass after
  the last visual and independent-review correction.
- Deterministic double build: 1,518,538 characters / 1,533,072 bytes /
  SHA-256 `9A42890C22D50225EE2D5AF0238BA4CE80D115A43A2F691E9555DE109B4D0DFE`.
- `ghost3d-tetris-preview` has zero matches in `public`, requirements and QA;
  the final runtime again requires the exact localStorage opt-in.
- Current build camera evidence: `public/index.html` 1,982,386 characters /
  1,997,009 bytes / SHA-256 `2C8D4F8B28255C15358C81122DFF9BE0479A0FD4DF3A75F8EAAB02A2CD95F1F1`;
  Tetris Renderer SHA-256 `D5D5C6156ECD2FB89DAA1513FDE8872EB72FF2D0DE49CB28813F31C6BE591FBB`.
