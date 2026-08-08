# 验收标准

- 1440、768、481、390、360 五档完成真实 DOM、Bounding Box、overflow、控制台与交互审查；截图通道不可用则单列 `NOT_EXECUTED`。
- 大厅首屏不再重复展示两个同级“快速加入”；六款卡片均有统一 16:9 封面或可靠 Emoji fallback。
- 登录/注册弹层只有一个主要滚动容器，手机高度内可到达提交按钮，无横向溢出，触控目标至少 44px。
- 商城具有可读的分类、主预览/试穿、余额、商品状态和购买/装备行动；不改变服务端价格与扣款权威。
- 客户端展示价格逐项等于服务端现有目录；Starter Background 1–6 不出现不可购买入口；快速重复打开商城也只有一个弹层。
- 注册、登录、取消、商城关闭和重复打开后 body 滚动锁归零；游戏顶栏与商品目录三语无中文/裸 key 泄漏。
- 中文→英文→乌克兰语→中文连续切换后，静态和动态节点无裸 key、无错误语言泄漏。
- 六张封面各有 640×360 与 320×180 WebP、稳定 manifest 项、来源/许可、fallback、lazy load 和字节预算；当前批次明确标记为 Sticker Cartoon 前的过渡版。
- 素材库索引可解析，生产资源和母图可按分类、来源、许可、哈希、状态查询；未授权参考不进入生产目录。
- 清理缓存前后保留正式 DOCX、最终交付物和必要源文件，并记录释放空间。
- `npm run test:i18n`、`npm run test:assets`、`npm run test:asset-library`、`node qa/dom-smoke.js`、商城价格契约、`npm run quality:gates`、`npm test` 通过。
- 三份中文日志、简易报告、PROJECT_STATUS/README/WHITEPAPER 的事实在结束前同步。
