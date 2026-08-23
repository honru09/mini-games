# P2-05 Local Acceptance

- Unit: `P2-05 / G-SPECTATOR-CAMERA-ADVANCED-V1`
- State: `implemented_owner_cleared_release_evidence_pending`
- Runtime: code-native `CameraSystem25D` composition seam; no new raster asset.
- Presets: existing `overview / focus / impact / result` plus neutral spectator composition.
- Fallback: reduced-motion/static camera state → existing DOM/CSS/Canvas stage.
- Authority: presentation-only; no Rule, Authority, Protocol, Reward, Replay, AI, Chat,
  Analytics or Supabase mutation.
- Rollback: composition is allowlisted and can be disabled independently; existing player
  camera modes and `mg_visual_25d_v1=0` fallback remain intact.
- Local machine evidence: `qa/spectator-camera-advanced-v1.js`, `npm run test:visual-25d`,
  `npm run quality:gates`, `npm test`.
- Deterministic local build: `public/index.html` 2,061,699 characters / 2,076,450 bytes /
  SHA-256 `BFDA75DA858B13F67555FB1EF4B9A762C7E051FC4446AF38CB2B7BE1836EDFB4`;
  `node scripts/build.js --check` passes. This identity is local-only and has no current
  browser-visible claim.
- `NOT_EXECUTED`: current-build browser-visible matrix, second browser, physical devices,
  real network shaping, low-end performance, production Supabase and release deployment.
