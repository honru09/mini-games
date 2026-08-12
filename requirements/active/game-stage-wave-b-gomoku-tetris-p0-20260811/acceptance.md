# Wave B 五子棋 / Tetris 验收

- [x] 新总 flag 严格默认开启且只有精确 `'0'` 回退当前 Wave A；storage 异常安全保留 Wave A。
- [x] 五子棋主棋盘新增稳定 Wave B Arena/状态/最后落子 seam，并由共享 CSS 收紧视觉中心；最新浏览器可见复核受连接器旧缓存阻塞，未将其冒充通过。
- [x] 五子棋 15×15 坐标、点击、快照、AI、联机与胜负完全不变。
- [x] Tetris 主井、Hold/Next、对手井、攻击/计时/HUD 拆为独立稳定节点与密度布局；最新浏览器可见复核受连接器旧缓存阻塞，未将其冒充通过。
- [x] Tetris 七项控制 ≥44px，桌面紧凑、390×844 和 844×390 的 CSS/合同覆盖无页面横溢。
- [x] Seat Rail、规则、结算、局内聊天/表达和公开 Profile 入口保留既有插槽与回归。
- [x] 双主题、三语言、键盘/触控、reduced-motion 与 safe-area 通过静态/自动化合同。
- [x] 两款专项、既有 Game Stage/Immersive/Tabletop/Tetris 规则回归、Quality Gates、完整 npm test 和双构建通过。
- [ ] 最新 Wave B 浏览器可见桌面/手机证据；当前连接器标签仍返回旧构建，第二浏览器/真机/真实网络也未执行。
- [x] 台账、分类报告、简报和三份日志收口；不提交、不推送、不部署。
