# P0-10 Player Character 七槽分层 — Prompt and Provenance

状态：OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED  
生产单元：P0-10 / P-PLAYER-CHARACTER-LAYERED-V1  
ImageGen task ID：exec-11ea459c-d1aa-4a6a-b5d6-91ff4062146b

## 视觉锚点

source/ai/player-character-six-pose-master-v1.png 是项目自有视觉锚点，不是 runtime。实际落盘为 1536×1024 / RGB / opaque；模型没有兑现 genuine alpha，因此仅按确定性 checkerboard matte 提取六个姿态源原子。七槽运行时图层全部由项目本地 SVG 生成，拥有真实透明 Alpha。

输入均为项目自有文件：

| 输入 | 角色 | SHA-256 |
|---|---|---|
| art-source/ui/sticker-v1/component-demo.png | M0 UI 状态、粗黑轮廓、可读性 | 135DB655DC400FB35F960045B510EE450E007CCFAD03E308DEBF65E222DB1F61 |
| art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png | 纸张材质、阴影、色彩系统 | 184E24BFD5C52F54FA240366787A0751E5078038E4FBDA17B91C61219F2B4DE5 |
| art-source/player-character/art-036-player-character-monopoly-p1-20260810/player-character-direction-board-draft-v1.png | 项目自有旧角色方向锚点，身份/比例/服装缝线 | 048606E833D7C7BD7CDB8B213FC1BE32895F41181B620AC9A02E6249F683B153 |

## 最终 Prompt

    Use case: stylized-concept
    Asset type: project-owned game player-character identity and motion reference board for a layered 2.5D web runtime
    Primary request: Create one original Ghost Game player-character board in an exact 3 columns by 2 rows layout, showing the same independent player avatar in six isolated full-body poses: idle front, walk contact A, walk passing B, focused tabletop stance, friendly wave, compact victory celebration. This is the player’s own avatar, clearly separate from mascot Honru and separate from the Ghost Game logo.
    Input images: Image 1 and Image 2 are project-owned visual North Star references for thick ink contour, warm paper surfaces, compact state readability, rounded corners, and restrained teal/blue/gold/coral/violet accents. Image 3 is the project-owned earlier player-character direction board; preserve its compact paper-doll proportions, hooded casual identity, two feet, simple face and asymmetric stitched patch concept, while refining it into a cleaner Ghost-native layered silhouette. Do not copy any outside franchise.
    Scene: genuinely transparent background with six isolated cells and no panels, floor, labels, captions, borders or UI.
    Subject: one gender-neutral chibi player avatar with a large rounded head, compact torso, short rounded limbs, two clear feet, smooth Q-version hands, dot eyes and a tiny readable mouth. Clothing feels cut from warm cream paper and matte cloth; hoodie, shorts and sneakers use broad separable shapes. One original asymmetric paper-seam patch on the torso is the identity accent.
    Important Details: exact same face, proportions, hair silhouette, clothing seam and palette in all six poses; fixed upper-left key light; two-level cel shading; thick dark plum-black outline; small contained lower-right contact shadow; broad slot-friendly boundaries for body, face, hair, top, bottom, footwear and accessory layers; expressive but not childish; readable at 44px.
    Use Case: source-only visual anchor for deterministic transparent layer atoms and six compact runtime pose masters in DOM/CSS/Canvas/GSAP 2.5D presentation.
    Constraints: exact 3x2 grid; one complete character per cell; all limbs and both feet fully visible and separated; genuine alpha; no text, letters, numbers, logos, watermarks, human-realistic hands, weapons, crowns, armor, flags, fake writing, glossy plastic, photorealism, bloom or franchise motifs. Original Ghost-native design only.

## 本地派生与交付

- 七个 slot 的透明 SVG source atoms：body 4 / face 6 / hair 8 / top 10 / bottom 6 / footwear 6 / accessory 12，共 52 个；顺序固定为 body → bottom → footwear → top → face → hair → accessory。
- 六个姿态源原子：idle-front / walk-contact-a / walk-passing-b / focus-tabletop / friendly-wave / victory-compact；三组 compact actions：idle / walk / celebrate。
- 每个 layer 与 pose 提供 128/256 WebP runtime；另有 default-neutral 组合 fallback。所有 runtime 只位于 public/assets/player-character/layered-v1/。
- 角色身份、slot、action 名称和大富翁位置仍由公开 player-character-v1 与既有 authority 投影表达；图片不创建 owned/equipped、价格、G Coins、规则或 Replay 事实。

## 受控外部参考上下文

Skill 已掌握 asset-library/external-source-register-20260813.json 的完整库存上下文：RPG 角色包 64 ZIP、44,145 PNG 帧、708 个 Q UI PSD/AI/JPG/PNG 文件、288 PSD/361 AI/3,170 EPS 的只读结构记录、836 个文件 aggregate SHA-256 a7151ed3c6b32fd1306962accd42f8f838a8e5b8d1ea54f4fc4a56397842298。本批只使用动作覆盖和分层槽位的语义库存，没有把外部文件、预览、像素、图层、Archive member 或向量对象传给任何 Skill。外部状态仍是 EXTERNAL_REFERENCE_ONLY / blocked-license，不因被登记而获得授权，不进入 runtime。

## 许可与拒绝项

- 许可：项目自有 AI 视觉锚点 + 项目本地原创 SVG/Sharp 确定性派生，候选可走 OWNER_AUTHORIZED_ART_CLEARANCE。
- 未复制、描摹、换色、去水印或拼接第三方素材；未调用付费外部供应商。
- source/ai 锚点保留 opaque 事实；仅对六个姿态做中性 checkerboard matte，不能把该处理描述成手工清稿或法律去背。
- 人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 是 OPTIONAL_ADVISORY_EVIDENCE，当前未执行；当前浏览器/真机/发布仍为 RELEASE_EVIDENCE_PENDING。
