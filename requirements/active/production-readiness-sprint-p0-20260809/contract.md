# Production Readiness Sprint P0 合同

状态：`FROZEN`

## Tetris Advanced Battle Scoring v1

- 新规则协议为 `tetris-rule-v3`；旧 v2 严格客户端不协商 v3 时回退 `tetris-battle-authority-v1`，避免滚动发布期间拒绝新字段。状态新增 `scoringVersion='advanced-battle-score-v1'`、`level`、`combo`、`backToBack`、`backToBackCount`、`tSpins`、`tetrises`、`perfectClears`、`lastAction`。
- 本版实现 T-Spin（非 Mini）、B2B、Combo、Perfect Clear 的平台战斗子集；暂不宣称完整 Guideline，软降/硬降逐格分、T-Spin Mini 与 B2B Perfect Clear 细分数值不在本轮。
- 基础消行分为 `0/100/300/500/800 × level`；T-Spin `0/1/2/3` 行为 `400/800/1200/1600 × level`；Combo 为 `50 × combo × level`；B2B 行分倍率 1.5。
- 基础攻击为 `0/0/1/2/4`，T-Spin 为 `0/2/4/6`，B2B `+1`，Combo 档位为 `0/0/1/1/2/2/3/3/4/4/4/5`，Perfect Clear `+10`，单次总攻击封顶 12。
- Lock event 新增 `clearType`、`tSpin`、`backToBack`、`backToBackBonus`、`combo`、`comboBonus`、`perfectClear`、`perfectClearBonus`、`scoreDelta` 与 `attackBreakdown`。
- T-Spin 只在 T 方块最后一次有效移动为旋转且旋转中心四角至少三角被占/越界时成立。
- B2B 由 Tetris 或带消行 T-Spin 延续；普通消行打断，零消行不打断。
- Combo 只随连续有消行的锁定递增；无消行重置为 `-1`。
- Perfect Clear 在消行后棋盘为空时成立；攻击、计分和结果都由服务端共享核心产生。

## Supabase Production Ops v1

- `SUPABASE_DB_URL` 只供 `psql/pg_dump` 子进程读取；脚本不回显连接串。
- migrate：先备份 schema/data，再在事务中执行可重复 `schema.sql`，随后运行 production acceptance SQL。
- 备份目录从仓库排除；Windows 必须启用当前用户独占 ACL + EFS，其他系统必须由操作者确认加密卷并使用 `0700/0600` 权限。失败残片立即清理，默认只保留 7 天（可配置 1–30 天）。
- rollback：默认只回滚应用配置/功能开关；数据库 rollback 只执行明确的非破坏补偿 SQL，不 DROP 表或用户列。
- 并发探针使用唯一命名空间和事务清理，重复 result/clientMessageId 只允许一个成功写入，其余必须得到幂等终态。

## Cluster Coordination v1

- 表：`cluster_instances`、`cluster_leases`、`platform_events`、`cluster_event_cursors`、`metrics_snapshots`。
- 事件字段：服务端 ID、topic、dedupe key、payload 白名单、created/expires；正文和秘密字段禁止。
- 单写者通过数据库时间与租约 fencing token 获取；过期 token 不能续租或提交受保护任务。
- PubSub 为 durable polling baseline，不宣称低延迟 Realtime；实例恢复按游标重放并按 event ID 去重。

## Telemetry Export v1

- 可选 `TELEMETRY_WEBHOOK_URL` 与 `TELEMETRY_WEBHOOK_TOKEN`；只发送聚合指标、稳定错误码和部署/实例 metadata。
- URL 必须 HTTPS；每批有大小、频率、并发和重试上限；失败不影响游戏、聊天、奖励或登录。

## Art Approval

- 自动技术清稿和 Reviewer A 只能给出 `TECHNICAL_PASS` 或 `REWORK_REQUIRED`。
- 原创 Ghost-native 资产在 M0 North Star、稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚齐全后，可取得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并进入可逆 default-on runtime 候选。
- Reviewer B 若执行必须是独立自然人并填写姓名/日期/七维相似度/利益冲突声明；人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，未签字只表示咨询未执行，不得写成 PASS，也不得阻塞开发或 runtime。
- 真实设备矩阵作为 `RELEASE_EVIDENCE_PENDING` 独立记录；默认开启候选仍必须满足 Art Bible/M0、机器审查、fallback、性能、所有者清除与一键回滚，发布必须另有当前用户明确命令。

## Failure and rollback

- Tetris 高级计分异常：通过 `TETRIS_GUIDELINE_SCORING=0` 让在线房间回退既有 v1 Coordination（本地/AI 仍使用高级表现）；整站回退使用发布提交回滚点。
- Cluster/Supabase/Telemetry 未配置或失败：回退当前单实例 JSON + 本地 Metrics，不阻塞六款游戏。
- PWA 缓存异常：network-first HTML + 版本化缓存，激活时清理旧缓存；用户可正常在线刷新恢复。
- 新美术失败：所有旗标关闭并回退已发布 Honru v1/P1/程序化资产。
