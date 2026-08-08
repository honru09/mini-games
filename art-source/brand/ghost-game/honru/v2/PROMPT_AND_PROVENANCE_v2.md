# Honru Character Master v2 Prompt 与来源记录

记录时间：2026-08-09 02:13（Asia/Tokyo）

## 资产身份

- 资产 ID：`BRAND-HONRU-CHARACTER-MASTER-V2-DRAFT`
- 状态：`SOURCE_ONLY / HUMAN_REVIEW_REQUIRED / DO_NOT_SHIP`
- 本地追踪 ID：`local:exec-249bbba4-cc19-4e02-abb5-fb4ec47bb993`
- 内置生成源：`C:/Users/wangxr/.codex/generated_images/019fd719-6249-7543-9cae-8ab40f096da3/exec-249bbba4-cc19-4e02-abb5-fb4ec47bb993.png`
- 项目色键源：`art-source/brand/ghost-game/honru/v2/chroma/honru-character-master-v2-chroma-draft-v1.png`
- 项目原始 Alpha：`art-source/brand/ghost-game/honru/v2/honru-character-master-v2-transparent-draft-v1.png`
- 项目首选三色平涂 Alpha：`art-source/brand/ghost-game/honru/v2/honru-character-master-v2-flat-transparent-draft-v1.png`
- 工具：Codex 内置 ImageGen（runtime managed）+ ImageGen Skill 色键移除 helper + 项目捆绑 Python/Pillow 确定性三色归并
- 许可：项目自有生成结果；无第三方素材输入；不得在 Reviewer B/用户决议前接入运行时。

## 输入参考角色

1. `honru-generated-candidate-v1.png`：只作角色身份参考；不保留伪棋盘格、重阴影、碎火焰、尖牙或复杂生成细节。
2. `teacher-8-state-contact-sheet-draft-v1.png`：只作粗闭线、Paper/Cream、两级平涂和小尺寸表情可读性的高层风格参考；不复制人物、服饰、眼镜、动作或道具。

用户的 503 网络错误截图没有进入生成输入；没有使用商业游戏截图、角色、表情或第三方资产。

## 内置 ImageGen 完整 Prompt

```text
Use case: stylized-concept
Asset type: original game companion mascot master candidate for later manual cleanup and animation separation
Input images:
- Image 1: subject identity reference only. Preserve the core Honru idea, but do not reproduce its checkerboard background, heavy shadow, fragmented flame rim, fangs, or generated-looking detail.
- Image 2: high-level style reference only for thick closed ink contours, warm paper/cream two-level flat shading, handmade 2D sticker finish, and clear small-size expressions. Do not copy the human character, clothing, glasses, pose, or props.

Primary request: Create one wholly original Honru v2 character. Honru is a cute black-and-white ghost spirit whose body itself also reads as a compact game controller. The ghost body and two rounded controller grips must be one continuous low-frequency silhouette, never a ghost holding a separate controller.

Scene/backdrop: one perfectly flat solid #00ff00 chroma-key background for local background removal. The background must be exactly uniform with no shadows, gradients, texture, reflections, floor plane, checkerboard, or lighting variation.

Subject:
- one centered full-body Honru, front-facing with only a very slight three-quarter liveliness
- a compact rounded ghost/controller body with two soft grip-like lower lobes
- one simple flame crest that belongs to the body, with no more than three large rounded flame waves
- two tiny simple mitten-like hands, clearly separated from the torso, no visible individual fingers
- left eye is one bold readable directional-pad cross
- right eye is exactly four evenly spaced round controller buttons
- one tiny friendly curved smile, no teeth, no fangs, no tongue
- lively, warm, clever expression; cute but not babyish

Style/medium: carefully art-directed hand-inked 2D sticker illustration; strong closed Ink outline; clean vector-like curves with slight human irregularity; two-level cel shading only; restrained paperboard warmth; no glossy rendering.

Composition/framing: single character only, centered, full silhouette visible, generous 15 percent safe padding on every side, balanced near-symmetry, readable at 64px.

Lighting/mood: simple upper-left key light expressed only through one flat Paper highlight and one compact Cream lower-right interior shade; no cast shadow outside the sticker silhouette.

Color palette: Ink #211923, Paper #FFF9F2, Cream #F3E5C4 only inside the subject. Do not use #00ff00 anywhere in the subject.

Constraints: original design only; preserve the controller-eye identity; crisp closed edges; no text; no pseudo lettering; no logo; no watermark; no extra characters; no props; no clothes; no crown; no shield; no badge; no weapon; no emoji; no commercial-game character silhouette, costume, expression frame, pose, or composition.

Avoid: photorealism, 3D render, PBR, plastic gloss, soft gradients, bloom, rim-light haze, realistic fire, many flame tendrils, floating particles, confetti, complex gray noise, checkerboard transparency, floor shadow, detached controller, malformed hands, extra buttons, asymmetrical eye count.
```

## 透明处理

执行 ImageGen Skill 官方 helper：

```text
remove_chroma_key.py --auto-key border --soft-matte --transparent-threshold 12 --opaque-threshold 220 --despill
```

- 自动识别色键：`#05f610`
- 透明像素：`1,051,350 / 1,572,516`
- 半透明像素：`3,969 / 1,572,516`
- 四角 Alpha：`0 / 0 / 0 / 0`
- 可见绿色污染像素：`0`

## 去生成感三色归并

原始 Alpha 保留为审计中间件；首选候选把所有可见像素确定性映射到最近的三种项目色，Alpha 不变：

- Ink：`#211923`
- Paper：`#FFF9F2`
- Cream：`#F3E5C4`

三色归并删除连续柔光与微渐变，保留轮廓抗锯齿和透明边缘。192/96/64/44px 派生图均由首选三色 Alpha 使用 Lanczos 生成。

## SHA-256

- 色键源：`1f4a02bfbce503fd91cb0228e7da6dff4069443cdfeda6bf17ba9ccf301790eb`
- 原始 Alpha：`08e7213a1f732140e0d6c6c61e09652526445f654494afc544f6e1052d2ca8a6`
- 三色平涂 Alpha：`9b9bd08f109ef83ba1da19007a6965d3caed3e3fa66b2a9a027c0120044fe971`
- 192px：`8059b7e0b19a160c44055d397b17061cdd021bb7048722617ad5d7717db49ea5`
- 96px：`dc4f9b61931149494bb0cca8809f319f2180278312024d23379d085de6c4302e`
- 64px：`3af5e9bcaa3a20e44c28dc177075256d59560ea2b7fb6720bcd745c64bd3e588`
- 44px：`80bbe44cacc3a2b000d221da954cce284c4c60cdaaea0eba14557bdc07e06292`
