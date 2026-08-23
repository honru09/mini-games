# Technical Review — P2-12

- Source master target: 1536×1024 opaque PNG.
- Runtime variants: desktop 1200×800, mobile 720×720, poster 600×400, static 1200×800 WebP.
- All runtime paths are Manifest allowlisted and gated by `mg_art_profile_adaptive_hero_v1`.
- Fallback is deterministic CSS/HTML; no game rules or profile authority depend on image decode.
- External blocked-license pixels/layers: 0 transmitted, 0 in runtime.
- Human cleanup, Reviewer B, legal review and real-device release evidence remain `NOT_EXECUTED`.
