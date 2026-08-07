# Playroom High Risk Register

最后更新：2026-08-08（Asia/Tokyo）

| 文件/模块 | 风险 | 原因 | 规则 |
|---|---|---|---|
| `server/index.js` | HIGH | 认证、房间、结算、AI、赛事共享入口 | Master only；先写契约与测试 |
| `public/src/online/03-websocket.js` | HIGH | 客户端协议消费者、重连和结算 | 必须与服务端成对修改 |
| `scripts/build.js` | HIGH | 源码到生成 `public/index.html` 的唯一顺序 | 改后必须 Build Drift gate |
| `public/src/08-registry.js` | HIGH | 全局游戏注册表和能力发现 | 只由集成任务修改 |
| `server/gameplay/**` | HIGH | Authority、赛事、观战和实时模拟 | 先更新 Authority Matrix |
| `shared/rules/**` | HIGH | 规则核心被客户端/服务端/QA 共用 | 禁止夹带 UI 或奖励逻辑 |
| `server/reward-engine.js` | HIGH | 金币、XP、幂等和经济流水 | 只能服务端权威修改 |
| `supabase/schema.sql` | HIGH | RLS、RPC、持久化契约 | 迁移必须可重复并有 adapter 回归 |
| `public/src/core/00-i18n.js` | HIGH | 所有动态文字和错误 reason | 三语同构、运行时切换回归 |
| `public/index.html` | HIGH | 生成产物，非源码 | 禁止手工编辑，必须由 build 生成 |
| `public/assets/manifests/asset_manifest.json` | MEDIUM | 资源 ID、路径、fallback | 资源任务必须同步 asset QA |
| `README.md` / `AGENTS.md` / `WHITEPAPER.md` | MEDIUM | 项目事实会漂移 | 代码和测试先于文档 |

## 共享文件变更流程

普通 Agent 不得直接修改 HIGH 文件。先在任务目录创建 `SHARED_CHANGE_REQUEST.md`，说明字段、影响消费者、兼容策略、
测试和回滚点，由 Master 集成。
