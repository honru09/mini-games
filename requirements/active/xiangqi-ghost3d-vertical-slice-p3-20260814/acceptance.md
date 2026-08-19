# Xiangqi Ghost3D vertical slice P3 — acceptance boundary

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示外部证据已经完成，也不授予跨设备、生产就绪或发布结论；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

Status: `IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL_EVIDENCE / EXTERNAL_GATES_BLOCKED / NOT_RELEASED`.

This acceptance record separates the local implementation and single-browser
evidence now completed from the external evidence that remains blocked. It
does not promote `GAME-052` or `TECH-049` to cross-device visual verification
and does not change any shared Gate.

## Frozen baseline

- [x] The prospective slice is mapped to `GAME-052` and `TECH-049`; it creates
  no Requirement ID.
- [x] `GAME-051` was classified as Tank-only and remains outside Xiangqi P3.
- [x] Exact opt-in is frozen as `mg_ghost3d_xiangqi_v1 === '1'`.
- [x] Existing `.xiangqi-board` Canvas/DOM and click, keyboard, and touch
  gameplay paths are frozen as the permanent fallback and sole input owner.
- [x] Renderer input is frozen at zero: presentational, unfocusable, and
  pointer-transparent canvas only.
- [x] Raw authority revision/hash/last-move capture must be consumed before
  client flattening, without changing authority or DOM restore semantics.
- [x] The only semantic motion is revision-bound `piece_moved`; no inferred
  capture/check/clock/result choreography is allowed.
- [x] ART-036, GLB/glTF, runtime art, server/protocol/rule changes, and release
  work are outside this batch.

## Focused automated suites

The implementation added and wired the following focused checks. All are
included in `npm run test:xiangqi-ghost3d`, the normal test chain, and the
fast Quality Gates:

| Suite | Required minimum proof |
| --- | --- |
| `qa/xiangqi-ghost3d-contract.js` | Exact default-off gate; frozen 10×9 frame; no forbidden fields; fixed two-player projection; raw match/revision/hash continuity; one motion type; capture diff; terminal-only rule; generation/epoch last-wins; no renderer input; snapshot/serialize isolation. |
| `qa/xiangqi-ghost3d-renderer.js` | Closed renderer exports; code-native 10×9 board/pieces; first-render readiness; aria/pointer transparency; one HIGH timeline maximum; BALANCED/LOW behavior; reduced-motion static state; suspend/resume; context loss/recovery; idempotent disposal. |
| `qa/xiangqi-ghost3d-esm-graph.js` | Lazy closed relative ESM graph; approved Three/GSAP imports only; no loader, GLB, texture, asset-manifest, or install-shell dependency. |
| `qa/xiangqi-ghost3d-layout.js` | Retained DOM board/process rail and controls remain reachable at desktop, tablet, 390×844, and 844×390; optional layer does not clip, overflow, or intercept input through DOM rebuilds. |
| `qa/xiangqi-ghost3d-cache.js` | Optional entry is not preload/install-shell content, demand-loads only after exact opt-in, and fails back after module/support failure. |

The new `test:xiangqi-ghost3d` command should include syntax checking and all
five focused suites. It should be included in the normal test chain only when
the files exist.

## Required existing regression coverage

The implementation owner must preserve and rerun the applicable existing
coverage:

- `npm run test:xiangqi-rule-core`
- `npm run test:xiangqi-clock`
- `node qa/game-stage-density-process-tank-xiangqi.js`
- `node qa/gameplay-upgrade.js`
- `node qa/rule-authority.js`
- `node --experimental-websocket qa/rule-authority-online.js`
- `node qa/protocol-version.js`
- `node --experimental-websocket qa/reconnect-online.js`
- `node --experimental-websocket qa/spectator-room.js`
- Ghost3D Foundation, i18n, DOM, immersive Game Shell, quality-gate, and full
  regression coverage as applicable.

## Vertical-slice proof matrix

| Required dimension | Required proof | Current status |
| --- | --- | --- |
| Visible result | Exact default DOM fallback and temporary opt-in procedural scene are visibly distinct without hiding the DOM board. | `SINGLE_BROWSER_PARTIAL_EVIDENCE` |
| Real input | DOM click, keyboard, and touch make valid existing moves; renderer accepts zero commands. | `KEYBOARD_VISIBLE / CLICK_AND_TOUCH_AUTOMATED / PHYSICAL_TOUCH_NOT_EXECUTED` |
| State/errors | Local move/capture/check/terminal; online live state; stale/gap/malformed; import/WebGL/render/context failures all preserve DOM play. | `IMPLEMENTED_LOCAL / AUTOMATED` |
| Two-player/spectator | Exactly two active Xiangqi sides; spectator bootstrap is static and read-only. | `IMPLEMENTED_LOCAL / AUTOMATED` |
| Reconnect/restore | Room restore and reconnect create a fresh static generation and do not replay `lastMove`. | `IMPLEMENTED_LOCAL / AUTOMATED` |
| i18n/raw boundary | DOM owns all localized clock/status text; renderer adds no text or raw/private identity data. | `SINGLE_BROWSER_PARTIAL_EVIDENCE / THREE_LANGUAGES` |
| Accessibility | Canvas is hidden/pointer-transparent; retained DOM controls remain named, focused, keyboard/touch usable, and unobscured. | `KEYBOARD_VISIBLE / PHYSICAL_TOUCH_NOT_EXECUTED` |
| Reduced motion | Equivalent final state with no active renderer timeline or replayed move. | `SINGLE_BROWSER_PARTIAL_EVIDENCE` |
| Performance | Lazy graph, one-timeline budget, on-demand/hidden suspension, cleanup and target layouts; real FPS/GPU/memory remain separate device evidence. | `LAYOUT_VISIBLE / REAL_DEVICE_PERFORMANCE_NOT_EXECUTED` |
| Cleanup/rollback | Reset, new match, restore, reconnect, feature-off, hidden/visible, context loss/recover, DOM rebuild, and destroy invalidate stale work. | `IMPLEMENTED_LOCAL / AUTOMATED` |
| Authority/safety/art | No Rule/Authority/Protocol/Replay/Reward/AI/DB mutation and no ART-036, GLB, or unapproved runtime art. | `IMPLEMENTED_LOCAL / ART_GATE_BLOCKED` |

## External and release evidence

- [ ] `GATE-DEVICE-BROWSER-NETWORK`: second desktop browser, Android, iPhone
  Safari, tablet orientations/PWA recovery, real latency/jitter/loss/reorder,
  and low-end frame/GPU/thermal/memory evidence.
- [ ] `GATE-ART-GOLDEN-SET`: human cleanup, Reviewer B, IP review, and user
  Golden Set. It remains required before any separate approved-art task, not
  for this procedural P3 contract.
- [ ] `GATE-SUPABASE-PRODUCTION`: remains blocked and unrelated to P3's local
  renderer boundary.
- [ ] Commit, push, Pages/Render deployment, release, and production-ready
  claims require explicit user authorization and are not granted here.

## Recorded local evidence

- `requirements/active/xiangqi-ghost3d-vertical-slice-p3-20260814/evidence/single-browser-visible-verification-202608150003.json`
- `npm run test:xiangqi-ghost3d`: passed; ESM graph 76 assertions and Renderer 65 assertions, plus bridge/layout/cache coverage.
- `node qa/game-stage-density-process-tank-xiangqi.js`: passed after the shared expectation was synchronized to the approved three-budget Xiangqi layout.
- `npm run quality:gates`: passed.
- Full `npm test`: passed in 162.7 seconds.
- Deterministic double build: 1,459,188 characters / 1,473,722 bytes / SHA-256 `A4855B36015AE43CB45F90D5750699DB14ABEDA6F2D3A5574009BCE9DB9DD58B` for both runs.

An implementation fails closed if it changes input ownership, infers an
unverified move, replays a restore/reconnect/spectator transition, moves under
reduced motion, retains stale resources, or crosses the authority/art
firewall. Static contracts and one browser cannot clear a shared Gate or
promote `TECH-049` beyond its documented partial status.
