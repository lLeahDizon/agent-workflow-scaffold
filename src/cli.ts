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
import { upgradeProject } from "./upgrade.js";
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

function buildOptions(args: CliArgs, defaults: Partial<GenerateOptions> = { target: "all" }): GenerateOptions {
  return {
    rootPath: resolveRootPath(flagString(args.flags, "root")),
    projectType: (flagString(args.flags, "project-type") as ProjectType | undefined) ?? "auto",
    target: (flagString(args.flags, "target") as TargetInput | undefined) ?? defaults.target,
    agentProvider: (flagString(args.flags, "agent-provider") as AgentProvider | undefined) ?? "builtin",
    agencyAgentsPath: flagString(args.flags, "agency-agents-path"),
    agentRoles: flagList(args.flags, "agent-roles"),
    agentDivisions: flagList(args.flags, "agent-divisions"),
    skillPaths: flagList(args.flags, "skill-paths"),
    loopEngineering: Boolean(args.flags["loop-engineering"])
  };
}

function isTopLevelHelpCommand(command: string): boolean {
  return ["help", "--help", "-h", "-help"].includes(command);
}

function isHelpRequest(args: CliArgs): boolean {
  if (isTopLevelHelpCommand(args.command)) {
    return true;
  }
  if (args.flags.help === true) {
    return true;
  }
  return args.positionals.some((item) => ["help", "--help", "-h", "-help"].includes(item));
}

function printHelp(): void {
  console.log(`agent-workflow

用法：
  agent-workflow <command> [options]
  agent-workflow -h
  agent-workflow -help
  agent-workflow --help
  agent-workflow help

推荐流程：
  agent-workflow setup                         分析项目并预览完整配置，不写入文件
  agent-workflow setup --interactive           进入中文问答式初始化流程
  agent-workflow setup --target all --write    写入配置并自动执行 doctor 检查
  agent-workflow upgrade                       升级已配置过的 Agent 工作流，默认只预览

命令：
  analyze      只分析当前项目画像，不写文件
  setup        串行执行 analyze、skill 推荐、生成预览或写入、doctor 检查
  upgrade      升级已有 Agent 工作流配置，支持 --write 和 --backup
  init         根据项目画像生成 Agent 工作流配置，默认只预览
  generate     与 init 行为接近，适合脚本中表达生成动作
  diff         对比当前文件与将生成内容的差异摘要
  doctor       检查 AGENTS、skills、hooks、MCP、Subagents 配置是否完整
  mcp          输出目标环境 MCP 配置片段
  mcp serve    启动本地 MCP stdio server
  skills       扫描本地 SKILL.md，或根据项目画像推荐 skills
  help         查看本帮助

常用示例：
  agent-workflow analyze --root /path/to/project
  agent-workflow upgrade --backup --write
  agent-workflow init --target codex --write
  agent-workflow generate --target trae
  agent-workflow diff --target all
  agent-workflow doctor --target all
  agent-workflow mcp --target claude-code
  agent-workflow skills analyze
  agent-workflow skills recommend --root /path/to/project

通用参数：
  --root <path>                目标项目根目录，默认是当前目录
  --project-type <type>        auto|python-crm|umi-react|h5|management|custom
  --target <target>            codex|trae|claude-code|all，默认 all
  --agent-provider <type>      builtin|agency-agents|hybrid，默认 builtin
  --agency-agents-path <path>  本地 agency-agents 仓库路径
  --agent-roles <ids>          逗号分隔的 agency-agents 角色 id
  --agent-divisions <ids>      逗号分隔的 agency-agents division id
  --skill-paths <paths>        逗号分隔的 SKILL.md 扫描根目录
  --loop-engineering           可选启用 Loop Engineering 循环工程说明；不传则跳过
  --backup                     upgrade 写入前备份将被更新的既有文件
  --interactive                进入中文问答式流程，目前支持 setup 和 init
  --write                      写入生成文件；不传时只预览，不修改项目文件
  --help, -h, -help            查看中文帮助，可放在命令后使用

安全策略：
  默认不写文件；只有传入 --write 或在交互流程中确认写入才会落盘。
  文本文件使用 managed block 更新，JSON 文件使用结构化合并，避免覆盖用户手写配置。
`);
}

function printSkillsHelp(): void {
  console.log(`agent-workflow skills

用法：
  agent-workflow skills analyze [--skill-paths <paths>]
  agent-workflow skills recommend [--root <path>] [--skill-paths <paths>]

命令：
  analyze      扫描本机或指定目录中的 SKILL.md 元信息，不复制、不安装、不修改全局 skill
  recommend    先分析目标项目，再输出 baseline、project、optional 三类 skill 推荐

参数：
  --root <path>          目标项目根目录，默认是当前目录
  --skill-paths <paths>  逗号分隔的 SKILL.md 扫描根目录
  --help, -h, -help      查看 skills 命令帮助

默认扫描路径：
${defaultSkillScanPaths().map((scanPath) => `  - ${scanPath}`).join("\n")}
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

async function runUpgrade(args: CliArgs): Promise<void> {
  const result = await upgradeProject({
    ...buildOptions(args, { target: undefined }),
    write: Boolean(args.flags.write),
    backup: Boolean(args.flags.backup)
  });
  if (result.skippedReason) {
    console.log(result.skippedReason);
    process.exitCode = 1;
    return;
  }

  console.log(`Upgrade targets: ${result.targets.join(", ")}`);
  console.log(Boolean(args.flags.write) ? "Upgrade write plan:" : "Upgrade preview. Re-run with --write to apply:");
  for (const diff of result.diff) {
    console.log(`- ${diff.status.padEnd(9)} ${diff.relativePath}`);
  }

  if (!args.flags.write) {
    console.log("");
    console.log("No files were written.");
    return;
  }

  if (result.backupPath) {
    console.log("");
    console.log(`Backup created: ${result.backupPath}`);
  }
  console.log("");
  console.log("Write result:");
  for (const item of result.writes) {
    console.log(`- ${item.action.padEnd(9)} ${item.relativePath}`);
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
  if (["help", "--help", "-h", "-help"].includes(subcommand) || args.flags.help === true) {
    printSkillsHelp();
    return;
  }

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

  console.error(`未知 skills 子命令：${subcommand}`);
  printSkillsHelp();
  process.exitCode = 1;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (isHelpRequest(args)) {
    if (args.command === "skills") {
      printSkillsHelp();
    } else {
      printHelp();
    }
    return;
  }

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
    case "upgrade":
      await runUpgrade(args);
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
    default:
      console.error(`未知命令：${args.command}`);
      printHelp();
      process.exitCode = 1;
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
