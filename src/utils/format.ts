import path from "node:path";
import type { AgentTarget, ProjectProfile, TargetInput } from "../types.js";

export function resolveRootPath(rootPath?: string): string {
  return path.resolve(rootPath ?? process.cwd());
}

export function normalizeTarget(target?: TargetInput): AgentTarget[] {
  if (!target || target === "all") {
    return ["codex", "trae", "claude-code"];
  }
  return [target];
}

export function slugifyProjectId(name: string): string {
  const cleaned = name
    .trim()
    .replace(/^@/, "")
    .replace(/\//g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

  return cleaned || "project";
}

export function indentLines(lines: string[], prefix = "- "): string {
  return lines.length > 0 ? lines.map((line) => `${prefix}${line}`).join("\n") : `${prefix}None detected`;
}

export function formatProfileSummary(profile: ProjectProfile): string {
  return [
    `Project: ${profile.displayName}`,
    `Root: ${profile.rootPath}`,
    `Type: ${profile.projectType}`,
    `Package manager: ${profile.packageManager}`,
    `Tech stack: ${profile.techStack.join(", ") || "unknown"}`,
    `Docs: ${profile.docFiles.length}`,
    `Existing Agent config: codex=${profile.existingAgentConfig.codex}, trae=${profile.existingAgentConfig.trae}, claude=${profile.existingAgentConfig.claudeCode}`
  ].join("\n");
}
