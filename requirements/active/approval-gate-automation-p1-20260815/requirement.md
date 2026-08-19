# Approval Gate Automation P1

状态：`LOCAL_GOVERNANCE_IMPLEMENTED`

## Goal

把可确定性验证的技术项目从“等待人工确认”中释放出来，只保留不可替代的自然人、法律、审美和真实外部环境边界。

## IN

- 统一 `MACHINE_CONTINUABLE / EXTERNAL_ENVIRONMENT_REQUIRED / OPTIONAL_ADVISORY_EVIDENCE`，并把共享 Gate 的开发状态与发布证据状态分离。
- 控制面 JSON 固化默认继续规则和发布授权隔离。
- QA 防止后续把机器 Reviewer 冒充自然人 Reviewer B，或把外部环境缺失写成人工审美阻塞；原创 Ghost-native 候选可在 M0 North Star、SHA/provenance、机器风险审查与 fallback/回滚合同内获得所有者清除。

## OUT

- 不解除设备/Supabase 的真实发布证据要求；原创美术 Gate 仅以 `OWNER_AUTHORIZED_ART_CLEARANCE` 打开，且每次发布仍需当前用户明确命令。
- 不审批任何具体候选美术，不修改 runtime、Manifest、游戏、协议、数据或线上环境。
- 不为外部 `blocked-license` / `EXTERNAL_REFERENCE_ONLY` 素材创建任何开发例外。
