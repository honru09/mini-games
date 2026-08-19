# Profile Design System P1 本地实现收口

时间：2026-08-12 15:53（Asia/Tokyo）

## 做了什么

- 本人主页改成身份、成长、下一目标、内容库四个明确层级；核心和辅助数据分开，桌面双栏、平板/手机单列。
- 删掉底部重复的“编辑档案”，保留 Hero 主操作；44px、手机安全区和横向溢出都纳入合同。
- 他人资料页把好友操作收成私聊、战绩比较、一个“关系与安全”入口；非好友只保留单一关系/安全主入口。
- `profile_get/profile_data` 协议没有增加 requestId。客户端用本地有序请求记录绑定 requestId 与目标 UID，覆盖取消、同 UID 立即重开、迟到响应、断线、换号和注销。
- Profile 弹层只复用现有 GhostSurfaceMotion；关闭不等待动画，焦点、滚动锁、aria 和 DOM 同步收好。

## 主负责人审核纠正

- 拒绝为了方便给公开 Profile 协议偷加 requestId。
- 队列达到 32 条时拒绝新请求，不截断尚未回包的旧请求。
- UID 不匹配的响应会结束相应请求，避免加载框永久挂住。
- Escape、点背景、按钮关闭都 settle 共享 Motion，且不会延迟可访问关闭。
- 修复旧 VM 测试覆盖范围和 Profile Hero 遗留底部间距。

## 测试

- `npm run test:profile-design-system`：通过（14+9 项及 Profile Route/Loading/Social/Modal/Compare）。
- `npm run quality:gates`：通过；第一次仅发现生成的 `public/index.html` 落后于源码，自动重建后第二次全绿。
- `npm test`：通过，156.6 秒。
- 两次确定性构建一致：1,337,226 characters / 1,351,775 bytes / SHA-256 `8E7BB74A304E6D9BF5CEC0F21CF30C834921CED2F0583C23CC4B79AD0758B39F`。

## 没有做什么

- 没有修改服务器消息类型、公开字段、陌生人私信、经济、奖励、Supabase、游戏规则/权威或未审批美术。
- 没有 commit、push、GitHub Pages 或 Render 部署；线上仍是 `da3d05c`。
- 浏览器连接器仍为 `Transport closed`；最新本地可见矩阵、第二浏览器、Android/iPhone/Tablet、visible reduced-motion、真实网络和低端 FPS 都是 `NOT_EXECUTED`。
- 两次 Terra Max 独立终审均未交付可用结论；主负责人停止空转任务并亲自终审，没有冒充独立审查通过。

## 当前阶段

Profile P1 达到本地 `implemented / CLOSED_LOCAL`，不等于 browser/device verified 或 production-ready。下一步按总指挥继续一条不依赖外部 Gate 的独立 CLOSE 主线，先冻结 ownership 与 IN/OUT，且不混入 UI-037/ART-036/GAME-045。
