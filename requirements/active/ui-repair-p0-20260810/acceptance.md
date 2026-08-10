# UI Repair P0.1 验收

## 自动化

- [x] Avatar v2 `<img>` 与 Canvas 均为圆形、等尺寸、相同 frame/effect stacking。
- [x] effect-4 不旋转玩家头像本体，只旋转装饰层；reduced-motion 静态降级。
- [x] 动态背景预览包含背景、Avatar、Frame、NameFx 与遮罩，触屏/键盘可播放暂停。
- [x] 预览切换/关闭释放 observer、listener 和动画源；资源失败保持 poster/fallback。
- [x] 商品卡以可聚焦 group + aria-current 键盘可选，且不劫持内部购买/装备按钮。
- [x] 三语 key 集合、占位符和运行时切换通过。
- [x] Build Drift、商城、响应式、DOM、Quality Gates 与完整 `npm test` 通过。

## 浏览器

- [ ] 1440×900、1024×768、390×844、844×390 的商城四分类实时浏览器矩阵；本环境固定 1280×720，四档由响应式合同覆盖，未冒充实时矩阵。
- [x] Light/Dark 下头像、头像框、昵称和播放按钮对比可读（本地 1280×720）。
- [ ] 390px 真实浏览器尺寸；44px 控件已由运行时读数和响应式合同确认。
- [ ] 浏览器 reduced-motion 媒体模拟；VM/合同已确认 poster、禁用播放与静态文案。
- [x] Console 无 error/warning；切换十次背景后仍只有一个预览和一个播放控制器。

## 边界

- [x] 没有生成图片、改价格、改协议、改规则、改 Supabase 或启用冻结美术。
- [x] 未 commit、push 或部署。

## Known Issues

- 真实 Android/iPhone/Tablet 与第二浏览器继续 `NOT_EXECUTED`。
- 未审批美术和最终动态背景重绘仍在 Art M1，不因本次真实播放能力而默认获批。
- 1280×720 实测发现全局 `.app-header` 高于 `.modal-backdrop`，会遮住商城顶部并截获关闭按钮；这是独立 UI Repair P0.2 层级缺陷，未把它隐藏在本批结论里。

## Rollback

按 `plan.json` 撤销表现层改动并重新构建；数据无迁移。
