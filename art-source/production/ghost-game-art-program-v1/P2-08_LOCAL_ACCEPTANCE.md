# P2-08 Local Acceptance

- Unit: `P2-08 / P-AUDIO-SPECTRUM-ART-V1`
- State: `implemented_owner_cleared_release_evidence_pending`
- Runtime: 12-bar Ghost-native code-native spectrum in Settings, driven only by detached
  audio presentation envelopes and a dedicated lazy finite GSAP Core adapter.
- Privacy: no PCM, AudioNode, analyser, microphone, recording, player text, protocol payload,
  Replay, Reward or Chat data enters the spectrum.
- Fallback: feature flag off restores the previous Settings audio UI; reduced-motion, hidden,
  load failure and forced-colors retain a static readable spectrum.
- Effective silence: zero master/SFX/music volume is reflected in detached audible booleans;
  no false Live cue is presented, and a lazy adapter resolving after close is disposed.
- Authority: existing audio remains `GAME-037 / GAME-038`; the art layer does not own audio,
  Rule, Authority, Protocol, Reward, Replay, AI, Chat, Analytics or Supabase facts.
- Local evidence: `npm run test:audio-spectrum`, `npm run test:audio`, i18n, Quality Gates,
  deterministic build check and complete `npm test`.
- Final local build after P2-09 aggregation: `public/index.html` = 2,106,322 characters /
  2,121,076 bytes / SHA-256 `DA2111F606D13F6BFFE5CFBB685382A43984D2F5E460F21954B30520C3161EF4`.
- Historical-as-of `D7B483C3…A805B7F82` focused Codex Chromium evidence: desktop + 390×844, three languages, light/dark,
  visible reduced-motion, zero horizontal overflow, close cleanup and console warn/error 0; see
  `art-source/platform/audio-spectrum-art-v1/current-build-single-browser-verification-20260822.json`.
- `NOT_EXECUTED`: complete current-build browser matrix, second browser, physical devices, real
  network shaping, low-end performance, production Supabase and release deployment.
