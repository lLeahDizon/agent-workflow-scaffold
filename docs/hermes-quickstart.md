# Hermes 快速验收

## 边界

- Hermes 在本脚手架中是电脑级外部能力/运行时集成，不是 `codex`、`trae`、`claude-code` 同级 target。
- 脚手架不会安装、启动、停止、登录或检查 Hermes runtime。
- 脚手架不会写入或检查 `~/.hermes/*`。
- 脚手架不会创建 concrete Hermes agents、roles、sessions 或 Kanban workers。
- 用户启动 Hermes 后，基于 workspace `HERMES.md` 和项目 `.hermes.md` 自行协调项目与动态 agents。

## 最短路径

```bash
agent-workflow hermes register --root /path/to/project --workspace /path/to/HermesWorkspace
agent-workflow hermes team init --workspace /path/to/HermesWorkspace
agent-workflow hermes list --workspace /path/to/HermesWorkspace
agent-workflow hermes doctor --root /path/to/project --workspace /path/to/HermesWorkspace
agent-workflow hermes team doctor --workspace /path/to/HermesWorkspace
```

## 生成文件

```text
<project>/.hermes.md
<project>/.agent-workflow/manifest.json
<workspace>/HERMES.md
<workspace>/.agent-workflow/hermes-team/rules.md
<workspace>/.agent-workflow/hermes-team/delegation-playbook.md
<workspace>/.agent-workflow/hermes-team/role-sources.md
<workspace>/.agent-workflow/hermes-team/manifest.json
```

## 发布包 Smoke

```bash
SCAFFOLD_VERSION=0.0.23 npm run smoke:published
NPM_REGISTRY=https://npm.tangees.com/ SCAFFOLD_VERSION=latest npm run smoke:published
```

`smoke:published` 验收的是已发布 npm 包，不纳入 `npm run check`。
