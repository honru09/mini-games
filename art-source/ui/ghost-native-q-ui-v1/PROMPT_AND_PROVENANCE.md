# Ghost-native Q UI v1 — prompt and provenance

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED`

## 生成边界

- 生成方式：Codex built-in `image_gen`。
- 生成日期：2026-08-17。
- 生成目标：Ghost-native Q UI source boards；不是第三方素材的改图、描摹或换色。
- 项目自有参考：`component-demo.png` 与 `core-ui-style-board-draft-v1.png`，哈希见 `asset-family-manifest-v1.json`。
- 外部 Q 版 UI/PSD/AI/RPG 素材：只作为语义覆盖范围，不作为图像输入。
- 禁止项：第三方角色、Logo、字体、完整构图、PSD/AI 图层、外部预览像素、文字、水印、照片纹理、强 Bloom、玻璃拟态和 PBR。

## Prompt set

1. `UI-QKIT-CORE-INTERACTION-V1`：原创核心交互源板，覆盖 button、panel、modal、tab、progress、badge、toast 状态。
2. `UI-QKIT-COMMERCE-PROGRESSION-V1`：原创商城/奖励源板，覆盖 shop card、reward frame、achievement、rarity ribbon、price chip、summary panel。
3. `UI-QKIT-ROOM-SOCIAL-MATCH-V1`：原创房间/社交源板，覆盖 room seat、invite、speech bubble、match result、presence token、player rail。
4. `UI-QKIT-IDENTITY-HOME-PROFILE-V1`：原创 Home/Profile 身份源板，覆盖 hero、profile card、avatar frame、badge、stat rail、settings tile。
5. `UI-QKIT-GAME-STAGE-HUD-V1`：原创 Game Stage HUD 源板，覆盖 state strip、turn/clock token、seat rail、action tray、result plaque、spectator/reconnect marker。
6. `UI-QKIT-FEEDBACK-RECOVERY-V1`：原创反馈源板，覆盖 empty、network、reconnect、loading、success/error、search/no-result、offline/fallback。
7. `UI-QKIT-GAME-COVER-ROSTER-V1`：原创六款游戏入口与社交编排源板，覆盖 game cover、game badge、roster rail、invite slot、presence marker 和 compact action affordance。
8. `UI-QKIT-SHOP-SURFACE-COSMETIC-V1`：原创商城外观源板，覆盖 cosmetic display frame、rarity surface、colorway strip、equip state、price/ownership slot 和 progression rail。
9. `UI-QKIT-HONRU-ACCENT-STICKER-V1`：原创 Ghost/Honru-adjacent 装饰源板，覆盖 emotion sticker、motion line、burst、corner accent 和 non-verbal state marker；不替代现有 Honru 九状态，也不构成第三方角色引用。
10. `UI-QKIT-GAME-PIECE-TOKEN-V1`：原创六款游戏棋子/代币源板，覆盖各游戏的抽象 piece、selected/win/disabled/colorway 变体，供后续各游戏透明派生。
11. `UI-QKIT-SOCIAL-REACTION-EFFECTS-V1`：原创局内社交反应源板，覆盖 ready、heart、star、applause、surprise、reconnect pulse、victory burst、error wobble 和无文字 reaction wheel。
12. `UI-QKIT-STAGE-SURFACE-BACKPLATE-V1`：原创 Home/Game Stage 背景表面源板，覆盖 cloud sea、deep space、paper grid、arcade lane、leafy tabletop、coral path 六类可读性优先的抽象 backplate。

## 首批新增三张源板的原创性与消费边界

- 三张新增文件均为 RGB Paper 源板（无 Alpha），仅用于视觉母板、组件重绘和后续透明派生，不直接进入 `public/assets` 或运行时 Manifest。
- `UI-QKIT-HONRU-ACCENT-STICKER-V1` 已做项目内相似性人工抽查：只保留抽象幽灵轮廓、表情语义和 Ghost Game 色彩语法；没有复制外部角色、品牌标记、独特服饰、文字、字体或可识别构图。
- 新增三项继续使用独立 default-off flag、既有 DOM/CSS/SVG/Unicode fallback 和可逆 family rollback；不会改变游戏规则、经济字段、协议、账号或社交正文。

### 第二批新增三张源板

- `UI-QKIT-GAME-PIECE-TOKEN-V1` 为 RGBA 源板，但 Alpha 覆盖全画布且不是干净切片透明；必须保留为源板候选，不得直接当作 sprite atlas。
- `UI-QKIT-SOCIAL-REACTION-EFFECTS-V1` 与 `UI-QKIT-STAGE-SURFACE-BACKPLATE-V1` 为 RGB Paper 源板；反应板使用抽象轮廓，不对应现有 Honru 九状态，背景板仅做低细节表面层。
- 三张第二批源板只增加语义覆盖和可视化候选，不改变 `direct-chat-v1`、`match-chat-v1` 的纯文字正文边界，也不改变平台主题、Game Stage Ink/Cream 或 reduced-motion 合同。

所有 Prompt 都冻结以下视觉约束：Ink `#211923`，Paper `#FFF9F2`，Cream `#F3E5C4`，语义 Green/Teal/Blue/Purple/Pink/Coral/Gold；粗 Round Cap/Round Join 轮廓；Base + Shade + 可选 Highlight；3–5px 硬接触影；44px 可读性；形状与颜色双编码；reduced-motion 仍有静态反馈。
