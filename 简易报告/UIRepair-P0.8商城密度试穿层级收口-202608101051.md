# UI Repair P0.8 商城密度与试穿层级收口

时间：2026-08-10 10:51（Asia/Tokyo）

## 做了什么

- 桌面商城扩大到 1080px，左侧固定 268–320px 真实身份试穿，右侧目录独立滚动。
- 商品卡统一为可读密度：最小 144px、稳定间距、统一最小高度、价格底对齐、操作按钮全宽。
- Premium Background 使用 16:9 poster 与更高卡片层级，并增加动态/静态三语标签。
- 手机保持单列试穿区、双列商品网格和至少 44px 的购买/装备操作；平板使用自适应目录。
- 预览仍是临时只读状态，不改价格、owned/equipped、服务端协议、访客权限或未审批美术。

## 验证

- `node qa/ui-shop-layout-contract.js`：通过。
- `npm run test:i18n`、`node qa/dom-smoke.js`、`npm run quality:gates`：通过。
- 完整 `npm test`：通过，130.3 秒。
- 构建：`public/index.html` 920833 bytes；SHA-256 `65300B75CA057403B413B412E9A4F3FF1F9FA6CF541410D5A8A203F6D391D429`。
- `git diff --check`：通过（仅有 Git 的 LF/CRLF 提示）。

## 主负责人审核与限制

已亲自审阅 CSS、商城渲染、专项合同和全链回归；服务端 `SHOP_PRICES` 未被商城代码复制或改写。按此前要求创建了 `gpt-5.6-terra` max 审核 agent，但其回传为不可读加密载荷，无法形成可审核结论，也没有采用任何子 agent 代码或判断。

in-app Browser 访问 localhost 被本机已保存权限阻断，因此未把自动化合同冒充可见浏览器、第二浏览器、真机、真实网络或 visible reduced-motion 证据。

## 当前阶段与下一步

当前属于“UI Repair P0 本地连续收口”阶段，P0.8 已完成本地自动化验收；发布候选仍 BLOCKED。下一独立主线进入玩家 Direct Chat 表现层：会话密度、消息状态、空/加载/错误、公开 Profile 入口、移动键盘和窄屏适配。

本批次仅本地修改，未 commit、未 push、未发布 GitHub Pages、未部署 Render。
