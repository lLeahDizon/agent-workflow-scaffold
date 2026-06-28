import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { doctorProject } from "../doctor.js";
import { generateProject } from "../generators/index.js";
import {
  headroomExecutablePath,
  headroomInstallStatePath,
  headroomVenvPath,
  inspectHeadroomInstall,
  isPythonVersionSupported,
  parsePythonVersion
} from "../headroom.js";
import { readManifest } from "../manifest.js";
import { writeGeneratedFiles } from "../writer/fileWriter.js";

test("parsePythonVersion parses python version output", () => {
  assert.deepEqual(parsePythonVersion("Python 3.11.4"), { major: 3, minor: 11, patch: 4 });
  assert.deepEqual(parsePythonVersion("Python 3.10"), { major: 3, minor: 10, patch: 0 });
  assert.equal(parsePythonVersion("not python"), undefined);
});

test("isPythonVersionSupported requires Python 3.10 or newer", () => {
  assert.equal(isPythonVersionSupported({ major: 3, minor: 9, patch: 18 }), false);
  assert.equal(isPythonVersionSupported({ major: 3, minor: 10, patch: 0 }), true);
  assert.equal(isPythonVersionSupported({ major: 4, minor: 0, patch: 0 }), true);
});

test("headroom managed paths are rooted under the managed home", () => {
  const homePath = path.join(os.tmpdir(), "agent-workflow-headroom-home");

  assert.equal(headroomVenvPath(homePath), path.join(homePath, "venv"));
  assert.equal(headroomInstallStatePath(homePath), path.join(homePath, "install.json"));
  assert.ok(headroomExecutablePath(homePath).startsWith(path.join(homePath, "venv")));
});

test("inspectHeadroomInstall reports missing managed install without failing", async () => {
  const homePath = await mkdtemp(path.join(os.tmpdir(), "agent-headroom-"));
  try {
    const result = await inspectHeadroomInstall(homePath);

    assert.equal(result.homePath, homePath);
    assert.equal(result.stateExists, false);
    assert.equal(result.executableExists, false);
  } finally {
    await rm(homePath, { recursive: true, force: true });
  }
});

test("generateProject emits Headroom MCP config for Codex and Claude Code only", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "headroom-app" }), "utf8");
    const result = await generateProject({ rootPath: dir, target: "all", skillPaths: [], headroom: true });

    const codexReference = result.files.find((file) => file.relativePath === ".codex/skills/headroom-app-workflow/references/headroom.md");
    const traeReference = result.files.find((file) => file.relativePath === ".trae/skills/headroom-app-workflow/references/headroom.md");
    const claudeReference = result.files.find((file) => file.relativePath === ".claude/skills/headroom-app-workflow/references/headroom.md");
    assert.ok(codexReference);
    assert.ok(traeReference);
    assert.ok(claudeReference);
    assert.match(codexReference.content, /MCP server name: `headroom`/);
    assert.match(traeReference.content, /Trae 第一版只保留本说明文档/);

    const codexMcp = result.files.find((file) => file.relativePath === ".codex/mcp.agent-workflow.json");
    const traeMcp = result.files.find((file) => file.relativePath === ".trae/mcp.json");
    const claudeMcp = result.files.find((file) => file.relativePath === ".mcp.json");
    assert.ok(codexMcp);
    assert.ok(traeMcp);
    assert.ok(claudeMcp);
    assert.equal(hasHeadroomServer(codexMcp.jsonMerge), true);
    assert.equal(hasHeadroomServer(claudeMcp.jsonMerge), true);
    assert.equal(hasHeadroomServer(traeMcp.jsonMerge), false);

    const manifest = result.files.find((file) => file.relativePath === ".agent-workflow/manifest.json");
    assert.ok(manifest);
    const manifestJson = JSON.parse(manifest.content) as {
      enabledFeatures: { headroom?: boolean };
      featureOptions?: { headroom?: { command?: string; args?: string[] } };
    };
    assert.equal(manifestJson.enabledFeatures.headroom, true);
    assert.deepEqual(manifestJson.featureOptions?.headroom, {
      enabled: true,
      command: "headroom",
      args: ["mcp", "serve"]
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject stores Headroom command overrides in manifest and MCP config", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "headroom-app" }), "utf8");
    const result = await generateProject({
      rootPath: dir,
      target: "codex",
      skillPaths: [],
      headroom: true,
      headroomCommand: "/tmp/headroom",
      headroomArgs: ["mcp", "serve", "--port", "9817"]
    });

    const mcp = result.files.find((file) => file.relativePath === ".codex/mcp.agent-workflow.json");
    assert.ok(mcp);
    const headroomServer = ((mcp.jsonMerge as { mcpServers: Record<string, { command: string; args: string[] }> }).mcpServers).headroom;
    assert.deepEqual(headroomServer, {
      command: "/tmp/headroom",
      args: ["mcp", "serve", "--port", "9817"]
    });

    const manifest = result.files.find((file) => file.relativePath === ".agent-workflow/manifest.json");
    assert.ok(manifest);
    const manifestJson = JSON.parse(manifest.content) as { featureOptions?: { headroom?: { command?: string; args?: string[] } } };
    assert.deepEqual(manifestJson.featureOptions?.headroom, {
      enabled: true,
      command: "/tmp/headroom",
      args: ["mcp", "serve", "--port", "9817"]
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("doctorProject warns but does not fail when Headroom executable is missing", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "headroom-app" }), "utf8");
    const result = await generateProject({
      rootPath: dir,
      target: "codex",
      skillPaths: [],
      headroom: true,
      headroomCommand: path.join(dir, "missing-headroom")
    });
    await writeGeneratedFiles(dir, result.files);

    const doctor = await doctorProject({
      rootPath: dir,
      target: "codex",
      skillPaths: []
    });

    assert.equal(doctor.ok, true);
    assert.ok(doctor.issues.some((issue) => issue.level === "warning" && issue.message.includes("Managed Headroom executable is missing")));
    assert.equal(doctor.issues.some((issue) => issue.level === "error" && issue.message.includes("Headroom")), false);

    const manifest = await readManifest(dir);
    assert.equal(manifest?.enabledFeatures.headroom, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("doctorProject reports missing Headroom MCP server as an error for Codex", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "headroom-app" }), "utf8");
    const result = await generateProject({
      rootPath: dir,
      target: "codex",
      skillPaths: [],
      headroom: true,
      headroomCommand: path.join(dir, "missing-headroom")
    });
    await writeGeneratedFiles(dir, result.files);
    await mkdir(path.join(dir, ".codex"), { recursive: true });
    await writeFile(
      path.join(dir, ".codex/mcp.agent-workflow.json"),
      JSON.stringify({ mcpServers: { "agent-workflow-scaffold": { command: "npx", args: [] } } }, null, 2),
      "utf8"
    );

    const doctor = await doctorProject({
      rootPath: dir,
      target: "codex",
      skillPaths: []
    });

    assert.equal(doctor.ok, false);
    assert.ok(doctor.issues.some((issue) => issue.level === "error" && issue.message.includes("Headroom MCP server is missing")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("doctorProject warns when custom Headroom command is not in PATH", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "headroom-app" }), "utf8");
    const result = await generateProject({
      rootPath: dir,
      target: "codex",
      skillPaths: [],
      headroom: true,
      headroomCommand: "agent-workflow-missing-headroom-command"
    });
    await writeGeneratedFiles(dir, result.files);

    const doctor = await doctorProject({
      rootPath: dir,
      target: "codex",
      skillPaths: []
    });

    assert.equal(doctor.ok, true);
    assert.ok(doctor.issues.some((issue) => issue.level === "warning" && issue.message.includes("agent-workflow-missing-headroom-command")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

function hasHeadroomServer(value: unknown): boolean {
  const mcpServers = (value as { mcpServers?: Record<string, unknown> }).mcpServers;
  return Boolean(mcpServers?.headroom);
}
