# P1-02 Tank Final Art v1 — Technical Review / Reviewer A

结论：`TECHNICAL_PASS / MACHINE_VISUAL_PASS / SIMILARITY_RISK_LOW / LOCAL_ONLY`

## 审查结果

- Family：`G-12-TANK-FINAL-ART-V1`；Source：`ART-035-TANK-FINAL-ART-V1`；Artwork version：1。
- 25 个 SVG source masters、50 个 WebP variants；3 个棋盘层、12 个对象原子、8 个语义 VFX、2 个构图预设。
- 当前 runtime 总量：376,668 bytes；预算：6,291,456 bytes；占预算 5.99%。
- 25 个 SVG 均为本地确定性源，禁止 `script / foreignObject / image / iframe / object / embed / text` 与外部 URL/import。
- 50 个运行时文件均有独立 SHA/bytes 记录；对象/VFX 有 Alpha，棋盘与 camera 为不透明构图层。
- contact sheet：`review/tank-final-runtime-contact-sheet-v1.png`，SHA-256 `18E3F703045D23FB046F902B422DA879EA2A3FD5A1D48EF5B20456BEA08DCE96`。
- 独立机器视觉归档：`MACHINE_VISUAL_REVIEW.md`；独立机器相似/IP 风险归档：`SIMILARITY_AND_IP_REVIEW.md`。二者拆分证据口径，不冒充自然人或法律审查。
- 终局十字路径重复已在生成器中消除后重新派生，Manifest、预览、hash 和 byte 证据均采用修订后结果。

## False-transparency Gate

`tank-object-atoms-source-v1.png` 与 `tank-semantic-vfx-source-v1.png` 的棋盘格是烘焙 RGB，不是 Alpha；chroma 修订同样是 RGB。四者全部判定为 `SOURCE_ONLY / REJECTED_FOR_RUNTIME_EXTRACTION`。运行时没有抠图、色键或外部像素复制链。

## 视觉与语义

- 竞技场三层保持中央网格对比，边缘装饰不拥有命中区。
- 四套坦克轮廓统一，颜色只表达队伍区分；方向由实时 transform 负责。
- 砖墙与钢墙在小单元格仍能通过轮廓/结构区分；forced-colors 下恢复边框。
- 炮弹、开火、命中、爆炸、护盾、终局的视觉语义可区分；reduced-motion 使用 `-static` variant 并停用入场动画。
- HUD 只采用实时 DOM 胶囊与 live text；没有把 HP、分数、倒计时、玩家名或控制烘焙到图片。

## 相似风险

机器审查未发现外部参考的角色、轮廓、图标、文字、配色或排布被直接带入确定性 SVG。此结论是项目内机器相似风险判断，不是法律意见；外部输入继续保持 `EXTERNAL_REFERENCE_ONLY / blocked-license`，ImageGen source boards 继续保持 `SOURCE_ONLY_EXTERNAL_INFLUENCED / SIMILARITY_REVIEW_REQUIRED`。

## 权威与失败回退

- Tank Authority、Protocol、Snapshot、Prediction、Replay、Reward、Economy、HP、射击、碰撞和控制没有由美术 resolver 读取或改写。
- resolver 必须同时验证 runtime ID、artwork version、clearance、source ID、clearance record、flag 结构和精确路径。
- 所需 23 个 live role 任一 resolve/decode 失败，整族 fail closed；旧 CSS/DOM/Canvas/Emoji 保持可玩。
- destroy 会使异步 request 失效并移除 layer/VFX 节点；flag `0` 是一键回滚。
- Tank 在高度不低于 601px 的横屏视口连续使用右侧 Command Rail；该规则从 600px 宽起覆盖，不再在 720/721 或 900/901 产生棋盘尺寸断崖，竖屏仍保留既有底部 Dock。

## 未完成的外部门禁

第二浏览器、真实 Android/iPhone/Tablet、真实网络、低端 FPS、人工清稿、Reviewer B、IP/法律意见和生产发布未执行；不得由本技术审查冒充通过。
