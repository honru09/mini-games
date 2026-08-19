# Production Readiness Sprint P0 验收

> **Historical policy note（historical-as-of，2026-08-16）：** 下文关于设备、第二浏览器、真实网络或 Supabase 的 `BLOCKED_EXTERNAL` / `BLOCKED_RESTART_REQUIRED` 表述仅是本批形成时的历史验收快照。当前设备/浏览器/网络与 Supabase Gate 均为 `NON_BLOCKING_FOR_DEVELOPMENT`；缺失的真实环境证据保持 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`。这不表示真实迁移、设备、网络、生产或发布证据已经完成，也不改变其完成定义；下方旧结果仅为历史留档，不再阻塞开发，发布仍须当前用户明确命令。

| Gate | Status | Required evidence |
|---|---|---|
| T-Spin/B2B/Combo/Perfect Clear shared rules | VERIFIED_AUTOMATED | Rule Core + Authority + Replay/Hash + emergency fallback tests |
| Supabase repeatable migration and static RLS/RPC | VERIFIED_LOCAL | schema/contract/ops script |
| Real Supabase DDL/RLS/concurrency/backup/restore | BLOCKED_EXTERNAL | real project credentials + timestamped output |
| Cluster lease/fencing/durable events | VERIFIED_LOCAL | schema + runtime contract; real multi-instance remains external |
| Durable telemetry/export fallback | VERIFIED_LOCAL | redaction/allowlist/private-address/retry contract |
| Desktop/mobile/tablet emulated matrix | BLOCKED_RESTART_REQUIRED | Browser resolves Node 20.20.2; persisted Node 24 setting needs Codex restart |
| Second browser and physical devices | BLOCKED_EXTERNAL | connected browser/devices |
| Two formal accounts online chat UI | PARTIAL | production formal-account WS chat passed; browser UI not executed |
| Weak network and 30-minute session | PARTIAL | 30-minute production WS PASS + logical chaos PASS; real shaping not executed |
| Honru/M0 technical cleanup candidate | VERIFIED_LOCAL | versioned source/hash/alpha/small-size review |
| Independent human Reviewer B / IP decision | BLOCKED_EXTERNAL | signed review record |
| PWA install/offline/update baseline | VERIFIED_LOCAL | manifest/SW/192+512 PNG/Apple icon/DOM/offline contract |
| Native/miniprogram/store release | BLOCKED_EXTERNAL | accounts/certificates/store evidence |
| Default-off engineering baseline release | RELEASED | commit `0c507ab`; Render live; Pages workflow success; HTTP/WS smoke PASS |

自动化、模拟设备或 Codex 审查不得替代标为 `BLOCKED_EXTERNAL` 的真实证据。

工程任务已收口为 `ACCEPTED`；Release Candidate 总状态仍为 `BLOCKED_EXTERNAL`，两者不得混淆。
