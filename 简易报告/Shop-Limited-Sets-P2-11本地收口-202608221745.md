# Shop Limited Sets P2-11 本地收口简报（2026-08-22 17:45）

## 结论

P2-11「商店限定套装」已完成本地实现与机器验收，状态为 `IMPLEMENTED / OWNER_AUTHORIZED_ART_CLEARANCE / LOCAL_ONLY / RELEASE_EVIDENCE_PENDING`。商城现在有四套 Ghost-native 季节策展陈列：春日信号、夏潮航线、秋灯典藏、冬夜观测。

## 已完成

- 每套只引用既有头像、头像框、效果和背景单品，显示精确 `N/4` owned 进度。
- 提供桌面、移动和 poster 三种原创主视觉派生，Manifest、SHA、feature flag、decode 失败回退和关闭开关齐全。
- 组合预览只读，可跳转到既有单品 Tab；四件单品仍逐件购买。
- 发现并修复服务端 `SHOP_PRICES` 与 Supabase `apply_purchase_v1` 白名单漂移，111 项目录已完成同构回归；购买同步异常稳定回执 `purchase_sync_failed`。
- 已通过商城专项、购买反馈、商城布局、语言刷新、Supabase schema、目录同构、i18n 与代码健康检查。
- 最终确定性构建：`public/index.html` 2,143,263 characters / 2,158,021 bytes / SHA-256 `438BFFCDF8D04FA34BEC717596CCF4DA68CC6372D900BA0342C0944CBA09F8DF`。

## 明确边界

“限定”仅为本地视觉策展语义，不代表真实限时销售。没有套装 SKU、`bundle/purchase_set`、套装价格、折扣、库存、倒计时、Remote Config、Battle Pass、新 owned 或自动批量购买/装备。外部 Q 版/PSD/RPG 素材仅保留 `EXTERNAL_REFERENCE_ONLY / blocked-license` 库存上下文，未传输像素/图层，未进入 Runtime。

## 尚未执行

当前构建完整商城浏览器矩阵、第二桌面浏览器、Android/iPhone/Tablet 真机、真实网络整形、低端性能、真实 Supabase 生产迁移/并发/备份/恢复，以及 commit/push/Pages/Render。以上属于发布证据或外部环境，不阻塞下一本地单元。

## 下一主线

自动进入 `P2-12 / P-PROFILE-ADAPTIVE-HERO-V1`：先读取对应生产台账、需求和美术 Skill 路由，再实现按常玩游戏变化的 Profile Hero，保持本地未发布策略。

## 本轮方向进度（距离最终目标）

| 方向 | 本地实现 | 最终闭环 |
| --- | ---: | ---: |
| 美术资产 | 93.9% | 约 75.0% |
| 商城/经济 | 约 88% | 约 67% |
| 界面与动效 | 约 86% | 约 63% |
| 游戏与局内 | 约 82% | 约 60% |
| 社交 | 约 79% | 约 57% |
| 技术/数据/跨平台 | 约 76% | 约 51% |

> 百分比是当前 242 项需求台账的治理快照与方向估算；真实设备、生产 Supabase 和发布证据仍单独保持待执行，不把本地机器测试冒充线上验收。
