import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import {
  HERMES_PROJECT_FILE,
  HERMES_WORKSPACE_INDEX,
  displayPath,
  doctorHermes,
  listHermesWorkspace,
  mergeHermesWorkspaceProjects,
  parseHermesWorkspaceIndex,
  planHermesRegister,
  projectToHermesEntry,
  renderHermesProjectMarkdown,
  renderHermesWorkspaceMarkdown,
  writeHermesInitProject,
  writeHermesRegister
} from "../hermes.js";
import { readManifest } from "../manifest.js";
import { pathExists } from "../utils/fs.js";

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
    assert.match(projectMarkdown, /\.hermes\/config\.yaml` are managed by Hermes/);

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
  const incomingRoot = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-hermes-incoming-"));
  const missingRoot = path.join(os.tmpdir(), "agent-workflow-hermes-missing-project");
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
    await rm(existingRoot, { recursive: true, force: true });
    await rm(incomingRoot, { recursive: true, force: true });
  }
});

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
    assert.equal(await pathExists(workspace), false);
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

    assert.equal(await pathExists(path.join(root, HERMES_PROJECT_FILE)), false);
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
