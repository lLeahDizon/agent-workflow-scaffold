import type { GeneratedFile } from "./types.js";
import { readTextIfExists } from "./utils/fs.js";
import { materializeFile, resolveTargetPath } from "./writer/fileWriter.js";

export interface FileDiffSummary {
  relativePath: string;
  status: "create" | "update" | "unchanged" | "directory";
  addedLines: number;
  removedLines: number;
}

export async function diffGeneratedFiles(rootPath: string, files: GeneratedFile[]): Promise<FileDiffSummary[]> {
  const summaries: FileDiffSummary[] = [];
  for (const file of files) {
    resolveTargetPath(rootPath, file.relativePath);
    if (file.mode === "directory") {
      summaries.push({ relativePath: file.relativePath, status: "directory", addedLines: 0, removedLines: 0 });
      continue;
    }
    const targetPath = resolveTargetPath(rootPath, file.relativePath);
    const existing = await readTextIfExists(targetPath);
    const next = await materializeFile(rootPath, file);
    if (existing === undefined) {
      summaries.push({
        relativePath: file.relativePath,
        status: "create",
        addedLines: next.split("\n").length,
        removedLines: 0
      });
      continue;
    }
    if (existing === next) {
      summaries.push({ relativePath: file.relativePath, status: "unchanged", addedLines: 0, removedLines: 0 });
      continue;
    }
    summaries.push({
      relativePath: file.relativePath,
      status: "update",
      addedLines: Math.max(0, next.split("\n").length - existing.split("\n").length),
      removedLines: Math.max(0, existing.split("\n").length - next.split("\n").length)
    });
  }
  return summaries;
}
