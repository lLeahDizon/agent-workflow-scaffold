import { generateProject } from "./generators/index.js";
import { MANIFEST_PATH, readManifest } from "./manifest.js";
import type { DoctorIssue, DoctorResult, GenerateOptions } from "./types.js";
import { normalizeTarget } from "./utils/format.js";
import { pathExists, readTextIfExists } from "./utils/fs.js";
import { SCAFFOLD_VERSION } from "./version.js";
import { resolveTargetPath } from "./writer/fileWriter.js";
import { hasAnyManagedBlock, hasLegacyManagedBlock, hasVersionedManagedBlock } from "./writer/managedBlock.js";

export async function doctorProject(options: GenerateOptions = {}): Promise<DoctorResult> {
  const result = await generateProject(options);
  const issues: DoctorIssue[] = [];
  const selectedTargets = normalizeTarget(options.target);
  const manifest = await readManifest(result.profile.rootPath);

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
