# Skill routing — P1-06 Community / Replay / Tournament / OG Cards

Family: `P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1`  
Execution: local deterministic SVG + Sharp WebP compilation; no external pixels or layers.

| Installed entry | Status | Purpose / boundary | Output or task id |
|---|---|---|---|
| `imagegen` | `NOT_APPLICABLE` | The deliverables are repo-native vector/card surfaces; the skill explicitly prefers SVG/HTML/CSS for this asset type. | `deterministic-vector-route` |
| `ai-image-generation` | `NOT_APPLICABLE` | No inference.sh model was needed; no external credential or provider was invoked. | `no-provider-call` |
| `gpt-image` | `NOT_APPLICABLE` | Exact typography and geometry are authored in local HTML/CSS/SVG, so a raster model would weaken determinism. | `local-type-safe-route` |
| `image` | `APPLIED` | Used GPT Image 2 five-slot art-direction vocabulary to freeze card composition, palette, materials and positive constraints. | `P1-06-image-direction-v1` |
| `happy-image-gen` | `NOT_APPLICABLE` | No configured provider was required; no setup, paid call or credential was created. | `no-provider-call` |
| `html-to-image` | `APPLIED` | Local HTML/CSS fallback template was authored for pixel-precise localized OG card rendering; no third-party endpoint receives project data. | `review/og-card-template.html` |
| `website-screenshot` | `NOT_APPLICABLE` | This batch produces assets and a local review board; website capture is reserved for visible runtime evidence. | `review/community-replay-tournament-cards-contact-sheet-v1.png` |
| `code-to-image` | `NOT_APPLICABLE` | No code screenshot is part of the runtime art family. | `no-code-image-output` |
| `og-image` | `APPLIED` | OG 1200×630 layout and small-size hierarchy were applied through the local HTML/CSS fallback. | `og-1200x630-local-v1` |

All external-reference fields are empty. `blocked-license / EXTERNAL_REFERENCE_ONLY` inventory remains reference-only and did not enter this generation or runtime lane.
