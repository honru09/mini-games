# Identity Presentation v1 Contract

## Interface

- `playerIdentityAvatarNode(profile, options)`：输出圆形 Avatar + Frame + Effect；未知/缺失字段安全回退，默认不播放动画。
- `playerIdentityNameNode(profile, options)`：输出 raw 玩家名 + 白名单 NameFx；系统 fallback 保持 i18n。
- `playerIdentityClusterNode(profile, options)`：组合 Avatar 和名字，可选 profile button/语言，不创建协议消息、不读取私有经济字段。
- `avatarStageNode/nameFxNode` 保持为兼容 Adapter。

## Invariants

1. 只消费服务端公开字段 `uid/name/avatar/frame/effect/nameFx/lang`；不消费或暴露 token、owned、coins、PIN、密码。
2. 玩家名字只通过 `textContent`/`data-i18n-raw`，系统 fallback 通过 `t()`。
3. Frame/Effect/NameFx 仅接受本地白名单 ID；异常值回退为 0。
4. 小列表与离屏入口默认静态；只有明确 `animate:true` 且非 reduced-motion 才播放 Avatar 动画。
5. 不修改购买、装备、Profile、Chat、Playline 或 Room 的服务端权威。
6. v3 Honru Pixel 当前继续 source-only；后续在逐族完成 M0 North Star、稳定 ID/版本/SHA/provenance、机器技术/视觉/相似风险审查、fallback、feature flag 与回滚后，可获得 `OWNER_AUTHORIZED_ART_CLEARANCE` 并写入可逆 runtime Manifest/Catalog 候选。人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 为可选咨询，不得伪造 PASS，也不得作为开发或 runtime 前置。

## Acceptance

- Seat 在本地 roster/profile 缓存缺失时仍显示服务端 Seat 的 frame/effect/nameFx/lang。
- 邀请、Social、房间浏览、私信列表与线程头、Playline 作者至少复用 Avatar/NameFx 的同一 Interface。
- 现有动态背景 fallback/lifecycle 回归全部通过且代码未退化。
- 三语言、DOM、Quality Gates、完整 npm test 和双构建稳定通过；浏览器/真机外部门禁若连接器不可用必须保持 NOT_EXECUTED。
