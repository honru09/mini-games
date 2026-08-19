# Gomoku Ghost3D classic bridge contract

Status: local, default-off implementation boundary. This record does not claim browser/device visual verification.

The classic Gomoku module remains the rule and input owner. The bridge only projects frozen plain data into `Ghost3DFoundation`, accepts semantic renderer commands at the existing keyboard/ghost/local-placement seams, and leaves the Wave B canvas mounted as the permanent fallback.

## Enablement and fallback

- The slice exists only when `mg_art_game_stage_wave_b_v1` keeps Wave B active and the exact local value `mg_ghost3d_gomoku_v1 === '1'` is available.
- Missing/blocked storage, any other value, Wave A rollback, unavailable Foundation, unsupported capability, failed module load, renderer failure, context loss, reset, and destroy all leave the Canvas/D-pad path usable.
- `mg_ghost3d_gomoku_quality_v1` accepts only `HIGH`, `BALANCED`, or `LOW`; all other values start at `BALANCED`.

## Presentation seam

`gomoku-3d-frame-v1` contains a 15×15 stone projection, last move, winning cells, current local-selectability, the 0/2-turn view, optional cursor, existing Wave C process, ended state, and terminal only when the process is `terminal`. It has a bridge-local monotonic revision and no renderer, DOM, protocol, economy, replay, or AI objects.

`piece_placed` is emitted only after the frame containing that placement has been accepted. Renderer input must carry the exact currently accepted revision and may only aim, clear aim, or route selection through the existing local move function.

## Lifecycle

The bridge observes document visibility, Game Shell changes, and reduced-motion media changes and sends only Foundation lifecycle/environment messages. Terminal and reset start fresh host generations because Foundation terminal state is deliberately one-way. Import, adapter, recovery, and callback work checks the current generation; destroy disposes the host, removes its slot and listeners, and cannot revive a stale scene.
