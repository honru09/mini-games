# Home Engagement P1 验收

当前状态：`COMPLETED_LOCAL`

- [x] 正式账号首页显示可关闭的社交与收藏脉冲卡；访客/未登录安全隐藏。
- [x] 卡片只显示线上好友聚合、收藏聚合和既有成长方向；没有 owned ID、余额、价格、购买记录或好友明细。
- [x] 关闭状态使用每账号一个固定本地 key，value 保存本地日期；storage 异常安全退化，次日恢复且不会每天累积新 key。
- [x] Profile、Chat、Shop 都复用已有动作；无协议或 mutation。
- [x] 三语 key 同构，关闭按钮可访问且至少 44px，手机单列，双主题/减少动态兼容。
- [x] 专项静态与动态状态矩阵、P0 首页、i18n、DOM、Ghost Shell、Profile/Shop 回归和构建通过。
- [x] 未修改 server、WebSocket、购买、奖励、规则、AI、Replay、Supabase、assets 或未审批美术。
- [ ] 未提交、未推送、未部署。

尚未执行：第二浏览器、真机、真实网络整形与可见 reduced-motion 验收；这些不因自动化通过而视为完成。

主负责人复核后增加跨日期有界 localStorage 回归；单独 E2E 53.7 秒通过，完整 `npm test` 首次在邀请房间发生一次性超时，单独 E2E 与随后完整链（179.7 秒）均通过。双构建：968233 characters / 982494 physical bytes / SHA-256 `4A861DD2F6763FE4AFA4640E7F6AEC7418A0DC9E4EAD52BD41831C0988E43C37`。
