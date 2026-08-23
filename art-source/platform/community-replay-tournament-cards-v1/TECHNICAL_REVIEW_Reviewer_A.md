# Technical Review — Community / Replay / Tournament / OG Cards v1

Reviewer: Reviewer A (technical art and asset governance)  
Status: `APPROVED_FOR_LOCAL_OWNER_CLEARANCE`  
Family: `P-COMMUNITY-REPLAY-TOURNAMENT-CARDS-V1`

- [x] 12 SVG masters have explicit viewBox, no scripts and transparent-safe geometry.
- [x] 24 WebP variants are paired normal/static variants and remain below the 2 MiB family budget.
- [x] Card canvases are 1200×630; marks are 256×256; camera sentinels are 1×1.
- [x] Art contains no player names, scores, localized copy, permissions or rule facts.
- [x] Runtime is decorative and presentation-only; existing Playline, Replay and Tournament authority remains unchanged.
- [x] Local HTML/CSS fallback preserves exact text rendering and reduced-motion behavior.
- [x] No external URL, PSD/AI/EPS pixels or blocked-license material entered the source or runtime directories.
