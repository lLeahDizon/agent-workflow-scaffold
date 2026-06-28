import assert from "node:assert/strict";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import test from "node:test";
import { BufferedPromptSession, collectInteractiveInitOptions, type PromptSession } from "../interactive.js";

const silentLogger = { log: () => undefined };

class FakePrompt implements PromptSession {
  private index = 0;

  constructor(private readonly answers: string[]) {}

  async question(): Promise<string> {
    return this.answers[this.index++] ?? "";
  }

  close(): void {
    return undefined;
  }
}

test("collectInteractiveInitOptions keeps safe defaults", async () => {
  const prompt = new FakePrompt(["", "", "", "", "", "", "", ""]);
  const result = await collectInteractiveInitOptions(prompt, { rootPath: "/tmp/app" }, silentLogger);

  assert.equal(result.options.rootPath, path.resolve("/tmp/app"));
  assert.equal(result.options.target, "all");
  assert.equal(result.options.projectType, "auto");
  assert.equal(result.options.agentProvider, "builtin");
  assert.equal(result.options.skillPaths, undefined);
  assert.equal(result.options.loopEngineering, false);
  assert.equal(result.options.headroom, false);
  assert.equal(result.write, false);
});

test("collectInteractiveInitOptions parses Chinese guided choices", async () => {
  const prompt = new FakePrompt([
    "/tmp/crm-sales-h5",
    "codex",
    "h5",
    "hybrid",
    "/tmp/agency-agents",
    "frontend-developer,code-reviewer",
    "engineering,product",
    "/tmp/skills-a,/tmp/skills-b",
    "是",
    "是",
    "是"
  ]);
  const result = await collectInteractiveInitOptions(prompt, {}, silentLogger);

  assert.equal(result.options.rootPath, path.resolve("/tmp/crm-sales-h5"));
  assert.equal(result.options.target, "codex");
  assert.equal(result.options.projectType, "h5");
  assert.equal(result.options.agentProvider, "hybrid");
  assert.equal(result.options.agencyAgentsPath, "/tmp/agency-agents");
  assert.deepEqual(result.options.agentRoles, ["frontend-developer", "code-reviewer"]);
  assert.deepEqual(result.options.agentDivisions, ["engineering", "product"]);
  assert.deepEqual(result.options.skillPaths, ["/tmp/skills-a", "/tmp/skills-b"]);
  assert.equal(result.options.loopEngineering, true);
  assert.equal(result.options.headroom, true);
  assert.equal(result.write, true);
});

test("collectInteractiveInitOptions falls back to builtin when agency-agents path is blank", async () => {
  const prompt = new FakePrompt([
    "/tmp/app",
    "codex",
    "h5",
    "agency-agents",
    "",
    "",
    "/tmp/skills",
    "",
    "",
    "n"
  ]);
  const result = await collectInteractiveInitOptions(prompt, {}, silentLogger);

  assert.equal(result.options.agentProvider, "builtin");
  assert.equal(result.options.agencyAgentsPath, undefined);
  assert.equal(result.options.agentRoles, undefined);
  assert.equal(result.options.agentDivisions, undefined);
  assert.deepEqual(result.options.skillPaths, ["/tmp/skills"]);
  assert.equal(result.options.loopEngineering, false);
  assert.equal(result.options.headroom, false);
});

test("collectInteractiveInitOptions accepts manual agency-agents path after blank path prompt", async () => {
  const prompt = new FakePrompt([
    "/tmp/app",
    "codex",
    "h5",
    "hybrid",
    "",
    "path",
    "/tmp/agency-agents",
    "frontend-developer",
    "engineering",
    "",
    "",
    "",
    "n"
  ]);
  const result = await collectInteractiveInitOptions(prompt, {}, silentLogger);

  assert.equal(result.options.agentProvider, "hybrid");
  assert.equal(result.options.agencyAgentsPath, "/tmp/agency-agents");
  assert.deepEqual(result.options.agentRoles, ["frontend-developer"]);
  assert.deepEqual(result.options.agentDivisions, ["engineering"]);
  assert.equal(result.options.loopEngineering, false);
});

test("collectInteractiveInitOptions falls back to defaults for invalid choices", async () => {
  const prompt = new FakePrompt(["", "invalid-target", "invalid-type", "invalid-provider", "", ""]);
  const result = await collectInteractiveInitOptions(prompt, {
    rootPath: "/tmp/app",
    target: "trae",
    projectType: "management",
    agentProvider: "builtin",
    loopEngineering: true,
    headroom: true,
    write: true
  }, silentLogger);

  assert.equal(result.options.target, "trae");
  assert.equal(result.options.projectType, "management");
  assert.equal(result.options.agentProvider, "builtin");
  assert.equal(result.options.loopEngineering, true);
  assert.equal(result.options.headroom, true);
  assert.equal(result.write, true);
});

test("collectInteractiveInitOptions sanitizes invalid CLI defaults", async () => {
  const prompt = new FakePrompt(["", "", "", "", "", "", "", ""]);
  const result = await collectInteractiveInitOptions(prompt, {
    rootPath: "/tmp/app",
    target: "bad-target" as never,
    projectType: "bad-type" as never,
    agentProvider: "bad-provider" as never
  }, silentLogger);

  assert.equal(result.options.target, "all");
  assert.equal(result.options.projectType, "auto");
  assert.equal(result.options.agentProvider, "builtin");
});

test("BufferedPromptSession supports piped answers", async () => {
  let output = "";
  const source = Readable.from(["one\ntwo\n"]);
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      output += String(chunk);
      callback();
    }
  });
  const prompt = new BufferedPromptSession(source, sink);

  assert.equal(await prompt.question("First:"), "one");
  assert.equal(await prompt.question("Second:"), "two");
  assert.equal(await prompt.question("Third:"), "");
  assert.equal(output, "First:Second:Third:");
});
