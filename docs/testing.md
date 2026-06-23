# Testing Guide

The test strategy is focused on generated behavior, write safety, and CLI usability.

## Required Test Commands

```bash
npm run build
node --test dist/tests/*.test.js
npm run pack:dry
```

## Test Layers

Unit tests:
- Analyzer detection.
- Skill scanning and recommendations.
- Managed block merge.
- JSON merge.
- Target generator file lists and generated content.

CLI smoke tests:
- `analyze`
- `skills analyze`
- `skills recommend`
- `init` preview.
- `diff`.
- `doctor`.

Package tests:
- `npm pack --dry-run`.
- Confirm `dist/skills` and other required build outputs are included.

## When To Add Tests

Add analyzer tests when:
- A new manifest type is detected.
- Project type detection changes.
- Project profile fields are added.
- Skill lifecycle or recommendation logic changes.

Add generator tests when:
- A generated file is added or removed.
- Managed block content changes materially.
- Target-specific behavior changes.

Add writer tests when:
- Managed block markers change.
- JSON merge behavior changes.
- Write safety behavior changes.

Add MCP or CLI tests/smoke checks when:
- A new command is added.
- A command option changes.
- MCP schemas or tool outputs change.

## Fixtures

Prefer temporary directories created during tests over committed fixture projects unless a fixture becomes large or shared across many tests.

For temporary projects, create only the files needed to trigger behavior:

```ts
await writeFile(path.join(dir, "package.json"), JSON.stringify({
  name: "frontend-app",
  dependencies: { react: "18.3.1", umi: "4.6.0" }
}), "utf8");
```

## Safety Assertions

Tests should verify:

- `init` without `--write` does not write files.
- Generated text uses managed blocks.
- JSON config preserves unrelated keys.
- Skill scanning is read-only.
- External providers are opt-in.

## Known Gaps

The current suite does not yet fully cover:

- End-to-end CLI writes in temporary projects.
- `doctor` managed block validation.
- MCP server process health checks.
- CRM preset snapshots.
- Skill lifecycle stale/deprecated evaluation.

Track these gaps in `docs/workflow-scaffold-evolution-plan.md`.
