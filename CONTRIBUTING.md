# Contributing

This project is an npm CLI scaffold for generating Agent workflow configuration. Contributions must preserve the default safety model: analysis and preview are safe by default, writes are explicit, and generated content must not overwrite user-authored project guidance.

## Required Reading

Before changing code, read:

- [Architecture](docs/architecture.md)
- [Iteration Guide](docs/iteration-guide.md)
- [Testing](docs/testing.md)
- [Release](docs/release.md)
- [Workflow Scaffold Evolution Plan](docs/workflow-scaffold-evolution-plan.md)
- [Changelog](CHANGELOG.md)

## Core Rules

- Do not modify target project business code. This CLI only generates Agent workflow configuration.
- Do not write to user-global skill, agent, MCP, or tool directories by default.
- Do not download external role or skill libraries by default.
- Keep `init` and `generate` as preview-only unless `--write` is passed.
- Use managed blocks for generated text files.
- Use structured JSON merge for JSON config files.
- Preserve user-authored content outside managed blocks.
- Add or update tests for analyzer, generator, CLI, MCP, writer, or doctor behavior changes.
- Update docs and `CHANGELOG.md` for every releasable change.

## Change Types

Analyzer changes:
- Update `ProjectProfile` types first.
- Keep detection conservative. Unknown values should remain unknown instead of guessed.
- Add fixtures for new manifest, stack, preset, or skill detection.

Generator changes:
- Update every affected target: Codex, Trae, Claude Code.
- Ensure generated files use managed blocks or JSON merge.
- Update `doctor`, docs, and snapshots or focused tests.

CLI changes:
- Update `printHelp()`.
- Update `docs/cli-zh.md`.
- Add smoke or unit coverage for new commands or options.

MCP changes:
- Update `src/mcp/server.ts`.
- Keep schemas explicit.
- Update MCP version with package version.
- Document new tools in `docs/cli-zh.md` and `docs/architecture.md`.

Release changes:
- Bump `package.json`.
- Bump `package-lock.json`.
- Bump `src/mcp/server.ts`.
- Add a new `CHANGELOG.md` entry.

## Local Validation

Run before handoff or release:

```bash
npm run build
node --test dist/tests/*.test.js
npm run pack:dry
```

For CLI smoke testing:

```bash
node dist/cli.js analyze
node dist/cli.js skills recommend
node dist/cli.js init --target codex
node dist/cli.js doctor --target codex
```

`doctor` may fail before `init --write`; that is expected when generated files are missing.

## Version Discipline

Every releasable change gets a new version entry. Do not append new changes to older entries. Early versions use patch increments, for example `0.0.4` to `0.0.5`.

## Pull Request Checklist

Use [.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md). A PR is not ready until version, docs, tests, and package dry-run requirements are handled or explicitly marked not applicable.
