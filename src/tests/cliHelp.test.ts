import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import path from "node:path";
import test from "node:test";

const execFileAsync = promisify(execFile);
const cliPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../cli.js");

async function runCli(args: string[]): Promise<string> {
  const result = await execFileAsync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  return String(result.stdout);
}

async function runCliFailure(args: string[]): Promise<{ stdout: string; stderr: string; code?: number }> {
  try {
    await execFileAsync(process.execPath, [cliPath, ...args], { encoding: "utf8" });
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string; code?: number };
    return {
      stdout: String(failure.stdout ?? ""),
      stderr: String(failure.stderr ?? ""),
      code: failure.code
    };
  }
  throw new Error(`Expected CLI command to fail: ${args.join(" ")}`);
}

test("CLI help supports Chinese top-level aliases", async () => {
  for (const alias of ["-h", "-help", "--help", "help"]) {
    const output = await runCli([alias]);
    assert.match(output, /用法：/);
    assert.match(output, /推荐流程：/);
    assert.match(output, /中文问答式流程/);
    assert.match(output, /--help, -h, -help/);
  }
});

test("CLI help can be requested after a command without running it", async () => {
  const output = await runCli(["setup", "-h"]);

  assert.match(output, /用法：/);
  assert.match(output, /agent-workflow setup/);
  assert.doesNotMatch(output, /== 1\. Analyze ==/);
});

test("skills help output is localized", async () => {
  const output = await runCli(["skills", "-help"]);

  assert.match(output, /agent-workflow skills/);
  assert.match(output, /用法：/);
  assert.match(output, /默认扫描路径：/);
});

test("headroom help output documents explicit install and doctor commands", async () => {
  const output = await runCli(["headroom", "-h"]);

  assert.match(output, /agent-workflow headroom/);
  assert.match(output, /install \[--force\]/);
  assert.match(output, /doctor/);
  assert.match(output, /不会自动修改 PATH/);
});

test("mcp preview includes Headroom server when explicitly enabled", async () => {
  const output = await runCli(["mcp", "--target", "codex", "--headroom", "--headroom-command", "/tmp/headroom", "--headroom-args", "mcp,serve"]);

  assert.match(output, /\[mcp_servers\.headroom\]/);
  assert.match(output, /command = "\/tmp\/headroom"/);
  assert.match(output, /args = \["mcp", "serve"\]/);
});

test("analyze --json prints parseable project profile only", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-json-"));
  try {
    const output = await runCli(["analyze", "--root", dir, "--skill-paths", path.join(dir, "missing-skills"), "--json"]);
    const profile = JSON.parse(output) as { isEmptyProject: boolean; confidence: string; commands: { install?: string } };

    assert.equal(profile.isEmptyProject, true);
    assert.equal(profile.confidence, "low");
    assert.equal(profile.commands.install, undefined);
    assert.doesNotMatch(output, /^Project:/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyze --explain prints evidence and command inference", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-explain-"));
  try {
    await writeFile(path.join(dir, "README.md"), "# Early project\n", "utf8");
    const output = await runCli(["analyze", "--root", dir, "--skill-paths", path.join(dir, "missing-skills"), "--explain"]);

    assert.match(output, /Project Profile Explanation/);
    assert.match(output, /Confidence: medium/);
    assert.match(output, /Manifests: none detected/);
    assert.match(output, /Install command: none inferred/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyze --json --explain adds structured explanation field", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-cli-json-explain-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "json-explain-app", dependencies: { react: "18.3.1" } }),
      "utf8"
    );
    const output = await runCli(["analyze", "--root", dir, "--skill-paths", path.join(dir, "missing-skills"), "--json", "--explain"]);
    const payload = JSON.parse(output) as {
      profile: { confidence: string; manifests: Array<{ type: string; path: string }> };
      explanation: { summary: string[]; evidence: string[]; commandInference: string[] };
    };

    assert.equal(payload.profile.confidence, "high");
    assert.deepEqual(payload.profile.manifests, [{ type: "node", path: "package.json" }]);
    assert.ok(payload.explanation.summary.some((line) => line.includes("Confidence: high")));
    assert.ok(payload.explanation.commandInference.some((line) => line.includes("npm install")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("--json and --explain fail fast outside analyze", async () => {
  for (const args of [["setup", "--json"], ["setup", "--json=true"]]) {
    const result = await runCliFailure(args);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /only supported by analyze/);
  }
});

test("hermes help output documents explicit subcommands", async () => {
  const output = await runCli(["hermes", "-h"]);

  assert.match(output, /agent-workflow hermes/);
  assert.match(output, /register/);
  assert.match(output, /init-project/);
  assert.match(output, /doctor/);
  assert.match(output, /list/);
  assert.match(output, /team init/);
  assert.match(output, /team doctor/);
  assert.match(output, /HermesWorkspace/);
  assert.match(output, /does not install or start Hermes/);
  assert.match(output, /does not create concrete Hermes agents/);
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
    await assert.rejects(() => import("node:fs/promises").then(({ access }) => access(workspace)));
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
    await import("node:fs/promises").then(({ access }) => access(path.join(root, ".hermes.md")));
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
