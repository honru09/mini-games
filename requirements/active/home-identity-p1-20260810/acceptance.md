# Home Identity P1 验收

当前状态：`LOCAL_VERIFIED`

- [x] 现有 `#home-engagement-pulse` 内只有一个轻量 identity section；没有第三张首页卡。
- [x] 正式账号显示 avatar/frame/effect、raw 昵称和本地化 `Lv.N`；访客/未登录隐藏且不调用头像 helper/读取 owned。
- [x] 既有收藏 X/Y、Profile、Chat、Shop 与 dismiss/焦点恢复行为不变。
- [x] catalog/owned 缺失或异常安全降级；不显示 coins、xp、价格、owned ID、商品名、购买记录、朋友明细、playerCharacter/gameCosmetics 字段或未审批图片。
- [x] identity section/label、头像 `aria-hidden`、raw 昵称、既有 44px 控件、手机单列、无新增动画与三语同构通过。
- [x] 专项、Home P0/P1、Collection Rarity、Victory Mastery、Identity Preview、Profile Route、i18n、DOM、responsive、Ghost Shell、pretest、quality gates 通过。
- [x] 主负责人完整 `npm test` 通过（120.7 秒）；双构建一致：971303 characters / 985572 bytes / SHA-256 `963DEAEFC5B46621ACCE9B713444D3F3B7F5DC41C775990CD87BE36E501D69FF`。
- [ ] 未提交、未推送、未部署。

NOT_EXECUTED：in-app Browser 对 localhost 的导航被用户保存权限拒绝，未尝试绕过；第二浏览器、Android/iPhone/Tablet、真实网络整形、可见 reduced-motion 浏览器矩阵与人工视觉/IP/Golden Set 也未执行。自动化通过不替代这些证据。
