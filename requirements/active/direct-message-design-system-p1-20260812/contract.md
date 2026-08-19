# Direct Message Design System P1 冻结合同

状态：`LOCAL_IMPLEMENTED / VERIFYING`  
归属：`UI-024 / UI-027 / UI-028 / SOC-012 / TECH-054`

## IN

- 保持单一 `DirectMessage.init/open/close/accept/reset` Interface 与 `direct-chat-v1` 状态源。
- 会话栏增加独立标题、连接状态、总未读、完整身份、消息摘要与安全时间元数据。
- 对话头组合 Avatar/Frame/Effect/NameFx、raw 名称与在线状态；消息正文和系统元数据分层。
- 桌面双栏、手机 `100dvh` + 四边 safe-area、44px、内部滚动与 overscroll containment。
- `GhostSurfaceMotion.run/settle/dispose/snapshot` 为共享表现 seam；DM 仅发 `open/thread/back/close` 四种语义阶段。
- GSAP 只在正常前台按需加载；Timeline 只动 transform/opacity，generation last-wins，可 kill/revert；reduced-motion、后台、Game Shell 和失败同步落位。

## OUT

- 不增加消息类型、协议字段、好友/Block/访客权限、正文存储、陌生人私信、Emoji、附件或 UGC。
- 不改变服务端、Supabase、经济、Profile 公开字段、游戏权威、Replay、奖励或未审批美术。
- 不使用 ScrollTrigger，不延迟业务状态提交，不以自动化冒充浏览器/真机可见验收。

## 验收 seam

- 产品 seam：`DirectMessage.open/accept/close/reset` + 实际 dialog DOM 可观察结果。
- 动效 seam：`GhostSurfaceMotion` 的窄 Interface + 私有 GSAP Adapter。
- 失败/取消：首次 lazy-load、sticky failure、rapid supersede、关闭后重开、后台、Game Shell、reduced-motion、dispose。
- 安全：玩家名字/摘要/正文只用 `textContent + data-i18n-raw`；系统文案只用三语 key。

## 外部门禁

- 最新本地浏览器初始化仍 `Transport closed`；桌面/平板/手机、第二浏览器、真实网络与 visible reduced-motion 为 `NOT_EXECUTED`。
- Terra Max 多条只读/实现/终审任务未在限时内返回可用成果，记录 reviewer limit，不冒充独立审查通过。
- 未提交、未推送、未部署。
