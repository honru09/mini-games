# Ludo Ghost3D vertical slice P1 — acceptance boundary

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

- [x] Exact local opt-in is default-off and requires active Wave B.
- [x] Wave B DOM board and dice command remain mounted as permanent fallback.
- [x] Frames contain only frozen, plain Ludo presentation data; renderer values do not enter snapshots, serialization, protocol, replay, reward, AI, or persistence paths.
- [x] Renderer accepts only revision-bound `select_token` through the existing `pick(curPid(), token)` seam; the DOM dice control remains the sole roll entry point.
- [x] Each accepted Ludo token pick creates one composite `piece_moved` event after its corresponding frame is accepted; terminal is only the local `ranking` process.
- [x] The renderer now maps that semantic action through the shared CameraRig (action-follow / impact / finish / overview) and emits one revision-bound presentation-only terminal result beat after the accepted ranking frame; no rule or wire shape changed.
- [x] Current-build Chromium recheck exposed and fixed the same result-surface occlusion class found in Gomoku: the podium dialog waits only for a ready animated ranking shot (520ms HIGH / 420ms BALANCED), while fallback, LOW and reduced-motion remain immediate. Evidence: `evidence/camera-language-golden-slice-202608171939.json`.
- [x] Visibility, shell changes, reduced motion, context loss, recovery, reset, restore, and destroy have scoped contract coverage.
- [x] Service worker keeps renderer modules demand-loaded and cacheable rather than install-shell assets.
- [x] The 390px portrait CSS contract gives the Ludo arena one explicit full-width grid track (`minmax(0,1fr)`, `justify-content:stretch`) before the stage resolves `width:100%`. It sizes the frame from that track (square aspect, zero viewport min-height) and makes the DOM fallback board fill the frame content box (`width/height:100%`, `border-box`). `renderBoard()` uses the frame content width as its geometry source at every Wave B viewport. Together these keep the playfield full-width and guarantee `frame.scrollWidth <= frame.clientWidth`, rather than only asserting that `board-area` has no horizontal scroll.
- [x] Resize and orientation changes coalesce presentation geometry work into one animation frame, recompute from the new layout, and remove both listeners plus any pending callback during destroy.
- [x] One local in-app Chromium completed default-off, temporary HIGH opt-in, 390×844, 1440×900, live viewport transition, reduced-motion, cleanup, and zero-console visible checks. This is partial evidence only; second-browser, physical-device, real-network, and low-end performance work remains `NOT_EXECUTED`, so the shared device Gate stays blocked.
- [ ] Art approval, Golden Set, real performance evidence, commit, push, deploy, and release are out of this batch.
- [ ] The new camera-language evidence remains single-browser local partial evidence; external device/network/performance/art/release gates remain open.
