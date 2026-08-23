# Technical Review — P2-04

- SVG source is generated from allowlisted local primitives only.
- Desktop/mobile and light/dark dimensions are pinned in the family manifest.
- Runtime paths stay under `public/assets/platform/personal-home-scene-v1/`.
- Static composite, poster/mini and CSS fallback remain available on flag, decode,
  save-data, reduced-motion or forced-colors failure.
- No text is baked into the decorative layers and no Rule/Authority state enters art.
