# P-IDENTITY-BADGE-SYSTEM-V1 Prompt 与 Provenance

## 资产目的

为排行榜、成就、每日任务、六游戏胜场精通、收藏稀有度、等级称号与赛事身份建立同一套 Ghost-native 小尺寸徽章语言。徽章只表达既有状态，不创造或修改排名、胜场、奖励、任务、收藏、价格、赛事或持久数据事实。

## 艺术指导 Prompt

Model: `gpt-image-2`（只用于 prompt/craft 结构审查，未调用付费图像 API）  
Quality: `high`  
Size / Ratio: `1024×1024 / 1:1`

```text
Create a square modular identity-system board for the original Ghost Game web platform.

Scene: a precise 7-section grid showing leaderboard ranks, achievements, victory mastery, collection rarity, player titles, tournament identity and daily-task badges.
Subject: 34 original compact enamel-style badge concepts with one clear silhouette and one semantic glyph each.
Important Details: thick #0A1020 ink outlines; #FFF4D8 cream enamel centers; controlled #5CE1E6 cyan, #9B7BFF violet, #FF7A77 coral and #F7C969 gold accents; friendly paper-cut depth; balanced highlights; readable at 32 px; coordinated but distinct frame families; no text inside the badges.
Use Case: shipped DOM UI assets for leaderboard rows, profile cards, achievement wall, collection chips and tournament standings.
Constraints: original Ghost-native shapes; no commercial-game marks, logos, watermarks, human hands, copied pixels, baked numbers, labels, reward values or protocol state; crisp isolated silhouettes; consistent stroke weight; static artwork with transparent background.
```

艺术指导依据 `image` Skill 的 GPT Image 2 五槽 prompt、明确色值、小尺寸可读性与约束清单；归属要求：Serge Shima / [smixs/visual-skills](https://github.com/smixs/visual-skills)，CC BY 4.0。`gpt-image` Skill 的 Brand Systems & Identity Gallery 与 craft 规则用于多模块一致性、固定结构和原创/IP 边界审查。

## 最终生产路径

- 生成方式：`scripts/generate-identity-badge-system-v1.js`
- 源稿：34 个项目自有确定性 SVG；无 `<text>`、外链图片、滤镜纹理输入或外部像素。
- Runtime：每徽章 32/48/64 px WebP，共 102 个变体。
- Runtime 总字节：143,090 bytes；预算 2 MiB。
- Review Board：`review/identity-badge-system-contact-sheet-v1.png`
- Manifest：`asset-family-manifest-v1.json`
- Feature flag：`mg_art_identity_badge_system_v1`，default-on，可置 `0` 回退既有 Emoji/Unicode/游戏状态标记和本地化文字。

## 来源与许可

- 作者：OpenAI Codex for Ghost Game。
- 许可：项目自有确定性矢量与 Sharp 派生。
- 外部 `EXTERNAL_REFERENCE_ONLY / blocked-license` 输入：0。
- 第三方生成供应商传输：0。
- Runtime 候选状态：`OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / NOT_RELEASED`。

