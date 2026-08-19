# UI Repair P0.1 本地浏览器证据

## 环境

- 地址：`http://127.0.0.1:8099/`
- 浏览器：Codex in-app Browser
- 实际视口：1280×720
- 主题：Light / Dark
- 语言：zh-CN / en-US / uk-UA
- 本地正式测试账号仅写入隔离数据目录；未触碰线上用户数据。

## 通过项

- Avatar v2 图片与 Canvas 均显示为圆形，Frame 与身份组合预览对齐。
- 选择 `effect-4` 后，头像媒体与容器的 `transform` 始终为 `none`；装饰环在 220ms 间隔内从一组旋转矩阵变化为另一组矩阵，证明只旋转装饰层。
- Premium Background 初始使用 poster；点击播放后切换到 animated WebP + poster fallback；暂停后恢复 poster。
- 播放按钮实测 106×44px，`aria-pressed` 与播放状态同步。
- 连续切换十次动态背景后，DOM 中仍只有一个 `.shop-identity-preview` 与一个 `.shop-preview-playback`。
- 1280×720 下商城 `scrollWidth === clientWidth`，无水平溢出。
- Light/Dark 对比可读；英文、乌克兰语均原地完整切换，未看到裸 key。
- Browser console error/warning：0。
- 双构建 SHA-256 一致：`53E8A2D3E0FDAE352525C4B5441C229FBF9AE29D52A9B6BB7958C8274527456A`。

## 未冒充完成的项

- 当前 in-app Browser 会话没有暴露视口重设或媒体模拟能力，因此 1440×900、1024×768、390×844、844×390 与浏览器 reduced-motion 没有伪写为已执行；由 `qa/ui-responsive-contract.js` 与 `qa/ui-identity-preview-contract.js` 提供静态/VM 回归。
- 真实 Android、iPhone、Tablet 和第二浏览器未执行。

## 发现并转入 P0.2

- `.app-header` 的 `z-index:120` 高于 `.modal-backdrop` 的 `z-index:80`。商城顶部被 Header 遮挡，顶部关闭按钮的指针点击会被截获；刷新后可退出，但这不属于可接受产品体验。
- P0.2 必须统一 Dialog/Header/Mobile Nav/Toast 层级，并新增浏览器可点击关闭回归，不能只做视觉遮盖。
