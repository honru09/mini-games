# Local Acceptance Evidence: P1-08 Honru Edge Cursor v1

**Execution ID**: `P1-08`  
**Family**: `P-HONRU-EDGE-CURSOR-V1`  
**Status**: `implemented_owner_cleared_release_evidence_pending`  
**Boundary**: `LOCAL_ONLY / NOT_RELEASED`

## Deliverables

- Three transparent edge-guide SVG masters: Games peek, Playline wave and Profile grab.
- Six native cursor SVG masters rendered to 32px and 64px PNGs: idle, pressed, scroll-up, scroll-down, scroll-left and scroll-right.
- Three WebP normal/static edge variants; 18 Runtime variants total, `111,367` bytes (`< 1 MiB`).
- Contact sheet, Manifest/Catalog provenance, nine-entry Skill routing and empty external transmission record.

## Product boundary

- The approved Honru identity and Q-version ghost hands are reused without re-generating or changing the Hero body.
- A route has at most one `pointer-events:none` edge guide; Home keeps its existing Hero and does not add a second character.
- Pointer gaze is a small code-driven highlight layer; the Honru image never follows the pointer, preventing blur and input interference.
- The browser-native cursor is opt-in by default on fine/hover pointers, supports pressed and four-way scroll states, and falls back to the system cursor for touch, unsupported environments, disabled settings or load failure.
- Text inputs, disabled controls, keyboard focus, reduced motion, rules, protocol, rewards and game authority are unchanged.

## Verification

- `node qa/honru-edge-cursor-v1.js`
- `node scripts/asset-library-audit.js`
- `npm run test:i18n`
- `node qa/dom-smoke.js`
- `node qa/visual-25d-contract.js`
- `node qa/visual-25d-only-runtime.js`
- `node qa/code-health-sweep.js`
- `node scripts/build.js --check`

Current-build browser evidence, second browser, physical devices, real network and release evidence remain pending.
