import { generateProject } from "./generators/index.js";
import type { DoctorIssue, DoctorResult, GenerateOptions } from "./types.js";
import { normalizeTarget } from "./utils/format.js";
import { pathExists } from "./utils/fs.js";
import { resolveTargetPath } from "./writer/fileWriter.js";

export async function doctorProject(options: GenerateOptions = {}): Promise<DoctorResult> {
  const result = await generateProject(options);
  const issues: DoctorIssue[] = [];

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
