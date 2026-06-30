import os from "node:os";
import path from "node:path";
import { markdownBlock } from "./generators/helpers.js";
import type { ProjectManifestInfo, ProjectProfile } from "./types.js";
import { pathExists } from "./utils/fs.js";

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
