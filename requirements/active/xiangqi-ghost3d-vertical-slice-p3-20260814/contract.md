# Xiangqi Ghost3D vertical slice P3 — frozen contract

## 1. Architecture and authority firewall

```text
committed local Xiangqi move / accepted xiangqi-rule-v2 snapshot
  -> frozen Xiangqi3DFrame + optional piece_moved (plain data)
  -> Ghost3DFoundation host
  -> optional Three renderer adapter
```

There is no reverse arrow. The renderer, its canvas, camera, GSAP work,
quality selection, first-ready signal, visual timer, failure, or context
recovery must not mutate Rule, Authority, Protocol, DOM input eligibility,
Replay, Reward, AI, clock UI, Economy, profile, database, telemetry, or
network state.

The server remains the sole authority for online Xiangqi. P3 may read a raw
accepted snapshot before the current client flattens it for `onRestore()`; it
must not revalidate, alter, delay, reject, or replace the existing DOM restore
path. If the optional bridge cannot accept a projection, it fails closed to
the existing DOM board only.

## 2. Feature gate, host, and renderer ownership

The sole renderer-enable condition is:

```text
localStorage.getItem('mg_ghost3d_xiangqi_v1') === '1'
```

The read is defensive. Missing `window`, missing storage, thrown storage
access, or every non-exact value means disabled and must not lazy-load the
renderer. The flag is local presentation state; it never enters a snapshot,
serialized game state, protocol message, Replay, Reward, AI, or persistence.

The prospective renderer exports only a support predicate and adapter factory
(for example, `isXiangqi3DSupported()` and `createXiangqi3DAdapter(options)`).
The factory receives a mount element, ready/error/context-loss callbacks,
quality, and reduced-motion state. It receives no `onInput`, `emitInput`,
command callback, game instance, Rule Core, WebSocket, or player identity.

Its canvas is always `aria-hidden`, presentational, unfocusable, and pointer
transparent. The retained `.xiangqi-board` remains the sole click, keyboard,
and touch route for selection and movement. Spectators remain read-only via
the existing DOM/authority checks; the renderer cannot weaken those checks.

## 3. Frozen semantic frame

Every frame is a deep-frozen, plain-data projection with a bridge-local,
strictly increasing non-negative safe-integer `revision` per host generation:

```text
{
  kind: 'xiangqi-3d-frame-v1',
  revision: non-negative safe integer,
  origin: {
    source: 'local' | 'live' | 'room-restored' | 'reconnect' |
            'spectator-bootstrap',
    matchId?: non-empty string,
    authorityRevision?: non-negative safe integer,
    stateHash?: non-empty string
  },
  board: [10 rows of 9 cells, each null | { p: 0 | 1, t: 'k'|'a'|'e'|'h'|'r'|'c'|'p' }],
  current: 0 | 1,
  moveNumber: non-negative safe integer,
  lastMove: null | {
    from: [row 0..9, col 0..8],
    to: [row 0..9, col 0..8],
    capture: null | { p: 0 | 1, t: 'k'|'a'|'e'|'h'|'r'|'c'|'p' }
  },
  check: boolean,
  terminal: boolean,
  winner: -1 | 0 | 1
}
```

Online `origin.matchId`, `origin.authorityRevision`, and `origin.stateHash`
are transient guards copied from the already accepted raw authority snapshot
(`matchId`, `revision`, and `hash`). They are not a new wire field and may not
be recomputed client-side. For local play, `origin.source:'local'` may omit
those online-only guards.

The frame excludes clock values and clock copy, reason text, names, UIDs,
avatars, seats, controls, user text, raw chat, rewards/XP, ownership,
inventory, action IDs, move log, Replay, AI data, analytics, database objects,
tokens, credentials, asset IDs, URLs, and renderer objects. The DOM Canvas and
HUD remain the owners of localized labels, selected/legal cells, clock UI, and
social presentation.

Malformed board dimensions, invalid coordinates/piece values, invalid current
or winner, invalid online origin, mismatched match ID, stale revision, or a
missing required raw authority guard may never construct a renderer frame.
They leave the existing DOM state untouched and make the optional renderer
static/unready or fall back.

## 4. Source continuity, restore, and terminal rules

1. The raw online snapshot must be observed before `onXiangqiRuleState()`
   flattens away `revision`, `hash`, `lastMove.capture`, and reason. The
   renderer bridge preserves only its allowed transient projection.
2. A first frame is static. `room-restored`, `reconnect`, and
   `spectator-bootstrap` always create a fresh host generation and static
   frame; they never replay the last move merely because revisions are
   numerically adjacent.
3. A live online frame may be accepted only for the current match and a
   strictly newer authority revision. A revision gap may update a static
   current frame, but must never manufacture history or a motion. Duplicate
   and stale frames do not create a new bridge revision or renderer motion.
4. A local frame may be built only after `doMove()` has committed a legal local
   move. Online optimistic DOM movement is not a local renderer motion source;
   it waits for the accepted authority snapshot.
5. `terminal:true` comes only from a committed local terminal fact or the raw
   authority terminal fact. It must not be inferred from check, winner text,
   clock process, a result message without board state, empty actions, or an
   animation completion. A terminal Foundation host is one-way. A new game
   gets a new generation before receiving its first frame.

## 5. One semantic motion

The only renderer motion event is:

```text
{
  type: 'piece_moved',
  revision: current accepted Xiangqi3DFrame.revision,
  eventId: generation + ':' + revision + ':' + player + ':' + from + ':' + to,
  player: 0 | 1,
  from: [row, col],
  to: [row, col],
  capture: boolean
}
```

It is emitted once, only after its target frame was accepted, and only when:

- the source is current-generation `live` or committed `local`;
- online authority revisions are consecutive and refer to the same match;
- the prior board's source piece exactly equals the next board's target piece;
- the next board's source is empty;
- `lastMove.from`/`to` equal the changed coordinates; and
- `lastMove.capture` exactly agrees with the prior target cell, or both are
  empty/null.

Capture is a property of `piece_moved`, not a second event type. The following
always snap and produce no event: initial state, reset/restore/reconnect,
spectator bootstrap, revision gap/duplicate/stale state, malformed state,
terminal target, reduced motion, hidden/suspended host, LOW quality, fallback,
or renderer failure.

## 6. Motion, quality, and performance

The adapter owns at most one active GSAP composite timeline. In HIGH it may
use a finite `focus -> travel -> capture-or-settle -> settled` sequence. In
BALANCED it may use a lighter version with a static or simpler camera. LOW and
reduced-motion use zero active timelines and paint the final frame directly.

Only adapter-owned Three camera/proxy and current piece mesh transform-like
values may be animated. GSAP Core/Timeline are confined to the renderer
island. No ScrollTrigger, CSSPlugin, Club plugin, second GSAP copy, ambient
loop, repeat/yoyo loop, particle loop, per-frame timeline creation, or DOM
layout-property animation is allowed. New accepted state, suspend, context
loss, generation replacement, and dispose kill the active timeline.

Rendering is on-demand except while the single finite motion is active.
Hidden document or inactive Game Shell suspends the adapter and stops local
render/motion work; resume reconciles the latest frame statically, never
replays a dropped motion. Resize/orientation work must be coalesced and
released on dispose.

## 7. Lifecycle, DOM rebuild, failure, and cleanup

One bridge host owns one monotonically increasing generation. One adapter
inside that host owns a separate adapter epoch. Reset/new match, match change,
room restore, reconnect, spectator bootstrap, terminal-to-new-match,
feature-off, context loss/recovery, and destroy invalidate the relevant old
generation/epoch before a replacement may mount.

Late dynamic import, renderer ready/error, first render, GSAP completion,
ResizeObserver callback, context recovery, or queued frame from an old
generation/epoch is a no-op. A context-loss recovery uses a fresh adapter and
the latest frame statically; it may not retain old WebGL resources or replay a
move.

`xiangqi.js` currently rebuilds the Arena/board during render. P3 must either
safely preserve and reparent the optional mount across that DOM rebuild or
dispose it before removal and create a fresh current-generation mount. It may
not leave a detached canvas, stale observer, listener, or host behind.

Any support/import/mount/first-render/render/context/resource-cleanup failure
sets the optional slot unready, disposes partial Three/GSAP resources, and
continues the DOM game. Adapter disposal is idempotent and removes animation
loops, context/resize listeners, observers, canvas, owned geometry/materials,
and scoped GSAP context only.

## 8. Art and external gates

P3 is procedural/code-native: this batch adds no GLB/glTF, TextureLoader,
model loader, runtime asset path, manifest entry, or source-only/reference-only
art. ART-036 is a Monopoly-specific source candidate and cannot justify any
Xiangqi runtime asset. The Art Gate is `OPEN_BY_OWNER_AUTHORIZATION`; a future
Xiangqi-original family requires its own `OWNER_AUTHORIZED_ART_CLEARANCE`, and
optional human/IP/Golden Set advice is not a development prerequisite.

`GATE-DEVICE-BROWSER-NETWORK` and `GATE-SUPABASE-PRODUCTION` are
`NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`. Second browser,
Android, iPhone Safari, tablet, real network, low-end performance and production
data remain unverified rather than development blockers. This contract grants
no commit, push, deployment, or release authority.
