# Hermes Post-Release Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Release `0.0.24` as a post-release hardening pass for the Hermes `0.0.22` workspace registration and `0.0.23` team rules features.

**Architecture:** Keep all Hermes runtime behavior unchanged and add verification/documentation assets around the existing CLI. Local tests validate the built `dist/cli.js` path without network access, while a separate explicit smoke script validates the published npm package through the configured registry.

**Tech Stack:** TypeScript, Node.js built-in test runner, npm scripts, Bash, existing docs and versioning workflow.

## Global Constraints

- Version target is `0.0.24`.
- Do not add new CLI commands or parameters.
- Do not implement `unregister` or `prune`.
- Do not implement project-level Hermes team projection.
- Do not detect, install, start, stop, or inspect Hermes runtime.
- Do not read or write `~/.hermes/*`.
- Do not add published-package smoke testing to `npm run check`.
- Do not support `SCAFFOLD_VERSION=local` in the smoke script.
- `scripts/smoke-published.sh` must default to `https://npm.tangees.com/` and allow `NPM_REGISTRY` override.
- `scripts/smoke-published.sh` must default to `latest` and allow `SCAFFOLD_VERSION` override.
- Quickstart documentation is Chinese-first with literal CLI command examples.

---

## File Structure

Create `scripts/smoke-published.sh`.
: Explicit published-package smoke script. It creates temporary project/workspace directories, invokes `npx --yes --registry="$NPM_REGISTRY" "@tungee/agent-workflow-scaffold@$SCAFFOLD_VERSION"`, verifies Hermes files and command output, and cleans up.

Create `docs/hermes-quickstart.md`.
: Short Hermes quickstart and validation document. It links the workspace registration and team rules flow without repeating the full CLI manual.

Modify `package.json`.
: Add `smoke:published` script and bump version to `0.0.24`.

Modify `package-lock.json`.
: Bump root package version to `0.0.24`.

Modify `src/version.ts`.
: Bump `SCAFFOLD_VERSION` to `0.0.24`.

Modify `src/tests/cliHelp.test.ts`.
: Add one local CLI end-to-end test for `hermes register -> team init -> list -> doctor -> team doctor`.

Modify `README.md`.
: Link the Hermes quickstart from the related docs section.

Modify `docs/cli-zh.md`.
: Link the quickstart from the Hermes section and fix the stale “当前 0.0.9” text to “当前版本”.

Modify `CHANGELOG.md`.
: Add `0.0.24` entry with Added, Changed, Fixed, and Tests.

## Task 1: Local Hermes CLI End-To-End Test

**Files:**
- Modify: `src/tests/cliHelp.test.ts`

**Interfaces:**
- Consumes: existing `runCli(args: string[]): Promise<string>` helper.
- Produces: one Node test named `hermes CLI supports full workspace and team verification flow`.

- [ ] **Step 1: Add failing local e2e test**

Add this test to `src/tests/cliHelp.test.ts` after the existing Hermes team tests:

```ts
test("hermes CLI supports full workspace and team verification flow", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-e2e-root-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-e2e-workspace-"));
  try {
    await writeFile(path.join(root, "README.md"), "# Hermes E2E Project\n", "utf8");

    const registerOutput = await runCli(["hermes", "register", "--root", root, "--workspace", workspace]);
    const teamOutput = await runCli(["hermes", "team", "init", "--workspace", workspace]);
    const listOutput = await runCli(["hermes", "list", "--workspace", workspace]);
    const doctorOutput = await runCli(["hermes", "doctor", "--root", root, "--workspace", workspace]);
    const teamDoctorOutput = await runCli(["hermes", "team", "doctor", "--workspace", workspace]);

    assert.match(registerOutput, /Hermes project registered/);
    assert.match(teamOutput, /Hermes team rules written/);
    assert.match(listOutput, /available/);
    assert.match(doctorOutput, /Hermes doctor: OK/);
    assert.match(teamDoctorOutput, /Hermes team doctor: OK/);

    const workspaceText = await import("node:fs/promises").then(({ readFile }) => readFile(path.join(workspace, "HERMES.md"), "utf8"));
    assert.match(workspaceText, /target=hermes-workspace/);
    assert.match(workspaceText, /target=hermes-team/);
    await import("node:fs/promises").then(({ access }) => access(path.join(root, ".hermes.md")));
    await import("node:fs/promises").then(({ access }) => access(path.join(workspace, ".agent-workflow/hermes-team/rules.md")));
    await import("node:fs/promises").then(({ access }) => access(path.join(workspace, ".agent-workflow/hermes-team/delegation-playbook.md")));
    await import("node:fs/promises").then(({ access }) => access(path.join(workspace, ".agent-workflow/hermes-team/role-sources.md")));
    await import("node:fs/promises").then(({ access }) => access(path.join(workspace, ".agent-workflow/hermes-team/manifest.json")));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run test to verify it passes against current behavior**

Run: `npm run build && node --test dist/tests/cliHelp.test.js`

Expected: PASS because this is a hardening test for already implemented behavior.

- [ ] **Step 3: Commit**

```bash
git add src/tests/cliHelp.test.ts
git commit -m "test: add hermes cli e2e flow"
```

## Task 2: Published Package Smoke Script

**Files:**
- Create: `scripts/smoke-published.sh`
- Modify: `package.json`

**Interfaces:**
- Produces npm script: `smoke:published`.
- Produces environment variables: `NPM_REGISTRY`, default `https://npm.tangees.com/`; `SCAFFOLD_VERSION`, default `latest`.

- [ ] **Step 1: Create smoke script**

Create `scripts/smoke-published.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

NPM_REGISTRY="${NPM_REGISTRY:-https://npm.tangees.com/}"
SCAFFOLD_VERSION="${SCAFFOLD_VERSION:-latest}"
PACKAGE="@tungee/agent-workflow-scaffold@${SCAFFOLD_VERSION}"

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/agent-workflow-published-smoke.XXXXXX")"
PROJECT_ROOT="${TMP_ROOT}/project"
WORKSPACE_ROOT="${TMP_ROOT}/HermesWorkspace"

cleanup() {
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

run_cli() {
  npx --yes --registry="$NPM_REGISTRY" "$PACKAGE" "$@"
}

assert_file() {
  if [[ ! -f "$1" ]]; then
    echo "Missing expected file: $1" >&2
    exit 1
  fi
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  if [[ "$haystack" != *"$needle"* ]]; then
    echo "Expected output to contain: $needle" >&2
    echo "$haystack" >&2
    exit 1
  fi
}

mkdir -p "$PROJECT_ROOT" "$WORKSPACE_ROOT"
printf '# Published Smoke Project\n' > "${PROJECT_ROOT}/README.md"

echo "Smoke package: $PACKAGE"
echo "Registry: $NPM_REGISTRY"

ANALYZE_OUTPUT="$(run_cli analyze --root "$PROJECT_ROOT" --json)"
assert_contains "$ANALYZE_OUTPUT" '"confidence"'

REGISTER_OUTPUT="$(run_cli hermes register --root "$PROJECT_ROOT" --workspace "$WORKSPACE_ROOT")"
assert_contains "$REGISTER_OUTPUT" "Hermes project registered"

TEAM_OUTPUT="$(run_cli hermes team init --workspace "$WORKSPACE_ROOT")"
assert_contains "$TEAM_OUTPUT" "Hermes team rules written"

LIST_OUTPUT="$(run_cli hermes list --workspace "$WORKSPACE_ROOT")"
assert_contains "$LIST_OUTPUT" "available"

DOCTOR_OUTPUT="$(run_cli hermes doctor --root "$PROJECT_ROOT" --workspace "$WORKSPACE_ROOT")"
assert_contains "$DOCTOR_OUTPUT" "Hermes doctor: OK"

TEAM_DOCTOR_OUTPUT="$(run_cli hermes team doctor --workspace "$WORKSPACE_ROOT")"
assert_contains "$TEAM_DOCTOR_OUTPUT" "Hermes team doctor: OK"

assert_file "${PROJECT_ROOT}/.hermes.md"
assert_file "${PROJECT_ROOT}/.agent-workflow/manifest.json"
assert_file "${WORKSPACE_ROOT}/HERMES.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/rules.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/delegation-playbook.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/role-sources.md"
assert_file "${WORKSPACE_ROOT}/.agent-workflow/hermes-team/manifest.json"

grep -q "target=hermes-workspace" "${WORKSPACE_ROOT}/HERMES.md"
grep -q "target=hermes-team" "${WORKSPACE_ROOT}/HERMES.md"

echo "Published smoke passed for $PACKAGE"
```

- [ ] **Step 2: Add npm script**

Add to `package.json` scripts:

```json
"smoke:published": "bash scripts/smoke-published.sh"
```

- [ ] **Step 3: Run published smoke against 0.0.23**

Run: `SCAFFOLD_VERSION=0.0.23 npm run smoke:published`

Expected: PASS and final output includes `Published smoke passed for @tungee/agent-workflow-scaffold@0.0.23`.

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-published.sh package.json
git commit -m "test: add published package smoke script"
```

## Task 3: Hermes Quickstart Documentation

**Files:**
- Create: `docs/hermes-quickstart.md`
- Modify: `README.md`
- Modify: `docs/cli-zh.md`

**Interfaces:**
- Produces a short Chinese-first quickstart for Hermes scaffold validation.

- [ ] **Step 1: Create quickstart**

Create `docs/hermes-quickstart.md` with sections:

```markdown
# Hermes 快速验收

## 边界

- Hermes 在本脚手架中是电脑级外部能力/运行时集成，不是 `codex`、`trae`、`claude-code` 同级 target。
- 脚手架不会安装、启动、停止、登录或检查 Hermes runtime。
- 脚手架不会写入或检查 `~/.hermes/*`。
- 脚手架不会创建 concrete Hermes agents、roles、sessions 或 Kanban workers。
- 用户启动 Hermes 后，基于 workspace `HERMES.md` 和项目 `.hermes.md` 自行协调项目与动态 agents。

## 最短路径

```bash
agent-workflow hermes register --root /path/to/project --workspace /path/to/HermesWorkspace
agent-workflow hermes team init --workspace /path/to/HermesWorkspace
agent-workflow hermes list --workspace /path/to/HermesWorkspace
agent-workflow hermes doctor --root /path/to/project --workspace /path/to/HermesWorkspace
agent-workflow hermes team doctor --workspace /path/to/HermesWorkspace
```

## 生成文件

```text
<project>/.hermes.md
<project>/.agent-workflow/manifest.json
<workspace>/HERMES.md
<workspace>/.agent-workflow/hermes-team/rules.md
<workspace>/.agent-workflow/hermes-team/delegation-playbook.md
<workspace>/.agent-workflow/hermes-team/role-sources.md
<workspace>/.agent-workflow/hermes-team/manifest.json
```

## 发布包 smoke

```bash
SCAFFOLD_VERSION=0.0.23 npm run smoke:published
NPM_REGISTRY=https://npm.tangees.com/ SCAFFOLD_VERSION=latest npm run smoke:published
```

`smoke:published` 验收的是已发布 npm 包，不纳入 `npm run check`。
```

- [ ] **Step 2: Link quickstart**

In `README.md`, add this related-docs bullet:

```markdown
- Hermes 快速验收：[docs/hermes-quickstart.md](docs/hermes-quickstart.md)
```

In `docs/cli-zh.md` Hermes section, add:

```markdown
快速验收路径见 [Hermes 快速验收](hermes-quickstart.md)。
```

- [ ] **Step 3: Fix stale version wording**

Replace:

```markdown
当前 `0.0.9` 还没有独立 `--preset` 参数
```

with:

```markdown
当前版本还没有独立 `--preset` 参数
```

- [ ] **Step 4: Commit**

```bash
git add docs/hermes-quickstart.md README.md docs/cli-zh.md
git commit -m "docs: add hermes quickstart"
```

## Task 4: Version, Changelog, and Final Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/version.ts`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces version `0.0.24`.

- [ ] **Step 1: Bump version**

Set:

```text
package.json version = 0.0.24
package-lock.json root version = 0.0.24
package-lock.json packages[""].version = 0.0.24
src/version.ts SCAFFOLD_VERSION = "0.0.24"
```

- [ ] **Step 2: Add changelog entry**

Add `## [0.0.24] - 2026-07-01` with:

```markdown
### Added

- 新增 `scripts/smoke-published.sh`，用于显式验收已发布 npm 包的 Hermes register/team/list/doctor 链路。
- 新增 `npm run smoke:published`，默认使用 `https://npm.tangees.com/` 和 `latest`，可通过 `NPM_REGISTRY` 与 `SCAFFOLD_VERSION` 覆盖。
- 新增 `docs/hermes-quickstart.md`，提供 Hermes workspace 与 team rules 的快速验收路径。

### Changed

- Hermes 文档补充发布包验收路径，并继续明确不检查 Hermes runtime 或 `~/.hermes/*`。

### Fixed

- 修正文档中过期的“当前 0.0.9”表述。

### Tests

- 增加本地 CLI Hermes end-to-end 测试，覆盖 `register -> team init -> list -> doctor -> team doctor`。
```

- [ ] **Step 3: Run local verification**

Run: `npm run check`

Expected: PASS.

Run: `npm_config_cache=/tmp/agent-workflow-npm-cache npm pack --dry-run`

Expected: PASS and tarball version `0.0.24`.

- [ ] **Step 4: Run published smoke against 0.0.23**

Run: `SCAFFOLD_VERSION=0.0.23 npm run smoke:published`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/version.ts CHANGELOG.md
git commit -m "chore: release 0.0.24"
```

## Task 5: Push and Publish

**Files:**
- No code changes after Task 4 unless verification finds an issue.

**Interfaces:**
- Publishes `@tungee/agent-workflow-scaffold@0.0.24`.

- [ ] **Step 1: Push commits**

Run: `git push`

Expected: `main -> main`.

- [ ] **Step 2: Publish**

Run: `npm publish --registry=https://npm.tangees.com/`

Expected: npm prints `+ @tungee/agent-workflow-scaffold@0.0.24`.

- [ ] **Step 3: Verify published version**

Run: `npm view @tungee/agent-workflow-scaffold@0.0.24 version --registry=https://npm.tangees.com/`

Expected: `0.0.24`.

- [ ] **Step 4: Run published smoke against 0.0.24**

Run: `SCAFFOLD_VERSION=0.0.24 npm run smoke:published`

Expected: PASS.

- [ ] **Step 5: Confirm clean tree**

Run: `git status --short --branch`

Expected: `## main...origin/main`.

## Self-Review

- Spec coverage: all 18 confirmed decisions are covered by Global Constraints and Tasks 1-5.
- Placeholder scan: no placeholders or deferred decisions remain.
- Type consistency: this plan uses existing helpers and shell/npm interfaces only; no new TypeScript public API is introduced.
