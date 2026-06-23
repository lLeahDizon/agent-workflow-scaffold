import assert from "node:assert/strict";
import test from "node:test";
import { diffGeneratedFiles } from "../diff.js";
import type { GeneratedFile } from "../types.js";
import { applyManagedText, deepMergeJson } from "../writer/managedBlock.js";
import { resolveTargetPath } from "../writer/fileWriter.js";

test("applyManagedText appends managed block without touching handwritten content", () => {
  const existing = "# Title\n\nmanual\n";
  const generated = "<!-- agent-workflow-scaffold:start target=codex -->\nnew\n<!-- agent-workflow-scaffold:end target=codex -->\n";
  const next = applyManagedText(existing, generated);
  assert.match(next, /manual/);
  assert.match(next, /target=codex/);
});

test("applyManagedText replaces matching target block", () => {
  const existing = [
    "# Title",
    "",
    "<!-- agent-workflow-scaffold:start target=codex -->",
    "old",
    "<!-- agent-workflow-scaffold:end target=codex -->",
    ""
  ].join("\n");
  const generated = "<!-- agent-workflow-scaffold:start target=codex -->\nnew\n<!-- agent-workflow-scaffold:end target=codex -->\n";
  const next = applyManagedText(existing, generated);
  assert.match(next, /new/);
  assert.equal(next.includes("\nold\n"), false);
});

test("deepMergeJson merges objects and replaces arrays", () => {
  const next = deepMergeJson(
    { a: 1, nested: { keep: true, replace: [1] } },
    { nested: { replace: [2], add: "ok" } }
  );
  assert.deepEqual(next, { a: 1, nested: { keep: true, replace: [2], add: "ok" } });
});

test("resolveTargetPath blocks generated paths outside target root", () => {
  assert.throws(() => resolveTargetPath("/tmp/project", "../outside.md"), /escapes target root/);
  assert.throws(() => resolveTargetPath("/tmp/project", "/tmp/outside.md"), /escapes target root/);
  assert.equal(resolveTargetPath("/tmp/project", ".codex/config.toml"), "/tmp/project/.codex/config.toml");
});

test("diffGeneratedFiles blocks generated paths outside target root", async () => {
  const files: GeneratedFile[] = [
    {
      target: "codex",
      relativePath: "../outside.md",
      content: "outside",
      mode: "managed-text"
    }
  ];
  await assert.rejects(() => diffGeneratedFiles("/tmp/project", files), /escapes target root/);
});
