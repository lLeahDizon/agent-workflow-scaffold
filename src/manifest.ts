import path from "node:path";
import { normalizeTarget } from "./utils/format.js";
import { pathExists, readJsonIfExists } from "./utils/fs.js";
import type { AgentTarget, GeneratedFile, TargetInput } from "./types.js";
import { SCAFFOLD_VERSION, SCHEMA_VERSION } from "./version.js";

export const MANIFEST_PATH = ".agent-workflow/manifest.json";

export interface AgentWorkflowManifest {
  scaffoldVersion: string;
  schemaVersion: number;
  projectId: string;
  targets: AgentTarget[];
  enabledFeatures: {
    loopEngineering?: boolean;
  };
  managedFiles: string[];
  previousScaffoldVersion?: string;
  lastUpgradeAt?: string;
  lastBackupPath?: string;
}

export async function readManifest(rootPath: string): Promise<AgentWorkflowManifest | undefined> {
  return readJsonIfExists<AgentWorkflowManifest>(path.join(rootPath, MANIFEST_PATH));
}

export async function detectConfiguredTargets(rootPath: string, target?: TargetInput): Promise<AgentTarget[]> {
  if (target) {
    return normalizeTarget(target);
  }

  const manifest = await readManifest(rootPath);
  if (manifest?.targets?.length) {
    return manifest.targets;
  }

  const checks: Array<[AgentTarget, string[]]> = [
    ["codex", ["AGENTS.md", ".codex/config.toml"]],
    ["trae", [".trae/AGENTS.md", ".trae/mcp.json"]],
    ["claude-code", ["CLAUDE.md", ".claude/settings.json", ".mcp.json"]]
  ];
  const detected: AgentTarget[] = [];
  for (const [agentTarget, files] of checks) {
    for (const file of files) {
      if (await pathExists(path.join(rootPath, file))) {
        detected.push(agentTarget);
        break;
      }
    }
  }
  return detected;
}

export function buildManifest(input: {
  projectId: string;
  targets: AgentTarget[];
  files: GeneratedFile[];
  loopEngineering?: boolean;
  existingManifest?: AgentWorkflowManifest;
  upgrade?: boolean;
  lastBackupPath?: string;
}): AgentWorkflowManifest {
  const existingFeatures = input.existingManifest?.enabledFeatures ?? {};
  const enabledFeatures = {
    ...existingFeatures,
    ...(input.loopEngineering ? { loopEngineering: true } : {})
  };
  return {
    scaffoldVersion: SCAFFOLD_VERSION,
    schemaVersion: SCHEMA_VERSION,
    projectId: input.projectId,
    targets: input.targets,
    enabledFeatures,
    managedFiles: Array.from(new Set(input.files.map((file) => file.relativePath))).sort(),
    ...(input.upgrade && input.existingManifest?.scaffoldVersion
      ? { previousScaffoldVersion: input.existingManifest.scaffoldVersion }
      : {}),
    ...(input.upgrade ? { lastUpgradeAt: new Date().toISOString() } : {}),
    ...(input.lastBackupPath ? { lastBackupPath: input.lastBackupPath } : input.existingManifest?.lastBackupPath ? { lastBackupPath: input.existingManifest.lastBackupPath } : {})
  };
}

export function manifestFile(manifest: AgentWorkflowManifest): GeneratedFile {
  return {
    target: "codex",
    relativePath: MANIFEST_PATH,
    content: `${JSON.stringify(manifest, null, 2)}\n`,
    mode: "structured-json",
    jsonMerge: manifest
  };
}
