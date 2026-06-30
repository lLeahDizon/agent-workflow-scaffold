import path from "node:path";
import { normalizeTarget } from "./utils/format.js";
import { pathExists, readJsonIfExists } from "./utils/fs.js";
import type { AgentTarget, GeneratedFile, HeadroomOptions, TargetInput } from "./types.js";
import { SCAFFOLD_VERSION, SCHEMA_VERSION } from "./version.js";

export const MANIFEST_PATH = ".agent-workflow/manifest.json";
export const DEFAULT_HEADROOM_COMMAND = "headroom";
export const DEFAULT_HEADROOM_ARGS = ["mcp", "serve"] as const;

export interface AgentWorkflowManifest {
  scaffoldVersion: string;
  schemaVersion: number;
  projectId: string;
  targets: AgentTarget[];
  enabledFeatures: {
    loopEngineering?: boolean;
    headroom?: boolean;
    hermes?: boolean;
  };
  featureOptions?: {
    headroom?: HeadroomOptions;
    hermes?: HermesOptions;
  };
  managedFiles: string[];
  previousScaffoldVersion?: string;
  lastUpgradeAt?: string;
  lastBackupPath?: string;
}

export interface HermesOptions {
  workspacePath?: string;
  workspaceIndex?: "HERMES.md";
  projectFile?: ".hermes.md" | null;
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
  headroom?: HeadroomOptions;
  existingManifest?: AgentWorkflowManifest;
  upgrade?: boolean;
  lastBackupPath?: string;
}): AgentWorkflowManifest {
  const existingFeatures = input.existingManifest?.enabledFeatures ?? {};
  const existingFeatureOptions = input.existingManifest?.featureOptions ?? {};
  const enabledFeatures = {
    ...existingFeatures,
    ...(input.loopEngineering ? { loopEngineering: true } : {}),
    ...(input.headroom?.enabled ? { headroom: true } : {})
  };
  const featureOptions = {
    ...existingFeatureOptions,
    ...(input.headroom?.enabled
      ? {
          headroom: {
            enabled: true,
            command: input.headroom.command,
            args: input.headroom.args
          }
        }
      : {})
  };
  return {
    scaffoldVersion: SCAFFOLD_VERSION,
    schemaVersion: SCHEMA_VERSION,
    projectId: input.projectId,
    targets: input.targets,
    enabledFeatures,
    ...(Object.keys(featureOptions).length > 0 ? { featureOptions } : {}),
    managedFiles: Array.from(new Set(input.files.map((file) => file.relativePath))).sort(),
    ...(input.upgrade && input.existingManifest?.scaffoldVersion
      ? { previousScaffoldVersion: input.existingManifest.scaffoldVersion }
      : {}),
    ...(input.upgrade ? { lastUpgradeAt: new Date().toISOString() } : {}),
    ...(input.lastBackupPath ? { lastBackupPath: input.lastBackupPath } : input.existingManifest?.lastBackupPath ? { lastBackupPath: input.existingManifest.lastBackupPath } : {})
  };
}

export function buildHermesManifest(input: {
  projectId: string;
  existingManifest?: AgentWorkflowManifest;
  hermes: HermesOptions;
}): AgentWorkflowManifest {
  const existing = input.existingManifest;
  return {
    scaffoldVersion: SCAFFOLD_VERSION,
    schemaVersion: SCHEMA_VERSION,
    projectId: input.projectId,
    targets: existing?.targets ?? [],
    enabledFeatures: {
      ...(existing?.enabledFeatures ?? {}),
      hermes: true
    },
    featureOptions: {
      ...(existing?.featureOptions ?? {}),
      hermes: input.hermes
    },
    managedFiles: Array.from(new Set([...(existing?.managedFiles ?? []), ...(input.hermes.projectFile ? [input.hermes.projectFile] : []), MANIFEST_PATH])).sort(),
    ...(existing?.lastBackupPath ? { lastBackupPath: existing.lastBackupPath } : {})
  };
}

export function resolveHeadroomOptions(input: {
  headroom?: boolean;
  headroomCommand?: string;
  headroomArgs?: string[];
  existingManifest?: AgentWorkflowManifest;
}): HeadroomOptions {
  const existing = input.existingManifest?.featureOptions?.headroom;
  const enabled = Boolean(input.headroom || input.existingManifest?.enabledFeatures?.headroom);
  return {
    enabled,
    command: input.headroomCommand || existing?.command || DEFAULT_HEADROOM_COMMAND,
    args: input.headroomArgs?.length ? input.headroomArgs : existing?.args?.length ? existing.args : [...DEFAULT_HEADROOM_ARGS]
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
