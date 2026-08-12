# Direct Message Design System P1 本地实现收口

> 时间：2026-08-12 13:27（Asia/Tokyo）  
> 状态：本地 `implemented / VERIFYING`；线上仍为 `da3d05c`，未提交、未推送、未部署。

## 玩家能看到什么

- 私信继续是全局弹窗，不占第五个 Page；桌面为清楚的会话栏 + 对话双栏，手机为全屏会话/线程切换。
- 会话栏现在有独立标题、消息服务状态、总未读、好友完整身份、摘要和本地化时间。
- 对话头展示好友头像组合、闪名与在线状态；消息正文、时间和“已发送/发送中/失败重试”不再挤成一团。
- 四边安全区、`100dvh`、44px 操作、内部滚动与 overscroll 已纳入合同。
- 打开、切入线程、返回、关闭接入有限 GSAP 动效；首次加载、后台、局内、reduced-motion 或模块失败时立即稳定落位，不阻塞私信功能。

## 主负责人纠正

1. “已发送”不能复用“可以发送”，新增三语 `direct_message_sent`。
2. 消息时间跟随当前站内语言，非法时间不显示。
3. 关闭动画不能在开始前被 `hidden`；重开会同步清除 closing 交互锁。
4. reduced-motion、后台和 Game Shell 不应下载可选 GSAP；加载失败也不能永久报告 loading。
5. 旧 raw/XSS 动态测试跟随新的 `.direct-message-bubble-body` seam，仍验证 `<img onerror>` 只作为纯文本。

## 测试

- 新合同：18 项；Surface Motion 运行时：12 项；GSAP Adapter：9 项，全部通过。
- Direct Chat 静态/动态、Playline、Identity、Profile/Social、三语言 1632 keys、在线私信权限/幂等/Block/token 淘汰均通过。
- 新 Motion 执行测试正式进入主入口后的完整 `npm test` 用时 147.1 秒，全部通过。
- 双构建稳定为 1,333,055 characters / 1,347,604 bytes，SHA-256 `0546BBFB5C2FACA13D9D3D9C121FFBA7A1C48E9C98D5A516DA23C25EA2BCAB62`。

## 未完成

- 浏览器连接器仍在初始化阶段返回 `Transport closed`，所以最新桌面/手机可见矩阵、第二浏览器、真机、真实网络与可见 reduced-motion 均为 `NOT_EXECUTED`。
- Terra Max 任务未返回可用成果，按 reviewer limit 记录，不冒充独立审查通过。
- Profile Design System 是下一独立纵切；本批没有夹带 Profile 大改、协议、数据库、经济或美术。
