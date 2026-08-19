# Art Approval Matrix P1 Contract

## Authority

- `asset-library/catalog.json` remains the source/provenance/hash authority.
- `public/assets/manifests/asset_manifest.json` remains the runtime authority.
- `requirements/ART_APPROVAL_MATRIX.md` is the owner-clearance and optional-risk-advice index; it does not replace Catalog or Manifest authority.
- `GATE-ART-GOLDEN-SET` is `OPEN_BY_OWNER_AUTHORIZATION`. An original Ghost-native family may enter a reversible default-on runtime candidate after its `OWNER_AUTHORIZED_ART_CLEARANCE` record is complete.
- Human cleanup, independent natural-person Reviewer B, IP/legal advice and per-asset Golden Set are `OPTIONAL_ADVISORY_EVIDENCE`; missing advice remains honestly unexecuted but cannot block development or runtime integration.

## Required safety assertions

1. Matrix declares all five candidate states, including `OWNER_AUTHORIZED_ART_CLEARANCE`, and says technical status alone does not fabricate human or legal approval.
2. Matrix includes current source-only candidates and legacy/default-off exceptions without silently promoting them.
3. Emoji remains source-only until its own owner-clearance record is complete; any later runtime integration must preserve stable IDs, the text-only wire boundary, fallback, feature flag and rollback.
4. External source register stays reference-only/blocked-license.
5. Honru Emoji is dual-state: before per-family clearance there must be no `P-HONRU-EMOJI-V1`, public runtime file, flag, or consumer; after any runtime trace appears, an `OWNER_AUTHORIZED_ART_CLEARANCE` record, strict Manifest/paths/hash/budget/flags/fallback and consumer adapter must all exist atomically. Source-only candidate paths never enter the runtime Manifest.
6. Matrix must expose the shared Art Gate as `OPEN_BY_OWNER_AUTHORIZATION` while preserving explicit current-user release authorization and never fabricating an optional human/IP/Golden Set PASS.
7. `EXTERNAL_REFERENCE_ONLY / blocked-license` assets never enter the owner-clearance lane and remain forbidden for copying, tracing, generation input, runtime or release.

## Rollback

Remove this task's governance files only. Existing fallback, Catalog, Manifest, public preview flags, external-source register and all source art remain untouched.
