import { analyzeProject } from "../analyzers/projectAnalyzer.js";
import type { AgentTarget, GeneratedFile, GenerateOptions, GenerationResult, ProjectProfile } from "../types.js";
import { normalizeTarget } from "../utils/format.js";
import { generateClaudeCode } from "./claudeCode.js";
import { generateCodex } from "./codex.js";
import { generateTrae } from "./trae.js";

export function generateForTargets(profile: ProjectProfile, targets: AgentTarget[]): GeneratedFile[] {
  return targets.flatMap((target) => {
    switch (target) {
      case "codex":
        return generateCodex(profile);
      case "trae":
        return generateTrae(profile);
      case "claude-code":
        return generateClaudeCode(profile);
    }
  });
}

export async function generateProject(options: GenerateOptions = {}): Promise<GenerationResult> {
  const profile = await analyzeProject(options);
  const targets = normalizeTarget(options.target);
  return {
    profile,
    files: generateForTargets(profile, targets)
  };
}
