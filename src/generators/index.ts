import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import { buildManifest, manifestFile, readManifest, resolveHeadroomOptions } from "../manifest.js";
import type { AgentTarget, GeneratedFile, GenerateOptions, GenerationResult, HeadroomOptions, ProjectProfile } from "../types.js";
import { normalizeTarget } from "../utils/format.js";
import { generateClaudeCode } from "./claudeCode.js";
import { generateCodex } from "./codex.js";
import { generateTrae } from "./trae.js";

export interface GenerateForTargetsOptions {
  loopEngineering?: boolean;
  headroom?: HeadroomOptions;
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
    existingManifest
  })));
  return {
    profile,
    files
  };
}
