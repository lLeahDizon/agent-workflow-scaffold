# Iteration Guide

Use this guide when planning or implementing a new scaffold version.

## Standard Iteration Flow

1. Define the target version, for example `0.0.5`.
2. Write the goal in one sentence.
3. Identify affected surfaces:
   - Analyzer
   - Types
   - Generators
   - Writer
   - CLI
   - MCP
   - Doctor
   - Docs
   - Tests
4. Update or create the design notes in `docs/workflow-scaffold-evolution-plan.md`.
5. Implement the smallest complete change.
6. Add focused tests.
7. Update user docs.
8. Update `CHANGELOG.md`.
9. Run validation.
10. Prepare release notes or handoff notes.

## Implementation Order

For model changes:

```text
types -> analyzer -> recommendations/templates -> generators -> doctor -> CLI/MCP -> tests -> docs
```

For CLI-only changes:

```text
cli -> tests/smoke -> docs/cli-zh.md -> CHANGELOG.md
```

For target generator changes:

```text
generator helper -> target generator -> doctor -> tests -> docs -> CHANGELOG.md
```

For MCP changes:

```text
server schema -> server tool -> docs -> tests/smoke -> version sync
```

## Definition Of Done

A version is done only when:

- The feature works through the public CLI path.
- Core APIs still build.
- Generated files preserve user-authored content.
- Docs describe actual implemented behavior.
- `CHANGELOG.md` has a new version entry.
- Version numbers are synchronized.
- Validation commands pass.

## Documentation Update Matrix

Update these files by change type:

| Change | Required docs |
| --- | --- |
| New CLI command or option | `README.md`, `docs/cli-zh.md`, `CHANGELOG.md` |
| New generated file | `docs/cli-zh.md`, `docs/architecture.md`, `CHANGELOG.md` |
| New target | `README.md`, `docs/cli-zh.md`, `docs/architecture.md`, `docs/testing.md`, `CHANGELOG.md` |
| New MCP tool | `docs/cli-zh.md`, `docs/architecture.md`, `CHANGELOG.md` |
| New provider | `docs/workflow-scaffold-evolution-plan.md`, `docs/cli-zh.md`, `CHANGELOG.md` |
| Release process change | `CONTRIBUTING.md`, `docs/release.md`, `CHANGELOG.md` |

## Version Scope Guidance

Patch versions are acceptable while the package is in `0.0.x`.

Use a new patch version for:

- New command or option.
- New generated artifact.
- New analyzer field.
- New MCP tool.
- Changed write behavior.
- Documentation-only process updates intended for team handoff.

Do not batch unrelated behavior changes into one version unless they are necessary for a single deliverable.

## Handoff Notes

When handing work to another engineer, include:

- Target version.
- Files changed.
- Behavior changed.
- Commands run.
- Known limitations.
- Follow-up checklist.
