# Identity / Avatar / Background P1 本地实现收口

> 时间：2026-08-12 12:05（Asia/Tokyo）  
> 状态：本地 `implemented / VERIFYING`；未提交、未推送、未部署，不等于浏览器/真机/美术审批通过。线上仍为 `da3d05c`。

## 本批归属

- 需求：`ART-020 / ART-021 / UI-022 / UI-023 / SOC-001 / ECO-013 / ECO-014`。
- 明确排除：大富翁角色 Renderer 的 `UI-037 / ART-036 / GAME-045`，不再把两条主线混为一批。
- 总需求保持 242；主线路由保持 `146 / 32 / 48 / 16`。

## 完成内容

- 新增统一身份深模块 `public/src/core/10-identity-presentation.js`，以三个小 Interface 集中 Avatar、Frame、Effect、NameFx、raw 名字、语言旗帜、非法字段回退和动画默认策略。
- 旧 `avatarStageNode/nameFxNode` 保留为兼容 Adapter；单独抽取的旧页面/QA 在新模块不存在时仍回退旧 Adapter，不抛 `ReferenceError`。
- 修复房间 Seat 在本地 Profile 缓存未命中时丢失服务端 `frame/effect/nameFx/lang` 的问题。
- Lobby 服务端公开摘要增量下发 `hostFrame/hostEffect/hostNameFx`；前端房主头像和名字显示完整公开身份，旧客户端可忽略新增字段。
- 邀请、Social、玩家列表、全局 DM 列表/线程头、Playline 作者均接入统一身份表现；没有新增聊天/帖子 wire，也没有读取 owned、余额、凭证或私有经济字段。
- 修复 DM 标题从系统空态切到玩家身份后仍残留 `data-i18n`、语言切换会覆盖闪名子节点的问题。
- Avatar v2 的 48 款素材全部保留；目录内 12 款历史 `free` 标记继续兼容，但新用户默认免费策展仍只展示像素 100/101。
- Premium Background 的真实 animated WebP、preload、poster/static fallback、visibility/离屏、运行中 reduced-motion、release 与迟到资源事件合同保持通过。
- Honru Pixel v3 五份源图、十五份 Alpha 修复稿与四个入选技术候选全部保留为 source-only；runtime 引用为 0。

## 主负责人审核与纠正

1. 恢复 DM 会话行既有 56px 触控合同，40px Avatar + 上下 8px padding 仍完整容纳，不通过修改测试掩盖回归。
2. 为独立抽取的 Online/Playline 消费者增加旧 Adapter fallback，防止模块加载环境差异造成整个社交界面崩溃。
3. 修复 DM 系统文案 → 玩家 raw 身份的 i18n 属性转换，语言切换不再删除 NameFx 子节点。
4. 修正 `PROJECT_STATUS.nextStage` 将 `UI-037` 错归 Avatar/背景批次的漂移。

## 测试证据

- `qa/identity-presentation-contract.js`：15 项通过。
- Room/Stage/Profile/DM/Playline/Shop/Avatar/Background/Honru source-only 专项：全部通过。
- 三语言：1631 个同构 key，通过。
- `node qa/dom-smoke.js`：通过。
- `npm run quality:gates`：通过。
- 最后一处 DM i18n 属性修复后的完整 `npm test`：通过，166.5 秒。
- 双构建：1,317,990 characters / 1,332,539 bytes；SHA-256 两次均为 `1E878CC3B8B8985B58601BD5F34A1F8FB884989A6A94E7815528E25F63E4A44B`。
- Terra Max 终审及其客户端安全、服务端/测试两条子审查在多次限时催交后未返回可用 findings，已停止空转并按 `reviewer limit` 如实记录；这不冒充独立 Reviewer 通过。主负责人以身份专项、DM/Playline/Room、i18n、DOM、Quality Gates、Security/Protocol 和最新完整全链结果完成本地代码审核。

## 未完成与边界

- 浏览器连接器未恢复，最新 390/844/1024/1440 可见矩阵、第二浏览器、Android/iPhone/Tablet、visible reduced-motion 与低端帧耗仍为 `NOT_EXECUTED`。
- `ART-021` 继续为 `partial`：最终动态背景重绘与人工美术审批尚未完成。
- Honru Pixel v3 仍缺人工清稿、Reviewer B、IP Review、用户 Golden Set 和 44/64/96/192px 真机矩阵；不得进入 runtime Manifest/Catalog/商城/默认头像。
- 没有新增图片：本批优先解决“现有美术没有实际出现在真实入口”的覆盖问题，避免继续制造未接入素材。
- 本地实现步骤已收口；批次总状态继续为 `VERIFYING`，仅因为浏览器/设备与人工美术外部门禁尚未解除，而不是仍有已知本地代码步骤遗漏。
