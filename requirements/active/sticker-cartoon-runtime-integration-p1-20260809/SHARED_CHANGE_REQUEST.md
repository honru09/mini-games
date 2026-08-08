# Shared Change Request：M0 P1 五子棋运行时纵切

## 请求原因

P1 需要由 Master 串行更新运行时 manifest、资产解析器、五子棋绘制层与 QA。普通美术/子 Agent 不得直接编辑这些共享文件。

## 共享文件与变更

- `public/assets/manifests/asset_manifest.json`：新增版本化 Sticker Gomoku asset、双 flag、fallback、hash 与预算。
- `asset-library/catalog.json` / `scripts/asset-library-audit.js`：登记 P1 provenance/runtime 映射，并让审计器读取项目自有 SVG 尺寸、区分封面与非封面资产。
- `public/src/core/06-assets.js`：新增严格默认关闭的 M0 双闸门解析器，不改变旧 `gameArtEnabled()`。
- `public/src/games/gomoku.js`：只消费已解析的表现配置，不修改规则状态、坐标或协议。
- `public/index-template.html`：补充 `<=480px` 游戏顶栏两行布局，消除三语言长标题与操作按钮重叠。
- `qa/asset-manifest-v2.js` / `qa/sticker-art-contract.js` / `qa/dom-smoke.js`：增加默认关闭、双闸门、SVG 安全、fallback 与规则不变证据。
- `qa/ui-responsive-contract.js`：锁定窄屏顶栏网格、标题截断和操作按钮等分合同。
- `public/index.html`：仅通过 `scripts/build.js` 重建。
- `PROJECT_STATUS.json` / README / 三份中文日志 / 简易报告：验证后同步事实，不提前声明完成。

## 不影响消费者

- 服务端、WebSocket、注册表、AI、奖励、商城、Supabase、Replay、赛事与其测试不改字段也不改行为。
- `>=481px` 游戏顶栏布局保持既有桌面/平板语义；窄屏修复不改变按钮行为或 i18n 文案。

## 兼容与失败

- 双 flag 未显式开启时完全不进入 P1；任一加载失败回退旧五子棋绘制层。
- 资源错误不得触发状态写入、网络消息、奖励或用户可见裸错误。

## 验证与回滚

- 新增专项合同后运行 `npm run quality:gates` 与完整 `npm test`，再完成双主题/三语言/五宽度浏览器预览。
- 快速回滚为删除/置 `0` 任一 P1 flag；代码回滚为 P1 独立提交，基线 `c0140c9` 保持可恢复。
