import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import {
  HERMES_PROJECT_FILE,
  HERMES_WORKSPACE_INDEX,
  displayPath,
  mergeHermesWorkspaceProjects,
  parseHermesWorkspaceIndex,
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
