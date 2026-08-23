# P2-06 Local Acceptance

- Unit: `P2-06 / P-REPLAY-CINEMATIC-V1`
- State: `implemented_owner_cleared_release_evidence_pending`
- Runtime: code-native layered Replay beats consumed by CameraSystem plus a dedicated lazy,
  finite and reversible GSAP Timeline adapter.
- Fallback: static key-frame/range playback → existing DOM/Canvas game renderer.
- Replay facts remain authoritative data; no event, rule, result, visibility, TTL or share fact is modified.
- Replay mode disables local AI, solo ticket/reward side effects and closes back to the Hub.
- Local evidence: `qa/replay-cinematic-v1.js`, `npm run test:visual-25d`, Quality Gates,
  complete `npm test`, deterministic build check.
- Final local build: `public/index.html` = 2,075,347 characters / 2,090,098 bytes /
  SHA-256 `BFAEEEE42AC6F191A15EBC258DE55D858AA717B4539E9F299DC48B66B0E880D8`.
- `NOT_EXECUTED`: current-build browser-visible Replay flow, second browser, physical devices,
  real network shaping, low-end performance, production Supabase and release deployment.
