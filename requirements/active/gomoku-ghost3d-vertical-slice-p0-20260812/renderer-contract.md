# Gomoku Ghost3D P0 renderer contract

Status: `LOCAL_IMPLEMENTED / NOT_VISUAL_VERIFIED`

## Boundary

`public/three/gomoku-entry.js` is a browser ESM island. Its only public exports
are the frozen `VERSIONS` record, `isGomoku3DSupported()`, and
`createGomoku3DAdapter(options)`. All Three.js, GSAP, WebGL, DOM, raycast,
canvas, and ResizeObserver values remain private to one adapter instance.

The adapter accepts a `mountElement`, `onInput`, and `onContextLost` callback
(with optional `onError` and `onReady`). It returns the Ghost3D Foundation lifecycle surface:

```text
id, mount, render, motion, setQuality, environment,
suspend, resume, contextLost, dispose
```

It consumes only plain semantic presentation frames and emits only these pure
input commands, each bound to the latest accepted frame revision:

```text
{ type: 'aim_cell', row, col, revision }
{ type: 'clear_aim', revision }
{ type: 'select_cell', row, col, revision }
```

There is no Three value in rules, authority, protocol, replay, reward, AI,
economy, social, or persisted data. A visual raycast never establishes move
legality; it merely reports a logical cell to the existing callback seam.

## P0 renderer behavior

- WebGL2 is checked through the official `WebGL.isWebGL2Available()` addon
  before `WebGLRenderer` construction. Failure throws the stable
  `GOMOKU3D_WEBGL2_UNAVAILABLE` error so the caller can retain Wave B.
- Scene content is procedural only: a 15×15 thick board, grid, five star
  points, and black/white puck-like stones keyed internally by `row:col`.
  There are no GLB/glTF files, textures, loaders, workers, or art assets.
- The board group applies `frame.view.quarterTurns`; input intersects only its
  transparent pick plane and converts the world hit through `worldToLocal`.
  The bridge's `frame.board.stones` collection and common grid-shaped frame
  variants both remain read-only inputs.
- Color configuration is explicit: `ColorManagement.enabled`, sRGB output,
  `NoToneMapping`, and LDR exposure `1`.
- `HIGH` caps DPR at 2 and enables one directional shadow; `BALANCED` caps at
  1.5 with shadows disabled; `LOW` uses DPR 1 and static rendering. The
  adapter never creates a presentation fallback scene.

## Motion and lifecycle

Mount/configuration never announces readiness or activates the private pointer.
Only the first successful semantic `renderer.render(scene, camera)` may call
`onReady()` once and enable the 3D pointer. A render failure before or after
readiness disables that pointer again so Wave B remains the usable surface.

Only the vendored GSAP core is used. A HIGH first frame has one finite labeled
`entrance → settled` Camera timeline. A HIGH placement has a single labeled
three-child `focus → place → settled` timeline (camera position, camera aim,
stone drop); BALANCED has a single stone-only child; LOW and reduced motion
directly apply final transforms.
There are no plugins, DOM layout tweens, delays, repeats, yoyo effects, or
ambient loops. `renderer.setAnimationLoop()` is active only for an active
timeline and is stopped after completion, suspension, context loss, and
dispose.

Context loss calls `preventDefault()`, stops motion, removes pointer access,
notifies `onContextLost(reason)`, and leaves the instance unusable. Recovery is an
explicit new-adapter responsibility of Ghost3D Foundation; this adapter never
reuses its old scene after loss or disposal. Teardown kills local GSAP work,
reverts its GSAP context, removes listeners and observer, disposes all owned
geometry/materials and the renderer, then detaches the canvas idempotently.

## Local evidence

```text
node --check public/three/gomoku-entry.js
node qa/gomoku-ghost3d-esm-graph.js
node qa/gomoku-ghost3d-renderer.js
```

Current local counts are 55 ESM-graph assertions and 78 Renderer assertions;
bridge, layout, cache, Foundation, Quality Gates and full `npm test` are
recorded in `evidence/local-verification-202608120655.json`.

The QA runs are static/VM contracts with isolated Three, GSAP, DOM, and WebGL
fakes. They prove the local seam and cleanup behavior only. The real visual,
reduced-motion, browser/device, network, performance, and Golden Set matrices
remain `NOT_EXECUTED` under their existing shared gates.
