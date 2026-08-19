# Monopoly Ghost3D vertical slice P2 — frozen scope

Status: `IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL / RELEASE_NOT_AUTHORIZED`
Date: 2026-08-14 (Asia/Tokyo)

This is the implemented local Monopoly slice for the existing `TECH-049`
closure. It creates no Requirement ID. The bridge, procedural Three renderer,
focused QA and one-browser visible evidence now exist; cross-browser/device,
approved art and release evidence remain separate and incomplete.

## Requirement and routing map

| Existing ID | Current fact | P2 treatment |
| --- | --- | --- |
| `TECH-049` | `partial`; Foundation, Gomoku P0 and Ludo P1 are the established local baseline. | Reuse the existing Foundation Interface and default-off/2D-fallback policy. Monopoly is its next game-local vertical slice. |
| `GAME-050` | `implemented`; Wave B/Wave C Monopoly DOM stage, state rail, dice, purchase, auction and read-only trade state already exist. | Keep them mounted and authoritative as the permanent fallback/control surface; add no gameplay capability. |
| `GAME-044` | `implemented`; it is Tank mobile controls, not Monopoly. | Audited as a non-dependency. P2 must not borrow its joystick, touch protocol, or create a Monopoly control surface. |
| `GAME-045` / `UI-037` | Existing code-native public-character projection, presentation adapter and state rail. | Consume their safe read-only projection/seam only; do not reopen character art, economy, or UI ownership. |

`MAINLINE_CONTROL_ROUTING.json` places `GAME-050` and `TECH-049` in
`NOW_CLOSURE / CLOSE`. `GATE-DEVICE-BROWSER-NETWORK` is
`NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`; this document does
not provide cross-browser/device/network evidence. `GATE-ART-GOLDEN-SET` is
`OPEN_BY_OWNER_AUTHORIZATION`; this procedural batch grants no per-asset
clearance, but later original art may use `OWNER_AUTHORIZED_ART_CLEARANCE`.

## Implemented outcome

Exact opt-in now lazily
mount a procedural Three.js Monopoly view above the retained Wave B DOM board.
It will consume an already-committed, read-only semantic projection for two to
five players. If anything in the optional path fails, the current DOM board,
DOM dice, action buttons, state rail, accessibility behavior, Rule/Authority
flow and result path remain usable without a reload.

## Implemented local scope

- Exact, local-only feature flag `mg_ghost3d_monopoly_v1 === '1'`, only while
  Wave B is active. Missing storage, storage failure, every other value, or
  Wave B rollback means no optional slot is mounted.
- A 24-cell procedural renderer island, fixed to the already approved
  Foundation/Three/GSAP integration pattern, with no new art asset or control
  surface.
- One game-local semantic frame derived after Monopoly has committed its
  current local state or accepted its existing online presentation frame.
- Public, read-only player projection for exactly 2–5 current players,
  revision/generation guards, terminal handling, lifecycle cleanup and a
  strict static/reduced-motion path.
- At most one semantic `token_moved` composite motion for a verified movement
  transition. Dice, buy, chance, payment, auction and terminal states render
  from the current frame; they do not create extra motion types.
- Focused QA for frame construction, renderer island/import graph,
  layout/cache, lifecycle, input non-interference and existing Monopoly
  regressions.

## Explicitly out of scope

- Changes to `shared/rules/monopoly.js`, Rule Authority, protocol capability,
  WebSocket messages, server RNG, action validation, Replay, Reward, AI,
  database, Supabase, economy, matchmaking or persistence.
- A new Monopoly input command, raycast action, renderer-owned dice, board
  click-to-buy, auction close action, trade workflow, controller/joystick, or
  a second source of player eligibility.
- Any ART-036 direction-board/runtime asset, GLB/glTF, texture, loader,
  Manifest entry, source-only image, shop item, character equipment, price or
  ownership field.
- New strings, locale keys, social/replay content, default-on activation,
  commit, push, Pages/Render deploy or a production claim.

## Authority, ownership and rollback

The existing Monopoly game remains the owner of local rule state and existing
DOM controls. Online authority remains the owner of `monopoly-rule-v2`
`matchId`, revision, state hash, RNG, legal action, auction deadline and
result. `MonopolyPresentationAdapter` remains the only current online
continuity validator; P2 must not duplicate, loosen or bypass it.

The existing `Ghost3DFoundation` is the deep **Module**. Its
`create / apply / snapshot / dispose` **Interface** remains unchanged. The
game-local frame builder is implementation detail at the Monopoly presentation
**Seam**, and the current Three renderer is merely its replaceable **Adapter**.
That keeps lifecycle, fallback and async complexity inside the established
Module rather than exposing a second public rendering API.

Rollback is exact: remove `mg_ghost3d_monopoly_v1`, set it to any value other
than `'1'`, or set `mg_art_game_stage_wave_b_v1 === '0'`. A failed import,
unsupported capability, failed first render, context loss, reset, restore or
destroy must also leave the existing Wave B DOM path in control. No data
migration, protocol compatibility branch or asset rollback is needed.

## Implemented file ownership

The implementation followed the frozen ownership below:

| Role | Location | Must not own |
| --- | --- | --- |
| Game-local bridge/frame builder | `public/src/games/monopoly.js` | Rule Core, protocol, economy, renderer vendor bytes |
| Replaceable Three Adapter | `public/three/monopoly-entry.js` | DOM game controls, WebSocket, persistent state |
| Focused QA | new Monopoly Ghost3D QA files under `qa/` | existing shared Foundation semantics except through its Interface |
| Shared integration | build/SW/package/status/ledger/logs | requires Master-owned change request; not authorized by this task |

The renderer reused the existing vendor graph, ADR and provenance process. No
vendor-version or ADR decision changed.

## External gates retained

- `GATE-DEVICE-BROWSER-NETWORK`: second desktop browser, Android, iPhone,
  Tablet, real latency/jitter/loss/reordering, current-build visible
  reduced-motion and performance evidence are `NOT_EXECUTED`.
- `GATE-ART-GOLDEN-SET`: ART-036 is currently source-only/reference-only
  because it has no per-asset `OWNER_AUTHORIZED_ART_CLEARANCE`. Human cleanup,
  Reviewer B, IP/legal advice and per-asset Golden Set remain optional advisory
  evidence and do not block later machine review or reversible runtime work.
- `GATE-SUPABASE-PRODUCTION` is not a P2 dependency because P2 has no data
  change; it remains `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`
  and untouched by this slice.
