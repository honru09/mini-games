# Local Acceptance Evidence: P1-06 Community / Replay / Tournament / OG Cards v1

**Execution ID**: `P1-06`  
**Asset Family ID**: `P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1`  
**Family Flag**: `mg_art_community_replay_tournament_cards_v1`  
**Status**: `implemented_owner_cleared_release_evidence_pending`  
**Boundary**: `LOCAL_ONLY / NOT_RELEASED`

## Delivery matrix

- 12 deterministic SVG masters: six 1200×630 card surfaces, four 256×256 semantic marks, two 1×1 camera sentinels.
- 24 WebP runtime variants: normal/static pairs for every role.
- Runtime bytes: `253,450` (`< 2 MiB` family budget).
- Review board: `review/community-replay-tournament-cards-contact-sheet-v1.png`.
- Local exact-text OG fallback: `review/og-card-template.html`.

## Runtime scope

- Playline attachment cards use `card-playline`, `card-result` and `card-record` art based on the server-signed content kind.
- Replay list/player surfaces use `card-replay` art; tournament state uses `card-tournament` art.
- Art is decorative and lazy; names, scores, replay events, consent, permissions, localized copy and controls remain live DOM/i18n data.
- Reduced motion selects static variants. Resolver failure removes the image and leaves existing DOM/CSS card presentation intact.
- No rule, authority, economy, replay, tournament or social protocol was changed.

## Skill and license boundary

`SKILL_ROUTING.md` records all nine installed image entries. `image`, `html-to-image` and `og-image` were applied to art direction/local exact-text layout; raster generators and code-image/screenshot paths were not applicable. `EXTERNAL_REFERENCE_TRANSMISSION.json` is empty: no external Q UI/PSD/AI/EPS pixel or blocked-license material entered this family.

## Verification

- `node qa/community-replay-tournament-cards-v1.js` → `COMMUNITY_REPLAY_TOURNAMENT_CARDS_V1_ALL_PASS`
- `node scripts/asset-library-audit.js` → `ASSET_LIBRARY_AUDIT_ALL_PASS`
- `node --check scripts/generate-community-replay-tournament-cards-v1.js public/src/core/06-assets.js public/src/core/07-playline.js public/src/online/03-websocket.js` → pass
- `node scripts/build.js --check` binds the generated runtime to the current built HTML hash.

Local machine evidence proves implementation and technical contracts only. Second browser, physical Android/iPhone/Tablet, real network, production Supabase and release evidence remain pending.
