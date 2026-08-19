# UI Repair P0.9：玩家 Direct Chat 表现层

状态：`COMPLETED_LOCAL`

时间：2026-08-10（Asia/Tokyo）

## Goal

在既有 `direct-chat-v1` 玩家私聊协议之上补齐可感知的表现状态：会话刷新/连接状态、历史加载、日期分隔、未读语义、窄屏输入和加载更早消息时的阅读位置保持，让玩家在手机、平板和桌面都能清楚知道“正在同步、可读、可发、失败或只读”。

## IN

- 会话列表刷新状态使用 `role=status`、`aria-live` 和 `aria-busy`，真实断线清理加载态但保留安全缓存正文。
- 会话入口提供公开玩家 aria-label 与未读数量语义。
- 消息线程增加今天/昨天/日期分隔和历史加载态。
- 加载更早消息时保持滚动锚点，不因重渲染强制跳到底部；按钮就地进入加载/忙碌状态。
- 移动输入增加 `enterkeyhint=send`、安全区 padding、overscroll 防护和窄屏 44px 操作。
- 三语新增文案；新增 presentation-only QA 并纳入 pretest/full test。

## OUT

- 不新增或修改 WebSocket 消息类型、好友/Block/举报权限、消息正文净化、seq/idempotency、Supabase/RLS、数据库、奖励、Replay、AI、游戏规则或美术。
- 不把访客变成可持久聊天用户，不改变已实现的离线留言和历史只读边界。
- 不提交、不推送、不部署。

## 外部边界

第二浏览器、Android/iPhone/Tablet、真实网络整形和 in-app Browser 可见复核仍需外部条件；自动化合同不能替代这些闸门。
