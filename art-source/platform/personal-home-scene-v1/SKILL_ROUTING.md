# P2-04 Image Skill Routing

This family is exact-geometry, project-native SVG with deterministic local Sharp
derivatives. No external image provider or restricted reference was used.

| Skill | Status | Role / reason |
|---|---|---|
| `imagegen` | `NOT_APPLICABLE` | Vector-native scene layers are more deterministic than raster generation. |
| `ai-image-generation` | `NOT_APPLICABLE` | No configured external provider; no remote generation required. |
| `gpt-image` | `NOT_APPLICABLE` | No GPT Image raster output is needed for this code-native family. |
| `image` | `NOT_APPLICABLE` | No model prompt is being authored; visual direction is frozen in the SVG source. |
| `happy-image-gen` | `NOT_APPLICABLE` | No multi-provider raster generation is used. |
| `html-to-image` | `NOT_APPLICABLE` | Output is scene art, not typography or a UI screenshot. |
| `website-screenshot` | `NOT_APPLICABLE` | This batch does not claim browser-visible evidence. |
| `code-to-image` | `NOT_APPLICABLE` | No code documentation image is requested. |
| `og-image` | `NOT_APPLICABLE` | No social/OG card is part of P2-04. |

The local generator is the applied deterministic art route: `scripts/generate-personal-home-scene-v1.js`.
