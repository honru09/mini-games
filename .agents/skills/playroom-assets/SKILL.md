# playroom-assets

## 必须登记

每个资源必须有稳定 asset ID、manifest 路径、尺寸/格式、来源与许可、fallback、懒加载策略和性能预算。

## 运行时规则

资源加载失败必须保留可用 fallback；未知 cosmetic 回退默认值；大图不能在未进入游戏时加载；动态背景 offscreen 暂停。

## 验收

运行 `qa/game-cosmetic-profile.js`、DOM smoke 和资源 manifest 检查，并记录图片尺寸、文件存在性和 feature flag 回退。
