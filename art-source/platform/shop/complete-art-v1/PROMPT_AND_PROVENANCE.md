# Prompt & Provenance: Shop Complete Art v1 (P-SHOP-COMPLETE-ART-V1)

## 1. 资产族定义

- **Family ID**: `P-SHOP-COMPLETE-ART-V1`
- **Family Flag**: `mg_art_shop_complete_v1`
- **Asset ID**: `P-SHOP-COMPLETE-ART-V1`
- **Source ID**: `ART-041-SHOP-COMPLETE-ART-V1`
- **Clearance Record**: `art-source/platform/shop/complete-art-v1/OWNER_AUTHORIZED_ART_CLEARANCE.md`

## 2. 视觉意图与设计规范

1. **五阶稀有度视觉层次 (Rarity Hierarchy)**:
   - **Common (普通)**: 灰白石质 / 哑光银线，低调简洁，沉稳内敛。
   - **Rare (稀有)**: 蔚蓝 / 冰晶浅蓝光芒，清脆锐利。
   - **Epic (史诗)**: 幻紫 / 星河紫金，华丽高贵，带有微弱脉冲光感。
   - **Legendary (传说)**: 鎏金 / 琥珀流金，带有皇冠与光晕纹理。
   - **Mythic (神话)**: 赤红霓虹 / 赛博棱镜彩虹，顶级动感，带星芒与极光折射。

2. **商品展台与地台 (Display Pedestals)**:
   - 320×180 视角，椭圆 2.5D 透视切面。
   - 分层阴影、光环底盘与浮空微光。

3. **分类导航图标 (Category Tab Icons)**:
   - 128×128 像素，高可辨识度矢量图形。
   - 涵盖：Avatars (角色/头像)、Frames (边框)、Effects (光效)、Backgrounds (背景)、Skins (棋盘/道具皮肤)、Specials (特惠/礼包)。

4. **购买反馈与动效粒子 (Purchase Feedback VFX)**:
   - 购买成功瞬态爆花 (Purchase Burst)。
   - 稀有解锁放射光芒 (Unlock Ray)。
   - 金币扣除与微粒飞溅 (Coin Deduct)。
   - 装备成功徽章印章 (Equipped Badge)。
   - 稀有光芒 (Rarity Glow)。
   - 折扣优惠角标 (Discount Tag)。

5. **2.5D 与无障碍契约**:
   - 纯 DOM / CSS / Canvas + GSAP 驱动。
   - 严格支持 `prefers-reduced-motion: reduce` 静态降级变体（所有 24 个角色均提供对应 `-static.webp` 文件）。
   - 绝对零 Three.js / WebGL 强依赖。
