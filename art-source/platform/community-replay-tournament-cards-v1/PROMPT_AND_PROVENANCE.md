# Prompt & provenance — Community / Replay / Tournament / OG Cards v1

- Family ID: `P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1`
- Source ID: `ART-042-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1`
- Flag: `mg_art_community_replay_tournament_cards_v1`
- Generation path: deterministic project-owned SVG masters → Sharp WebP normal/static variants.
- Inputs: no external image, PSD, AI, EPS, URL or blocked-license pixel input.

## Art-direction prompt (image skill, GPT Image 2 five-slot structure)

**Scene:** A compact Ghost Game social surface in a deep-space 2.5D card frame, with a dark navy field, soft cyan/violet atmospheric glow and an understated grid that survives light and dark themes.  
**Subject:** A shareable moment represented by one of five semantic card surfaces: Playline conversation, Replay timeline, Tournament bracket, official result, or player record.  
**Important Details:** clean geometric layers, rounded 1200×630 OG-safe frame, high-contrast cream live-copy area, cyan/violet/coral/gold status accents, soft contact shadows, sparse nodes and paths, readable at 320px, no baked player names or scores.  
**Use Case:** production social card background and local HTML/CSS OG preview for a 2.5D web game platform.  
**Constraints:** keep copy, names, scores, replay facts, permissions and controls in live DOM/i18n; no unrelated logos, watermarks, third-party art, copied silhouettes, or rule data in pixels; include a static reduced-motion variant.

## Provenance

The masters are authored in `scripts/generate-community-replay-tournament-cards-v1.js` from primitive SVG geometry.  The runtime uses only local files under `public/assets/platform/community-replay-tournament-cards-v1/`, with SHA-256 and byte records in `asset-family-manifest-v1.json` and `public/assets/manifests/asset_manifest.json`.

`review/og-card-template.html` is a local typography-safe fallback for localized OG rendering. It contains placeholders only; it does not contact `html2png.dev` and it does not embed external imagery.
