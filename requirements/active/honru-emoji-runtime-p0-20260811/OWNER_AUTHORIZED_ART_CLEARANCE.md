# Honru Emoji v1 所有者美术清除记录

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED`  
资产组：`P-HONRU-EMOJI-V1`  
版本：`1`  
清除日期：2026-08-16（Asia/Tokyo）

## 授权与 M0 North Star

项目所有者已解除原创 Ghost-native 美术对人工清稿、Reviewer B、IP/法律意见与逐资产 Golden Set 的内部等待。十枚 Emoji 继续以 M0 North Star 为唯一方向：Honru 幽灵/手柄同体、左十字眼、右四圆眼、Ink/Paper/Cream、粗圆轮廓、两级平涂、简单可爱且没有商业游戏角色或厂牌语法。

本记录允许这一原创资产族进入带 fallback、双 feature flag 和一键回滚的可逆 default-on runtime。它不是人工签字、法律结论或线上发布授权。

## 稳定来源与派生身份

- source atlas PNG SHA-256：`a767fd48b1b738e4b1939d8b368acc0df51dee7199af9db65c3899b4308d6ba7`
- source poster PNG SHA-256：`4b22256408b4222b99ba53b94af65c82a96fc1571b891b9c45e4c0869801e01d`
- runtime atlas WebP：`public/assets/brand/honru/emoji-v1/honru-emoji-atlas-v1.webp`
- runtime atlas SHA-256：`63108f289eab68f096cae59e2c32623e9e09b67fbebebb3383cc317494530d6a`
- runtime poster WebP：`public/assets/brand/honru/emoji-v1/honru-emoji-poster-v1.webp`
- runtime poster SHA-256：`ec4b5a263839367a6ddcb9ced1b1b58fa2cbd24b0812b290be17eb7da84b9e35`
- 十个稳定 ID：`emoji_wave`、`emoji_thumbsup`、`emoji_cheer`、`emoji_wow`、`emoji_oops`、`emoji_cry`、`emoji_angry`、`emoji_sly`、`emoji_heart`、`emoji_game`。

Atlas 为 1024×768、4×3、每格 256×256、末两格全透明的单帧 Alpha WebP，302,314 bytes；poster 为 640×360 单帧 WebP，67,146 bytes；合计 369,460 bytes，低于 1,232,896 bytes 组合预算。Prompt、逐枚任务、Alpha、40 份尺寸派生和来源记录见 `art-source/brand/ghost-game/honru/emoji-v1/PROMPT_AND_PROVENANCE.md`。

## 机器视觉、技术与相似风险审查

- 十枚均保留三项 Honru 强身份锚点；44px strip 中十字眼、四点眼和主要姿态仍可识别。
- 10/10 Alpha 为 1254×1254 RGBA、四角透明、可见绿色污染为 0；atlas 最后两格 Alpha 最大值为 0。
- `angry` 的口型、`heart` 的心形和 `cry` 的泪滴属于通用情绪符号，在小尺寸下仍应由本地化 aria-label/文字补足，不得只靠图像传达复杂语义。
- 生成输入仅为项目自有 Honru cleanup 与 states-v1；Prompt 不含第三方角色、商业截图、品牌或艺术家名字。机器相似风险评为低到中等；可选专业咨询如发现具体问题，按稳定 ID 单枚返工。
- 外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材没有例外：不得复制、描摹、裁切、换色、作为生成输入、接入或发布。

## Runtime、fallback 与回滚

- Manifest 稳定 ID：`P-HONRU-EMOJI-V1`；只从版本化本地 Manifest 解析 atlas/cell，不把路径或位图写入协议。
- `mg_art_honru_emoji_v1`：缺失或精确字符串 `1` 时默认开启；任意其他值关闭图片并回到 per-id Unicode fallback。
- `mg_art_honru_emoji_throw_v1`：缺失或精确字符串 `1` 时允许定向投掷表现；任意其他值只关闭投掷轨迹，不关闭选择器与头像旁静态 Emoji。
- Manifest、路径、尺寸或 decode 失败时保留 Unicode glyph，再保留本地化可读文字；不得空白或阻塞输入。
- 资源不进入消息正文、数据库、moveLog、Replay、Reward、AI 学习、Analytics、Profile 或用户经济状态。Direct Chat 与 match-chat-v1 继续纯文字，后续图片消息必须另立版本化协议。

## 可选咨询与发布证据

人工清稿、独立自然人 Reviewer B、IP/法律意见与额外 Golden Set 均为 `OPTIONAL_ADVISORY_EVIDENCE / NOT_EXECUTED`，当前没有虚构任何人工或法律通过结论。第二浏览器、物理 Android/iPhone/Tablet、真实网络、低端性能与线上构建仍为 `RELEASE_EVIDENCE_PENDING`。任何 commit、push、Pages、Render 或生产数据操作仍需用户当前明确命令。
