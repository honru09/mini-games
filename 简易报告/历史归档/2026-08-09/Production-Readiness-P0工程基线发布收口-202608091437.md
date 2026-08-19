# Production Readiness P0 工程基线发布收口

时间：2026-08-09 14:37（Asia/Tokyo）

## 结论

工程基线已经发布到线上，提交为 `0c507ab1611a04d01351bd655ce536556d128b8d`。Render 为 `live`，GitHub Pages 工作流成功，线上 HTTP 与 WebSocket 冒烟通过。当前阶段是“工程实现已发布，外部生产验收待完成”，Release Candidate 继续保持 `BLOCKED_EXTERNAL`。

## 本轮完成

- Tetris `tetris-rule-v3`：T-Spin（非 Mini）、B2B、Combo、Perfect Clear、高级计分/攻击、Replay/Hash；旧 v2 与 `TETRIS_GUIDELINE_SCORING=0` 回退 v1 Coordination。
- Supabase 工具链：可重复 Schema、RLS/RPC 静态合同、默认 dry-run、加密/ACL 备份、事务迁移、并发验收 SQL、隔离恢复、非破坏回滚。
- 多实例/遥测工程基线：数据库时间租约、fencing token、持久 ID-only 事件/游标、Direct Chat 正文回库读取与 token 复核、脱敏指标和 HTTPS allowlist 出口；默认关闭，Render 仍为单实例。
- PWA：Manifest、Service Worker、192/512 PNG、Apple touch icon、network-first HTML 和敏感请求不缓存。
- Honru：非覆盖 cleanup candidate、Alpha 与 44/64/96/192px 技术检查通过，Reviewer B/IP/Golden Set 签字包齐全；运行时与默认旗标未改。
- 30 分钟生产正式好友 WS 会话：15 条消息、15 次已读、2 次重连、0 异常断开、P95 181ms。

## 验证与上线

- `npm run quality:gates`：PASS。
- 完整 `npm test`：PASS（182.9 秒）。
- Render：`dep-d9s11mdbedkc73claakg`，精确 SHA 部署，状态 `live`。
- GitHub Pages：[workflow 31296973496](https://github.com/honru09/mini-games/actions/runs/31296973496) 成功。
- 线上地址：[Pages](https://honru09.github.io/mini-games/)；[Render](https://mini-games-online.onrender.com)。
- 回滚点：`2213493b0f8f8f870c2bc4a65175da142ed02062`；Tetris 可用环境开关回退，Cluster/Telemetry 与新美术均默认关闭。

## 尚未执行（不能伪造完成）

1. 真实 Supabase 迁移、浏览器角色 RLS、真实并发、加密备份、隔离恢复与回滚：缺 DB URL、项目 URL、service-role 和数据库工具。
2. 当前浏览器 UI、第二浏览器、Android/iPhone/Tablet 与真实网络整形：浏览器连接器当前进程仍解析 Node 20.20.2；已持久配置 Node 24，需重启 Codex。
3. 人工清稿、独立 Reviewer B、IP Review、用户 Golden Set 与默认开启审批：必须由真人签字。
4. Reward/AI outbox 的真实多实例 fencing、外部遥测接收端：真实 Supabase/多实例前保持关闭。
5. 微信小程序、原生 App 与商店发行：需要开发者账号、证书、真机与审核。

以上外部闸门完成前，不得把工程基线发布描述为 `PRODUCTION_READY`。
