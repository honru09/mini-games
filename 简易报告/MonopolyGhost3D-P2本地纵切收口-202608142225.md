# Monopoly Ghost3D P2 本地纵切收口

## 一句话结论

大富翁 default-off Ghost3D P2 已完成本地实现、单一 Chromium 部分可见验证、Terra Max 两轮缺陷复审、质量门禁、完整全链测试与确定性构建；仍受真机/第二浏览器/真实网络、真实性能和人工美术 Golden Set 门禁阻塞，未发布。

## 做了什么

- 新增程序化 Three r185 大富翁 Renderer，覆盖 24 格、2–5 人、三档质量和唯一 `token_moved` 语义时间线。
- 保留 Wave B DOM 棋盘、真实 DOM 掷骰、购买、放弃与竞价；Canvas 永久只读，不接收任何游戏输入。
- 修正首帧非语义镜头、假骰子、触控尺寸、四档布局、实时 viewport 缩放和 reduced-motion。
- 增加 host generation + adapter epoch，封闭 context loss、Foundation mount/config/render failure、恢复拒绝和迟到回调。
- 诊断并修正与本批无关的 `social-match-online` 跨进程墙上时钟 1ms 竞争；服务端权威字段和协议未改变。

## 用户现在能看到什么

在本地精确开启开关时，可看到保持 Cream/Ink 方向的程序化 3D 大富翁舞台、真实 2–5 人棋子与平滑落地过程；真实掷骰和地产/拍卖操作仍在可访问 DOM Command 区。默认状态和任何失败状态继续显示完整可玩的 Wave B 二维舞台。

## 还没做什么

- 第二桌面浏览器、物理 Android/iPhone/Tablet、PWA/锁屏/音频和真实网络整形未执行。
- 真实低端 FPS、GPU/纹理内存、发热与长会话性能未执行。
- ART-036、GLB、纹理、人工清稿、Reviewer B、IP Review 与用户 Golden Set 未进入 runtime。
- 未提交、未推送、未部署；线上仍不是本地这一版。

## 验证

- `npm run test:monopoly-ghost3d`：通过；ESM graph 59、Renderer 71，bridge/layout/cache 全通过。
- Foundation、Rule Core、Presentation Adapter、Auction、Wave B、Wave C、Character Presentation、UI-037：通过。
- `npm run quality:gates`：通过。
- `node --experimental-websocket qa/social-match-online.js`：修正后连续 20/20 通过。
- 最终完整 `npm test`：139.7 秒，通过。
- 确定性双构建：1,422,463 characters / 1,436,997 bytes / SHA-256 `A69CAF292FEFE477664B05486D2D6F560075307C05F6C1D86841E0B6A4298B0C`。

## 风险与下一步

`TECH-049` 继续 `partial`，三个共享 Gate 保持 `BLOCKED`。下一条 CLOSE 主线为 Xiangqi Ghost3D P3，严格复用 `GAME-052 + TECH-049`，保持 DOM 棋盘/点击输入永久可用、Renderer 零输入、唯一 `piece_moved`，并先解决权威 raw snapshot 在现有 `onRestore()` 前被压平的语义连续性风险。

## 发布状态

`LOCAL_ACCEPTED_AWAITING_RELEASE_COMMAND`。本批未 commit、push、GitHub Pages 或 Render deploy。

## 追溯入口

- `requirements/active/monopoly-ghost3d-vertical-slice-p2-20260814/`
- `requirements/active/monopoly-ghost3d-vertical-slice-p2-20260814/evidence/single-browser-visible-verification-202608142150.json`
- `PROJECT_STATUS.json`
- `requirements/PRODUCT_REQUIREMENTS_LEDGER.json`
