# Monopoly Ghost3D vertical slice P2 — semantic contract

Status: `FROZEN CONTRACT / IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL`. The
requirements below now govern the local implementation in
`public/src/games/monopoly.js` and `public/three/monopoly-entry.js`; they do not
claim production, cross-device, approved-art or release completion.

## 1. Module, Interface and Seam

`Ghost3DFoundation` remains the only shared deep **Module**. Its external
**Interface** is unchanged:

```text
Ghost3DFoundation.create(options) -> { apply, snapshot, dispose }
```

The Monopoly game owns a private frame-builder/bridge implementation. Its
single **Seam** is deliberately narrow:

```text
committed local Monopoly state
  OR accepted MonopolyPresentationAdapter frame (online)
      -> frozen Monopoly3DFrame + optional semantic motion
      -> Ghost3DFoundation.apply(...)
      -> replaceable Monopoly Three Adapter
```

For online games, the seam occurs only after
`MonopolyPresentationAdapter.consume(...)` accepts the existing
`monopoly-rule-v2` authority state. For local games, it occurs only after the
existing game logic has committed a legal state change. It is never before
action validation, never in a renderer callback, and never in a WebSocket
handler that has not passed the current validator.

The future renderer ESM island must expose only:

```text
VERSIONS                    // frozen provenance record
isMonopoly3DSupported()     // boolean capability check
createMonopoly3DAdapter(options)
```

The resulting Adapter implements the Foundation lifecycle surface
`mount/render/motion/setQuality/environment/suspend/resume/contextLost/dispose`.
It must not export `createAdapter`, a rule helper, an input helper, a global
renderer singleton or any asset loader API.

## 2. Enablement, DOM ownership and the only legal inputs

The renderer is exact opt-in only when both conditions hold:

```text
mg_art_game_stage_wave_b_v1 !== '0'
mg_ghost3d_monopoly_v1 === '1'
```

Blocked/missing storage, read failure, all other flag values, unsupported
WebGL/module failure, failed first render and context loss all mean DOM-only
Wave B. `mg_ghost3d_monopoly_quality_v1` may accept only `HIGH`, `BALANCED` or
`LOW`; invalid/missing input resolves to `BALANCED` and never turns the feature
on by itself.

There are **zero renderer-originated game commands** in P2. The optional 3D
canvas/overlay is `aria-hidden` and `pointer-events:none`; Foundation receives
no Monopoly `input` message and no `onInput` callback is installed.

| Existing action | Sole owner in P2 | Renderer rule |
| --- | --- | --- |
| Roll | Existing Wave B DOM dice/`rollBtn` → current `roll()`/Rule Authority path | Cannot roll, show a clickable die, intercept a pointer, or synthesize RNG. |
| Buy / pass | Existing DOM action-row buttons → current `applyDecision()`/`sendMonopolyAction()` path | Cannot use a board cell or token click to buy/pass. |
| Bid | Existing DOM auction buttons → current authority action path | Cannot submit/retry a bid or close an auction. |
| Auction close | Existing server deadline/Rule Authority | Must only repaint accepted state; never use a visual timer as an authority timer. |
| Early settle | Existing host-only DOM path | No renderer control or terminal shortcut. |

Consequently, a renderer completion, animation label, raycast, pointer event,
timer, `onReady`, `onError`, context recovery or visibility callback can never
call `roll`, `applyDecision`, `sendMonopolyAction`, `sendMonopolyBid`,
`sendMove`, `onProgress`, `creditGame`, or any equivalent mutation.

## 3. Frozen semantic frame

The bridge sends a deep-frozen plain-data frame only after it has passed its
source-specific guards. It uses a bridge-local, strictly increasing Foundation
revision; this revision is never written back to a rule snapshot or protocol.

```text
Monopoly3DFrame v1 = {
  kind: 'monopoly-3d-frame-v1',
  revision: non-negative safe integer,                 // bridge-local
  origin: {
    source: 'local' | 'live' | 'room-restored' | 'reconnect' |
            'spectator-bootstrap',
    matchId?: non-empty string,                         // internal guard only
    authorityRevision?: non-negative safe integer,      // online only
    stateHash?: non-empty string                         // online only
  },
  board: {
    cellCount: 24,
    cells: [{ index: 0..23, type: 'go'|'chance'|'prop'|'tax'|'rest',
              ownerPlayerId: -1 | 0..4 }]
  },
  players: [{
    playerId: 0..4,
    seatId: 0..4,
    authorityPosition: 0..23,
    displayPosition: 0..23,
    visible: boolean,
    state: 'idle'|'moving'|'event'|'purchase'|'auction'|
           'turn'|'bankrupt'|'winner'|'settled',
    facing: 'north'|'east'|'south'|'west',
    publicCharacter: {
      schemaVersion: 'player-character-v1',
      characterId: string,
      slots: { body, face, hair, top, bottom, footwear, accessory }
    },
    renderMode: 'code-fallback'
  }],
  turn: {
    activePlayerId: 0..4,
    phase: 'roll'|'resolving'|'moving'|'buy'|'chance'|'auction'|
           'done'|'finished'
  },
  process: { stage: 'roll'|'walk'|'land'|'buy'|'event'|'auction'|
                     'trade'|'turn-end' },
  auction: { active: boolean },
  standings: [{ playerId: 0..4, rank: positive safe integer }],
  terminal: boolean,
  winnerPlayerId: -1 | 0..4
}
```

The bridge rejects malformed input and fails closed to Wave B when the player
collection is not exactly 2–5 contiguous player/seat entries, a position is
outside `0..23`, a cell owner is invalid, the phase/process vocabulary is
unknown, or an online source was not accepted by the existing presentation
adapter. Player/seat mapping is positional only; it must never infer identity
from nickname, avatar, colour, UID or display text.

The frame deliberately excludes `money`, property price, bid amount, dice
value/RNG, chance-card text, property names, user text, profile URLs, owned
inventory, purchase history, token/PIN/password, reward/XP, AI state, action
IDs, move log, Replay, analytics and database objects. DOM HUD/state controls
continue to present localized amounts, text and countdowns.

`publicCharacter` is the existing public `player-character-v1` whitelist only.
Unknown/missing/invalid seats collapse to the current code fallback, and an
adapter has no asset ID/path to resolve. ART-036 source material is not a
valid frame value.

## 4. Revision, source continuity and terminal rules

1. A bridge generation owns one Foundation host. Within that generation every
   accepted changed frame gets a strictly higher `revision`; duplicate frame
   fingerprints do not create an extra revision or motion.
2. In an online live update, `origin.matchId`, `authorityRevision` and
   `stateHash` must come from the already accepted
   `MonopolyPresentationAdapter` frame. Its stale/revision-gap/transition
   decision is final. P2 may not relax it or guess a missing move.
3. `room-restored`, `reconnect` and `spectator-bootstrap` establish a fresh
   generation and emit a static snap frame. They do not replay dice, movement,
   chance, purchase, auction or history, including when a numeric authority
   revision happens to be adjacent.
4. A local movement source may use only the already committed local
   `movePlayer` result. It must still meet the same 24-cell and step rules;
   it cannot be constructed from a die face, chance text or visual timer.
5. `terminal:true` is emitted only from actual terminal game fact:
   online `state.terminal || authority.terminal`, or local `over === true`.
   It must **not** be inferred from `winnerPlayerId`, `phase === 'finished'`,
   `process === 'turn-end'`, an empty action row, a countdown or animation
   completion. A terminal Foundation host is one-way.
6. Reset/new match, match change, reconnect/bootstrap, terminal-to-new-match,
   Wave B rollback, feature disable, context loss recovery and dispose all
   invalidate the old generation before any new frame may mount. Late dynamic
   import, adapter ready/error, render, GSAP completion and recovery callback
   from an old generation is a no-op.

## 5. One semantic motion and no inferred choreography

There is one possible P2 motion event:

```text
{
  type: 'token_moved',
  revision: current accepted Monopoly3DFrame.revision,
  eventId: generation + ':' + revision + ':' + actorPlayerId + ':' + from + ':' + to,
  actorPlayerId: 0..4,
  from: 0..23,
  to: 0..23,
  steps: -2 | 2..12,
  direction: -1 | 1
}
```

It is emitted once, only after its target frame has been accepted, only for a
current-generation live/local transition whose prior authoritative position,
`from`, `to`, signed `steps` and circular 24-cell arithmetic all agree. For
online state this is exactly the existing accepted
`MonopolyPresentationAdapter.frame.animation.mode === 'step'` case. A first
frame, reconnect, spectator bootstrap, revision gap, malformed/duplicate
transition, reduced motion, hidden/suspended state, fallback, terminal or
failed renderer produces `mode:'snap'` and no motion event.

The Adapter may have no more than one active GSAP composite timeline. In HIGH
it may label one `focus -> travel -> land -> settled` sequence; in BALANCED it
may use at most the same single actor-only sequence with a static camera; LOW,
reduced-motion and FALLBACK have zero active timelines and immediately render
the final frame. Dice, purchase, payment, chance, auction, trade and result
are frame/state changes only, not new renderer motion types.

Only Adapter-owned Three camera, camera-aim proxy and current token mesh
transforms may be tween targets. The implementation uses GSAP core/timeline
inside the renderer island only, with transform-like generic-object values;
it must not import CSSPlugin, ScrollTrigger, a Club plugin, a second GSAP
copy, or animate DOM layout. No repeat, yoyo, ambient loop, particle loop or
per-frame timeline creation is allowed. A new frame/motion kills the previous
adapter-local handle before applying current semantic state.

## 6. Quality, lifecycle, failure and cleanup

| Condition | Required behavior |
| --- | --- |
| First mount | Create an optional slot above/alongside the retained Wave B board. `ready` becomes true only after first successful renderer render; no input is ever captured. |
| HIGH / BALANCED / LOW | Respect the existing quality ladder; LOW is static/on-demand. Quality change cannot change the flag or game state. |
| Reduced motion | Send `environment.reducedMotion=true`, kill any active timeline and render an immediately understandable static final frame. |
| Document hidden / Game Shell inactive | Send `hidden`/`suspend`, stop adapter-local animation/render loop and preserve only the latest frame. |
| Visible / resume | Reconcile the latest frame statically; never replay a motion dropped while hidden. |
| Import/WebGL/mount/render failure | Set optional slot not-ready, dispose partial resources, retain DOM Wave B and continue the game. |
| Context loss | Stop motion/render, signal Foundation `context-lost`, retain DOM; recovery requires a fresh current-generation Adapter and latest frame, never old WebGL objects. |
| Reset/restore/destroy/feature-off | Kill scoped GSAP work, revert its scoped context, stop loop, remove listeners/observers/slot, dispose only owned Three resources and reject late callbacks. |

The adapter has no global GSAP side effect, no global ticker mutation and no
blanket kill of other UI animations. It must not add a Service Worker install
shell dependency: the prospective entry, Three and GSAP stay demand-loaded and
may cache only after a successful request under the current cache policy.

## 7. Authority, safety and art firewall

```text
Rule / Authority / Protocol
  -> existing MonopolyPresentationAdapter or committed local state
  -> Monopoly3DFrame + token_moved (plain data)
  -> Ghost3DFoundation
  -> optional Three Adapter
```

There is no permitted reverse arrow. The renderer, GSAP, a visual dice, a
camera, a timer, input hit test, ready signal or asset failure cannot mutate
Rule, Authority, protocol, Replay, Reward, AI, economy, player profile,
database or UI control eligibility.

P2 is procedural/code-native only and grants no per-asset art clearance.
ART-036 images, models or textures remain source-only until they obtain
`OWNER_AUTHORIZED_ART_CLEARANCE`; after that, a separately owned reversible
integration may add a Manifest entry and default-on candidate with fallback and
kill switch. Human cleanup, Reviewer B, IP/legal advice and Golden Set are
optional advisory evidence. No still-source-only/reference-only or external
blocked-license asset may enter `public/assets`, the renderer, Manifest or a
shop/profile path through this slice.
