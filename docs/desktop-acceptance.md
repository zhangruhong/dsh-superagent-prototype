# Desktop 跨平台验收

本轮优先验证 Windows。macOS/Linux 保留原有 POSIX 执行路径，下面的清单供真机验收；实现存在不等于这些系统已经验收通过。

## 已验证的 Windows 范围

2026-11-15 本机最终回归：68 个测试文件，1,267 项用例，其中 1,244 通过、0 失败、23 项 POSIX 专用测试跳过。类型检查、构建和打包另外验证。

- 盘符和 UNC 绝对路径校验，中文、空格目录中的真实执行。
- `.exe`、`.cmd`、`.bat`、`.ps1` 查找及账号包装器；批处理参数包含空参数、中文、百分号和 shell 元字符。多行及包含双引号的通用批处理参数会明确拒绝；提供方消息和 JSON 使用文件输入保留内容，避免多层 `%*` 转发改变数据。
- GitHub/飞书账号探测、错误状态、包装器递归防护、PowerShell Git credential helper。
- 真正的 DSH PowerShell executor：worker 环境按命令注入，普通 Host 命令保留环境，取消任务终止进程树。
- 临时 Git 仓库：创建 worktree、修改代码、执行断言、提交，原始检出不受影响。
- 本机安装的 Harness Desktop 0.2.2-rc.1 随附 Host：使用独立 `DSH_HOME` 和临时 Web profile 加载构建后的插件，本地状态 API 返回 200。此项不代表 Desktop 图形界面、模型执行或真实账号链路已经完成端到端验收。
- 使用 Desktop 的 Electron/Node 24.21.0 运行构建后的 PowerShell 适配器，并解析到安装包内的 Cordis、shell、sandbox 和 subprocess 依赖，实际执行返回预期的 worker 环境标记。

Windows 跳过的 POSIX 专用测试仍在测试集中保留，主要涉及 Python/tmux 服务脚本、POSIX 可执行脚本、askpass 和文件权限。macOS/Linux 应执行完整测试集验证这些路径。

## macOS/Linux 本地验证

1. 使用独立验收账号和目录，安装 Git、Node.js（符合 `package.json` 的 engines）、pnpm；若验收 GitHub/飞书，再安装对应 CLI 并为机器人单独登录。Desktop 提供的运行时与开发时 Node.js 是两个环境。
2. 检出 `codex/wecom-gitlab-cnb`，在仓库目录运行：

   ```sh
   pnpm install --frozen-lockfile
   pnpm typecheck
   pnpm test
   pnpm build
   ```

3. 新建独立验收 profile，或备份现有 Desktop profile 后按 [部署文档](006-deployment.md) 安装。不要对已有 profile 使用 `--from-default-profile`。安装应使用 Desktop 自带的 `dsh`，避免混用另一套 Host 包。
4. 启用插件，设置本机的绝对 `stateDir` 和 Execution 目录；至少使用一个带空格、中文的路径。关闭再打开 Desktop，确认插件加载、设置保存、数据库锁释放和重新获取都正常。
5. 配置机器人账号包装器（POSIX 脚本须 `chmod +x`），运行 setup。检查 `gh`/`lark-cli` 身份和 Git credential helper 来自机器人账号。普通 Desktop Session 的 `PATH`、Git 配置和账号应保持原样。
6. 执行下表验收。记录系统/芯片架构、Desktop 版本、Git/CLI 版本、分支提交号和失败日志；不要附 token、Secret 或完整认证响应。

| 验收项 | 通过条件 |
| --- | --- |
| 单仓库任务 | 任务创建独立 worktree，修改、测试、提交成功，报告的分支和仓库正确 |
| 递归多仓库 | 在不同深度准备两个仓库，能定位明确命名的仓库；歧义时请求澄清，不在错误仓库执行 |
| 企微任务 | 群中授权用户 `@` 智能机器人能派任务，收到进度与正确的 GitLab MR 链接；未授权用户被拒绝 |
| GitLab 联调 | 自建或托管 GitLab 的 token、克隆、推送、MR 创建/更新可用，链接指向对应实例 |
| 子代理 | 子代理命令使用机器人环境，不能因换成标准 preset 而回落到个人账号 |
| 取消 | 停止长时间命令或任务后，shell、包装器和子进程退出；后续任务仍可运行 |
| 重启恢复 | 活跃任务重启后状态可恢复，无重复消息、重复执行或遗留目录锁 |
| 飞书（启用时） | 长连接可接收，关闭 Source 或退出 Host 后消费者及子进程退出 |

## 仍需真实环境验收

企微消息 → 模型规划 → 实际仓库修改 → 推送 → MR → 群回执需要真实模型、机器人和仓库账号。本轮自动化使用临时仓库和模拟账号 CLI，没有向外部发送消息或创建 MR。

CNB 目前仍是能力接口与配置占位，缺少 live adapter；不能把它计为已可创建变更请求。微信、QQ 渠道也不属于本轮桌面兼容改动。
