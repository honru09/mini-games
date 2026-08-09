# Shared Change Request：Honru P2 表现层纵切

## 共享文件

- `public/assets/manifests/asset_manifest.json`：新增 `P-HONRU-STATES-V1` 默认关闭资产组。
- `asset-library/catalog.json`：新增匹配的 `integrated-local-only` 运行时预览条目并同步 Manifest hash。
- `public/src/core/06-assets.js`：增加双闸门、状态 allowlist、Manifest 严格解析与 v1 fallback。
- `public/src/core/01-utils.js`：在既有 `playFeedback()` 结束后调用纯表现钩子。
- `public/src/core/02-app-shell.js`：创建/清理 `board-area` 内的 Honru 反应节点与平台状态映射。
- `public/src/core/03-game-framework.js`：在 restart/destroy 统一清理表现节点与异步加载世代。
- `public/src/core/05-ai-personas.js`：只在明确的一次 AI 思考语义上触发节流后的 `thinking`，不解析本地化文案。
- `public/src/games/ludo.js`：把反馈移到合法动作真正提交后，覆盖本地/AI/远端且排除无效点击。
- `public/src/games/xiangqi.js`：保留 `board-area` 下的共享表现层，不让棋盘重绘立即删除反应节点。
- `public/src/shop/04-auth.js`：登录页主题按钮同步图标、title 与 aria-label。
- `public/index-template.html`：修复登录 Logo dark filter，并增加 Honru 反应样式/reduced-motion。
- `qa/ghost-shell-contract.js`、`qa/asset-manifest-v2.js`、`qa/honru-runtime-contract.js`、`qa/dom-smoke.js`：锁定主题、双闸门、allowlist、生命周期、fallback 和规则隔离。
- `package.json`：登记 Honru P2 专项测试并纳入完整测试链。
- `public/index.html`：只由 `scripts/build.js` 生成。

## 契约影响

- 不新增服务端/WebSocket/Supabase/Reward 字段。
- 状态只存在 DOM dataset/class 和图片路径，不进入任何 game snapshot 或 Replay。
- 默认关闭；双旗标严格为 `1` 后才从 Manifest 读取九状态 WebP。

## 兼容与回滚

- v1 Honru SVG 和既有 `playFeedback` 音效/震动继续工作。
- 资源/Manifest/旗标失败时不渲染或回退 v1；删除任一旗标即可即时回滚。
