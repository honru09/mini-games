# Audio cue migration matrix — P1 audit (2026-08-17)

This is a read-only audit of the current source tree.  It does not change game
rules, wire messages, replay payloads, rewards, or generated `public/index.html`.
The migration rule is: validate authority and action legality first, commit the
accepted state transition second, then emit one presentation-only semantic cue.
An invalid input, spectator input, stale online input, or rejected rule action
must not produce sound or haptics.

## Current audio seams

| Seam | Current source | Current behavior | Migration decision |
| --- | --- | --- | --- |
| Legacy WebAudio | `public/src/core/01-utils.js:30-57` (`sfx`) | Creates a global `AudioContext`; eight fixed tones; resumes from any call; no master/SFX/music volume or lifecycle. | Keep only as a compatibility fallback while callers move to the semantic adapter; do not add new callsites. |
| Legacy haptics | `public/src/core/01-utils.js:60-65` (`haptic`) | Direct `navigator.vibrate`; no preference gate or visibility/reduced-motion policy. | Route through the unified adapter; retain a guarded no-op fallback for unsupported browsers. |
| Legacy semantic wrapper | `public/src/core/01-utils.js:68-80` (`playFeedback`) | Maps seven generic names to `sfx`/`haptic`; no dedupe or rate limit. | Replace game callsites with semantic `FeedbackBus` events. Keep wrapper only for compatibility during rollout. |
| Global button listener | `public/src/core/01-utils.js:82-86` | Every `.btn` click calls `sfx('click')`, including buttons that also trigger a game cue. | Remove/disable after adapter is active. This is a duplicate path and can fire for rejected handlers because it runs at DOM click level. |
| Outcome helper | `public/src/core/01-utils.js:618-631` | `showVictoryOverlay` calls `sfx('win')` or `sfx('pop')` while constructing the overlay. | Make terminal cue explicit and once-per-match; do not play from a render function or overlay reconstruction. |
| Existing bus | `public/src/core/15-feedback-bus.js:28-52` | Default-off, whitelisted platform + six-game cue types, immutable records, local id dedupe and 1-second rate limit. | Use as the only semantic source. The vocabulary is now broad enough for this matrix; keep additions explicit and synchronized with every adapter. |
| Tank adapter | `public/src/core/17-local-feedback-adapter.js:379-395` | Handles only `tank_fire` and `tank_hit`; explicit unlock; max 8 voices; optional pan/haptics. | Retire or wrap behind the unified adapter once all games use one lifecycle and preference surface. |
| Unified adapter (working tree) | `public/src/core/21-unified-feedback-adapter.js:24-61,169-196` (untracked at audit time) | Its `CUE_TYPES` now mirrors the expanded bus; only a subset has dedicated tone arrays and the rest use `GENERIC_TONES` at line 172. | Treat as implementation under review. Keep bus/adapter allow-lists synchronized and decide/verify each generic fallback against the product sound direction before default-on. |

## Cue vocabulary contract

The bus vocabulary at `public/src/core/15-feedback-bus.js:31-50` already contains
platform cues and dedicated entries for all six games.  The unified adapter must
mirror that allow-list and provide an intentional tone/variant for each type.
`GENERIC_TONES` may be a safe temporary fallback, but it must be audibly reviewed
per cue family and never be mistaken for final authored sound design.  IDs must
be deterministic for a committed transition and must not include player text,
chat, token, or full state.

| Semantic cue | Existing bus type | Source event | Required channels | Notes |
| --- | --- | --- | --- | --- |
| Gomoku accepted placement | `gomoku_place` | `gomoku.js:1493-1500` | SFX + light haptic | Emit after `grid/hist/last` commit at line 1499. Terminal placement may additionally emit `match_terminal`, once. |
| Ludo accepted dice roll | `ludo_roll` | `ludo.js:1209-1219`, accepted branch | SFX | Current `sfx('pop')` is before all guards and is wrong for rejected attempts. Emit after `applyDice` accepts, ideally at `ludo.js:1221-1228`, with a deterministic roll ID. |
| Ludo accepted token move | `ludo_move` | `ludo.js:1260-1308` | SFX + light/medium haptic | Emit after token/capture state commit. Current call at line 1308 is correctly after mutation but before terminal branching; keep one cue and encode `intensity` for capture/takeoff/home. |
| Ludo capture | `ludo_capture` or `ludo_move` with intensity | `ludo.js:1275-1285` | SFX + strong haptic | A distinct capture timbre is preferable. If the adapter uses one move tone, retain one `ludo_move` event with `id` and intensity, not generic `capture`. |
| Gomoku/Ludo/Monopoly/Xiangqi/Tank/Tetris terminal | `match_terminal` | each game terminal commit | SFX + haptic, once | Event should carry result kind only through a non-sensitive variant field if the adapter contract supports it; otherwise use deterministic win/complete IDs and adapter variant selection. Do not emit from repeated `render()`. |
| Monopoly accepted roll | `monopoly_roll` | `monopoly.js:1453-1463` / authority action | SFX | Current `sfx('pop')` at line 1457 is after local guards, but is still a legacy direct path and fires before server acceptance in full authority mode. Emit on accepted local `applyRoll` or authoritative roll receipt. |
| Monopoly accepted walk/land | `monopoly_land` | `monopoly.js:1485-1529` | SFX, low-rate/coalesced | One cue per committed move or a capped step cadence; never one unrestricted cue per animation frame. |
| Monopoly buy/pass/auction/event | `monopoly_purchase`, `monopoly_pay`, `monopoly_auction`, `monopoly_bankrupt` | `monopoly.js:1593-1618`, auction handlers `1770-1785` | SFX | Emit only after local commit or authoritative receipt. Current full-rule branch returns at line 1596 before the legacy cue. |
| Tank accepted movement | `tank_move` | `tank.js:538-553` and input paths `713-749` | Optional SFX/haptic, heavily coalesced | Type is already whitelisted but never emitted. Emit on an accepted direction transition or fixed low-rate movement beat, not every 50 ms simulation tick. |
| Tank fire | `tank_fire` | `tank.js:555-568`, authority receipt `1399-1400` | SFX + medium haptic + pan | Existing semantic path is correct for local and receipt paths. Keep one source per accepted shot; ensure local prediction does not also emit the same authority receipt. |
| Tank hit/KO | `tank_hit` plus terminal | `tank.js:570-590`, authority receipt `1399-1400` | SFX + strong haptic + pan | Existing local `tank_hit` and authority receipt paths need the same event ID/dedupe contract. The KO fallback at line 585 is generic and should become a terminal/KO cue. |
| Tetris movement/rotation/drop | `tetris_move` | `tetris.js:682-718` | SFX, optional haptic | Emit only when `moveActive`, `rotateActive`, or `softDrop` returns true; coalesce repeated keyboard movement. |
| Tetris lock | `tetris_lock` | `tetris.js:639-680` | SFX + light haptic | Emit after `lockInto`/state commit succeeds at lines 651-676. |
| Tetris line clear / scoring tier | `tetris_line_clear` | `tetris.js:653-676` | SFX + haptic | Intensity/variant from `scoring.clearType`, but do not include raw board state. Perfect clear/T-spin/B2B can select a local variant if separately represented. |
| Tetris KO | `tetris_ko` (new) or terminal | `tetris.js:738-756` | SFX + strong haptic | Current `playFeedback('capture')` at line 749 is semantically wrong. Use a game-specific KO type or terminal variant. |
| Xiangqi accepted move | `xiangqi_move` | `xiangqi.js:1259-1313` | SFX + light haptic | Current call at line 1270 is after legality but before board mutation; move it after lines 1279-1283. |
| Xiangqi capture | `xiangqi_capture` (new, preferred) or `xiangqi_move` intensity | `xiangqi.js:1269-1274` | SFX + medium haptic | Avoid the generic `capture` wrapper; type/intensity must be stable. |
| Xiangqi check/terminal | `xiangqi_check` / `match_terminal` (new + existing) | `xiangqi.js:1293-1310`, `1341-1351` | SFX + haptic | Emit once at state transition. Clock loss uses `lose()` and must share the same terminal guard. |

## Six-game migration matrix

### Gomoku

- Accepted action gate: `public/src/games/gomoku.js:1493-1497` checks `over`, integer bounds, and empty cell before mutation.
- Current cue: `playFeedback('place')` at `1498`; it is already after validation but before the state commit at `1499`.
- Safe migration: commit `grid[r][c]`, `last`, and `hist` first, then emit `gomoku_place` with ID such as `gomoku-place:<match-or-local-session>:<hist-length>:<r>:<c>`. Do not put coordinates into a persistent/replay payload; the ID is local adapter state only and can be bounded.
- Terminal: win/draw branches begin at `1503` and `1519`; they call `opts.onEnd` and `showGomokuOutcome` (`549-557`, `1513-1531`). The overlay helper currently supplies the only terminal sound. Replace with one `match_terminal` transition cue before/alongside the overlay and guard it by match epoch.
- Undo: `1548-1559` changes state without feedback. Optional future `gomoku_undo` should be added only if product wants it; it is not required for P1.
- Input ordering: pointer and keyboard both funnel through `placeLocalGomokuMove` → `applyMove`; this is the correct single migration point.

### Ludo

- Roll hazard: `roll()` at `public/src/games/ludo.js:1209-1219` calls `sfx('pop')` before spectator/over/phase/turn/AI guards (`1211-1214`). Invalid clicks therefore produce sound. Remove this direct call and emit only from accepted `applyDice` (`1220-1246`) or from the authoritative accepted receipt.
- Token gate: `applyPick()` validates at `1248-1264`, commits movement/capture at `1265-1285`, then calls `playFeedback` at `1308`. Preserve this one-point ordering and replace it with `ludo_move`/`ludo_capture`.
- Roll animation: `applyDice` changes phase at `1224`, then calls `dice3d.roll` at `1230`; a roll cue should fire once at accepted roll, not once per animation frame. If audio timing should match the reveal, queue a presentation-only follow-up from the callback with the same cue ID, never a second semantic event.
- Terminal: `over/winner` and `opts.onEnd` are set around `1309-1324`; `revealLudoOutcome` calls the global overlay at `103-110`, possibly after a renderer delay (`112-130`). Terminal sound must be tied to the committed transition, not delayed overlay construction.

### Monopoly

- Roll gate: `roll()` validates authority/spectator/over/phase/turn/AI at `1453-1456`, then calls `sfx('pop')` at `1457`. This is safe from invalid local clicks but not from server rejection: full-rule mode sends an action and returns at `1459` before `applyRoll`. Move the cue to accepted `applyRoll` or the server rule receipt.
- Full-rule decision gap: `applyDecision()` returns after sending the authoritative action at `1596`, so the current `playFeedback` at `1600` is skipped online. A unified adapter must consume the authoritative accepted transition, not the click handler.
- Local decision ordering: fallback `applyDecision` checks phase/pi/decision at `1593-1599`, then emits at `1600` before money/owner mutation (`1602-1608`). Move the semantic cue after the mutation or emit from a single post-commit helper.
- Board effects currently have no cues: movement animation `1485-1529`; cell resolution (go/rest/tax/chance/property/rent) `1530-1592`; auction controls `1770-1785`. These are safe seams after authority transitions, with rate-limited walk cues.
- Terminal timing is partly guarded: `renderBoard()` queues `showVictoryOverlay` at `1426-1429`, and `settle()` coordinates the settlement modal at `1745-1760`. The shared `showVictoryOverlay` still calls `sfx` at `01-utils.js:631`; keep the once-per-epoch guard in the game and move the audible cue to the semantic terminal transition rather than overlay construction.

### Tank

- Feedback initialization/ownership: `tank.js:37-40`, `125-156` creates a per-game bus/adapter behind feature flags `feedbackBusV1`, `tankSpatialAudioV1`, and `hapticsV1`; `resetTankFeedback`/`disposeTankFeedback` are at `136-142`.
- Local fire: `fireTank()` commits cooldown, shot count, bullet and muzzle effect at `555-563`, then emits `tank_fire` at `564`. This is the best accepted-action order.
- Local hit/KO: `damageTank()` commits HP at `570-577`, emits `tank_hit` at `578`, then commits KO at `579-586`; line `585` emits generic `capture` only when the Tank bus is absent. Keep hit once, add explicit KO/terminal semantics, and ensure local predicted hit is deduped against any authoritative receipt.
- Authority receipt: `onAuthoritySnapshot` emits fire/hit on deltas at `1399-1400`. The event ID must be derived from server tick/seat/shot/death as it is now, and the same ID must be recognized by the unified adapter. Do not emit from raw input.
- Movement: `moveTank()` updates position at `538-553`; no `tank_move` event is emitted. D-pad/joystick paths (`867-889`) update input; direct haptic fallbacks at `802` and `818` fire on UI state changes, not accepted game actions. Route these through preferences and emit at a bounded accepted movement seam.
- Unlock/lifecycle: `unlockTankFeedback()` is called from user gestures (`869`, `877`, `892`, `889`), while visibility/blur cleanup is `896-898`. Preserve explicit gesture unlock and dispose on game destroy; do not create/resume an `AudioContext` during module evaluation.
- Outcome: `showVictoryOverlay` is called from render at `1240`; replace its implicit sound with a one-shot terminal event at `finishMatch` (`672`) or a guarded first terminal render.

### Tetris

- There is no `FeedbackBus`/local adapter integration in the module. Existing semantic coverage is only `playFeedback('capture')` for KO at `749`.
- Accepted movement seams: `moveActive` (`682-686`), `rotateActive` (`687-691`), `softDrop`/`hardDrop` (`693-703`), and `hold` (`705-708`). Each returns false on rejected input; emit `tetris_move` only after the successful state change. Keyboard dispatch is centralized at `710-731`, so do not attach audio to DOM `keydown` separately.
- Lock/line clear seam: `applyPlacement` validates collision at `639-650`, commits board/scoring at `651-657`, emits relay/progress at `671-675`, then renders at `676`. Emit `tetris_lock` and, when `result.cleared > 0`, `tetris_line_clear` after the commit and before/alongside render. A single lock may have both cues, but the adapter should coalesce only identical IDs, not suppress the line-clear cue.
- KO: `ko()` commits state at `738-748`; `playFeedback('capture')` at `749` should become `tetris_ko` or a terminal/KO semantic event.
- Outcome: `render()` calls `showVictoryOverlay` at `1090` whenever `over`; this can reconstruct the overlay on repeated render calls. Terminal audio must be one-shot and outside render.
- Multiplayer/replay: online lock and KO may arrive through relay/authority paths. IDs must use accepted placement/KO sequence and dedupe local prediction versus receipt. Never put audio-only fields into relay/replay protocol objects.

### Xiangqi

- Accepted action gate: `doMove()` validates board bounds and legal moves at `1259-1267`.
- Current cue: `playFeedback(captured ? 'capture' : 'move')` at `1270`, before board mutation (`1279-1283`). Move it to a post-commit helper; use `xiangqi_move` and optional capture/check types.
- Capture: captured piece accounting occurs at `1271-1274`; this is the source for a capture intensity/variant, but the audio record must not include piece names or board state.
- Terminal: checkmate/stalemate branch `1293-1301` and clock loss `1341-1351` both set `over/winner`; `render()` builds the victory overlay at `1541-1546`. Emit one terminal cue from a shared guarded completion helper, not from render.
- Input: pointer and keyboard both funnel through `interactWithXiangqiCell()` and `doMove()` (`1315-1339`, `1529-1533`), so `doMove` is the single migration point.

## Platform and lifecycle requirements

1. One semantic source: game code emits a whitelisted cue; the adapter owns tone variants, SFX/music/master gain, haptic policy, pan fallback, voice caps, and browser failures.
2. One accepted transition, one cue ID: local, AI, online authority and replay application must converge on the same post-commit helper or use deterministic dedupe IDs.
3. User gesture unlock: only controls that are already valid inputs may unlock audio. A rejected click may not create a cue; an unlock attempt itself must not produce audible feedback.
4. Hidden/blur/page lifecycle: hidden state suppresses audio and haptics as configured; visibility restoration must not replay queued stale cues. Game destroy/restart must dispose subscriptions, voices and music.
5. Reduced motion/effects and mute: the adapter must independently honor `muted`, SFX/music toggles, haptics toggle, reduced effects, and `prefers-reduced-motion`; gameplay must continue if any audio primitive throws.
6. No sensitive data: cue records/IDs must exclude chat text, user names, tokens, URLs, message bodies, full board/state, reward/economy data and raw DOM text.
7. No protocol drift: audio-only records stay local. Do not add audio fields to WebSocket, moveLog, replay, reward, analytics, profile, or Supabase records.
8. Fallback parity: if WebAudio is unavailable, unsupported, blocked, or not unlocked, retain visual feedback and optional guarded vibration; never throw into a rules path.

## Recommended migration order

1. Stabilize `UnifiedFeedbackAdapter` against the existing `FeedbackBus` contract and add a shared per-match/session terminal guard.
2. Remove the global `.btn` listener and legacy direct calls from Ludo/Monopoly; migrate Gomoku and Xiangqi post-commit placement/move first.
3. Migrate Tank from its private adapter to the shared lifecycle while preserving fire/hit IDs, pan, feature flags, and authority dedupe.
4. Add Tetris move/lock/line-clear/KO cues at the pure accepted-action seams.
5. Add Monopoly movement/events and server-accepted decision cues; resolve the victory overlay/settlement double-surface.
6. Add Ludo roll/capture adapter tones and terminal timing; then add optional platform/lobby/social/shop cues only after game cues are stable.
7. Add settings and real source assets/variants. Programmatic tones remain the guaranteed fallback; generated candidates must pass provenance/license, loudness, decode, PWA cache, and device tests before default-on use.

## Acceptance evidence to collect

- Static inventory has no new direct `sfx`/`haptic` callsites outside the compatibility adapter.
- Each accepted cue is emitted after its corresponding state commit; invalid/spectator/stale/AI-gated input emits zero cues.
- Every game has one terminal cue per match under repeated render, online receipt, reconnect, replay, reset and destroy.
- Browser tests cover AudioContext unavailable/suspended, user-gesture unlock, hidden/visible, mute/settings, reduced motion/effects, voice cap, pan unsupported, and adapter disposal.
- Device gate covers Android Chrome PWA, iPhone Safari PWA, tablet, desktop, lock/unlock, background/foreground and output-device changes. Automated tests must not be reported as real-device evidence.

## Post-implementation closure（2026-08-17）

本文件前半部分保留了 19:26 研究审计的历史行号与当时的缺口描述；以下是当前工作树的覆盖裁决，优先于历史“待迁移”措辞：

| 域 | 当前结果 | 证据 |
| --- | --- | --- |
| Unified Adapter / runtime | 已实现本地程序化 runtime；84 cue、56 tone family、3 music bed、8 voice cap、生命周期/偏好/回退 | `public/src/core/21-unified-feedback-adapter.js`, `public/src/core/22-audio-runtime.js`, `qa/unified-feedback-adapter.js`, `qa/audio-runtime.js`, `qa/audio-tone-profiles.js` |
| 六款游戏 | accepted-action 与 Authority receipt 已迁移；legacy primitive 仅在每款兼容 helper 内 | `qa/audio-cue-inventory.js --strict`, `qa/audio-authority-contract.js` |
| 平台 | auth/room/presence/chat/reward 以及设置/商城/装备/社交/Playline/局内表达/房聊/每日任务/Profile cue 只在接受或去重分支触发，未携带敏感字段 | `public/src/online/03-websocket.js`, `public/src/core/01-utils.js`, `public/src/core/02-app-shell.js`, `public/src/core/07-playline.js`, `public/src/shop/06-shop.js`, `public/src/ui/07-roster.js`, `qa/platform-audio-cues.js`, `qa/audio-platform-coverage.js` |
| Manifest/fallback | 六款统一 `unified-procedural-v1` + `webaudio-fallback`；无音频二进制 | `public/assets/manifests/asset_manifest.json`, `qa/audio-generation-governance.js` |
| 外部 AI | 候选已登记但全部 `PLANNED_NOT_GENERATED`；AudioCraft research-only/CC-BY-NC，fal/ElevenLabs 无凭证 | `audio-candidate-register.json`, `external-generation-preflight.json` |
| 外部证明 | 第二浏览器、真机、PWA 锁屏/耳机/输出切换、真实网络和发布仍 `NOT_EXECUTED` | `evidence/README.md`, 主线共享 Gate |

因此后续工作从“迁移旧调用”转为：真实设备音频恢复证明、候选素材在独立许可/成本/人工听审后再入库，以及保持程序化 fallback 的回归维护。
