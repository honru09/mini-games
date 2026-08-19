# P0-01 Auth / Launch Art v1 — Prompt 与来源

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED`  
资产族：`P-AUTH-LAUNCH-ART-V1`  
生产单元：`P0-01`  
美术版本：`1`  
记录日期：2026-08-17（Asia/Tokyo）

## 结论先行

本资产族的最终文件不是第三方素材改图，也不是失败 ImageGen 调用的产物。最终采用项目自有的确定性派生链：背景、状态图标、PWA Splash 与 Maskable 由代码原生 SVG 构造；Auth/Boot Honru 由已经取得所有者清除的 `P-HONRU-STATES-V1` 母图与本项目新绘制的 SVG 状态标记合成，再派生 160/240/320 WebP。

所有逐文件路径、SHA-256、字节、尺寸、Alpha 与 runtime 映射以同目录 `asset-family-manifest-v1.json` 为准。

## 图像生成尝试与实际采用路径

- 曾尝试 Codex built-in ImageGen；工具返回 HTTP 401：`authentication token invalidated`。
- 该失败调用没有产生被接纳的二进制文件，仓库也没有可核验的任务 ID，因此本记录明确写 `repositoryTaskId: null`，不编造任务号。
- 没有改走需要 API Key 的 CLI，没有调用第三方图像模型，也没有把任何外部 Q 版 UI/PSD/AI/RPG 文件发送给生成器。
- 实际采用 `scripts/generate-auth-art-v1.js`；冻结 SHA-256 为 `8F16DCF79C85DAF99DA6055A30A683A37CEACDD7EC1F7FC5F78414C82BC0617E`，25,367 bytes。
- 该脚本只读取项目自有 Honru runtime 母图和 `public/assets/brand/ghost-game-mark.svg` fallback；M0 两图只负责视觉裁决，不被脚本采样或合成。

## 唯一视觉方向

1. `art-source/ui/sticker-v1/component-demo.png`  
   SHA-256 `135DB655DC400FB35F960045B510EE450E007CCFAD03E308DEBF65E222DB1F61`，1600×900 RGB。
2. `art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png`  
   SHA-256 `184E24BFD5C52F54FA240366787A0751E5078038E4FBDA17B91C61219F2B4DE5`，1672×941 RGB。

视觉约束冻结为：Ink `#211923`、Paper `#FFF9F2`、Cream `#F3E5C4`；Green/Teal/Blue/Purple/Pink/Coral/Gold 只承担语义；粗圆轮廓、Round Cap/Round Join、低频平涂、无照片纹理、无 PBR、无强 Bloom、无外部字体、无烘焙 UI 文案。

## 确定性 Art Brief

### Auth Ghost Wake 背景

为 Light/Dark 各制作独立 Desktop 1920×1080 与 Mobile 900×1200 构图。使用云海、深空、轨道、信号弧和抽象游戏 token，中央与表单侧保留低干扰留白。背景不承担状态、账号、错误或操作信息；这些信息始终由 HTML 提供。

### Auth Honru 八场景

| 场景 | 项目自有 Honru 母状态 | 新增语义标记 |
| --- | --- | --- |
| `login-welcome` | `waiting-invite` | 欢迎轨迹、信号节点 |
| `register-create` | `check-in` | 创建卡片、确认标记 |
| `legacy-migrate` | `recover` | 旧凭证到新凭证的迁移箭头 |
| `guest-safe-entry` | `idle` | 临时档案卡、安全盾牌 |
| `connecting` | `thinking` | 双向信号弧、连接节点 |
| `credential-error` | `surprised` | 错误叉与校验线 |
| `recovered` | `recover` | 恢复箭头与成功确认 |
| `first-start` | `playful` | 首次旅程轨迹和抽象 token |

母状态均来自 `public/assets/brand/honru/states-v1/`，逐状态输入 SHA 与消费关系已写入 family manifest。合成画布为 512×512 真 Alpha PNG，再以 contain 方式派生 320/240/160 WebP；不重画或替换 Honru 的身份锚点。

### Boot Honru 两场景

- `honru-boot-controller-hug`：使用 `honru-idle-v1.webp`，叠加项目自绘手柄与轻量运动弧。
- `honru-boot-retry-signal`：使用 `honru-recover-v1.webp`，叠加重试信号弧与返回箭头。

Boot 插画只装饰已有的真实 HTML 启动阶段与不定进度；不得伪造可计算的百分比。

### Auth Status 六枚图标

覆盖 `username-available`、`username-occupied`、`password-error`、`migration-success`、`connected`、`offline-retry`。所有图标为 64×64 SVG，以轮廓、形状和颜色双编码；`title/desc` 是 SVG 元数据，不含可见 `<text>`。图标始终是可读 HTML 状态文案的装饰性增强。

### PWA Launch

- Light/Dark Splash 的 SVG 母版为 2048×2732，运行时派生为 1080×1920 WebP。
- Maskable 母版为 512×512 SVG，运行时为 192/512 全画布不透明 PNG。
- Maskable 的核心徽记位于中心半径 194px 圆内，小于 512px 画布的 40% 安全半径 204.8px；物理设备最终裁切仍须真实设备证据。

## 外部素材边界

已登记的外部 Q 版 UI/PSD/AI/RPG 素材只回答“需要覆盖哪些认证、连接、恢复、启动和 PWA 语义”。其状态永久保持 `EXTERNAL_REFERENCE_ONLY / blocked-license`。

本资产族没有复制、描摹、裁切、换色或拼接外部像素、图层、角色、商标、字体、独特道具或构图；外部文件也没有作为图像生成输入、脚本输入、runtime 资源或发布资源。语义覆盖不等于第三方授权，本记录不改变任何外部素材的许可状态。

## 许可与责任边界

- 确定性 SVG、合成标记与派生文件：`project-owned-deterministic-vector`。
- Honru 场景派生：`project-owned-derived-from-owner-cleared-honru`。
- Author/Operator：OpenAI Codex for Ghost Game，机器辅助本地制作。
- 人工清稿、独立自然人 Reviewer B、IP/法律意见、额外逐资产 Golden Set：`OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`。
- 第二浏览器、物理 Android/iPhone/Tablet、真实网络和跨平台 PWA 启动裁切：`RELEASE_EVIDENCE_PENDING / NOT_EXECUTED`。
- 本地美术清除不授权 commit、push、Pages、Render、生产数据写入或正式发布；发布仍需当前用户明确命令。

