# Release Guide

This guide describes how to prepare a publishable npm package version.

## Version Sync

For every release, update:

- `package.json`
- `package-lock.json`
- `src/mcp/server.ts`
- `CHANGELOG.md`

The MCP server version must match the npm package version.

## Registry

The package is configured for the internal npm registry:

```text
https://npm.tangees.com/
```

Project-level `.npmrc` only stores registry routing:

```text
@tungee:registry=https://npm.tangees.com/
registry=https://npm.tangees.com/
```

Do not commit npm auth tokens. Keep tokens in the user-level `~/.npmrc` created
by `npm login`.

## Pre-Release Checklist

- [ ] Confirm the target version.
- [ ] Confirm `CHANGELOG.md` has a new version entry.
- [ ] Confirm docs reflect implemented behavior.
- [ ] Confirm generated file lists are current.
- [ ] Confirm new public APIs are exported from `src/index.ts` if needed.
- [ ] Run build.
- [ ] Run tests.
- [ ] Run package dry-run.
- [ ] Confirm package contents include required `dist/` folders.
- [ ] Confirm no `.tgz` artifact remains after dry-run.

## Required Commands

```bash
npm whoami --registry=https://npm.tangees.com/
npm run build
node --test dist/tests/*.test.js
npm run pack:dry
ls -1 *.tgz 2>/dev/null || true
```

`npm pack --dry-run` should include:

- `dist/analyzers`
- `dist/generators`
- `dist/mcp`
- `dist/skills`
- `dist/templates`
- `dist/utils`
- `dist/writer`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `CONTRIBUTING.md`
- `README.md`
- `docs`
- `CHANGELOG.md`
- `package.json`

## CLI Smoke Tests

Run against the scaffold project itself:

```bash
node dist/cli.js analyze
node dist/cli.js skills analyze --skill-paths /tmp/no-agent-skills
node dist/cli.js skills recommend --skill-paths /tmp/no-agent-skills
node dist/cli.js init --target codex
node dist/cli.js diff --target codex
```

Run against a temporary empty project:

```bash
mkdir -p /tmp/agent-workflow-empty
node dist/cli.js analyze --root /tmp/agent-workflow-empty
node dist/cli.js init --root /tmp/agent-workflow-empty --target codex
```

## Publishing

This repository currently has `"license": "UNLICENSED"`. Publish only to the
internal registry configured in `publishConfig.registry`.

When publishing is approved:

```bash
npm publish
```

`prepublishOnly` runs `npm run check && npm run pack:dry` before publish.
`prepack` runs `npm run build` before package creation.

## Post-Release Notes

Record:

- Published version.
- Publish date.
- Registry.
- Validation command results.
- Known limitations.
