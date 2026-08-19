# Tetris Ghost3D vertical slice P4 — frozen contract

## 1. Architecture and authority firewall

```text
committed local/AI Tetris state / accepted tetris-rule-v3 state
  -> TetrisGhost3DPresenter
  -> frozen Tetris3DFrame + optional piece_locked
  -> Ghost3DFoundation
  -> optional Three Renderer Adapter
```

There is no reverse arrow. The Presenter or Renderer may not mutate Rule,
Authority, Protocol, WebSocket, input eligibility, Replay, Reward, AI,
Economy, Profile, database, analytics, tournament, or match results.

Online P4 accepts presentation truth only after the existing strict
`tetris-rule-v3` parser has accepted and committed a snapshot. The old
`tetris-battle-authority-v1`, host relay, and `tetris_state` presentation relay
remain supported by the DOM game but are not coherent P4 3D facts. Online
optimistic mutations at an unchanged authority revision hide the optional 3D
slot until a newer accepted v3 state reconciles it.

## 2. Deep Module Interface and seam

The production caller knows one constructor and three instance methods:

```text
TetrisGhost3DPresenter.create(readModel)
  -> { commit(), snapshot(), dispose() }
```

- `readModel()` is an in-process callback owned by `tetris.js`. It returns the
  current mount, Wave B state, local/online mode, accepted authority metadata,
  reset epoch, observed player, player count, current public state, optional
  trusted lock fact, terminal, winner, quality, and reduced-motion state.
- `commit()` is synchronous at the Interface. It reads, validates, freezes,
  deduplicates, and submits the latest eligible fact; asynchronous import or
  Adapter work is private and generation-guarded.
- `snapshot()` returns only a frozen diagnostic summary. It cannot expose a
  game state, DOM node, token, raw payload, or mutable Renderer object.
- `dispose()` is idempotent and permanently invalidates the instance.

The seam is after an existing local commit or accepted authority commit. A
Renderer callback, WebSocket receive handler before validation, timer, Wave C
label, or optimistic online action is not a presentation fact.

## 3. Feature gate and DOM ownership

The Renderer may load only when both conditions are true:

```text
localStorage.getItem('mg_art_game_stage_wave_b_v1') !== '0'
localStorage.getItem('mg_ghost3d_tetris_v1') === '1'
```

Both reads are defensive. Missing storage, thrown access, exact Wave B `'0'`,
or any non-exact Ghost3D value means disabled. Disabled state must not
request the optional module.

The current `.tetris-well.main-board`, opponent mini wells, Hold/Next/Incoming,
Wave C rail, KO layer, seven DOM controls, and document keyboard handler are
permanent. The optional canvas is `aria-hidden`, `role="presentation"`,
`tabindex="-1"`, and `pointer-events:none`; it receives no `onInput`, command,
raycast, click, touch, wheel, keyboard, action, or target callback.

When ready, the slot may visually cover only the current main well's cell
paint. It may not hide the well root, KO layer, score, preview, process rail,
opponents, controls, focus indicators, or accessible names. Any untrusted
state or failure removes ready immediately so DOM cell paint is visible.

## 4. Frozen frame

Every frame is a deep-frozen plain-data projection with a Presenter-local,
strictly increasing safe-integer revision per generation:

```text
{
  kind: 'tetris-3d-frame-v1',
  revision: non-negative safe integer,
  origin: {
    source: 'local' | 'live' | 'room-restored' | 'reconnect' |
            'spectator-bootstrap' | 'reconcile',
    matchId?: non-empty string,
    authorityRevision?: non-negative safe integer,
    stateHash?: non-empty string
  },
  viewPlayer: integer 0..4,
  playerCount: integer 2..5,
  well: [18 rows of 10 cells, each 0 | 1],
  active: null | {
    kind: integer 0..6,
    rotation: integer 0..3,
    x: integer -3..9,
    y: integer -4..17
  },
  alive: boolean,
  placementSeq: non-negative safe integer,
  terminal: boolean,
  winner: integer -1..4
}
```

For accepted v3 frames, `origin.matchId`, `authorityRevision`, and
`stateHash` are copied from the accepted raw authority snapshot for the
focused player; they are never recomputed or placed on the wire. Local frames
omit authority-only guards.

The frame excludes other wells, queue, bag/seed, Hold/Next, incoming attack
IDs/times, score, lines, level, combo, B2B, T-Spin, Perfect Clear, clocks,
names, UIDs, seats, avatars, chat, controls, user text, rewards, inventory,
AI, replay, analytics, tokens, URLs, asset IDs, DOM, functions, Typed Arrays,
and Renderer objects. Existing DOM/Wave C owns those meanings.

Malformed dimensions, cells, active values, player count, focus, winner,
source, authority guard, stale revision, match mismatch, or a same-authority-
revision optimistic fingerprint mismatch may never create or retain a ready
frame. They fail closed to the DOM.

## 5. Source continuity and static reconciliation

1. Initial, reset, local restore, room restore, reconnect, spectator bootstrap,
   observed-player change, Wave B DOM rebuild, feature re-enable, replay seek,
   and context recovery create a fresh generation and a static first frame.
2. Online `live` accepts only the current match and a strictly newer authority
   revision. Duplicate/stale state is ignored. A revision gap may update a
   static frame but may not create motion.
3. In full v3 online mode, a same-revision state fingerprint change indicates
   optimistic/unaccepted state and immediately hides the optional slot until a
   newer accepted snapshot arrives.
4. Local/AI state is eligible only after the existing operation commits.
   Movement, rotation, gravity, Hold, lock, garbage, KO, and result behavior
   continue through the existing game functions.
5. A focused player's KO (`alive:false`) is not whole-match terminal. Frame
   `terminal:true` comes only from the committed match `over` fact. A terminal
   Foundation host is one-way; a new match gets a new generation.

## 6. One semantic motion

The only Renderer motion event is:

```text
{
  type: 'piece_locked',
  revision: target Tetris3DFrame.revision,
  eventId: generation + ':' + revision + ':' + viewPlayer + ':' + placementSeq,
  player: integer 0..4,
  kind: integer 0..6,
  rotation: integer 0..3,
  x: integer -3..9,
  y: integer -4..17,
  cleared: integer 0..4
}
```

It is emitted once after its target frame is accepted and only when:

- source is committed `local` or current-match consecutive `live` v3;
- the focused player did not change;
- placement sequence increased exactly by one;
- the trusted local lock fact or accepted v3 `lastEvent.type === 'lock'`
  supplies valid kind/rotation/x/y/cleared values consistent with the target;
- target is not match-terminal and the focused player is alive; and
- the host is HIGH/BALANCED, visible, active, non-reduced, ready, and not in
  fallback.

Initial state, active movement/rotation/fall, Hold, incoming warning, garbage,
KO, score chain, revision gap/duplicate/stale/malformed state, reconnect,
restore, spectator bootstrap, focus switch, replay seek, terminal, hidden,
LOW, reduced motion, fallback, and failure always snap. Wave C remains the
owner of lock/line-clear/combo/B2B/T-Spin/Perfect-Clear/garbage text sequence.

## 7. Motion, performance, and Renderer contract

The Three Adapter exports only a support predicate and factory. The factory
receives mount, ready/error/context-loss callbacks, quality, and
reduced-motion; it receives no game instance, Rule Core, socket, player
identity, command callback, or asset URL.

- One Adapter, one canvas, one scene, and one observed well.
- At most 180 locked cells plus four active cells. Use bounded
  InstancedMesh/object pools; do not allocate meshes or timelines per tick.
- HIGH owns at most one finite GSAP Core/Timeline sequence
  `focus -> impact -> settled`. BALANCED is lighter. LOW and reduced motion
  own zero timelines and paint final state immediately.
- The sequence may emphasize the verified lock position and final board; it
  may not invent a fall trajectory or cleared-row history not present in the
  trusted fact.
- Rendering is on demand except during the single finite motion. DPR is
  bounded by quality. Resize/orientation is coalesced to one animation frame.
- No CSSPlugin, ScrollTrigger, Club plugin, loader, GLB, texture, CDN, ambient
  loop, repeat/yoyo, particle loop, DOM layout tween, or per-frame timeline.
- New state, suspend, context loss, generation replacement, and dispose kill
  the active timeline. Resume and recovery reconcile the latest frame
  statically and never replay dropped motion.

## 8. Lifecycle, DOM rebuild, and failure

One Presenter host owns a monotonically increasing generation. One Renderer
Adapter owns a separate epoch. Reset/new match, match change, restore,
reconnect, spectator bootstrap, focus change, Wave B root replacement,
terminal-to-new-match, feature-off, authority trust loss, context recovery,
and dispose invalidate stale work before a replacement may mount.

Late import, ready/error/first-render, GSAP completion, ResizeObserver,
orientation callback, context recovery, or queued frame from an old
generation/epoch is a no-op. First ready is reported only after the first real
render succeeds.

Any support/import/mount/first-render/later-render/context/resource cleanup
failure hides the optional slot, disposes partial resources, restores DOM cell
paint, and leaves the game running. Disposal is idempotent and removes the
canvas, loop, observers, listeners, timelines, geometries, materials, and
Renderer resources owned by the Adapter.

## 9. Art, external gates, and release

P4 is procedural/code-native only. It may use the pinned Three r185 and GSAP
3.15 Core already present in the repository, but this batch adds no runtime
asset, GLB, image, texture, manifest entry, or reference-only source. The Art
Gate is `OPEN_BY_OWNER_AUTHORIZATION`; a later original family may obtain
`OWNER_AUTHORIZED_ART_CLEARANCE`, while optional human/IP/Golden Set advice is
not a development prerequisite.

`GATE-DEVICE-BROWSER-NETWORK` and `GATE-SUPABASE-PRODUCTION` are
`NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`. Missing second
browser, physical Android/iPhone/Tablet/touch, real network, low-end performance
or production data evidence cannot be claimed complete, but does not stop local
work. This contract grants no commit, push, deploy, or release authority.
