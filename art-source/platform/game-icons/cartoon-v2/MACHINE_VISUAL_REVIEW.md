# P0-12 机器视觉审查

状态：TECHNICAL_VISUAL_PASS / LOCAL_ONLY / REAL_BROWSER_NOT_EXECUTED

- 六款剪影分别由双棋子+网格、飞机+四色航点、城市+骰子、盾形坦克、积木阶梯、马首棋印编码，不依赖颜色单独区分。
- 44/64/96px 核心图标、theme/selected 物件与 24/32/44px 全部 12 marker 均进入 light/dark 综合检查板；66 个透明原子 outer-gutter 的 edgeAlphaPixels/edgeAlphaMax 均为 0。
- 6 个 cover crop 保留设计性卡片边框，edgePolicy=opaque-edge-intentional；不把它误判为透明污染。
- cover crop/theme/selected-object 沿用 Ink/Paper、两级明暗、左上光与右下硬底影；selected-object 为浅 2.5D 纸板物件，不是 Three/PBR。
- 12 个 marker 只映射已有真实语义；未创造 maintenance、favorite、rank up/down 等不存在的产品状态。
- 限制：检查板和像素合同不冒充第二浏览器、真机、人工盲测、Reviewer B、IP/法律或逐资产 Golden Set。
