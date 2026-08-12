# Honru Pixel Avatar P0 — Prompt and provenance record

## Scope and release boundary

This record covers only the source-art candidate directory
art-source/platform/avatars/v3-honru-pixel-p0-20260811.  It does not approve a
runtime asset, a shop item, a catalog entry, a manifest record, or a default
avatar.  The candidate pack remains source-only and default-off.

## Prompt recovery status

Exact generation prompts: NOT_RECOVERED.

Exact Builder repair instructions, tool identity, and edit recipe:
NOT_RECOVERED.

Do not reconstruct either kind of prompt from the pictured character, file
name, image style, or a later decision.  A plausible paraphrase would be
invented provenance rather than an archival fact.

The following evidence was available at review time:

- The source directory contains five PNG files only; no prompt sidecar,
  request export, JSON record, or generation transcript was present.
- Every source PNG contains a PNG caBX C2PA chunk.  Its readable claim
  material identifies the creation action as gpt-image version 2.0 and the
  claim generator as OpenAI Media Service API.
- Those source PNGs expose no tEXt, zTXt, or iTXt PNG prompt field.  The
  readable C2PA material records provenance metadata, but does not expose a
  recoverable verbatim prompt.
- The alpha directory contains only derivative RGBA PNGs.  These files do not
  contain a caBX C2PA chunk or a textual repair recipe.
- Repository search for the four role stems and this task directory found no
  additional prompt/provenance source outside this directory.

Consequently, C2PA establishes that the color-key source images are
AI-generated source artifacts; it does not let this record claim the exact
request wording.  The absence of C2PA from alpha files does not identify a
specific builder or human editor.  “Builder repair” below names the derivative
processing stage only.

## Generated source evidence

The phrase “original four generated avatars” means the four selected role
directions below.  The directory actually preserves five C2PA-bearing
generation outputs because Arcade Builder has an earlier alternate source
variant.  The alternate is retained for audit and is not silently relabelled
as one of the four selected directions.

| Selected role | Generated source file | SHA-256 | C2PA evidence | Prompt |
| --- | --- | --- | --- | --- |
| Stargazer | source/honru-stargazer-chroma-v1.png | 9f8853b7c61ff8556db3a7f290647a6355ed67c3ee922b126132fe345222c008 | caBX; gpt-image 2.0; OpenAI Media Service API | NOT_RECOVERED |
| Night Cadet | source/honru-night-cadet-chroma-v1.png | 3582588586c0e1f46e459a882f3140c2dff74f75c99f7f8443c2d8133ca76215 | caBX; gpt-image 2.0; OpenAI Media Service API | NOT_RECOVERED |
| Explorer | source/honru-explorer-chroma-v1.png | 0944d7cc97a01fbf457e06f2e544f569d9480b05e7d37dfc5d95021af4f99406 | caBX; gpt-image 2.0; OpenAI Media Service API | NOT_RECOVERED |
| Arcade Builder (selected source variant) | source/honru-arcade-builder-chroma-v2.png | 042c393df43c02c5d77c9c069ab8db41fe4e7e20e3363f4c9c8689088667042a | caBX; gpt-image 2.0; OpenAI Media Service API | NOT_RECOVERED |

Preserved generated alternate:

| File | SHA-256 | Status | Reason |
| --- | --- | --- | --- |
| source/honru-arcade-builder-chroma-v1.png | 56e060da08c871677ff7f12612bc8079eedf77b67974b9c3f4b8eb078ed30276 | PRESERVED_NONCANONICAL_GENERATED_VARIANT | An earlier Arcade Builder generation variant is retained for provenance and comparison; the source-only technical selection freezes v2 instead. |

## Builder-repair provenance

The alpha PNGs are derivative transparency candidates made from the color-key
sources.  Their filenames, byte hashes, dimensions, and alpha-channel
properties are frozen by qa/honru-avatar-source-contract.js.  They are not
presented as a second model generation and are not given invented repair
instructions.

Selected Builder repairs:

| Role | Selected alpha file | SHA-256 | Repair prompt/recipe |
| --- | --- | --- | --- |
| Stargazer | alpha/honru-stargazer-alpha-v2.png | 8874f1943dc8b23d9647727fb82ff27b27c3cd394d711f05345d12c0123fce7b | NOT_RECOVERED |
| Night Cadet | alpha/honru-night-cadet-alpha-v2.png | 4e5e0f07dba7075f485c79ab2ab02a4cac3c8e3973572fe2a1779d0efd9b860d | NOT_RECOVERED |
| Explorer | alpha/honru-explorer-alpha-v2.png | 7353548824f3bc2940ad3c98e76d43b04645b90cce800ec0544477e160c3a408 | NOT_RECOVERED |
| Arcade Builder | alpha/honru-arcade-builder-alpha-v9.png | 775dbd6500eac095eaa08a4bb688fb5e5870b84d91cf79bf23dfa80c3bdf3846 | NOT_RECOVERED |

The status and observed technical reasons for every alpha candidate are in
SOURCE_STATUS_AND_TECHNICAL_REVIEW.md.  In particular, alpha-v2 is the frozen
technical candidate for Stargazer, Night Cadet, and Explorer, while
Arcade Builder alpha-v9 is the frozen technical candidate.  This is a
source-side technical selection only; it is not an approval for runtime use.

## Approval status

- Reviewer A technical review: completed only as a source-file audit.
- Reviewer B: NOT_EXECUTED.
- IP Review: NOT_EXECUTED.
- User Golden Set: NOT_EXECUTED.

No automated test, C2PA chunk, hash match, or source-side decision substitutes
for those human gates.  Until they are executed and a separate runtime task is
authorized, all files in this directory remain outside public assets, the
asset manifest, and runtime/default-avatar selection.
