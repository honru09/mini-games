# Playroom 素材库

这是一个轻量、可审计的素材索引，不是第二份资源副本。

- 母图继续保存在 `art-source/`。
- 运行时资源继续保存在 `public/assets/`。
- `catalog.json` 记录分类、来源、许可、作者、哈希、尺寸、Prompt/模型、低清预览、状态与未来对象键。
- 集合的 `catalogSha256` 永远校验 `catalogPath`；不得用其他文件代替目录/来源说明。存在独立许可证文件时，使用 `licensePath` 与 `licenseSha256` 单独登记和校验。项目自有且没有独立许可证文件的集合，这两个字段必须同时为 `null`。
- `remoteObjectKey` 在对象存储提供商、桶、生命周期和凭证没有冻结前必须为 `null`，状态保持 `local-only`。
- 第三方素材只有在来源、作者和许可均可核验时才能进入生产目录；不明许可素材只允许记录参考 URL，禁止复制、上传或再分发。

## 校验

```powershell
node scripts/asset-library-audit.js
```

审计器不引入第三方 JSON Schema 依赖；它直接读取 `schema.json`，使用仓库内置的 JSON Schema 子集验证器执行本仓库声明的字段类型、必填项、`const`、枚举、正则、长度/最小值、数组唯一性与 `additionalProperties` 策略。Schema 如新增验证关键字，必须同步扩展该验证器或引入完整实现，不能只让 Schema 文件“可解析”。

业务校验另覆盖路径越界、缺失文件、重复 ID、来源目录与许可证的独立 SHA-256、图片尺寸、Prompt/模型、许可、远端对象键，以及六款大厅封面与生产 Manifest 的交叉一致性。

## 未来迁移到线上对象存储

选择 R2/S3/Supabase Storage 后，先冻结区域、桶名、访问策略、CORS、生命周期、备份和成本预算，再把 `storage.mode` 改为 `hybrid` 并逐项填写 `remoteObjectKey`。不得把 service-role、S3 secret 或 Render key 写入本目录。
