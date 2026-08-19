# 浏览器连接器恢复证据

当前进程连接失败原因：连接器解析到 `C:\Program Files\nodejs\node.exe` v20.20.2，低于要求的 v22.22.0。

持久修复已存在：用户级 `NODE_REPL_NODE_PATH` 指向：

`C:\Users\wangxr\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`

该文件实测为 v24.14.0。当前 Codex 进程无法热刷新用户环境，因此必须重启 Codex 后再连接。按 Browser Skill 约束，本轮没有用另一套浏览器自动化冒充 in-app/Chrome 证据。

状态：`BLOCKED_RESTART_REQUIRED`。
