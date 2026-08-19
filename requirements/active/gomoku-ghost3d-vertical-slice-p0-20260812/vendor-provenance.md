# Gomoku Ghost3D P0 vendor provenance

Status: `LOCAL_VENDOR / NOT_VISUAL_VERIFIED`  
Recorded: 2026-08-12 (Asia/Tokyo)

This record pins the minimal browser ESM graph for the Gomoku Ghost3D renderer.
It does not enable the renderer by itself, approve runtime art, or clear the
device/browser/network or Golden Set gates.

## Three.js

- Package version: `0.185.1`
- Release label: `r185`
- Frozen source commit: `2431a09f46f34c560bc8e44b33be0e567723d5b9`
- Official source base: `https://raw.githubusercontent.com/mrdoob/three.js/2431a09f46f34c560bc8e44b33be0e567723d5b9/`
- Official npm tarball: `https://registry.npmjs.org/three/-/three-0.185.1.tgz`
- npm integrity: `sha512-5aojFCXKwnjBRZvUnt3WFfEcvUJgkN5LlijRFN95hMy8WVkG4I0QNcJE+OuWvuJ0bOdStrbfXn0pkd6/QyiAlg==`
- License: upstream headers retained (`SPDX-License-Identifier: MIT`).

| Local file | Upstream path | SHA-256 |
| --- | --- | --- |
| `public/vendor/three/r185/build/three.module.js` | `build/three.module.js` | `BBF5ED13FE4373F5BD38B14EA8E62E9F157327DA5638EDC6D3863E08B167C9C7` |
| `public/vendor/three/r185/build/three.core.js` | `build/three.core.js` | `3718DF126D69C125362A03340913204470D8C50238605150E57F808840FB7759` |
| `public/vendor/three/r185/examples/jsm/capabilities/WebGL.js` | `examples/jsm/capabilities/WebGL.js` | `02D6F471F7CFE5F70B27FCEF39E0BA236229A79365C45071E193D4A32495E8A1` |
| `public/vendor/three/r185/LICENSE` | `LICENSE` | `BA83CCFD0A85692171BA2DF0209B0C2C561A941BBC0D07AFA3CA9CBD2EC662E1` |

`three.core.js` is the direct relative import of the official r185
`three.module.js`; it is vendored unchanged solely so the requested module
resolves as a complete, same-version graph.

## GSAP

- Package/tag: `3.15.0`
- Frozen source commit: `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2`
- Official source: `https://raw.githubusercontent.com/greensock/GSAP/3.15.0/esm/gsap-core.js`
- Official npm tarball: `https://registry.npmjs.org/gsap/-/gsap-3.15.0.tgz`
- npm integrity: `sha512-dMW4CWBTUK1AEEDeZc1g4xpPGIrSf9fJF960qbTZmN/QwZIWY5wgliS6JWl9/25fpTGJrMRtSjGtOmPnfjZB+A==`
- Runtime license: upstream GreenSock Standard License header retained; this is
  distinct from the documentation skill's MIT license.

| Local file | Upstream path | SHA-256 |
| --- | --- | --- |
| `public/vendor/gsap/3.15.0/esm/gsap-core.js` | `esm/gsap-core.js` | `83C4B6C0B020BEBA737B90896181560B76747342B0F7BAA5BA1B185A75F65B65` |
| `public/vendor/gsap/3.15.0/LICENSE-NOTICE` | release copyright and Standard License notice | `C3DFF62C48EC706B72044426EC68EB21DA5A564A6A3B06CFA10BF65FB406C643` |

The upstream GSAP repository does not publish a standalone `LICENSE` file at
the frozen tag. The local notice therefore records the exact copyright and
Standard License URL already present in the vendored runtime header; it does
not relicense GSAP or confuse the runtime terms with the MIT-licensed GSAP
documentation skills.

No CDN, loader, texture, GLB/glTF, decoder, CSSPlugin, ScrollTrigger, Club
plugin, worker, or second runtime copy is included in this P0 graph.
