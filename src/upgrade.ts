import path from "node:path";
import { cp, mkdir } from "node:fs/promises";
import { analyzeProject } from "./analyzers/projectAnalyzer.js";
import { diffGeneratedFiles, type FileDiffSummary } from "./diff.js";
import { generateForTargets } from "./generators/index.js";
import { buildManifest, detectConfiguredTargets, manifestFile, readManifest, resolveHeadroomOptions } from "./manifest.js";
import type { AgentTarget, GeneratedFile, GenerateOptions, TargetInput, WriteResult } from "./types.js";
import { pathExists } from "./utils/fs.js";
import { resolveTargetPath, writeGeneratedFiles } from "./writer/fileWriter.js";

export interface UpgradeOptions extends GenerateOptions {
  write?: boolean;
  backup?: boolean;
}

export interface UpgradeResult {
  rootPath: string;
  projectId: string;
  targets: AgentTarget[];
  files: GeneratedFile[];
  diff: FileDiffSummary[];
  writes: WriteResult[];
  backupPath?: string;
  skippedReason?: string;
}

function timestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

async function backupFiles(rootPath: string, files: GeneratedFile[], diff: FileDiffSummary[]): Promise<string | undefined> {
  const updatePaths = new Set(diff.filter((item) => item.status === "update").map((item) => item.relativePath));
  if (updatePaths.size === 0) {
    return undefined;
  }

  const relativeBackupRoot = `.agent-workflow/backups/${timestamp()}`;
  const backupRoot = resolveTargetPath(rootPath, relativeBackupRoot);
  for (const file of files) {
    if (!updatePaths.has(file.relativePath)) {
      continue;
    }
    const sourcePath = resolveTargetPath(rootPath, file.relativePath);
    if (!(await pathExists(sourcePath))) {
      continue;
    }
    const targetPath = path.join(backupRoot, file.relativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }
  return relativeBackupRoot;
}

export async function planUpgrade(options: UpgradeOptions = {}): Promise<UpgradeResult> {
  const profile = await analyzeProject(options);
  const targetInput: TargetInput | undefined = options.target;
  const targets = await detectConfiguredTargets(profile.rootPath, targetInput);
  if (targets.length === 0) {
    return {
      rootPath: profile.rootPath,
      projectId: profile.projectId,
      targets,
      files: [],
      diff: [],
      writes: [],
      skippedReason: "No existing Agent workflow target detected. Run setup or init first."
    };
  }

  const existingManifest = await readManifest(profile.rootPath);
  const headroom = resolveHeadroomOptions({
    headroom: options.headroom,
    headroomCommand: options.headroomCommand,
    headroomArgs: options.headroomArgs,
    existingManifest
  });
  const files = generateForTargets(profile, targets, {
    loopEngineering: options.loopEngineering,
    headroom
  });
  files.push(manifestFile(buildManifest({
    projectId: profile.projectId,
    targets,
    files,
    loopEngineering: options.loopEngineering,
    headroom,
    existingManifest,
    upgrade: true
  })));
  const diff = await diffGeneratedFiles(profile.rootPath, files);
  return {
    rootPath: profile.rootPath,
    projectId: profile.projectId,
    targets,
    files,
    diff,
    writes: []
  };
}

export async function upgradeProject(options: UpgradeOptions = {}): Promise<UpgradeResult> {
  const planned = await planUpgrade(options);
  if (planned.skippedReason || !options.write) {
    return planned;
  }

  const backupPath = options.backup ? await backupFiles(planned.rootPath, planned.files, planned.diff) : undefined;
  const existingManifest = await readManifest(planned.rootPath);
  const headroom = resolveHeadroomOptions({
    headroom: options.headroom,
    headroomCommand: options.headroomCommand,
    headroomArgs: options.headroomArgs,
    existingManifest
  });
  const manifestIndex = planned.files.findIndex((file) => file.relativePath === ".agent-workflow/manifest.json");
  if (manifestIndex >= 0) {
    planned.files[manifestIndex] = manifestFile(buildManifest({
      projectId: planned.projectId,
      targets: planned.targets,
      files: planned.files.filter((file) => file.relativePath !== ".agent-workflow/manifest.json"),
      loopEngineering: options.loopEngineering,
      headroom,
      existingManifest,
      upgrade: true,
      lastBackupPath: backupPath
    }));
  }
  const writes = await writeGeneratedFiles(planned.rootPath, planned.files);
  return {
    ...planned,
    backupPath,
    writes
  };
}
