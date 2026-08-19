# Shared Change Request — Production Readiness Sprint P0

状态：`APPROVED_BY_MASTER`

## 共享文件

- `shared/rules/tetris.js`、`server/gameplay/tetris-rule-authority.js`、`public/src/games/tetris.js`：高级计分单一真相、权威快照与旧客户端兼容。
- `supabase/schema.sql`、`server/index.js`、`server/gameplay/metrics.js`：租约、持久事件、实例游标、指标快照与可选导出。
- `public/index-template.html`、`public/index.html`、`package.json`：PWA 注册、专项测试与生成产物。
- `art-source/**`、`asset-library/**`、Manifest：只新增版本化清稿候选与审查记录，不覆盖运行时默认资产。

## 安全与兼容

- Tetris 高级计分不进入平台奖励 Resolver；新字段由 `tetris-rule-v3` capability 协商，旧 v2 客户端回退 v1 Coordination。
- Cluster/Telemetry/Supabase 全部在环境变量缺失时关闭，现有单实例行为不变。
- 所有跨实例 payload 有白名单和秘密字段拒绝；聊天正文永不进入事件/指标。
- PWA 不缓存鉴权 API、WebSocket、用户正文或 token。
- 新美术默认关闭，失败回退现有资产。

## 必测

- Tetris Rule Core、Rule Authority online、Protocol、E2E。
- Supabase schema/fake adapter/security/reconnect/chat。
- DOM/i18n/PWA/offline、asset/sticker/Honru contracts。
- Quality Gates 与完整 `npm test`。
