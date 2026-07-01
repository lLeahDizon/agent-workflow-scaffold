import os from "node:os";
import path from "node:path";
import { analyzeProject } from "./analyzers/projectAnalyzer.js";
import { markdownBlock } from "./generators/helpers.js";
import { buildHermesManifest, manifestFile, readManifest } from "./manifest.js";
import type { GeneratedFile, ProjectManifestInfo, ProjectProfile, WriteResult } from "./types.js";
import { SCAFFOLD_VERSION } from "./version.js";
import { ensureDirectory, pathExists, readTextIfExists, writeTextFile } from "./utils/fs.js";
import { resolveRootPath } from "./utils/format.js";
import { materializeFile, writeGeneratedFiles } from "./writer/fileWriter.js";
import { applyManagedText, assertManagedBlockSafeForTarget, extractManagedBlocks } from "./writer/managedBlock.js";

export const HERMES_PROJECT_FILE = ".hermes.md";
export const HERMES_WORKSPACE_INDEX = "HERMES.md";
export const DEFAULT_HERMES_WORKSPACE = path.join(os.homedir(), "HermesWorkspace");
export const HERMES_WORKSPACE_SCHEMA_VERSION = 1;
export const HERMES_TEAM_DIR = ".agent-workflow/hermes-team";
export const HERMES_TEAM_MANIFEST = ".agent-workflow/hermes-team/manifest.json";
export const HERMES_TEAM_RULES = ".agent-workflow/hermes-team/rules.md";
export const HERMES_TEAM_DELEGATION = ".agent-workflow/hermes-team/delegation-playbook.md";
export const HERMES_TEAM_ROLE_SOURCES = ".agent-workflow/hermes-team/role-sources.md";

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

export interface HermesTeamOptions {
  workspacePath?: string;
  agencyAgentsPath?: string;
  agentRoles?: string[];
  agentDivisions?: string[];
  dryRun?: boolean;
  updatedAt?: string;
}

export interface HermesTeamManifest {
  schemaVersion: 1;
  scaffoldVersion: string;
  workspacePath: string;
  agencyAgentsPath?: string;
  agentRoles: string[];
  agentDivisions: string[];
  managedFiles: string[];
  updatedAt: string;
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

export interface HermesDoctorOptions {
  rootPath?: string;
  workspacePath?: string;
}

export interface HermesListOptions {
  workspacePath?: string;
}

export interface HermesDoctorIssue {
  level: "error" | "warning" | "info";
  relativePath: string;
  message: string;
}

export interface HermesDoctorResult {
  ok: boolean;
  rootPath: string;
  workspacePath?: string;
  issues: HermesDoctorIssue[];
}

export interface HermesTeamWritePlan {
  dryRun: boolean;
  workspacePath: string;
  workspaceIndexPath: string;
  manifestPath: string;
  warnings: string[];
  actions: HermesPlannedAction[];
  manifest: HermesTeamManifest;
  files: Array<{ relativePath: string; target: string; content: string }>;
  workspaceContent: string;
}

export interface HermesTeamWriteResult extends HermesTeamWritePlan {
  writes: WriteResult[];
}

export interface HermesTeamDoctorIssue {
  level: "error" | "warning" | "info";
  relativePath: string;
  message: string;
}

export interface HermesTeamDoctorResult {
  ok: boolean;
  workspacePath: string;
  issues: HermesTeamDoctorIssue[];
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

function listOrNone(items: string[] | undefined): string {
  return items?.length ? items.map((item) => `\`${item}\``).join(", ") : "none configured";
}

function optionalTeamLines(options: HermesTeamOptions): string[] {
  return [
    `- Workspace: ${displayPath(options.workspacePath ?? DEFAULT_HERMES_WORKSPACE)}`,
    `- Updated at: ${options.updatedAt ?? "generated at write time"}`,
    `- agency-agents path: ${options.agencyAgentsPath ? displayPath(options.agencyAgentsPath) : "none configured"}`,
    `- Suggested role ids: ${listOrNone(options.agentRoles)}`,
    `- Suggested divisions: ${listOrNone(options.agentDivisions)}`
  ];
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

export function renderHermesTeamWorkspaceMarkdown(options: HermesTeamOptions = {}): string {
  const body = [
    "# Hermes Dynamic Agent Team Rules",
    "",
    "## Purpose",
    "- Use this workspace as the computer-level coordination entrypoint for dynamic Hermes agent delegation.",
    "- Do not assume a standing team already exists. Users start Hermes and decide which concrete agents to create or delegate for the current task.",
    "- This scaffold only writes rules and references; it does not create Hermes agents, profiles, Kanban workers, skills, sessions, or runtime state.",
    "",
    "## Read First",
    `- \`${HERMES_TEAM_RULES}\` for workspace-level team boundaries.`,
    `- \`${HERMES_TEAM_DELEGATION}\` for delegation prompt structure.`,
    `- \`${HERMES_TEAM_ROLE_SOURCES}\` for optional candidate role sources.`,
    "- The `Registered Projects` section in this `HERMES.md` when present.",
    "- Each registered project's `.hermes.md` before editing that project.",
    "",
    "## Dynamic Team Model",
    "- Create or delegate agents only after the user asks Hermes to do work that benefits from role separation.",
    "- Prefer small task-scoped agents over a permanent always-on team.",
    "- Pass explicit goal, project root, relevant files, constraints, allowed toolsets, and expected final output to every delegated agent.",
    "- Keep project boundaries separate. Cross-project changes require an explicit reason and the relevant project `.hermes.md` files.",
    "",
    "## Runtime Boundary",
    "- Hermes runtime installation, login, profiles, skills, Kanban boards, and `~/.hermes/config.yaml` are managed by Hermes and the user, not by this scaffold.",
    "- Do not write secrets or global Hermes runtime configuration from these scaffold files."
  ].join("\n");

  return `${markdownBlock("hermes-team", body)}\n`;
}

export function renderHermesTeamRulesMarkdown(options: HermesTeamOptions = {}): string {
  const body = [
    "# Hermes Team Rules",
    "",
    "## Scope",
    ...optionalTeamLines(options),
    "",
    "## Operating Principles",
    "- Do not assume a standing team already exists.",
    "- Treat this file as rules for dynamically assembling task-scoped Hermes agents after the user starts Hermes.",
    "- Use delegation when the task needs parallel research, architecture planning, implementation, review, writing, browser work, or computer operation.",
    "- Keep the default path narrow: one lead Hermes session coordinates; child agents receive explicit bounded assignments.",
    "- Do not delegate secrets, credentials, destructive operations, or production-impacting changes without explicit user approval.",
    "",
    "## Suggested Dynamic Responsibilities",
    "- Planner: decompose ambiguous or cross-project work before implementation.",
    "- Implementer: edit a bounded project area with explicit verification commands.",
    "- Reviewer: inspect diffs, managed block safety, missing tests, and behavioral regressions.",
    "- Writer: maintain README, CLI docs, changelog, release notes, and project handoff docs.",
    "- Researcher: inspect external docs or local references and report source-backed findings.",
    "- Operator: perform browser or computer-use workflows only when the user has approved that environment access.",
    "",
    "## Project Coordination",
    "- Use the workspace `Registered Projects` table when present to find candidate projects.",
    "- Read each target project's `.hermes.md` before editing that project.",
    "- Prefer project-local verification commands from `.hermes.md` or the project manifest.",
    "- Do not copy project lists into team rules; the workspace index owns project registration.",
    "",
    "## Non-Goals",
    "- These rules do not create concrete Hermes agents.",
    "- These rules do not install or start Hermes.",
    "- These rules do not load or import agency-agents content.",
    "- These rules do not write any file under `~/.hermes`."
  ].join("\n");

  return `${markdownBlock("hermes-team-rules", body)}\n`;
}

export function renderHermesTeamDelegationMarkdown(options: HermesTeamOptions = {}): string {
  const body = [
    "# Hermes Delegation Playbook",
    "",
    "## When To Delegate",
    "- Delegate when independent branches can progress in parallel.",
    "- Delegate when a second role should review or challenge a plan before edits continue.",
    "- Delegate when browser, computer-use, research, implementation, and review work should remain separated.",
    "- Keep simple single-file edits in the lead Hermes session.",
    "",
    "## delegate_task Prompt Template",
    "```text",
    "Role: <planner | implementer | reviewer | writer | researcher | operator>",
    "Goal: <specific outcome>",
    "Workspace: <Hermes workspace path>",
    "Project root: <absolute project root when applicable>",
    "Context files to read:",
    "- HERMES.md",
    "- .hermes.md for each relevant project",
    "- <specific project files or docs>",
    "Constraints:",
    "- Do not modify files outside the assigned scope.",
    "- Preserve user-authored content outside managed blocks.",
    "- Do not write secrets or Hermes global runtime configuration.",
    "Allowed toolsets: <file | terminal,file | web,file | browser | computer_use>",
    "Expected final response:",
    "- Findings or changes",
    "- Files touched, if any",
    "- Verification performed",
    "- Risks or blockers",
    "```",
    "",
    "## Coordination Rules",
    "- Child agents do not inherit enough context by default; pass all required context explicitly.",
    "- Ask child agents for concise final summaries with file paths and verification commands.",
    "- Merge outputs through the lead Hermes session before committing or publishing.",
    "- Use a reviewer role before high-risk writes, generated config changes, release steps, or cross-project edits.",
    "",
    "## Toolset Guidance",
    "- `file`: reading and writing bounded project files.",
    "- `terminal,file`: build, test, lint, local scripts, and repository inspection.",
    "- `web,file`: source-backed documentation or release research.",
    "- `browser`: interactive web workflows that need a rendered browser.",
    "- `computer_use`: desktop application workflows after explicit user approval."
  ].join("\n");

  return `${markdownBlock("hermes-team-delegation", body)}\n`;
}

export function renderHermesTeamRoleSourcesMarkdown(options: HermesTeamOptions = {}): string {
  const sourceLines = options.agencyAgentsPath
    ? [
        "- External role source: `agency-agents`",
        `- Source path: ${displayPath(options.agencyAgentsPath)}`,
        `- Suggested role ids: ${listOrNone(options.agentRoles)}`,
        `- Suggested divisions: ${listOrNone(options.agentDivisions)}`,
        "- Reference only: these values describe candidate roles the user may choose after starting Hermes.",
        "- Do not import all roles by default. Select only the few roles needed for the current workflow.",
        "- This scaffold does not validate role ids, read role files, copy role content, or create Hermes agents."
      ]
    : [
        "- No external role source is configured.",
        "- Hermes can still dynamically delegate generic planner, implementer, reviewer, writer, researcher, or operator responsibilities.",
        "- Re-run `agent-workflow hermes team init` with `--agency-agents-path` and optional `--agent-roles` later to record candidate external roles."
      ];
  const body = [
    "# Hermes Team Role Sources",
    "",
    "## Source Policy",
    "- Role sources are guidance for the user and Hermes runtime, not installed team members.",
    "- Users start Hermes and decide which concrete agents or delegated tasks to create for the current goal.",
    "- The scaffold stores source hints only and never writes `~/.hermes` runtime files.",
    "",
    "## Configured Sources",
    ...sourceLines
  ].join("\n");

  return `${markdownBlock("hermes-team-role-sources", body)}\n`;
}

function teamOptionsWithDefaults(options: HermesTeamOptions = {}): Required<Pick<HermesTeamOptions, "workspacePath" | "agentRoles" | "agentDivisions" | "updatedAt">> & Pick<HermesTeamOptions, "agencyAgentsPath" | "dryRun"> {
  return {
    workspacePath: normalizeHermesPath(options.workspacePath ?? DEFAULT_HERMES_WORKSPACE),
    ...(options.agencyAgentsPath ? { agencyAgentsPath: options.agencyAgentsPath } : {}),
    agentRoles: options.agentRoles ?? [],
    agentDivisions: options.agentDivisions ?? [],
    dryRun: options.dryRun,
    updatedAt: options.updatedAt ?? new Date().toISOString()
  };
}

function buildHermesTeamManifest(options: ReturnType<typeof teamOptionsWithDefaults>): HermesTeamManifest {
  return {
    schemaVersion: 1,
    scaffoldVersion: SCAFFOLD_VERSION,
    workspacePath: options.workspacePath,
    ...(options.agencyAgentsPath ? { agencyAgentsPath: options.agencyAgentsPath } : {}),
    agentRoles: options.agentRoles,
    agentDivisions: options.agentDivisions,
    managedFiles: [
      HERMES_WORKSPACE_INDEX,
      HERMES_TEAM_RULES,
      HERMES_TEAM_DELEGATION,
      HERMES_TEAM_ROLE_SOURCES,
      HERMES_TEAM_MANIFEST
    ],
    updatedAt: options.updatedAt
  };
}

function parseHermesTeamManifest(text: string): HermesTeamManifest {
  try {
    const parsed = JSON.parse(text) as HermesTeamManifest;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.managedFiles)) {
      throw new Error("Invalid Hermes team manifest schema.");
    }
    return parsed;
  } catch {
    throw new Error("Hermes team manifest is corrupted: failed to parse JSON.");
  }
}

async function assertHermesTeamManifestSafe(manifestPath: string): Promise<void> {
  const text = await readTextIfExists(manifestPath);
  if (text !== undefined) {
    parseHermesTeamManifest(text);
  }
}

async function materializeManagedText(targetPath: string, target: string, content: string): Promise<string> {
  const existing = await readTextIfExists(targetPath);
  assertManagedBlockSafeForTarget(existing, target);
  return applyManagedText(existing, content);
}

function teamReferenceFiles(options: HermesTeamOptions): Array<{ relativePath: string; target: string; content: string }> {
  return [
    {
      relativePath: HERMES_TEAM_RULES,
      target: "hermes-team-rules",
      content: renderHermesTeamRulesMarkdown(options)
    },
    {
      relativePath: HERMES_TEAM_DELEGATION,
      target: "hermes-team-delegation",
      content: renderHermesTeamDelegationMarkdown(options)
    },
    {
      relativePath: HERMES_TEAM_ROLE_SOURCES,
      target: "hermes-team-role-sources",
      content: renderHermesTeamRoleSourcesMarkdown(options)
    }
  ];
}

export async function planHermesTeamInit(options: HermesTeamOptions = {}): Promise<HermesTeamWritePlan> {
  const resolved = teamOptionsWithDefaults(options);
  const workspacePath = resolved.workspacePath;
  const workspaceIndexPath = path.join(workspacePath, HERMES_WORKSPACE_INDEX);
  const manifestPath = path.join(workspacePath, HERMES_TEAM_MANIFEST);
  const warnings: string[] = [];
  if (resolved.agencyAgentsPath && !(await pathExists(resolved.agencyAgentsPath))) {
    warnings.push(`agency-agents path not found; recorded as reference only: ${resolved.agencyAgentsPath}`);
  }

  const manifest = buildHermesTeamManifest(resolved);
  await assertHermesTeamManifestSafe(manifestPath);
  const renderOptions = {
    workspacePath,
    ...(resolved.agencyAgentsPath ? { agencyAgentsPath: resolved.agencyAgentsPath } : {}),
    agentRoles: resolved.agentRoles,
    agentDivisions: resolved.agentDivisions,
    dryRun: resolved.dryRun,
    updatedAt: resolved.updatedAt
  };
  const files = teamReferenceFiles(renderOptions);
  const workspaceContent = await materializeManagedText(
    workspaceIndexPath,
    "hermes-team",
    renderHermesTeamWorkspaceMarkdown(renderOptions)
  );
  const actions: HermesPlannedAction[] = [
    await plannedAction(workspaceIndexPath, workspaceContent)
  ];
  for (const file of files) {
    const targetPath = path.join(workspacePath, file.relativePath);
    const content = await materializeManagedText(targetPath, file.target, file.content);
    actions.push(await plannedAction(targetPath, content));
  }
  actions.push(await plannedAction(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`));

  return {
    dryRun: Boolean(options.dryRun),
    workspacePath,
    workspaceIndexPath,
    manifestPath,
    warnings,
    actions,
    manifest,
    files,
    workspaceContent
  };
}

async function writePlannedText(targetPath: string, content: string): Promise<WriteResult> {
  const existed = await pathExists(targetPath);
  const previous = await readTextIfExists(targetPath);
  if (previous === content) {
    return { relativePath: targetPath, action: "unchanged" };
  }
  await ensureDirectory(path.dirname(targetPath));
  await writeTextFile(targetPath, content);
  return { relativePath: targetPath, action: existed ? "updated" : "created" };
}

export async function writeHermesTeamInit(options: HermesTeamOptions = {}): Promise<HermesTeamWriteResult> {
  const plan = await planHermesTeamInit({ ...options, dryRun: false });
  const writes: WriteResult[] = [];
  await ensureDirectory(plan.workspacePath);
  await ensureDirectory(path.join(plan.workspacePath, HERMES_TEAM_DIR));
  writes.push(await writePlannedText(plan.workspaceIndexPath, plan.workspaceContent));
  for (const file of plan.files) {
    const targetPath = path.join(plan.workspacePath, file.relativePath);
    const content = await materializeManagedText(targetPath, file.target, file.content);
    writes.push(await writePlannedText(targetPath, content));
  }
  writes.push(await writePlannedText(plan.manifestPath, `${JSON.stringify(plan.manifest, null, 2)}\n`));
  return {
    ...plan,
    writes
  };
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

function hasManagedBlockForTarget(content: string | undefined, target: string): boolean {
  return Boolean(content && extractManagedBlocks(content).some((block) => block.includes(`target=${target}`)));
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
    if (file.relativePath === HERMES_PROJECT_FILE) {
      assertManagedBlockSafeForTarget(await readTextIfExists(targetPath), "hermes");
    }
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
  assertManagedBlockSafeForTarget(existingWorkspaceText, "hermes-workspace");
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
  for (const file of plan.files) {
    if (file.relativePath === HERMES_PROJECT_FILE) {
      assertManagedBlockSafeForTarget(await readTextIfExists(path.resolve(plan.rootPath, HERMES_PROJECT_FILE)), "hermes");
    }
  }
  return {
    ...plan,
    writes: await writeGeneratedFiles(plan.rootPath, plan.files)
  };
}

async function readWorkspaceIndex(workspacePath: string): Promise<{ indexPath: string; index: HermesWorkspaceIndex }> {
  const indexPath = path.join(workspacePath, HERMES_WORKSPACE_INDEX);
  const text = await readTextIfExists(indexPath);
  if (!text) {
    throw new Error(`Hermes workspace index is missing: ${indexPath}`);
  }
  if (!hasManagedBlockForTarget(text, "hermes-workspace")) {
    throw new Error(`Hermes workspace index is missing managed block: ${indexPath}`);
  }
  const parsed = parseHermesWorkspaceIndex(text);
  if (!parsed) {
    throw new Error(`Hermes workspace index is missing managed project index: ${indexPath}`);
  }
  return {
    indexPath,
    index: await refreshProjectStatuses(parsed)
  };
}

async function refreshProjectStatuses(index: HermesWorkspaceIndex): Promise<HermesWorkspaceIndex> {
  return {
    schemaVersion: HERMES_WORKSPACE_SCHEMA_VERSION,
    projects: await Promise.all(index.projects.map(async (project) => {
      const rootPath = normalizeHermesPath(project.rootPath);
      return {
        ...project,
        rootPath,
        status: (await pathExists(rootPath)) ? "available" : "missing"
      };
    }))
  };
}

export async function listHermesWorkspace(options: HermesListOptions = {}): Promise<HermesWorkspaceIndex> {
  const workspacePath = normalizeHermesPath(options.workspacePath ?? DEFAULT_HERMES_WORKSPACE);
  return (await readWorkspaceIndex(workspacePath)).index;
}

export async function doctorHermes(options: HermesDoctorOptions = {}): Promise<HermesDoctorResult> {
  const rootPath = resolveRootPath(options.rootPath);
  const issues: HermesDoctorIssue[] = [];
  const addIssue = (issue: HermesDoctorIssue) => issues.push(issue);
  const profile = await analyzeProject({ rootPath, skillPaths: [] });
  const manifest = await readManifest(rootPath);
  const hermesOptions = manifest?.featureOptions?.hermes;

  if (!manifest?.enabledFeatures.hermes) {
    addIssue({
      level: "error",
      relativePath: ".agent-workflow/manifest.json",
      message: "Hermes is not enabled in the project manifest."
    });
  }

  const projectFile = hermesOptions?.projectFile;
  if (projectFile === HERMES_PROJECT_FILE || (!hermesOptions && manifest?.enabledFeatures.hermes)) {
    const projectFileText = await readTextIfExists(path.join(rootPath, HERMES_PROJECT_FILE));
    if (!projectFileText) {
      addIssue({
        level: "error",
        relativePath: HERMES_PROJECT_FILE,
        message: ".hermes.md is missing."
      });
    } else if (!hasManagedBlockForTarget(projectFileText, "hermes")) {
      addIssue({
        level: "error",
        relativePath: HERMES_PROJECT_FILE,
        message: ".hermes.md is missing the target=hermes managed block."
      });
    }
  } else if (projectFile === null) {
    addIssue({
      level: "info",
      relativePath: ".",
      message: "Project Hermes context file is disabled for this registration."
    });
  }

  const workspacePath = options.workspacePath ?? hermesOptions?.workspacePath;
  if (workspacePath) {
    const normalizedWorkspacePath = normalizeHermesPath(workspacePath);
    try {
      const { index } = await readWorkspaceIndex(normalizedWorkspacePath);
      const currentEntry = index.projects.find((project) => normalizeHermesPath(project.rootPath) === rootPath);
      if (!currentEntry) {
        addIssue({
          level: "error",
          relativePath: HERMES_WORKSPACE_INDEX,
          message: "Hermes workspace index does not contain the current project rootPath."
        });
      }
      for (const project of index.projects.filter((item) => item.status === "missing")) {
        addIssue({
          level: "warning",
          relativePath: HERMES_WORKSPACE_INDEX,
          message: `Hermes workspace project is missing: ${project.rootPath}`
        });
      }
      if (options.workspacePath && !hermesOptions?.workspacePath) {
        addIssue({
          level: "warning",
          relativePath: ".agent-workflow/manifest.json",
          message: "Workspace was provided by CLI but is not recorded in the project manifest."
        });
      }
    } catch (error) {
      addIssue({
        level: "error",
        relativePath: HERMES_WORKSPACE_INDEX,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  } else {
    addIssue({
      level: "info",
      relativePath: ".",
      message: "No Hermes workspace is recorded for this project. Run `agent-workflow hermes register` to add it to a computer-level workspace."
    });
  }

  if (profile.confidence === "low" || profile.isEmptyProject) {
    addIssue({
      level: "warning",
      relativePath: ".",
      message: "Project profile is low confidence or empty. Re-run Hermes registration after adding manifest, docs, or source files."
    });
  }

  addIssue({
    level: "info",
    relativePath: ".",
    message: "Hermes runtime installation and ~/.hermes/config.yaml are managed by Hermes and are not checked by this scaffold."
  });

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    rootPath,
    workspacePath: hermesOptions?.workspacePath ?? options.workspacePath,
    issues
  };
}

function addTeamIssue(issues: HermesTeamDoctorIssue[], issue: HermesTeamDoctorIssue): void {
  issues.push(issue);
}

async function checkTeamManagedFile(
  issues: HermesTeamDoctorIssue[],
  workspacePath: string,
  relativePath: string,
  target: string
): Promise<void> {
  const absolutePath = path.join(workspacePath, relativePath);
  const text = await readTextIfExists(absolutePath);
  if (!text) {
    addTeamIssue(issues, {
      level: "error",
      relativePath,
      message: "Hermes team managed file is missing."
    });
    return;
  }

  try {
    assertManagedBlockSafeForTarget(text, target);
  } catch (error) {
    addTeamIssue(issues, {
      level: "error",
      relativePath,
      message: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  if (!hasManagedBlockForTarget(text, target)) {
    addTeamIssue(issues, {
      level: "error",
      relativePath,
      message: `Hermes team managed file is missing the target=${target} managed block.`
    });
  }
}

export async function doctorHermesTeam(options: HermesTeamOptions = {}): Promise<HermesTeamDoctorResult> {
  const workspacePath = normalizeHermesPath(options.workspacePath ?? DEFAULT_HERMES_WORKSPACE);
  const issues: HermesTeamDoctorIssue[] = [];

  if (!(await pathExists(workspacePath))) {
    addTeamIssue(issues, {
      level: "error",
      relativePath: ".",
      message: `Hermes workspace is missing: ${workspacePath}`
    });
  }

  await checkTeamManagedFile(issues, workspacePath, HERMES_WORKSPACE_INDEX, "hermes-team");
  await checkTeamManagedFile(issues, workspacePath, HERMES_TEAM_RULES, "hermes-team-rules");
  await checkTeamManagedFile(issues, workspacePath, HERMES_TEAM_DELEGATION, "hermes-team-delegation");
  await checkTeamManagedFile(issues, workspacePath, HERMES_TEAM_ROLE_SOURCES, "hermes-team-role-sources");

  const manifestText = await readTextIfExists(path.join(workspacePath, HERMES_TEAM_MANIFEST));
  if (!manifestText) {
    addTeamIssue(issues, {
      level: "error",
      relativePath: HERMES_TEAM_MANIFEST,
      message: "Hermes team manifest is missing."
    });
  } else {
    try {
      const manifest = parseHermesTeamManifest(manifestText);
      if (manifest.agencyAgentsPath && !(await pathExists(manifest.agencyAgentsPath))) {
        addTeamIssue(issues, {
          level: "warning",
          relativePath: HERMES_TEAM_MANIFEST,
          message: `agency-agents path not found; recorded as reference only: ${manifest.agencyAgentsPath}`
        });
      }
    } catch (error) {
      addTeamIssue(issues, {
        level: "error",
        relativePath: HERMES_TEAM_MANIFEST,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }

  addTeamIssue(issues, {
    level: "info",
    relativePath: ".",
    message: "Hermes runtime installation, concrete agents, Kanban workers, and ~/.hermes/config.yaml are managed by Hermes and are not checked by this scaffold."
  });

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    workspacePath,
    issues
  };
}
