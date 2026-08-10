# Profile Compare P1 正式好友战绩比较收口

时间：2026-08-10 14:50（Asia/Tokyo）

## 完成内容

- 新增 `profile_compare/profile_compare_data/profile_compare_error` 成对消息；仅正式账号、当前好友且双方未 Block 时允许比较。
- 每次请求由服务端重新校验权限；回执绑定 `requestId + targetUid`，解除好友或 Block 后立即撤权。
- 返回字段严格窄化为公开身份、等级、总局数、总胜场、六款权威胜场/派生称号和成就数量。
- 好友 Profile 增加比较入口；桌面双列、手机单列，支持加载、取消、迟到响应丢弃、焦点循环、Esc、背景关闭、滚动锁和焦点恢复。
- 三份 locale 同步；玩家名字继续使用原文安全节点。

## 主负责人审核修正

- 没有复用或扩张公开 `profile_get`，避免把公开资料接口变成好友私有数据通道。
- 明确禁止余额、owned、价格、购买记录、任务、回放、最近对手、在线偏好、token 和 username 进入比较投影。
- 修复 `resetState()` 把 Profile Compare 清理并入旧聊天单行合同导致的静态回归：保留 Direct Chat 原清理块，比较请求使用独立连接级清理块。

## 验证

- Profile Compare 合同、三账号在线权限、Direct Chat 表现、Profile/Social、三语言和 DOM 专项全部通过。
- 完整 `npm test`：118.1 秒通过。
- 双构建一致：951578 characters、965692 physical bytes、SHA-256 `5528D0C6A15C42D096E92B2BA8A7454C1C9332FA414A52497312325496776934`。

## 尚未执行

- 第二桌面浏览器、Android/iPhone/Tablet、真实网络整形和 localhost 可见复核。
- 旧 Profile 编辑器/成就弹层 a11y、收藏稀有度目录、提交、推送和部署。

下一条独立本地主线：旧 Profile 编辑器与成就弹层的统一无障碍生命周期。收藏稀有度继续单独治理，不按价格推断。
