# Monopoly Ghost3D vertical slice P2 — acceptance boundary

> **Historical policy note（historical-as-of，2026-08-16）：** 本文中的旧 `BLOCKED`、人工美术、Reviewer B、IP/法律与逐资产 Golden Set 表述仅代表本文形成时的历史快照，不覆盖当前权威政策。原创 Ghost-native 资产满足 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可进行可逆 `default-on` runtime 接入；人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，未执行时须如实保留且不得冒充 `PASS`。设备/第二浏览器/真实网络与 Supabase Gate 当前为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁止复制、派生、作为生成输入、接入 runtime 或发布。任何接入结论均不授权发布，commit、push、Pages、Render 或生产发布仍须当前用户明确命令。

Status: `IMPLEMENTED_LOCAL / SINGLE_BROWSER_PARTIAL / FINAL_TESTS_PASSED`.

This file records the local implementation boundary and the evidence actually
produced. One current local Chromium supplied partial visible proof; external
device, browser, network, art and release gates remain blocked.

## Frozen baseline checks

- [x] The task is mapped to existing `GAME-050` and `TECH-049`; no Requirement
  ID is created. `GAME-044` was audited as unrelated Tank controls and remains
  outside the slice.
- [x] `NOW_CLOSURE / CLOSE` routing and all three shared Gate semantics were
  read before the contract; `GATE-DEVICE-BROWSER-NETWORK` and
  `GATE-ART-GOLDEN-SET` remain blocked.
- [x] The Foundation, Gomoku P0, Ludo P1, current Monopoly game, Rule Core,
  presentation adapters and relevant QA were audited before choosing the
  semantic seam.
- [x] The interface deliberately reuses existing Foundation lifecycle and
  online presentation validation rather than creating a second Rule/Protocol
  or renderer input API.
- [x] GSAP Core, Timeline and Performance guidance was applied to the future
  contract: one adapter-local finite timeline at most, generic transform-like
  targets only, no ScrollTrigger/CSSPlugin/ambient loop, reduced-motion and
  scoped cleanup required.

## Implemented automated evidence

The focused suites exist as `qa/monopoly-ghost3d-{esm-graph,renderer,contract,layout,cache}.js`
and are wired through `npm run test:monopoly-ghost3d` and Quality Gates.

| Area | Minimum assertions |
| --- | --- |
| Frame/bridge contract | exact default-off flag/Wave B prerequisite; only 2–5 seats; immutable plain frame; source/match/revision/state-hash guards; duplicate/stale/gap snap; 24-cell wrap and `-2|2..12`; no forbidden fields; terminal-only rule; generation last-wins; no renderer input callback. |
| Renderer contract | exact three exports; closed relative ESM graph; first-render-ready; procedural-only 24-cell board; no DOM input/clickable die; one active motion maximum; quality ladder; reduced/static path; context loss and fresh recovery; idempotent dispose. |
| Layout/cache contract | Wave B and DOM dice/action row stay mounted and reachable; 1440×900, 1024×768, 390×844 and 844×390 avoid clipping/overflow; optional island is demand-loaded, absent from install shell and fails to DOM fallback. |
| Existing Monopoly regression | `monopoly-rule-core`, `monopoly-presentation-adapter`, `monopoly-character-presentation`, `ui-037-monopoly-presentation`, `monopoly-auction`, Wave B and Wave C process suites still pass without contract data entering snapshots/serialize/wire/reward/AI. |
| Shared regression | Foundation, i18n, DOM, immersive shell, rule-authority online/security/reconnect as applicable, quality gates and full test suite are rerun by the implementation owner. |

## Vertical-slice proof matrix

| Required dimension | Acceptance evidence | Current status |
| --- | --- | --- |
| 1. Visible result | Current local browser proves default DOM fallback and exact opt-in procedural renderer hierarchy/first-ready state. | `PASS_SINGLE_BROWSER_PARTIAL` |
| 2. Real input | DOM dice rolls; DOM buy/pass/bid controls reach their pre-existing valid local/Authority seam while 3D accepts zero commands. | `PASS_LOCAL_BROWSER` |
| 3. State and errors | Initial, walk/snap, buy/chance/auction, disconnected/reconnect/spectator, terminal, import/WebGL/render failure, context loss, reset/destroy and late async results are proved. | `PASS_AUTOMATED / PARTIAL_BROWSER` |
| 4. i18n/raw boundary | Existing localized DOM HUD remains correct through zh-CN/en-US/uk-UA; renderer adds no system text and never renders raw/private player data. | `PASS_SINGLE_BROWSER` |
| 5. Accessibility | DOM dice/action buttons remain named, focused, keyboard/touch usable and at least 44px; optional canvas is `aria-hidden` and pointer-transparent. | `PASS_SINGLE_BROWSER_PARTIAL` |
| 6. Reduced motion | Visible `prefers-reduced-motion` path is static but equivalent, has no active timeline, and remains playable through DOM controls. | `PASS_SINGLE_BROWSER` |
| 7. Performance/responsiveness | Lazy request graph, one-timeline budget, hidden/offscreen pause, dispose/restart measurements and target layouts; real FPS/GPU/memory stay separately measured. | `PASS_AUTOMATED / REAL_DEVICE_NOT_EXECUTED` |
| 8. Cleanup/lifecycle | Reset, restart, leave, restore, reconnect, feature-off, hidden/visible, context loss/recover and destroy remove timers/listeners/slot/GSAP/Three resources and reject stale work. | `PASS_AUTOMATED` |
| 9. Rollback/compatibility | Exact flag off, Wave B exact `0`, module failure and WebGL failure preserve old DOM controls, snapshots, protocol and result flow. | `PASS_AUTOMATED_AND_DEFAULT_OFF_BROWSER` |
| 10. Authority/safety/art | Regression proves no Rule/Authority/Protocol/Replay/Reward/AI/DB mutation and no ART-036/source-only asset or private profile/economy data enters the renderer. | `PASS_AUTOMATED / ART_GATE_BLOCKED` |

## Manual and external-gate matrix

- [x] Current local Chromium: default-off Wave B; exact temporary opt-in;
  two-, three-, four- and five-player frames; DOM dice, buy/pass and bid
  controls; terminal; console warning/error check; then clear flags and media
  emulation.
- [x] Current local Chromium: 1440×900, 1024×768, 390×844 and 844×390;
  light/dark; zh-CN/en-US/uk-UA; visible reduced-motion; no clipping, overflow
  or DOM control occlusion.
- [ ] `GATE-DEVICE-BROWSER-NETWORK`: second desktop browser, physical Android,
  iPhone Safari and Tablet in both orientations/PWA recovery; real
  latency/jitter/loss/reordering; real frame time/FPS/GPU/thermal/memory.
- [ ] `GATE-ART-GOLDEN-SET`: human cleanup, Reviewer B, IP review, user Golden
  Set and an explicitly separate approved-runtime-art task before ART-036
  assets could ever be considered.
- [ ] Production/release: only after explicit user authorization; this task
  grants no commit, push, Pages/Render deployment or production-ready claim.

## Pass/fail rules for the implementation owner

An implementation must fail closed to Wave B if any semantic frame guard,
dynamic import, support check, mount, first render, runtime render, context,
resource cleanup or lifecycle guard fails. A visible Three scene is not a pass
if it makes DOM controls inaccessible, accepts a renderer command, replays an
unverified path, runs motion under reduced motion, leaves stale resources, or
changes any authority/security boundary.

Only after the focused and shared automated suites pass may the task state move
to `IMPLEMENTED_LOCAL`. Browser/device/art evidence must keep its own accurate
`NOT_EXECUTED`, `partial` or `BLOCKED` status; neither a contract nor one local
browser can promote `TECH-049` to production-ready or clear a shared Gate.

## Final local closure evidence — 2026-08-14 22:25

- `npm run test:monopoly-ghost3d` passes: ESM graph 59 assertions, Renderer 71
  assertions, bridge/real-Foundation failure, layout and cache contracts.
- Foundation, Monopoly Rule Core, Presentation Adapter, Auction, Wave B, Wave
  C process, Character Presentation and UI-037 focused regressions pass.
- `npm run quality:gates` passes after rebuilding the generated frontend.
- Final complete `npm test` passes in 139.7 seconds. An unrelated
  `social-match-online` assertion was diagnosed as a cross-process wall-clock
  millisecond-boundary race; the test now retains strict server authority
  checks while allowing a bounded symmetric clock skew, and passes 20/20
  repeated runs before the final full suite.
- Deterministic double builds match at 1,422,463 characters / 1,436,997 bytes /
  SHA-256 `A69CAF292FEFE477664B05486D2D6F560075307C05F6C1D86841E0B6A4298B0C`.
- Terra Max review found and the owner corrected two lifecycle defects: stale
  callbacks after context-loss recovery, and stale callbacks after Foundation
  mount/config/render failure enters fallback. Adapter epoch invalidation now
  protects ready state, DOM dice ownership and recovery count in both paths.
- No commit, push or deployment was performed. Device/browser/network, real
  performance, production data and human art gates remain unchanged.
