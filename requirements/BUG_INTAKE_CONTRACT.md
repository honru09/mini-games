# Ghost Game Bug Intake 与回归闭环合同

本合同规定缺陷从报告到关闭的最小流程，适用于浏览器、Game Stage、联机、账号、社交、商城、AI、性能和美术运行时问题。它不替代具体 Requirement、生产事故响应或真实外部门禁。

## 生命周期

`reported → triaged → reproduced → fixed → regression_verified → closed`；无法复现时使用 `needs_evidence`，外部依赖阻塞时使用 `blocked`，不得直接跳到 `closed`。

## 必填字段

- `bugId`：`BUG-YYYYMMDD-NNN`，稳定且不可复用。
- `summary` / `severity` / `area` / `firstSeen`：短句、P0–P3 和明确责任领域。
- `environment`：构建、浏览器/设备、语言、主题、网络条件；未知值写 `unknown`。
- `steps` / `expected` / `actual` / `reproRate`：最小复现路径和实际结果。
- `evidence`：截图、日志或测试入口；聊天正文、token、密码和个人数据必须脱敏或省略。
- `owner` / `linkedRequirements` / `status` / `fix` / `regression` / `rollback`：归属、需求、修复证据、回归命令和回滚点。

## 分级与边界

- P0：安全、数据丢失、全站不可用或正式结算错误；先阻断发布并建立回归。
- P1：核心游戏/账号/联机路径不可用或高频错误；修复后必须走完整相关链。
- P2：可绕过的体验/布局/文案问题；仍要记录真实环境和回归命令。
- P3：低风险 polish 或未来优化；进入排期，不用伪修复掩盖。

Bug 报告不得包含 API Key、Render/Supabase token、session token、密码、管理员凭证、私聊正文或未脱敏个人数据；日志只写摘要、ID、reason 和统计。

## 关闭条件

只有满足以下条件才可 `closed`：根因或明确阻塞已记录；修复代码/配置/文档已关联；专项回归通过；i18n、a11y、reduced-motion、断线/重开/换号边界按适用性检查；风险、回滚和未执行外部发布证据已写明。静态测试不能替代最新浏览器、真机、真实网络、生产 Supabase 或逐资产 `OWNER_AUTHORIZED_ART_CLEARANCE`；人工清稿、Reviewer B、IP/法律与 Golden Set 若未执行则记录为可选咨询，不能伪造 PASS，也不能级联为无关缺陷修复停工。
