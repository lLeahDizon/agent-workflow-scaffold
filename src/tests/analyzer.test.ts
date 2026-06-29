import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import { doctorProject } from "../doctor.js";
import { generateProject } from "../generators/index.js";
import { scanLocalSkills } from "../skills/scanner.js";

test("analyzeProject marks empty directory as low-confidence empty project", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-empty-"));
  try {
    const profile = await analyzeProject({ rootPath: dir, skillPaths: [] });

    assert.equal(profile.isEmptyProject, true);
    assert.equal(profile.confidence, "low");
    assert.deepEqual(profile.manifests, []);
    assert.equal(profile.hasPackageJson, false);
    assert.equal(profile.hasRequirementsTxt, false);
    assert.equal(profile.commands.install, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyzeProject treats README-only directory as early non-empty project", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-readme-"));
  try {
    await writeFile(path.join(dir, "README.md"), "# Early project\n", "utf8");
    const profile = await analyzeProject({ rootPath: dir, skillPaths: [] });

    assert.equal(profile.isEmptyProject, false);
    assert.equal(profile.confidence, "medium");
    assert.deepEqual(profile.manifests, []);
    assert.deepEqual(profile.docFiles, ["README.md"]);
    assert.equal(profile.commands.install, undefined);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyzeProject reports Node manifest evidence and package-manager install command", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-node-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "node-app",
        scripts: { dev: "vite --host 0.0.0.0", test: "vitest" },
        dependencies: { react: "18.3.1" }
      }),
      "utf8"
    );
    await writeFile(path.join(dir, "pnpm-lock.yaml"), "", "utf8");
    const profile = await analyzeProject({ rootPath: dir, skillPaths: [] });

    assert.equal(profile.isEmptyProject, false);
    assert.equal(profile.confidence, "high");
    assert.deepEqual(profile.manifests, [
      { type: "node", path: "package.json" },
      { type: "node", path: "pnpm-lock.yaml" }
    ]);
    assert.equal(profile.commands.install, "pnpm install");
    assert.deepEqual(profile.commands.dev, ["pnpm dev"]);
    assert.deepEqual(profile.commands.test, ["pnpm test"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyzeProject reports Python requirements manifest and pip install command", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-python-"));
  try {
    await writeFile(path.join(dir, "requirements.txt"), "flask\n", "utf8");
    const profile = await analyzeProject({ rootPath: dir, skillPaths: [] });

    assert.equal(profile.isEmptyProject, false);
    assert.equal(profile.confidence, "high");
    assert.deepEqual(profile.manifests, [{ type: "python", path: "requirements.txt" }]);
    assert.equal(profile.commands.install, "pip install -r requirements.txt");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyzeProject detects Umi H5 project", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "crm-sales-h5",
        scripts: { "start:dd": "umi dev", "build:prod": "umi build" },
        dependencies: { umi: "4.6.0", react: "18.3.1", "antd-mobile": "5.0.0" },
        devDependencies: { typescript: "5.0.0" }
      }),
      "utf8"
    );
    await writeFile(path.join(dir, "pnpm-lock.yaml"), "", "utf8");
    const profile = await analyzeProject({ rootPath: dir });
    assert.equal(profile.projectType, "h5");
    assert.equal(profile.packageManager, "pnpm");
    assert.ok(profile.techStack.includes("antd-mobile"));
    assert.ok(profile.subagents.some((subagent) => subagent.id === "frontend-implementer"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyzeProject selects backend subagent for Python project", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "requirements.txt"), "flask\n", "utf8");
    const profile = await analyzeProject({ rootPath: dir });
    assert.equal(profile.projectType, "python-crm");
    assert.ok(profile.subagents.some((subagent) => subagent.id === "backend-implementer"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject creates Claude Code project subagent files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "frontend-app",
        dependencies: { react: "18.3.1", umi: "4.6.0" }
      }),
      "utf8"
    );
    const result = await generateProject({ rootPath: dir, target: "claude-code" });
    const subagentFile = result.files.find((file) => file.relativePath === ".claude/agents/frontend-implementer.md");
    assert.ok(subagentFile);
    assert.match(subagentFile.content, /^---\nname: frontend-implementer/m);
    assert.match(subagentFile.content, /agent-workflow-scaffold:start target=claude-code/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject creates Trae project subagent files", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "frontend-app",
        dependencies: { react: "18.3.1", umi: "4.6.0" }
      }),
      "utf8"
    );
    const result = await generateProject({ rootPath: dir, target: "trae" });
    const agentsFile = result.files.find((file) => file.relativePath === ".trae/agents/frontend-implementer.md");
    assert.ok(agentsFile);
    assert.match(agentsFile.content, /^---\nname: frontend-implementer/m);
    assert.match(agentsFile.content, /agent-workflow-scaffold:start target=trae/);
    assert.match(agentsFile.content, /\.trae\/AGENTS\.md/);

    const traeAgents = result.files.find((file) => file.relativePath === ".trae/AGENTS.md");
    assert.ok(traeAgents);
    assert.match(traeAgents.content, /Enable Subagents Directory/);
    assert.match(traeAgents.content, /\.trae\/agents\/\*\.md/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject creates Trae and Claude subagent files for all target", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "frontend-app",
        dependencies: { react: "18.3.1", umi: "4.6.0" }
      }),
      "utf8"
    );
    const result = await generateProject({ rootPath: dir, target: "all" });
    assert.ok(result.files.some((file) => file.relativePath === ".trae/agents/frontend-implementer.md"));
    assert.ok(result.files.some((file) => file.relativePath === ".claude/agents/frontend-implementer.md"));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject does not generate Claude Code permission overrides", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "frontend-app" }), "utf8");
    const result = await generateProject({ rootPath: dir, target: "claude-code", skillPaths: [] });
    const settingsFile = result.files.find((file) => file.relativePath === ".claude/settings.json");
    assert.ok(settingsFile);
    const jsonMerge = settingsFile.jsonMerge as Record<string, unknown>;
    assert.equal("permissions" in jsonMerge, false);
    assert.match(settingsFile.content, /agentWorkflowScaffold/);
    assert.doesNotMatch(settingsFile.content, /"permissions"/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("doctorProject emits custom project warning for selected target", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "frontend-app" }), "utf8");
    const result = await doctorProject({ rootPath: dir, target: "claude-code", skillPaths: [] });
    const customWarnings = result.issues.filter((issue) => issue.message.includes("Project type is custom"));
    assert.deepEqual(customWarnings.map((issue) => issue.target), ["claude-code"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("doctorProject keeps empty-project guidance non-fatal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-doctor-empty-"));
  try {
    const result = await doctorProject({ rootPath: dir, target: "codex", skillPaths: [] });

    assert.equal(result.profile.isEmptyProject, true);
    assert.equal(result.ok, true);
    assert.equal(result.issues.some((issue) => issue.level === "error"), false);
    assert.ok(result.issues.some((issue) => issue.message.includes("Project appears empty")));
    assert.ok(result.issues.some((issue) => issue.message.includes("No install command was inferred")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("analyzeProject loads selected agency-agents roles from local path", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  const agencyDir = await mkdtemp(path.join(os.tmpdir(), "agency-agents-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "app" }), "utf8");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(agencyDir, "engineering"), { recursive: true }));
    await writeFile(
      path.join(agencyDir, "engineering", "engineering-frontend-developer.md"),
      [
        "---",
        "name: Frontend Developer",
        "description: Builds production frontend interfaces.",
        "---",
        "",
        "# Frontend Developer Agent Personality",
        "",
        "Use upstream frontend guidance."
      ].join("\n"),
      "utf8"
    );

    const profile = await analyzeProject({
      rootPath: dir,
      agentProvider: "agency-agents",
      agencyAgentsPath: agencyDir,
      agentRoles: ["frontend-developer"],
      agentDivisions: ["engineering"]
    });

    assert.deepEqual(profile.subagents.map((subagent) => subagent.id), ["frontend-developer"]);
    assert.equal(profile.subagents[0].source, "agency-agents");
    assert.match(profile.subagents[0].content ?? "", /Frontend Developer Agent Personality/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(agencyDir, { recursive: true, force: true });
  }
});

test("generateProject emits agency-agents content in Claude subagent file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  const agencyDir = await mkdtemp(path.join(os.tmpdir(), "agency-agents-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "app" }), "utf8");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(path.join(agencyDir, "engineering"), { recursive: true }));
    await writeFile(
      path.join(agencyDir, "engineering", "engineering-code-reviewer.md"),
      [
        "---",
        "name: Code Reviewer",
        "description: Reviews code from agency-agents.",
        "---",
        "",
        "# Code Reviewer Agent Personality",
        "",
        "Use upstream review guidance."
      ].join("\n"),
      "utf8"
    );

    const result = await generateProject({
      rootPath: dir,
      target: "claude-code",
      agentProvider: "hybrid",
      agencyAgentsPath: agencyDir,
      agentRoles: ["code-reviewer"],
      agentDivisions: ["engineering"]
    });

    const subagentFile = result.files.find((file) => file.relativePath === ".claude/agents/code-reviewer.md");
    assert.ok(subagentFile);
    assert.match(subagentFile.content, /^---\nname: code-reviewer/m);
    assert.match(subagentFile.content, /Source: agency-agents/);
    assert.match(subagentFile.content, /Code Reviewer Agent Personality/);
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(agencyDir, { recursive: true, force: true });
  }
});

test("scanLocalSkills reads SKILL.md frontmatter from custom scan path", async () => {
  const skillRoot = await mkdtemp(path.join(os.tmpdir(), "agent-skills-"));
  try {
    await mkdir(path.join(skillRoot, "writing-plans"), { recursive: true });
    await writeFile(
      path.join(skillRoot, "writing-plans", "SKILL.md"),
      [
        "---",
        "name: writing-plans",
        "description: Plan multi-step implementation work.",
        "---",
        "",
        "# Writing Plans"
      ].join("\n"),
      "utf8"
    );

    const scan = await scanLocalSkills([skillRoot]);
    assert.equal(scan.skills.length, 1);
    assert.equal(scan.skills[0].id, "writing-plans");
    assert.equal(scan.skills[0].description, "Plan multi-step implementation work.");
  } finally {
    await rm(skillRoot, { recursive: true, force: true });
  }
});

test("analyzeProject marks recommended local skills as installed", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  const skillRoot = await mkdtemp(path.join(os.tmpdir(), "agent-skills-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "frontend-app",
        dependencies: { react: "18.3.1", umi: "4.6.0" }
      }),
      "utf8"
    );
    await mkdir(path.join(skillRoot, "writing-plans"), { recursive: true });
    await writeFile(
      path.join(skillRoot, "writing-plans", "SKILL.md"),
      [
        "---",
        "name: writing-plans",
        "description: Plan multi-step implementation work.",
        "---"
      ].join("\n"),
      "utf8"
    );

    const profile = await analyzeProject({ rootPath: dir, skillPaths: [skillRoot] });
    const writingPlans = profile.skillRecommendations.find((skill) => skill.id === "writing-plans");
    const browserSkill = profile.skillRecommendations.find((skill) => skill.id === "browser-control-in-app-browser");
    assert.ok(writingPlans);
    assert.equal(writingPlans.installed, true);
    assert.ok(browserSkill);
    assert.equal(browserSkill.category, "optional");
  } finally {
    await rm(dir, { recursive: true, force: true });
    await rm(skillRoot, { recursive: true, force: true });
  }
});

test("generateProject emits skill recommendation reference file", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "app" }), "utf8");
    const result = await generateProject({ rootPath: dir, target: "codex", skillPaths: [] });
    const skillsFile = result.files.find((file) => file.relativePath === ".codex/skills/app-workflow/references/skills.md");
    assert.ok(skillsFile);
    assert.match(skillsFile.content, /Skill Recommendations/);
    assert.match(skillsFile.content, /does not copy, install, or mutate user-global skills/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject emits AI Coding workflow playbook for every target", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "h5-app",
        dependencies: { react: "18.3.1", umi: "4.6.0", "antd-mobile": "5.0.0" }
      }),
      "utf8"
    );

    const result = await generateProject({ rootPath: dir, target: "all", skillPaths: [] });
    const expectedPaths = [
      ".codex/skills/h5-app-workflow/references/workflow-playbook.md",
      ".trae/skills/h5-app-workflow/references/workflow-playbook.md",
      ".claude/skills/h5-app-workflow/references/workflow-playbook.md"
    ];

    for (const relativePath of expectedPaths) {
      const file = result.files.find((item) => item.relativePath === relativePath);
      assert.ok(file, `${relativePath} should be generated`);
      assert.match(file.content, /AI Coding 协作工作流/);
      assert.match(file.content, /Goal/);
      assert.match(file.content, /计划分析/);
      assert.match(file.content, /人工 Review/);
      assert.match(file.content, /一高风险任务一 worktree/);
      assert.match(file.content, /前端项目优先试点/);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject skips Loop Engineering reference by default", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "loop-app" }), "utf8");
    const result = await generateProject({ rootPath: dir, target: "all", skillPaths: [] });

    assert.equal(result.files.some((file) => file.relativePath.includes("loop-engineering.md")), false);
    assert.equal(result.files.some((file) => file.content.includes("Loop Engineering")), false);
    const claudeSettings = result.files.find((file) => file.relativePath === ".claude/settings.json");
    assert.ok(claudeSettings);
    assert.equal("optionalWorkflows" in (claudeSettings.jsonMerge as { agentWorkflowScaffold: Record<string, unknown> }).agentWorkflowScaffold, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject emits optional Loop Engineering reference for every target", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "loop-app" }), "utf8");
    const result = await generateProject({ rootPath: dir, target: "all", skillPaths: [], loopEngineering: true });
    const expectedPaths = [
      ".codex/skills/loop-app-workflow/references/loop-engineering.md",
      ".trae/skills/loop-app-workflow/references/loop-engineering.md",
      ".claude/skills/loop-app-workflow/references/loop-engineering.md"
    ];

    for (const relativePath of expectedPaths) {
      const file = result.files.find((item) => item.relativePath === relativePath);
      assert.ok(file, `${relativePath} should be generated`);
      assert.match(file.content, /Loop Engineering 可选工作流/);
      assert.match(file.content, /Frame/);
      assert.match(file.content, /Inspect/);
      assert.match(file.content, /Verify/);
      assert.match(file.content, /最多执行 3 轮/);
    }

    const codexAgents = result.files.find((file) => file.relativePath === "AGENTS.md");
    assert.ok(codexAgents);
    assert.match(codexAgents.content, /loop-engineering\.md/);

    const claudeSettings = result.files.find((file) => file.relativePath === ".claude/settings.json");
    assert.ok(claudeSettings);
    assert.deepEqual((claudeSettings.jsonMerge as { agentWorkflowScaffold: { optionalWorkflows: unknown } }).agentWorkflowScaffold.optionalWorkflows, {
      loopEngineering: true
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("generateProject emits Chinese Codex hook status messages", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "agent-workflow-"));
  try {
    await writeFile(path.join(dir, "package.json"), JSON.stringify({ name: "app" }), "utf8");
    const result = await generateProject({ rootPath: dir, target: "codex", skillPaths: [] });
    const configFile = result.files.find((file) => file.relativePath === ".codex/config.toml");
    assert.ok(configFile);
    assert.match(configFile.content, /正在加载项目 AI 协作规则/);
    assert.match(configFile.content, /正在检查项目安全策略/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
