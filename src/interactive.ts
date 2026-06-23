import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { Readable } from "node:stream";
import { defaultAgencyAgentsCachePath, ensureAgencyAgentsCache } from "./templates/agencyAgentsInstaller.js";
import type { AgentProvider, GenerateOptions, ProjectType, TargetInput } from "./types.js";
import { resolveRootPath } from "./utils/format.js";

export interface InteractiveInitResult {
  options: GenerateOptions;
  write: boolean;
}

export interface InteractiveInitDefaults extends GenerateOptions {
  write?: boolean;
}

export interface InteractiveLogger {
  log(message?: string): void;
}

export interface PromptSession {
  question(query: string): Promise<string>;
  close(): void;
}

export class BufferedPromptSession implements PromptSession {
  private index = 0;
  private readonly lines: Promise<string[]>;

  constructor(private readonly source: Readable, private readonly sink: NodeJS.WritableStream) {
    this.lines = this.readLines();
  }

  async question(query: string): Promise<string> {
    this.sink.write(query);
    const lines = await this.lines;
    return lines[this.index++] ?? "";
  }

  close(): void {
    return undefined;
  }

  private async readLines(): Promise<string[]> {
    let raw = "";
    for await (const chunk of this.source) {
      raw += String(chunk);
    }
    return raw.split(/\r?\n/);
  }
}

const TARGETS = ["all", "codex", "trae", "claude-code"] as const;
const PROJECT_TYPES = ["auto", "python-crm", "umi-react", "h5", "management", "custom"] as const;
const AGENT_PROVIDERS = ["builtin", "agency-agents", "hybrid"] as const;
const AGENCY_AGENTS_PATH_ACTIONS = ["builtin", "path", "clone"] as const;

function includes<const T extends readonly string[]>(values: T, value: string): value is T[number] {
  return (values as readonly string[]).includes(value);
}

function trimOrDefault(value: string, defaultValue: string): string {
  const trimmed = value.trim();
  return trimmed || defaultValue;
}

function parseList(value: string): string[] | undefined {
  const items = value.split(",").map((item) => item.trim()).filter(Boolean);
  return items.length > 0 ? items : undefined;
}

function defaultChoice<const T extends readonly string[]>(values: T, value: string | undefined, fallback: T[number]): T[number] {
  return value && includes(values, value) ? value : fallback;
}

async function askChoice<const T extends readonly string[]>(
  prompt: PromptSession,
  logger: InteractiveLogger,
  label: string,
  choices: T,
  defaultValue: T[number]
): Promise<T[number]> {
  const answer = trimOrDefault(
    await prompt.question(`${label}（${choices.join(" / ")}，默认 ${defaultValue}）：`),
    defaultValue
  );
  if (includes(choices, answer)) {
    return answer;
  }
  logger.log(`输入无效，已使用默认值：${defaultValue}`);
  return defaultValue;
}

async function askYesNo(prompt: PromptSession, label: string, defaultValue: boolean): Promise<boolean> {
  const suffix = defaultValue ? "Y/n" : "y/N";
  const answer = trimOrDefault(await prompt.question(`${label}（${suffix}）：`), defaultValue ? "y" : "n").toLowerCase();
  return ["y", "yes", "是", "确认", "写入"].includes(answer);
}

async function resolveAgencyAgentsPath(
  prompt: PromptSession,
  logger: InteractiveLogger,
  defaultPath: string | undefined
): Promise<{ agentProvider?: AgentProvider; agencyAgentsPath?: string }> {
  const pathAnswer = trimOrDefault(
    await prompt.question(`agency-agents 本地路径（留空可选择后续操作，默认 ${defaultPath ?? "未配置"}）：`),
    defaultPath ?? ""
  );
  if (pathAnswer) {
    return { agencyAgentsPath: pathAnswer };
  }

  logger.log("未填写 agency-agents 本地路径。");
  const action = await askChoice(
    prompt,
    logger,
    "请选择处理方式",
    AGENCY_AGENTS_PATH_ACTIONS,
    "builtin"
  );

  if (action === "builtin") {
    logger.log("已改用 builtin 内置角色来源。");
    return { agentProvider: "builtin", agencyAgentsPath: undefined };
  }

  if (action === "path") {
    const manualPath = trimOrDefault(await prompt.question("请输入 agency-agents 本地路径："), "");
    if (manualPath) {
      return { agencyAgentsPath: manualPath };
    }
    logger.log("仍未填写路径，已改用 builtin 内置角色来源。");
    return { agentProvider: "builtin", agencyAgentsPath: undefined };
  }

  const cachePath = defaultAgencyAgentsCachePath();
  logger.log(`将 clone agency-agents 到本地缓存：${cachePath}`);
  const agencyAgentsPath = await ensureAgencyAgentsCache(cachePath);
  logger.log(`agency-agents 已就绪：${agencyAgentsPath}`);
  return { agencyAgentsPath };
}

export function createPromptSession(): PromptSession {
  if (!input.isTTY) {
    return new BufferedPromptSession(input, output);
  }
  return readline.createInterface({ input, output });
}

export async function collectInteractiveInitOptions(
  prompt: PromptSession,
  defaults: InteractiveInitDefaults = {},
  logger: InteractiveLogger = console
): Promise<InteractiveInitResult> {
  logger.log("Agent Workflow 中文初始化向导");
  logger.log("默认只生成预览；只有最后确认写入后才会修改项目文件。");
  logger.log("");

  const defaultRoot = resolveRootPath(defaults.rootPath);
  const rootAnswer = await prompt.question(`目标项目目录（默认 ${defaultRoot}）：`);
  const rootPath = resolveRootPath(trimOrDefault(rootAnswer, defaultRoot));
  const target = await askChoice(prompt, logger, "目标环境", TARGETS, defaultChoice(TARGETS, defaults.target, "all")) as TargetInput;
  const projectType = await askChoice(prompt, logger, "项目类型", PROJECT_TYPES, defaultChoice(PROJECT_TYPES, defaults.projectType, "auto")) as ProjectType;
  let agentProvider = await askChoice(prompt, logger, "Agent 角色来源", AGENT_PROVIDERS, defaultChoice(AGENT_PROVIDERS, defaults.agentProvider, "builtin")) as AgentProvider;

  let agencyAgentsPath = defaults.agencyAgentsPath;
  let agentRoles = defaults.agentRoles;
  let agentDivisions = defaults.agentDivisions;
  if (agentProvider !== "builtin") {
    const resolved = await resolveAgencyAgentsPath(prompt, logger, agencyAgentsPath);
    if (resolved.agentProvider) {
      agentProvider = resolved.agentProvider;
      agentRoles = undefined;
      agentDivisions = undefined;
    } else {
      agencyAgentsPath = resolved.agencyAgentsPath;
      agentRoles = parseList(await prompt.question(`指定角色 id（逗号分隔，默认 ${agentRoles?.join(",") ?? "自动选择"}）：`)) ?? agentRoles;
      agentDivisions = parseList(await prompt.question(`指定 division（逗号分隔，默认 ${agentDivisions?.join(",") ?? "engineering"}）：`)) ?? agentDivisions;
    }
  }

  const skillPaths = parseList(await prompt.question(`本地 skill 扫描路径（逗号分隔，默认 ${defaults.skillPaths?.join(",") ?? "使用默认路径"}）：`)) ?? defaults.skillPaths;
  const write = await askYesNo(prompt, "是否写入生成结果", defaults.write ?? false);

  return {
    options: {
      rootPath,
      target,
      projectType,
      agentProvider,
      agencyAgentsPath,
      agentRoles,
      agentDivisions,
      skillPaths
    },
    write
  };
}
