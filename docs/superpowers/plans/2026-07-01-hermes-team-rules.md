# Hermes Team Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add workspace-level Hermes agents team rules that guide dynamic Hermes delegation without creating, installing, or starting concrete Hermes agents.

**Architecture:** Extend the existing Hermes module with a separate workspace team-rules slice that writes a `target=hermes-team` managed block into `HERMES.md`, three managed reference files under `.agent-workflow/hermes-team/`, and a scaffold-owned JSON manifest. Keep project registration (`target=hermes-workspace`) independent from team rules, and keep all Hermes runtime ownership outside this scaffold.

**Tech Stack:** TypeScript, Node.js built-ins, existing Node test runner, existing managed block utilities, existing Hermes path/display helpers, existing CLI parser.

## Global Constraints

- Version target is `0.0.23`.
- Hermes team rules are workspace-level first; project-level team projection is out of scope for the first version.
- Add explicit commands `agent-workflow hermes team init` and `agent-workflow hermes team doctor`.
- Do not add `--target hermes`.
- Do not add `setup --hermes`, `init --hermes`, `generate --hermes`, or interactive Hermes prompts.
- Do not add `--agent-provider` to Hermes team commands.
- Do not load, copy, rewrite, or generate concrete `agency-agents` role files.
- Do not generate `roles/<role-id>.md` or `roster.md`.
- Do not create Hermes agents, Kanban workers, profiles, skills, sessions, or runtime state.
- Do not install, start, stop, log in to, or inspect Hermes runtime.
- Do not write or inspect `~/.hermes/config.yaml`, `~/.hermes/SOUL.md`, or any other Hermes global home file.
- `hermes team init` is an explicit write action and does not require `--write`.
- `--dry-run` previews paths, actions, managed block targets, and warnings only; it must not write files or create directories.
- Default workspace directory remains `~/HermesWorkspace`; `--workspace <dir>` overrides it.
- Missing workspace is created by `hermes team init` unless `--dry-run`.
- `hermes team init` does not require an existing project index or an existing `HERMES.md`.
- Existing `target=hermes-workspace` project index and new `target=hermes-team` block must coexist without overwriting each other.
- `hermes register` must continue updating only `target=hermes-workspace`.
- `hermes team init` must update only `target=hermes-team` inside `HERMES.md`.
- Team reference files are managed text, not whole-file overwrites.
- Reference managed block targets are exactly `hermes-team-rules`, `hermes-team-delegation`, and `hermes-team-role-sources`.
- If a team managed block boundary is unsafe or corrupted, fail fast and do not overwrite.
- Team manifest path is fixed: `.agent-workflow/hermes-team/manifest.json`.
- Team manifest is scaffold-owned JSON; if existing JSON is corrupted, fail fast.
- Team manifest is rewritten from current inputs, not treated as user config.
- `--agency-agents-path`, `--agent-roles`, and `--agent-divisions` are optional reference inputs only.
- If `--agency-agents-path` is provided but does not exist, report warning only, not error.
- Do not validate whether `--agent-roles` or `--agent-divisions` match actual agency-agents files.
- If no agency arguments are provided, still generate `role-sources.md` with “no external role source configured.”
- `hermes team doctor` checks scaffold-generated workspace team rules only, not Hermes runtime.
- Documentation must clearly state that users start Hermes and build concrete agents themselves based on these rules.

---

## File Structure

Modify `src/hermes.ts`.
: Add team rules constants, types, renderers, plan/write helpers, manifest read/write helpers, and `doctorHermesTeam()`. Keep existing register/init-project/list/doctor functions unchanged except sharing small local helpers if useful.

Modify `src/cli.ts`.
: Add `hermes team init` and `hermes team doctor` dispatch, help text, dry-run output, write output, and issue formatting. Keep `hermes register`, `init-project`, `doctor`, and `list` behavior unchanged.

Modify `src/index.ts`.
: Export public Hermes team helpers and types only after they are implemented and tested.

Modify tests.
: Extend `src/tests/hermes.test.ts` for renderers, write planning, managed block coexistence, manifest behavior, warnings, and doctor. Extend `src/tests/cliHelp.test.ts` for CLI help and smoke behavior.

Modify docs/version.
: Update `README.md`, `docs/cli-zh.md`, `docs/workflow-scaffold-evolution-plan.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, and `src/version.ts` for `0.0.23`.

## Task 1: Team Rules Renderers and Types

**Files:**
- Modify: `src/hermes.ts`
- Test: `src/tests/hermes.test.ts`

**Interfaces:**
- Produces: `HERMES_TEAM_DIR = ".agent-workflow/hermes-team"`
- Produces: `HERMES_TEAM_MANIFEST = ".agent-workflow/hermes-team/manifest.json"`
- Produces: `HermesTeamOptions`
- Produces: `HermesTeamManifest`
- Produces: `renderHermesTeamWorkspaceMarkdown(options): string`
- Produces: `renderHermesTeamRulesMarkdown(options): string`
- Produces: `renderHermesTeamDelegationMarkdown(options): string`
- Produces: `renderHermesTeamRoleSourcesMarkdown(options): string`

- [ ] **Step 1: Write failing renderer tests**

Add tests in `src/tests/hermes.test.ts`:

```ts
test("Hermes team renderers emit managed blocks without concrete role files", () => {
  const options = {
    workspacePath: path.join(os.homedir(), "HermesWorkspace"),
    agencyAgentsPath: "../agency-agents",
    agentRoles: ["software-architect", "code-reviewer"],
    agentDivisions: ["engineering"],
    updatedAt: "2026-07-01T00:00:00.000Z"
  };

  const workspace = renderHermesTeamWorkspaceMarkdown(options);
  const rules = renderHermesTeamRulesMarkdown(options);
  const delegation = renderHermesTeamDelegationMarkdown(options);
  const sources = renderHermesTeamRoleSourcesMarkdown(options);

  assert.match(workspace, /target=hermes-team/);
  assert.match(workspace, /Dynamic Agent Team Rules/);
  assert.doesNotMatch(workspace, /roles\/software-architect\.md/);
  assert.match(rules, /target=hermes-team-rules/);
  assert.match(rules, /Do not assume a standing team already exists/);
  assert.match(delegation, /target=hermes-team-delegation/);
  assert.match(delegation, /delegate_task/);
  assert.match(sources, /target=hermes-team-role-sources/);
  assert.match(sources, /software-architect/);
  assert.match(sources, /Reference only/);
});

test("Hermes team role sources render without agency inputs", () => {
  const sources = renderHermesTeamRoleSourcesMarkdown({
    workspacePath: path.join(os.homedir(), "HermesWorkspace"),
    updatedAt: "2026-07-01T00:00:00.000Z"
  });

  assert.match(sources, /No external role source is configured/);
  assert.match(sources, /target=hermes-team-role-sources/);
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL because renderers do not exist.

- [ ] **Step 2: Add team constants, types, and renderers**

Add near the existing Hermes constants in `src/hermes.ts`:

```ts
export const HERMES_TEAM_DIR = ".agent-workflow/hermes-team";
export const HERMES_TEAM_MANIFEST = ".agent-workflow/hermes-team/manifest.json";
export const HERMES_TEAM_RULES = ".agent-workflow/hermes-team/rules.md";
export const HERMES_TEAM_DELEGATION = ".agent-workflow/hermes-team/delegation-playbook.md";
export const HERMES_TEAM_ROLE_SOURCES = ".agent-workflow/hermes-team/role-sources.md";

export interface HermesTeamOptions {
  workspacePath?: string;
  agencyAgentsPath?: string;
  agentRoles?: string[];
  agentDivisions?: string[];
  dryRun?: boolean;
  updatedAt?: string;
}

export interface HermesTeamManifest {
  schemaVersion: 1;
  scaffoldVersion: string;
  workspacePath: string;
  agencyAgentsPath?: string;
  agentRoles: string[];
  agentDivisions: string[];
  managedFiles: string[];
  updatedAt: string;
}
```

Implement renderers with these exact managed targets:

```ts
renderHermesTeamWorkspaceMarkdown(options)        // target "hermes-team"
renderHermesTeamRulesMarkdown(options)            // target "hermes-team-rules"
renderHermesTeamDelegationMarkdown(options)       // target "hermes-team-delegation"
renderHermesTeamRoleSourcesMarkdown(options)      // target "hermes-team-role-sources"
```

Content requirements:
- State that Hermes may dynamically create/delegate agents after the user starts Hermes.
- State that this scaffold does not create concrete agents.
- Reference `rules.md`, `delegation-playbook.md`, and `role-sources.md`.
- Mention `Registered Projects` and project `.hermes.md` as inputs when available, but do not copy project lists.
- For role sources, treat `agency-agents` as reference only and warn against full import.
- Do not include full agency-agents content.

- [ ] **Step 3: Run renderer tests**

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: PASS for new renderer tests and existing Hermes tests.

- [ ] **Step 4: Commit**

```bash
git add src/hermes.ts src/tests/hermes.test.ts
git commit -m "feat: render hermes team rules"
```

## Task 2: Team Init Planning, Writing, and Doctor

**Files:**
- Modify: `src/hermes.ts`
- Test: `src/tests/hermes.test.ts`

**Interfaces:**
- Consumes: renderers from Task 1.
- Produces: `HermesTeamWritePlan`
- Produces: `HermesTeamWriteResult`
- Produces: `HermesTeamDoctorIssue`
- Produces: `HermesTeamDoctorResult`
- Produces: `planHermesTeamInit(options): Promise<HermesTeamWritePlan>`
- Produces: `writeHermesTeamInit(options): Promise<HermesTeamWriteResult>`
- Produces: `doctorHermesTeam(options): Promise<HermesTeamDoctorResult>`

- [ ] **Step 1: Write failing plan/write tests**

Add tests in `src/tests/hermes.test.ts`:

```ts
test("Hermes team init dry-run does not create workspace", async () => {
  const workspace = path.join(os.tmpdir(), `agent-workflow-hermes-team-dry-${Date.now()}`);
  try {
    const plan = await planHermesTeamInit({
      workspacePath: workspace,
      dryRun: true,
      agencyAgentsPath: path.join(workspace, "missing-agency-agents"),
      agentRoles: ["software-architect"],
      agentDivisions: ["engineering"],
      updatedAt: "2026-07-01T00:00:00.000Z"
    });

    assert.equal(plan.dryRun, true);
    assert.equal(await pathExists(workspace), false);
    assert.ok(plan.warnings.some((warning) => warning.includes("agency-agents path not found")));
    assert.ok(plan.actions.some((action) => action.path.endsWith("HERMES.md") && action.action === "create"));
    assert.ok(plan.actions.some((action) => action.path.endsWith("role-sources.md") && action.action === "create"));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes team init writes workspace rules and manifest", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-team-"));
  try {
    const result = await writeHermesTeamInit({
      workspacePath: workspace,
      agencyAgentsPath: path.join(workspace, "missing-agency-agents"),
      agentRoles: ["software-architect", "code-reviewer"],
      agentDivisions: ["engineering"],
      updatedAt: "2026-07-01T00:00:00.000Z"
    });

    assert.ok(result.writes.some((write) => write.relativePath.endsWith("HERMES.md")));
    assert.match(await readFile(path.join(workspace, HERMES_WORKSPACE_INDEX), "utf8"), /target=hermes-team/);
    assert.match(await readFile(path.join(workspace, HERMES_TEAM_RULES), "utf8"), /target=hermes-team-rules/);
    assert.match(await readFile(path.join(workspace, HERMES_TEAM_DELEGATION), "utf8"), /target=hermes-team-delegation/);
    assert.match(await readFile(path.join(workspace, HERMES_TEAM_ROLE_SOURCES), "utf8"), /software-architect/);
    const manifest = JSON.parse(await readFile(path.join(workspace, HERMES_TEAM_MANIFEST), "utf8")) as HermesTeamManifest;
    assert.equal(manifest.schemaVersion, 1);
    assert.equal(manifest.workspacePath, path.resolve(workspace));
    assert.deepEqual(manifest.agentRoles, ["software-architect", "code-reviewer"]);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL because plan/write helpers do not exist.

- [ ] **Step 2: Implement plan/write helpers**

In `src/hermes.ts`:
- Reuse `plannedAction()`, `displayPath()`, `normalizeHermesPath()`, `applyManagedText()`, `assertManagedBlockSafeForTarget()`, `ensureDirectory()`, `readTextIfExists()`, and `writeTextFile()`.
- For `HERMES.md`, assert target `hermes-team` is safe, then apply `renderHermesTeamWorkspaceMarkdown()`.
- For the three Markdown reference files, assert their specific targets are safe, then apply their renderers.
- For `manifest.json`, read existing text. If it exists and is invalid JSON, throw `Hermes team manifest is corrupted: failed to parse JSON.`
- Write manifest with `JSON.stringify(manifest, null, 2) + "\n"`.
- `writeHermesTeamInit()` must call `ensureDirectory(workspacePath)` and `ensureDirectory(path.join(workspacePath, HERMES_TEAM_DIR))`.
- `planHermesTeamInit()` must not create directories.
- `warnings` must include `agency-agents path not found; recorded as reference only: <path>` when the provided path does not exist.

- [ ] **Step 3: Write failing coexistence and fail-fast tests**

Add tests:

```ts
test("Hermes team init coexists with workspace project index block", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-team-project-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-team-workspace-"));
  try {
    await writeHermesRegister({ rootPath: root, workspacePath: workspace, dryRun: false, projectFile: true });
    await writeHermesTeamInit({ workspacePath: workspace, updatedAt: "2026-07-01T00:00:00.000Z" });
    const text = await readFile(path.join(workspace, HERMES_WORKSPACE_INDEX), "utf8");

    assert.match(text, /target=hermes-workspace/);
    assert.match(text, /agent-workflow-scaffold:hermes-workspace-index/);
    assert.match(text, /target=hermes-team/);
    assert.match(await readFile(path.join(root, HERMES_PROJECT_FILE), "utf8"), /target=hermes/);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes team init fails fast on corrupt team managed block", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-team-corrupt-"));
  try {
    await writeFile(
      path.join(workspace, HERMES_WORKSPACE_INDEX),
      "<!-- agent-workflow-scaffold:start target=hermes-team scaffoldVersion=0.0.23 schemaVersion=1 -->\nmissing end\n",
      "utf8"
    );

    await assert.rejects(
      () => writeHermesTeamInit({ workspacePath: workspace }),
      /Unsafe or corrupted managed block/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes team init fails fast on corrupt team manifest JSON", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-team-bad-manifest-"));
  try {
    await mkdir(path.join(workspace, HERMES_TEAM_DIR), { recursive: true });
    await writeFile(path.join(workspace, HERMES_TEAM_MANIFEST), "{", "utf8");

    await assert.rejects(
      () => writeHermesTeamInit({ workspacePath: workspace }),
      /Hermes team manifest is corrupted/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL until the safety checks are wired correctly.

- [ ] **Step 4: Implement `doctorHermesTeam()`**

Add `doctorHermesTeam(options)` with:
- `ok=false` only for `error` issues.
- Error when workspace is missing.
- Error when `HERMES.md` is missing.
- Error when `HERMES.md` lacks safe `target=hermes-team` managed block.
- Error when any of `rules.md`, `delegation-playbook.md`, or `role-sources.md` is missing or lacks its target managed block.
- Error when manifest is missing or corrupted.
- Warning when manifest records `agencyAgentsPath` but it does not exist.
- Info that Hermes runtime and `~/.hermes/config.yaml` are not checked.

Add test:

```ts
test("Hermes team doctor checks generated files and warns on missing agency source", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-team-doctor-"));
  try {
    await writeHermesTeamInit({
      workspacePath: workspace,
      agencyAgentsPath: path.join(workspace, "missing-agency-agents"),
      updatedAt: "2026-07-01T00:00:00.000Z"
    });

    const result = await doctorHermesTeam({ workspacePath: workspace });
    assert.equal(result.ok, true);
    assert.ok(result.issues.some((issue) => issue.level === "warning" && issue.message.includes("agency-agents path not found")));
    assert.ok(result.issues.some((issue) => issue.level === "info" && issue.message.includes("not checked")));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 5: Run tests and commit**

Run:

```bash
npm run build && node --test dist/tests/hermes.test.js
```

Expected: PASS.

Commit:

```bash
git add src/hermes.ts src/tests/hermes.test.ts
git commit -m "feat: write hermes team rules"
```

## Task 3: CLI Commands and Public Exports

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Test: `src/tests/cliHelp.test.ts`

**Interfaces:**
- Consumes: `planHermesTeamInit`, `writeHermesTeamInit`, `doctorHermesTeam`.
- Produces CLI commands `agent-workflow hermes team init` and `agent-workflow hermes team doctor`.

- [ ] **Step 1: Write failing CLI tests**

Add to `src/tests/cliHelp.test.ts`:

```ts
test("hermes help documents team commands", async () => {
  const output = await runCli(["hermes", "-h"]);

  assert.match(output, /team init/);
  assert.match(output, /team doctor/);
  assert.match(output, /does not create concrete Hermes agents/);
});

test("hermes team init dry-run previews without writing", async () => {
  const workspace = path.join(os.tmpdir(), `agent-workflow-cli-hermes-team-${Date.now()}`);
  try {
    const output = await runCli(["hermes", "team", "init", "--workspace", workspace, "--dry-run"]);

    assert.match(output, /Hermes team init dry-run/);
    assert.match(output, /target=hermes-team/);
    assert.match(output, /rules.md/);
    await assert.rejects(() => import("node:fs/promises").then(({ access }) => access(workspace)));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("hermes team init writes workspace team rules", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-team-init-"));
  try {
    const output = await runCli(["hermes", "team", "init", "--workspace", workspace]);
    assert.match(output, /Hermes team rules written/);
    await import("node:fs/promises").then(({ access }) => access(path.join(workspace, ".agent-workflow/hermes-team/rules.md")));
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("hermes team doctor reports OK after init", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-team-doctor-"));
  try {
    await runCli(["hermes", "team", "init", "--workspace", workspace]);
    const output = await runCli(["hermes", "team", "doctor", "--workspace", workspace]);
    assert.match(output, /Hermes team doctor: OK/);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/cliHelp.test.js`

Expected: FAIL until CLI dispatch exists.

- [ ] **Step 2: Implement CLI help and dispatch**

In `src/cli.ts`:
- Import `doctorHermesTeam`, `planHermesTeamInit`, `writeHermesTeamInit`, and team constants if needed.
- Update `printHermesHelp()` usage block:

```text
agent-workflow hermes team init [--workspace <path>] [--agency-agents-path <path>] [--agent-roles <ids>] [--agent-divisions <ids>] [--dry-run]
agent-workflow hermes team doctor [--workspace <path>]
```

- Add a `team` branch at the top of `runHermes()` before existing subcommands.
- For `team init`, build options from:
  - `workspacePath: flagString(args.flags, "workspace")`
  - `agencyAgentsPath: flagString(args.flags, "agency-agents-path")`
  - `agentRoles: flagList(args.flags, "agent-roles")`
  - `agentDivisions: flagList(args.flags, "agent-divisions")`
  - `dryRun: Boolean(args.flags["dry-run"])`
- Dry-run prints workspace path, managed block targets, warnings, and file actions.
- Write prints workspace path, warnings, and write actions.
- For `team doctor`, print issues and set `process.exitCode = 1` only when `ok=false`.
- Unknown `team` subcommands fail with help and exit code 1.

- [ ] **Step 3: Export public helpers**

In `src/index.ts`, export:

```ts
export {
  doctorHermesTeam,
  planHermesTeamInit,
  writeHermesTeamInit
} from "./hermes.js";
export type {
  HermesTeamDoctorIssue,
  HermesTeamDoctorResult,
  HermesTeamManifest,
  HermesTeamOptions,
  HermesTeamWritePlan,
  HermesTeamWriteResult
} from "./hermes.js";
```

- [ ] **Step 4: Run CLI tests and commit**

Run:

```bash
npm run build && node --test dist/tests/cliHelp.test.js dist/tests/hermes.test.js
```

Expected: PASS.

Commit:

```bash
git add src/cli.ts src/index.ts src/tests/cliHelp.test.ts
git commit -m "feat: add hermes team cli"
```

## Task 4: Documentation, Version, and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/cli-zh.md`
- Modify: `docs/workflow-scaffold-evolution-plan.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/version.ts`

**Interfaces:**
- Consumes: completed `hermes team init` and `hermes team doctor`.
- Produces version `0.0.23`.

- [ ] **Step 1: Update version files**

Set all package/scaffold versions to `0.0.23`:
- `package.json`
- `package-lock.json`
- `src/version.ts`

- [ ] **Step 2: Update docs**

README must document:
- `agent-workflow hermes team init`
- `agent-workflow hermes team doctor`
- Team rules are workspace-level.
- The scaffold does not create concrete agents.
- Users start Hermes and build concrete agents themselves.
- Optional `agency-agents` path/roles/divisions are reference-only.
- No writes to `~/.hermes/*`.

`docs/cli-zh.md` must include:
- Command syntax.
- Generated files.
- Dry-run behavior.
- Doctor scope.
- Warning-only behavior for missing `agency-agents` path.
- The explicit non-goals: no concrete agents, no roles files, no roster, no runtime checks.

`docs/workflow-scaffold-evolution-plan.md` must add a `Hermes Team Rules` section and checklist items.

`CHANGELOG.md` must add:

```md
## [0.0.23] - 2026-07-01
```

with Added/Changed/Docs/Tests categories.

- [ ] **Step 3: Run full verification**

Run:

```bash
npm run check
npm_config_cache=/tmp/agent-workflow-npm-cache npm pack --dry-run
```

Expected:
- `npm run check` passes.
- `npm pack --dry-run` includes `dist/hermes.*` and updated docs.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/cli-zh.md docs/workflow-scaffold-evolution-plan.md CHANGELOG.md package.json package-lock.json src/version.ts
git commit -m "docs: document hermes team rules"
```

## Self-Review Checklist

- Hermes team rules are not modeled as an `AgentTarget`.
- No command writes to `~/.hermes/*`.
- No command starts, installs, stops, logs into, or checks Hermes runtime.
- `agency-agents` content is not loaded or copied.
- Missing `agency-agents` path is a warning only.
- `team init` creates workspace only outside `--dry-run`.
- `team init` does not require existing project index.
- `target=hermes-workspace` and `target=hermes-team` coexist in `HERMES.md`.
- Reference files use managed blocks and preserve user-authored text.
- Manifest JSON is scaffold-owned and fails fast when corrupted.
- CLI and docs clearly say users build concrete agents inside Hermes themselves.
