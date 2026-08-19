# UI Repair P0.5 动态背景预览状态收口

时间：2026-08-10 10:10（本地工作树）

## 本批范围

本批只处理 Premium Background 预览状态，不改商品价格、购买/装备 RPC、访客权限、服务端、规则、奖励、AI、Replay、Supabase 或未审批美术准入。

## 完成内容

- `public/src/core/06-assets.js`
  - 统一 `poster → animated → poster → staticFallback` 的媒体回退链。
  - 动态资源失败时移除 `asset-ready`、清除图片可见状态并显示回退；poster 失败继续尝试静态桌面资源。
  - 统一 observer、页面 visibility、reduced-motion、显式播放/暂停的 playback-state seam。
  - 释放时断开 observer、visibility listener、订阅和播放句柄，重复释放保持幂等。
- `public/src/shop/06-shop.js`
  - 商城身份组合预览订阅真实播放状态。
  - 播放按钮同步文字、`aria-pressed`、`aria-label` 和状态提示；切换商品或关闭商城不残留回调。
- `qa/ui-identity-preview-contract.js`
  - 增加动态 VM 回归：poster 成功、animated 失败恢复 poster、poster 失败恢复 static fallback、最终恢复 `asset-ready`。
  - 保留 reduced-motion、播放/暂停、observer/visibility cleanup、Shop 购买无副作用等合同。
- `package.json`
  - `pretest` 和完整 `npm test` 持续包含身份/背景预览回归；保留 `test:ui-background-preview` 入口。

## 主负责人审核

审核重点为：异步失败是否遗留 `asset-ready`、Shop 按钮是否与 `animationActive` 反向、关闭/切换是否泄漏 observer 或订阅。发现原 poster 失败链只到通用 `BG` 文本、无法继续落到静态桌面资源，已补为显式静态回退并加入动态 VM 断言。未改价格、拥有状态或网络协议。

## 验证结果

- `node --check public/src/core/06-assets.js`：通过
- `node --check public/src/shop/06-shop.js`：通过
- `node qa/ui-identity-preview-contract.js`：通过
- `npm run test:shop-contract`：通过
- `node scripts/build.js`：通过
- `node qa/dom-smoke.js`：通过
- `npm run quality:gates`：通过
- `npm run test:progress-ledger`：通过（233 项需求、7 份报告、60 个来源、235 条依赖边）
- `git diff --check`：通过（仅换行格式提示）
- 完整 `npm test`：通过，110.4 秒

## 构建证据

- `public/index.html`：915127 bytes
- SHA-256：`1A4D1DD87F3AFB89B13436B20E8B488B3A021698B996AF393D084E5206E61D1D`

## 尚未完成与发布边界

本批已完成本地收口，但第二桌面浏览器、Android/iPhone/Tablet 真机、真实网络整形、浏览器 visible reduced-motion 证据仍未执行；P0.6 访客 mutation affordance、P0.7 权威 Profile 缓存缺失态仍是后续独立小批。当前未提交、未推送、未发布 GitHub Pages、未部署 Render。
