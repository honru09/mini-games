# Three.js 官方集成策略（2026-08-12）

状态：`DECISION_RECORD / LOCAL_IMPLEMENTED / NOT_VISUAL_VERIFIED`。Gomoku P0 已按本记录建立 default-off、程序化的同源 ESM Renderer；本文件仍不替代 `GATE-DEVICE-BROWSER-NETWORK` 或 `GATE-ART-GOLDEN-SET`，也不把本地合同提升为可见验收。

本记录把 Ghost3D 的项目约束（可替换 Renderer、Gomoku 首个 vertical slice、Wave B 永久 fallback、Rule/Authority/Protocol 与 Renderer 分层）落实为一个最小的 Three.js 集成决策。Three.js 事实只引用官方文档、官方仓库源码和官方 release；项目阶段约束来自 [`GHOST_GAME_MAINLINE_COMMAND.md`](GHOST_GAME_MAINLINE_COMMAND.md) 与两份指定报告。

## 决策摘要

| 项目 | 决策 |
| --- | --- |
| 版本 | 固定 Three.js `0.185.1`（release tag `r185`，commit `2431a09`）；禁止 `latest`、未锁版本 CDN 和 `dev`。 |
| 载入形态 | 在现有 classic concatenated `scripts/build.js` 之外建立同源、封闭的相对 ESM 图；不把 ESM 拼进现有 `<script>`，不使用 import map 或 bare specifier。 |
| 入口 | Home/Games 不载入 Three；只有进入 Gomoku Game Stage 才 `import()` Gomoku 入口。 |
| Renderer | P0 使用 `WebGLRenderer`，先做 WebGL2 capability gate；不满足就保持 Wave B/Canvas/DOM。 |
| 资产 | P0 先用程序化 geometry/material；GLB/GLTF、GLTFLoader 与压缩 decoder 等 Golden Set 通过后再接入。 |
| 颜色 | 显式开启 `ColorManagement`、显式设置 `SRGBColorSpace` 输出与 tone-mapping policy；不依赖默认值。 |
| 边界 | `THREE.*` 类型和值只允许存在 Renderer implementation；不得进入 Rule、Authority、Protocol、Replay、Reward、AI、Economy、Social 或持久状态。 |

## 1. 版本 pin 与可复核依据

在 2026-08-12（Asia/Tokyo）复核 GitHub `releases/latest`：最新稳定（非 prerelease、非 draft）为 **r185**，发布时间为 2026-07-01；该 release 页面给出 commit `2431a09`。r185 的官方 `package.json` 给出的 npm 版本是 **`0.185.1`**、`type: module`、ESM 主文件 `./build/three.module.js`，并导出 `./examples/jsm/*` 与 `./addons/*` 路径。

因此仓库施工时同时 pin 三个值，避免 release 名与 npm semver 混淆：

```text
THREE_VERSION = 0.185.1
THREE_RELEASE = r185
THREE_COMMIT  = 2431a09
```

来源：[r185 latest release](https://github.com/mrdoob/three.js/releases/latest)、[r185 package.json（version/module/exports）](https://github.com/mrdoob/three.js/blob/r185/package.json#L1-L18)。升级必须另行形成变更记录，重新跑模块图、WebGL2、颜色、context-loss、dispose、CSP/SW 与真机证据。

## 2. 与 classic `build.js` 共存的封闭相对 ESM 图

### ADR-20260812-GOMOKU-CLOSED-RELATIVE-ESM-GRAPH

Three.js 官方安装文档说明浏览器入口应使用 `type="module"`，并且 addon（loader、controls 等）要显式导入；官方示例也展示了用 import map 解析 `three` 与 `three/addons/`。[Installation](https://threejs.org/manual/en/installation.html#option-2-import-from-a-cdn)、[Fundamentals](https://threejs.org/manual/en/fundamentals.html#es6-modules-threejs-and-folder-structure)

**实施决议：Gomoku P0 不采用 import map。** 已落盘的最小图以 `public/three/gomoku-entry.js` 为根，全部 third-party specifier 都是同源相对 URL：

```js
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';
```

`three.module.js` 保留其官方相对 sibling import `./three.core.js`。因此当前封闭图恰好是 entry、Three module/core、WebGL capability addon 与 self-contained GSAP core；没有 bare specifier、远端 URL、第二份 runtime 或全局解析表。`qa/gomoku-ghost3d-esm-graph.js` 递归验证这个图与 vendor SHA-256。

选择封闭相对图而非 import map 的原因是：

- 当前 P0 只有一条小而固定的 Renderer 图，直接相对路径在本地根路径和 GitHub Pages `/mini-games/` 子路径都按 importer 自然解析，无需硬编码站点根。
- import map 是页面级全局解析与顺序依赖；它需要改动 `index-template.html` 并确保早于每个 module bootstrap。保留 classic concatenation 和既有 HTML 不动，使 3D island 的失败面、CSP/MIME/SW 审计面更窄。
- 每个 vendor edge 都可被静态递归审计；未来若引入 addon、loader 或资产图，必须显式把其相对边、版本、hash、CSP/SW 与 dispose 成本加入决策，而不是让一个通用映射悄悄放大可解析范围。

实际目录为：

```text
public/three/gomoku-entry.js
public/vendor/three/r185/build/three.module.js
public/vendor/three/r185/build/three.core.js
public/vendor/three/r185/examples/jsm/capabilities/WebGL.js
public/vendor/gsap/3.15.0/esm/gsap-core.js
```

ESM island 不加入 `scripts/build.js` 的 classic 模块列表。classic Gomoku 只在已挂载 Game Stage、quality/capability gate 允许时通过窄的纯数据桥动态加载 entry：

```js
const module = await import('./three/gomoku-entry.js');
```

不在 Home 预加载 Three，也不在 classic 全局暴露 `THREE`，不添加 import map。官方文档关于 CDN 多副本和依赖一致性的警告仍适用；同源、版本化 vendoring 加上封闭相对边规避 CDN 可用性、全局映射漂移与多副本风险。[Installation（production caveats）](https://threejs.org/manual/en/installation.html#production)

## 3. Lazy-load、Wave B fallback-first 与 Gomoku P0

加载顺序冻结为：

```text
进入 Gomoku Stage
  → WebGL2 检查
  → 动态导入 Three 核心与 Gomoku adapter
  → 建立 renderer/scene
  → 程序化棋盘与棋子
  → 可见且可回退的 presentation
```

任何一个条件失败（WebGL2 不可用、模块/MIME 错误、context loss、加载/解码/纹理失败、CSP/SW cache miss 或 dispose 竞态）都必须回到现有 Wave B/Canvas/DOM；失败不得阻止合法对局开始，也不得改变权威状态。`HIGH → BALANCED → LOW → FALLBACK` 是表现质量阶梯，不是规则状态。

P0 **不接 GLB**：用 `BoxGeometry`/`CylinderGeometry`/基础材质/灯光验证共享 Host、camera、resize、quality、reduced-motion、语义输入、context-loss 与 dispose。这样既能先证明 Renderer seam，也不会越过项目 `GATE-ART-GOLDEN-SET` 把 source/reference-only 美术带入 runtime。Golden Set 通过后，才在 Asset Manifest 中把稳定 Asset ID 映射到 GLB，并保留同一 fallback。

## 4. WebGL2 gate、context loss 与资源生命周期

官方 `WebGLRenderer` 明确“使用 WebGL 2”，且自 r163 起不支持 WebGL 1。[WebGLRenderer](https://threejs.org/docs/pages/WebGLRenderer.html#webglrenderer)

在创建 renderer 前使用官方 capability addon：

```js
import WebGL from 'three/addons/capabilities/WebGL.js';

if (!WebGL.isWebGL2Available()) {
  // 保持 Wave B；可选地展示 WebGL.getWebGL2ErrorMessage()
}
```

来源：[WebGL compatibility check](https://threejs.org/manual/en/webgl-compatibility-check.html)、[WebGL addon API](https://threejs.org/docs/pages/WebGL.html)。不要先 `new WebGLRenderer()` 再捕获错误来决定 fallback。

每个 Gomoku 3D host 必须有明确的 `create → mount → activate → pause → resume → resize → qualityChange → dispose` 生命周期：

- 用 `renderer.setAnimationLoop()` 作为唯一渲染循环入口；切后台、隐藏 Stage、暂停或离开时停止/暂停循环，恢复时只重放最新语义 frame。[WebGLRenderer#setAnimationLoop](https://threejs.org/docs/pages/WebGLRenderer.html#setanimationloop)
- renderer canvas 的 `webglcontextlost` 立即通知 Ghost3D Foundation，保留最后一个权威 frame 并切到 FALLBACK；`webglcontextrestored` 不直接恢复旧 Mesh，而是显式新建 renderer/scene 并从语义 frame `recover()`。r185 源码在 context 创建前注册 lost/restored/creation-error listener，恢复时重新初始化 GL context。[WebGLRenderer.js（context handlers）](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js#L364-L390)、[恢复/丢失处理](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js#L1010-L1067)
- `renderer.dispose()` 只负责 renderer 自身 GPU 内部资源；应用仍须显式释放不再使用的 `BufferGeometry`、`Material`、`Texture`、`WebGLRenderTarget`、`Skeleton`、controls/post-processing，以及 loader/decoder worker。官方 dispose 指南明确移除 Mesh 不会自动释放 geometry/material，`renderer.info` 可用于观察 geometry/texture 计数。[How to dispose of objects](https://threejs.org/manual/en/how-to-dispose-of-objects.html)、[WebGLRenderer#dispose](https://threejs.org/docs/pages/WebGLRenderer.html#dispose)
- dispose 必须取消 listeners、timer、GSAP handle、pending load callback，并使旧 revision/generation 回调失效；连续 `Gomoku → Tank → Monopoly → Tetris` 不能造成 GPU 计数持续增长。

## 5. GLTFLoader/GLB 的传递依赖与 Golden Set 前置顺序

`GLTFLoader` 是显式 addon，不是 core 的一部分；它支持 `.gltf` 与 `.glb`，并能处理动画、材质、纹理、skin 等。r185 源码的首部除了从 `three` 导入大量 core 类型，还直接导入 `../utils/BufferGeometryUtils.js` 与 `../utils/SkeletonUtils.js`，所以一个看似单一的 loader import 也会带来传递 ESM 模块。[GLTFLoader docs](https://threejs.org/docs/pages/GLTFLoader.html)、[GLTFLoader.js r185 imports](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/GLTFLoader.js#L1-L80)

压缩资产还会扩大运行时图：

- `KHR_draco_mesh_compression` 需要 `DRACOLoader`；官方实现会按能力加载 JS/WASM decoder，并生成 Blob URL 与 Web Worker，且 loader 要在结束时 `dispose()`。[DRACOLoader docs](https://threejs.org/docs/pages/DRACOLoader.html)、[DRACOLoader.js decoder/worker](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/DRACOLoader.js#L358-L418)
- KTX2/Basis 需要 `KTX2Loader`、JS wrapper 与 WASM transcoder，必须先 `detectSupport(renderer)`；官方实现同样建立 Blob Worker，并提供 `dispose()`。[KTX2Loader docs](https://threejs.org/docs/pages/KTX2Loader.html)、[KTX2Loader.js transcoder/worker](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/KTX2Loader.js#L286-L323)
- `EXT_meshopt_compression` 需要显式 `setMeshoptDecoder()`；所有 decoder 文件、worker、`.wasm`、`.bin`、纹理和 GLB/GLTF URL 都是同一 asset graph 的一部分。[GLTFLoader decoder methods](https://threejs.org/docs/pages/GLTFLoader.html#setdracoloader)

因此 **P0 程序化优先**是风险控制而非放弃 GLB：先验证 renderer seam 与 fallback，等人工清稿、Reviewer B、IP Review、Golden Set 和真机 Gate 通过，再一次性接入经过 manifest 审计的 GLB 及其全部传递资产；禁止用“GLTFLoader 能加载”冒充美术准入。

## 6. ColorManagement、outputColorSpace 与 tone mapping

Three.js 的工作色域是 Linear-sRGB；显示 canvas 的输出应为 sRGB。官方 color-management 指南说明 `THREE.ColorManagement.enabled` 默认开启，但建议在初始化颜色前明确设置；颜色纹理应标注 `SRGBColorSpace`，非颜色数据不应当作 sRGB。[Color Management](https://threejs.org/manual/en/color-management.html)

Gomoku P0 的明确配置（由 Renderer adapter 持有，不进入语义 frame）：

```js
THREE.ColorManagement.enabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;       // P0 LDR procedural baseline
renderer.toneMappingExposure = 1.0;
```

`outputColorSpace` 与 `toneMapping` 必须显式设置；r185 文档列出输出默认是 `SRGBColorSpace`、tone mapping 默认 `NoToneMapping`，但依赖默认值会掩盖后续 HDR/post-processing 差异。[WebGLRenderer color/tone properties](https://threejs.org/docs/pages/WebGLRenderer.html#outputcolorspace)

后续 Golden Set 若引入 HDR、环境贴图或 post-processing，才为 HIGH/BALANCED 质量档选择并校准 `AgXToneMapping`/`ACESFilmicToneMapping` 等策略，并在 post-processing 末端执行正确的 output conversion；LOW/FALLBACK 不得因 tone mapping 失败而失去可玩性。自定义 `ShaderMaterial` 也必须自行完成 output color-space conversion。[Color Management（output 与自定义 shader 警告）](https://threejs.org/manual/en/color-management.html#output-color-space)

## 7. CSP、MIME、Service Worker 与 offline/cache

这是部署边界（不是把安全策略交给 Three.js）：

- **CSP**：同源 vendoring 使核心/addons/GLB fetch 不需要 CDN `script-src`/`connect-src` 白名单；保留项目现有 inline classic 脚本策略，动态 module bootstrap 也必须符合现有 nonce/hash 规则，不能为 Three 随意加入 `unsafe-inline`。当前封闭相对图没有 import map。若以后启用 DRACO/KTX2，官方源码使用 Blob URL + Worker；应在独立 CSP 矩阵中批准相应 `worker-src`（通常需要 `blob:`）并在目标浏览器验证，或继续使用无 decoder 的程序化路径。[DRACOLoader worker source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/DRACOLoader.js#L393-L417)、[KTX2Loader worker source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/KTX2Loader.js#L299-L321)
- **MIME**：模块请求不能被 SPA fallback 的 `index.html` 冒充。Three.js 官方开发服务器将 `.js` 设为 `application/javascript`、`.glb` 为 `model/gltf-binary`、`.gltf` 为 `model/gltf+json`、`.wasm` 为 `application/wasm`、`.ktx2` 为 `image/ktx2`；生产静态服务器应保持等价映射，并对 404/错误 MIME fail-closed 到 Wave B。[官方 `utils/server.js` MIME map](https://github.com/mrdoob/three.js/blob/r185/utils/server.js#L15-L40)
- **Service Worker**：同源相对 URL 必须落在现有 `sw.js` scope；vendor cache key 应包含 `r185`，Gomoku 专属 cache key 应包含 asset-manifest revision，禁止 r184/r185 或新旧 entry/GLB 混用。当前项目 SW 只把 `script/style/image/font/manifest` 作为 cacheable destination，GLB/GLTF/`.bin`/`.wasm`/`.ktx2` 的 `FileLoader` fetch 不会自动成为离线 shell；若要支持离线 3D，必须显式 precache/runtime-cache **完整传递 asset graph**，并在不完整或过期时回退 Wave B。[项目 `sw.js`](../public/sw.js)、[FileLoader（Fetch 与可选缓存）](https://threejs.org/docs/pages/FileLoader.html)
- **缓存与更新**：`THREE.Cache.enabled` 是 loader 层缓存开关，不替代 HTTP/SW cache，也不替代 dispose。版本化目录 + 原子 SW 更新后再删除旧 cache；离线命中旧模块而缺少对应 decoder/GLB 时，宁可 fallback，不得启动半套 scene。[FileLoader caching](https://threejs.org/docs/pages/FileLoader.html#cache)

## 8. Renderer boundary（硬性禁止）

以下类型/对象只能存在 `ThreeRendererAdapter`（或其内部实现），不得出现在 shared rule、server、protocol payload、snapshot、moveLog、Replay、Reward、AI learning、Economy、Social、Profile 或持久化状态：

```text
THREE.Vector2 / Vector3 / Quaternion / Matrix4
THREE.Object3D / Group / Mesh / Scene / Camera
THREE.Geometry / BufferGeometry / Material / Texture
THREE.WebGLRenderer / WebGL2RenderingContext / GLTF result / AnimationMixer
```

跨 seam 只允许稳定的纯数据：逻辑 cell/座位/Asset ID、有限数值、语义 `PiecePlaced`/`Victory`/`MatchEnded`、Input Command、Camera Mode、Quality Level。Renderer 只能消费权威 state 的 presentation projection；它不能通过 Mesh、raycast 命中或视觉位置重新决定合法步、胜负、奖励、库存、AI、社交关系或 Replay 事实。该规则与 Ghost3D Foundation 的自动静态检查保持一致。

## 9. 风险与 P0 退出条件

| 风险 | 处理 |
| --- | --- |
| release 漂移或 tag/semver 混淆 | 同时锁 `0.185.1`、`r185`、`2431a09`；升级必须重验全部 Gate。 |
| core/addon 多副本或版本不一致 | 单一同源封闭相对图；所有 addon 与 core 来自同一 r185 目录，静态图与 SHA-256 均固定。 |
| classic build 把 ESM 破坏 | ESM island 不进入 `scripts/build.js` 拼接；只经纯数据桥接。 |
| WebGL2 不可用、context loss、旧 callback 污染新局 | 创建前 gate；lost 即 fallback；restore 以语义 frame 重建；generation/revision 失效旧回调。 |
| GLTF/decoder 传递网络、CSP、WASM/Worker、GPU 成本 | P0 程序化；Golden Set 后才 manifest 化 GLB 与 decoder，并测完整 graph。 |
| 颜色/曝光在设备上不一致 | 显式 color config；HDR/tone mapping 只在 Golden Set 与真机校准后进入 HIGH。 |
| GPU/worker 泄漏 | 每次离场 dispose scene resources、renderer、loader/worker；循环场景并检查 `renderer.info.memory`。 |
| SW stale cache 或离线半加载 | r185/manifest 分版本 cache；完整 graph 命中才启用 3D，否则 Wave B。 |
| 未审批 source art 进入 runtime | ART Gate 前只允许程序化 fallback；GLB 默认关闭。 |

P0 只有在以下证据齐全时才可称 `implemented`（而非 `3D_VISUAL_VERIFIED`）：Gomoku 入场才产生 Three 请求；WebGL2 gate 可见；程序化场景可玩且 Wave B 可回退；context loss/recover 与 dispose 循环通过；颜色/reduced-motion/CSP/MIME/SW 行为有记录；静态扫描证明 Three 类型没有越界。真实第二浏览器、Android/iPhone/Tablet、Golden Set 与发布仍由现有共享 Gate 决定。

## 官方来源（精确 URL）

- [Three.js latest release（r185）](https://github.com/mrdoob/three.js/releases/latest)
- [r185 `package.json`](https://github.com/mrdoob/three.js/blob/r185/package.json)
- [Installation / import maps / addons](https://threejs.org/manual/en/installation.html)
- [Fundamentals / ESM and import maps](https://threejs.org/manual/en/fundamentals.html)
- [WebGLRenderer API](https://threejs.org/docs/pages/WebGLRenderer.html)
- [WebGL2 compatibility check](https://threejs.org/manual/en/webgl-compatibility-check.html)
- [WebGL capability addon](https://threejs.org/docs/pages/WebGL.html)
- [GLTFLoader API](https://threejs.org/docs/pages/GLTFLoader.html)
- [GLTFLoader r185 source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/GLTFLoader.js)
- [DRACOLoader API](https://threejs.org/docs/pages/DRACOLoader.html)
- [DRACOLoader r185 source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/DRACOLoader.js)
- [KTX2Loader API](https://threejs.org/docs/pages/KTX2Loader.html)
- [KTX2Loader r185 source](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/KTX2Loader.js)
- [Color Management](https://threejs.org/manual/en/color-management.html)
- [How to dispose of objects](https://threejs.org/manual/en/how-to-dispose-of-objects.html)
- [FileLoader API](https://threejs.org/docs/pages/FileLoader.html)
- [r185 WebGLRenderer source](https://github.com/mrdoob/three.js/blob/r185/src/renderers/WebGLRenderer.js)
- [r185 official server MIME map](https://github.com/mrdoob/three.js/blob/r185/utils/server.js)
