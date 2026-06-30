import os from "node:os";
import path from "node:path";
import { analyzeProject } from "./analyzers/projectAnalyzer.js";
import { markdownBlock } from "./generators/helpers.js";
import { buildHermesManifest, manifestFile, readManifest } from "./manifest.js";
import type { GeneratedFile, ProjectManifestInfo, ProjectProfile, WriteResult } from "./types.js";
import { ensureDirectory, pathExists, readTextIfExists, writeTextFile } from "./utils/fs.js";
import { resolveRootPath } from "./utils/format.js";
import { materializeFile, writeGeneratedFiles } from "./writer/fileWriter.js";
import { applyManagedText } from "./writer/managedBlock.js";

export const HERMES_PROJECT_FILE = ".hermes.md";
export const HERMES_WORKSPACE_INDEX = "HERMES.md";
export const DEFAULT_HERMES_WORKSPACE = path.join(os.homedir(), "HermesWorkspace");
export const HERMES_WORKSPACE_SCHEMA_VERSION = 1;

export type HermesProjectStatus = "available" | "missing";

export interface HermesWorkspaceProject {
  rootPath: string;
  projectId: string;
  displayName: string;
  projectType: string;
  confidence: ProjectProfile["confidence"];
  isEmptyProject: boolean;
  status: HermesProjectStatus;
  manifests: ProjectManifestInfo[];
  commands: ProjectProfile["commands"];
  projectFile: typeof HERMES_PROJECT_FILE | null;
  agentEntrypoints: string[];
  updatedAt: string;
}

export interface HermesWorkspaceIndex {
  schemaVersion: 1;
  projects: HermesWorkspaceProject[];
}

export interface HermesRegisterOptions {
  rootPath?: string;
  workspacePath?: string;
  dryRun?: boolean;
  projectFile?: boolean;
  updatedAt?: string;
}

export interface HermesInitProjectOptions {
  rootPath?: string;
  dryRun?: boolean;
  updatedAt?: string;
}

export interface HermesPlannedAction {
  path: string;
  action: "create" | "update" | "unchanged" | "skip";
}

export interface HermesWritePlan {
  dryRun: boolean;
  rootPath: string;
  workspacePath?: string;
  workspaceIndexPath?: string;
  project: HermesWorkspaceProject;
  warnings: string[];
  actions: HermesPlannedAction[];
  files: GeneratedFile[];
  workspaceContent?: string;
}

export interface HermesWriteResult extends HermesWritePlan {
  writes: WriteResult[];
}

const AGENT_ENTRYPOINT_CANDIDATES = [
  HERMES_PROJECT_FILE,
  "AGENTS.md",
  "CLAUDE.md",
  ".trae/AGENTS.md",
  ".codex/config.toml",
  ".claude/settings.json",
  ".agent-workflow/manifest.json",
  "README.md"
] as const;

const WORKSPACE_INDEX_PATTERN = /<!-- agent-workflow-scaffold:hermes-workspace-index\s*([\s\S]*?)\s*-->/;

export function normalizeHermesPath(inputPath: string): string {
  return path.resolve(inputPath);
}

export function displayPath(inputPath: string): string {
  const absolute = path.resolve(inputPath);
  const home = os.homedir();
  if (absolute === home) {
    return "~";
  }
  const relative = path.relative(home, absolute);
  if (relative && !relative.startsWith("..") && !path.isAbsolute(relative)) {
    return `~/${relative.split(path.sep).join("/")}`;
  }
  return absolute.split(path.sep).join("/");
}

export async function projectToHermesEntry(
  profile: ProjectProfile,
  options: { projectFile: typeof HERMES_PROJECT_FILE | null; updatedAt: string }
): Promise<HermesWorkspaceProject> {
  const agentEntrypoints: string[] = [];
  for (const candidate of AGENT_ENTRYPOINT_CANDIDATES) {
    if (await pathExists(path.join(profile.rootPath, candidate))) {
      agentEntrypoints.push(candidate);
    }
  }

  return {
    rootPath: normalizeHermesPath(profile.rootPath),
    projectId: profile.projectId,
    displayName: profile.displayName,
    projectType: profile.projectType,
    confidence: profile.confidence,
    isEmptyProject: profile.isEmptyProject,
    status: "available",
    manifests: profile.manifests,
    commands: profile.commands,
    projectFile: options.projectFile,
    agentEntrypoints,
    updatedAt: options.updatedAt
  };
}

function formatCommandList(commands: string[] | undefined): string {
  return commands?.length ? commands.map((command) => `\`${command}\``).join(", ") : "none detected";
}

function manifestSummary(manifests: ProjectManifestInfo[]): string {
  return manifests.map((manifest) => `${manifest.type}:${manifest.path}`).join(", ") || "none detected";
}

export function renderHermesProjectMarkdown(
  profile: ProjectProfile,
  options: { workspaceIndexPath?: string } = {}
): string {
  const body = [
    `# ${profile.displayName} Hermes Context`,
    "",
    "## Project Profile",
    `- Project: ${profile.displayName}`,
    `- Root: ${displayPath(profile.rootPath)}`,
    `- Type: ${profile.projectType}`,
    `- Confidence: ${profile.confidence}`,
    `- Empty project: ${profile.isEmptyProject ? "yes" : "no"}`,
    `- Manifests: ${manifestSummary(profile.manifests)}`,
    ...(options.workspaceIndexPath ? [`- Workspace index: ${displayPath(options.workspaceIndexPath)}`] : []),
    "",
    "## Read First",
    "- `.hermes.md`",
    "- `AGENTS.md` when present",
    "- `CLAUDE.md` when present",
    "- `.trae/AGENTS.md` when present",
    "- `README.md` and project docs when present",
    "",
    "## Useful Commands",
    profile.commands.install ? `- Install: \`${profile.commands.install}\`` : "- Install: none detected",
    `- Dev: ${formatCommandList(profile.commands.dev)}`,
    `- Build: ${formatCommandList(profile.commands.build)}`,
    `- Test: ${formatCommandList(profile.commands.test)}`,
    `- Lint: ${formatCommandList(profile.commands.lint)}`,
    "",
    "## Boundaries",
    "- Treat this directory as the project boundary unless the Hermes workspace index explicitly links another project.",
    "- Preserve user changes and existing agent-workflow managed blocks.",
    "- Do not write secrets, Hermes global config, sessions, or runtime state from this project context.",
    "- Hermes runtime installation and `~/.hermes/config.yaml` are managed by Hermes, not by this scaffold.",
    ...(profile.isEmptyProject || profile.confidence === "low"
      ? ["- This project currently has low-confidence profile evidence. Re-run `agent-workflow hermes register` after adding manifest, docs, or source files."]
      : [])
  ].join("\n");

  return `${markdownBlock("hermes", body)}\n`;
}

export function renderHermesWorkspaceMarkdown(index: HermesWorkspaceIndex): string {
  const projects = [...index.projects].sort((left, right) => left.displayName.localeCompare(right.displayName));
  const json = JSON.stringify({ schemaVersion: HERMES_WORKSPACE_SCHEMA_VERSION, projects }, null, 2);
  const tableRows = projects.map((project) => {
    const commandKinds = ["test", "build", "lint", "dev"].filter((kind) => {
      const value = project.commands[kind as keyof typeof project.commands];
      return Array.isArray(value) && value.length > 0;
    });
    return `| ${project.displayName} | ${project.status} | ${project.projectType} | ${project.confidence} | \`${displayPath(project.rootPath)}\` | ${commandKinds.join(", ") || "none detected"} |`;
  });
  const body = [
    "# Hermes Workspace",
    "",
    "<!-- agent-workflow-scaffold:hermes-workspace-index",
    json,
    "-->",
    "",
    "## Registered Projects",
    "",
    "| Project | Status | Type | Confidence | Root | Commands |",
    "| --- | --- | --- | --- | --- | --- |",
    ...tableRows,
    "",
    "## Coordination Rules",
    "",
    "- Use each project's `.hermes.md` before editing that project.",
    "- Treat project roots as separate boundaries.",
    "- Do not write secrets or Hermes global config from this workspace index.",
    "- Prefer the smallest project-local verification command.",
    "- Hermes runtime installation and `~/.hermes/config.yaml` are managed by Hermes, not by this scaffold."
  ].join("\n");

  return `${markdownBlock("hermes-workspace", body)}\n`;
}

export function parseHermesWorkspaceIndex(markdown: string): HermesWorkspaceIndex | undefined {
  const match = WORKSPACE_INDEX_PATTERN.exec(markdown);
  if (!match) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(match[1]) as HermesWorkspaceIndex;
    if (parsed.schemaVersion !== HERMES_WORKSPACE_SCHEMA_VERSION || !Array.isArray(parsed.projects)) {
      throw new Error("Invalid Hermes workspace index schema.");
    }
    return parsed;
  } catch {
    throw new Error("Hermes workspace index is corrupted: failed to parse managed project index.");
  }
}

export async function mergeHermesWorkspaceProjects(
  existing: HermesWorkspaceIndex | undefined,
  incoming: HermesWorkspaceProject
): Promise<HermesWorkspaceIndex> {
  const byRootPath = new Map<string, HermesWorkspaceProject>();

  for (const project of existing?.projects ?? []) {
    const rootPath = normalizeHermesPath(project.rootPath);
    byRootPath.set(rootPath, {
      ...project,
      rootPath,
      status: (await pathExists(rootPath)) ? "available" : "missing"
    });
  }

  byRootPath.set(incoming.rootPath, { ...incoming, status: "available" });

  return {
    schemaVersion: HERMES_WORKSPACE_SCHEMA_VERSION,
    projects: Array.from(byRootPath.values()).sort((left, right) => left.displayName.localeCompare(right.displayName))
  };
}

function buildWarnings(profile: ProjectProfile): string[] {
  return profile.isEmptyProject || profile.confidence === "low"
    ? ["Project appears empty or low confidence; registered with limited inferred commands."]
    : [];
}

async function plannedAction(targetPath: string, nextContent: string): Promise<HermesPlannedAction> {
  const existing = await readTextIfExists(targetPath);
  if (existing === undefined) {
    return { path: targetPath, action: "create" };
  }
  return { path: targetPath, action: existing === nextContent ? "unchanged" : "update" };
}

function projectFiles(profile: ProjectProfile, input: {
  projectFile: typeof HERMES_PROJECT_FILE | null;
  workspacePath?: string;
  workspaceIndexPath?: string;
  existingManifest?: Awaited<ReturnType<typeof readManifest>>;
}): GeneratedFile[] {
  const files: GeneratedFile[] = [];
  if (input.projectFile) {
    files.push({
      target: "codex",
      relativePath: HERMES_PROJECT_FILE,
      content: renderHermesProjectMarkdown(profile, {
        workspaceIndexPath: input.workspaceIndexPath
      }),
      mode: "managed-text"
    });
  }
  files.push(manifestFile(buildHermesManifest({
    projectId: profile.projectId,
    existingManifest: input.existingManifest,
    hermes: {
      ...(input.workspacePath ? { workspacePath: input.workspacePath, workspaceIndex: HERMES_WORKSPACE_INDEX } : {}),
      projectFile: input.projectFile
    }
  })));
  return files;
}

async function materializeProjectActions(rootPath: string, files: GeneratedFile[]): Promise<HermesPlannedAction[]> {
  const actions: HermesPlannedAction[] = [];
  for (const file of files) {
    const targetPath = path.resolve(rootPath, file.relativePath);
    actions.push(await plannedAction(targetPath, await materializeFile(rootPath, file)));
  }
  return actions;
}

export async function planHermesRegister(options: HermesRegisterOptions = {}): Promise<HermesWritePlan> {
  const rootPath = resolveRootPath(options.rootPath);
  if (!(await pathExists(rootPath))) {
    throw new Error(`Hermes project root does not exist: ${rootPath}`);
  }
  const workspacePath = normalizeHermesPath(options.workspacePath ?? DEFAULT_HERMES_WORKSPACE);
  if (normalizeHermesPath(rootPath) === workspacePath) {
    throw new Error("Hermes workspace and project root must be different. If you are running from the workspace directory, pass --root /path/to/project.");
  }
  const workspaceIndexPath = path.join(workspacePath, HERMES_WORKSPACE_INDEX);
  const profile = await analyzeProject({ rootPath, skillPaths: [] });
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const projectFile = options.projectFile === false ? null : HERMES_PROJECT_FILE;
  const project = await projectToHermesEntry(profile, { projectFile, updatedAt });
  const existingWorkspaceText = await readTextIfExists(workspaceIndexPath);
  const mergedIndex = await mergeHermesWorkspaceProjects(
    existingWorkspaceText ? parseHermesWorkspaceIndex(existingWorkspaceText) : undefined,
    project
  );
  const workspaceContent = applyManagedText(existingWorkspaceText, renderHermesWorkspaceMarkdown(mergedIndex));
  const existingManifest = await readManifest(rootPath);
  const files = projectFiles(profile, {
    projectFile,
    workspacePath,
    workspaceIndexPath,
    existingManifest
  });
  return {
    dryRun: Boolean(options.dryRun),
    rootPath,
    workspacePath,
    workspaceIndexPath,
    project,
    warnings: buildWarnings(profile),
    actions: [
      await plannedAction(workspaceIndexPath, workspaceContent),
      ...(await materializeProjectActions(rootPath, files))
    ],
    files,
    workspaceContent
  };
}

export async function writeHermesRegister(options: HermesRegisterOptions = {}): Promise<HermesWriteResult> {
  const plan = await planHermesRegister({ ...options, dryRun: false });
  const writes: WriteResult[] = [];
  if (!plan.workspacePath || !plan.workspaceIndexPath || plan.workspaceContent === undefined) {
    throw new Error("Hermes register plan is missing workspace output.");
  }

  await ensureDirectory(plan.workspacePath);
  const workspaceExisted = await pathExists(plan.workspaceIndexPath);
  const previousWorkspace = await readTextIfExists(plan.workspaceIndexPath);
  if (previousWorkspace === plan.workspaceContent) {
    writes.push({ relativePath: plan.workspaceIndexPath, action: "unchanged" });
  } else {
    await writeTextFile(plan.workspaceIndexPath, plan.workspaceContent);
    writes.push({ relativePath: plan.workspaceIndexPath, action: workspaceExisted ? "updated" : "created" });
  }
  writes.push(...await writeGeneratedFiles(plan.rootPath, plan.files));
  return { ...plan, writes };
}

export async function planHermesInitProject(options: HermesInitProjectOptions = {}): Promise<HermesWritePlan> {
  const rootPath = resolveRootPath(options.rootPath);
  if (!(await pathExists(rootPath))) {
    throw new Error(`Hermes project root does not exist: ${rootPath}`);
  }
  const profile = await analyzeProject({ rootPath, skillPaths: [] });
  const updatedAt = options.updatedAt ?? new Date().toISOString();
  const project = await projectToHermesEntry(profile, {
    projectFile: HERMES_PROJECT_FILE,
    updatedAt
  });
  const existingManifest = await readManifest(rootPath);
  const files = projectFiles(profile, {
    projectFile: HERMES_PROJECT_FILE,
    existingManifest
  });
  return {
    dryRun: Boolean(options.dryRun),
    rootPath,
    project,
    warnings: buildWarnings(profile),
    actions: await materializeProjectActions(rootPath, files),
    files
  };
}

export async function writeHermesInitProject(options: HermesInitProjectOptions = {}): Promise<HermesWriteResult> {
  const plan = await planHermesInitProject({ ...options, dryRun: false });
  return {
    ...plan,
    writes: await writeGeneratedFiles(plan.rootPath, plan.files)
  };
}
