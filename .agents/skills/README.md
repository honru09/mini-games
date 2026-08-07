# Playroom Skills Library

这些 Skill 是项目内的规范包。它们把仓库经验、边界、检查和证据要求固定下来；未来 Agent 根据任务类型读取对应 `SKILL.md`。

| Skill | 用途 | 默认阶段 |
|---|---|---|
| `playroom-recon` | 只读仓库侦察、热文件与冲突分析 | 所有大型任务前 |
| `playroom-plan` | 需求冻结、范围、契约、计划和所有权 | 修改前 |
| `playroom-gameplay` | 逻辑状态、表现、序列化、观战和减动效边界 | 游戏任务 |
| `playroom-multiplayer` | Authority、协议、幂等、重连、安全和兼容 | 联机任务 |
| `playroom-ui-motion` | Motion Token、密度预算、平台/玩家层和移动端 | UI/动效任务 |
| `playroom-visual-qa` | 浏览器侦察、截图、响应式、Console 和视觉证据 | UI 发布前 |
| `playroom-security` | 账号、Origin、权限、频控、重放和敏感信息 | 安全边界任务 |
| `playroom-assets` | manifest、尺寸、fallback、许可、懒加载和性能 | 资源任务 |
| `playroom-release` | 全部 Quality Gate、证据清单、发布和回滚 | 提交/部署前 |
| `playroom-doc-sync` | 代码事实驱动 README、白皮书、需求和状态同步 | 验收后 |

第三方研究清单见 `requirements/skills-registry.json`；当前只记录来源，不自动执行来源仓库代码。
