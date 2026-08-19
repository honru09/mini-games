# Honru Runtime Integration P2 验收标准

> **Historical policy note（historical-as-of，2026-08-16）：** 本文中的旧 `BLOCKED`、人工美术、Reviewer B、IP/法律与逐资产 Golden Set 表述仅代表本文形成时的历史快照，不覆盖当前权威政策。原创 Ghost-native 资产满足 `OWNER_AUTHORIZED_ART_CLEARANCE` 后可进行可逆 `default-on` runtime 接入；人工清稿、独立自然人 Reviewer B、IP/法律意见与逐资产 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE`，未执行时须如实保留且不得冒充 `PASS`。设备/第二浏览器/真实网络与 Supabase Gate 当前为 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`；外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材永久禁止复制、派生、作为生成输入、接入 runtime 或发布。任何接入结论均不授权发布，commit、push、Pages、Render 或生产发布仍须当前用户明确命令。

- 登录前 `light/dark` Logo 均可见；Logo dark selector 静态存在且不改变主图 SVG。
- P2 两旗标缺失/异常/任一非 `1` 时完全关闭；显式双 `1` 才显示状态预览。
- 九状态运行时 WebP 有 Alpha、尺寸/hash/字节预算/Manifest/fallback 一致；不预加载整组。
- 六款游戏通过共享 `playFeedback` 触发表现反应；旧规则快照、AI、联机协议、奖励和输入行为完全一致。
- `board-area` 反应不遮挡关键控件；销毁/换局/离开清理节点与计时器；reduced-motion 无持续动画。
- 签到、聊天、邀请、等待、结算状态映射只存在表现层并能回退 v1。
- 三语言与昼夜主题切换不出现裸 key、中文泄漏或黑字黑底；360/390/768/1024/1440 不溢出。
- `asset-manifest-v2`、`asset-library-audit`、Ghost Shell、DOM、完整 `npm test` 与 `quality:gates` 通过。
- 默认关闭、人工/IP/真实设备闸门未完成前不得标记 production-ready；上线只发布代码与默认关闭配置。

## 2026-08-09 自动化验收结果

- `npm run quality:gates`、完整 `npm test`、33 项 `qa/honru-runtime-contract.js`、资产 Manifest/素材库/DOM/AI/Gameplay 回归全部通过。
- 九状态总包体 `372796` bytes，低于 `512 KiB` 组预算；旧 v1/v2、M0/P1、五子棋与俄罗斯方块既有表现均保留。
- 本地 `360/390/768/1024/1440 × light/dark × 三语言` 浏览器矩阵因 in-app Browser 权限被拒绝而未执行，已单独记录，不能视为视觉通过。
- 结论：满足“双旗标默认关闭的安全代码上线”，不满足“默认开启/人工 Golden Set/生产视觉就绪”。

## 2026-08-09 线上发布结果

- P2 独立提交 `551b91a` 已随发布提交 `94ae977` 推送至 `main`，Render 部署 `dep-d9rvbfv10e5c738tnclg` 为 `live`，GitHub Pages 工作流 `31292922140` 成功。
- Render 与 Pages HTTP 均返回 200，并包含 Honru/Chat/Profile 新运行时；线上临时账号 WebSocket 建房、READY、落子、多人房和结算冒烟通过。
- 两个 Honru 旗标仍默认缺失，生产展示继续使用冻结 v1 fallback；本次发布不等于默认开启审批。
- 本轮可见浏览器控制因本机 Node 20.20.2 低于连接器所需 22.22.0 未执行，真实设备、人工 Art Bible/IP Review 仍为外部闸门。
