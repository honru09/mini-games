# Active Task State

每个正式任务建立一个目录：

```text
requirements/active/<task>/
├── requirement.md
├── plan.json
├── ownership.json
├── execution.json
├── contract.md              # 跨模块任务必需
├── acceptance.md
└── evidence/
```

模板与字段约束见同目录的 `TEMPLATE_*` 文件。`execution.json` 状态必须使用
`DRAFT`、`REQUIREMENT_FROZEN`、`PLANNED`、`IMPLEMENTING`、`VERIFYING`、`ACCEPTED`、`CHANGE_REQUEST`。

没有证据的完成项只能标记为 `implemented`；真实设备、真实 Supabase、真实网络整形未执行时必须保留 `NOT_EXECUTED`。
