# ADR 0001: Core Design Decisions

Date: 2026-06-17

## Status

Accepted

## Context

The scaffold must work across existing projects, new projects, and empty directories. It generates Agent workflow configuration for Codex, Trae, and Claude Code. The main risk is project code or user-global configuration intrusion.

## Decisions

### 1. Default To Preview

`init` and `generate` must preview changes by default. Files are written only when `--write` is passed.

Reason:
- Users can inspect generated artifacts before accepting them.
- Existing projects can evaluate impact safely.

### 2. Use Managed Blocks And JSON Merge

Text files use `agent-workflow-scaffold` managed blocks. JSON files use structured merge.

Reason:
- User-authored content must be preserved.
- Re-running the scaffold should be deterministic.

### 3. Keep CRM Projects As References, Not Hard Targets

`crm`, `crm-common`, `crm-common-order`, `crm-sales-h5`, and `crm-management` are reference projects for presets and rules. They are not the only supported project types.

Reason:
- The scaffold must support arbitrary target projects.
- CRM-specific rules should become optional presets.

### 4. Make External Agent Libraries Optional Providers

`agency-agents` is supported through local-path provider options. It is not bundled or downloaded by default.

Reason:
- Keeps the npm package small.
- Avoids hidden remote network behavior.
- Keeps third-party role content explicit and traceable.

### 5. Scan Skills Read-Only

Skill scanning reads local/global `SKILL.md` metadata and generates recommendations. It does not install, copy, prune, or edit user-global skills.

Reason:
- Global skill directories belong to the user.
- Recommendations are useful without mutation.
- Future install or prune commands require explicit confirmation.

### 6. Keep MCP As A Thin API Surface

MCP tools call the same core APIs as the CLI.

Reason:
- Avoids divergent behavior between CLI and Agent tool usage.
- Keeps validation and generation logic centralized.

## Consequences

- Some workflows require extra user confirmation.
- Generated configuration is intentionally conservative.
- Future contributors must update analyzer, generator, CLI, MCP, docs, and tests together when behavior crosses those boundaries.
