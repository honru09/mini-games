# Product Realignment P0｜实施计划

## 文件所有权

- Connection：`public/src/core/02-app-shell.js`、`public/src/online/03-websocket.js`、连接专项 QA。
- IA：`public/index-template.html`、`public/src/ui/07-roster.js`、三份 locale、IA 专项 QA。
- AI：`public/src/core/05-ai-personas.js`、`public/src/core/03-game-framework.js`、六款游戏的难度消费点、AI 专项 QA。
- Playline：`public/src/core/07-playline.js`、Playline 专项 QA；服务端协议保持冻结。
- Game Stage：一次只开放一到两款游戏文件与其专属 CSS/QA，避免跨游戏混改。
- Art：`art-source/`、`asset-library/`、运行时 manifest 分阶段处理；未批准母图不得默认开启。

## 动效治理

- 单状态反馈优先 CSS transform/opacity；需要运行时中断、复位或多步编排时使用 GSAP Core/Timeline。
- 不在局内输入或核心规则上使用 ScrollTrigger。
- 所有 timeline/tween 必须在 reset/destroy/route exit 清理；后台和离屏暂停。
- `prefers-reduced-motion` 使用稳定终态，不简单隐藏信息。
- 首次真正引入 GSAP runtime 前单独记录版本、包体、PWA 缓存、加载失败 fallback 和低端设备帧耗；在此之前不以“使用 skill”冒充已引入库。

## 当前红灯/绿灯记录

- `node qa/hub-information-architecture.js`：初始 7 FAIL；完成 Games Library/Rooms 分区和 Home 身份去重后全绿。
- `npm run test:i18n`：三语 1,615 key 同构、占位符和运行时切换全绿。
- `node qa/profile-route-contract.js`：Profile 成就/成长/战绩/任务/社交/收藏/回放所有权全绿。

其余工作流的红灯和最终证据在各自专项任务完成后追加。
