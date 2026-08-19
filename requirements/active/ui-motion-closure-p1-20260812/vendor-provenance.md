# GSAP DOM Island Vendor Provenance

Frozen on 2026-08-12 for `ui-motion-closure-p1-20260812`.

| File | Official source | SHA-256 | Bytes |
|---|---|---:|---:|
| `public/vendor/gsap/3.15.0/esm/index.js` | `https://raw.githubusercontent.com/greensock/GSAP/3.15.0/esm/index.js` | `070038235BA75EC2186D054EBD83AE94E6DE6A971F5D3F3D6CD1037551F94FAA` | 664 |
| `public/vendor/gsap/3.15.0/esm/CSSPlugin.js` | `https://raw.githubusercontent.com/greensock/GSAP/3.15.0/esm/CSSPlugin.js` | `41D061E8B0A2DDFDB647F8F85DA690EC6D19194403021ACCA7088926105FE6BD` | 65,156 |
| `public/vendor/gsap/3.15.0/esm/gsap-core.js` | `https://raw.githubusercontent.com/greensock/GSAP/3.15.0/esm/gsap-core.js` | `83C4B6C0B020BEBA737B90896181560B76747342B0F7BAA5BA1B185A75F65B65` | 171,676 |

The closed relative ESM graph is `route-motion-entry.js -> index.js -> CSSPlugin.js + gsap-core.js`. Existing Gomoku imports `gsap-core.js` directly and remains a separate generic-object-only island. No CDN, npm runtime, ScrollTrigger or other plugin is used.

GSAP copyright and licensing notices remain in the upstream files. Distribution remains subject to the terms linked by the upstream headers at `https://gsap.com/standard-license`; this record does not relicense GSAP.

`scripts/fetch-gsap-dom-vendor.ps1` is a maintainer-only reproducibility helper. Production never invokes it and runtime never downloads vendor files from GitHub.
