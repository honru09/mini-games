# P0-08 Honru Context Reactions — Skill Routing

- Batch: `context-b`
- Scope: eight 1:1 chroma-green Honru context-state bitmap edits
- Identity/edit target: `art-source/brand/ghost-game/honru/context-reactions-v1/source/honru-hand-corrected-master-v1.png`
- Reference lane: project-owned Ghost-native source only; no external or blocked-license reference supplied
- Runtime boundary: source-only generation; no Runtime, Manifest, protocol, or release change

| Skill entry | Status | Reason / use |
|---|---|---|
| `imagegen` | `APPLIED` | Built-in reference-image editing, one independent call per requested state. |
| `ai-image-generation` | `NOT_APPLICABLE` | Alternate Inference.sh provider is outside the user-limited built-in-only execution path. |
| `gpt-image` | `NOT_APPLICABLE` | CLI/gallery workflow was not selected; this batch uses the built-in editor directly. |
| `image` | `NOT_APPLICABLE` | Separate Visual Skills prompt/model routing is outside the explicit built-in-only scope. |
| `happy-image-gen` | `NOT_APPLICABLE` | Alternate multi-provider route is outside the explicit built-in-only scope. |
| `html-to-image` | `NOT_APPLICABLE` | Character bitmap identity edit is not a typography/geometric HTML render. |
| `website-screenshot` | `NOT_APPLICABLE` | No website capture is requested or needed. |
| `code-to-image` | `NOT_APPLICABLE` | No code visual is requested. |
| `og-image` | `NOT_APPLICABLE` | These are character state atoms, not social-share cards. |

Final output paths and built-in task identifiers are recorded in `GENERATON_LOG.md` after generation and visual review.
