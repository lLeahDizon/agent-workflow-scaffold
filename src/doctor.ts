import { generateProject } from "./generators/index.js";
import { inspectHeadroomInstall, isCommandAvailable } from "./headroom.js";
import { MANIFEST_PATH, readManifest, resolveHeadroomOptions } from "./manifest.js";
import type { DoctorIssue, DoctorResult, GenerateOptions } from "./types.js";
import { normalizeTarget } from "./utils/format.js";
import { pathExists, readJsonIfExists, readTextIfExists } from "./utils/fs.js";
import { SCAFFOLD_VERSION } from "./version.js";
import { resolveTargetPath } from "./writer/fileWriter.js";
import { hasAnyManagedBlock, hasLegacyManagedBlock, hasVersionedManagedBlock } from "./writer/managedBlock.js";

function hasMcpServer(value: unknown, serverName: string): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const mcpServers = (value as { mcpServers?: unknown }).mcpServers;
  if (!mcpServers || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
    return false;
  }
  return serverName in mcpServers;
}

export async function doctorProject(options: GenerateOptions = {}): Promise<DoctorResult> {
  const result = await generateProject(options);
  const issues: DoctorIssue[] = [];
  const selectedTargets = normalizeTarget(options.target);
  const manifest = await readManifest(result.profile.rootPath);
  const headroom = resolveHeadroomOptions({
    headroom: options.headroom,
    headroomCommand: options.headroomCommand,
    headroomArgs: options.headroomArgs,
    existingManifest: manifest
  });

  for (const file of result.files) {
    const targetPath = resolveTargetPath(result.profile.rootPath, file.relativePath);
    const exists = await pathExists(targetPath);
    if (!exists) {
      issues.push({
        level: file.mode === "directory" ? "warning" : "error",
        target: file.target,
        relativePath: file.relativePath,
        message: "Generated artifact is missing. Run init --write for this target."
      });
      continue;
    }
    if (file.mode === "managed-text") {
      const text = await readTextIfExists(targetPath);
      if (text && hasLegacyManagedBlock(text)) {
        issues.push({
          level: "warning",
          target: file.target,
          relativePath: file.relativePath,
          message: "Legacy managed block detected. Run upgrade to add scaffold version metadata."
        });
      } else if (text && hasAnyManagedBlock(text) && !hasVersionedManagedBlock(text)) {
        issues.push({
          level: "warning",
          target: file.target,
          relativePath: file.relativePath,
          message: "Managed block version metadata is missing."
        });
      }
    }
  }

  if (!manifest) {
    for (const target of selectedTargets) {
      issues.push({
        level: "warning",
        target,
        relativePath: MANIFEST_PATH,
        message: "Agent workflow manifest is missing. Run upgrade --write to create it."
      });
    }
  } else {
    if (manifest.scaffoldVersion !== SCAFFOLD_VERSION) {
      for (const target of selectedTargets) {
        issues.push({
          level: "warning",
          target,
          relativePath: MANIFEST_PATH,
          message: `Manifest scaffold version is ${manifest.scaffoldVersion}; current CLI is ${SCAFFOLD_VERSION}. Run upgrade.`
        });
      }
    }
    if (manifest.enabledFeatures?.loopEngineering && !options.loopEngineering) {
      for (const target of selectedTargets) {
        issues.push({
          level: "info",
          target,
          relativePath: MANIFEST_PATH,
          message: "Loop Engineering is enabled in manifest. Pass --loop-engineering when checking or upgrading this project."
        });
      }
    }
    if (manifest.enabledFeatures?.headroom && !options.headroom) {
      for (const target of selectedTargets) {
        issues.push({
          level: "info",
          target,
          relativePath: MANIFEST_PATH,
          message: "Headroom is enabled in manifest. Pass --headroom when checking or upgrading this project."
        });
      }
    }
  }

  if (headroom.enabled) {
    const mcpConfigPaths: Partial<Record<(typeof selectedTargets)[number], string>> = {
      codex: ".codex/mcp.agent-workflow.json",
      "claude-code": ".mcp.json"
    };
    for (const target of selectedTargets) {
      const relativePath = mcpConfigPaths[target];
      if (!relativePath) {
        continue;
      }
      const targetPath = resolveTargetPath(result.profile.rootPath, relativePath);
      const json = await readJsonIfExists<unknown>(targetPath);
      if (json && !hasMcpServer(json, "headroom")) {
        issues.push({
          level: "error",
          target,
          relativePath,
          message: "Headroom MCP server is missing. Re-run init --headroom --write or upgrade --headroom --write."
        });
      }
    }

    const install = await inspectHeadroomInstall();
    for (const target of selectedTargets) {
      if (headroom.command.includes("/") || headroom.command.includes("\\")) {
        const commandExists = await pathExists(headroom.command);
        if (!commandExists) {
          issues.push({
            level: "warning",
            target,
            relativePath: ".",
            message: `Configured Headroom command does not exist: ${headroom.command}.`
          });
        }
      } else if (headroom.command !== "headroom" && !(await isCommandAvailable(headroom.command))) {
        issues.push({
          level: "warning",
          target,
          relativePath: ".",
          message: `Configured Headroom command \`${headroom.command}\` is not available in the current PATH.`
        });
      }
      if (!install.executableExists) {
        issues.push({
          level: "warning",
          target,
          relativePath: ".",
          message: `Managed Headroom executable is missing at ${install.executablePath}. Run agent-workflow headroom install.`
        });
      }
      if (headroom.command === "headroom" && !install.pathCommandFound) {
        issues.push({
          level: "warning",
          target,
          relativePath: ".",
          message: "Configured Headroom command `headroom` is not available in the current PATH. Add the managed venv bin directory to the client environment or override --headroom-command."
        });
      }
    }
  }

  if (result.profile.projectType === "custom") {
    for (const target of normalizeTarget(options.target)) {
      issues.push({
        level: "warning",
        target,
        relativePath: ".",
        message: "Project type is custom; generated rules are generic. Consider passing --project-type."
      });
    }
  }

  return {
    ok: issues.every((issue) => issue.level !== "error"),
    profile: result.profile,
    issues
  };
}
