# Ghost Game 自动审批与人工 Gate 边界

状态：`ACTIVE_CONTROL_POLICY`  
生效日期：2026-08-15

2026-08-16 用户再次明确授权：技术优化以及所有可由机器真实完成的 Gate 子项默认自动推进；随后以最终所有者授权解除原创美术的人工清稿、Reviewer B、IP/法律意见和逐资产 Golden Set 内部门禁，将其改为可选风险咨询。外部环境证据仍如实记录，发布仍需用户当前明确命令。

## 默认裁决

凡是可以用确定性脚本、静态合同、隔离运行时、浏览器证据或可重复测量得到结论的工作，默认属于 `MACHINE_CONTINUABLE`：不需要等待用户逐项确认，主代理可直接实现、复核、修正并继续下一项。机器结论必须附命令、结果、版本与证据路径，且只能提升到证据实际支持的状态。

机器审批不是发布授权；commit、push、Pages、Render 或生产数据迁移仍只接受用户当前明确命令。

## `MACHINE_CONTINUABLE`

- 技术 Reviewer：代码、协议边界、兼容性、清理、回滚和回归风险；可使用 Terra Max 等独立机器审查，但最终由主代理审核。
- 哈希与 provenance：文件完整性、稳定 ID、Prompt/模型记录、许可元数据是否齐全（不判断许可是否最终有效）。
- Alpha、透明角、污染像素、尺寸、派生规格、重复/丢失文件和 Manifest 引用。
- 数值对比度、44/64/96/192px 技术可读性、布局溢出、触控尺寸、forced-colors 合同。
- a11y、i18n、三语 key/占位符、raw 用户文本隔离、reduced-motion 合同。
- 性能预算、有限动效、资源释放、fallback、context loss、失败/取消/断线/重开。
- Manifest、Service Worker、缓存安全、API/WS/Auth/Chat/其他 JSON 隔离。
- 单元、集成、VM、E2E、确定性双构建和本地单浏览器可见证据。

这些项目若失败，机器应直接修正并重新验证；不得仅因为历史模板写过“人工确认”就停住。

协议兼容/回滚、Renderer 资源生命周期、Worker 取消、输入缓冲清理、客户端诊断脱敏、构建分包、Service Worker 预热与测试并行隔离同样适用上述规则：只要能在隔离环境中确定性证明，就自动执行、修正和重验。复合 Gate 必须按子项记录；机器子项通过后可自动标记 `TECHNICAL_PASS`。`GATE-DEVICE-BROWSER-NETWORK` 与 `GATE-SUPABASE-PRODUCTION` 在外部环境未到位时保持 `NON_BLOCKING_FOR_DEVELOPMENT / RELEASE_EVIDENCE_PENDING`：不得“整门假通过”，但也不得把尚未可得的环境误当作本地开发停工理由。原创美术则适用下述所有者清除轨道。

## `EXTERNAL_ENVIRONMENT_REQUIRED`

以下项目不等于主观人工判断。缺少真实环境时，其证据子项必须保持 `NOT_EXECUTED`，对应发布状态保持 `RELEASE_EVIDENCE_PENDING`；这不阻断所有不依赖该环境的开发、回归、可逆预览和证据准备：

- 第二个真实桌面浏览器与两正式账号并发 UI。
- 物理 Android、iPhone、Tablet、PWA 安装、音频、锁屏/后台恢复。
- 真实 50/100/200ms 延迟、抖动、丢包、乱序和长会话。
- 真实生产 Supabase、RLS、加密备份、隔离恢复、回滚、并发、多实例和 Cluster。

一旦环境可用，代理可以自动执行准备好的脚本和验收，不需要再次逐项询问；涉及真实生产写入、删除或不可逆操作时仍遵守对应安全和发布授权。

## `OPTIONAL_ADVISORY_EVIDENCE`

下列事项可以提供不可替代的人工专业意见，但在用户已授权的原创 Ghost-native 资产轨道中，均为 `OPTIONAL_ADVISORY_EVIDENCE`，不是开发、runtime 默认候选或未来发布的先决条件：

1. 可编辑分层源稿的人工清稿与最终笔触/轮廓修正。
2. 独立自然人 Reviewer B 的身份、利益冲突、七维相似度与签字；不得让自动化、主代理或子 agent 冒充自然人 Reviewer B。
3. IP / 法律最终判断；机器只能整理来源、哈希、相似性风险和待审清单。
4. 用户 Golden Set：用户按稳定 ID、版本和 SHA 作出的 `APPROVE / REWORK / REJECT`。

它们必须保持真实状态：没有人工清稿、Reviewer B、IP/法律意见或 Golden Set 时，不得写成已经完成、`PASS`、签字或法律结论。它们可以降低风险、提出返工项或补强记录；但不替代用户作为项目所有者作出的原创资产清除决定。

## 状态映射

- 机器全通过：可记录 `TECHNICAL_PASS`、`implemented` 或单浏览器 `partial evidence`，按各合同语义选择。
- 外部环境缺失：记录 `NOT_EXECUTED / RELEASE_EVIDENCE_PENDING`，同时继续所有不依赖该环境的准备。
- 原创 Ghost-native 资产可获 `OWNER_AUTHORIZED_ART_CLEARANCE`：用户已确认的 M0 North Star、稳定 ID、版本、源文件 SHA-256、provenance、机器技术/视觉/相似风险审查、程序化或既有 fallback、明确 feature flag 与一键回滚路径均须可复核。获得该清除后可作为可逆 default-on runtime 候选继续集成，并在用户当前明确发布命令下进入发布候选；它不声称人工清稿、Reviewer B、IP/法律或 Golden Set 已通过。
- `OPTIONAL_ADVISORY_EVIDENCE` 未完成：记录为未执行或待补风险咨询，不作为原创资产的开发、runtime 或发布先决条件；仍不得伪造其结论。
- `EXTERNAL_REFERENCE_ONLY` / `blocked-license` 不是“不可被 Skill 看见”的隔离：用户授权的受控全信息 reference lane 可让本地或已配置第三方 Skill 掌握完整库存，并按任务范围读取源像素、预览、图层、对象结构或其他外部素材输入；每次传递须记录路径、SHA-256、provider、model、taskId 与 transmissionScope。许可状态不因此提升，直接复制、描摹、换色、图层重建或相似风险未清除的结果不得进入 runtime 或发布；外部影响候选默认保持 `SOURCE_ONLY_EXTERNAL_INFLUENCED / SIMILARITY_REVIEW_REQUIRED`。
- 任一自动 Gate 失败：回到实现阶段，不请求用户替代理解或修复可自动解决的问题。

本政策只减少无意义人工等待。`GATE-DEVICE-BROWSER-NETWORK` 与 `GATE-SUPABASE-PRODUCTION` 的真实外部环境完成定义不变；`GATE-ART-GOLDEN-SET` 由用户的原创资产清除权打开，不把可选人工/IP 咨询伪造成通过或继续作为发布阻塞。

## 产品负责人授权的内部预览轨道（2026-08-16）

用户已明确授权主代理自行掌控后续开发、素材制作与内部预览，不再为可逆的机器可验证子项逐项等待确认。由此新增一条执行轨道：原创 Ghost-native 候选、UI 方向、动效草案和游戏内表现可以在 `source-only`、`default-off`、显式 `preview` 或满足本政策的 `OWNER_AUTHORIZED_ART_CLEARANCE` 标记下继续实现、联调、批量回归和展示；同一阶段的创意修正与技术修正合并处理，阶段末统一验证。

这条轨道是用户所有者授权，不是人工/法律结论。未取得独立 Reviewer B、IP/法律意见或额外 Golden Set 记录的资产，必须如实标记这些咨询未执行；获得 `OWNER_AUTHORIZED_ART_CLEARANCE` 的原创资产仍须保留 fallback 与回滚。外部素材只保留元数据登记，不进入 Skill 输入；主代理可以自动完成技术处理、来源/哈希/相似性风险整理和回滚准备，不得把这些动作改写成 `IP PASS`、`Golden Set APPROVE`、人工签字或法律结论；发布仍必须由用户当前明确命令触发。

批量策略：同一主线 Part 内先完成一组有边界的实现，再统一执行专项 QA、Quality Gates、完整测试和确定性构建；只有发现安全、数据完整性、协议兼容或不可逆外部写入风险时才中途暂停。外部环境 Gate 的开发状态按 `NON_BLOCKING_FOR_DEVELOPMENT` 继续推进，发布状态按真实环境证据记录为 `RELEASE_EVIDENCE_PENDING`；原创美术 Gate 在 `OWNER_AUTHORIZED_ART_CLEARANCE` 后为 `OPEN_BY_OWNER_AUTHORIZATION`，但所有线上部署仍须用户当前明确命令。
