# Honru Pixel Avatar P0 — source-only status and technical review

## Verdict

TECHNICAL_CANDIDATE / NOT_APPROVED_FOR_RUNTIME

This review freezes four alpha candidates for source-art comparison only:

1. alpha/honru-stargazer-alpha-v2.png
2. alpha/honru-night-cadet-alpha-v2.png
3. alpha/honru-explorer-alpha-v2.png
4. alpha/honru-arcade-builder-alpha-v9.png

“Accepted” below means accepted as the hash-pinned technical candidate in this
source directory.  It does not make an asset shippable, purchasable, visible
in a catalog, or eligible to become a runtime/default avatar.

## Directory and technical baseline

- Source directory: five 1254 x 1254, 8-bit, non-interlaced RGB PNGs.
- Alpha directory: fifteen 1254 x 1254, 8-bit, non-interlaced RGBA PNGs.
- All alpha candidates have fully transparent four corners.
- The selected alpha files have zero visible bright-magenta pixels under the
  frozen QA test.  Magenta is the color-key background signal in the source
  images, so this is a bounded chroma-cleanup check, not an aesthetic verdict.
- Source images contain C2PA caBX provenance metadata.  Alpha candidates do
  not; the alpha files are treated as Builder-repair derivatives with
  NOT_RECOVERED repair instructions.
- The exact byte hashes, dimensions, format, alpha corners, candidate status,
  and public-runtime exclusion are enforced by qa/honru-avatar-source-contract.js.

## Selected generated source directions

Four role directions are selected as the source parents for review:

| Role | Selected generated source | Source-only status |
| --- | --- | --- |
| Stargazer | source/honru-stargazer-chroma-v1.png | CANONICAL_GENERATED_SOURCE |
| Night Cadet | source/honru-night-cadet-chroma-v1.png | CANONICAL_GENERATED_SOURCE |
| Explorer | source/honru-explorer-chroma-v1.png | CANONICAL_GENERATED_SOURCE |
| Arcade Builder | source/honru-arcade-builder-chroma-v2.png | CANONICAL_GENERATED_SOURCE |

The following source file remains preserved, not deleted:

DECISION | source/honru-arcade-builder-chroma-v1.png | REJECTED_SUPERSEDED_GENERATED_VARIANT | Alternate C2PA-bearing Arcade Builder source output; v2 is the frozen selected source variant for the four-role review set.

This does not falsely imply that only four images were ever generated: there
are five generated color-key PNGs on disk.  “Four” describes the selected role
directions, while the fifth file remains audit evidence.

## Alpha candidate decision records

The alpha files below are Builder-repair outputs.  The decisions use only
observable file evidence: filename/version, frozen byte hash, RGBA mask
properties, visible color-key residue, and comparison with the frozen final
candidate.  Where an intermediate is merely superseded, that is stated rather
than inventing a visual flaw.

DECISION | alpha/honru-stargazer-alpha-v1.png | REJECTED_CHROMA_INTERMEDIATE | 657 visible bright-magenta pixels remained under the frozen chroma test; v2 is the selected zero-magenta technical candidate.

DECISION | alpha/honru-stargazer-alpha-v2.png | ACCEPTED_TECHNICAL_CANDIDATE | 1254 x 1254 RGBA, transparent corners, zero visible bright-magenta pixels; source-only and not approved for runtime.

DECISION | alpha/honru-night-cadet-alpha-v1.png | REJECTED_CHROMA_INTERMEDIATE | 272 visible bright-magenta pixels remained under the frozen chroma test; v2 is the selected zero-magenta technical candidate.

DECISION | alpha/honru-night-cadet-alpha-v2.png | ACCEPTED_TECHNICAL_CANDIDATE | 1254 x 1254 RGBA, transparent corners, zero visible bright-magenta pixels; source-only and not approved for runtime.

DECISION | alpha/honru-explorer-alpha-v1.png | REJECTED_CHROMA_INTERMEDIATE | 536 visible bright-magenta pixels remained under the frozen chroma test; v2 is the selected zero-magenta technical candidate.

DECISION | alpha/honru-explorer-alpha-v2.png | ACCEPTED_TECHNICAL_CANDIDATE | 1254 x 1254 RGBA, transparent corners, zero visible bright-magenta pixels; source-only and not approved for runtime.

DECISION | alpha/honru-arcade-builder-alpha-v1.png | REJECTED_CHROMA_INTERMEDIATE | 290 visible bright-magenta pixels remained and the candidate is not the frozen final Builder repair.

DECISION | alpha/honru-arcade-builder-alpha-v2.png | REJECTED_NONFINAL_BUILDER_INTERMEDIATE | It differs from frozen v9 at 159964 alpha pixels; retained as a repair-history candidate without inventing an aesthetic rejection.

DECISION | alpha/honru-arcade-builder-alpha-v3.png | REJECTED_MASK_BREAKAGE | The alpha scan finds a 31743-pixel largest enclosed transparent area; it is not a valid final mask candidate.

DECISION | alpha/honru-arcade-builder-alpha-v4.png | REJECTED_CHROMA_INTERMEDIATE | 1195 visible bright-magenta pixels remained under the frozen chroma test.

DECISION | alpha/honru-arcade-builder-alpha-v5.png | REJECTED_NONFINAL_BUILDER_INTERMEDIATE | It differs from frozen v9 at 35092 alpha pixels; it is retained for audit rather than selected by version inference.

DECISION | alpha/honru-arcade-builder-alpha-v6.png | REJECTED_NONFINAL_BUILDER_INTERMEDIATE | It differs from frozen v9 at 29206 alpha pixels and has 5107 enclosed transparent pixels; retained as repair history.

DECISION | alpha/honru-arcade-builder-alpha-v7.png | REJECTED_MASK_BREAKAGE | The alpha scan finds a 46378-pixel largest enclosed transparent area; it is not a valid final mask candidate.

DECISION | alpha/honru-arcade-builder-alpha-v8.png | REJECTED_NONFINAL_BUILDER_INTERMEDIATE | It differs from frozen v9 at 15265 alpha pixels; it is preserved for audit but not selected.

DECISION | alpha/honru-arcade-builder-alpha-v9.png | ACCEPTED_TECHNICAL_CANDIDATE | 1254 x 1254 RGBA, transparent corners, zero visible bright-magenta pixels, and the frozen final Builder repair hash; source-only and not approved for runtime.

## Review and approval gates

- Reviewer A: FILE_TECHNICAL_AUDIT_COMPLETE_ONLY.
- Reviewer B: NOT_EXECUTED.
- IP Review: NOT_EXECUTED.
- Golden Set: NOT_EXECUTED.

Automated checks do not replace independent human art cleanup, Reviewer B,
IP similarity review, or the user Golden Set decision.  No public asset,
asset-manifest record, catalog/default-avatar mapping, or runtime feature flag
is authorized by this review.

## Explicit runtime exclusion

The candidate directory has no public runtime destination.  The QA rejects:

- any copy under public/assets,
- any mention of this candidate directory or these filenames in the public
  asset manifest, and
- any reference from runtime/default-avatar source surfaces.

A separately authorized runtime integration task must start from these
source-only records and repeat the human approval gates; it must not infer
approval from this file or from a passing source contract.
