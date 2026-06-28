import assert from "node:assert/strict";
import { execFile } from "node:child_process";
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
