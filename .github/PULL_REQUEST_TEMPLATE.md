# Pull Request

## Summary

- Target version:
- Change type: CLI / analyzer / generator / MCP / docs / tests / release / other
- Brief description:

## Safety Checklist

- [ ] No target project business code is generated or modified.
- [ ] No user-global skill, agent, MCP, or tool directory is written by default.
- [ ] `init` / `generate` remain dry-run unless `--write` is passed.
- [ ] Generated text uses managed blocks.
- [ ] JSON config uses structured merge.
- [ ] External providers remain opt-in.

## Documentation Checklist

- [ ] `README.md` updated or not applicable.
- [ ] `docs/cli-zh.md` updated or not applicable.
- [ ] `docs/workflow-scaffold-evolution-plan.md` updated or not applicable.
- [ ] `docs/architecture.md` updated or not applicable.
- [ ] `docs/testing.md` updated or not applicable.
- [ ] `docs/release.md` updated or not applicable.
- [ ] ADR added or updated when architectural decisions changed.

## Version Checklist

- [ ] `CHANGELOG.md` has a new version entry.
- [ ] `package.json` version updated.
- [ ] `package-lock.json` version updated.
- [ ] `src/mcp/server.ts` version updated.
- [ ] Version bump is intentionally not needed for this PR.

## Validation

Paste command results:

```bash
npm run build
node --test dist/tests/*.test.js
npm run pack:dry
```

CLI smoke tests run:

```bash
node dist/cli.js analyze
node dist/cli.js skills recommend
node dist/cli.js init --target codex
```

## Known Limitations

- 
