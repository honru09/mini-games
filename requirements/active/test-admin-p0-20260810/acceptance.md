# Test Admin P0 Acceptance

| Requirement | Status | Evidence | Notes |
|---|---|---|---|
| Pure environment/configuration validation | VERIFIED_RELEASED | `qa/test-admin-contract.js` | Render and runtime share one UID validator; disabled secret writes are rejected. |
| Fixed capability whitelist | VERIFIED_RELEASED | `qa/test-admin-contract.js` | No wildcard or client origin. |
| Virtual G Coins, level and current catalog ownership | VERIFIED_RELEASED | Browser smoke, `qa/test-admin-contract.js` | Private profile shows `∞ G Coins` and `Lv.MAX`; no persistence mutation. |
| Public/social/match isolation | VERIFIED_RELEASED | Online ephemeral-guest smoke, `qa/test-admin-online.js`, `qa/test-admin-security.js` | Public profile, leaderboard, Presence, Lobby, friendship, Block, report and Direct Chat stay isolated. |
| Rewards/ledger/replay/AI/analytics/outbox isolation | VERIFIED_RELEASED | Online sandbox smoke, `qa/test-admin-online.js`, `qa/test-admin-security.js` | Test matches return zero reward and do not alter formal progression. |
| Tournament external-owner integration | VERIFIED_RELEASED | `qa/test-admin-online.js`, `qa/tournament.js` | Test admin can operate as an external control plane without entering participant rewards. |
| Frontend private projection | VERIFIED_RELEASED | In-app browser smoke, `qa/test-admin-ui-contract.js` | Only the authenticated private profile shows the badge, `∞ G Coins` and `Lv.MAX`. |
| Full regression and deterministic build | VERIFIED_RELEASED | `npm test` (167.7s), SHA-256 `e8b8d37c66d8843b61f040eaf5028995a5ebf5e30fdd6abff6036ab84ede304e` | Render and Pages are byte-identical to the double local build. |
| Render configuration and deployment | VERIFIED_RELEASED | `dep-d9sv99f40ujc73dvlru0`, commit `da3d05c` | Four secret values remain outside Git and the service is live. |

## Known Issues

- Physical-device validation remains an external product gate; the admin presentation itself is covered by the shared responsive frontend and source contract.
- The operator password and UID must never be copied into reports, logs, Git history, screenshots or tool output.

## Rollback

Disable `TEST_ADMIN_ENABLED` and restart. The virtual features disappear without data migration.
