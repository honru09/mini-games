# Gomoku Ghost3D bridge QA scope

Local evidence is supplied by:

- `qa/gomoku-ghost3d-contract.js` for default-off gating, frame projection, input revision guards, terminal/reset generations, delayed imports, listener cleanup, and Wave B accessibility retention.
- `qa/gomoku-ghost3d-layout.js` for overlay ordering, pointer fallback, CSS fill/rounding, mobile/landscape clipping, and reduced-motion rules.
- `qa/gomoku-ghost3d-cache.js` for the atomic SW cache revision, demand-loaded script caching, and the explicit exclusion of Three/GSAP from the install shell.
- Existing Gomoku Wave B/Wave C, tabletop, and immersive-shell suites for unchanged game-stage behavior.

These are implementation and contract checks only. `GATE-DEVICE-BROWSER-NETWORK` remains required for browser/real-device visible evidence; no Golden Set or production-data claim is implied.
