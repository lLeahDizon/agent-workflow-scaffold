#!/usr/bin/env node
import path from "node:path";
import { analyzeProject } from "./analyzers/projectAnalyzer.js";
import { diffGeneratedFiles } from "./diff.js";
import { doctorProject } from "./doctor.js";
import { inspectHeadroomInstall, installHeadroom } from "./headroom.js";
import {
  DEFAULT_HERMES_WORKSPACE,
  HERMES_WORKSPACE_INDEX,
  displayPath,
  doctorHermes,
  listHermesWorkspace,
  planHermesInitProject,
  planHermesRegister,
  writeHermesInitProject,
  writeHermesRegister
} from "./hermes.js";
import { generateProject } from "./generators/index.js";
import { renderMcpConfig } from "./generators/mcpConfig.js";
import { collectInteractiveInitOptions, createPromptSession } from "./interactive.js";
import { readManifest, resolveHeadroomOptions } from "./manifest.js";
import { startMcpServer } from "./mcp/server.js";
import { defaultSkillScanPaths, scanLocalSkills } from "./skills/scanner.js";
import type { AgentProvider, GenerateOptions, ProjectProfile, ProjectType, SkillRecommendation, TargetInput } from "./types.js";
import { upgradeProject } from "./upgrade.js";
import { formatProfileSummary, normalizeTarget, resolveRootPath } from "./utils/format.js";
import { writeGeneratedFiles } from "./writer/fileWriter.js";

interface CliArgs {
  command: string;
  flags: Record<string, string | boolean>;
  positionals: string[];
}

interface AnalyzeExplanation {
  summary: string[];
  evidence: string[];
  commandInference: string[];
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
    loopEngineering: Boolean(args.flags["loop-engineering"]),
    headroom: Boolean(args.flags.headroom),
    headroomCommand: flagString(args.flags, "headroom-command"),
    headroomArgs: flagList(args.flags, "headroom-args")
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
  headroom     显式安装和检查 Headroom 本机运行时
  hermes       注册电脑级 Hermes workspace，或生成项目级 .hermes.md
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
  agent-workflow headroom install
  agent-workflow headroom doctor
  agent-workflow hermes register --root /path/to/project
  agent-workflow hermes init-project --root /path/to/project
  agent-workflow hermes doctor --root /path/to/project
  agent-workflow hermes list
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
  --headroom                   可选启用 Headroom 上下文压缩配置；不传则跳过
  --headroom-command <cmd>     覆盖 Headroom MCP 启动命令，默认 headroom
  --headroom-args <args>       逗号分隔的 Headroom MCP 参数，默认 mcp,serve
  --backup                     upgrade 写入前备份将被更新的既有文件
  --interactive                进入中文问答式流程，目前支持 setup 和 init
  --write                      写入生成文件；不传时只预览，不修改项目文件
  --help, -h, -help            查看中文帮助，可放在命令后使用

analyze 参数：
  --json                       输出机器可读项目画像
  --explain                    输出画像判断依据

安全策略：
  默认不写文件；只有传入 --write 或在交互流程中确认写入才会落盘。
  文本文件使用 managed block 更新，JSON 文件使用结构化合并，避免覆盖用户手写配置。
`);
}

function printHermesHelp(): void {
  console.log(`agent-workflow hermes

用法：
  agent-workflow hermes register [--root <path>] [--workspace <path>] [--no-project-file] [--dry-run]
  agent-workflow hermes init-project [--root <path>] [--dry-run]
  agent-workflow hermes doctor [--root <path>] [--workspace <path>]
  agent-workflow hermes list [--workspace <path>]

命令：
  register      将一个项目注册到电脑级 Hermes workspace，默认 workspace 为 ~/HermesWorkspace
  init-project  只在项目内生成 .hermes.md 和脚手架 manifest，不写 workspace 索引
  doctor        检查项目 Hermes 配置和已记录 workspace 索引
  list          列出 workspace HERMES.md 中登记的项目

参数：
  --root <path>          项目根目录，默认当前目录
  --workspace <path>     Hermes workspace 目录，默认 ~/HermesWorkspace
  --no-project-file      register 时不写项目内 .hermes.md，仍写 manifest 和 workspace 索引
  --dry-run              只预览将写入/更新的文件列表和摘要，不写文件
  --help, -h, -help      查看 hermes 命令帮助

说明：
  - Hermes 是电脑级外部能力/运行时集成，不是 Codex、Trae、Claude Code 同级 target。
  - This scaffold does not install or start Hermes, and does not write ~/.hermes/config.yaml.
`);
}

function buildAnalyzeExplanation(profile: ProjectProfile): AnalyzeExplanation {
  const manifestText = profile.manifests.length > 0
    ? profile.manifests.map((manifest) => `${manifest.type}:${manifest.path}`).join(", ")
    : "none detected";
  const sourceText = profile.sourceDirs.length > 0 ? profile.sourceDirs.join(", ") : "none detected";
  const docsText = profile.docFiles.length > 0 ? profile.docFiles.join(", ") : "none detected";
  const existingConfig = Object.entries(profile.existingAgentConfig)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);
  const configText = existingConfig.length > 0 ? existingConfig.join(", ") : "none detected";
  const installText = profile.commands.install ?? "none inferred";
  const scriptLines = [
    ["dev", profile.commands.dev ?? []],
    ["build", profile.commands.build ?? []],
    ["test", profile.commands.test ?? []],
    ["lint", profile.commands.lint ?? []]
  ].map(([name, commands]) => `${name}: ${(commands as string[]).join(", ") || "none detected"}`);

  return {
    summary: [
      `Project type: ${profile.projectType}`,
      `Confidence: ${profile.confidence}`,
      `Empty project: ${profile.isEmptyProject ? "yes" : "no"}`
    ],
    evidence: [
      `Manifests: ${manifestText}`,
      `Source dirs: ${sourceText}`,
      `Docs: ${docsText}`,
      `Existing Agent config: ${configText}`
    ],
    commandInference: [
      `Install command: ${installText}`,
      ...scriptLines
    ]
  };
}

function formatAnalyzeExplanation(explanation: AnalyzeExplanation): string {
  return [
    "Project Profile Explanation",
    "",
    "Summary:",
    ...explanation.summary.map((line) => `- ${line}`),
    "",
    "Evidence:",
    ...explanation.evidence.map((line) => `- ${line}`),
    "",
    "Command inference:",
    ...explanation.commandInference.map((line) => `- ${line}`)
  ].join("\n");
}

function printHeadroomHelp(): void {
  console.log(`agent-workflow headroom

用法：
  agent-workflow headroom install [--force]
  agent-workflow headroom doctor

命令：
  install      安装 Headroom 到脚手架受管 venv
  doctor       检查受管安装、PATH 可用性与本机状态

参数：
  --force      强制重装，直接覆盖受管目录，不做备份
  --help, -h, -help  查看 headroom 命令帮助

说明：
  - 第一版只提供 install 和 doctor，不提供 uninstall / upgrade。
  - 不会自动修改 PATH；会输出安装路径和配置建议。
  - 浏览器 dashboard 与 proxy 不由脚手架自动管理。
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
  const json = Boolean(args.flags.json);
  const explain = Boolean(args.flags.explain);
  const explanation = explain ? buildAnalyzeExplanation(profile) : undefined;

  if (json) {
    console.log(JSON.stringify(explanation ? { profile, explanation } : profile, null, 2));
    return;
  }

  if (explanation) {
    console.log(formatAnalyzeExplanation(explanation));
    return;
  }

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

async function runHeadroom(args: CliArgs): Promise<void> {
  const subcommand = args.positionals[0] ?? "help";
  if (["help", "--help", "-h", "-help"].includes(subcommand) || args.flags.help === true) {
    printHeadroomHelp();
    return;
  }

  if (subcommand === "install") {
    const result = await installHeadroom({ force: Boolean(args.flags.force) });
    console.log(`Headroom home: ${result.homePath}`);
    console.log(`Venv: ${result.venvPath}`);
    console.log(`Executable: ${result.executablePath}`);
    console.log(`PATH command: ${result.pathCommandFound ? "available" : "not found"}`);
    console.log(`Python: ${result.pythonVersion}`);
    console.log(result.skipped ? "Headroom already installed; skipped." : "Headroom installed.");
    console.log("PATH was not modified. Configure your client or shell manually if needed.");
    return;
  }

  if (subcommand === "doctor") {
    const result = await inspectHeadroomInstall();
    console.log(`Headroom home: ${result.homePath}`);
    console.log(`Venv: ${result.venvPath}`);
    console.log(`Install state: ${result.stateExists ? result.statePath : "missing"}`);
    console.log(`Executable: ${result.executableExists ? result.executablePath : "missing"}`);
    console.log(`PATH command: ${result.pathCommandFound ? "available" : "not found"}`);
    if (result.installState) {
      console.log(`Installed at: ${result.installState.installedAt}`);
      console.log(`Python: ${result.installState.pythonVersion}`);
    }
    if (!result.executableExists || !result.pathCommandFound) {
      console.log("Warning: Headroom is not fully available in the current environment.");
    } else {
      console.log("Headroom doctor: OK");
    }
    return;
  }

  console.error(`未知 headroom 子命令：${subcommand}`);
  printHeadroomHelp();
  process.exitCode = 1;
}

function printHermesActionSummary(actions: Array<{ path: string; action: string }>): void {
  console.log("Files:");
  for (const action of actions) {
    console.log(`- ${action.action.padEnd(9)} ${displayPath(action.path)}`);
  }
}

function printHermesWarnings(warnings: string[]): void {
  for (const warning of warnings) {
    console.log(`Warning: ${warning}`);
  }
}

async function runHermes(args: CliArgs): Promise<void> {
  const subcommand = args.positionals[0] ?? "help";
  if (["help", "--help", "-h", "-help"].includes(subcommand) || args.flags.help === true) {
    printHermesHelp();
    return;
  }

  if (subcommand === "register") {
    const options = {
      rootPath: flagString(args.flags, "root"),
      workspacePath: flagString(args.flags, "workspace"),
      dryRun: Boolean(args.flags["dry-run"]),
      projectFile: !Boolean(args.flags["no-project-file"])
    };
    if (options.dryRun) {
      const plan = await planHermesRegister(options);
      console.log("Hermes register dry-run");
      console.log(`Workspace: ${displayPath(plan.workspacePath ?? DEFAULT_HERMES_WORKSPACE)}`);
      console.log(`Workspace index: ${displayPath(plan.workspaceIndexPath ?? path.join(plan.workspacePath ?? DEFAULT_HERMES_WORKSPACE, HERMES_WORKSPACE_INDEX))}`);
      console.log(`Project: ${displayPath(plan.rootPath)}`);
      console.log(`Registered project: ${plan.project.displayName} (${plan.project.status})`);
      printHermesWarnings(plan.warnings);
      printHermesActionSummary(plan.actions);
      return;
    }

    const result = await writeHermesRegister(options);
    console.log("Hermes project registered");
    console.log(`Workspace: ${displayPath(result.workspacePath ?? DEFAULT_HERMES_WORKSPACE)}`);
    console.log(`Workspace index: ${displayPath(result.workspaceIndexPath ?? path.join(result.workspacePath ?? DEFAULT_HERMES_WORKSPACE, HERMES_WORKSPACE_INDEX))}`);
    console.log(`Project: ${displayPath(result.rootPath)}`);
    console.log(`Registered project: ${result.project.displayName} (${result.project.status})`);
    printHermesWarnings(result.warnings);
    printHermesActionSummary(result.writes.map((write) => ({
      path: path.isAbsolute(write.relativePath) ? write.relativePath : path.join(result.rootPath, write.relativePath),
      action: write.action
    })));
    return;
  }

  if (subcommand === "init-project") {
    const options = {
      rootPath: flagString(args.flags, "root"),
      dryRun: Boolean(args.flags["dry-run"])
    };
    if (options.dryRun) {
      const plan = await planHermesInitProject(options);
      console.log("Hermes init-project dry-run");
      console.log(`Project: ${displayPath(plan.rootPath)}`);
      console.log(`Project context: ${plan.project.projectFile ?? "disabled"}`);
      printHermesWarnings(plan.warnings);
      printHermesActionSummary(plan.actions);
      return;
    }

    const result = await writeHermesInitProject(options);
    console.log("Hermes project context written");
    console.log(`Project: ${displayPath(result.rootPath)}`);
    printHermesWarnings(result.warnings);
    printHermesActionSummary(result.writes.map((write) => ({
      path: path.join(result.rootPath, write.relativePath),
      action: write.action
    })));
    return;
  }

  if (subcommand === "doctor") {
    const result = await doctorHermes({
      rootPath: flagString(args.flags, "root"),
      workspacePath: flagString(args.flags, "workspace")
    });
    console.log(result.ok ? "Hermes doctor: OK" : "Hermes doctor: issues found");
    console.log(`Project: ${displayPath(result.rootPath)}`);
    if (result.workspacePath) {
      console.log(`Workspace: ${displayPath(result.workspacePath)}`);
    }
    for (const issue of result.issues) {
      console.log(`- [${issue.level}] ${issue.relativePath}: ${issue.message}`);
    }
    if (!result.ok) {
      process.exitCode = 1;
    }
    return;
  }

  if (subcommand === "list") {
    const workspacePath = flagString(args.flags, "workspace") ?? DEFAULT_HERMES_WORKSPACE;
    const index = await listHermesWorkspace({ workspacePath });
    console.log(`Hermes workspace: ${displayPath(path.join(workspacePath, HERMES_WORKSPACE_INDEX))}`);
    if (index.projects.length === 0) {
      console.log("No registered projects.");
      return;
    }
    for (const project of index.projects) {
      console.log(`- ${project.displayName} | ${project.status} | ${project.projectType} | ${project.confidence} | ${displayPath(project.rootPath)}`);
    }
    return;
  }

  console.error(`未知 hermes 子命令：${subcommand}`);
  printHermesHelp();
  process.exitCode = 1;
}

async function runMcp(args: CliArgs): Promise<void> {
  const options = buildOptions(args);
  if (args.positionals[0] === "serve") {
    await startMcpServer();
    return;
  }

  const profile = await analyzeProject(options);
  const targets = normalizeTarget(options.target);
  const manifest = await readManifest(profile.rootPath);
  const headroom = resolveHeadroomOptions({
    headroom: options.headroom,
    headroomCommand: options.headroomCommand,
    headroomArgs: options.headroomArgs,
    existingManifest: manifest
  });
  for (const target of targets) {
    console.log(`# ${target}`);
    console.log(renderMcpConfig(target, profile, headroom.enabled ? headroom : undefined));
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
    } else if (args.command === "headroom") {
      printHeadroomHelp();
    } else if (args.command === "hermes") {
      printHermesHelp();
    } else {
      printHelp();
    }
    return;
  }
  if (args.command !== "analyze" && ("json" in args.flags || "explain" in args.flags)) {
    console.error("--json and --explain are only supported by analyze in this version.");
    process.exitCode = 1;
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
    case "headroom":
      await runHeadroom(args);
      break;
    case "hermes":
      await runHermes(args);
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
