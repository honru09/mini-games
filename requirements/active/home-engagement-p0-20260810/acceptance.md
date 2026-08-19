# Home Engagement P0 验收

当前状态：本地验收完成，等待外部可见闸门与用户发布指令。

- [x] 首页新增语义化三步引导：选游戏、选玩法、再来一局。
- [x] 正式账号按既有 `played` 决定稳定推荐，读取 `level/streak` 显示轻量成长目标；不写新状态。
- [x] 访客/空档案使用本地化 fallback，按钮文案与实际路由一致。
- [x] 推荐入口进入 Games 并把键盘焦点落到对应游戏卡；成长入口正式账号去 Profile、访客去 Games。
- [x] 三语 key/占位符同构，双主题令牌、桌面/平板/手机单列和无动画信息理解合同存在。
- [x] `qa/home-engagement-contract.js` 静态与动态矩阵通过；i18n、DOM、Ghost Shell、响应式与完整回归通过。
- [x] 未修改服务器、协议、经济数值、商城价格、游戏规则、AI、Replay、数据库或未审批美术。
- [x] 未提交、未推送、未部署。
- [ ] 第二桌面浏览器、Android/iPhone/Tablet、真实网络和可见 reduced-motion 验收。

最终完整测试、构建 bytes/hash 与报告同步记录在 `execution.json` 和本轮简易报告。
