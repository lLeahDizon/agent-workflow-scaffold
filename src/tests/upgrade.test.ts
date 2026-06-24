import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { readManifest } from "../manifest.js";
import { doctorProject } from "../doctor.js";
import { planUpgrade, upgradeProject } from "../upgrade.js";
import { SCAFFOLD_VERSION } from "../version.js";

test("planUpgrade skips projects without existing Agent workflow config", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-upgrade-"));
  try {
    const result = await planUpgrade({ rootPath: dir, skillPaths: [] });

    assert.equal(result.targets.length, 0);
    assert.equal(result.files.length, 0);
    assert.match(result.skippedReason ?? "", /No existing Agent workflow target detected/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("planUpgrade detects legacy Codex target without adding other targets", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-upgrade-"));
  try {
    await writeFile(path.join(dir, "AGENTS.md"), "# Existing\n", "utf8");
    const result = await planUpgrade({ rootPath: dir, skillPaths: [] });

    assert.deepEqual(result.targets, ["codex"]);
    assert.ok(result.files.some((file) => file.relativePath === "AGENTS.md"));
    assert.ok(result.files.some((file) => file.relativePath === ".agent-workflow/manifest.json"));
    assert.equal(result.files.some((file) => file.relativePath === ".trae/AGENTS.md"), false);
    assert.equal(result.files.some((file) => file.relativePath === "CLAUDE.md"), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("upgradeProject writes manifest and backs up updated files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-upgrade-"));
  try {
    await writeFile(path.join(dir, "AGENTS.md"), [
      "# Existing",
      "",
      "<!-- agent-workflow-scaffold:start target=codex -->",
      "legacy managed content",
      "<!-- agent-workflow-scaffold:end -->",
      "",
      "manual content",
      ""
    ].join("\n"), "utf8");

    const result = await upgradeProject({ rootPath: dir, skillPaths: [], write: true, backup: true, loopEngineering: true });
    assert.deepEqual(result.targets, ["codex"]);
    assert.ok(result.backupPath);
    assert.ok(result.writes.some((item) => item.relativePath === "AGENTS.md" && item.action === "updated"));
    assert.ok(result.writes.some((item) => item.relativePath === ".agent-workflow/manifest.json" && item.action === "created"));

    const backupAgents = await readFile(path.join(dir, result.backupPath!, "AGENTS.md"), "utf8");
    assert.match(backupAgents, /legacy managed content/);

    const upgradedAgents = await readFile(path.join(dir, "AGENTS.md"), "utf8");
    assert.match(upgradedAgents, new RegExp(`scaffoldVersion=${SCAFFOLD_VERSION.replaceAll(".", "\\.")}`));
    assert.match(upgradedAgents, /loop-engineering\.md/);
    assert.match(upgradedAgents, /manual content/);

    const manifest = await readManifest(dir);
    assert.ok(manifest);
    assert.equal(manifest.scaffoldVersion, SCAFFOLD_VERSION);
    assert.deepEqual(manifest.targets, ["codex"]);
    assert.equal(manifest.enabledFeatures.loopEngineering, true);
    assert.equal(manifest.lastBackupPath, result.backupPath);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("doctorProject reports legacy blocks and missing manifest before upgrade", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-upgrade-"));
  try {
    await writeFile(path.join(dir, "AGENTS.md"), [
      "# Existing",
      "",
      "<!-- agent-workflow-scaffold:start target=codex -->",
      "legacy managed content",
      "<!-- agent-workflow-scaffold:end target=codex -->",
      ""
    ].join("\n"), "utf8");

    const result = await doctorProject({ rootPath: dir, target: "codex", skillPaths: [] });

    assert.ok(result.issues.some((issue) => issue.relativePath === "AGENTS.md" && issue.message.includes("Legacy managed block")));
    assert.ok(result.issues.some((issue) => issue.relativePath === ".agent-workflow/manifest.json" && issue.message.includes("manifest is missing")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("doctorProject does not report version metadata for handwritten files without managed blocks", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-upgrade-"));
  try {
    await writeFile(path.join(dir, "AGENTS.md"), "# Handwritten guidance\n", "utf8");
    const result = await doctorProject({ rootPath: dir, target: "codex", skillPaths: [] });

    assert.equal(result.issues.some((issue) => issue.relativePath === "AGENTS.md" && issue.message.includes("version metadata")), false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
