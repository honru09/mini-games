# Technical review — P1-08 Honru Edge Cursor v1

Machine review scope:

- SVG source contains no script, external URL, or embedded third-party file.
- Runtime variants are generated under the 1 MiB family budget with SHA-256 entries.
- Edge images remain transparent, decorative and `pointer-events:none`.
- Cursor files are local PNGs with a fixed `[4,2]` hotspot and system fallback.
- `prefers-reduced-motion`, coarse/touch pointers, settings opt-out, text inputs and disabled controls retain understandable native behavior.
- Manifest, feature flag, loader failure and missing asset paths fail closed to the existing Honru Hero/system cursor.

Reviewer B, manual cleanup, physical-device visual proof and IP/legal review remain `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`.
