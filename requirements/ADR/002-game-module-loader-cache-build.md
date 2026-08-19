# ADR-002：游戏作用域模块加载、哈希预热与确定性构建

- 状态：`accepted / LOCAL_ONLY / NOT_RELEASED`
- 日期：2026-08-16
- 决策人：Ghost Game 主负责人（本地实施决策）
- 影响 Requirement：`TECH-033`、`TECH-039`

## 背景

六款规则与游戏工厂当前仍由 `scripts/build.js` 拼入单一 `public/index.html`；六款 Ghost3D Renderer 已是按需加载的 ESM 岛，但导入位置、版本键和失败缓存分散在各游戏调用者。现有构建脚本每次直接重写产物，Service Worker 只维护 Shell、三语词典与通用静态按需缓存。

当前静态服务没有为这些 Renderer entry 提供 `immutable` Cache-Control；仅有查询参数也不等于内容寻址。因此不能把现有入口描述成不可变游戏 chunk，也不能在安装、登录或首页阶段无条件预热 Three/GSAP。

## 决策

### GameModuleLoader Seam

- 新增 `GameModuleLoader` 深 Module。生产 Interface 只有 `prefetch(gameId)` 与 `load(gameId, options)`；CommonJS 专项测试可通过内部 `create(dependencies)` Seam 注入 Import/Warmup Adapter。
- T2 只统一六款现有的、游戏作用域的可选 Renderer entry；Loader 返回并验证 module namespace，不创建 Renderer Adapter，不调用 WebGL capability，不接管 Ghost3D Foundation 的 generation、context loss、recover 或 dispose。
- Loader 内部冻结六个 game ID、固定 primary/retry variant、预期导出、版本 URL 与完整 SHA-256。调用方不能提交 URL、路径、header、cache 名或任意资源类型。
- 同一资源的并发 load 单飞；只有验证通过的 namespace 进入最多六项成功缓存。预期的导入/导出失败返回分类化 inline fallback，不泄漏 URL、响应正文或原始异常；失败不永久负缓存。
- 六款现有 DOM/Canvas/程序化实现继续是永久 fallback。Loader 不注册游戏、不创建监听器或 Timer，也不读写 localStorage、账号、聊天、诊断网络或持久数据。

### Service Worker 显式意图预热

- Service Worker 只接受固定消息 `{type:'GAME_MODULE_WARMUP_V1', gameId, resource:'renderer', variant}`。URL 与 SHA-256 只能来自 Worker 内部固定 allowlist。
- Loader 与 Worker 位于不同运行域，各自保存部署清单；确定性 QA 必须逐项比较 game ID、variant、URL、SHA-256 与预期文件真实哈希，任何漂移均阻断门禁。
- 预热不是 install/activate/navigation/fetch/idle/hover 的副作用；登录、首页和四区初次渲染不得触发。`prefetch()` 只向当前同源受控 Service Worker 发送意图，不调用 `import()`，不执行 Renderer。
- Worker 只缓存同源、成功、`basic`、JavaScript MIME、非 `no-store` 且 WebCrypto SHA-256 与清单完全一致的响应。当前服务器没有 immutable header，因此本决策只称其为“哈希钉住的预热”，不冒充 HTTP immutable。
- API、WS、Auth、Chat、locale、JSON、Three/GSAP vendor、跨域和消息携带 URL 永远不进入该预热路径。网络、WebCrypto、quota、MIME 或 hash 失败只是不缓存，不破坏 Shell、locale 或现有 inline fallback。
- Renderer 专用 cache 与 Shell cache 分代；waiting Worker 不强制接管活跃对局，activate 只清理旧 Ghost Game generation。

### Build Operation Seam

- `node scripts/build.js --check` 在内存中生成 UTF-8/LF 产物并逐字节比较，只读、零临时文件、零 mtime 变化；drift 时非零退出。
- `node scripts/build.js --write` 只有在字节变化时才写同目录唯一临时文件，flush/fsync 后 rename 替换；任意写入、锁或 rename 失败都保留旧产物并清理本次临时文件，禁止先删除旧产物。
- 无参数继续兼容 `--write`。日志区分 characters、UTF-8 bytes 与 SHA-256；Quality Gates 使用 `--check`，不再通过先重写再比较掩盖 drift。

## 不在范围内

- 不把六款逻辑游戏工厂从 `index.html` 拆成 chunk，不改变同步 `createGameInstance()`。
- 不预热或默认启用 Three、GSAP、纹理、GLB、Atlas、AI Worker 或未审批美术。
- 不改变 Rule、Authority、Protocol、Reward、Replay、Economy、Social、Supabase 或 Renderer Contract。
- 不宣称首屏体积、FPS、内存、加载时延或包体已经改善；真实测量仍属于设备/浏览器/网络 Gate。

## 替代方案

- 直接把六款完整游戏拆包：拒绝。会改变同步注册与滚动兼容，必须另立 TECH-039 ADR 和迁移纵切。
- 把 Renderer/Three/GSAP 加入安装 Shell：拒绝。会扩大首屏与离线缓存面，并破坏 default-off。
- 只依赖 `?v=` 当作 immutable：拒绝。当前服务端没有不可变响应承诺。
- Worker `importScripts()` 外部共享运行时清单：本批拒绝。它会增加 Worker 启动依赖；采用双域固定清单 + 哈希一致性 Gate。
- 构建时先删除旧 `index.html` 再写：拒绝。Windows 文件锁或中断会留下缺失/半写产物。

## 证据与验收

- 本地合同/测试：T2 实施后补入 `GameModuleLoader`、SW 预热、build check/write、六款兼容、Quality Gates、完整 `npm test` 与确定性双构建结果。
- 当前施工状态：`IN_PROGRESS`；在专项和全链通过前不得写成 implemented。
- 外部门禁：第二真实浏览器、物理 Android/iPhone/Tablet、真实网络、真实 Supabase、多实例、人工美术与发布均为 `NOT_EXECUTED / BLOCKED`。

## 风险、兼容与回滚

- 动态 import 的浏览器模块缓存不可主动撤销；调用者现有 generation/epoch 仍负责丢弃迟到结果，Loader 不注册副作用。
- 无 Service Worker、旧 Worker、离线或预热失败时，`load()` 继续走浏览器按需导入；导入失败则六款保持现有 DOM/Canvas fallback。
- 新 Worker 保持 waiting 边界；旧标签不会在活跃对局中被强制切换 cache generation。
- 回滚时按同一批次恢复 Loader 调用、六款原导入、SW generation 与构建脚本；不删除用户数据、不改 Replay 或奖励历史。

## 后续动作

- 完成 T2 专项、共享门禁、完整回归和双构建后，把本 ADR 的证据从 `IN_PROGRESS` 更新为实际结果。
- 真正六款逻辑 code splitting、自动 hover/idle 预热、Worker/Atlas 或跨域 CDN 之前必须另立 ADR，不沿用本决策越权扩张。
