# Agent Workflow Scaffold

Generate Agent workflow configuration for Codex, Trae, and Claude Code.

中文 CLI 操作手册见 [docs/cli-zh.md](docs/cli-zh.md).
长期维护方案见 [docs/workflow-scaffold-evolution-plan.md](docs/workflow-scaffold-evolution-plan.md).
团队贡献规范见 [CONTRIBUTING.md](CONTRIBUTING.md).
版本变更记录见 [CHANGELOG.md](CHANGELOG.md).

```bash
npx @tungee/agent-workflow-scaffold setup
npx @tungee/agent-workflow-scaffold setup --interactive
npx @tungee/agent-workflow-scaffold init --target all
npx @tungee/agent-workflow-scaffold init --interactive
npx @tungee/agent-workflow-scaffold init --target codex --write
npx agent-workflow analyze
npx agent-workflow doctor --target all
npx agent-workflow skills recommend
```

The CLI is safe by default. `setup`, `init`, and `generate` show a preview unless
`--write` is passed.

## Commands

- `agent-workflow analyze`: print the detected project profile.
- `agent-workflow setup`: run analyze, skill recommendations, preview/write, and doctor in one flow.
- `agent-workflow init`: analyze and generate recommended artifacts.
- `agent-workflow setup --interactive`: run the Chinese guided setup flow.
- `agent-workflow init --interactive`: run the Chinese guided init flow.
- `agent-workflow generate`: same generation flow with explicit options.
- `agent-workflow diff`: compare current files with generated output.
- `agent-workflow doctor`: validate generated config presence.
- `agent-workflow mcp`: print MCP configuration snippets.
- `agent-workflow mcp serve`: start the local MCP stdio server.
- `agent-workflow skills analyze`: scan local/global `SKILL.md` files.
- `agent-workflow skills recommend`: print project-specific skill recommendations.

## Setup Flow

Version `0.0.9` adds a one-command setup flow:

```bash
agent-workflow setup
agent-workflow setup --target all --write
```

It runs project analysis, skill recommendations, generated artifact preview or
write, and `doctor` verification. Version `0.0.8` also keeps Claude Code
permission arrays user-owned: the scaffold no longer writes
`.claude/settings.json.permissions`.

## Chinese Guided Flow

Version `0.0.7` added an explicit Chinese guided init flow. Version `0.0.9`
also supports the same guide in setup:

```bash
agent-workflow setup --interactive
agent-workflow init --interactive
```

The guide asks for the target project root, target environment, project type,
Agent role provider, optional skill scan paths, and final write confirmation.
It only runs when `--interactive` is passed, so normal `init` stays
non-interactive and safe for scripts.

## Skills

Version `0.0.4` adds safe local/global skill discovery. The CLI can scan
existing user skills, mark matching recommendations as installed, and generate
`references/skills.md` inside project-local workflow skills.

The scaffold only generates the project workflow skill. It does not copy,
install, or mutate user-global skills by default.

```bash
agent-workflow skills analyze
agent-workflow skills recommend --root /path/to/project
agent-workflow init --target codex --skill-paths ~/.codex/skills,~/.agents/skills
```

## Workflow Playbook

Version `0.0.6` adds a Chinese AI Coding workflow playbook generated as
`references/workflow-playbook.md` inside project-local workflow skills. It
covers task definition, plan analysis, small-step implementation, verification,
human review, Git/PR handoff, worktree isolation, and retrospective
standardization.

## Subagents

Version `0.0.3` introduced a basic Subagents workflow. Claude Code receives
project-level `.claude/agents/*.md` definitions. Codex and Trae receive
`references/subagents.md` role guidance inside generated skills.

`agency-agents` can be used as an optional local Subagents provider:

```bash
agent-workflow init \
  --agent-provider agency-agents \
  --agency-agents-path ../agency-agents \
  --agent-roles frontend-developer,code-reviewer \
  --target claude-code
```

## Targets

Use `--target codex`, `--target trae`, `--target claude-code`, or
`--target all`.

## Internal Publish

This package is configured for the internal registry `https://npm.tangees.com/`.
Project `.npmrc` and `publishConfig` do not contain credentials; keep auth
tokens in the user-level `~/.npmrc`.

```bash
npm whoami --registry=https://npm.tangees.com/
npm run check
npm run pack:dry
npm publish
```

`prepack` runs the TypeScript build before packing, and `prepublishOnly` runs
the build, tests, and package dry-run before publish.

## Team Handoff

For team iteration and maintenance, use these documents:

- [Contributing](CONTRIBUTING.md)
- [Architecture](docs/architecture.md)
- [Iteration Guide](docs/iteration-guide.md)
- [Release Guide](docs/release.md)
- [Testing Guide](docs/testing.md)
- [Core Design Decisions](docs/adr/0001-core-design-decisions.md)
