# Headroom Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `headroom` as an explicit optional Agent workflow feature with project MCP configuration, managed local install support, doctor checks, documentation, and release metadata.

**Architecture:** `headroom` is a standalone feature flag, not an agent provider, skill, subagent source, or Loop Engineering variant. Generation writes project-level references and MCP server config for Codex and Claude Code only, while local runtime installation is handled by explicit `agent-workflow headroom install` commands in a user cache venv.

**Tech Stack:** TypeScript, Node.js built-ins, existing managed block writer, existing manifest/upgrade/doctor patterns, Node test runner.

## Global Constraints

- Feature flag is `--headroom`; no headroom files are generated unless it is explicitly enabled or already enabled in manifest during upgrade.
- First version does not auto-run `wrap`, `proxy`, dashboard, or `headroom mcp install`.
- Codex and Claude Code get actual `headroom` MCP server config; Trae gets reference documentation only.
- MCP server name is fixed as `headroom`.
- Default MCP command is `headroom` with args `["mcp", "serve"]`.
- CLI override uses `--headroom-command <command>` and `--headroom-args mcp,serve`.
- Manifest keeps boolean `enabledFeatures.headroom = true` and stores command config under `featureOptions.headroom`.
- `setup --interactive` asks only whether to enable Headroom.
- `agent-workflow headroom install` installs into `~/.cache/agent-workflow-scaffold/headroom/venv`.
- Install is idempotent by default; `--force` rebuilds only the managed venv.
- Install fails fast when Python is missing or lower than 3.10.
- The CLI never edits shell PATH.
- `doctor --headroom` reports missing local executable as warning, not error.
- Dashboard/proxy runtime state is not checked by doctor.

---

### Task 1: Add Feature Types And Generation Flow

**Files:**
- Modify: `src/types.ts`
- Modify: `src/manifest.ts`
- Modify: `src/generators/index.ts`
- Modify: `src/generators/helpers.ts`
- Modify: `src/generators/codex.ts`
- Modify: `src/generators/claudeCode.ts`
- Modify: `src/generators/trae.ts`

**Interfaces:**
- Produces: `HeadroomOptions { enabled?: boolean; command: string; args: string[] }`
- Produces: `GenerateOptions.headroom?: boolean`, `GenerateOptions.headroomCommand?: string`, `GenerateOptions.headroomArgs?: string[]`
- Produces: generated reference file `references/headroom.md`

- [ ] Extend CLI options types with headroom flags.
- [ ] Preserve boolean feature state under `enabledFeatures.headroom`.
- [ ] Preserve command/args under `featureOptions.headroom`.
- [ ] Render Headroom reference documentation for all targets.
- [ ] Render Headroom MCP server only for Codex and Claude Code.

### Task 2: Add CLI Flags, Interactive Prompt, And Subcommands

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/interactive.ts`
- Create: `src/headroom.ts`
- Test: `src/tests/interactive.test.ts`
- Test: `src/tests/headroom.test.ts`

**Interfaces:**
- Produces: `agent-workflow headroom install`
- Produces: `agent-workflow headroom install --force`
- Produces: `agent-workflow headroom doctor`

- [ ] Parse `--headroom`, `--headroom-command`, and comma-separated `--headroom-args`.
- [ ] Add one interactive prompt for enabling Headroom.
- [ ] Implement managed venv path helpers.
- [ ] Implement Python 3.10+ fail-fast detection.
- [ ] Implement idempotent install state checks.
- [ ] Implement `--force` rebuild for the managed venv.
- [ ] Implement local headroom doctor status.

### Task 3: Add Doctor, Upgrade, And MCP Preview Support

**Files:**
- Modify: `src/doctor.ts`
- Modify: `src/upgrade.ts`
- Modify: `src/mcp/server.ts`
- Test: `src/tests/upgrade.test.ts`
- Test: `src/tests/headroom.test.ts`

**Interfaces:**
- Consumes: manifest `enabledFeatures.headroom` and `featureOptions.headroom`
- Produces: `doctor --headroom` warnings and config completeness checks

- [ ] `upgrade` keeps existing headroom enabled state and supports explicit `--headroom`.
- [ ] `doctor` checks reference files and MCP config for configured targets.
- [ ] `doctor` warns when local executable is missing.
- [ ] MCP preview schema accepts headroom flags.

### Task 4: Update Docs, Version, Tests, And Release

**Files:**
- Modify: `README.md`
- Modify: `docs/cli-zh.md`
- Modify: `docs/workflow-scaffold-evolution-plan.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/version.ts`

**Interfaces:**
- Produces: version `0.0.20`

- [ ] Document Headroom as optional, not default flow.
- [ ] Document token-saving prerequisites and limits.
- [ ] Document install, doctor, `--force`, PATH, dashboard/proxy limits.
- [ ] Add changelog entry and sync version files.
- [ ] Run `npm run check`.
- [ ] Run `npm run pack:dry`.
- [ ] Commit and push to GitHub remote after verification.
