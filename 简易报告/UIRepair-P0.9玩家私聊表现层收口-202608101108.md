# UI Repair P0.9 玩家私聊表现层收口

时间：2026-08-10 11:08（Asia/Tokyo）

## 完成内容

- 会话列表增加连接/刷新 live status、`aria-busy` 与真实 loading 分支。
- 每个会话入口增加公开玩家可访问名称；未读角标增加本地化数量语义。
- 消息线程增加历史加载态、今天/昨天/完整日期分隔；正文继续只用安全 raw text 节点。
- “加载更早消息”会保存当前滚动高度与位置，响应后恢复阅读锚点，不再强制跳到底部。
- 真实断线只清理 chat pending 状态，不清除已缓存历史或内存草稿。
- 手机输入增加 `enterkeyhint=send`、底部安全区和 overscroll 防护；加载旧页按钮保持 44px。
- `direct-chat-v1` 消息类型、好友/Block/访客权限、正文净化、Supabase/RLS、持久化全部不变。

## 主负责人审核与修正

- 首版点击“加载更早消息”后立即重渲染，会提前消费滚动锚点；已改为按钮就地进入 busy/加载态，只在响应或错误收口时恢复锚点。
- 首版断线路径未清理新 pending 标志，可能一直显示“刷新中”；已在真实断线时清理，同时保留历史和草稿。
- 修正时保留了 Social Match 的连接级 capability guard，专项生命周期回归已通过。

## 测试

- `node qa/ui-chat-presentation-contract.js`：通过。
- `node qa/player-chat-contract.js`：通过。
- `node --experimental-websocket qa/player-chat-online.js`：通过。
- `node qa/social-match-client-lifecycle.js`：通过。
- `npm run test:i18n`：通过（1344 keys）。
- `node qa/dom-smoke.js`：通过。
- 完整 `npm test`：通过，113.2 秒。

## 构建与边界

- `public/index.html`：924691 bytes。
- SHA-256：`1E00C59C0C6E5FA197BD7C4DB2EA60795897A5CB2992340863FF5F78199133F5`。
- 第二浏览器、Android/iPhone/Tablet、真实网络整形和 localhost 可见复核仍未执行。
- 未 commit、未 push、未发布 GitHub Pages、未部署 Render。

## 下一主线

进入 Social Match P1 房间自由文本聊天。该任务必须独立冻结 wire 协议、文本净化、Block、举报、静音、频控、访客/观众边界、生命周期、三语与移动输入；原创 Honru Emoji 仍走独立 Art M1 审批，不阻塞基础文字功能。
