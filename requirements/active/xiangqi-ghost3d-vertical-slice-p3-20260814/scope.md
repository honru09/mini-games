# Xiangqi Ghost3D vertical slice P3 — local scope

Status: `IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL_EVIDENCE / DEFAULT_OFF / LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`.

This is the fourth local Ghost3D vertical slice after Gomoku P0, Ludo P1,
and Monopoly P2. The implementation, focused QA, shared regressions, one
in-app Chromium visible pass, Quality Gates, full test chain, and deterministic
double build are complete. It does not claim second-browser, physical-device,
real-network, low-end performance, art, production, or release verification.

## Requirement mapping and routing

- Reuse existing `GAME-052` (Xiangqi Wave C Arena density and disposable
  process chain) and `TECH-049` (replaceable Ghost3D presentation framework).
  This batch creates no Requirement ID.
- `GAME-051` is the Tank Wave C requirement. It is not an alternate Xiangqi
  ID and is outside this slice.
- The task is `NOW_CLOSURE / CLOSE`. `GATE-DEVICE-BROWSER-NETWORK` and
  `GATE-SUPABASE-PRODUCTION` are `NON_BLOCKING_FOR_DEVELOPMENT /
  RELEASE_EVIDENCE_PENDING`; `GATE-ART-GOLDEN-SET` is
  `OPEN_BY_OWNER_AUTHORIZATION`. This procedural slice grants no per-asset
  clearance, while later original art may use `OWNER_AUTHORIZED_ART_CLEARANCE`.

## In scope

- An implemented local, opt-in presentation bridge from committed local Xiangqi state and
  already accepted `xiangqi-rule-v2` snapshots to `Ghost3DFoundation`.
- One separately owned, lazy-loaded Three renderer island, with a frozen
  Xiangqi semantic frame and one possible `piece_moved` motion event.
- Exact default-off behavior: the renderer may activate only when local
  storage reads `mg_ghost3d_xiangqi_v1 === '1'`. Missing storage, blocked
  storage, any other value, disabled support, failed import, failed mount,
  failed first render, later render failure, or context loss keeps the DOM
  fallback live.
- Revision/source continuity, host generation and adapter-epoch invalidation,
  quality/reduced-motion behavior, lifecycle cleanup, and focused QA design.

## Permanent DOM ownership and fallback

The existing Canvas/DOM `.xiangqi-board`, its Wave C process rail, and its
existing click, keyboard, and touch input paths are permanent. They are the
only gameplay input surface in P3, whether the renderer is available or not.

The optional renderer canvas is presentation-only: `aria-hidden`,
`role="presentation"`, `tabindex="-1"`, and `pointer-events:none`. It has no
raycast command, click handler, selection callback, move callback, or input
message. It cannot select a piece, submit a move, change a clock, or control
the DOM board.

Xiangqi does not currently have Ludo/Monopoly's named Wave B storage gate.
For P3, the retained Canvas/DOM board and Wave C rail are the
Wave-B-equivalent permanent fallback; a new switch must not make them
conditional or replace them.

## Out of scope

- Changes to Xiangqi rules, server Rule Authority, WebSocket protocol,
  capability negotiation, replay, rewards, AI, economy, persistence,
  database, clock behavior, match-chat, or player-seat rules.
- Any new gameplay action, renderer-originated input, spectator capability,
  AI behavior, localized copy, asset catalog entry, or default-on setting.
- GLB/glTF, textures, loaders, manifest changes, `public/assets` runtime
  material, ART-036 source/reference material, or any unapproved art. P3 is
  procedural/code-native only.
- Second-browser, physical-device, real-network, low-end GPU/FPS, production
  Supabase, commit, push, deploy, or release work.

## Ownership and rollback

`public/src/games/xiangqi.js` remains the DOM input and local presentation
owner. The bridge projects plain data and manages the optional host only.
`public/three/xiangqi-entry.js` owns Three objects, canvas, camera,
procedural scene, and its finite motion resources. `Ghost3DFoundation` remains
the lifecycle/fallback seam.

Rollback is exact: remove the local flag or set it to any value other than
`'1'`. The DOM board must remain playable without a request for the optional
module. A renderer failure is not a game failure and must never alter the
existing rule, authority, or DOM-input path.
