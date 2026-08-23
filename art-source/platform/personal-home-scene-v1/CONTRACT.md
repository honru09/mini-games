# P2-04 Personal Home Scene Contract

`P-PERSONAL-HOME-SCENE-V1` is a Ghost-native, presentation-only Home desk-island.
It is a deterministic SVG source family with local WebP derivatives, not a real-time
3D scene and not a new account-personalization capability.

- Layers: `background`, `midground`, `foreground`.
- Variants: light/dark × desktop/mobile, static composite, poster and mini fallback.
- Runtime: one reversible `mg_art_personal_home_scene_v1` flag, Manifest allowlist,
  decode failure fallback to the existing Home ambient CSS scene.
- Authority boundary: no `owned`, purchase, reward, task, ranking, protocol, chat,
  replay, AI, analytics, Supabase, date/liveops or Renderer capability.
- Accessibility: decorative `aria-hidden` imagery; Home facts remain HTML; reduced
  motion and save-data use the static composite/poster path.

External `EXTERNAL_REFERENCE_ONLY / blocked-license` inputs, pixels and layers are
not read, copied, traced, recolored, transmitted or connected to runtime.
