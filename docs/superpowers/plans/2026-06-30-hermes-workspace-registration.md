# Hermes Workspace Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Hermes as a computer-level workspace registration workflow that indexes projects for cross-project coordination while keeping Hermes runtime ownership outside the scaffold.

**Architecture:** Hermes is a new explicit CLI namespace, not an `AgentTarget` and not a `--hermes` option for setup/init/generate. Add a focused `src/hermes.ts` module that analyzes one project, writes a project-local `.hermes.md`, merges the project into a workspace `HERMES.md` index, updates the project manifest, and exposes doctor/list helpers for the CLI. Reuse existing conservative project analysis, managed block replacement, JSON merge, path containment, and manifest patterns.

**Tech Stack:** TypeScript, Node.js built-ins, existing Node test runner, existing `ProjectProfile`, existing managed block/file writer utilities.

## Global Constraints

- Version target is `0.0.22`.
- Hermes is not an `AgentTarget`; do not add `--target hermes`.
- Hermes is not a per-client MCP server; do not generate Codex, Claude Code, or Trae MCP config for Hermes.
- Do not add `setup --hermes`, `init --hermes`, or `generate --hermes`.
- Do not add Hermes to `setup --interactive` or `init --interactive`.
- Do not add Hermes MCP server tools in the first version.
- Do not write or inspect `~/.hermes/config.yaml`.
- Do not install, start, stop, log in to, or check the Hermes runtime.
- First version commands are exactly `agent-workflow hermes register`, `agent-workflow hermes init-project`, `agent-workflow hermes doctor`, and `agent-workflow hermes list`.
- `register` and `init-project` are explicit write actions and do not require `--write`.
- `--dry-run` previews paths and summaries only; it must not write files or create directories.
- Default workspace directory is `~/HermesWorkspace`; `--workspace <dir>` overrides it.
- Workspace index filename is fixed as `HERMES.md`; do not add `--index-file`.
- Project file name is fixed as `.hermes.md`; do not add `--project-file-name`.
- `--root` points to one existing project directory; missing root must fail fast and must not be created.
- `--workspace` points to a directory; missing workspace is created by `register` unless `--dry-run`.
- `register` must fail fast when normalized `--root` and `--workspace` are the same directory.
- Empty or low-confidence projects may be registered, but CLI output and generated content must warn clearly.
- Workspace project identity and deduplication key is normalized absolute `rootPath`.
- Markdown displays use `~`-compressed paths; machine-readable JSON and manifest values use normalized absolute paths.
- `updatedAt` values are ISO UTC strings.
- Existing workspace entries whose roots no longer exist are retained and marked `missing`; first version does not include `unregister` or `prune`.
- Workspace `HERMES.md` uses managed block target `hermes-workspace`.
- Project `.hermes.md` uses managed block target `hermes`.
- Workspace index JSON comment marker is `agent-workflow-scaffold:hermes-workspace-index` with `{ "schemaVersion": 1, "projects": [] }`.
- If workspace index JSON cannot be parsed, `register`, `list`, and `doctor` fail fast and must not overwrite it.
- If project `.hermes.md` has a complete managed block, update it; if it has no managed block, append one; if block boundaries are unsafe or corrupted, fail fast.
- `--no-project-file` is only for `register`; it skips `.hermes.md` but still updates workspace `HERMES.md` and project manifest.
- `init-project` always writes `.hermes.md` and project manifest; it has no `--no-manifest`.
- `upgrade` does not update Hermes files in the first version.
- Documentation must explain that `~/HermesWorkspace` is a scaffold-created project index workspace, not Hermes official config storage.

---

## File Structure

Create `src/hermes.ts`.
: Owns Hermes workspace/project rendering, workspace index parsing/merging, dry-run planning, manifest updates, doctor, and list helpers. Keep this module independent from target generators because Hermes is not a target.

Modify `src/manifest.ts`.
: Add `hermes` to `enabledFeatures` and `featureOptions`, plus small helper types used by `src/hermes.ts`.

Modify `src/cli.ts`.
: Add `hermes` help and dispatch for `register`, `init-project`, `doctor`, and `list`. Keep existing setup/init/generate flows unchanged.

Modify `src/writer/managedBlock.ts`.
: Add a strict safety helper for corrupted managed block boundaries if the existing `applyManagedText` behavior cannot fail fast.

Modify `src/utils/format.ts`.
: Add `expandHomePath()` and `homeRelativePath()` helpers if needed by Hermes path parsing and Markdown display.

Modify `src/index.ts`.
: Export public Hermes helper types/functions only if needed for tests or downstream library use.

Modify tests.
: Add focused unit/integration tests under `src/tests/hermes.test.ts` and help tests in `src/tests/cliHelp.test.ts`.

Modify docs/version.
: Update `README.md`, `docs/cli-zh.md`, `docs/workflow-scaffold-evolution-plan.md`, `CHANGELOG.md`, `package.json`, `package-lock.json`, and `src/version.ts`.

## Task 1: Hermes Types, Path Helpers, and Rendering

**Files:**
- Create: `src/hermes.ts`
- Modify: `src/utils/format.ts`
- Test: `src/tests/hermes.test.ts`

**Interfaces:**
- Produces: `DEFAULT_HERMES_WORKSPACE = path.join(os.homedir(), "HermesWorkspace")`
- Produces: `HERMES_WORKSPACE_INDEX = "HERMES.md"`
- Produces: `HERMES_PROJECT_FILE = ".hermes.md"`
- Produces: `HermesWorkspaceProject`
- Produces: `HermesWorkspaceIndex`
- Produces: `normalizeHermesPath(input: string): string`
- Produces: `displayPath(input: string): string`
- Produces: `projectToHermesEntry(profile, options): Promise<HermesWorkspaceProject>`
- Produces: `renderHermesProjectMarkdown(profile, options): string`
- Produces: `renderHermesWorkspaceMarkdown(index): string`

- [ ] **Step 1: Write failing tests for path display and entry construction**

Add this to `src/tests/hermes.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import {
  HERMES_PROJECT_FILE,
  HERMES_WORKSPACE_INDEX,
  displayPath,
  projectToHermesEntry,
  renderHermesProjectMarkdown,
  renderHermesWorkspaceMarkdown
} from "../hermes.js";

test("Hermes path display compresses home paths", () => {
  const homeProject = path.join(os.homedir(), "IdeaProjects", "demo");
  assert.equal(displayPath(homeProject), "~/IdeaProjects/demo");
});

test("Hermes project entry includes only existing agent entrypoints", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-entry-"));
  try {
    await writeFile(path.join(dir, "README.md"), "# Demo\n", "utf8");
    await writeFile(path.join(dir, "AGENTS.md"), "# Agents\n", "utf8");
    const profile = await analyzeProject({ rootPath: dir, skillPaths: [] });
    const entry = await projectToHermesEntry(profile, {
      projectFile: HERMES_PROJECT_FILE,
      updatedAt: "2026-06-30T00:00:00.000Z"
    });

    assert.equal(entry.rootPath, path.resolve(dir));
    assert.equal(entry.status, "available");
    assert.equal(entry.projectFile, ".hermes.md");
    assert.deepEqual(entry.agentEntrypoints.sort(), ["AGENTS.md", "README.md"].sort());
    assert.equal(entry.updatedAt, "2026-06-30T00:00:00.000Z");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("Hermes renderers emit managed blocks and workspace index JSON", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-render-"));
  try {
    const profile = await analyzeProject({ rootPath: dir, skillPaths: [] });
    const projectMarkdown = renderHermesProjectMarkdown(profile, {
      workspaceIndexPath: path.join(os.homedir(), "HermesWorkspace", HERMES_WORKSPACE_INDEX)
    });
    assert.match(projectMarkdown, /target=hermes/);
    assert.match(projectMarkdown, /Workspace index:/);
    assert.match(projectMarkdown, /\.hermes\/config\.yaml are managed by Hermes/);

    const entry = await projectToHermesEntry(profile, {
      projectFile: HERMES_PROJECT_FILE,
      updatedAt: "2026-06-30T00:00:00.000Z"
    });
    const workspaceMarkdown = renderHermesWorkspaceMarkdown({ schemaVersion: 1, projects: [entry] });
    assert.match(workspaceMarkdown, /target=hermes-workspace/);
    assert.match(workspaceMarkdown, /agent-workflow-scaffold:hermes-workspace-index/);
    assert.match(workspaceMarkdown, /Registered Projects/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL because `src/hermes.ts` and helpers do not exist.

- [ ] **Step 2: Implement minimal Hermes model and renderers**

Create `src/hermes.ts` with:

```ts
import { readdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { ProjectProfile, ProjectManifestInfo } from "./types.js";
import { pathExists } from "./utils/fs.js";
import { markdownBlock } from "./generators/helpers.js";

export const HERMES_PROJECT_FILE = ".hermes.md";
export const HERMES_WORKSPACE_INDEX = "HERMES.md";
export const DEFAULT_HERMES_WORKSPACE = path.join(os.homedir(), "HermesWorkspace");
export const HERMES_WORKSPACE_SCHEMA_VERSION = 1;

export type HermesProjectStatus = "available" | "missing";

export interface HermesWorkspaceProject {
  rootPath: string;
  projectId: string;
  displayName: string;
  projectType: string;
  confidence: ProjectProfile["confidence"];
  isEmptyProject: boolean;
  status: HermesProjectStatus;
  manifests: ProjectManifestInfo[];
  commands: ProjectProfile["commands"];
  projectFile: typeof HERMES_PROJECT_FILE | null;
  agentEntrypoints: string[];
  updatedAt: string;
}

export interface HermesWorkspaceIndex {
  schemaVersion: 1;
  projects: HermesWorkspaceProject[];
}

const AGENT_ENTRYPOINT_CANDIDATES = [
  HERMES_PROJECT_FILE,
  "AGENTS.md",
  "CLAUDE.md",
  ".trae/AGENTS.md",
  ".codex/config.toml",
  ".claude/settings.json",
  ".agent-workflow/manifest.json",
  "README.md"
];

export function normalizeHermesPath(inputPath: string): string {
  return path.resolve(inputPath);
}

export function displayPath(inputPath: string): string {
  const absolute = path.resolve(inputPath);
  const home = os.homedir();
  const relative = path.relative(home, absolute);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return `~/${relative.split(path.sep).join("/")}`;
  }
  if (absolute === home) {
    return "~";
  }
  return absolute.split(path.sep).join("/");
}

export async function projectToHermesEntry(
  profile: ProjectProfile,
  options: { projectFile: typeof HERMES_PROJECT_FILE | null; updatedAt: string }
): Promise<HermesWorkspaceProject> {
  const agentEntrypoints: string[] = [];
  for (const candidate of AGENT_ENTRYPOINT_CANDIDATES) {
    if (await pathExists(path.join(profile.rootPath, candidate))) {
      agentEntrypoints.push(candidate);
    }
  }
  return {
    rootPath: normalizeHermesPath(profile.rootPath),
    projectId: profile.projectId,
    displayName: profile.displayName,
    projectType: profile.projectType,
    confidence: profile.confidence,
    isEmptyProject: profile.isEmptyProject,
    status: "available",
    manifests: profile.manifests,
    commands: profile.commands,
    projectFile: options.projectFile,
    agentEntrypoints,
    updatedAt: options.updatedAt
  };
}

function formatCommandList(commands: string[] | undefined): string {
  return commands?.length ? commands.map((command) => `\`${command}\``).join(", ") : "none detected";
}

export function renderHermesProjectMarkdown(
  profile: ProjectProfile,
  options: { workspaceIndexPath?: string } = {}
): string {
  const body = [
    `# ${profile.displayName} Hermes Context`,
    "",
    "## Project Profile",
    `- Project: ${profile.displayName}`,
    `- Root: ${displayPath(profile.rootPath)}`,
    `- Type: ${profile.projectType}`,
    `- Confidence: ${profile.confidence}`,
    `- Empty project: ${profile.isEmptyProject ? "yes" : "no"}`,
    `- Manifests: ${profile.manifests.map((manifest) => `${manifest.type}:${manifest.path}`).join(", ") || "none detected"}`,
    ...(options.workspaceIndexPath ? [`- Workspace index: ${displayPath(options.workspaceIndexPath)}`] : []),
    "",
    "## Read First",
    "- `.hermes.md`",
    "- `AGENTS.md` when present",
    "- `CLAUDE.md` when present",
    "- `.trae/AGENTS.md` when present",
    "- `README.md` and project docs when present",
    "",
    "## Useful Commands",
    profile.commands.install ? `- Install: \`${profile.commands.install}\`` : "- Install: none detected",
    `- Dev: ${formatCommandList(profile.commands.dev)}`,
    `- Build: ${formatCommandList(profile.commands.build)}`,
    `- Test: ${formatCommandList(profile.commands.test)}`,
    `- Lint: ${formatCommandList(profile.commands.lint)}`,
    "",
    "## Boundaries",
    "- Treat this directory as the project boundary unless the Hermes workspace index explicitly links another project.",
    "- Preserve user changes and existing agent-workflow managed blocks.",
    "- Do not write secrets, Hermes global config, sessions, or runtime state from this project context.",
    "- Hermes runtime installation and `~/.hermes/config.yaml` are managed by Hermes, not by this scaffold.",
    ...(profile.isEmptyProject || profile.confidence === "low"
      ? ["- This project currently has low-confidence profile evidence. Re-run `agent-workflow hermes register` after adding manifest, docs, or source files."]
      : [])
  ].join("\n");

  return `${markdownBlock("hermes", body)}\n`;
}

export function renderHermesWorkspaceMarkdown(index: HermesWorkspaceIndex): string {
  const projects = [...index.projects].sort((left, right) => left.displayName.localeCompare(right.displayName));
  const json = JSON.stringify({ schemaVersion: HERMES_WORKSPACE_SCHEMA_VERSION, projects }, null, 2);
  const tableRows = projects.map((project) => {
    const commandKinds = ["test", "build", "lint", "dev"].filter((kind) => (project.commands[kind as keyof typeof project.commands] as string[] | undefined)?.length);
    return `| ${project.displayName} | ${project.status} | ${project.projectType} | ${project.confidence} | \`${displayPath(project.rootPath)}\` | ${commandKinds.join(", ") || "none detected"} |`;
  });
  const body = [
    "# Hermes Workspace",
    "",
    "<!-- agent-workflow-scaffold:hermes-workspace-index",
    json,
    "-->",
    "",
    "## Registered Projects",
    "",
    "| Project | Status | Type | Confidence | Root | Commands |",
    "| --- | --- | --- | --- | --- | --- |",
    ...tableRows,
    "",
    "## Coordination Rules",
    "",
    "- Use each project's `.hermes.md` before editing that project.",
    "- Treat project roots as separate boundaries.",
    "- Do not write secrets or Hermes global config from this workspace index.",
    "- Prefer the smallest project-local verification command.",
    "- Hermes runtime installation and `~/.hermes/config.yaml` are managed by Hermes, not by this scaffold."
  ].join("\n");

  return `${markdownBlock("hermes-workspace", body)}\n`;
}
```

If TypeScript rejects `markdownBlock("hermes", ...)` because `AgentTarget` is too narrow, change `markdownBlock` in `src/generators/helpers.ts` to accept `string` instead of `AgentTarget` and verify existing callers still compile.

- [ ] **Step 3: Run tests**

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: PASS for the new renderer tests.

- [ ] **Step 4: Commit**

```bash
git add src/hermes.ts src/utils/format.ts src/generators/helpers.ts src/tests/hermes.test.ts
git commit -m "feat: add hermes workspace renderers"
```

## Task 2: Workspace Index Parsing and Merge

**Files:**
- Modify: `src/hermes.ts`
- Test: `src/tests/hermes.test.ts`

**Interfaces:**
- Produces: `parseHermesWorkspaceIndex(markdown: string): HermesWorkspaceIndex | undefined`
- Produces: `mergeHermesWorkspaceProjects(existing, incoming): Promise<HermesWorkspaceIndex>`
- Produces: `isHermesWorkspaceIndexCorrupt(error): boolean` only if needed for CLI error handling.

- [ ] **Step 1: Write failing tests for parsing, corruption, merge, and missing status**

Append:

```ts
import { parseHermesWorkspaceIndex, mergeHermesWorkspaceProjects } from "../hermes.js";

test("Hermes workspace parser reads versioned JSON comment", () => {
  const markdown = [
    "<!-- agent-workflow-scaffold:start target=hermes-workspace scaffoldVersion=0.0.22 schemaVersion=1 -->",
    "<!-- agent-workflow-scaffold:hermes-workspace-index",
    JSON.stringify({ schemaVersion: 1, projects: [] }, null, 2),
    "-->",
    "<!-- agent-workflow-scaffold:end target=hermes-workspace -->"
  ].join("\n");

  assert.deepEqual(parseHermesWorkspaceIndex(markdown), { schemaVersion: 1, projects: [] });
});

test("Hermes workspace parser fails fast on corrupted JSON", () => {
  assert.throws(
    () => parseHermesWorkspaceIndex("<!-- agent-workflow-scaffold:hermes-workspace-index\n{\n-->"),
    /Hermes workspace index is corrupted/
  );
});

test("Hermes workspace merge dedupes by rootPath and marks missing old projects", async () => {
  const existingRoot = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-existing-"));
  const missingRoot = path.join(os.tmpdir(), "agent-workflow-hermes-missing-project");
  try {
    const incomingRoot = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-incoming-"));
    try {
      const existing = {
        schemaVersion: 1 as const,
        projects: [
          {
            rootPath: path.resolve(existingRoot),
            projectId: "existing",
            displayName: "existing",
            projectType: "custom",
            confidence: "medium" as const,
            isEmptyProject: false,
            status: "available" as const,
            manifests: [],
            commands: {},
            projectFile: ".hermes.md" as const,
            agentEntrypoints: [],
            updatedAt: "2026-06-29T00:00:00.000Z"
          },
          {
            rootPath: path.resolve(missingRoot),
            projectId: "missing",
            displayName: "missing",
            projectType: "custom",
            confidence: "low" as const,
            isEmptyProject: true,
            status: "available" as const,
            manifests: [],
            commands: {},
            projectFile: ".hermes.md" as const,
            agentEntrypoints: [],
            updatedAt: "2026-06-29T00:00:00.000Z"
          }
        ]
      };
      const incoming = {
        ...existing.projects[0],
        rootPath: path.resolve(incomingRoot),
        projectId: "incoming",
        displayName: "incoming",
        updatedAt: "2026-06-30T00:00:00.000Z"
      };

      const merged = await mergeHermesWorkspaceProjects(existing, incoming);
      assert.equal(merged.projects.length, 3);
      assert.equal(merged.projects.find((project) => project.rootPath === path.resolve(missingRoot))?.status, "missing");
      assert.equal(merged.projects.find((project) => project.rootPath === path.resolve(incomingRoot))?.status, "available");
    } finally {
      await rm(incomingRoot, { recursive: true, force: true });
    }
  } finally {
    await rm(existingRoot, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL because parser/merge functions do not exist.

- [ ] **Step 2: Implement parser and merge**

Add to `src/hermes.ts`:

```ts
const WORKSPACE_INDEX_PATTERN = /<!-- agent-workflow-scaffold:hermes-workspace-index\s*([\s\S]*?)\s*-->/;

export function parseHermesWorkspaceIndex(markdown: string): HermesWorkspaceIndex | undefined {
  const match = WORKSPACE_INDEX_PATTERN.exec(markdown);
  if (!match) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(match[1]) as HermesWorkspaceIndex;
    if (parsed.schemaVersion !== HERMES_WORKSPACE_SCHEMA_VERSION || !Array.isArray(parsed.projects)) {
      throw new Error("invalid schema");
    }
    return parsed;
  } catch (error) {
    throw new Error("Hermes workspace index is corrupted: failed to parse managed project index.");
  }
}

export async function mergeHermesWorkspaceProjects(
  existing: HermesWorkspaceIndex | undefined,
  incoming: HermesWorkspaceProject
): Promise<HermesWorkspaceIndex> {
  const byRoot = new Map<string, HermesWorkspaceProject>();
  for (const project of existing?.projects ?? []) {
    const rootPath = normalizeHermesPath(project.rootPath);
    byRoot.set(rootPath, {
      ...project,
      rootPath,
      status: (await pathExists(rootPath)) ? "available" : "missing"
    });
  }
  byRoot.set(incoming.rootPath, { ...incoming, status: "available" });
  return {
    schemaVersion: HERMES_WORKSPACE_SCHEMA_VERSION,
    projects: Array.from(byRoot.values()).sort((left, right) => left.displayName.localeCompare(right.displayName))
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hermes.ts src/tests/hermes.test.ts
git commit -m "feat: merge hermes workspace index"
```

## Task 3: Register and Init-Project Write Plans

**Files:**
- Modify: `src/hermes.ts`
- Modify: `src/manifest.ts`
- Test: `src/tests/hermes.test.ts`

**Interfaces:**
- Produces: `HermesRegisterOptions`
- Produces: `HermesInitProjectOptions`
- Produces: `HermesWritePlan`
- Produces: `planHermesRegister(options): Promise<HermesWritePlan>`
- Produces: `writeHermesRegister(options): Promise<HermesWriteResult>`
- Produces: `planHermesInitProject(options): Promise<HermesWritePlan>`
- Produces: `writeHermesInitProject(options): Promise<HermesWriteResult>`

- [ ] **Step 1: Write failing tests for register, dry-run, no-project-file, and init-project**

Append:

```ts
import { readFile } from "node:fs/promises";
import { MANIFEST_PATH, readManifest } from "../manifest.js";
import {
  planHermesRegister,
  writeHermesRegister,
  writeHermesInitProject
} from "../hermes.js";

test("Hermes register writes workspace index, project file, and manifest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-project-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-workspace-"));
  try {
    await writeFile(path.join(root, "README.md"), "# Project\n", "utf8");
    const result = await writeHermesRegister({
      rootPath: root,
      workspacePath: workspace,
      dryRun: false,
      projectFile: true,
      updatedAt: "2026-06-30T00:00:00.000Z"
    });

    assert.equal(result.writes.some((item) => item.relativePath === HERMES_PROJECT_FILE), true);
    assert.equal(result.workspaceIndexPath, path.join(path.resolve(workspace), HERMES_WORKSPACE_INDEX));
    assert.match(await readFile(path.join(workspace, HERMES_WORKSPACE_INDEX), "utf8"), /hermes-workspace-index/);
    assert.match(await readFile(path.join(root, HERMES_PROJECT_FILE), "utf8"), /Workspace index:/);
    const manifest = await readManifest(root);
    assert.equal(manifest?.enabledFeatures.hermes, true);
    assert.equal(manifest?.featureOptions?.hermes?.workspacePath, path.resolve(workspace));
    assert.equal(manifest?.featureOptions?.hermes?.projectFile, HERMES_PROJECT_FILE);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes register dry-run does not create missing workspace", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-dry-root-"));
  const workspace = path.join(os.tmpdir(), `agent-workflow-hermes-dry-workspace-${Date.now()}`);
  try {
    const plan = await planHermesRegister({
      rootPath: root,
      workspacePath: workspace,
      dryRun: true,
      projectFile: true,
      updatedAt: "2026-06-30T00:00:00.000Z"
    });

    assert.equal(plan.dryRun, true);
    assert.equal(await import("../utils/fs.js").then(({ pathExists }) => pathExists(workspace)), false);
    assert.ok(plan.actions.some((action) => action.path.endsWith(HERMES_WORKSPACE_INDEX) && action.action === "create"));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes register no-project-file skips .hermes.md but writes manifest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-no-file-root-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-no-file-workspace-"));
  try {
    await writeHermesRegister({
      rootPath: root,
      workspacePath: workspace,
      dryRun: false,
      projectFile: false,
      updatedAt: "2026-06-30T00:00:00.000Z"
    });

    assert.equal(await import("../utils/fs.js").then(({ pathExists }) => pathExists(path.join(root, HERMES_PROJECT_FILE))), false);
    const manifest = await readManifest(root);
    assert.equal(manifest?.enabledFeatures.hermes, true);
    assert.equal(manifest?.featureOptions?.hermes?.projectFile, null);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes init-project writes only project file and manifest", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-init-root-"));
  try {
    await writeHermesInitProject({
      rootPath: root,
      dryRun: false,
      updatedAt: "2026-06-30T00:00:00.000Z"
    });

    assert.match(await readFile(path.join(root, HERMES_PROJECT_FILE), "utf8"), /target=hermes/);
    const manifest = await readManifest(root);
    assert.equal(manifest?.enabledFeatures.hermes, true);
    assert.equal(manifest?.featureOptions?.hermes?.workspacePath, undefined);
    assert.equal(manifest?.featureOptions?.hermes?.projectFile, HERMES_PROJECT_FILE);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL because write plan functions and manifest fields do not exist.

- [ ] **Step 2: Extend manifest type and helper**

Modify `src/manifest.ts`:

```ts
export interface HermesOptions {
  workspacePath?: string;
  workspaceIndex?: "HERMES.md";
  projectFile?: ".hermes.md" | null;
}
```

Extend `AgentWorkflowManifest`:

```ts
enabledFeatures: {
  loopEngineering?: boolean;
  headroom?: boolean;
  hermes?: boolean;
};
featureOptions?: {
  headroom?: HeadroomOptions;
  hermes?: HermesOptions;
};
```

Add:

```ts
export function buildHermesManifest(input: {
  projectId: string;
  existingManifest?: AgentWorkflowManifest;
  hermes: HermesOptions;
}): AgentWorkflowManifest {
  const existing = input.existingManifest;
  return {
    scaffoldVersion: SCAFFOLD_VERSION,
    schemaVersion: SCHEMA_VERSION,
    projectId: input.projectId,
    targets: existing?.targets ?? [],
    enabledFeatures: {
      ...(existing?.enabledFeatures ?? {}),
      hermes: true
    },
    featureOptions: {
      ...(existing?.featureOptions ?? {}),
      hermes: input.hermes
    },
    managedFiles: Array.from(new Set([...(existing?.managedFiles ?? []), ...(input.hermes.projectFile ? [input.hermes.projectFile] : []), MANIFEST_PATH])).sort(),
    ...(existing?.lastBackupPath ? { lastBackupPath: existing.lastBackupPath } : {})
  };
}
```

- [ ] **Step 3: Implement write planning and writing**

In `src/hermes.ts`, add:

```ts
import { mkdir, readFile } from "node:fs/promises";
import { analyzeProject } from "./analyzers/projectAnalyzer.js";
import { buildHermesManifest, HERMES_WORKSPACE_INDEX, MANIFEST_PATH, manifestFile, readManifest } from "./manifest.js";
import { materializeFile, writeGeneratedFiles } from "./writer/fileWriter.js";
import type { GeneratedFile, WriteResult } from "./types.js";
import { readTextIfExists, writeTextFile, ensureDirectory } from "./utils/fs.js";

export interface HermesRegisterOptions {
  rootPath?: string;
  workspacePath?: string;
  dryRun?: boolean;
  projectFile?: boolean;
  updatedAt?: string;
}

export interface HermesInitProjectOptions {
  rootPath?: string;
  dryRun?: boolean;
  updatedAt?: string;
}

export interface HermesPlannedAction {
  path: string;
  action: "create" | "update" | "unchanged" | "skip";
}

export interface HermesWritePlan {
  dryRun: boolean;
  rootPath: string;
  workspacePath?: string;
  workspaceIndexPath?: string;
  project: HermesWorkspaceProject;
  warnings: string[];
  actions: HermesPlannedAction[];
  files: GeneratedFile[];
}

export interface HermesWriteResult extends HermesWritePlan {
  writes: WriteResult[];
}
```

Implement:

- Resolve `rootPath` using existing `resolveRootPath()`.
- Fail fast if root does not exist.
- For register, resolve workspace path from option or `DEFAULT_HERMES_WORKSPACE`.
- Fail fast if root and workspace normalize to same path.
- Read existing workspace `HERMES.md` if present; parse existing index.
- Merge incoming project entry and mark missing old entries.
- Build generated files:
  - workspace file as `GeneratedFile`-like object written outside root by direct path helper, or use a dedicated write function because workspace is outside project root.
  - project `.hermes.md` unless `projectFile === false`.
  - manifest file using `buildHermesManifest()`.
- For project files, use `writeGeneratedFiles(rootPath, files)`.
- For workspace file, use `applyManagedText(existing, renderHermesWorkspaceMarkdown(index))` and `writeTextFile()`.
- In dry-run, do not call `ensureDirectory()` or `writeTextFile()`.
- Planned actions compare existing vs materialized content.

Keep workspace writing local to `src/hermes.ts`; do not bypass containment for normal generated project files.

- [ ] **Step 4: Run tests**

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hermes.ts src/manifest.ts src/tests/hermes.test.ts
git commit -m "feat: write hermes registration files"
```

## Task 4: Fail-Fast Safety and Managed Block Corruption

**Files:**
- Modify: `src/writer/managedBlock.ts`
- Modify: `src/hermes.ts`
- Test: `src/tests/hermes.test.ts`

**Interfaces:**
- Produces: `assertManagedBlockSafeForTarget(content, target): void`

- [ ] **Step 1: Write failing safety tests**

Append:

```ts
test("Hermes register fails fast when root is missing", async () => {
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-missing-root-workspace-"));
  try {
    await assert.rejects(
      () => writeHermesRegister({
        rootPath: path.join(os.tmpdir(), "agent-workflow-hermes-missing-root"),
        workspacePath: workspace,
        dryRun: false,
        projectFile: true
      }),
      /Hermes project root does not exist/
    );
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes register fails fast when root equals workspace", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-same-root-"));
  try {
    await assert.rejects(
      () => writeHermesRegister({
        rootPath: root,
        workspacePath: root,
        dryRun: false,
        projectFile: true
      }),
      /Hermes workspace and project root must be different/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Hermes project file append preserves handwritten content", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-handwritten-"));
  try {
    await writeFile(path.join(root, HERMES_PROJECT_FILE), "# User Hermes Notes\n", "utf8");
    await writeHermesInitProject({ rootPath: root, dryRun: false });
    const text = await readFile(path.join(root, HERMES_PROJECT_FILE), "utf8");
    assert.match(text, /# User Hermes Notes/);
    assert.match(text, /target=hermes/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Hermes project file fails fast on unsafe managed block boundary", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-corrupt-project-"));
  try {
    await writeFile(
      path.join(root, HERMES_PROJECT_FILE),
      "<!-- agent-workflow-scaffold:start target=hermes scaffoldVersion=0.0.22 schemaVersion=1 -->\nmissing end\n",
      "utf8"
    );
    await assert.rejects(
      () => writeHermesInitProject({ rootPath: root, dryRun: false }),
      /Unsafe or corrupted managed block/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL until safety checks exist.

- [ ] **Step 2: Implement strict managed block safety helper**

In `src/writer/managedBlock.ts`, add:

```ts
export function assertManagedBlockSafeForTarget(content: string | undefined, target: string): void {
  if (!content || !content.includes(`agent-workflow-scaffold:start`)) {
    return;
  }
  const startPattern = new RegExp(`agent-workflow-scaffold:start [^\\n>]*target=${target}(?:\\s|[^A-Za-z-])`);
  if (!startPattern.test(content)) {
    return;
  }
  const safePattern = blockPattern(target);
  if (!safePattern.test(content)) {
    throw new Error(`Unsafe or corrupted managed block for target ${target}. Fix the block boundaries before retrying.`);
  }
}
```

If `blockPattern` global state causes repeated `.test()` issues, return a fresh regex each time and avoid sharing instances.

Call this helper before applying managed text to `.hermes.md` and workspace `HERMES.md`.

- [ ] **Step 3: Run tests**

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/writer/managedBlock.ts src/hermes.ts src/tests/hermes.test.ts
git commit -m "fix: fail fast on corrupt hermes blocks"
```

## Task 5: Hermes Doctor and List

**Files:**
- Modify: `src/hermes.ts`
- Test: `src/tests/hermes.test.ts`

**Interfaces:**
- Produces: `HermesDoctorIssue`
- Produces: `HermesDoctorResult`
- Produces: `doctorHermes(options): Promise<HermesDoctorResult>`
- Produces: `listHermesWorkspace(options): Promise<HermesWorkspaceIndex>`

- [ ] **Step 1: Write failing doctor/list tests**

Append:

```ts
import { doctorHermes, listHermesWorkspace } from "../hermes.js";

test("Hermes doctor passes after register and reports runtime info", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-doctor-root-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-doctor-workspace-"));
  try {
    await writeHermesRegister({ rootPath: root, workspacePath: workspace, dryRun: false, projectFile: true });
    const result = await doctorHermes({ rootPath: root, workspacePath: workspace });

    assert.equal(result.ok, true);
    assert.equal(result.issues.some((issue) => issue.level === "error"), false);
    assert.ok(result.issues.some((issue) => issue.level === "info" && issue.message.includes("not checked by this scaffold")));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test("Hermes doctor errors when project file is missing after init-project", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-doctor-missing-file-"));
  try {
    await writeHermesInitProject({ rootPath: root, dryRun: false });
    await rm(path.join(root, HERMES_PROJECT_FILE), { force: true });
    const result = await doctorHermes({ rootPath: root });

    assert.equal(result.ok, false);
    assert.ok(result.issues.some((issue) => issue.level === "error" && issue.message.includes(".hermes.md is missing")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Hermes doctor does not require workspace for init-project state", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-doctor-no-workspace-"));
  try {
    await writeHermesInitProject({ rootPath: root, dryRun: false });
    const result = await doctorHermes({ rootPath: root });

    assert.equal(result.ok, true);
    assert.ok(result.issues.some((issue) => issue.level === "info" && issue.message.includes("No Hermes workspace is recorded")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Hermes list reads workspace projects and missing paths do not fail", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-list-root-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-list-workspace-"));
  try {
    await writeHermesRegister({ rootPath: root, workspacePath: workspace, dryRun: false, projectFile: true });
    await rm(root, { recursive: true, force: true });
    const index = await listHermesWorkspace({ workspacePath: workspace });

    assert.equal(index.projects.length, 1);
    assert.equal(index.projects[0].status, "missing");
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: FAIL because doctor/list functions do not exist.

- [ ] **Step 2: Implement doctor/list**

In `src/hermes.ts`:

```ts
export interface HermesDoctorIssue {
  level: "error" | "warning" | "info";
  relativePath: string;
  message: string;
}

export interface HermesDoctorResult {
  ok: boolean;
  rootPath: string;
  workspacePath?: string;
  issues: HermesDoctorIssue[];
}
```

Doctor rules:

- Error if manifest missing Hermes enabled.
- If manifest `projectFile === ".hermes.md"`, error if file missing or no `target=hermes` managed block.
- If manifest `projectFile === null`, skip project file error and add info.
- If manifest has `workspacePath`, check `<workspacePath>/HERMES.md`, `target=hermes-workspace` block, parse index, and current normalized root entry.
- If CLI provides `--workspace` but manifest has no workspace, warning.
- Missing old projects in workspace index are warning.
- Low confidence or empty project are warning.
- Always add info that Hermes runtime and `~/.hermes/config.yaml` are not checked.

List rules:

- Resolve workspace default or option.
- Error if workspace or `HERMES.md` missing.
- Error if no managed index or parse fails.
- Mark projects missing/available before returning.

- [ ] **Step 3: Run tests**

Run: `npm run build && node --test dist/tests/hermes.test.js`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/hermes.ts src/tests/hermes.test.ts
git commit -m "feat: add hermes doctor and list"
```

## Task 6: CLI Commands and Help

**Files:**
- Modify: `src/cli.ts`
- Modify: `src/index.ts`
- Test: `src/tests/cliHelp.test.ts`

**Interfaces:**
- Produces: `agent-workflow hermes register`
- Produces: `agent-workflow hermes init-project`
- Produces: `agent-workflow hermes doctor`
- Produces: `agent-workflow hermes list`

- [ ] **Step 1: Write failing CLI tests**

Add to `src/tests/cliHelp.test.ts`:

```ts
test("hermes help output documents explicit subcommands", async () => {
  const output = await runCli(["hermes", "-h"]);

  assert.match(output, /agent-workflow hermes/);
  assert.match(output, /register/);
  assert.match(output, /init-project/);
  assert.match(output, /doctor/);
  assert.match(output, /list/);
  assert.match(output, /HermesWorkspace/);
  assert.match(output, /does not install or start Hermes/);
});

test("hermes register dry-run previews without writing", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-root-"));
  const workspace = path.join(os.tmpdir(), `agent-workflow-cli-hermes-workspace-${Date.now()}`);
  try {
    const output = await runCli(["hermes", "register", "--root", root, "--workspace", workspace, "--dry-run"]);

    assert.match(output, /Hermes register dry-run/);
    assert.match(output, /Workspace:/);
    assert.match(output, /Project:/);
    assert.match(output, /Registered project:/);
    assert.equal(await import("node:fs/promises").then(({ access }) => access(workspace).then(() => true, () => false)), false);
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});

test("hermes init-project writes project context", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-init-"));
  try {
    const output = await runCli(["hermes", "init-project", "--root", root]);
    assert.match(output, /Hermes project context written/);
    assert.equal(await import("node:fs/promises").then(({ access }) => access(path.join(root, ".hermes.md")).then(() => true, () => false)), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hermes doctor exits non-zero on missing setup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-doctor-missing-"));
  try {
    const result = await runCliFailure(["hermes", "doctor", "--root", root]);
    assert.equal(result.code, 1);
    assert.match(result.stdout, /Hermes doctor: issues found/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("hermes list prints registered projects", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-list-root-"));
  const workspace = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-hermes-list-workspace-"));
  try {
    await runCli(["hermes", "register", "--root", root, "--workspace", workspace]);
    const output = await runCli(["hermes", "list", "--workspace", workspace]);
    assert.match(output, /Hermes workspace:/);
    assert.match(output, /available/);
    assert.match(output, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    await rm(root, { recursive: true, force: true });
    await rm(workspace, { recursive: true, force: true });
  }
});
```

Run: `npm run build && node --test dist/tests/cliHelp.test.js`

Expected: FAIL because CLI does not dispatch Hermes.

- [ ] **Step 2: Implement CLI help and dispatch**

In `src/cli.ts`:

- Import Hermes helpers.
- Add `printHermesHelp()`.
- Update top-level help command list and examples.
- Add `case "hermes": await runHermes(args); break;`.
- In `runHermes(args)`:
  - Parse subcommand from `args.positionals[0]`.
  - `register`: call `planHermesRegister` for dry-run or `writeHermesRegister` otherwise.
  - `init-project`: call `planHermesInitProject` for dry-run or `writeHermesInitProject` otherwise.
  - `doctor`: call `doctorHermes`; set `process.exitCode = 1` if not ok.
  - `list`: call `listHermesWorkspace`.
  - Unknown subcommand: print help and exit 1.
- Reuse `flagString(args.flags, "root")`, `flagString(args.flags, "workspace")`, `Boolean(args.flags["dry-run"])`, and `Boolean(args.flags["no-project-file"])`.

Required output styles:

```text
Hermes register dry-run
Workspace:
- create ~/HermesWorkspace/HERMES.md
Project:
- create ~/IdeaProjects/foo/.hermes.md
- update ~/IdeaProjects/foo/.agent-workflow/manifest.json
Registered project:
- Project: foo
- Root: ~/IdeaProjects/foo
- Confidence: low
- Status: available
```

For non-dry-run:

```text
Hermes register complete
Workspace: ~/HermesWorkspace/HERMES.md
Project: ~/IdeaProjects/foo
- created .hermes.md
- updated .agent-workflow/manifest.json
```

- [ ] **Step 3: Export helpers if needed**

In `src/index.ts`, export:

```ts
export {
  doctorHermes,
  listHermesWorkspace,
  planHermesInitProject,
  planHermesRegister,
  writeHermesInitProject,
  writeHermesRegister
} from "./hermes.js";
export type {
  HermesDoctorIssue,
  HermesDoctorResult,
  HermesWorkspaceIndex,
  HermesWorkspaceProject
} from "./hermes.js";
```

- [ ] **Step 4: Run CLI tests**

Run: `npm run build && node --test dist/tests/cliHelp.test.js dist/tests/hermes.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli.ts src/index.ts src/tests/cliHelp.test.ts
git commit -m "feat: add hermes cli commands"
```

## Task 7: Docs, Version, and Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/cli-zh.md`
- Modify: `docs/workflow-scaffold-evolution-plan.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/version.ts`

**Interfaces:**
- Produces: version `0.0.22`

- [ ] **Step 1: Update versions**

Set:

```json
"version": "0.0.22"
```

in `package.json` and package lock root/package entry.

Set:

```ts
export const SCAFFOLD_VERSION = "0.0.22";
```

in `src/version.ts`.

- [ ] **Step 2: Update CHANGELOG**

Add:

```markdown
## [0.0.22] - 2026-06-30

### Added

- 新增 `agent-workflow hermes register`，将当前项目注册到电脑级 Hermes workspace 索引。
- 新增 `agent-workflow hermes init-project`，只生成项目本地 `.hermes.md` 和 manifest Hermes 状态。
- 新增 `agent-workflow hermes doctor` 和 `agent-workflow hermes list`，用于检查和查看 workspace 项目索引。

### Changed

- manifest 支持记录 Hermes feature 状态和 workspace/project file 选项。

### Docs

- README、中文 CLI 手册和长期维护方案补充 Hermes 不是 target、不写 `~/.hermes/config.yaml`、不安装/启动 runtime、默认 workspace 和 dry-run 行为。

### Tests

- 增加 Hermes workspace merge、project context、manifest、doctor、list 和 CLI 回归测试。
```

- [ ] **Step 3: Update README**

Add a Hermes section that states:

- Hermes is computer-level workspace registration, not target.
- Commands:
  ```bash
  agent-workflow hermes register
  agent-workflow hermes register --workspace ~/HermesWorkspace --root /path/to/project
  agent-workflow hermes register --dry-run
  agent-workflow hermes init-project
  agent-workflow hermes doctor
  agent-workflow hermes list
  ```
- Default workspace is `~/HermesWorkspace/HERMES.md`.
- Project file is `.hermes.md`.
- `register`/`init-project` default to writing and do not require `--write`.
- `--dry-run` previews only.
- It does not write `~/.hermes/config.yaml`, install/start Hermes, check runtime, generate MCP, or modify Codex/Claude/Trae config.

- [ ] **Step 4: Update `docs/cli-zh.md`**

Add command reference for the four Hermes subcommands with the same boundaries as README. Make clear `~/HermesWorkspace` is scaffold-created workspace index storage, not Hermes official config directory.

- [ ] **Step 5: Update `docs/workflow-scaffold-evolution-plan.md`**

Mark Hermes workspace registration as implemented in current capabilities and note that future work may include unregister/prune/MCP tools only after separate design.

- [ ] **Step 6: Run full verification**

Run:

```bash
npm run check
npm_config_cache=/tmp/agent-workflow-npm-cache npm pack --dry-run
```

Expected:

- `npm run check` passes all tests.
- Dry pack reports `@tungee/agent-workflow-scaffold@0.0.22` and includes docs/dist/package.

- [ ] **Step 7: Commit**

```bash
git add README.md docs/cli-zh.md docs/workflow-scaffold-evolution-plan.md CHANGELOG.md package.json package-lock.json src/version.ts
git commit -m "docs: document hermes workspace registration"
```

## Self-Review Checklist

- [ ] No code path treats Hermes as `AgentTarget`.
- [ ] No `setup --hermes`, `init --hermes`, `generate --hermes`, or interactive Hermes prompt exists.
- [ ] No code writes `~/.hermes/`.
- [ ] No code installs, starts, stops, or checks Hermes runtime.
- [ ] `register --dry-run` does not create workspace directories.
- [ ] `register` fails when root is missing.
- [ ] `register` creates missing workspace directories.
- [ ] `register` fails when root and workspace are the same normalized path.
- [ ] Existing workspace projects are merged by normalized absolute `rootPath`.
- [ ] Missing old projects are retained as `missing`.
- [ ] Corrupted workspace JSON fails fast.
- [ ] `.hermes.md` uses target `hermes` and managed block append/update semantics.
- [ ] Workspace `HERMES.md` uses target `hermes-workspace` and versioned JSON comment.
- [ ] Manifest records Hermes state for `register` and `init-project`.
- [ ] `doctor` sets non-zero exit only for error-level findings.
- [ ] `list` is read-only and fails if workspace/index is absent or corrupted.

