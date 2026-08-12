# Honru Emoji v1：Prompt 与 provenance

状态：`reference-only / HUMAN_REVIEW_REQUIRED / DO_NOT_SHIP`

生成日期：2026-08-11（Asia/Tokyo）  
用途：ART-024 / ART-025 / SOC-017 / GAME-023 的十枚原创 Honru Emoji 源稿审查包。  
生成方式：内置 `image_gen` 最高质量运行时（未切换 CLI、未降级到低质量模型）；每枚独立调用一次。  
许可：`project-owned-ai-generated`；来源输入仅使用项目自有 Honru cleanup candidate 与九状态动作板，不使用第三方截图、角色、厂牌或艺术家名字。

## 固定身份锚点

每次 Prompt 都重复以下不可变约束：幽灵与手柄同体、三段圆润火苗、近黑粗线、象牙白主体、左眼十字方向键、右眼四个圆形按键、短圆手臂；只改变手势、嘴形和姿态。画面为单角色、正方形、均匀 `#00ff00` 色键底，无阴影/渐变/地面/反光/水印/文字。生成后使用工作区捆绑 Python 与技能提供的 `remove_chroma_key.py`，`--auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill` 输出 Alpha。

## 逐枚 Prompt 语义（与生成调用一致）

| 稳定 ID | 画面请求（English，作为逐枚 Prompt 的 Primary request） | 生成源 | Alpha 结果 |
|---|---|---|---|
| `emoji_wave` | cheerful friendly wave with one raised open hand and warm welcoming smile | `exec-bc76de1c-836c-470f-b70f-49766c6cd3a6.png` | `alpha/honru-emoji-wave-alpha-draft-v1.png` |
| `emoji_thumbsup` | enthusiastic thumbs-up with one raised thumb, confident smile and tiny friendly cheek marks | `exec-29cef098-1432-4137-ac24-a7d1de7cd966.png` | `alpha/honru-emoji-thumbsup-alpha-draft-v1.png` |
| `emoji_cheer` | celebrating a win with both short arms raised in a joyful V, bright open smile and two tiny star accents | `exec-3939e20d-06a9-4ed8-b1ca-c18ec5db0f35.png` | `alpha/honru-emoji-cheer-alpha-draft-v1.png` |
| `emoji_wow` | delighted surprise with both hands beside the cheeks, tiny round open mouth and two small surprise marks | `exec-dc7abb42-4990-49d1-bd97-9d9bf2a7ef6d.png` | `alpha/honru-emoji-wow-alpha-draft-v1.png` |
| `emoji_oops` | oops pose: one hand touching the head, the other open in apology, worried mouth and one small sweat drop | `exec-69b5d26a-355c-4d20-9ba9-0daca7523e1b.png` | `alpha/honru-emoji-oops-alpha-draft-v1.png` |
| `emoji_cry` | sad-but-cute pose with hands near cheeks, downturned mouth and two simple outlined teardrops | `exec-1550cedc-a82b-4686-bfce-9b8bc71ff368.png` | `alpha/honru-emoji-cry-alpha-draft-v1.png` |
| `emoji_angry` | cute firm protest with hands on hips, determined brows, puffed-cheek mouth and no threatening objects | `exec-df320cf6-6115-430d-9b8c-a147721f3bab.png` | `alpha/honru-emoji-angry-alpha-draft-v1.png` |
| `emoji_sly` | playful sly pose with a finger-to-cheek gesture, asymmetric raised brow and sideways friendly smile | `exec-714a1e20-7f96-4914-8586-ee73e185d52e.png` | `alpha/honru-emoji-sly-alpha-draft-v1.png` |
| `emoji_heart` | sending care while holding one simple ivory outlined heart at the chest with a soft smile | `exec-ad2b7ab2-bfed-486d-b2b4-b53bf03387bf.png` | `alpha/honru-emoji-heart-alpha-draft-v1.png` |
| `emoji_game` | game-on / another-round ready stance, one friendly beckoning hand, one small fist and two motion ticks | `exec-3102d17f-063f-4bf3-9058-1ec0cbb86aea.png` | `alpha/honru-emoji-game-alpha-draft-v1.png` |

除上表 Primary request 外，每次调用都包含固定的 square framing、44px legibility、extreme black/ivory palette、无第三方风格名、无额外对象和色键约束。十次都是独立生成，未使用 `n` 伪批量，也未将 contact sheet 当作十枚素材。

## 输入与处理记录

- Image 1（identity reference）：`art-source/brand/ghost-game/honru/cleanup-candidate-v1/alpha/honru-cleanup-candidate-v1-alpha.png`。
- Image 2（motion-language reference）：`art-source/brand/ghost-game/honru/states-v1/preview-honru-expression-kit-draft-v1.png`。
- 生成原图保留于 Codex 生成目录作为临时 provenance；项目正式副本只保存在本目录 `chroma/`。
- `alpha/` 为色键抠图审计中间层；`derived/`、`atlas/`、`poster/` 是未审批的审查派生物；没有任何文件复制到 `public/`。
- 生成后检查：十枚 1254×1254、RGBA 四角透明、可见绿污染 0；40 个 192/96/64/44 派生尺寸；1024×768 4×3 atlas 末两格透明；640×360 poster；44px strip 人工可见复核通过。

## 审批边界

本包不是人工清稿、Reviewer B、IP Review 或 Golden Set 签字。`angry` 的嘴形与 `heart` 的大心形尤其需要人工检查 44px 语义和原创相似性。通过全部人工门禁前，双旗标 `mg_art_honru_emoji_v1` / `mg_art_honru_emoji_throw_v1` 不得创建到生产 Manifest，也不得在聊天或局内默认替换 Unicode fallback。
