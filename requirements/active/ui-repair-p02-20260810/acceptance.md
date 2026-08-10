# UI Repair P0.2 验收

## 自动化

- [x] Modal 高于 Header/Mobile Nav，Toast 高于 Modal，商城关闭可点击。
- [x] 通用建房未选游戏不能提交；游戏预选与 min/max 容量纠正正确。
- [x] `create` payload 不增加 game；`online.pendingGame` 绑定 `created.room` 后才消费。
- [x] 房间弹层单例、滚动锁、命名 dialog、Tab/Esc/背景关闭与焦点恢复。
- [x] Lobby 只用 `canJoin/canSpectate` 决定动作，房主 Profile 键盘可达，用户文本安全。
- [x] 普通用户没有 Tournament 创建/打开/自动弹窗；管理员受控入口保留，换号重新取 `hello_ack.admin`。
- [x] 四个品牌 key 三语与模板 fallback 更新，准确六款事实保留。
- [x] 专项、i18n、DOM、响应式、房间、赛事、Quality Gates 与完整测试通过。

## 浏览器

- [x] 商城、设置与房间弹层顶部不被 Header 遮挡，关闭/Toast 可见可点。
- [x] 通用建房、游戏卡预选、私密码错误态、浏览空态、等待/进行中房卡可操作；Enter 路径由 VM 合同覆盖，真实浏览器按钮提交覆盖原生约束边界。
- [x] 普通账号无赛事入口和自动弹窗。
- [x] Light/Dark、zh-CN/en-US/uk-UA 无裸 key 或横向溢出。
- [x] 1440×900、1024×768、390×844、844×390 四档真实视口通过，移动弹层内部滚动可到达取消按钮。
- [x] 两个本地一次性访客完成等待房、AI 开局、进行中房卡、观战与自身观战房过滤，随后显式删除。

## 边界

- [x] 未改服务端赛事权限、协议、规则、奖励、Supabase 或美术资产。
- [x] 未 commit、push 或部署。

## 未执行

- 浏览器系统级 reduced-motion 模拟：当前 in-app Browser 未提供该媒体模拟能力；静态 CSS/自动化合同通过。
- 第二桌面浏览器、Android、iPhone、Tablet 与真实网络整形。
