import path from "node:path";
import type { GeneratedFile, WriteResult } from "../types.js";
import { ensureDirectory, pathExists, readJsonIfExists, readTextIfExists, writeTextFile } from "../utils/fs.js";
import { applyManagedText, deepMergeJson } from "./managedBlock.js";

export function resolveTargetPath(rootPath: string, relativePath: string): string {
  const root = path.resolve(rootPath);
  const targetPath = path.resolve(root, relativePath);
  const relative = path.relative(root, targetPath);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Generated path escapes target root: ${relativePath}`);
  }
  return targetPath;
}

export async function materializeFile(rootPath: string, file: GeneratedFile): Promise<string> {
  if (file.mode === "directory") {
    return "";
  }

  const targetPath = resolveTargetPath(rootPath, file.relativePath);
  if (file.mode === "managed-text") {
    return applyManagedText(await readTextIfExists(targetPath), file.content);
  }

  const existingJson = (await pathExists(targetPath)) ? await readJsonIfExists<unknown>(targetPath) : undefined;
  const merged = deepMergeJson(existingJson ?? {}, file.jsonMerge ?? JSON.parse(file.content));
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export async function writeGeneratedFiles(rootPath: string, files: GeneratedFile[]): Promise<WriteResult[]> {
  const results: WriteResult[] = [];

  for (const file of files) {
    const targetPath = resolveTargetPath(rootPath, file.relativePath);
    if (file.mode === "directory") {
      await ensureDirectory(targetPath);
      results.push({ relativePath: file.relativePath, action: "directory" });
      continue;
    }

    const existed = await pathExists(targetPath);
    const nextContent = await materializeFile(rootPath, file);
    const previousContent = await readTextIfExists(targetPath);
    if (previousContent === nextContent) {
      results.push({ relativePath: file.relativePath, action: "unchanged" });
      continue;
    }

    await writeTextFile(targetPath, nextContent);
    results.push({ relativePath: file.relativePath, action: existed ? "updated" : "created" });
  }

  return results;
}
