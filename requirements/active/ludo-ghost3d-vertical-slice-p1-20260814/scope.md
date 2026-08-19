# Ludo Ghost3D vertical slice P1 — local scope

Status: `IMPLEMENTED_LOCAL_DEFAULT_OFF / SINGLE_BROWSER_PARTIAL_EVIDENCE`. This record does not claim cross-browser, physical-device, real-network, performance, art, or release verification.

This is a closure batch for existing `GAME-043`, `GAME-049`, and `TECH-049`; it creates no new product requirement.

## In scope

- A local-only, exact opt-in bridge from Ludo's existing presentation state to `Ghost3DFoundation` and the separately owned renderer island.
- Frozen plain semantic frames, revision-checked `select_token` commands routed only through the existing Ludo `pick()` input seam, and one `piece_moved` event per accepted token pick. The DOM dice control remains the only roll entry point.
- Wave B overlay placement, lifecycle/recovery cleanup, cache invalidation, focused static/VM checks, and test-chain integration.
- One local Chromium partial visible pass for default fallback, temporary HIGH opt-in, 390×844, 1440×900, live viewport transition, reduced motion, and cleanup.

## Out of scope

- Rule, Authority, Protocol, Replay, Reward, Economy, AI, persistence, socket, server, shared-core, or database changes.
- New art assets, i18n text, gameplay mechanics, accessibility copy, default-on rendering, or a new control surface.
- Second-browser/physical-device screenshots, real-network testing, performance certification, and release/deploy work.

## Ownership and rollback

The Ludo module remains rule and input owner. The bridge owns only frozen projection, revision handling, optional slot, host lifecycle, and renderer callbacks. The renderer island owns renderer objects, canvas, scene work, and animation resources. The retained Wave B DOM board and dice command remain the permanent fallback.

Rollback is exact local storage removal or any value other than `mg_ghost3d_ludo_v1 === '1'`; Wave B rollback (`mg_art_game_stage_wave_b_v1 === '0'`) also removes the optional bridge. Failed import, unsupported capability, render failure, context loss, reset, restore, and destroy fail closed to the DOM surface.

## Shared gates

`GATE-DEVICE-BROWSER-NETWORK` is `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`; local evidence cannot claim cross-browser/device/network verification. `GATE-ART-GOLDEN-SET` is `OPEN_BY_OWNER_AUTHORIZATION`: this historical procedural slice contains no new art, while a later original Ghost-native family may enter a reversible runtime candidate through `OWNER_AUTHORIZED_ART_CLEARANCE` without waiting for optional human/IP/Golden Set advice.
