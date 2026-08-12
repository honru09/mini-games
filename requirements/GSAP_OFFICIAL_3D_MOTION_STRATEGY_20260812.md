# GSAP 官方 3D Motion 集成策略（2026-08-12）

状态：`DECISION_RECORD / LOCAL_IMPLEMENTED / NOT_VISUAL_VERIFIED`。本记录冻结并记录 Gomoku 首个 Three.js ESM vertical slice 的 GSAP 最小加载、运动与生命周期边界；P0 已按该边界 vendor core-only runtime 并在 Renderer island 中使用，仍不把任何可见 3D 状态提升为 `verified`。

本记录是既有 [`THREEJS_OFFICIAL_INTEGRATION_STRATEGY_20260812.md`](THREEJS_OFFICIAL_INTEGRATION_STRATEGY_20260812.md) 的 GSAP 配套决策，不替代原子台账。它服务既有 `TECH-049`（可替换 Ghost3D）与 `TECH-054`（GSAP Motion Governance），属于当前 `NOW_CLOSURE / CLOSE` 的准备工作；`GATE-DEVICE-BROWSER-NETWORK` 和 `GATE-ART-GOLDEN-SET` 仍然阻塞真实可见结论与正式美术接入。

## 1. 已冻结的决策

| 项目 | 决策 |
| --- | --- |
| GSAP 版本 | 固定 `3.15.0`；禁止 `latest`、范围版本、CDN URL、未锁的 tag。 |
| 载入形态 | 与 Three 一样采用同源、版本化、vendored ESM island 的封闭相对 ESM 图；不进入现有 classic concatenation、不使用 import map 或 bare specifier。 |
| 最小第三方文件 | 仅 `public/vendor/gsap/3.15.0/esm/gsap-core.js`，逐字保留官方文件和版权/许可证头。它已包含 `gsap.timeline()` 与 `Timeline`；没有单独的 Timeline runtime 文件。 |
| 精确 import | `import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';`，只允许出现在 `public/three/gomoku-entry.js` 或其内部、可替换的 Renderer implementation 模块。 |
| 不载入的内容 | 不 vendor `esm/index.js`、`CSSPlugin.js`、`dist/gsap*.js`、`ScrollTrigger`、任何 addon/Club plugin、CustomEase、调试工具或 CDN script。 |
| 首个消费者 | 仅 Gomoku 3D adapter；Home、Games、普通 Wave B/Canvas/DOM 与其他五款游戏不预加载、不隐式依赖。 |
| Motion 层 | Gomoku 的相机聚焦/回正与单颗棋子落位属于 L3（gameplay emphasis）；无 L4 ambient。 |
| 语义边界 | GSAP 只能改变 Renderer 私有的 camera/mesh/proxy 对象；不能读写 Rule、Authority、Protocol、Replay、Reward、AI、Economy、Social、Profile 或持久化数据。 |
| 降级 | WebGL2、动态 import、模块 MIME/CSP、缓存、mount、context 或任何 renderer 生命周期失败时保留现有 Wave B/Canvas/DOM，合法对局继续。 |

## 2. 官方版本核验（2026-08-12，Asia/Tokyo）

官方 npm registry 的 `latest` 元数据在本日期解析为 `3.15.0`，并记录该版本发布时间为 `2026-04-13T13:15:35.800Z`。官方 GreenSock repository 的同名 tag 指向 commit `13e2b790546426a1a2e0e9b409f3f8dc6d6611f2`。已落盘 P0 同时锁住下列值：

```text
GSAP_VERSION       = 3.15.0
GSAP_TAG           = 3.15.0
GSAP_COMMIT         = 13e2b790546426a1a2e0e9b409f3f8dc6d6611f2
NPM_TARBALL         = https://registry.npmjs.org/gsap/-/gsap-3.15.0.tgz
NPM_TARBALL_INTEGRITY = sha512-dMW4CWBTUK1AEEDeZc1g4xpPGIrSf9fJF960qbTZmN/QwZIWY5wgliS6JWl9/25fpTGJrMRtSjGtOmPnfjZB+A==
```

`3.15.0` 的官方 `esm/gsap-core.js` 是一个自包含 ESM 文件（无额外 import），并导出 `gsap`、`Timeline`、`Tween` 等 core API。这正好覆盖泛对象 tween 和 `gsap.timeline()`；引入 package root 的 `esm/index.js` 则会额外引入 CSSPlugin，不符合本次最小化目标。

版本升级不是常规依赖刷新：必须新建决策记录，重新核对 package metadata、vendored 文件 hash、module graph、license、CSP/SW/offline、bundle 增量、reduced-motion、dispose、低端设备与 Wave B fallback。不得把版本号从目录名或注释中单独替换。

## 3. 与现有 classic build 共存

当前 `scripts/build.js` 将 `public/src/**` 拼入 `public/index-template.html` 的一个 classic `<script>`；该架构保持不变。Three 策略已经冻结 classic→ESM 的窄桥：只有 Gomoku Game Stage 已挂载、质量与 capability gate 允许时，classic 侧才执行：

```js
const { mountGomoku3D } = await import('./three/gomoku-entry.js');
```

Gomoku ESM entry 以相对路径加载 Three、官方 WebGL2 addon 和 GSAP：

```js
import * as THREE from '../vendor/three/r185/build/three.module.js';
import WebGL from '../vendor/three/r185/examples/jsm/capabilities/WebGL.js';
import { gsap } from '../vendor/gsap/3.15.0/esm/gsap-core.js';
```

### ADR-20260812-GOMOKU-CLOSED-RELATIVE-ESM-GRAPH

实际实现采用封闭相对 ESM 图，而非 import map。所有入口边均由 `public/three/gomoku-entry.js` 的 importer-relative URL 决定，官方 `three.module.js` 继续只导入其 vendored sibling `./three.core.js`，GSAP core 则没有传递 import。这样当前五文件图可由 `qa/gomoku-ghost3d-esm-graph.js` 静态递归并配合 SHA-256 完整审计。

不使用 import map 的原因是：P0 图很小且固定；相对边会同时在 localhost 根路径和 GitHub Pages `/mini-games/` 子路径正确解析；避免增加 `index-template.html` 的全局解析表、module 前置顺序和 CSP 审计面；新增 loader/addon 时必须显式评审每一条边，不能借通用映射扩大 runtime 范围。由 `public/three/gomoku-entry.js` 解析的 GSAP 边为：

```text
/mini-games/three/gomoku-entry.js
  -> /mini-games/vendor/gsap/3.15.0/esm/gsap-core.js
```

因此本地根路径和 GitHub Pages `/mini-games/` 子路径都不需要硬编码站点根。不得把 GSAP 塞进 `scripts/build.js`、`public/src/**`、`public/index.html`，不得用 `<script src>`、全局 `window.gsap`、UMD 包装或 classic/ESM 双加载。

### 3.1 P0 已实现的准确文件清单

下表是已落盘 Gomoku vertical slice 的最小 vendor/entry 图；未列出的 GSAP 文件不得加入该图。

| 文件 | 来源/责任 | 规则 |
| --- | --- | --- |
| `public/vendor/gsap/3.15.0/esm/gsap-core.js` | 官方 `greensock/GSAP` tag `3.15.0` 的同路径文件 | 唯一 GSAP runtime 文件；保持 byte-for-byte vendor copy、许可证头和来源记录。 |
| `public/three/gomoku-entry.js` | 项目 ESM island | 唯一合法的外部入口；创建/导出 Gomoku Three renderer，使用上面的相对 import。 |
| `public/three/**` renderer 内部模块（如按深模块拆分） | 项目 ESM island | 只要它仍是 Gomoku renderer implementation 的内部，才可复用该同一 import；不得被 Rule 或 classic 游戏模块 import。 |

以下文件明确不在 P0 module graph：

```text
gsap/esm/index.js              # 会带 CSSPlugin
gsap/esm/CSSPlugin.js
gsap/dist/gsap.js / gsap.min.js
gsap/ScrollTrigger.js
gsap/CustomEase.js
任何 Club/Bonus plugin、Worker、CDN 版本或第二份 GSAP
```

Core 的 `Timeline` 不是插件，也不需要注册。P0 只通过 `gsap.timeline()` 创建时间线；没有 `registerPlugin()` 调用，也没有 `scrollTrigger` vars。局内输入、滚动锁、权威状态与沉浸式 Game Shell 都不能使用 ScrollTrigger、Observer、ScrollSmoother 或其他滚动/指针插件。

### 3.2 Lazy-load 和失败回退

固定加载链：

```text
进入 Gomoku Game Stage
  -> 已挂载 Stage / 当前 generation 检查
  -> WebGL2 + quality + 3D feature gate
  -> dynamic import('./three/gomoku-entry.js')
  -> entry 的 Three + gsap-core 相对 imports
  -> 创建 Renderer adapter
  -> Ghost3DFoundation.recover(adapter) / 最新语义 frame
  -> 成功呈现，或任何失败时保留 Wave B
```

约束如下：

- 不在 Home、Games 卡片、登录、预加载 hints 或初始 Service Worker shell 中请求 GSAP。
- `import()` promise 必须绑定 Stage/match/renderer generation。离场、重开、切游戏、context loss 或 dispose 后到达的模块结果不能 mount 旧场景；若已创建资源，立即 dispose。
- import rejection、错误 MIME、CSP 拒绝、网络/offline cache miss、WebGL2 不可用或 adapter mount 失败都只记录受限 failure reason 并返回 Wave B；不得让棋盘输入、AI、联机、奖励或游戏开局失败。
- `Ghost3DFoundation` 已把在未就绪/暂停期间收到的 motion 标为 `forwarded:false`，且不会排队或重放。恢复时只消费最新语义 frame；不得补播过期落子动画。

## 4. 运动模型：只 animate Renderer 私有泛对象

GSAP 官方 API 支持直接 tween generic objects，而不限于 DOM/CSS。P0 因此不需要 CSSPlugin：对象目标都在 `GomokuThreeRendererAdapter` 内创建、拥有和释放。

允许的 renderer 私有目标：

```text
camera.position.{x,y,z}
cameraAim.{x,y,z}                    # renderer 私有 lookAt proxy
stoneMesh.position.{x,y,z}
stoneMesh.rotation.{x,y,z}
stoneMesh.scale.{x,y,z}
```

相机 `lookAt()` 可由 renderer-local `cameraAim` 的单个 `onUpdate` 或现有 render loop 读取；`onUpdate` 只能写当前 Three transform / 请求已有 renderer render，**不得**在其中创建另一个 tween、timer、网络请求或 Authority mutation。Quaternion 归一化、raycast、Mesh 命中与屏幕坐标都不能成为规则来源。

禁止的目标包括：

```text
Ghost3DFoundation frame/event、棋盘逻辑数组、moveLog、Replay snapshot
服务端 payload、match/turn/revision 权威字段、奖励/经济/AI 状态
DOM layout 的 width/height/top/left/margin/padding
不属于当前 adapter 的任何 camera、mesh、texture、material 或 DOM node
```

语义事件只给出稳定的 cell、玩家、revision、phase 等纯数据。Renderer 读取这些值并复制为本地数值目标；动画从不写回事件，也不改变合法落子、胜负或输入 hit area。Renderer 被替换为 Canvas/DOM/future engine 时，GSAP 可以随这个 implementation 一起删除，不影响任何上层 contract。

### 4.1 Timeline、labels 与 token 映射

多步落子必须用一个可控 timeline 和可读 labels，而不是若干 `delay`。P0 使用现有 `MOTION_TOKENS.json` 的时长：`fast = 120ms`、`normal = 180ms`、`medium = 260ms`。核心内置 `power*.out/inOut` ease 足够；若未来视觉必须精确复用某个 CSS `cubic-bezier`，需单独审批 CustomEase，而不是悄悄扩大本次 core-only graph。

示意（所有对象均为当前 renderer 私有对象）：

```js
const tl = gsap.timeline({
  defaults: { overwrite: 'auto' },
  onComplete: () => { activeMotion = null; renderOnce(); }
});

tl.addLabel('focus', 0)
  .to(camera.position, {
    x: cameraEnd.x, y: cameraEnd.y, z: cameraEnd.z,
    duration: 0.26, ease: 'power2.out'
  }, 'focus')
  .to(cameraAim, {
    x: aimEnd.x, y: aimEnd.y, z: aimEnd.z,
    duration: 0.26, ease: 'power2.out'
  }, 'focus')
  .addLabel('place', 'focus+=0.06')
  .set(stoneMesh.scale, { x: 0.9, y: 0.9, z: 0.9 }, 'place')
  .to(stoneMesh.position, {
    x: stoneEnd.x, y: stoneEnd.y, z: stoneEnd.z,
    duration: 0.18, ease: 'power2.out'
  }, 'place')
  .to(stoneMesh.scale, {
    x: 1, y: 1, z: 1,
    duration: 0.12, ease: 'power1.out'
  }, 'place+=0.06')
  .addLabel('settled', '>');
```

在同一 semantic event 中，camera 和 stone 共享一条 timeline；`'<`、`'>'`、label 和相对 label position 只描述视觉时序，不描述网络、AI 或玩家回合。下一个 revision 抵达时，先终止当前 renderer-owned motion，再从当前可见 transform 或最新 frame 安全重建；不允许多条历史 camera/stone tween 竞争同一属性。

## 5. Lifecycle、context 和清理

每个 Renderer adapter 只维护自己的 `gsap.context()`、`activeMotion` 和明确的目标集合。它不操作 GSAP global timeline，不调用全局 ticker sleep，不对 `'*'` 执行 kill，也不影响未来大厅/档案的其它 GSAP 使用者。

| 时机 | 必须行为 |
| --- | --- |
| 新 motion / 相同目标被替代 | `activeMotion.kill()`，对本 adapter 已知的 camera/stone transform 调用定向 `gsap.killTweensOf(...)`，清除 handle；再由最新 frame 或新事件建立一条 timeline。 |
| 新 revision、重开、换局、路由退出 | 使 renderer generation 失效；停止全部本 adapter motion，并把最终可见 state 同步为最新语义 frame 或交给 Wave B。旧 callback 不得复活 scene。 |
| `adapter.suspend()` / hidden | 暂停自己的 motion、停止 `renderer.setAnimationLoop()`，保留 latest frame；不释放 Authority state，不继续循环，不创建后台 tween。 |
| `adapter.resume()` / visible | 先 reconcile latest frame。若 revision/generation 改变，杀掉旧 timeline 并静态呈现；不补播 suspended 期间的旧语义 motion。只有仍属同一 revision 的短暂、当前 motion 才可继续。 |
| context lost | 终止 motion，停止 renderer loop，交由 Foundation 切入 FALLBACK；恢复时新建 renderer/scene/GSAP ownership 并从 latest frame `recover()`，绝不复用旧 Mesh。 |
| `dispose()` | `activeMotion.kill()`、定向 kill、`ctx.revert()`、移除本 adapter listener/observer、停止 loop，然后依 Three 策略 dispose geometry/material/texture/renderer；所有异步 import/load/onComplete 均以 generation 拒绝。 |

`gsap.context()` 用于收集 adapter 范围内产生的 GSAP work 和自定义 cleanup；最终 `ctx.revert()` 是每次 adapter/match dispose 的硬要求。Timeline handle 仍需显式保存，因为中断、新 revision 与 suspend 不能等到最终 dispose 才停止。若将来使用 `gsap.matchMedia()` 观察浏览器条件，它不能嵌套在 `gsap.context()` 中；该 `mm` 自己拥有 cleanup，并在 dispose 时 `mm.revert()`。

当前 Foundation 已把 `reducedMotion`、`hidden/visible`、`suspend/resume` 作为纯消息及 adapter context 传递。外部 `visibilitychange`、Game Shell `ghostgame:shellchange`、route/offscreen observer 的观察仍属于调用方；Foundation 本身不得引入 DOM listener。Adapter 只实现已收到的 lifecycle 命令，并清理自身的 canvas context-loss listener。

## 6. Reduced motion 和质量阶梯

`adapter.environment({ reducedMotion })` 是 P0 的可测试单一事实源。`reducedMotion:true` 或 Foundation 传入的 `instant:true` 时：

- 不创建 timeline、不调用 camera fly、scale bounce、repeat、yoyo、stagger、particle 或 ambient effect。
- 直接 `gsap.set()` 或直接写 renderer 私有 transform 到语义最终 pose，随后 `renderOnce()`；反馈由稳定棋子、当前玩家/状态文本和已有 DOM HUD 提供。
- 设置变化时，立即杀掉 active motion 并进入静态 pose；不能用“更慢的动画”代替 reduced-motion。

这满足项目的等价 reduced-motion gate，避免把 `gsap.matchMedia()` 嵌套进 adapter context。未来若由 Renderer 自行直接读取媒体条件，必须使用单独的 `gsap.matchMedia()` / `mm.revert()`，并将结果回流为同一个 `environment.reducedMotion` 行为，不能出现两套互相竞争的状态。

P0 质量预算（是运行时上限，**不是**已经取得的 FPS 证据）：

| Quality | GSAP 上限 | 3D motion 行为 |
| --- | --- | --- |
| `HIGH` | 一个 active timeline，至多三个 child tweens；一颗 stone + 一个 camera/aim transition | 使用 `normal/medium` token；无 ambient、无粒子、无无限循环。 |
| `BALANCED` | 一个 active timeline，至多两个 child tweens；一颗 stone | stone transform 可用；camera 保持静态，避免额外连续 render 成本。 |
| `LOW` | 零 active GSAP timeline | 直接 static pose；renderer 只做按需 render，像素比和 Three quality 由 Three adapter 的 LOW policy 约束。 |
| `FALLBACK` | 零 GSAP 3D work | 现有 Wave B/Canvas/DOM。 |

所有档位均为 `gameShellAmbientMax: 0`：不使用 `repeat:-1`、`yoyo` ambient、持续 camera 漂移、无限 ticker callback 或每帧新 tween。输入立刻走既有 command seam，不等待动画完成。

## 7. 性能规则和测量边界

1. Three renderer 只有一条 `renderer.setAnimationLoop()`；GSAP tween 只改变 renderer 私有数值，render loop 读取结果。每次 tick/onUpdate 绝不 `gsap.to()`、绝不建 timeline、绝不 new Mesh/Material/Texture。
2. 单个 semantic placement 最多创建一条 timeline；同类预设若确实需要重新播放，可重置/重用受控 handle，否则 kill 后重建。绝不按 rAF、pointermove、network packet 或每个棋格创建 tween。
3. 当前 core-only file 没有 CSSPlugin；ESM island 不 tween DOM 布局。任何 DOM HUD 仍走既有 CSS-first boundary，且不得动画 `width`、`height`、`top`、`left`、`margin`、`padding` 来冒充 3D movement。
4. `will-change` 只适用于必要的 DOM compositor element；它不应用于 canvas、全部棋子或“以防万一”的层。Three object transforms 不需要 DOM `will-change`。
5. active timeline 完成后关闭连续 render path，保留按需 `renderOnce()`；hidden/suspend 立即关闭。低端设备不以降低帧率继续跑表现，而是进入 LOW/static 或 Wave B。
6. 首个实际 runtime 任务必须记录：未压缩/压缩后的网络增量、cache miss/hit、桌面与目标低端设备 FPS、P95 帧耗、long task、active timeline/animated-stone 峰值、`renderer.info` 资源计数、连续进出/重开/context-loss 的内存曲线。没有这些真实证据不得称性能或视觉 `verified`。

## 8. CSP、MIME、Service Worker、offline 与缓存

### CSP 和 MIME

- 同源 vendor 避免第三方 CDN `script-src` / `connect-src` 例外；不得为了 GSAP 添加 `unsafe-inline`、`unsafe-eval` 或放宽跨域源。
- 动态 `import()` 及其静态子模块仍须在部署 CSP 下获准。若将来有 CSP nonce/hash，module bootstrap 也必须遵守它；当前封闭相对图不使用 import map。先在目标页面验证，再扩大任何策略。
- 当前本地静态 server 已把 `.js` 提供为 JavaScript MIME。GitHub Pages/Render 和本地 server 都必须让 `public/vendor/gsap/3.15.0/esm/gsap-core.js` 返回 JavaScript，而不能用 SPA `index.html` 或错误 MIME 回答；失败一律 fallback。
- NPM tarball integrity 是供应链记录，不等同于浏览器为动态子 import 自动执行的 SRI。vendor 时记录官方 tarball integrity、tag/commit 和本地 SHA-256；不要伪造一个不能覆盖 module graph 的 `integrity` 属性。

### Service Worker 和离线

当前 `public/sw.js` 会以 cache-first 处理 `request.destination === 'script'`，因此用户首次成功进入 Gomoku 后，dynamic entry、Three modules 与 `gsap-core.js` 可进入当前 static cache。该行为不把 3D 变成预缓存 shell。

- GSAP 必须留在版本化 URL `vendor/gsap/3.15.0/...`，避免旧/新 bytes 共享同一路径。
- 不把 GSAP 放入 `SHELL` precache，否则 Home 初始安装会为未选择 Gomoku 的用户下载 3D motion runtime，违背 lazy-load 决策。
- fresh offline 且模块从未缓存、或 entry/Three/GSAP 任一模块缺失时，`import()` 失败后显示 Wave B；不得启动半套 renderer。
- GSAP/Three/Gomoku entry/asset manifest 任一升级须原子调整 SW cache version，并验证 activation 后不会把新 entry 配给旧 vendor 或旧 3D asset graph。旧 cache 只能在新版本可用后清理。
- 若将来加入 GLB/decoder/WASM，必须按 Three 策略为完整传递 graph 单独审计；这份 core-only GSAP 决策不授权任何 Worker、`blob:` CSP 或离线二进制缓存扩张。

## 9. 许可证与来源记录

GSAP runtime 的官方 package metadata 标明的是 **Standard "no charge" license**，并链接到 GreenSock 的 Standard License；它不是本仓库已审计的 `gsap-skills` 文档包所使用的 MIT license。不得把 skill 的许可证或旧审计文字误写为 GSAP runtime 许可证。

P0 vendor 已保留官方来源与 header；后续 vendor 变更必须：

1. 保留 `esm/gsap-core.js` 的原始 copyright/Standard License header，不改名伪装为项目源码。
2. 在该 PR 的 provenance/ADR 中记录本文件的 version、tag、commit、tarball URL、NPM integrity、官方 source URL 与本地 SHA-256。
3. 在实际商用/分发前，由项目负责人根据 [官方 Standard License](https://gsap.com/standard-license/) 核对使用场景；本记录不提供法律结论。
4. 不 vendor 或调用 Club/Bonus plugin；若未来业务需要任何附加 plugin，重新进行单独的许可、包体、CSP、PWA、性能和安全决策。

## 10. 硬性 Renderer boundary

允许的数据与控制方向：

```text
Rule / Authority / Protocol
  -> semantic frame + semantic motion + input command (plain data)
  -> Ghost3DFoundation
  -> replaceable Gomoku ThreeRendererAdapter
  -> GSAP core targets (adapter-owned camera/mesh/proxy only)
```

反向箭头严格禁止。GSAP completion、label、onUpdate、context cleanup、visibility resume 或 visual raycast 都不能：

- 产生、修改或确认游戏操作；
- 改写 revision、turn、结果、Replay、moveLog、分数、奖励、商城、AI learning、聊天或 profile；
- 成为网络消息、存储数据、AI prompt 或 analytics 文本；
- 延迟/吞掉指针、键盘、触控或辅助技术输入。

classic Gomoku 代码只处理 stage mount、纯数据 bridge 与 fallback；它不接触 `gsap`、`THREE`、Mesh 或 camera。`Ghost3DFoundation` 继续保持无 DOM/平台/engine 依赖；GSAP 的所有 import 和调用都随 Renderer implementation 一起替换、暂停和 dispose。

## 11. 风险与退出条件

| 风险 | 控制措施 |
| --- | --- |
| package `latest` 漂移、tag/semver 混淆 | 同时锁 `3.15.0`、tag、commit、tarball integrity 和 vendor SHA-256；升级另立记录。 |
| CSSPlugin 或插件被意外带入 | 只 copy/import `esm/gsap-core.js`；静态检查禁止 `gsap/esm/index.js`、`registerPlugin`、`ScrollTrigger`、`scrollTrigger:`。 |
| classic build 或 GitHub Pages 子路径被破坏 | 不改 `scripts/build.js`，不加全局；只从已挂载 Gomoku 调用相对 `import()`，本地与 Pages 路径均验收。 |
| CSP/MIME/离线首次进入失败 | 同源 URL、真实 CSP/MIME/SW 检查；失败 fail-closed 到 Wave B。 |
| stale import、旧 match callback 或 context loss 重建旧 scene | stage/match/renderer generation + revision guard；dispose 后结果无效，recover 创建全新 adapter。 |
| GPU/GSAP work 泄漏、后台耗电 | 一个 adapter-local context/handle；hidden/suspend 停 loop，dispose kill/revert 并释放 Three resources。 |
| 低端设备 jank | 单 timeline/单 stone/零 ambient 预算；BALANCED 去 camera，LOW static，实机 P95/long-task 证据后再升级结论。 |
| 许可证误判 | runtime 以官方 Standard License 为准，保留 header/provenance，实际分发前人工核对。 |
| GSAP 越过表现层成为事实源 | 只 tween renderer-owned generic objects；回归证明 Rule/Authority/Replay/Reward/Input 零变化。 |

当前 Gomoku GSAP vertical slice 的本地 `implemented` 证据必须同时包含：官方 source/provenance 与 vendor hash、最小 module graph、lazy-load 和 failure fallback、生命周期/cleanup/context-loss/recover、reduced-motion static path、质量预算、bundle/perf 记录，以及 Rule/Authority/Replay/Reward/Input 无变化的回归。真实第二浏览器、Android/iPhone/Tablet、真实网络、最新浏览器可见矩阵和正式美术仍由现有三条共享 Gate 决定，不能由本策略或静态测试越级。

## 官方来源（精确 URL）

- [npm `latest` package metadata](https://registry.npmjs.org/gsap/latest)
- [npm GSAP package metadata / version timeline](https://registry.npmjs.org/gsap)
- [GSAP `3.15.0` official repository tag](https://github.com/greensock/GSAP/tree/3.15.0)
- [GSAP `3.15.0` package metadata](https://github.com/greensock/GSAP/blob/3.15.0/package.json)
- [GSAP `3.15.0` self-contained ESM core](https://github.com/greensock/GSAP/blob/3.15.0/esm/gsap-core.js)
- [GSAP installation documentation](https://gsap.com/docs/v3/Installation/)
- [GSAP generic-object `gsap.to()` documentation](https://gsap.com/docs/v3/GSAP/gsap.to%28%29/)
- [GSAP Timeline documentation](https://gsap.com/docs/v3/GSAP/Timeline/)
- [GSAP `gsap.context()` cleanup documentation](https://gsap.com/docs/v3/GSAP/gsap.context%28%29/)
- [GSAP `gsap.killTweensOf()` documentation](https://gsap.com/docs/v3/GSAP/gsap.killTweensOf%28%29/)
- [GSAP `gsap.matchMedia()` and reduced-motion documentation](https://gsap.com/docs/v3/GSAP/gsap.matchMedia%28%29/)
- [GreenSock Standard License](https://gsap.com/standard-license/)
