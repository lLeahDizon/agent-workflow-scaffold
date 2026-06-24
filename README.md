# Agent Workflow Scaffold

`@tungee/agent-workflow-scaffold` 是一个独立 npm CLI 脚手架，用于在任意项目根目录生成 Agent 工作流配置。当前支持 Codex、Trae、Claude Code 三类目标环境。

相关文档：

- 中文 CLI 操作手册：[docs/cli-zh.md](docs/cli-zh.md)
- 长期维护方案：[docs/workflow-scaffold-evolution-plan.md](docs/workflow-scaffold-evolution-plan.md)
- 团队贡献规范：[CONTRIBUTING.md](CONTRIBUTING.md)
- 版本变更记录：[CHANGELOG.md](CHANGELOG.md)

## 快速开始

推荐在目标项目根目录直接执行：

```bash
npx @tungee/agent-workflow-scaffold setup
```

默认只预览项目画像、推荐 skill 和将生成或更新的文件，不会写入磁盘。确认无误后再执行：

```bash
npx @tungee/agent-workflow-scaffold setup --write
```

需要中文问答式流程时：

```bash
npx @tungee/agent-workflow-scaffold setup --interactive
```

## 安装方式

推荐优先使用 `npx @tungee/agent-workflow-scaffold`，这样不会给目标项目增加依赖。

安装到当前项目开发依赖：

```bash
npm i -D @tungee/agent-workflow-scaffold
npx agent-workflow setup
```

个人电脑全局安装：

```bash
npm i -g @tungee/agent-workflow-scaffold
agent-workflow setup
```

如果当前环境未默认配置内部 npm registry，可显式指定：

```bash
npm i -g @tungee/agent-workflow-scaffold --registry=https://npm.tangees.com/
```

## 安全策略

CLI 默认是预览模式。`setup`、`init`、`generate` 不传 `--write` 时不会修改目标项目文件。

写入时遵循以下规则：

- 文本文件通过 `agent-workflow-scaffold` managed block 更新，避免覆盖用户手写内容。
- JSON 文件使用结构化合并。
- 生成路径必须位于目标项目根目录内。
- 不写入 `.claude/settings.json.permissions`，避免覆盖用户已有 Claude Code 权限配置。
- 不默认修改用户全局 skill、agent、MCP 配置。

## 常用命令

```bash
agent-workflow analyze
agent-workflow setup
agent-workflow setup --interactive
agent-workflow init --target all
agent-workflow generate --target codex
agent-workflow diff --target all
agent-workflow doctor --target all
agent-workflow mcp --target codex
agent-workflow mcp serve
agent-workflow skills analyze
agent-workflow skills recommend
```

命令说明：

- `analyze`：只分析项目画像，不写文件。
- `setup`：串行执行项目分析、skill 推荐、生成文件预览或写入，以及写入后的 `doctor` 检查。
- `init`：根据当前项目画像生成推荐配置。
- `generate`：与 `init` 行为接近，适合脚本中表达生成动作。
- `diff`：查看当前文件与将生成内容的差异摘要。
- `doctor`：检查 Agent 工作流配置是否完整。
- `mcp`：输出目标环境 MCP 配置片段。
- `mcp serve`：启动本地 MCP stdio server。
- `skills analyze`：扫描本地或全局 `SKILL.md`。
- `skills recommend`：根据项目画像输出推荐 skill。

## 目标环境

使用 `--target` 指定生成范围：

```text
codex       生成 Codex 配置
trae        生成 Trae 配置
claude-code 生成 Claude Code 配置
all         同时生成三类配置，默认值
```

## 中文问答式流程

```bash
agent-workflow setup --interactive
agent-workflow init --interactive
```

向导会询问：

- 目标项目目录
- 目标环境
- 项目类型
- Agent 角色来源
- agency-agents 本地路径、角色 id、division
- 本地 skill 扫描路径
- 是否写入生成结果

只有显式传入 `--interactive` 才会进入问答流程，普通命令保持非交互行为，方便脚本和 CI 使用。

## Subagents

默认使用 `builtin` 内置角色，不依赖外部仓库：

```text
workflow-orchestrator
code-reviewer
technical-writer
frontend-implementer   仅前端/H5/Umi/React 项目
backend-implementer    仅 Python/后端项目
```

落地方式：

- Claude Code：生成项目级 `.claude/agents/*.md`。
- Codex：生成 `.codex/skills/<project-id>-workflow/references/subagents.md`。
- Trae：生成 `.trae/agents/*.md`，并保留 `.trae/skills/<project-id>-workflow/references/subagents.md` 作为说明和 fallback。

也可以接入本地 `agency-agents` 仓库：

```bash
agent-workflow init \
  --agent-provider agency-agents \
  --agency-agents-path ../agency-agents \
  --agent-roles frontend-developer,code-reviewer \
  --target claude-code
```

在 `setup --interactive` 或 `init --interactive` 中，如果选择 `agency-agents` 或 `hybrid` 但路径留空，CLI 会继续询问处理方式：改用 `builtin`、输入已有本地路径，或明确授权 clone 到：

```text
~/.cache/agent-workflow-scaffold/agency-agents
```

非交互命令仍要求显式提供 `--agency-agents-path`。

## Skills

CLI 会扫描本地/global `SKILL.md` 元信息，并把推荐结果写入项目本地 workflow skill 的 `references/skills.md`。

```bash
agent-workflow skills analyze
agent-workflow skills recommend --root /path/to/project
agent-workflow init --target codex --skill-paths ~/.codex/skills,~/.agents/skills
```

脚手架只生成项目 workflow skill，不会默认复制、安装或修改用户全局 skill。

## Workflow Playbook

脚手架会在项目本地 workflow skill 中生成中文 AI Coding 协作手册：

```text
references/workflow-playbook.md
```

内容包括任务定义、计划分析、小步实现、自检验证、人工 Review、Git/PR 交接、worktree 隔离和复盘沉淀流程。

## 内部发布

当前包配置为发布到内部 npm registry：

```text
https://npm.tangees.com/
```

项目 `.npmrc` 和 `publishConfig` 只保存 registry 地址，不保存 token。token 保留在用户级 `~/.npmrc`。

发布前检查：

```bash
npm whoami --registry=https://npm.tangees.com/
npm run check
npm run pack:dry
```

发布：

```bash
npm publish
```

`prepack` 会在打包前执行 TypeScript 构建，`prepublishOnly` 会在发布前执行构建、测试和打包 dry-run。

## 团队维护

团队迭代和交付请优先阅读：

- [CONTRIBUTING.md](CONTRIBUTING.md)
- [docs/architecture.md](docs/architecture.md)
- [docs/iteration-guide.md](docs/iteration-guide.md)
- [docs/release.md](docs/release.md)
- [docs/testing.md](docs/testing.md)
- [docs/adr/0001-core-design-decisions.md](docs/adr/0001-core-design-decisions.md)
