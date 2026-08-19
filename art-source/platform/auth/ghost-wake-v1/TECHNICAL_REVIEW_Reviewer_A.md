# P0-01 Auth / Launch Art v1 — 机器技术审查（Reviewer A）

结论：`TECHNICAL_PASS_WITH_RECORDED_LIMITS / OWNER_CLEARANCE_EVIDENCE / LOCAL_ONLY / NOT_RELEASED`  
审查日期：2026-08-17（Asia/Tokyo）  
审查者：OpenAI Codex 机器 Reviewer A；不是独立自然人 Reviewer B

## 审查范围

本审查覆盖 `P-AUTH-LAUNCH-ART-V1` 的 5 个稳定 runtime Asset ID、23 个源母文件、6 个确定性中间证据、3 张审查板、48 个 runtime variants 与 3 份同字节 fallback 拷贝。逐文件事实见 `asset-family-manifest-v1.json`。

不把本记录冒充完整 P0-01 核销、真机验收、独立人工/IP 结论或发布批准。

## 完整性与预算

| Runtime Asset ID | variants | 实际字节 | 预算字节 | 结果 |
| --- | ---: | ---: | ---: | --- |
| `P-AUTH-GHOST-WAKE-BACKDROP-V1` | 8 | 164,676 | 262,144 | PASS |
| `P-AUTH-HONRU-SCENES-V1` | 24 | 232,962 | 393,216 | PASS |
| `P-BOOT-HONRU-CONTROLLER-V1` | 6 | 76,306 | 131,072 | PASS |
| `P-AUTH-STATUS-ICONS-V1` | 6 | 5,252 | 12,288 | PASS |
| `P-PWA-GHOST-WAKE-V1` | 4 | 54,365 | 98,304 | PASS |

- 48 个 runtime variant 合计 533,561 bytes；预算合计 897,024 bytes。
- 四个 `-static` 背景与各自普通背景逐字节一致；运动来自页面层而不是位图。唯一内容字节为 451,223，静态别名不伪装成第二套画面。
- Light Desktop 背景 26,756 + Boot 320 图 14,182 + Login Honru 320 图 14,564 = 55,502 bytes，低于 512,000 bytes 的首屏候选上限。
- family manifest 中记录的路径、SHA、bytes 与运行时 Manifest 逐项相符；源文件、runtime 文件与 fallback 路径均存在。

## 尺寸、编码与 Alpha

- 背景：Desktop 1920×1080、Mobile 900×1200；8 个 runtime 文件均为普通 `VP8` RGB WebP，无 Alpha。
- Auth Honru：8 个 512×512 源 PNG；Boot Honru：2 个 512×512 源 PNG。文件编码为 PNG color type 3（indexed）+ `tRNS`，解码后具有真实 Alpha，四角均为 0；不得错误要求其必须是 color type 6 才算透明。
- Auth/Boot runtime：30 个 `VP8X` Alpha WebP，尺寸严格为 160/240/320，四角透明，存在全透明、半透明抗锯齿和全不透明主体像素。
- 状态图标：6 个 64×64 SVG；源文件与 runtime 文件分别逐字节同构。
- Maskable：192/512 PNG 均为 8-bit indexed color type 3，无 `tRNS`，逐像素全不透明；Maskable 合法性不依赖 PNG color type 2。
- Splash：1080×1920 `VP8X` WebP；没有 Alpha=0 的像素。缩放后的最外缘存在少量部分 Alpha，Light 最小 205、Dark 最小 205，属于已记录的边缘采样事实；跨平台合成与裁切仍需真实设备复核。

## SVG 安全与文本边界

- 4 个 Auth 背景 SVG、6 个状态源 SVG、6 个状态 runtime SVG、3 个 PWA SVG 均有固定 `viewBox`。
- 扫描未发现 `<script>`、`<foreignObject>`、内联事件、外部 `href/xlink:href`、`data:image`、外部 CSS URL、`<image>` 或 `<use>` 依赖。
- `xmlns="http://www.w3.org/2000/svg"` 是标准 SVG namespace，不是外部网络资源，不应被安全扫描误报。
- 运行时 SVG 没有可见 `<text>`；状态图标的 `<title>/<desc>` 仅为元数据。三张审查板包含英文标签，但它们位于 `art-source/**/review`，不进入 runtime。

## 机器视觉审查

实际查看了以下本地文件：

- `auth-honru-scenes-contact-sheet-v1.png`：8/8 场景保持 Honru 的三火苗、左十字眼、右四圆眼和粗圆 Ink 轮廓；欢迎、创建、迁移、访客、连接、错误、恢复、首次开始通过姿态与道具双重区分。
- `auth-status-icons-contact-sheet-v1.png`：6/6 图标使用不同外轮廓和内部符号；available/connected 虽同属绿色成功语义，但人物+小徽记与整圆连接波形不同，且 HTML 文案继续权威。
- `boot-honru-scenes-contact-sheet-v1.png`：手柄抱持与重试信号两态可区分，未把加载百分比烘焙进图片。
- 四张 Auth 背景和两张 2048×2732 Splash：Light/Dark 与 Desktop/Mobile 构图独立，保留表单/品牌可读留白，没有照片纹理、强 Bloom、第三方 Logo 或烘焙 UI 文案。
- 192/512 Maskable：核心徽记落在中心安全圆内；真实 Android/iOS/PWA 裁切没有在本审查中执行。

160px Auth/Boot runtime 原子仍保持 Honru 轮廓与主要状态道具；更小的 24px 状态图标依赖 HTML 文案共同传达，不允许仅靠颜色或图像判定认证结果。

## 相似风险审查

- 外部 Q 版 UI/PSD/AI/RPG 素材的精确状态仍为 `EXTERNAL_REFERENCE_ONLY / blocked-license`；本审查没有提升、改写或绕过该状态。
- 真实像素输入只来自已清除的项目自有 Honru 状态；背景、状态图标、PWA 和附加道具由冻结生成器直接构造。
- Ghost、游戏手柄、云、轨道、对勾、叉、锁、刷新箭头属于通用语义母题；组合使用 Ghost Game 自有 Ink/Paper/Cream 色系、Honru 身份锚点和低频贴纸语法。
- 为避免越过 `blocked-license` 边界，本审查没有把外部受限图像送入相似度模型，也没有做像素级外部对照。依据输入链、生成器代码和可见结果，机器风险评为低到中等；这不是法律意见。
- 如可选 Reviewer B 或 IP/法律咨询未来指出具体可识别冲突，应按稳定 Asset ID 返工；该可选咨询当前 `NOT_EXECUTED`，不伪造成 PASS。

## Runtime、a11y、fallback 与回滚

- Auth 背景、Auth Honru、Boot Honru、Auth 状态图标四个浏览器内运行时 Asset ID 由 family 总闸 `mg_art_p0_01_v1` 与各自子闸以 `all` 关系控制，缺省开启但可立即关闭。PWA Maskable 由静态 Web App Manifest 选择，浏览器安装面不读取 localStorage；其 Manifest `feature_flags` 是同批治理元数据，实际一键回滚是把两个 maskable 条目移回既有 any-purpose icon 并保留 HTML/CSS 启动壳，不能伪称 JS flag 会改变已安装的系统图标。
- 背景回到现有 Light/Dark CSS 环境；Auth Honru 回到 `P-HONRU-STATES-V1` 再到 `P-002-HONRU-MASCOT-V1`；Boot/PWA 回到 `P-001-GHOST-MARK` 与旧图标；状态图标回到可读 HTML 文案和 CSS 状态点。
- 所有插画均为装饰性增强；账号模式、错误、连接、进度、操作和语言信息继续由 HTML/i18n/ARIA 承担。
- 回滚不改变 Rule、Authority、Protocol、Reward、Replay、Economy、账号、社交正文、数据库或用户数据。

## 明确未执行或由其他核销步骤负责

- 独立自然人 Reviewer B、人工清稿、IP/法律意见、额外逐资产 Golden Set：`OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能、跨平台 PWA Splash/Maskable 裁切：`RELEASE_EVIDENCE_PENDING / NOT_EXECUTED`。
- 本记录不声称 `qa/auth-art-contract.js` 的最新独立运行、完整本地浏览器矩阵、Catalog/Approval Matrix 更新或 P0-01 台账核销已经由本文件完成；这些状态必须以各自最新证据为准。
- 没有执行 commit、push、Pages、Render、生产数据写入或发布。
