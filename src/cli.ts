#!/usr/bin/env node
import { analyzeProject } from "./analyzers/projectAnalyzer.js";
import { diffGeneratedFiles } from "./diff.js";
import { doctorProject } from "./doctor.js";
import { generateProject } from "./generators/index.js";
import { renderMcpConfig } from "./generators/mcpConfig.js";
import { collectInteractiveInitOptions, createPromptSession } from "./interactive.js";
import { startMcpServer } from "./mcp/server.js";
import { defaultSkillScanPaths, scanLocalSkills } from "./skills/scanner.js";
import type { AgentProvider, GenerateOptions, ProjectType, SkillRecommendation, TargetInput } from "./types.js";
import { formatProfileSummary, normalizeTarget, resolveRootPath } from "./utils/format.js";
import { writeGeneratedFiles } from "./writer/fileWriter.js";

interface CliArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positionals: string[];
}

function parseArgs(argv: string[]): CliArgs {
  const [command = "help", ...rest] = argv;
  const flags: Record<string, string | boolean> = {};
  const positionals: string[] = [];

  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index];
    if (!arg.startsWith("--")) {
      positionals.push(arg);
      continue;
    }

    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      flags[rawKey] = inlineValue;
      continue;
    }

    const next = rest[index + 1];
    if (next && !next.startsWith("--")) {
      flags[rawKey] = next;
      index += 1;
    } else {
      flags[rawKey] = true;
    }
  }

  return { command, flags, positionals };
}

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const value = flags[key];
  return typeof value === "string" ? value : undefined;
}

function flagList(flags: Record<string, string | boolean>, key: string): string[] | undefined {
  const value = flagString(flags, key);
  if (!value) {
    return undefined;
  }
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function buildOptions(args: CliArgs): GenerateOptions {
  return {
    rootPath: resolveRootPath(flagString(args.flags, "root")),
    projectType: (flagString(args.flags, "project-type") as ProjectType | undefined) ?? "auto",
    target: (flagString(args.flags, "target") as TargetInput | undefined) ?? "all",
    agentProvider: (flagString(args.flags, "agent-provider") as AgentProvider | undefined) ?? "builtin",
    agencyAgentsPath: flagString(args.flags, "agency-agents-path"),
    agentRoles: flagList(args.flags, "agent-roles"),
    agentDivisions: flagList(args.flags, "agent-divisions"),
    skillPaths: flagList(args.flags, "skill-paths")
  };
}

function printHelp(): void {
  console.log(`agent-workflow

Usage:
  agent-workflow analyze [--root <path>] [--project-type <type>]
  agent-workflow init [--target codex|trae|claude-code|all] [--write] [--interactive]
  agent-workflow setup [--target codex|trae|claude-code|all] [--write] [--interactive]
  agent-workflow generate [--target codex|trae|claude-code|all] [--write]
  agent-workflow diff [--target codex|trae|claude-code|all]
  agent-workflow doctor [--target codex|trae|claude-code|all]
  agent-workflow mcp [--target codex|trae|claude-code|all]
  agent-workflow mcp serve
  agent-workflow skills analyze [--skill-paths <paths>]
  agent-workflow skills recommend [--root <path>] [--skill-paths <paths>]

Options:
  --root <path>            Target project root. Defaults to cwd.
  --project-type <type>    auto|python-crm|umi-react|h5|management|custom.
  --target <target>        codex|trae|claude-code|all. Defaults to all.
  --agent-provider <type>   builtin|agency-agents|hybrid. Defaults to builtin.
  --agency-agents-path <p>  Local path to msitarzewski/agency-agents clone.
  --agent-roles <ids>       Comma-separated agency-agents role ids.
  --agent-divisions <ids>   Comma-separated agency-agents divisions.
  --skill-paths <paths>     Comma-separated SKILL.md scan roots. Defaults to user Codex/Agent skill paths.
  --interactive            Run the Chinese guided setup/init flow. Supported by setup and init.
  --write                  Write generated files. Without this flag, only preview.
`);
}

async function runAnalyze(args: CliArgs): Promise<void> {
  const profile = await analyzeProject(buildOptions(args));
  console.log(formatProfileSummary(profile));
  console.log("");
  console.log(JSON.stringify(profile, null, 2));
}

async function runGenerate(args: CliArgs): Promise<void> {
  const interactive = ["init", "setup"].includes(args.command) && Boolean(args.flags.interactive);
  const prompt = interactive ? createPromptSession() : undefined;
  const cliOptions = buildOptions(args);
  const interactiveResult = prompt
    ? await collectInteractiveInitOptions(prompt, { ...cliOptions, write: Boolean(args.flags.write) }).finally(() => prompt.close())
    : undefined;
  const options = interactiveResult?.options ?? buildOptions(args);
  const write = interactiveResult?.write ?? Boolean(args.flags.write);
  const result = await generateProject(options);
  const diffs = await diffGeneratedFiles(result.profile.rootPath, result.files);

  console.log(formatProfileSummary(result.profile));
  console.log("");
  console.log(
    interactive
      ? write
        ? "即将写入以下生成文件："
        : "生成文件预览。未确认写入时不会修改项目文件："
      : write
        ? "Writing generated artifacts:"
        : "Generated artifact preview. Re-run with --write to apply:"
  );
  for (const diff of diffs) {
    console.log(`- ${diff.status.padEnd(9)} ${diff.relativePath}`);
  }

  if (write) {
    const writes = await writeGeneratedFiles(result.profile.rootPath, result.files);
    console.log("");
    console.log(interactive ? "写入结果：" : "Write result:");
    for (const item of writes) {
      console.log(`- ${item.action.padEnd(9)} ${item.relativePath}`);
    }
  }
}

async function runSetup(args: CliArgs): Promise<void> {
  const interactive = Boolean(args.flags.interactive);
  const prompt = interactive ? createPromptSession() : undefined;
  const cliOptions = buildOptions(args);
  const interactiveResult = prompt
    ? await collectInteractiveInitOptions(prompt, { ...cliOptions, write: Boolean(args.flags.write) }).finally(() => prompt.close())
    : undefined;
  const options = interactiveResult?.options ?? cliOptions;
  const write = interactiveResult?.write ?? Boolean(args.flags.write);

  console.log("== 1. Analyze ==");
  const result = await generateProject(options);
  console.log(formatProfileSummary(result.profile));

  console.log("");
  console.log("== 2. Skill Recommendations ==");
  for (const skill of result.profile.skillRecommendations) {
    printSkillRecommendation(skill);
  }

  console.log("");
  console.log(write ? "== 3. Write Generated Artifacts ==" : "== 3. Preview Generated Artifacts ==");
  const diffs = await diffGeneratedFiles(result.profile.rootPath, result.files);
  for (const diff of diffs) {
    console.log(`- ${diff.status.padEnd(9)} ${diff.relativePath}`);
  }

  if (!write) {
    console.log("");
    console.log("Preview only. Re-run with --write, or use --interactive and confirm write, to apply changes.");
    return;
  }

  const writes = await writeGeneratedFiles(result.profile.rootPath, result.files);
  for (const item of writes) {
    console.log(`- ${item.action.padEnd(9)} ${item.relativePath}`);
  }

  console.log("");
  console.log("== 4. Doctor ==");
  const doctor = await doctorProject(options);
  console.log(doctor.ok ? "Doctor: OK" : "Doctor: issues found");
  for (const issue of doctor.issues) {
    console.log(`- [${issue.level}] ${issue.target} ${issue.relativePath}: ${issue.message}`);
  }
  if (!doctor.ok) {
    process.exitCode = 1;
  }
}

async function runDiff(args: CliArgs): Promise<void> {
  const result = await generateProject(buildOptions(args));
  const diffs = await diffGeneratedFiles(result.profile.rootPath, result.files);
  for (const diff of diffs) {
    console.log(`${diff.status}\t+${diff.addedLines}/-${diff.removedLines}\t${diff.relativePath}`);
  }
}

async function runDoctor(args: CliArgs): Promise<void> {
  const result = await doctorProject(buildOptions(args));
  console.log(formatProfileSummary(result.profile));
  console.log("");
  console.log(result.ok ? "Doctor: OK" : "Doctor: issues found");
  for (const issue of result.issues) {
    console.log(`- [${issue.level}] ${issue.target} ${issue.relativePath}: ${issue.message}`);
  }
  if (!result.ok) {
    process.exitCode = 1;
  }
}

async function runMcp(args: CliArgs): Promise<void> {
  if (args.positionals[0] === "serve") {
    await startMcpServer();
    return;
  }

  const profile = await analyzeProject(buildOptions(args));
  const targets = normalizeTarget(buildOptions(args).target);
  for (const target of targets) {
    console.log(`# ${target}`);
    console.log(renderMcpConfig(target, profile));
  }
}

function printSkillRecommendation(skill: SkillRecommendation): void {
  const status = skill.installPolicy === "generated"
    ? "generated"
    : skill.installed
      ? `installed${skill.source ? `:${skill.source}` : ""}`
      : "not-installed";
  console.log(`- [${skill.category}] ${skill.name} (${status})`);
  console.log(`  reason: ${skill.reason}`);
  if (skill.localPath) {
    console.log(`  path: ${skill.localPath}`);
  }
}

async function runSkills(args: CliArgs): Promise<void> {
  const subcommand = args.positionals[0] ?? "help";
  if (subcommand === "analyze") {
    const scan = await scanLocalSkills(flagList(args.flags, "skill-paths"));
    console.log("Skill scan paths:");
    for (const scanPath of scan.scannedPaths) {
      console.log(`- ${scanPath}`);
    }
    console.log("");
    console.log(`Discovered skills: ${scan.skills.length}`);
    for (const skill of scan.skills) {
      console.log(`- ${skill.id} | ${skill.source} | ${skill.skillPath}`);
      console.log(`  ${skill.description}`);
    }
    return;
  }

  if (subcommand === "recommend") {
    const profile = await analyzeProject(buildOptions(args));
    console.log(formatProfileSummary(profile));
    console.log("");
    console.log("Skill recommendations:");
    for (const skill of profile.skillRecommendations) {
      printSkillRecommendation(skill);
    }
    console.log("");
    console.log("Policy: the scaffold does not copy or install user-global skills by default.");
    return;
  }

  console.log(`agent-workflow skills

Usage:
  agent-workflow skills analyze [--skill-paths <paths>]
  agent-workflow skills recommend [--root <path>] [--skill-paths <paths>]

Default scan paths:
${defaultSkillScanPaths().map((scanPath) => `  - ${scanPath}`).join("\n")}
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  switch (args.command) {
    case "analyze":
      await runAnalyze(args);
      break;
    case "init":
    case "generate":
      await runGenerate(args);
      break;
    case "setup":
      await runSetup(args);
      break;
    case "diff":
      await runDiff(args);
      break;
    case "doctor":
      await runDoctor(args);
      break;
    case "mcp":
      await runMcp(args);
      break;
    case "skills":
      await runSkills(args);
      break;
    case "help":
    case "--help":
    case "-h":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${args.command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
