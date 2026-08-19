# Playline Community P0 本地收口简报

时间：2026-08-11 13:03（Asia/Tokyo）

## 结果

- 四区本地改为 Home / Games / Playline / Profile；好友私信收进全局 DM dialog，继续唯一复用 `direct-chat-v1`。
- Playline P0 已完成纯文本、游戏分享、正式结果分享、权威记录分享、All/Friends、删除、举报、Block、签名 cursor、幂等和频控。
- `ENABLE_PLAYLINE_V1` 默认关闭；guest 与 Test Admin 不读写玩家 UGC。
- 完整 `npm test` 150.4 秒通过；Quality Gates 通过；双构建稳定为 1,095,185 bytes，SHA-256 `DF714E6CC84235A423DDCD70982D7DD04EA59405D2DCBD56FF8067ED02024D56`。

## 主审修正

- 去除重复 Direct Message 模板，保留 Presenter 唯一 DOM 所有者。
- 去除不存在的 Supabase `find_playline_post_v1` 默认依赖，依靠事务型创建 RPC 幂等。
- 修复 DM 错误本地化、重复空态、手机返回按钮和语言切换 Audience 文案。
- 完整链发现 Home Pulse / Home Identity 仍断言旧 Chat Page；已迁移为验证全局 `DirectMessage.open` seam，并重跑全链通过。

## 未完成门禁

- 真实 Supabase 迁移、RLS、并发、加密备份、隔离恢复和非破坏回滚。
- 生产内容治理、人工运营审核、第二浏览器、真机与真实网络整形。
- 本批未提交、未推送、未部署；线上仍为 `da3d05c`。
