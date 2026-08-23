# Prompt and provenance — P1-08

Source identity: `art-source/brand/ghost-game/honru/honru-mascot-master-v1.svg`, approved Ghost Game Honru master. The source SHA is recorded in `asset-family-manifest-v1.json`; Runtime output is produced only by `scripts/generate-honru-edge-cursor-v1.js`.

## Visual direction used by the `image` Skill

Model direction: GPT Image 2 5-slot reference contract, retained as a design brief only; no model call was made.

Scene: Ghost Game desktop and responsive web routes, a transparent composition that can sit at a page edge without covering controls.

Subject: the exact approved Honru ghost fused with gamepad grips, shown as a small peek, wave, or grab-edge crop; preserve the plus-shaped D-pad eye, four-button eye, flame peaks, rounded ghost hands, dark ink outline, and black/white identity.

Important Details: flat high-contrast sticker silhouette, crisp alpha boundary, generous transparent padding, restrained contact shadow, three route-specific crops, and six 32px/64px native cursor states (idle, pressed, scroll up/down/left/right). Pointer gaze is a tiny code-driven highlight layer, never a moving character sprite.

Use Case: shipped web-platform decorative asset and browser-native cursor with system-cursor fallback.

Constraints: preserve identity and proportions exactly; preserve DOM/i18n text and input behavior; keep edge art `pointer-events:none`; keep cursor opt-out, fine-pointer detection, reduced-motion static state, keyboard focus, text-input cursor and system fallback; no extra characters, props, labels, watermarks, third-party visual references, or runtime upload.

## Deterministic derivation

- Edge SVGs are composed from the approved Honru master with fixed transforms and a transparent viewport.
- WebP normal/static pairs are derived with Sharp; cursor PNGs are derived at 32px and 64px with a fixed hotspot `[4,2]`.
- `OWNER_AUTHORIZED_ART_CLEARANCE` is based on project-owned source, stable IDs, SHA/provenance, machine checks, fallback and rollback. Human cleanup, Reviewer B, IP/legal and Golden Set are optional advisory evidence and remain unexecuted.

Attribution for the applied visual-guidance Skill: `smixs/visual-skills` (`image`), CC-BY-4.0, Serge Shima, github.com/smixs/visual-skills.
