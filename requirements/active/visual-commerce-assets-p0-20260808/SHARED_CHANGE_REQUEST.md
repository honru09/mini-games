# Shared Change Request

## 共享文件

- `public/src/core/00-i18n.js`：如现有语言就绪事件不足，增加可重放的就绪通知/刷新钩子。
- `public/assets/manifests/asset_manifest.json`：登记四张大厅封面和素材来源。
- `public/index.html`：仅由 `node scripts/build.js` 生成。
- `package.json`：把素材库与商城契约回归纳入统一测试入口，不引入依赖。
- `public/src/ui/07-roster.js`：仅对齐客户端展示目录与服务端现有价格，并隐藏不可购买 Starter Background 入口。
- `qa/asset-manifest-v2.js`、`qa/dom-smoke.js`、`qa/i18n-coverage.js`：补六封面、游戏顶栏与三语商品名回归。
- `README.md`、`WHITEPAPER.md`、`PROJECT_STATUS.json`：仅在代码与验证完成后同步事实。

## 兼容策略

- i18n 新钩子为增量事件，不改变 `t()`、`setLanguage()` 和服务端 reason 合同。
- 新封面只有表现层路径；旧客户端、加载失败与 feature flag 都继续使用 Emoji/CSS fallback。
- 商城只重排展示层，不改变服务端目录、价格、购买或装备协议。
- `public/src/online/03-websocket.js` 保持 forbidden；滚动锁通过通用工具与 DOM 自动回收完成，不在联机高风险文件加入逻辑。

## 验证与回滚

- 验证：i18n runtime、DOM smoke、asset manifest、game cosmetic profile、完整质量门禁。
- 回滚：删除新事件消费者/manifest 项与封面文件，重新构建即可恢复上一提交；服务端数据无需迁移。
