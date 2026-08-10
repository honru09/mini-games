# UI Repair P0.1 本地实现简报

日期：2026-08-10 03:15（Asia/Tokyo）

## 这次做了什么

- 头像图片和 Canvas 现在统一为圆形，头像框与特效不再出现“方头像套圆框”的错位。
- 环绕旋转特效只旋转外圈装饰，头像本人不会再跟着转。
- 商城预览不再只放一个孤立图标，而是同时展示背景、头像、头像框、特效、昵称效果和身份说明。
- 动态背景现在会加载真实 animated WebP，可播放、暂停；失败、离屏、切到后台或 reduced-motion 时会回到静态 poster。
- 商品卡支持键盘选择，播放按钮达到 44px 触控高度；中英乌三语已同步。

## 用户现在能看到什么

- 选择头像、头像框、特效或背景时，左侧会即时显示完整身份组合，但不会误购买或保存。
- 动态背景商品有清楚的播放/暂停按钮和状态文字。
- 黑夜模式、英文和乌克兰语下，预览文字和按钮保持可读。

## 主负责人实测与纠正

- 实际页面确认：头像本体不旋转，只有外圈旋转。
- 实际页面确认：动态背景在 poster、animated WebP、poster 三个状态间正确切换；按钮为 106×44px。
- 连续切换十次动态背景后，页面仍只有一个预览和一个播放控制器；控制台 0 error / 0 warning。
- 子 Agent 原先使用的错误列表语义已由主负责人改成 `role=group + aria-current`，避免商品卡内嵌购买按钮产生错误可访问性结构。
- 新发现：固定 Header 的层级高于 Modal，商城顶部会被遮住，关闭按钮也可能被截获。这个问题已明确进入 UI Repair P0.2，不会被写成“全部没问题”。

## 测试

- `node qa/ui-identity-preview-contract.js`：通过
- `node qa/shop-contract.js`：通过
- `node qa/ui-responsive-contract.js`：通过
- `npm run test:i18n`：通过
- `node qa/dom-smoke.js`：通过
- `npm run quality:gates`：通过
- `npm test`：通过
- 双构建 SHA-256：一致
- 本地浏览器：1280×720、Light/Dark、zh-CN/en-US/uk-UA 通过

## 还没冒充完成的部分

- 当前 in-app Browser 没有提供视口重设和媒体模拟能力，所以 1440×900、1024×768、390×844、844×390 的实时浏览器矩阵，以及浏览器 reduced-motion，没有伪写成已执行；对应静态/VM 回归已通过。
- Android、iPhone、Tablet、第二浏览器和最终背景美术重绘仍未执行。
- 本批未提交、未推送、未部署。

## 下一步

UI Repair P0.2：先修 Header/Modal/Mobile Nav/Toast 层级，再重构房间创建、加入、浏览；同时默认隐藏普通用户 Tournament 创建/打开/自动弹窗入口，并重写 Ghost Game 三语品牌副标题。
