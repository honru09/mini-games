# UI、i18n、资产与缓存合同

## i18n

- 词典就绪后必须触发一次可重放的动态 UI 刷新；刷新只根据稳定 key 更新，不把已翻译文本当作源值。
- `setButtonIcon`、社交空态、商城状态与运行时弹层不得把 `t(key)` 的裸 key 永久写入 DOM。
- 用户昵称、签名、房间名继续使用 `data-i18n-raw`。

## 商城权威

- 前端只展示服务端商品目录/档案中的价格、owned、equipped 和余额。
- 购买仍通过现有 `purchase` 请求；加载、成功、失败与余额不足仅改变 UI 状态，不预测扣款成功。
- 试穿不购买、不修改服务端 Profile；装备仍通过白名单 Profile 合同。

## 大厅封面

- Asset ID：`G-07-COVER`、`G-08-COVER`、`G-09-COVER`、`G-06-COVER`。
- 运行时：640×360 WebP + `_320.webp`，`loading=lazy`，装饰图 `alt` 为空或由游戏可读 HTML 提供名称。
- 失败行为：隐藏失败图像并恢复现有 Emoji；不影响卡片点击、AI、联机或加载其他游戏。

## 素材库

- 仓库只保存索引、许可证、来源 URL、哈希、尺寸、低清预览和对象键；母图不复制进 `public/`。
- 外部对象存储提供商和凭证未冻结前，`remoteObjectKey` 允许为空，状态必须是 `local-only`。

## 缓存瘦身

- 只删除 `.gitignore` 覆盖的 `.codex-tmp` 可再生成渲染目录。
- `deliverables/`、`art-source/`、仓库追踪文件与最终验收报告禁止删除。
- 删除前后记录绝对路径、文件数和字节数；任何不确定文件先保留。
