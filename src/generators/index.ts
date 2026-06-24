import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import { buildManifest, manifestFile, readManifest } from "../manifest.js";
import type { AgentTarget, GeneratedFile, GenerateOptions, GenerationResult, ProjectProfile } from "../types.js";
import { normalizeTarget } from "../utils/format.js";
import { generateClaudeCode } from "./claudeCode.js";
import { generateCodex } from "./codex.js";
import { generateTrae } from "./trae.js";

export interface GenerateForTargetsOptions {
  loopEngineering?: boolean;
}

export function generateForTargets(
  profile: ProjectProfile,
  targets: AgentTarget[],
  options: GenerateForTargetsOptions = {}
): GeneratedFile[] {
  return targets.flatMap((target) => {
    switch (target) {
      case "codex":
        return generateCodex(profile, options);
      case "trae":
        return generateTrae(profile, options);
      case "claude-code":
        return generateClaudeCode(profile, options);
    }
  });
}

export async function generateProject(options: GenerateOptions = {}): Promise<GenerationResult> {
  const profile = await analyzeProject(options);
  const targets = normalizeTarget(options.target);
  const files = generateForTargets(profile, targets, {
    loopEngineering: options.loopEngineering
  });
  const existingManifest = await readManifest(profile.rootPath);
  files.push(manifestFile(buildManifest({
    projectId: profile.projectId,
    targets,
    files,
    loopEngineering: options.loopEngineering,
    existingManifest
  })));
  return {
    profile,
    files
  };
}
