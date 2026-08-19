# Tetris Ghost3D vertical slice P4 — local scope

Status: `IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL_EVIDENCE / DEFAULT_OFF / NOT_RELEASED`.

This is the fifth local Ghost3D vertical slice after Gomoku P0, Ludo P1,
Monopoly P2, and Xiangqi P3. It freezes one focused, current-observed-well
presentation slice before implementation. It does not claim browser, device,
art, production, or release verification.

## Requirement mapping and routing

- Reuse existing `GAME-048` (Tetris Wave B/Wave C density and disposable
  process presentation) and `TECH-049` (replaceable Ghost3D presentation
  framework). This batch creates no Requirement ID.
- The task is `NOW_CLOSURE / CLOSE`. `GATE-DEVICE-BROWSER-NETWORK` and
  `GATE-SUPABASE-PRODUCTION` are `NON_BLOCKING_FOR_DEVELOPMENT /
  RELEASE_EVIDENCE_PENDING`. `GATE-ART-GOLDEN-SET` is
  `OPEN_BY_OWNER_AUTHORIZATION`; this procedural batch grants no per-asset
  clearance, while later original art may use `OWNER_AUTHORIZED_ART_CLEARANCE`.

## Design decision

Three independent `gpt-5.6-terra max` designs were compared using the
`codebase-design` depth/locality/seam vocabulary. P4 adopts a focused hybrid:

- a dedicated deep `TetrisGhost3DPresenter` Module with the small production
  Interface `create(readModel) -> commit/snapshot/dispose`;
- one current-observed 18×10 well per Renderer Adapter, not a 2–5-well 3D
  fan-out;
- one verified `piece_locked` semantic motion, while movement, rotation,
  gravity, Hold/Next, incoming garbage, score chains, opponent wells, HUD, and
  all controls remain owned by the current DOM/Wave C presentation;
- local committed facts and accepted `tetris-rule-v3` facts only. Legacy
  `tetris-battle-authority-v1`, host relay, presentation relay, and malformed
  or untrusted state remain DOM-only.

This concentrates feature-gate, source-continuity, host generation, Adapter
epoch, lazy-load, fallback, and cleanup complexity behind one Interface
without widening `Ghost3DFoundation` or copying those concerns across every
Tetris action branch.

## In scope

- Exact local opt-in `mg_ghost3d_tetris_v1 === '1'`, additionally requiring
  the existing Wave B stage to be active.
- A code-native, lazy Three r185 Renderer for the current observed 18×10 well,
  with HIGH/BALANCED/LOW quality, reduced-motion static behavior, context-loss
  recovery, resize/orientation handling, and idempotent disposal.
- Strict frozen frame projection from committed local/AI state or already
  accepted `tetris-rule-v3` state; raw v3 match/revision/focus hash and lock
  event may be retained only as transient presentation guards.
- Source tags for `live`, `room-restored`, `reconnect`, and
  `spectator-bootstrap` passed locally by the WebSocket client without any new
  wire field.
- Permanent DOM fallback, seven touch controls, existing keyboard input,
  opponent mini wells, Hold/Next/Incoming, Wave C process rail, KO overlay,
  Victory/Reward UI, and current Rule/Authority behavior.
- Focused contract/renderer/ESM/layout/cache QA, shared regressions, and honest
  local/browser evidence boundaries.

## Out of scope

- Changes to `shared/rules/tetris.js`, server Rule Authority, protocol,
  capabilities, action validation, garbage targeting, scoring, replay,
  rewards, AI, economy, persistence, database, tournament, or match results.
- Renderer-originated input, raycast commands, second WebGL context for
  opponents, all-player 3D overview, new target selection, or input remapping.
- Guessing animation history from legacy battle/presentation relay, revision
  gaps, timer copy, Wave C text, or optimistic online state.
- GLB/glTF, textures, loaders, asset-manifest changes, source-only/reference-
  only art, or any unapproved runtime art.
- Second browser, physical device/touch, real network, low-end GPU/FPS,
  production Supabase, commit, push, deploy, or release work.

## Ownership and rollback

- `public/src/games/tetris.js` remains Rule/DOM/input/game-instance owner. It
  may update trusted presentation metadata and call the Presenter only after
  an existing state commit.
- `public/src/games/tetris-ghost3d-presenter.js` owns the Tetris-specific deep
  Module, frozen frame/motion projection, feature gate, source continuity,
  slot/generation/epoch, Foundation calls, lazy Adapter load, fallback, and
  cleanup.
- `public/three/tetris-entry.js` owns Three objects, canvas, camera,
  procedural scene, finite GSAP resources, and Renderer disposal.
- `public/src/online/03-websocket.js` may add only local source arguments to
  existing Tetris callbacks.

Rollback is exact: remove `mg_ghost3d_tetris_v1` or set it to any non-`'1'`
value, set the existing Wave B switch to `'0'`, or encounter any optional
Renderer failure. The current DOM/CSS Tetris game must remain fully playable
without requesting the optional module.

## Implemented local result

- The deep Presenter, lazy Three Renderer, Tetris bridge, source-continuity
  tags, responsive slot layout, focused QA and deterministic build integration
  are now present in the local working tree.
- Primary review corrected Rule Core tetromino parity, authority/reconcile
  fail-closed behavior, cancellable resize, generation listener rebinding,
  inactive-Shell visibility recovery, constructor/renderer failure stickiness,
  source-tag integrity, overlay z-order, focused-opponent duplication and the
  portrait Arena/Command height budget.
- One Chromium supplied partial visible evidence for default-off fallback,
  temporary opt-in, 2/4-player layouts, four target viewports, one additional
  583×726 portrait layout, three languages, two themes, real keyboard/Hard Drop
  input, visible reduced motion and zero console warnings/errors.
- `npm run test:tetris-ghost3d`, `npm run quality:gates` and the final full
  `npm test` (147.9 seconds) pass. Two deterministic builds are byte-identical
  at 1,518,538 characters / 1,533,072 bytes / SHA-256
  `9A42890C22D50225EE2D5AF0238BA4CE80D115A43A2F691E9555DE109B4D0DFE`.
- Second browser, physical devices/touch, real network, five-player visible
  multiplayer, low-end performance and human art Gates remain `NOT_EXECUTED`.
  No commit, push or deployment occurred.
