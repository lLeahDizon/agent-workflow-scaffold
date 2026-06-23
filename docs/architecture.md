# Architecture

`@tungee/agent-workflow-scaffold` is a TypeScript npm CLI and reusable library. It analyzes a target project, builds a `ProjectProfile`, generates Agent workflow configuration for selected targets, and writes only explicit generated artifacts.

## Runtime Flow

```text
CLI args
  -> analyzeProject()
  -> ProjectProfile
  -> generateForTargets()
  -> GeneratedFile[]
  -> diffGeneratedFiles() or writeGeneratedFiles()
```

MCP uses the same core APIs:

```text
MCP tool input
  -> optionsFromInput()
  -> analyzeProject() / generateProject() / doctorProject()
```

## Main Modules

`src/types.ts`
: Shared public model. Update this before changing analyzer, generator, MCP, or writer contracts.

`src/analyzers/projectAnalyzer.ts`
: Reads target project metadata and produces `ProjectProfile`. Detection must be conservative. Unknown values should stay unknown.

`src/templates/`
: Built-in rules, Subagents, and optional external provider adapters. These modules should not write files.

`src/skills/`
: Local/global skill scanning and project skill recommendations. Scanning must remain read-only and must not install, copy, or mutate user-global skills.

`src/generators/`
: Converts `ProjectProfile` into target-specific `GeneratedFile[]`.

`src/writer/`
: Applies managed block and JSON merge write strategy. This is the only layer that should materialize generated files.

`src/diff.ts`
: Computes file-level create/update/unchanged summaries from generated files.

`src/doctor.ts`
: Validates generated artifact presence and future health checks.

`src/mcp/server.ts`
: Exposes project analysis, generation preview, diff, doctor, skill scan, and skill recommendations over MCP stdio.

`src/cli.ts`
: Thin command dispatcher around core APIs. Keep command behavior mirrored in docs.

## Generated File Model

Each generated file has:

```ts
interface GeneratedFile {
  target: AgentTarget;
  relativePath: string;
  content: string;
  mode: "managed-text" | "structured-json" | "directory";
  marker?: string;
  jsonMerge?: unknown;
}
```

Rules:

- `managed-text` files must contain `agent-workflow-scaffold` managed blocks.
- `structured-json` files must merge objects and preserve unrelated user config.
- `directory` entries only ensure directory existence.

## Targets

Codex:
- `AGENTS.md`
- `.codex/config.toml`
- `.codex/hooks/repo_policy.py`
- `.codex/skills/<project-id>-workflow/**`
- `.codex/mcp.agent-workflow.json`

Trae:
- `.trae/AGENTS.md`
- `.trae/generatedSpecs/`
- `.trae/mcp.json`
- `.trae/skills/<project-id>-workflow/**`

Claude Code:
- `CLAUDE.md`
- `.claude/settings.json`
- `.claude/skills/<project-id>-workflow/**`
- `.claude/agents/*.md`
- `.claude/commands/agent-workflow.md`
- `.mcp.json`

When adding a target, implement generator, doctor expectations, docs, tests, MCP config notes, and CLI examples together.

## Safety Boundaries

- No writes without `--write`.
- No target project business code edits.
- No global user directory writes by default.
- No remote download by default.
- No full-file overwrite of user-authored docs.
- No automatic skill install or prune.

## Public API

The root export exposes:

- `analyzeProject`
- `generateProject`
- `generateForTargets`
- `doctorProject`
- `diffGeneratedFiles`
- `scanLocalSkills`
- `recommendSkills`
- `writeGeneratedFiles`

Keep these APIs stable unless the version entry clearly documents a breaking change.
