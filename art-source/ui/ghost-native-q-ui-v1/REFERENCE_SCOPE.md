# Ghost-native Q UI v1 — reference scope

状态：`OWNER_AUTHORIZED_ART_CLEARANCE / SOURCE_BOARD / LOCAL_ONLY / NOT_RELEASED`

本批把项目登记的全部外部 Q 版 UI/PSD/AI/RPG 素材纳入**语义参考范围**：按钮、卡片、弹窗、商城卡、奖励、成就、进度、玩家席位、状态反馈、空态、恢复态，以及 idle、blink、walk、run、hurt、attack、taunt、dying 等动作覆盖。外部登记当前包含 836 个容器/预览文件、44,145 个 PNG 动画帧和 3,819 个 PSD/AI/EPS 结构源；它们只用于建立组件覆盖矩阵、状态词典、布局层级、动作语义和性能预算。完整登记事实源为 `asset-library/external-source-register-20260813.json`。

本批生成没有把任何外部文件、截图、PSD/AI 图层、角色位图或预览图作为图像输入；图像模型只使用项目自有 M0 North Star：`art-source/ui/sticker-v1/component-demo.png` 与 `art-source/ui/sticker-v1/generated/core-ui-style-board-draft-v1.png`。外部素材不得被复制、描摹、裁切、换色、作为生成输入或接入 runtime；新图全部以 Ghost-native Ink/Paper/Cream 语法重新构图。

当前已形成 12 张 Ghost-native 原创源板，覆盖核心交互、商城成长、房间社交、身份、Game Stage HUD、反馈恢复、游戏入口/roster、商城外观、Honru-adjacent 装饰、棋子/代币、社交反应效果和 Stage 背景表面。它们全部以独立 ID、SHA、feature flag、fallback 和回滚边界纳管。

这份范围声明提升的是内部创作与授权推进的活跃度，不是第三方版权许可。外部素材仍保持 `EXTERNAL_REFERENCE_ONLY / blocked-license`；本目录中的原创母板单独走 `OWNER_AUTHORIZED_ART_CLEARANCE`。
